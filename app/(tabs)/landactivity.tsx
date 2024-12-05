import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { databases, config, ID, Query } from '../appwrite';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { Entypo } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Collapsible } from '@/components/Collapsible';
import {LoadingOverlay} from '../../components/landactivity/Loading'

interface Settlement {
  date: string;
  amount: number;
  remarks: string;
}

interface LandActivity {
  $id?: string;
  name: string;
  landName: string;
  activity: string;
  date: Date;
  landInAcres: number;
  amountPerAcre: number;
  totalAmount: number;
}

interface GroupSettlement {
  $id?: string;
  groupName: string;
  totalAmount: number;
  settledAmount: number;
  isSettled: boolean;
  settlements: Settlement[];
}

interface GroupedActivity {
  name: string;
  totalAmount: number;
  settledAmount: number;
  isSettled: boolean;
  activities: LandActivity[];
  settlements: Settlement[];
}

function LandActivitiesTracker() {
  const [activities, setActivities] = useState<LandActivity[]>([]);
  const [groupedActivities, setGroupedActivities] = useState<GroupedActivity[]>([]);
  const [groupSettlements, setGroupSettlements] = useState<GroupSettlement[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [isSettlementDatePickerVisible, setSettlementDatePickerVisible] = useState(false);
  const [name, setName] = useState('');
  const [landName, setLandName] = useState('');
  const [activity, setActivity] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [landInAcres, setLandInAcres] = useState('');
  const [amountPerAcre, setAmountPerAcre] = useState('');
  const [totalAmount, setTotalAmount] = useState('0.00');
  const [editingActivity, setEditingActivity] = useState<LandActivity | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleRemarks, setSettleRemarks] = useState('');
  const [isSettleModalVisible, setSettleModalVisible] = useState(false);
  const [settlingGroup, setSettlingGroup] = useState<GroupedActivity | null>(null);
  const [settlementDate, setSettlementDate] = useState(new Date());
  const [filterName, setFilterName] = useState('');
 
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const { t } = useTranslation();

  useEffect(() => {
    fetchActivities();
  }, []);

  useEffect(() => {
    const grouped = groupActivitiesByName(activities, groupSettlements);
    setGroupedActivities(grouped);
  }, [activities, groupSettlements]);

  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage(t('Loading Activities'));
      const [activitiesResponse, settlementsResponse] = await Promise.all([
        databases.listDocuments(
          config.databaseId,
          config.landActivitiesCollectionId,
          [Query.orderDesc('date')]
        ),
        databases.listDocuments(
          config.databaseId,
          config.groupSettlementsCollectionId
        )
      ]);

      const fetchedActivities = activitiesResponse.documents.map(doc => ({
        $id: doc.$id,
        name: doc.name,
        landName: doc.landName,
        activity: doc.activity,
        date: new Date(doc.date),
        landInAcres: doc.landInAcres,
        amountPerAcre: doc.amountPerAcre,
        totalAmount: doc.totalAmount,
      }));
      setActivities(fetchedActivities);

      const fetchedSettlements = settlementsResponse.documents.map(doc => {
        const settlements: Settlement[] = [];
        if (doc.settlementDates && doc.settlementAmounts && doc.settlementRemarks) {
          for (let i = 0; i < doc.settlementDates.length; i++) {
            settlements.push({
              date: doc.settlementDates[i],
              amount: doc.settlementAmounts[i],
              remarks: doc.settlementRemarks[i]
            });
          }
        }
        return{
        $id: doc.$id,
        groupName: doc.groupName,
        totalAmount: doc.totalAmount,
        settledAmount: doc.settledAmount,
        isSettled: doc.isSettled,
        settlements: settlements,
        }
      });
      setGroupSettlements(fetchedSettlements);
    } catch (error) {
      console.error('Error fetching data', error);
    }
    finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  function groupActivitiesByName(activities: LandActivity[], settlements: GroupSettlement[]): GroupedActivity[] {
    const groupedMap = activities.reduce((acc, activity) => {
      if (!acc[activity.name]) {
        const groupSettlement = settlements.find(s => s.groupName === activity.name) || {
          totalAmount: 0,
          settledAmount: 0,
          isSettled: false,
          settlements: [],
          settlementDates: [],
         settlementAmounts: [],
         settlementRemarks: [],
        };
        acc[activity.name] = {
          name: activity.name,
          totalAmount: 0,
          settledAmount: groupSettlement.settledAmount,
          isSettled: groupSettlement.isSettled,
          activities: [],
          settlements: groupSettlement.settlements,
        };
      }

      acc[activity.name].activities.push(activity);
      acc[activity.name].totalAmount += activity.totalAmount;
      acc[activity.name].isSettled = acc[activity.name].settledAmount >= acc[activity.name].totalAmount;
      return acc;
    }, {} as Record<string, GroupedActivity>);

    return Object.values(groupedMap);
  }

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
      Alert.alert(t('ValidationError'), t('PleaseAllFields'));
      return;
    }

    try {
      setIsLoading(true);
      setLoadingMessage(editingActivity 
        ? t('Updating Activity') 
        : t('Adding Activity')
      );
      const activityData = {
        name,
        landName,
        activity,
        date: selectedDate.toISOString(),
        landInAcres: parseFloat(landInAcres),
        amountPerAcre: parseFloat(amountPerAcre),
        totalAmount: parseFloat(totalAmount),
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

      // Update group settlement total amount
      const groupName = editingActivity ? editingActivity.name : name;
      const groupSettlement = groupSettlements.find(s => s.groupName === groupName);
      if (groupSettlement) {
        const updatedActivities = editingActivity
          ? activities.map(a => (a.$id === editingActivity.$id ? activityData : a))
          : [...activities, activityData];
        const newTotalAmount = updatedActivities
          .filter(a => a.name === groupName)
          .reduce((sum, a) => sum + a.totalAmount, 0);

        await databases.updateDocument(
          config.databaseId,
          config.groupSettlementsCollectionId,
          groupSettlement.$id!,
          { totalAmount: newTotalAmount }
        );
      } else {
        // Create new group settlement if it doesn't exist
        await databases.createDocument(
          config.databaseId,
          config.groupSettlementsCollectionId,
          ID.unique(),
          {
            groupName: groupName,
            totalAmount: parseFloat(totalAmount),
            settledAmount: 0,
            isSettled: false,
            settlementDates: [],
            settlementAmounts: [],
            settlementRemarks: [],
          }
        );
      }

      await fetchActivities();
      resetForm();
    } catch (error) {
      console.error('Error saving activity', error);
      Alert.alert(t('Error'), t('FailedToSaveActivity'));
    }
    finally{
      setIsLoading(false);
      setLoadingMessage('')
    }
  };

  const deleteActivity = async (id: string) => {
    try {
      setIsLoading(true);
      setLoadingMessage(t('Deleting Activity'));

      const activityToDelete = activities.find(a => a.$id === id);
      if (!activityToDelete) {
        throw new Error('Activity not found');
      }

      await databases.deleteDocument(
        config.databaseId,
        config.landActivitiesCollectionId,
        id
      );

      // Update group settlement total amount
      const groupSettlement = groupSettlements.find(s => s.groupName === activityToDelete.name);
      if (groupSettlement) {
        const updatedActivities = activities.filter(a => a.$id !== id);
        const newTotalAmount = updatedActivities
          .filter(a => a.name === activityToDelete.name)
          .reduce((sum, a) => sum + a.totalAmount, 0);

        await databases.updateDocument(
          config.databaseId,
          config.groupSettlementsCollectionId,
          groupSettlement.$id!,
          { totalAmount: newTotalAmount }
        );
      }

      await fetchActivities();
    } catch (error) {
      console.error('Error deleting activity', error);
      Alert.alert(t('Error'), t('FailedToDeleteActivity'));
    }
    finally{
      setIsLoading(false);
      setLoadingMessage('')
    }
  };

  const editActivity = (activity: LandActivity) => {
    setEditingActivity(activity);
    setName(activity.name);
    setLandName(activity.landName);
    setActivity(activity.activity);
    setSelectedDate(activity.date);
    setLandInAcres(activity.landInAcres.toString());
    setAmountPerAcre(activity.amountPerAcre ? activity.amountPerAcre.toString() : '');
    setTotalAmount(activity.totalAmount.toString());
    setModalVisible(true);
  };

  const settleUpGroup = async (group: GroupedActivity, amount: number, remarks: string) => {
    const recalculatedTotalAmount = group.activities.reduce((sum, activity) => sum + activity.totalAmount, 0);
    try {
      setIsLoading(true);
      setLoadingMessage(t('Settling Amount'));

      const newSettlement: Settlement = {
        date: settlementDate.toISOString(),
        amount,
        remarks
      };

      const updatedGroup = {
        ...group,
        totalAmount:recalculatedTotalAmount,
        settledAmount: group.settledAmount + amount,
        isSettled: group.settledAmount + amount >= recalculatedTotalAmount,
        settlements: [...group.settlements, newSettlement],
      };

      // Update or create group settlement
      const groupSettlement = groupSettlements.find(s => s.groupName === group.name);
      if (groupSettlement) {
        await databases.updateDocument(
          config.databaseId,
          config.groupSettlementsCollectionId,
          groupSettlement.$id!,
          {
            totalAmount:recalculatedTotalAmount,
            settledAmount: updatedGroup.settledAmount,
            isSettled: updatedGroup.isSettled,
            settlementDates: updatedGroup.settlements.map(s => s.date),
            settlementAmounts: updatedGroup.settlements.map(s => s.amount),
            settlementRemarks: updatedGroup.settlements.map(s => s.remarks),
          }
        );
      } else {
        await databases.createDocument(
          config.databaseId,
          config.groupSettlementsCollectionId,
          ID.unique(),
          {
            groupName: group.name,
            totalAmount: recalculatedTotalAmount,
            settledAmount: updatedGroup.settledAmount,
            isSettled: updatedGroup.isSettled,
            settlementDates: updatedGroup.settlements.map(s => s.date),
            settlementAmounts: updatedGroup.settlements.map(s => s.amount),
            settlementRemarks: updatedGroup.settlements.map(s => s.remarks),
           
          }
        );
      }

      await fetchActivities();

      Alert.alert(t('Success'), updatedGroup.isSettled ? t('Fully Settled') : t('Partial Settlement'));
    } catch (error) {
      console.error('Error settling up group', error);
      Alert.alert(t('Error'), t('FailedToSettle'));
    }
    finally{
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const renderGroupedActivity = ({ item }: { item: GroupedActivity }) => (
    <Collapsible title={item.name}>
      <ThemedView style={{backgroundColor: item.isSettled ? "#9c8686" : "#86e33e"}} className={'rounded mb-2 p-3'}>
        <ThemedText className="text-lg font-bold">{item.name}</ThemedText>
        <ThemedText>{t('Total Amount')}: ₹{item.totalAmount.toFixed(2)}</ThemedText>
        <ThemedText>{t('Settled Amount')}: ₹{item.settledAmount.toFixed(2)}</ThemedText>
        <ThemedText>{t('Remaining Amount')}: ₹{(item.totalAmount - item.settledAmount).toFixed(2)}</ThemedText>
        <ThemedText>{t('Status')}: {item.isSettled ? t('Settled') : t('Pending')}</ThemedText>
        
        {!item.isSettled && (
          <TouchableOpacity 
            className="mt-2 p-2 bg-blue-500 rounded"
            onPress={() => {
              setSettlingGroup(item);
              setSettleModalVisible(true);
            }}
          >
            <ThemedText className="text-white text-center">{t('Settle Up')}</ThemedText>
          </TouchableOpacity>
        )}
        
        <ThemedText className="mt-2 font-bold">{t('SettlementHistory')}:</ThemedText>
        {item.settlements.map((settlement, index) => (
          <View key={index} className="ml-2 mt-1">
            <ThemedText>{t('Date')}: {new Date(settlement.date).toLocaleDateString()}</ThemedText>
            <ThemedText>{t('Amount')}: ₹{settlement.amount.toFixed(2)}</ThemedText>
            <ThemedText>{t('Remarks')}: {settlement.remarks}</ThemedText>
          </View>
        ))}

        <ThemedText className="mt-2 font-bold">{t('Activities')}:</ThemedText>
        {item.activities.map((activity, index) => (
          <View key={index} className="ml-2 mt-1">
            <ThemedText>{activity.landName} - {activity.activity}</ThemedText>
            <ThemedText>{activity.landInAcres} Acres</ThemedText>
            <ThemedText>{t('Date')}: {activity.date.toLocaleDateString()}</ThemedText>
            <ThemedText>{t('Amount')}: ₹{activity.totalAmount.toFixed(2)}</ThemedText>

            <View className="flex-row justify-end">
              <TouchableOpacity 
                className="p-2 mr-2"
                onPress={() => editActivity(activity)}
              >
                <ThemedText className="text-blue-600">{t('Edit')}</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                className="p-2"
                onPress={() => {
                  Alert.alert(
                    t('ConfirmDeletion'),
                    t('AreYouSureDelete'),
                    [
                      { text: t('Cancel'), style: 'cancel' },
                      { 
                        text: t('Delete'), 
                        style: 'destructive', 
                        onPress: () => {
                          if (activity.$id) deleteActivity(activity.$id);
                        }
                      }
                    ]
                  );
                }}
              >
                <ThemedText className="text-red-600">{t('Delete')}</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ThemedView>
    </Collapsible>
  );

  return (
    <ThemedView className="flex-1 p-4 mt-7">
      {isLoading && <LoadingOverlay message={loadingMessage} />}
      <ThemedTextInput
        placeholder={t('FilterByName')}
        value={filterName}
        onChangeText={setFilterName}
        className="mb-3 border rounded-lg p-2"
      />
      <TouchableOpacity
        className="p-3 bg-blue-500 rounded-md mb-4"
        onPress={() => setModalVisible(true)}
      >
        <ThemedText className="text-white text-center">{t('AddLandActivity')}</ThemedText>
      </TouchableOpacity>

      <Modal visible={isModalVisible} transparent={true} animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-end"
        >
          <ThemedView className="bg-white rounded-t-2xl p-6 shadow-2xl">
            <ThemedTextInput
              placeholder={t('Name')}
              value={name}
              onChangeText={setName}
              className="mb-3 border rounded-lg p-2"
            />
            <ThemedTextInput
              placeholder={t('LandName')}
              value={landName}
              onChangeText={setLandName}
              className="mb-3 border rounded-lg p-2"
            />
            <ThemedTextInput
              placeholder={t('ActivityDescription')}
              value={activity}
              onChangeText={setActivity}
              className="mb-3 border rounded-lg p-2"
            />
            <ThemedTextInput
              placeholder={t('LandInAcres')}
              value={landInAcres}
              onChangeText={(value) => {
                setLandInAcres(value);
                updateTotalAmount(value, amountPerAcre);
              }}
              keyboardType="numeric"
              className="mb-3 border rounded-lg p-2"
            />
            <ThemedTextInput
              placeholder={t('AmountPerAcre')}
              value={amountPerAcre}
              onChangeText={(value) => {
                setAmountPerAcre(value);
                updateTotalAmount(landInAcres, value);
              }}
              keyboardType="numeric"
              className="mb-3 border rounded-lg p-2"
            />
            <ThemedText className="mb-3">{t('Total Amount')}: ₹{totalAmount}</ThemedText>

            <TouchableOpacity
              onPress={() => setDatePickerVisible(true)}
              className="p-2 mb-4 bg-blue-600 rounded-md"
            >
              <ThemedText className="text-center">{t('Select Date')}: {selectedDate.toLocaleDateString()}</ThemedText>
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
                {editingActivity ? t('Update Activity') : t('Save Activity')}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={resetForm}
              className="p-3 bg-red-500 rounded-md"
            >
              <ThemedText className="text-white text-center">{t('Cancel')}</ThemedText>
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
            <ThemedText className="text-lg font-bold mb-4">{t('SettleUpGroup')}</ThemedText>
            <ThemedText className="mb-2">{t('RemainingAmount')}: ₹{settlingGroup ? (settlingGroup.totalAmount - settlingGroup.settledAmount).toFixed(2) : '0'}</ThemedText>
            <ThemedTextInput
              placeholder={t('AmountToSettle')}
              value={settleAmount}
              onChangeText={setSettleAmount}
              keyboardType="numeric"
              className="mb-3 border rounded-lg p-2"
            />
            <ThemedTextInput
              placeholder={t('Remarks')}
              value={settleRemarks}
              onChangeText={setSettleRemarks}
              className="mb-3 border rounded-lg p-2"
            />
            <TouchableOpacity
              onPress={() => setSettlementDatePickerVisible(true)}
              className="p-2 mb-4 bg-blue-600 rounded-md"
            >
              <ThemedText className="text-center">{t('SelectSettlementDate')}: {settlementDate.toLocaleDateString()}</ThemedText>
            </TouchableOpacity>

            {isSettlementDatePickerVisible && (
              <DateTimePicker
                mode="date"
                value={settlementDate}
                onChange={(event, date) => {
                  if (date) {
                    setSettlementDate(date);
                  }
                  setSettlementDatePickerVisible(false);
                }}
              />
            )}

            <TouchableOpacity
              onPress={() => {
                if (settlingGroup && parseFloat(settleAmount) > 0) {
                  settleUpGroup(settlingGroup, parseFloat(settleAmount), settleRemarks);
                  setSettleModalVisible(false);
                  setSettleAmount('');
                  setSettleRemarks('');
                  setSettlingGroup(null);
                  setSettlementDate(new Date());
                } else {
                  Alert.alert(t('InvalidInput'), t('EnterValidAmount'));
                }
              }}
              className="p-3 bg-green-500 rounded-md mb-2"
            >
              <ThemedText className="text-white text-center">{t('ConfirmSettlement')}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setSettleModalVisible(false);
                setSettleAmount('');
                setSettleRemarks('');
                setSettlingGroup(null);
                setSettlementDate(new Date());
              }}
              className="p-3 bg-red-500 rounded-md"
            >
              <ThemedText className="text-white text-center">{t('Cancel')}</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </KeyboardAvoidingView>
      </Modal>

      <FlatList
        data={groupedActivities.filter(group => 
          filterName === '' || group.name.toLowerCase().includes(filterName.toLowerCase())
        )}
        renderItem={renderGroupedActivity}
        keyExtractor={(item) => item.name}
      />
    </ThemedView>
  );
}

export default LandActivitiesTracker;

