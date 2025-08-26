import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ScrollView, Alert, LayoutAnimation, UIManager, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";

// Включаем LayoutAnimation для Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function App() {
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [capsules, setCapsules] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadCapsules();
  }, []);

  const loadCapsules = async () => {
    try {
      const data = await AsyncStorage.getItem("timeCapsules");
      if (data) setCapsules(JSON.parse(data));
    } catch (error) {
      console.log(error);
    }
  };

  const saveCapsule = async () => {
    if (!note.trim()) {
      Alert.alert("Введите текст капсулы!");
      return;
    }

    const formattedDate = date.toISOString().split("T")[0]; // YYYY-MM-DD

    const newCapsule = {
      id: Date.now().toString(),
      note,
      date: formattedDate,
    };

    const updatedCapsules = [newCapsule, ...capsules];
    setCapsules(updatedCapsules);
    setNote("");
    setDate(new Date());

    try {
      await AsyncStorage.setItem("timeCapsules", JSON.stringify(updatedCapsules));
    } catch (error) {
      console.log(error);
    }
  };

  const deleteCapsule = async (id) => {
    const updatedCapsules = capsules.filter(c => c.id !== id);
    setCapsules(updatedCapsules);
    try {
      await AsyncStorage.setItem("timeCapsules", JSON.stringify(updatedCapsules));
    } catch (error) {
      console.log(error);
    }
  };

  const isOpened = (capsuleDate) => {
    const today = new Date();
    const openDate = new Date(capsuleDate);
    return today >= openDate;
  };

  const toggleExpand = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <LinearGradient
      colors={['#B3E5FC', '#0288D1']}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>💫 Time Capsule 💫</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Напишите текст капсулы..."
            value={note}
            onChangeText={setNote}
            placeholderTextColor="#666"
          />

          <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.input}>
            <Text style={{ color: "#111" }}>{date.toISOString().split("T")[0]}</Text>
          </TouchableOpacity>

          {showPicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowPicker(Platform.OS === 'ios'); 
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}

          {/* Кнопка сохранения теперь ниже */}
          <TouchableOpacity style={styles.saveButton} onPress={saveCapsule}>
            <Text style={styles.saveButtonText}>Сохранить капсулу</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>Мои капсулы:</Text>
        <FlatList
          contentContainerStyle={{ alignItems: "center", paddingBottom: 50 }}
          data={capsules}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const expanded = expandedId === item.id;
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => toggleExpand(item.id)}
                style={[
                  styles.capsule,
                  { backgroundColor: isOpened(item.date) ? "#A7F3D0" : "#E5E7EB" }
                ]}
              >
                <Text style={styles.capsuleDate}>Откроется: {item.date}</Text>
                <Text style={styles.status}>{isOpened(item.date) ? "Открыта" : "Скрыта"}</Text>
                {expanded && <Text style={styles.capsuleNote}>{item.note}</Text>}
                <TouchableOpacity style={styles.deleteButton} onPress={() => deleteCapsule(item.id)}>
                  <Text style={styles.deleteButtonText}>Удалить</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container:{
    flexGrow:1,
    alignItems:"center",
    justifyContent:"flex-start",
    padding:20,
    paddingTop:60
  },
  title:{ fontSize:28, fontWeight:"bold", marginBottom:20, color:"#fff", textAlign:"center" },
  inputContainer:{ width:"100%", alignItems:"center", marginBottom:20 },
  input:{ 
    borderWidth:1, 
    borderColor:"#D1D5DB", 
    borderRadius:12, 
    padding:12, 
    marginBottom:15, 
    backgroundColor:"#fff", 
    width:"90%",
    shadowColor:"#000",
    shadowOffset:{width:0,height:2},
    shadowOpacity:0.1,
    shadowRadius:3,
    elevation:3,
    justifyContent:"center"
  },
  saveButton:{ 
    backgroundColor:"#2563EB", 
    padding:14, 
    borderRadius:12, 
    alignItems:"center", 
    marginTop:10, 
    width:"90%" 
  },
  saveButtonText:{ color:"#fff", fontSize:16, fontWeight:"700" },
  subtitle:{ fontSize:20, fontWeight:"600", marginBottom:10, marginTop:20, color:"#fff", textAlign:"center" },
  capsule:{ 
    padding:14, 
    marginBottom:12, 
    borderRadius:12, 
    borderWidth:1, 
    borderColor:"#D1D5DB", 
    width:"90%", // теперь такая же ширина, как поля ввода
    shadowColor:"#000",
    shadowOffset:{width:0,height:2},
    shadowOpacity:0.05,
    shadowRadius:4,
    elevation:2
  },
  capsuleNote:{ fontSize:16, marginTop:8, color:"#111" },
  capsuleDate:{ fontSize:14, color:"#374151" },
  status:{ fontSize:14, fontWeight:"600", marginTop:4, color:"#2563EB" },
  deleteButton:{ backgroundColor:"#DC2626", padding:6, borderRadius:8, marginTop:8, alignItems:"center" },
  deleteButtonText:{ color:"#fff", fontSize:14, fontWeight:"600" }
});
