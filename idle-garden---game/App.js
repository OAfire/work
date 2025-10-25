import 'react-native-gesture-handler';
import React, {useEffect, useMemo, useState, useContext, createContext, useRef} from 'react';
import { SafeAreaView, View, Text, Pressable, StyleSheet, ScrollView, FlatList, Alert, Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, useNavigation, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

/**
 * Idle Garden — понятная и интерактивная игра (5 экранов, Expo Go)
 * Экраны: Garden (сад), Nursery (рассадник), Boosts, Quests, Settings
 * — Тап по грядке собирает монеты, долгий тап — меняет растение
 * — Апгрейд уровня грядки, разные виды растений (разные множители)
 * — Оффлайн доход, бусты x2 и садовник (+10% дохода)
 * — Ежедневная награда и квесты
 * — Сохранение прогресса (AsyncStorage)
 */

const THEME = { bg:'#0b1220', fg:'#eef2ff', dim:'#9aa7bd', border:'#2f3d55', card:'#13223b', accent:'#38bdf8', ok:'#22c55e', warn:'#f59e0b'};
const Stack = createNativeStackNavigator();
const K_SAVE = 'idle_garden_v2';
const now = () => Date.now();
const todayKey = () => new Date().toISOString().slice(0,10);

// Растения
const PLANTS = [
  {name:'Подсолнух', emoji:'🌻', mult:1.0},
  {name:'Роза', emoji:'🌹', mult:1.2},
  {name:'Кактус', emoji:'🌵', mult:1.5},
  {name:'Лаванда', emoji:'💜', mult:1.3},
  {name:'Бонсай', emoji:'🌳', mult:1.8},
];

// Экономика
const BASE_RATE = 1; // base per level per sec
const OFFLINE_CAP_SEC = 6*3600;
const costFor = (lvl)=> Math.floor(10*Math.pow(1.25, lvl));
const rateFor = (lvl, plantIdx)=> Math.floor(lvl*BASE_RATE*(PLANTS[plantIdx]?.mult||1));

// ----- Глобальное состояние (Context)
const Ctx = createContext(null);
function useGame(){ return useContext(Ctx); }

const START = {
  coins: 0, gems: 0,
  plots: Array.from({length:6}, (_,i)=>({ id:'p'+i, level:1, plant: i%3 })),
  gardeners: 0,
  boostUntil: 0, nextBoostAt: 0,
  lastTick: now(),
  lastLogin: todayKey(), streak: 0, canDaily: true,
  achievements: {},
};

function Provider({children}){
  const [s, setS] = useState(START);

  // загрузка
  useEffect(()=>{(async()=>{
    const raw = await AsyncStorage.getItem(K_SAVE);
    if(raw){
      const data = JSON.parse(raw);
      // оффлайн доход
      const elapsed = Math.max(0, (now()- (data.lastTick||now()))/1000);
      const sec = Math.min(elapsed, OFFLINE_CAP_SEC);
      const inc = Math.floor(incomePerSec(data)*sec);
      const t = todayKey();
      let {streak, canDaily} = data;
      if(data.lastLogin !== t){ streak = data.lastLogin && daysBetween(data.lastLogin, t)===1 ? (data.streak||0)+1 : 1; canDaily=true; }
      setS({...START, ...data, coins:(data.coins||0)+inc, lastTick: now(), lastLogin:t, streak, canDaily});
    }
  })()},[]);

  // сохранение
  useEffect(()=>{ AsyncStorage.setItem(K_SAVE, JSON.stringify(s)); },[s]);

  // тики дохода
  useEffect(()=>{
    const t = setInterval(()=>{
      setS(prev=>{
        const dt = Math.max(0, (now()-prev.lastTick)/1000);
        if(dt<0.5) return prev;
        const inc = Math.floor(incomePerSec(prev)*dt);
        return {...prev, coins: prev.coins+inc, lastTick: now()};
      })
    },1000);
    return ()=>clearInterval(t);
  },[]);

  // дождь (рандом событие x1.5 на 2 мин)
  useEffect(()=>{
    const t = setInterval(()=>{
      setS(prev=>{
        if(prev.eventUntil && prev.eventUntil>now()) return prev;
        if(Math.random()<0.08){ return {...prev, eventUntil: now()+120000, eventMult:1.5}; }
        return prev;
      })
    },30000);
    return ()=>clearInterval(t);
  },[]);

  // Полный сброс: чистим AsyncStorage и состояние
  async function fullReset(){
    await AsyncStorage.removeItem(K_SAVE);
    setS({...START, lastTick: now(), lastLogin: todayKey()});
  }

  const [hud, setHud] = useState(null);
  const value = { s, setS, hud, setHud, fullReset };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function daysBetween(a,b){ return Math.round((new Date(b)-new Date(a))/(1000*3600*24)); }
function incomePerSec(state){
  const base = state.plots.reduce((sum,p)=> sum + rateFor(p.level,p.plant),0);
  const gardenerMult = 1 + state.gardeners*0.1;
  const boostMult = state.boostUntil>now()? 2:1;
  const eventMult = state.eventUntil>now()? (state.eventMult||1):1;
  return Math.floor(base*gardenerMult*boostMult*eventMult);
}

// ---------- App
export default function App(){
  return (
    <NavigationContainer>
      <Provider>
        <Stack.Navigator screenOptions={{ headerShown:false }}>
          <Stack.Screen name="Tabs" component={TabsRoot} />
        </Stack.Navigator>
      </Provider>
    </NavigationContainer>
  );
}

function TabsRoot(){
  const [tab, setTab] = useState('Garden');
  const {hud} = useGame();
  return (
    <SafeAreaView style={[styles.safe,{backgroundColor:THEME.bg}]}> 
      <View style={styles.container}>
        {tab==='Garden' && <GardenScreen/>}
        {tab==='Nursery' && <NurseryScreen/>}
        {tab==='Boosts' && <BoostsScreen/>}
        {tab==='Quests' && <QuestsScreen/>}
        {tab==='Settings' && <SettingsScreen/>}
        {hud && (
          <View style={{position:'absolute', top:12, alignSelf:'center', backgroundColor:'#0f1a2b', borderColor:THEME.border, borderWidth:1, paddingHorizontal:12, paddingVertical:8, borderRadius:999}}>
            <Text style={{color:THEME.fg, fontWeight:'800'}}>{hud}</Text>
          </View>
        )}
        <BottomBar current={tab} onChange={setTab} />
      </View>
    </SafeAreaView>
  );
}

function BottomBar({current,onChange}){
  const Item = ({label, icon, tab}) => (
    <Pressable onPress={()=>onChange(tab)} style={[styles.tabItem, current===tab && {backgroundColor:'#12233b', borderColor:'#2a3a56'}]}>
      <Ionicons name={icon} size={18} color={current===tab?THEME.accent:THEME.dim} />
      <Text style={{color: current===tab?THEME.fg:THEME.dim, fontWeight:'700'}}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.tabbar}>
      <Item label="Сад" icon="leaf" tab="Garden" />
      <Item label="Рассада" icon="flower" tab="Nursery" />
      <Item label="Бусты" icon="flash" tab="Boosts" />
      <Item label="Квесты" icon="trophy" tab="Quests" />
      <Item label="Настройки" icon="settings" tab="Settings" />
    </View>
  );
}

// ---------- Screens
function GardenScreen(){
  const {s,setS,setHud} = useGame();
  const perSec = useMemo(()=> incomePerSec(s), [s]);
  const W = Dimensions.get('window').width;
  const listRef = useRef(null);
  const [idx, setIdx] = useState(0);

  const go = (dir)=>{
    const n = s.plots.length;
    const next = Math.max(0, Math.min(n-1, idx + dir));
    setIdx(next);
    listRef.current?.scrollToIndex({index: next, animated: true});
  };

  return (
    <View style={{flex:1}}>
      <Header title="Сад" coins={s.coins} gems={s.gems} />
      <Text style={{color:THEME.dim, paddingHorizontal:16}}>Свайпай ← →, тапай по грядке чтобы собрать. Доход: {perSec}/сек {s.boostUntil>now()?' · ⚡x2':''} {s.eventUntil>now()?` · 🌧x${s.eventMult||1}`:''} {s.gardeners>0?` · 👨‍🌾+${s.gardeners*10}%`:''}</Text>

      {/* Горизонтальный пейджер по грядкам */}
      <View style={{flex:1}}>
        <FlatList
          ref={listRef}
          data={s.plots}
          keyExtractor={(p)=>p.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_,i)=>({length:W, offset:W*i, index:i})}
          onMomentumScrollEnd={(e)=>{ const x=e.nativeEvent.contentOffset.x||0; setIdx(Math.round(x/W)); }}
          renderItem={({item:p})=> (
            <View style={{width:W}}> 
              <Pressable
                onPress={()=>{ const gain = Math.max(1, rateFor(p.level,p.plant)*2); setS(prev=>({...prev, coins: prev.coins+gain})); setHud(`+${gain} 💰`); setTimeout(()=>setHud(null), 800); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                onLongPress={()=>{ setS(prev=>({...prev, plots: prev.plots.map(x=> x.id===p.id? {...x, plant: (x.plant+1)%PLANTS.length }: x)})); }}
                style={[styles.card,{marginHorizontal:16, borderColor:THEME.border, backgroundColor:THEME.card}]}> 
                <Text style={[styles.h2,{marginBottom:6}]}>{PLANTS[p.plant].emoji} {PLANTS[p.plant].name}</Text>
                <Text style={styles.p}>Уровень: {p.level}</Text>
                <Text style={styles.p}>+{rateFor(p.level,p.plant)}/сек</Text>
                <Row>
                  <ButtonSecondary label={`Улучшить (${costFor(p.level)} 💰)`} onPress={()=>{
                    if(s.coins<costFor(p.level)) return;
                    setS(prev=>({...prev, coins: prev.coins-costFor(p.level), plots: prev.plots.map(x=> x.id===p.id? {...x, level:x.level+1}:x)}))
                  }} />
                  <ButtonSecondary label="Собрать" onPress={()=>{
                    const gain = Math.max(1, rateFor(p.level,p.plant)*2);
                    setS(prev=>({...prev, coins: prev.coins+gain}));
                    setHud(`+${gain} 💰`); setTimeout(()=>setHud(null), 800);
                  }} />
                </Row>
                <Text style={[styles.p,{marginTop:6,color:THEME.dim}]}>Тап — собрать · Долгий тап — сменить растение</Text>
              </Pressable>
            </View>
          )}
        />

        {/* Стрелки навигации и индикатор */}
        {s.plots.length>1 && (
          <>
            <Pressable onPress={()=>go(-1)} style={{position:'absolute', left:6, top:'40%', width:36, height:56, borderRadius:12, backgroundColor:'#0f1a2b', borderWidth:1, borderColor:THEME.border, alignItems:'center', justifyContent:'center', opacity: idx>0?1:0.35}}>
              <Text style={{color:THEME.fg, fontSize:20, fontWeight:'800'}}>‹</Text>
            </Pressable>
            <Pressable onPress={()=>go(1)} style={{position:'absolute', right:6, top:'40%', width:36, height:56, borderRadius:12, backgroundColor:'#0f1a2b', borderWidth:1, borderColor:THEME.border, alignItems:'center', justifyContent:'center', opacity: idx < s.plots.length-1 ? 1:0.35}}>
              <Text style={{color:THEME.fg, fontSize:20, fontWeight:'800'}}>›</Text>
            </Pressable>
            <View style={{position:'absolute', bottom:12, alignSelf:'center', backgroundColor:'#0f1a2b', borderColor:THEME.border, borderWidth:1, paddingHorizontal:10, paddingVertical:6, borderRadius:999}}>
              <Text style={{color:THEME.fg, fontWeight:'800'}}>Грядка {idx+1} из {s.plots.length}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function NurseryScreen(){
  const {s,setS, setHud} = useGame();
  return (
    <View style={{flex:1}}>
      <Header title="Рассадник" coins={s.coins} gems={s.gems} />
      <ScrollView contentContainerStyle={{padding:16, gap:12}}>
        <Row>
          <ButtonPrimary label={`Добавить грядку (${s.plots.length}/12)`} onPress={()=>{
            if(s.plots.length>=12) return;
            const nextId = 'p'+s.plots.length;
            setS(prev=>({...prev, plots:[...prev.plots, {id:nextId, level:1, plant:0}]}));
          }} />
        </Row>
        <Text style={[styles.p,{marginBottom:4}]}>Здесь выбираешь вид растения для каждой грядки.</Text>
        {s.plots.map((p)=> (
          <View key={p.id} style={[styles.card,{borderColor:THEME.border, backgroundColor:THEME.card}]}> 
            <Text style={styles.h2}>Грядка {p.id.slice(1)} — {PLANTS[p.plant].emoji} {PLANTS[p.plant].name}</Text>
            <Row>
              {PLANTS.map((pl,idx)=> (
                <Pressable key={pl.name} style={[styles.secondary,{borderColor:THEME.border}]} onPress={()=>setS(prev=>({...prev, plots: prev.plots.map(x=> x.id===p.id? {...x, plant: idx}: x)}))}>
                  <Text style={{color:THEME.fg}}>{pl.emoji} x{pl.mult}</Text>
                </Pressable>
              ))}
            </Row>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function BoostsScreen(){
  const {s,setS} = useGame();
  const nowTs = now();
  return (
    <View style={{flex:1}}>
      <Header title="Бусты" coins={s.coins} gems={s.gems} />
      <ScrollView contentContainerStyle={{padding:16, gap:12}}>
        <View style={[styles.card,{borderColor:THEME.border, backgroundColor:THEME.card}]}> 
          <Text style={styles.h2}>Мгновенно</Text>
          <Row>
            <ButtonPrimary label="Собрать всё (x3 сек)" onPress={()=>{
              const gain = Math.max(1, incomePerSec(s)*3);
              setS(prev=>({...prev, coins: prev.coins+gain}));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }} />
            <ButtonSecondary label={s.nextBoostAt>nowTs?`Буст на КД`:'Буст x2 (10с)'} onPress={()=>{
              const t = now();
              if(s.nextBoostAt>t) return;
              setS(prev=>({...prev, boostUntil: t+10000, nextBoostAt: t+45000}));
            }} />
          </Row>
          <Text style={[styles.p,{color:THEME.dim}]}>Буст удваивает общий доход на 10 секунд. Кулдаун 45 секунд.</Text>
        </View>

        <View style={[styles.card,{borderColor:THEME.border, backgroundColor:THEME.card}]}> 
          <Text style={styles.h2}>Постоянные</Text>
          <Row>
            <ButtonSecondary label={`Нанять садовника (+10%) — ${100*(s.gardeners+1)} 💰`} onPress={()=>{
              const cost = 100*(s.gardeners+1);
              if(s.coins<cost) return;
              setS(prev=>({...prev, coins: prev.coins-cost, gardeners: prev.gardeners+1}));
            }} />
          </Row>
        </View>
      </ScrollView>
    </View>
  );
}

function QuestsScreen(){
  const {s} = useGame();
  const perSec = useMemo(()=> incomePerSec(s), [s]);
  const quests = [
    {id:'q1', title:'Соберите монеты тапом', done: s.coins>0},
    {id:'q2', title:'Доход 10/сек', done: perSec>=10},
    {id:'q3', title:'Нанять садовника', done: s.gardeners>0},
  ];
  return (
    <View style={{flex:1}}>
      <Header title="Квесты" coins={s.coins} gems={s.gems} />
      <ScrollView contentContainerStyle={{padding:16, gap:12}}>
        {quests.map(q=> (
          <View key={q.id} style={[styles.card,{borderColor: q.done? THEME.ok: THEME.border, backgroundColor:THEME.card, flexDirection:'row', justifyContent:'space-between', alignItems:'center'}]}> 
            <Text style={{color:q.done?THEME.ok:THEME.fg, fontWeight:'700'}}>{q.title}</Text>
            <Text style={{color:q.done?THEME.ok:THEME.dim}}>{q.done?'✓ Выполнено':'• В процессе'}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function SettingsScreen(){
  const {s,setS, fullReset} = useGame();
  return (
    <View style={{flex:1}}>
      <Header title="Настройки" coins={s.coins} gems={s.gems} />
      <ScrollView contentContainerStyle={{padding:16, gap:12}}>
        <View style={[styles.card,{borderColor:THEME.border, backgroundColor:THEME.card}]}> 
          <Text style={styles.h2}>Ежедневная награда</Text>
          <Row>
            <ButtonSecondary label={s.canDaily?"Забрать (50 💰)":"Собрано"} onPress={()=>{
              if(!s.canDaily) return;
              setS(prev=>({...prev, coins: prev.coins+50, canDaily:false}));
            }} />
          </Row>
          <Text style={[styles.p,{color:THEME.dim}]}>Возвращайся каждый день — копится серия.</Text>
        </View>

        <View style={[styles.card,{borderColor:THEME.border, backgroundColor:THEME.card}]}> 
          <Text style={styles.h2}>Данные</Text>
          <Row>
            <ButtonSecondary label="Сбросить прогресс" onPress={()=>{
              if(Platform.OS==='web'){
                if(window.confirm('Удалить весь прогресс? Это действие нельзя отменить.')){
                  fullReset();
                }
              }else{
                Alert.alert('Сброс','Удалить весь прогресс?',[
                  {text:'Отмена', style:'cancel'},
                  {text:'Стереть', style:'destructive', onPress:()=> fullReset()}
                ])
              }
            }} />
          </Row>
        </View>
      </ScrollView>
    </View>
  );
}

// ---------- UI helpers
function Header({title, coins, gems}){
  return (
    <View style={styles.header}>
      <Text style={[styles.title,{color:THEME.fg}]}>{title}</Text>
      <View style={{flex:1}} />
      {typeof coins==='number' && (
        <View style={styles.badge}><Ionicons name="logo-bitcoin" size={14} color="#ffd166" /><Text style={styles.badgeTxt}> {coins}</Text></View>
      )}
      {typeof gems==='number' && (
        <View style={styles.badge}><Ionicons name="diamond" size={14} color="#60a5fa" /><Text style={styles.badgeTxt}> {gems}</Text></View>
      )}
    </View>
  );
}

function Row({children}){ return <View style={{flexDirection:'row', gap:8, flexWrap:'wrap', marginTop:8}}>{children}</View> }
function ButtonPrimary({label, onPress}){ return (<Pressable style={[styles.primary,{backgroundColor:THEME.ok}]} onPress={onPress}><Text style={styles.primaryTxt}>{label}</Text></Pressable>); }
function ButtonSecondary({label, onPress}){ return (<Pressable style={[styles.secondary,{borderColor:THEME.border}]} onPress={onPress}><Text style={{color:THEME.fg, fontWeight:'700'}}>{label}</Text></Pressable>); }

// ---------- styles
const styles = StyleSheet.create({
  safe:{flex:1}, container:{flex:1},
  header:{flexDirection:'row', alignItems:'center', padding:16, gap:8},
  title:{fontSize:22, fontWeight:'800'},
  card:{ backgroundColor:THEME.card, borderWidth:1, borderColor:THEME.border, borderRadius:16, padding:16 },
  h2:{ color:THEME.fg, fontWeight:'800', fontSize:16 },
  p:{ color:THEME.dim, fontSize:14, lineHeight:20 },
  primary:{ paddingHorizontal:16, paddingVertical:12, borderRadius:12, alignItems:'center' },
  primaryTxt:{ color:'#08111a', fontWeight:'900' },
  secondary:{ paddingHorizontal:14, paddingVertical:10, borderRadius:12, borderWidth:1, alignItems:'center', justifyContent:'center' },
  tabbar:{ flexDirection:'row', gap:6, padding:10, borderTopWidth:1, borderColor:THEME.border, backgroundColor:'#0c1526', justifyContent:'space-between' },
  tabItem:{ flex:1, paddingVertical:8, borderRadius:12, borderWidth:1, borderColor:'transparent', alignItems:'center', gap:4 },
  badge:{ flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'#1e293b', paddingHorizontal:10, paddingVertical:6, borderRadius:999 },
  badgeTxt:{ color:'#e2e8f0', fontWeight:'800' }
});
