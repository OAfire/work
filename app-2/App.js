import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ScrollView, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function App() {
  const [mood, setMood] = useState(null);
  const [note, setNote] = useState("");
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const data = await AsyncStorage.getItem("moodEntries");
      if (data) setEntries(JSON.parse(data));
    } catch (error) {
      console.log(error);
    }
  };

  const saveEntry = async () => {
    if (!mood) {
      Alert.alert("Выберите настроение!");
      return;
    }
    if (!note.trim()) {
      Alert.alert("Введите заметку!");
      return;
    }

    const newEntry = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(),
      mood,
      note
    };
    const updatedEntries = [newEntry, ...entries];
    setEntries(updatedEntries);
    setMood(null);
    setNote("");
    try {
      await AsyncStorage.setItem("moodEntries", JSON.stringify(updatedEntries));
    } catch (error) {
      console.log(error);
    }
  };

  const deleteEntry = async (id) => {
    const updatedEntries = entries.filter(entry => entry.id !== id);
    setEntries(updatedEntries);
    try {
      await AsyncStorage.setItem("moodEntries", JSON.stringify(updatedEntries));
    } catch (error) {
      console.log(error);
    }
  };

  const moods = ["😀","🙂","😐","😢","😡"];
  const moodValues = { "😀":5, "🙂":4, "😐":3, "😢":2, "😡":1 };
  const moodColors = { "😀": "#A7F3D0", "🙂": "#D1FAE5", "😐": "#E5E7EB", "😢": "#BFDBFE", "😡": "#FECACA" };

  const getMoodColor = (m) => moodColors[m] || "#fff";

  const getAverageMood = () => {
    if (entries.length === 0) return "—";
    const avg = entries.reduce((sum, e) => sum + moodValues[e.mood], 0) / entries.length;
    if (avg >= 4.5) return "😀";
    if (avg >= 3.5) return "🙂";
    if (avg >= 2.5) return "😐";
    if (avg >= 1.5) return "😢";
    return "😡";
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Дневник настроения</Text>

      {/* Среднее настроение */}
      {entries.length > 0 && (
        <Text style={styles.averageMood}>Среднее настроение: {getAverageMood()}</Text>
      )}

      <View style={styles.moodRow}>
        {moods.map(m => (
          <TouchableOpacity
            key={m}
            style={[
              styles.moodButton, 
              { backgroundColor: mood === m ? getMoodColor(m) : "#E5E7EB" }
            ]}
            onPress={() => setMood(m)}
          >
            <Text style={styles.moodText}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder="Напишите заметку о своём дне..."
        value={note}
        onChangeText={setNote}
      />

      <TouchableOpacity style={styles.saveButton} onPress={saveEntry}>
        <Text style={styles.saveButtonText}>Сохранить</Text>
      </TouchableOpacity>

      <Text style={styles.subtitle}>История:</Text>
      <FlatList
        contentContainerStyle={{ alignItems: "center", paddingBottom: 50 }}
        data={entries}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <View style={[styles.entry, { backgroundColor: getMoodColor(item.mood) }]}>
            <Text style={styles.entryMood}>{item.mood}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.entryDate}>{item.date}</Text>
              <Text style={styles.entryNote}>{item.note}</Text>
            </View>
            <TouchableOpacity style={styles.deleteButton} onPress={() => deleteEntry(item.id)}>
              <Text style={styles.deleteButtonText}>Удалить</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:{
    flexGrow:1,
    alignItems:"center",
    backgroundColor:"#F9FAFB",
    padding:20,
    paddingTop:120 // ещё ниже
  },
  title:{ fontSize:24, fontWeight:"bold", marginBottom:20, textAlign:"center" },
  averageMood:{ fontSize:20, marginBottom:20 },
  moodRow:{ flexDirection:"row", justifyContent:"center", marginBottom:20 },
  moodButton:{ padding:10, margin:5, borderRadius:10 },
  moodText:{ fontSize:26 },
  input:{ borderWidth:1, borderColor:"#D1D5DB", borderRadius:8, padding:10, marginBottom:15, backgroundColor:"#fff", width:320 },
  saveButton:{ backgroundColor:"#2563EB", padding:12, borderRadius:10, alignItems:"center", marginBottom:10, width:320 },
  saveButtonText:{ color:"#fff", fontSize:16, fontWeight:"600" },
  subtitle:{ fontSize:18, fontWeight:"600", marginBottom:10, textAlign:"center", marginTop:20 },
  entry:{ flexDirection:"row", alignItems:"center", padding:12, marginBottom:8, borderRadius:8, borderWidth:1, borderColor:"#E5E7EB", width:320 },
  entryMood:{ fontSize:26, marginRight:12 },
  entryDate:{ fontSize:14, fontWeight:"600" },
  entryNote:{ fontSize:14, color:"#374151" },
  deleteButton:{ backgroundColor:"#DC2626", padding:6, borderRadius:6, marginLeft:10 },
  deleteButtonText:{ color:"#fff", fontSize:12, fontWeight:"600" }
});
