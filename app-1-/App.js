import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, Animated, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// --- Главный компонент ---
export default function App() {
  const [tab, setTab] = useState('timer');

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {tab === 'timer' && <FocusTimer goBack={()=>setTab('timer')} />}
      {tab === 'habits' && <HabitTracker />}
      {tab === 'relax' && <Relax />}

      <View style={styles.nav}>
        <TouchableOpacity onPress={()=>setTab('timer')} style={styles.navButton}>
          <Text style={[styles.navText, {color: tab==='timer'?'#ffd166':'#888'}]}>🕒 Таймер</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>setTab('habits')} style={styles.navButton}>
          <Text style={[styles.navText, {color: tab==='habits'?'#06d6a0':'#888'}]}>✅ Привычки</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>setTab('relax')} style={styles.navButton}>
          <Text style={[styles.navText, {color: tab==='relax'?'#ef476f':'#888'}]}>🍃 Релакс</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// --- Фокус Таймер ---
function FocusTimer({goBack}) {
  const [minutes, setMinutes] = useState('25');
  const [seconds, setSeconds] = useState('00');
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25*60);
  const [totalTime, setTotalTime] = useState(25*60);

  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    let timer;
    if(running){
      timer = setInterval(()=>{
        setTimeLeft(prev=>{
          if(prev>0){
            animatedValue.setValue(1 - (prev-1)/totalTime);
            return prev-1;
          } else return 0;
        });
      },1000);
    }
    return ()=>clearInterval(timer);
  },[running]);

  const displayMinutes = Math.floor(timeLeft/60);
  const displaySeconds = timeLeft % 60;

  const setTime = () => {
    const total = parseInt(minutes)*60 + parseInt(seconds);
    setTimeLeft(total);
    setTotalTime(total);
    animatedValue.setValue(0);
    setRunning(false);
  };

  const rotation = animatedValue.interpolate({
    inputRange: [0,1],
    outputRange: ['0deg','360deg']
  });

  return (
    <LinearGradient colors={['#a18cd1','#fbc2eb']} style={styles.container}>
      <Text style={[styles.title,{color:'#1a1a1a'}]}>Фокус Таймер</Text>

      <View style={{flexDirection:'row', alignItems:'center', marginBottom:20}}>
        <TextInput style={[styles.input,{color:'#1a1a1a',borderColor:'#1a1a1a'}]} keyboardType='numeric' value={minutes} onChangeText={setMinutes} />
        <Text style={{fontSize:24,color:'#1a1a1a'}}> : </Text>
        <TextInput style={[styles.input,{color:'#1a1a1a',borderColor:'#1a1a1a'}]} keyboardType='numeric' value={seconds} onChangeText={setSeconds} />
        <TouchableOpacity onPress={setTime} style={[styles.button,{marginLeft:10,backgroundColor:'#ffb347'}]}>
          <Text style={{color:'#fff',fontWeight:'bold'}}>Установить</Text>
        </TouchableOpacity>
      </View>

      <View style={{marginBottom:20}}>
        <Animated.View style={[styles.timerCircle, {transform:[{rotate: rotation}], backgroundColor:'rgba(128,0,128,0.3)'}]}>
          <Text style={[styles.timer,{color:'#1a1a1a'}]}>{`${displayMinutes.toString().padStart(2,'0')}:${displaySeconds.toString().padStart(2,'0')}`}</Text>
        </Animated.View>
      </View>

      <View style={{flexDirection:'row',marginTop:20}}>
        <TouchableOpacity onPress={()=>setRunning(!running)} style={[styles.button,{backgroundColor:'#06d6a0'}]}>
          <Text style={{color:'#fff', fontWeight:'bold'}}>{running?'Пауза':'Старт'}</Text>
        </TouchableOpacity>
        <View style={{width:10}} />
        <TouchableOpacity onPress={()=>{setTimeLeft(totalTime); setRunning(false); animatedValue.setValue(0)}} style={[styles.button,{backgroundColor:'#ef476f'}]}>
          <Text style={{color:'#fff', fontWeight:'bold'}}>Сброс</Text>
        </TouchableOpacity>
        <View style={{width:10}} />
        <TouchableOpacity onPress={goBack} style={[styles.button,{backgroundColor:'#ffd166'}]}>
          <Text style={{color:'#fff', fontWeight:'bold'}}>Выйти</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

// --- Habit Tracker ---
function HabitTracker() {
  const [habits,setHabits] = useState([
    {name:'Выпить воду',history:[0,0,0,0,0,0,0]},
    {name:'Прочитать 20 страниц',history:[0,0,0,0,0,0,0]},
    {name:'30 минут спорта',history:[0,0,0,0,0,0,0]}
  ]);
  const [newHabit, setNewHabit] = useState('');

  const weekDays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

  const toggleDone = (index)=>{
    setHabits(h=>{
      return h.map((hbt,i)=>{
        if(i===index){
          const newHistory = [...hbt.history];
          newHistory[newHistory.length-1] = newHistory[newHistory.length-1]===0?1:0;
          return {...hbt, history:newHistory};
        }
        return hbt;
      });
    });
  };

  const addHabit = ()=>{
    if(newHabit.trim()==='') return;
    setHabits([...habits,{name:newHabit,history:[0,0,0,0,0,0,0]}]);
    setNewHabit('');
  };

  return (
    <LinearGradient colors={['#06d6a0','#1a936f']} style={styles.container}>
      <Text style={[styles.title,{color:'#fff'}]}>Трекер привычек</Text>

      <View style={{flexDirection:'row', marginBottom:20, alignItems:'center'}}>
        <TextInput
          style={[styles.input,{flex:1, color:'#1a1a1a', borderColor:'#fff', backgroundColor:'#fff'}]}
          placeholder="Новая привычка"
          placeholderTextColor="#888"
          value={newHabit}
          onChangeText={setNewHabit}
        />
        <TouchableOpacity onPress={addHabit} style={[styles.button,{marginLeft:10,backgroundColor:'#ffd166'}]}>
          <Text style={{color:'#fff', fontWeight:'bold'}}>Добавить</Text>
        </TouchableOpacity>
      </View>

      <View style={{flexDirection:'row', justifyContent:'space-around', width:'100%', marginBottom:10}}>
        {weekDays.map((day,i)=>(
          <Text key={i} style={{color:'#fff', fontWeight:'bold', fontSize:16}}>{day}</Text>
        ))}
      </View>

      <ScrollView style={{width:'100%'}}>
        {habits.map((habit,index)=>(
          <View key={index} style={{width:'100%', marginBottom:12, padding:8, backgroundColor:'rgba(255,255,255,0.2)', borderRadius:10}}>
            <Text style={{color:'#fff', fontSize:16, fontWeight:'bold', marginBottom:6}}>{habit.name}</Text>
            <View style={{flexDirection:'row', justifyContent:'space-around', marginBottom:6}}>
              {habit.history.map((val,i)=>(
                <View key={i} style={{
                  width:25,
                  height: val*40 + 5,
                  backgroundColor: val===1?'#fff':'rgba(255,255,255,0.3)',
                  borderRadius:5
                }}/>
              ))}
            </View>
            <TouchableOpacity onPress={()=>toggleDone(index)} style={[styles.button,{backgroundColor:'#ef476f'}]}>
              <Text style={{color:'#fff', fontWeight:'bold'}}>{habit.history[habit.history.length-1]===1?'Сбросить':'Сделано'}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

// --- Relax ---
function Relax() {
  const quotes = [
    "🌿 Дыши глубоко и спокойно.",
    "☀️ Каждый день — новый шанс.",
    "💧 Расслабься и отпусти стресс.",
    "🌙 Спокойствие — ключ к продуктивности."
  ];
  const [quoteIndex, setQuoteIndex] = useState(0);

  const scale = useRef(new Animated.Value(1)).current;
  const [animating, setAnimating] = useState(true);

  const opacity = useRef(new Animated.Value(1)).current;
  const [breathIndex, setBreathIndex] = useState(0);

  const quoteOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animating) return;

    const animateBreath = () => {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.3, duration: 4000, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 4000, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(quoteOpacity, { toValue: 0.3, duration: 2000, useNativeDriver: true }),
          Animated.timing(quoteOpacity, { toValue: 1, duration: 2000, useNativeDriver: true }),
        ])
      ]).start(() => {
        setBreathIndex(prev => (prev === 0 ? 1 : 0));
        animateBreath();
      });
    };

    animateBreath();
  }, [animating]);

  const nextQuote = () => {
    Animated.sequence([
      Animated.timing(quoteOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(quoteOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
    setQuoteIndex((quoteIndex + 1) % quotes.length);
  };

  const texts = ['Вдох…', 'Выдох…'];

  return (
    <LinearGradient colors={['#ff9a9e','#ffdde1']} style={styles.container}>
      <Text style={[styles.title, { color: '#1a1a1a' }]}>Релакс</Text>

      <TouchableOpacity onPress={() => setAnimating(!animating)}>
        <Animated.View
          style={[
            styles.circle,
            {
              transform: [{ scale }],
              backgroundColor: 'rgba(128,0,128,0.4)'
            }
          ]}
        >
          <Animated.Text style={{ color: '#fff', fontWeight: 'bold', opacity }}>
            {breathIndex === 0 ? 'Вдох…' : 'Выдох…'}
          </Animated.Text>
        </Animated.View>
      </TouchableOpacity>

      <Animated.Text style={{ fontSize: 16, textAlign:'center', marginVertical:12, color:'#1a1a1a', opacity: quoteOpacity }}>
        {quotes[quoteIndex]}
      </Animated.Text>

      <TouchableOpacity onPress={nextQuote} style={[styles.button, { backgroundColor: '#06d6a0' }]}>
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Следующая цитата</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

// --- Стили ---
const styles = StyleSheet.create({
  container:{flex:1,justifyContent:'center',alignItems:'center',padding:20},
  title:{fontSize:28,fontWeight:'bold',marginBottom:12},
  timer:{fontSize:48,fontWeight:'bold'},
  timerCircle:{width:180,height:180,borderRadius:90,justifyContent:'center',alignItems:'center',marginVertical:20},
  button:{paddingVertical:10,paddingHorizontal:15,borderRadius:12,alignItems:'center', marginTop:5},
  input:{height:40,borderWidth:1,borderRadius:6,marginHorizontal:5,paddingHorizontal:8},
  nav:{flexDirection:'row',justifyContent:'space-around',paddingVertical:12,borderTopWidth:0.5,borderColor:'#fff'},
  navButton:{justifyContent:'center',alignItems:'center'},
  navText:{fontSize:12,marginTop:4},
  circle:{width:150,height:150,borderRadius:75,justifyContent:'center',alignItems:'center',marginVertical:20},
});
