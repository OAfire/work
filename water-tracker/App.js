// App.js — Water Tracker (Expo SDK 54)
// Навигация: нижний бар. Исправлены: тумблер "Кофеин", сетка напитков (2–3 колонки).
// Фичи: быстрые объёмы, свои напитки, Undo, экспорт/импорт (ленивые импорты),
// умные напоминания (окно/частота), AsyncStorage.

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { SafeAreaView, View, Text, Pressable, StyleSheet, ScrollView, TextInput, Alert, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const { width: W } = Dimensions.get('window');

// ---------- Theme
const T = {
  bg: '#0b1220',
  fg: '#e5ecff',
  dim: '#9aa7bd',
  card: '#13233e',
  cardSoft: '#1a2c4b',
  lightCell: '#f2f6ff',
  lightBorder: '#d8e2ff',
  accent: '#51c3ff',
  ok: '#22c55e',
  warn: '#f59e0b',
  danger: '#ef4444',
  border: '#2f3d55',
  glass: '#0f1830',
};

// ---------- Defaults
const K_SAVE = 'water_tracker_save_v3';
const MAX_HISTORY = 50;

const DEFAULT_DRINKS = [
  { id: 'w200', name: 'Вода', ml: 200, factor: 1, caffeinated: false, emoji: '💧' },
  { id: 'w300', name: 'Вода', ml: 300, factor: 1, caffeinated: false, emoji: '💧' },
  { id: 'w500', name: 'Вода', ml: 500, factor: 1, caffeinated: false, emoji: '💧' },
  { id: 'tea',  name: 'Чай',  ml: 200, factor: 0.9, caffeinated: true,  emoji: '🍵' },
  { id: 'cof',  name: 'Кофе', ml: 150, factor: 0.8, caffeinated: true,  emoji: '☕️' },
];

const START = {
  goal: 2000,
  drinks: DEFAULT_DRINKS,
  entries: {},
  history: [],
  reminders: { enabled:true, start:'09:00', end:'21:00', everyMin:90, dnd:true },
  firstRun: true,
};

const uuid = ()=>'xxxxxxxx'.replace(/x/g,()=> (Math.random()*16|0).toString(16));
const todayKey = (d=new Date())=>{
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false }),
});

// ---------- App
export default function App(){
  const [state, setState] = useState(START);
  const [tab, setTab] = useState('today'); // today | drinks | stats | settings | import
  const day = todayKey();

  useEffect(()=>{ (async()=>{
    const raw = await AsyncStorage.getItem(K_SAVE);
    if(raw){ try { setState(s=>({...s, ...JSON.parse(raw)})); } catch(e){} }
  })(); },[]);
  useEffect(()=>{ AsyncStorage.setItem(K_SAVE, JSON.stringify(state)); },[state]);

  const totalToday = useMemo(()=>{
    const list = state.entries[day] || [];
    return list.reduce((acc,e)=>{
      const d = state.drinks.find(x=>x.id===e.drinkId);
      const ml = e.ml ?? d?.ml ?? 0;
      const f = d?.factor ?? 1;
      return acc + Math.round(ml * f);
    },0);
  },[state.entries, state.drinks, day]);

  const progress = Math.min(1, totalToday / state.goal);
  const remaining = Math.max(0, state.goal - totalToday);

  const addEntry = useCallback((drink)=>{
    const when = new Date().toISOString();
    setState(prev=>{
      const dKey = todayKey(new Date(when));
      const list = prev.entries[dKey] || [];
      const entry = { id: uuid(), drinkId: drink.id, ml: drink.ml, when };
      const entries = { ...prev.entries, [dKey]: [...list, entry] };
      const hist = [{ type:'add', when, payload: entry }, ...prev.history].slice(0, MAX_HISTORY);
      return { ...prev, entries, history: hist };
    });
  },[]);

  const undoLast = useCallback(()=>{
    setState(prev=>{
      if(!prev.history.length) return prev;
      const [last, ...rest] = prev.history;
      if(last.type==='add'){
        const dKey = todayKey(new Date(last.when));
        const list = prev.entries[dKey] || [];
        const idx = list.findIndex(x=> x.when===last.when);
        if(idx!==-1){
          const copy=[...list]; copy.splice(idx,1);
          return { ...prev, entries: { ...prev.entries, [dKey]: copy }, history: rest };
        }
      }
      return { ...prev, history: rest };
    })
  },[]);

  const dismissFirstRun = useCallback(()=> setState(s=>({...s, firstRun:false})),[]);
  const fullReset = useCallback(()=>{
    Alert.alert('Сброс','Удалить весь прогресс?',[
      {text:'Отмена', style:'cancel'},
      {text:'Стереть', style:'destructive', onPress: async ()=>{ await AsyncStorage.removeItem(K_SAVE); setState(START); }}
    ]);
  },[]);

  return (
    <SafeAreaView style={{flex:1, backgroundColor:T.bg}}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>💧 Water Tracker</Text>
        <View style={{flex:1}}/>
        <Pressable onPress={undoLast} style={styles.chip}><Text style={styles.chipTxt}>↩︎ Отменить</Text></Pressable>
      </View>

      {/* Content */}
      <View style={{flex:1, paddingBottom: 74}}>
        {tab==='today' && (
          <TodayScreen
            state={state}
            totalToday={totalToday}
            progress={progress}
            remaining={remaining}
            onAdd={addEntry}
            onDismissFirstRun={dismissFirstRun}
          />
        )}
        {tab==='drinks' && (
          <DrinksScreen
            drinks={state.drinks}
            setDrinks={(dr)=>setState(s=>({...s, drinks:dr}))}
            onQuick={addEntry}
          />
        )}
        {tab==='stats' && <StatsScreen state={state} />}
        {tab==='settings' && (
          <SettingsScreen
            state={state}
            setState={setState}
            onExport={async()=> await exportCsv(state)}
            onReset={fullReset}
            onRescheduleRem={async (cfg)=> await rescheduleReminders(cfg)}
          />
        )}
        {tab==='import' && (
          <ImportScreen onImport={(csv)=> importCsvFromString(csv, state.drinks, (entries)=> setState(s=>({...s, entries})))} />
        )}
      </View>

      {/* Bottom navigation */}
      <BottomBar tab={tab} onChange={setTab}/>
    </SafeAreaView>
  );
}

/* ---------------- Bottom bar ---------------- */
function BottomBar({tab, onChange}){
  const Item = ({t, label, icon}) => (
    <Pressable onPress={()=>onChange(t)} style={[styles.navItem, tab===t&&styles.navItemActive]}>
      <Text style={[styles.navIcon, tab===t&&styles.navIconActive]}>{icon}</Text>
      <Text numberOfLines={1} style={[styles.navText, tab===t&&styles.navTextActive]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.navWrap}>
      <Item t="today"    label="Сегодня"   icon="🏠" />
      <Item t="drinks"   label="Напитки"   icon="🥤" />
      <Item t="stats"    label="Статы"     icon="📈" />
      <Item t="settings" label="Настройки" icon="⚙️" />
      <Item t="import"   label="Импорт"    icon="⬇️" />
    </View>
  );
}

/* ---------------- Screens ---------------- */

function TodayScreen({state, totalToday, progress, remaining, onAdd, onDismissFirstRun}){
  const day = todayKey();
  const entries = state.entries[day] || [];

  // адаптивная ширина карточек (2 или 3 колонки)
  const COLS_TODAY = W >= 720 ? 3 : 2;
  const GAP = 12;
  const CELL_W_TODAY = Math.floor((W - 32 - GAP*(COLS_TODAY-1)) / COLS_TODAY);

  return (
    <ScrollView contentContainerStyle={{padding:16, gap:12}}>
      {state.firstRun && <Tip onClose={onDismissFirstRun} />}

      <View style={styles.card}>
        <Text style={styles.h2}>Цель на сегодня</Text>
        <Text style={{color:T.dim, marginTop:4}}>Выпито: <Text style={styles.bold}>{totalToday} мл</Text> из {state.goal} мл</Text>
        <Progress value={progress} good={progress>=1}/>
        <Text style={{color: remaining>0? T.dim: T.ok, marginTop:6}}>
          {remaining>0? `Осталось: ${remaining} мл` : '🎉 Цель достигнута!'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Быстрые объёмы</Text>
        <View style={{flexDirection:'row', gap:8, flexWrap:'wrap', marginTop:10}}>
          {[200,300,500].map(v=>(
            <Pressable key={v} style={styles.quickBtn} onPress={()=> onAdd({id:`w${v}`, ml:v})}>
              <Text style={styles.quickTxt}>{`+${v} мл`}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Напитки</Text>
        <Text style={{color:T.dim, marginTop:4}}>Тапни, чтобы добавить</Text>
        <View style={styles.drinkGrid}>
          {state.drinks.map(d=>(
            <Pressable
              key={d.id}
              style={[styles.drinkCell, { width: CELL_W_TODAY }]}
              onPress={()=> onAdd(d)}
            >
              <Text style={{fontSize:20}}>{d.emoji || '🥤'}</Text>
              <Text style={{fontWeight:'800', color:'#0b1a2f'}}>{d.name}</Text>
              <Text style={{color:'#0b1a2f'}}>{`+${d.ml} мл`}</Text>
              {d.factor!==1 && <Text style={{color:'#0b1a2f', opacity:0.7}}>×{d.factor}</Text>}
              {d.caffeinated && <Text style={{color:'#0b1a2f', opacity:0.7}}>☕️</Text>}
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Сегодняшние записи ({entries.length})</Text>
        {entries.length===0 ? (
          <Text style={{color:T.dim, marginTop:6}}>Пока пусто — добавь воду из быстрых кнопок или из списка напитков.</Text>
        ) : (
          entries.slice().reverse().map(e=>{
            const d = state.drinks.find(x=>x.id===e.drinkId);
            const time = new Date(e.when).toLocaleTimeString().slice(0,5);
            return (
              <View key={e.id} style={styles.entryRow}>
                <Text style={{color:T.fg}}>{d?.emoji ?? '🥤'} {d?.name ?? 'Напиток'}</Text>
                <Text style={{color:T.dim}}>{`+${e.ml ?? d?.ml ?? 0} мл · ${time}`}</Text>
              </View>
            )
          })
        )}
      </View>
    </ScrollView>
  );
}

function DrinksScreen({drinks, setDrinks, onQuick}){
  const [name, setName] = useState('Вода');
  const [ml, setMl] = useState('250');
  const [factor, setFactor] = useState('1');
  const [caff, setCaff] = useState(false);

  const addDrink = ()=>{
    const n = name.trim(); const m = Math.max(0, Number(ml)||0);
    const f = Math.max(0, Math.min(1.2, Number(factor)||1));
    if(!n || !m){ Alert.alert('Ошибка','Заполни название и объём'); return; }
    setDrinks([...drinks, { id: uuid(), name:n, ml:m, factor:f, caffeinated:caff, emoji:'🥤' }]);
    setName('Вода'); setMl('250'); setFactor('1'); setCaff(false);
  };
  const removeDrink = (id)=> setDrinks(drinks.filter(x=>x.id!==id));

  const COLS = W >= 720 ? 3 : 2;
  const GAP = 12;
  const CELL_W = Math.floor((W - 32 - GAP*(COLS-1)) / COLS);

  return (
    <ScrollView contentContainerStyle={{padding:16, gap:12}}>
      <View style={styles.card}>
        <Text style={styles.h2}>Добавить напиток</Text>
        <View style={styles.formGrid}>
          <Field label="Название" value={name} onChange={setName} />
          <Field label="Объём (мл)" value={ml} onChange={setMl} keyboardType="numeric" />
          <Field label="Фактор" value={factor} onChange={setFactor} keyboardType="decimal-pad" />
          <Toggle label="Кофеин" value={caff} onChange={setCaff} />
        </View>
        <Pressable style={styles.primary} onPress={addDrink}><Text style={styles.primaryTxt}>Добавить</Text></Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Список ({drinks.length})</Text>
        <View style={styles.drinkGrid}>
          {drinks.map(d=>(
            <View key={d.id} style={[styles.drinkCell, { width: CELL_W }]}>
              <Text style={{fontSize:20}}>{d.emoji || '🥤'}</Text>
              <Text style={{fontWeight:'800', color:'#0b1a2f'}}>{d.name}</Text>
              <Text style={{color:'#0b1a2f'}}>{`+${d.ml} мл`}</Text>
              {d.factor!==1 && <Text style={{color:'#0b1a2f', opacity:0.7}}>×{d.factor}</Text>}
              {d.caffeinated && <Text style={{color:'#0b1a2f', opacity:0.7}}>☕️</Text>}
              <View style={{flexDirection:'row', gap:8, marginTop:6}}>
                <Pressable onPress={()=>onQuick(d)} style={styles.smallBtn}><Text style={styles.smallBtnTxt}>Добавить</Text></Pressable>
                <Pressable onPress={()=>removeDrink(d.id)} style={styles.smallBtnGhost}><Text style={styles.smallBtnGhostTxt}>Удалить</Text></Pressable>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function StatsScreen({state}){
  const days = [...Array(7)].map((_,i)=>{
    const d = new Date(); d.setDate(d.getDate()-i);
    const key = todayKey(d);
    const list = state.entries[key] || [];
    const sum = list.reduce((acc,e)=>{
      const drink = state.drinks.find(x=>x.id===e.drinkId);
      const ml = e.ml ?? drink?.ml ?? 0;
      const f = drink?.factor ?? 1;
      return acc + Math.round(ml*f);
    },0);
    return { key, sum };
  }).reverse();

  const best = days.reduce((a,b)=> a.sum>b.sum?a:b, {sum:0});
  const avg = Math.round(days.reduce((acc,d)=>acc+d.sum,0)/days.length);

  return (
    <ScrollView contentContainerStyle={{padding:16, gap:12}}>
      <View style={styles.card}>
        <Text style={styles.h2}>Неделя</Text>
        <Text style={{color:T.dim, marginTop:6}}>Среднее: <Text style={styles.bold}>{avg} мл</Text> · Лучший день: <Text style={styles.bold}>{best.sum} мл</Text></Text>
        <View style={{marginTop:10, gap:6}}>
          {days.map(d=>(
            <View key={d.key} style={{flexDirection:'row', alignItems:'center', gap:8}}>
              <Text style={{width:86, color:T.dim}}>{d.key.slice(5)}</Text>
              <View style={{flex:1, height:10, borderRadius:8, backgroundColor:'#0e1830', overflow:'hidden', borderWidth:1, borderColor:'#1f3153'}}>
                <View style={{width:`${Math.min(100, (d.sum/state.goal)*100)}%`, height:'100%', backgroundColor: d.sum>=state.goal? T.ok: T.accent}}/>
              </View>
              <Text style={{color:T.fg, width:70, textAlign:'right'}}>{d.sum} мл</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function SettingsScreen({state, setState, onExport, onReset, onRescheduleRem}){
  const [goal, setGoal] = useState(String(state.goal));
  const [rem, setRem] = useState(state.reminders);
  const saveGoal = ()=>{
    const g = Math.max(1000, Math.min(6000, Number(goal)||2000));
    setState(s=>({...s, goal:g })); Alert.alert('Готово','Цель обновлена');
  };
  return (
    <ScrollView contentContainerStyle={{padding:16, gap:12}}>
      <View style={styles.card}>
        <Text style={styles.h2}>Цель</Text>
        <View style={styles.formRow}>
          <Field label="Сутки (мл)" value={goal} onChange={setGoal} keyboardType="numeric" />
          <Pressable style={styles.primary} onPress={saveGoal}><Text style={styles.primaryTxt}>Сохранить</Text></Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Напоминания</Text>
        <View style={styles.formGrid}>
          <Toggle label="Включить" value={rem.enabled} onChange={(v)=>setRem({...rem, enabled:v})}/>
          <Field label="С" value={rem.start} onChange={(v)=>setRem({...rem, start:v})} />
          <Field label="До" value={rem.end} onChange={(v)=>setRem({...rem, end:v})} />
          <Field label="Каждые (мин)" value={String(rem.everyMin)} onChange={(v)=>setRem({...rem, everyMin:Number(v)||60})} keyboardType="numeric" />
          <Toggle label="Не беспокоить ночью" value={rem.dnd} onChange={(v)=>setRem({...rem, dnd:v})}/>
        </View>
        <Pressable style={styles.secondary} onPress={async()=>{ await onRescheduleRem(rem); Alert.alert('Напоминания','Готово на сегодня'); }}>
          <Text style={{color:T.fg, fontWeight:'800'}}>Применить</Text>
        </Pressable>
        <Text style={{color:T.dim, marginTop:6}}>Уведомления в окне {rem.start}–{rem.end}, каждые {rem.everyMin} мин.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Данные</Text>
        <View style={{flexDirection:'row', gap:10, flexWrap:'wrap', marginTop:10}}>
          <Pressable style={styles.secondary} onPress={onExport}><Text style={{color:T.fg, fontWeight:'800'}}>Экспорт CSV</Text></Pressable>
          <Pressable style={[styles.secondary,{borderColor:T.danger, borderWidth:1}]} onPress={onReset}><Text style={{color:T.danger, fontWeight:'800'}}>Сбросить прогресс</Text></Pressable>
        </View>
      </View>

      <View style={styles.cardSoft}><Text style={{color:T.dim}}>История и настройки хранятся локально на устройстве.</Text></View>
    </ScrollView>
  );
}

function ImportScreen({onImport}){
  const [text, setText] = useState('');
  return (
    <ScrollView contentContainerStyle={{padding:16, gap:12}}>
      <View style={styles.card}>
        <Text style={styles.h2}>Импорт CSV (вставь текст)</Text>
        <Text style={{color:T.dim, marginTop:6}}>Формат: date,time,drink,ml,factor — как в экспорте.</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Вставьте CSV сюда…"
          placeholderTextColor="#7b8aa6"
          multiline
          style={{backgroundColor:T.glass, color:T.fg, borderWidth:1, borderColor:T.border, borderRadius:12, padding:12, minHeight:160, textAlignVertical:'top'}}
        />
        <Pressable style={styles.primary} onPress={()=>{ onImport(text); setText(''); }}>
          <Text style={styles.primaryTxt}>Импортировать</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/* ---------------- Helpers: export/import/reminders ---------------- */

async function exportCsv(state){
  let FileSystem, Sharing;
  try{
    FileSystem = (await import('expo-file-system')).default || (await import('expo-file-system'));
    Sharing    = (await import('expo-sharing')).default    || (await import('expo-sharing'));
  }catch{
    Alert.alert('Экспорт','Установите пакеты:\n\nnpx expo install expo-file-system expo-sharing');
    return;
  }
  const rows = [];
  Object.entries(state.entries).forEach(([day, list])=>{
    (list||[]).forEach(e=>{
      const d = state.drinks.find(x=>x.id===e.drinkId) || { name:'Unknown', factor:1 };
      rows.push({ date: day, time: e.when, drink: d.name, ml: e.ml ?? d.ml ?? 0, factor: d.factor ?? 1 });
    });
  });
  const header = 'date,time,drink,ml,factor';
  const esc = (s)=> `"${String(s).replace(/"/g,'""')}"`;
  const body = rows.map(r=> [r.date, r.time, esc(r.drink), r.ml, r.factor].join(',')).join('\n');
  const csv = header + '\n' + body;

  const uri = (FileSystem.cacheDirectory || '') + 'water_export.csv';
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if(await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType:'text/csv', dialogTitle:'Экспорт трекера воды' });
  else Alert.alert('Экспорт','Файл: '+uri);
}

function importCsvFromString(csv, drinks, applyEntries){
  try{
    const lines = csv.split(/\r?\n/).filter(Boolean);
    if(lines.length<2){ Alert.alert('Импорт','Нет данных'); return; }
    const header = lines[0].split(',');
    const need = ['date','time','drink','ml','factor'];
    const ok = need.every(k=> header.includes(k));
    if(!ok){ Alert.alert('Импорт','Неверные заголовки CSV'); return; }

    const idx = Object.fromEntries(header.map((h,i)=>[h.trim(), i]));
    const grouped = {};
    for(let i=1;i<lines.length;i++){
      const parts = splitCsv(lines[i], header.length);
      const date = parts[idx.date];
      const time = parts[idx.time];
      const drinkName = unquote(parts[idx.drink]);
      const ml = Number(parts[idx.ml])||0;
      const d = drinks.find(x=>x.name===drinkName) || drinks[0] || {id:'x', ml:ml};
      if(!grouped[date]) grouped[date]=[];
      grouped[date].push({ id:uuid(), drinkId:d.id, ml, when: time|| new Date().toISOString() });
    }
    applyEntries(grouped);
    Alert.alert('Импорт','Готово');
  }catch{ Alert.alert('Импорт','Ошибка чтения CSV'); }

  function splitCsv(line, n){
    const out=[]; let cur=''; let q=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='\"'){ q=!q; continue; }
      if (ch === ',' && !q) { out.push(cur); cur = ''; continue; }
      cur+=ch;
    }
    out.push(cur);
    while(out.length<n) out.push('');
    return out;
  }
  function unquote(s){ return s?.replace(/^\"|\"$/g,'')?.replace(/\"\"/g,'"'); }
}

async function rescheduleReminders(cfg){
  try{
    await Notifications.cancelAllScheduledNotificationsAsync();
    if(!cfg.enabled) return;
    const { status } = await Notifications.requestPermissionsAsync();
    if(status!=='granted'){ Alert.alert('Уведомления','Разрешите уведомления в настройках'); return; }

    const now = new Date();
    const [sh, sm] = cfg.start.split(':').map(Number);
    const [eh, em] = cfg.end.split(':').map(Number);

    let t = new Date(now);
    t.setHours(sh, sm, 0, 0);
    while(t < now) t = new Date(t.getTime() + cfg.everyMin*60000);

    const end = new Date(now); end.setHours(eh, em, 0, 0);
    const jobs=[];
    while(t<=end){
      jobs.push(Notifications.scheduleNotificationAsync({
        content:{ title:'Пора выпить воды 💧', body:'Небольшой глоток уже полезен!' },
        trigger:{ date: new Date(t) }
      }));
      t = new Date(t.getTime() + cfg.everyMin*60000);
    }
    await Promise.all(jobs);
  }catch{ Alert.alert('Уведомления','Не удалось настроить'); }
}

/* ---------------- UI bits ---------------- */

function Tip({onClose}){
  return (
    <View style={styles.tip}>
      <Text style={styles.tipTitle}>Как пользоваться</Text>
      <Text style={styles.tipText}>
        1) Жми на быстрые объёмы «+200 мл» и т.д.{'\n'}
        2) Добавь свои напитки во вкладке «Напитки».{'\n'}
        3) Включи напоминания в «Настройках».
      </Text>
      <Pressable onPress={onClose} style={styles.secondary}>
        <Text style={{color:T.fg, fontWeight:'800'}}>Понятно</Text>
      </Pressable>
    </View>
  );
}
function Field({label, value, onChange, keyboardType}){
  return (
    <View style={{gap:6, flex:1, minWidth: (W-64)/2 - 8 }}>
      <Text style={{color:T.dim}}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholderTextColor="#86a0c7"
        style={styles.input}
      />
    </View>
  );
}

// ✓ Обновлённый тумблер
function Toggle({label, value, onChange}){
  return (
    <Pressable onPress={()=>onChange(!value)} style={styles.toggleRow}>
      <View style={[styles.switchTrack, value && styles.switchTrackOn]}>
        <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
      </View>
      <Text style={styles.switchLabel}>{label}</Text>
    </Pressable>
  );
}

function Progress({value, good}){
  return (
    <View style={styles.progressWrap}>
      <View style={[styles.progressBar, { width: `${Math.max(4, Math.min(100, value*100))}%`, backgroundColor: good? T.ok: T.accent }]} />
    </View>
  );
}

/* ---------------- Styles ---------------- */

const styles = StyleSheet.create({
  header:{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingTop:16, paddingBottom:8, gap:8 },
  title:{ color:T.fg, fontSize:22, fontWeight:'900' },
  chip:{ paddingHorizontal:12, paddingVertical:6, borderRadius:999, backgroundColor:T.glass, borderWidth:1, borderColor:T.border },
  chipTxt:{ color:T.fg, fontWeight:'800' },

  // Bottom bar
  navWrap:{ position:'absolute', left:0, right:0, bottom:0, height:64, backgroundColor:'#0f1234ee', borderTopWidth:1, borderColor:T.border, flexDirection:'row', justifyContent:'space-around', paddingHorizontal:8 },
  navItem:{ flex:1, alignItems:'center', justifyContent:'center', gap:2, borderRadius:14, marginVertical:8 },
  navItemActive:{ backgroundColor:'#13243f', borderWidth:1, borderColor:'#2a3a56' },
  navIcon:{ fontSize:16, color:T.dim },
  navIconActive:{ color:T.fg },
  navText:{ fontSize:12, color:T.dim, fontWeight:'800' },
  navTextActive:{ color:T.fg },

  card:{ backgroundColor:T.card, borderWidth:1, borderColor:T.border, borderRadius:16, padding:16 },
  cardSoft:{ backgroundColor:T.cardSoft, borderWidth:1, borderColor:T.border, borderRadius:16, padding:16 },

  h2:{ color:T.fg, fontWeight:'800', fontSize:16 },
  bold:{ color:T.fg, fontWeight:'900' },

  // формы
  formGrid:{ flexDirection:'row', flexWrap:'wrap', columnGap:12, rowGap:12, marginTop:10 },
  formRow:{ flexDirection:'row', alignItems:'center', gap:12, marginTop:10, flexWrap:'wrap' },
  input:{ backgroundColor:T.glass, color:T.fg, borderWidth:1, borderColor:T.border, borderRadius:12, paddingHorizontal:12, paddingVertical:10 },

  // тумблер
  toggleRow:{ flexDirection:'row', alignItems:'center', gap:10 },
  switchTrack:{ width:64, height:36, borderRadius:999, backgroundColor:'#22324f', borderWidth:1, borderColor:'#2a3a56', padding:4, justifyContent:'center' },
  switchTrackOn:{ backgroundColor:'#14402a', borderColor:'#176b3a' },
  switchThumb:{ width:28, height:28, borderRadius:999, backgroundColor:'#95a7c3', transform:[{ translateX:0 }] },
  switchThumbOn:{ backgroundColor:T.ok, transform:[{ translateX:28 }] },
  switchLabel:{ color:T.fg, fontWeight:'800' },

  // быстрые
  quickBtn:{ backgroundColor:'#0e1a31', borderWidth:1, borderColor:'#1f2f50', paddingHorizontal:14, paddingVertical:10, borderRadius:12 },
  quickTxt:{ color:T.fg, fontWeight:'800' },

  // сетка напитков
  drinkGrid:{ flexDirection:'row', flexWrap:'wrap', columnGap:12, rowGap:12, marginTop:10 },
  drinkCell:{
    // width задаём динамически в компоненте
    padding:12, borderRadius:14,
    backgroundColor: T.lightCell, borderWidth:1, borderColor: T.lightBorder,
    alignItems:'center', gap:4
  },
  smallBtn:{ paddingHorizontal:10, paddingVertical:8, borderRadius:10, backgroundColor:'#e8f8ff', borderWidth:1, borderColor:'#c9ecff' },
  smallBtnTxt:{ color:'#0b1a2f', fontWeight:'800' },
  smallBtnGhost:{ paddingHorizontal:10, paddingVertical:8, borderRadius:10, backgroundColor:'#f3f6ff', borderWidth:1, borderColor:'#dfe7ff' },
  smallBtnGhostTxt:{ color:'#0b1a2f', fontWeight:'700' },

  entryRow:{ flexDirection:'row', justifyContent:'space-between', paddingVertical:8, borderBottomWidth:1, borderColor:'#172949' },

  primary:{ paddingHorizontal:16, paddingVertical:12, borderRadius:12, alignItems:'center', backgroundColor:T.ok },
  primaryTxt:{ color:'#08111a', fontWeight:'900' },
  secondary:{ paddingHorizontal:14, paddingVertical:10, borderRadius:12, borderWidth:1, borderColor:T.border, alignItems:'center' },

  progressWrap:{ height:14, borderRadius:999, overflow:'hidden', marginTop:8, backgroundColor:T.glass, borderWidth:1, borderColor:'#1f2f50' },
  progressBar:{ height:'100%', borderRadius:999 },

  tip:{ backgroundColor:T.glass, borderWidth:1, borderColor:T.border, borderRadius:16, padding:16 },
  tipTitle:{ color:T.fg, fontWeight:'900', marginBottom:6 },
  tipText:{ color:T.dim, marginBottom:10 },
});
