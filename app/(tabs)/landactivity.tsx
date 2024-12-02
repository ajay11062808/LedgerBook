import React, { useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';

interface LandActivity {
  id: string;
  landName: string;
  activity: string;
  date: Date;
  expenses: number;
}

const LandActivitiesTracker: React.FC = () => {
  const [activities, setActivities] = useState<LandActivity[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  
  const [landName, setLandName] = useState('');
  const [activity, setActivity] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [expenses, setExpenses] = useState('');

  const addActivity = () => {
    const newActivity: LandActivity = {
      id: Date.now().toString(),
      landName,
      activity,
      date: selectedDate,
      expenses: parseFloat(expenses)
    };

    setActivities([...activities, newActivity]);
    resetForm();
  };

  const resetForm = () => {
    setLandName('');
    setActivity('');
    setSelectedDate(new Date());
    setExpenses('');
    setModalVisible(false);
  };

  const renderActivity = ({ item }: { item: LandActivity }) => (
    <ThemedView style={styles.activityItem}>
      <ThemedText>{item.landName}</ThemedText>
      <ThemedText>Activity: {item.activity}</ThemedText>
      <ThemedText>Date: {item.date.toLocaleDateString()}</ThemedText>
      <ThemedText>Expenses: ₹{item.expenses}</ThemedText>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
      >
        <ThemedText>Add Land Activity</ThemedText>
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <ThemedTextInput
            placeholder="Land Name"
            value={landName}
            onChangeText={setLandName}
          />
          <ThemedTextInput
            placeholder="Activity Description"
            value={activity}
            onChangeText={setActivity}
          />
          <ThemedTextInput
            placeholder="Expenses"
            value={expenses}
            onChangeText={setExpenses}
            keyboardType="numeric"
          />
          <DateTimePicker
            mode="date"
            value={selectedDate}
            onChange={(event, date) => date && setSelectedDate(date)}
          />
          <TouchableOpacity onPress={addActivity}>
            <ThemedText>Save Activity</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setModalVisible(false)}>
            <ThemedText>Cancel</ThemedText>
          </TouchableOpacity>
        </View>
      </Modal>

      <FlatList
        data={activities}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id}
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  addButton: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 16,
  },
  modalContainer: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
  },
  activityItem: {
    padding: 16,
    marginVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  }
});

export default LandActivitiesTracker;