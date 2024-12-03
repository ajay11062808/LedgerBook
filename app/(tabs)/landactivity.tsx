import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { databases, config, ID } from '../appwrite';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { Entypo } from '@expo/vector-icons';
import { Collapsible } from '@/components/Collapsible';

interface LandActivity {
  $id?: string;
  name: string;
  landName: string;
  activity: string;
  date: Date;
  landInAcres: number;
  amountPerAcre: number;
  totalAmount: number;
  settledAmount: number;
  isSettled: boolean;
  individualActivities?: LandActivity[]; // New optional property
}

function LandActivitiesTracker() {
  const [activities, setActivities] = useState<LandActivity[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);

  const [name, setName] = useState('');
  const [landName, setLandName] = useState('');
  const [activity, setActivity] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [landInAcres, setLandInAcres] = useState('');
  const [amountPerAcre, setAmountPerAcre] = useState('');
  const [totalAmount, setTotalAmount] = useState('0.00');
  const [expenses, setExpenses] = useState(''); 
  const [editingActivity, setEditingActivity] = useState<LandActivity | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [isSettleModalVisible, setSettleModalVisible] = useState(false);
  const [settlingActivity, setSettlingActivity] = useState<LandActivity | null>(null);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const response = await databases.listDocuments(
        config.databaseId,
        config.landActivitiesCollectionId
      );
      const fetchedActivities = response.documents.map(doc => ({
        $id: doc.$id,
        name: doc.name,
        landName: doc.landName,
        activity: doc.activity,
        date: new Date(doc.date),
        landInAcres: doc.landInAcres,
        amountPerAcre: doc.amountPerAcre,
        totalAmount: doc.totalAmount,
        settledAmount: doc.settledAmount ?? 0,
        isSettled: doc.isSettled ?? false,
      }));
      setActivities(fetchedActivities);
    } catch (error) {
      console.error('Error fetching activities', error);
    }
  };

  const resetForm = () => {
    setName('');
    setLandName('');
    setActivity('');
    setSelectedDate(new Date());
    setLandInAcres('');
    setAmountPerAcre('');
    setTotalAmount('0.00');
    setEditingActivity(null);
    setModalVisible(false);
  };

  const updateTotalAmount = (acres: string, amountPerAcre: string) => {
    const total = parseFloat(acres) * parseFloat(amountPerAcre) || 0;
    setTotalAmount(total.toFixed(2));
  };

  const addOrEditActivity = async () => {
    if (!name || !landName || !activity || !landInAcres) {
      Alert.alert('Validation Error', 'Please fill all fields');
      return;
    }

    try {
      const activityData = {
        name,
        landName,
        activity,
        date: selectedDate.toISOString(),
        landInAcres: parseFloat(landInAcres),
        amountPerAcre: parseFloat(amountPerAcre),
        totalAmount: parseFloat(totalAmount),
        settledAmount: parseFloat(settleAmount),
        isSettled: false,
      };

      if (editingActivity && editingActivity.$id) {
        await databases.updateDocument(
          config.databaseId,
          config.landActivitiesCollectionId,
          editingActivity.$id,
          activityData
        );
      } else {
        await databases.createDocument(
          config.databaseId,
          config.landActivitiesCollectionId,
          ID.unique(),
          activityData
        );
      }

      await fetchActivities();
      resetForm();
    } catch (error) {
      console.error('Error saving activity', error);
      Alert.alert('Error', 'Failed to save activity');
    }
  };

  const deleteActivity = async (id: string) => {
    try {
      await databases.deleteDocument(
        config.databaseId,
        config.landActivitiesCollectionId,
        id
      );
      await fetchActivities();
    } catch (error) {
      console.error('Error deleting activity', error);
      Alert.alert('Error', 'Failed to delete activity');
    }
  };

  const editActivity = (activity: LandActivity) => {
    setEditingActivity(activity);
    setName(activity.name);
    setLandName(activity.landName);
    setActivity(activity.activity);
    setSelectedDate(activity.date);
    setLandInAcres(activity.landInAcres?activity.landInAcres.toString():'');
    setAmountPerAcre(activity.amountPerAcre?activity.amountPerAcre.toString():'');
    setTotalAmount(activity.totalAmount.toString());
    // setSettleAmount(activity.settledAmount?activity.settledAmount.toString():'')
    setModalVisible(true);
  };

  const toggleMenu = (itemId: string | null) => {
    setOpenMenuId(prevId => prevId === itemId ? null : itemId);
  };

  const settleUpLand = async (activity: LandActivity, amount: number) => {
    try {
      const settledAmount = activity.settledAmount + amount;
      const isFullySettled = settledAmount >= activity.totalAmount;
      
      const updatedActivity = {
        ...activity,
        settledAmount,
        isSettled: isFullySettled,
      };

      await databases.updateDocument(
        config.databaseId,
        config.landActivitiesCollectionId,
        activity.$id ?? '',
        updatedActivity
      );

      setActivities(activities.map(a => 
        a.$id === activity.$id ? updatedActivity : a
      ));

      Alert.alert('Success', isFullySettled ? 'Land activity fully settled' : 'Partial settlement recorded');
    } catch (error) {
      console.error('Error settling up land activity', error);
      Alert.alert('Error', 'Failed to settle up land activity');
    }
  };
  const groupActivitiesByName = (activities: LandActivity[]) => {
    const groupedActivities: Record<string, LandActivity[]> = {};
    const summaryActivities: LandActivity[] = [];
  
    // First, group activities by name
    activities.forEach(activity => {
      if (!groupedActivities[activity.name]) {
        groupedActivities[activity.name] = [];
      }
      groupedActivities[activity.name].push(activity);
    });
  
    // Create summary activities
    Object.keys(groupedActivities).forEach(name => {
      const userActivities = groupedActivities[name];
      
      const totalAmount = userActivities.reduce((sum, activity) => sum + activity.totalAmount, 0);
      const settledAmount = userActivities.reduce((sum, activity) => sum + activity.settledAmount, 0);
      const isSettled = settledAmount >= totalAmount;
  
      const summaryActivity: LandActivity = {
        name,
        landName: userActivities[0].landName, // Use first activity's land name
        activity: 'Summary', // Indicate this is a summary
        date: new Date(), // Current date for summary
        landInAcres: userActivities.reduce((sum, activity) => sum + activity.landInAcres, 0),
        amountPerAcre: 0, // Not applicable for summary
        totalAmount,
        settledAmount,
        isSettled,
        $id: `summary-${name}`,
        individualActivities: userActivities // Store individual activities
      };
  
      summaryActivities.push(summaryActivity);
    });
  
    // Combine individual and summary activities
    const combinedActivities = activities.concat(summaryActivities);
  
    return combinedActivities;
  };

  const groupedActivities = groupActivitiesByName(activities);
  const renderActivity = ({ item }: { item: LandActivity }) => {if (item.activity === 'Summary') {
    return (
      <ThemedView style={{backgroundColor: item.isSettled ? "#4CAF50" : "#86e33e"}} className={'rounded mb-2 p-3 align-items flex-row justify-between items-start'}>
        <Collapsible title={`${item.name} - Summary`}>
          <ThemedView className="flex-col pr-20">
            <ThemedText className="text-lg font-bold mb-2">Total Summary</ThemedText>
            <ThemedText className="text-gray-600">Total Land in Acres: {item.landInAcres}</ThemedText>
            <ThemedText className="text-gray-600">Total Amount: ₹{item.totalAmount}</ThemedText>
            <ThemedText className="text-gray-600">Settled Amount: ₹{item.settledAmount}</ThemedText>
            <ThemedText className="text-gray-600">Status: {item.isSettled ? 'Settled' : 'Pending'}</ThemedText>
            
            {/* Show individual activities */}
            <ThemedText className="text-lg font-bold mt-4 mb-2">Individual Activities</ThemedText>
            {item.individualActivities?.map((activity, index) => (
              <ThemedView key={index} className="border-t border-gray-200 pt-2 mt-2">
                <ThemedText className="text-gray-600">Activity: {activity.activity}</ThemedText>
                <ThemedText className="text-gray-600">Date: {activity.date.toLocaleDateString()}</ThemedText>
                <ThemedText className="text-gray-600">Land in Acres: {activity.landInAcres}</ThemedText>
                <ThemedText className="text-gray-600">Amount: ₹{activity.totalAmount}</ThemedText>
              </ThemedView>
            ))}
          </ThemedView>
        </Collapsible>
      
      <View className="relative">
        <TouchableOpacity 
          className="p-2"
          onPress={() => toggleMenu(item.$id ?? null)}
        >
          <Entypo name="dots-three-vertical" size={20} color="text-gray-700" />
        </TouchableOpacity>
        
        {openMenuId === item.$id && (
          <ThemedView className="absolute top-8 right-0 bg-white rounded-lg shadow-lg z-10 w-36">
            <TouchableOpacity 
              className="p-4 border-b border-gray-100"
              onPress={() => {
                editActivity(item);
                setOpenMenuId(null);
              }}
            >
              <ThemedText className="text-center">Edit</ThemedText>
            </TouchableOpacity>
            {!item.isSettled && (
              <TouchableOpacity 
                className="p-4 border-b border-gray-100"
                onPress={() => {
                  setSettlingActivity(item);
                  setSettleModalVisible(true);
                  setOpenMenuId(null);
                }}
              >
                <ThemedText className="text-center">Settle Up</ThemedText>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              className="p-4"
              onPress={() => {
                Alert.alert(
                  'Confirm Deletion',
                  'Are you sure you want to delete this activity?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Delete', 
                      style: 'destructive', 
                      onPress: () => {
                        if (item.$id) deleteActivity(item.$id);
                        setOpenMenuId(null);
                      }
                    }
                  ]
                );
              }}
            >
              <ThemedText className="text-red-600 text-center">Delete</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        )}
      </View>
    </ThemedView>
  )}return null;
};

  return (
    <ThemedView className="flex-1 p-4 mt-7">
      <TouchableOpacity
        className="p-3 bg-blue-500 rounded-md mb-4"
        onPress={() => setModalVisible(true)}
      >
        <ThemedText className="text-white text-center">Add Land Activity</ThemedText>
      </TouchableOpacity>

      <Modal visible={isModalVisible} transparent={true} animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-end"
        >
          <ThemedView className="bg-white rounded-t-2xl p-6 shadow-2xl">
            <ThemedTextInput
              placeholder="Name"
              value={name}
              onChangeText={setName}
              className="mb-3 border rounded-lg p-2"
            />
            <ThemedTextInput
              placeholder="Land Name"
              value={landName}
              onChangeText={setLandName}
              className="mb-3 border rounded-lg p-2"
            />
            <ThemedTextInput
              placeholder="Activity Description"
              value={activity}
              onChangeText={setActivity}
              className="mb-3 border rounded-lg p-2"
            />
            <ThemedTextInput
              placeholder="Land in Acres"
              value={landInAcres}
              onChangeText={(value) => {
                setLandInAcres(value);
                updateTotalAmount(value, amountPerAcre);
              }}
              keyboardType="numeric"
              className="mb-3 border rounded-lg p-2"
            />
            <ThemedTextInput
              placeholder="Amount per Acre"
              value={amountPerAcre}
              onChangeText={(value) => {
                setAmountPerAcre(value);
                updateTotalAmount(landInAcres, value);
              }}
              keyboardType="numeric"
              className="mb-3 border rounded-lg p-2"
            />
            <ThemedText className="mb-3">Total Amount: ₹{totalAmount}</ThemedText>

            <TouchableOpacity
              onPress={() => setDatePickerVisible(true)}
              className="p-2 mb-4 bg-blue-600 rounded-md"
            >
              <ThemedText className="text-center">Select Date: {selectedDate.toLocaleDateString()}</ThemedText>
            </TouchableOpacity>

            {isDatePickerVisible && (
              <DateTimePicker
                mode="date"
                value={selectedDate}
                onChange={(event, date) => {
                  if (date) {
                    setSelectedDate(date);
                  }
                  setDatePickerVisible(false);
                }}
              />
            )}

            <TouchableOpacity
              onPress={addOrEditActivity}
              className="p-3 bg-green-500 rounded-md mb-2"
            >
              <ThemedText className="text-white text-center">
                {editingActivity ? 'Update Activity' : 'Save Activity'}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={resetForm}
              className="p-3 bg-red-500 rounded-md"
            >
              <ThemedText className="text-white text-center">Cancel</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={isSettleModalVisible} transparent={true} animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-end"
        >
          <ThemedView className="bg-white rounded-t-2xl p-6 shadow-2xl">
            <ThemedText className="text-lg font-bold mb-4">Settle Up Land Activity</ThemedText>
            <ThemedText className="mb-2">Remaining Amount to be paid: ₹{settlingActivity ? (settlingActivity.totalAmount - settlingActivity.settledAmount).toFixed(2) : '0'}</ThemedText>
            <ThemedTextInput
              placeholder="Amount to Settle"
              value={settleAmount}
              onChangeText={setSettleAmount}
              keyboardType="numeric"
              className="mb-3 border rounded-lg p-2"
            />
            <TouchableOpacity
              onPress={() => {
                if (settlingActivity && parseFloat(settleAmount) > 0) {
                  settleUpLand(settlingActivity, parseFloat(settleAmount));
                  setSettleModalVisible(false);
                  setSettleAmount('');
                  setSettlingActivity(null);
                } else {
                  Alert.alert('Invalid Amount', 'Please enter a valid amount to settle.');
                }
              }}
              className="p-3 bg-green-500 rounded-md mb-2"
            >
              <ThemedText className="text-white text-center">Confirm Settlement</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setSettleModalVisible(false);
                setSettleAmount('');
                setSettlingActivity(null);
              }}
              className="p-3 bg-red-500 rounded-md"
            >
              <ThemedText className="text-white text-center">Cancel</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </KeyboardAvoidingView>
      </Modal>

      <FlatList
        data={groupedActivities}
        renderItem={renderActivity}
        keyExtractor={(item) => item.$id || item.name}
        onScrollBeginDrag={() => setOpenMenuId(null)}
      />
    </ThemedView>
  );
}

export default LandActivitiesTracker;
