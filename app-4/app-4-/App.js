import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ScrollView, Alert, LayoutAnimation, UIManager, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

// Включаем LayoutAnimation для Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function App() {
  const [dream, setDream] = useState("");
  const [dreams, setDreams] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadDreams();
  }, []);

  const loadDreams = async () => {
    try {
      const data = await AsyncStorage.getItem("dreams");
      if (data) setDreams(JSON.parse(data));
    } catch (error) {
      console.log(error);
    }
  };

  const saveDream = async () => {
    if (!dream.trim()) {
      Alert.alert("Введите текст сна!");
      return;
    }

    const newDream = {
      id: Date.now().toString(),
      note: dream,
      date: new Date().toLocaleDateString(),
    };

    const updatedDreams = [newDream, ...dreams];
    setDreams(updatedDreams);
    setDream("");

    try {
      await AsyncStorage.setItem("dreams", JSON.stringify(updatedDreams));
    } catch (error) {
      console.log(error);
    }
  };

  const deleteDream = async (id) => {
    const updatedDreams = dreams.filter(d => d.id !== id);
    setDreams(updatedDreams);
    try {
      await AsyncStorage.setItem("dreams", JSON.stringify(updatedDreams));
    } catch (error) {
      console.log(error);
    }
  };

  const toggleExpand = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <LinearGradient
      colors={['#D7CCE0', '#8E97A5']}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>🌙 Ловец Снов 🌙</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Опишите свой сон..."
            value={dream}
            onChangeText={setDream}
            placeholderTextColor="#666"
            multiline={true} // многострочный ввод
            textAlignVertical="top" // текст начинается сверху
          />

          <TouchableOpacity style={styles.saveButton} onPress={saveDream}>
            <Text style={styles.saveButtonText}>Сохранить сон</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>Мои сны:</Text>
        <FlatList
          contentContainerStyle={{ alignItems: "center", paddingBottom: 50 }}
          data={dreams}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const expanded = expandedId === item.id;
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => toggleExpand(item.id)}
                style={styles.dreamCapsule}
              >
                <Text style={styles.dreamDate}>Дата: {item.date}</Text>
                {expanded && <Text style={styles.dreamNote}>{item.note}</Text>}
                <TouchableOpacity style={styles.deleteButton} onPress={() => deleteDream(item.id)}>
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
    paddingTop:80 // смещаем элементы ниже
  },
  title:{ fontSize:28, fontWeight:"bold", marginBottom:30, color:"#fff", textAlign:"center" },
  inputContainer:{ width:"100%", alignItems:"center", marginBottom:20 },
  input:{ 
    borderWidth:1, 
    borderColor:"#D1D5DB", 
    borderRadius:12, 
    padding:12, 
    marginBottom:15, 
    backgroundColor:"#fff", 
    width:"90%",
    height:100, // увеличиваем высоту
    shadowColor:"#000",
    shadowOffset:{width:0,height:2},
    shadowOpacity:0.1,
    shadowRadius:3,
    elevation:3
  },
  saveButton:{ 
    backgroundColor:"#6C5B7B", 
    padding:14, 
    borderRadius:12, 
    alignItems:"center", 
    marginTop:10, 
    width:"90%" 
  },
  saveButtonText:{ color:"#fff", fontSize:16, fontWeight:"700" },
  subtitle:{ fontSize:20, fontWeight:"600", marginBottom:10, marginTop:20, color:"#fff", textAlign:"center" },
  dreamCapsule:{ 
    padding:14, 
    marginBottom:12, 
    borderRadius:12, 
    borderWidth:1, 
    borderColor:"#D1D5DB", 
    width:"90%",
    minHeight:80, // увеличиваем минимальную высоту
    backgroundColor:"#fff",
    shadowColor:"#000",
    shadowOffset:{width:0,height:2},
    shadowOpacity:0.05,
    shadowRadius:4,
    elevation:2
  },
  dreamNote:{ fontSize:16, marginTop:8, color:"#111" },
  dreamDate:{ fontSize:14, color:"#374151" },
  deleteButton:{ backgroundColor:"#DC2626", padding:6, borderRadius:8, marginTop:8, alignItems:"center" },
  deleteButtonText:{ color:"#fff", fontSize:14, fontWeight:"600" }
});
