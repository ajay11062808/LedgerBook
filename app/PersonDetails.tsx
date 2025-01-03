import React, { act, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert, Modal, Switch } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Text, Chip, TextInput, Button } from 'react-native-paper';
import { ThemedView} from '@/components/ThemedView';
import {ThemedText } from '@/components/ThemedText';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { databases, config, ID } from '../app/appwrite';
import { LoadingOverlay } from '@/components/landactivity/Loading';
import { Picker } from '@react-native-picker/picker';

interface LandActivity {
  $id: string;
  name: string;
  landName: string;
  activity: string;
  date: string;
  landInAcres: number;
  amountPerAcre: number;
  totalAmount: number;
}

interface Settlement {
  date: string;
  amount: number;
  remarks: string;
}

export default function PersonDetails() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams();
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [isSettleModalVisible, setSettleModalVisible] = useState(false);
  const [isAddActivityModalVisible, setAddActivityModalVisible] = useState(false);
  const [editingActivity, setEditingActivity] = useState<any>(null);
  
  // Form states for new activity
  const [name, setName] = useState(params.name as string);
  const [landName, setLandName] = useState('');
  const [activity, setActivity] = useState('');
  const [customActivity, setCustomActivity] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [landInAcres, setLandInAcres] = useState('');
  const [amountPerAcre, setAmountPerAcre] = useState('');
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  
  // Settlement states
  const [settleAmount, setSettleAmount] = useState('');
  const [settleRemarks, setSettleRemarks] = useState('');
  const [settlementDate, setSettlementDate] = useState(new Date());
  const [isSettlementDatePickerVisible, setSettlementDatePickerVisible] = useState(false);

  const activities = JSON.parse(params.activities as string) as LandActivity[];
  const settlements = JSON.parse(params.settlements as string) as Settlement[];
  const totalAmount = Number(params.totalAmount);
  const settledAmount = Number(params.settledAmount);
  const isSettled = params.isSettled === 'true'; // Parse string to boolean

  const existingActivities = [
    t("Gorru"),
    t("Balam Mandhu"),
    t("Vithanalu"),
    t("Nagali"),
    t("Matti tolakam")
  ];

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'te' : 'en';
    i18n.changeLanguage(newLang);
  };

  const convertAcresToDisplay = (acres: number) => {
    const wholeAcres = Math.floor(acres);
    const cents = Math.round((acres - wholeAcres) * 100);
    
    if (wholeAcres === 0) {
      return `${cents} ${t('cents')}`;
    } else if (cents === 0) {
      return `${wholeAcres} ${wholeAcres > 1 ? t('acres') : t('acre')}`;
    } else {
      return `${wholeAcres} ${wholeAcres > 1 ? t('acres') : t('acre')} ${cents} ${t('cents')}`;
    }
  };

  const handleEditActivity = async (updatedActivity: any) => {
    try {
      setIsLoading(true);
      setLoadingMessage(t('Updating Activity'));
      // Find the original activity to get its previous totalAmount
      const originalActivity = activities.find((a: any) => a.$id === updatedActivity.$id);
      const previousAmount = originalActivity ? originalActivity.totalAmount : 0;
      const activityToSave = {
        ...updatedActivity,
        landInAcres: parseFloat(updatedActivity.landInAcres), // Convert to float
        amountPerAcre: parseInt(updatedActivity.amountPerAcre, 10),
      };
      await databases.updateDocument(
        config.databaseId,
        config.landActivitiesCollectionId,
        updatedActivity.$id,
        activityToSave
      );
      
      const newTotalAmount = totalAmount - previousAmount + updatedActivity.totalAmount;
      const newIsSettled = settledAmount >= newTotalAmount;
      if (params.groupSettlementId) {
       

        await databases.updateDocument(
          config.databaseId,
          config.groupSettlementsCollectionId,
          params.groupSettlementId as string,
          {
            totalAmount: newTotalAmount,
            isSettled: newIsSettled
          }
        );
      } else {
        await databases.createDocument(
          config.databaseId,
          config.groupSettlementsCollectionId,
          ID.unique(),
          {
            groupName: name,
            totalAmount: newTotalAmount,
            settledAmount: 0,
            isSettled: false,
            settlements: [],
            settlementDates: [],
            settlementAmounts: [],
            settlementRemarks: []
          }
        );
      }
      
     
      Alert.alert(t('Success'), t('Activity Updated'));
      router.replace({
        pathname: "/PersonDetails",
        params: {
          ...params,
          activities: JSON.stringify(
            activities.map((a: any) => 
              a.$id === updatedActivity.$id ? updatedActivity : a
            )
          ),
          totalAmount: newTotalAmount.toString(), // Convert to string
          isSettled: newIsSettled.toString(), // Convert boolean to string
        }
      });
    } catch (error) {
      console.error('Error updating activity:', error);
      Alert.alert(t('Error'), t('Failed to update activity'));
    } finally {
      setIsLoading(false);
      setEditModalVisible(false);
    }
    
  };

  const handleDeleteActivity = async (activityId: string) => {
    try {
      setIsLoading(true);
      setLoadingMessage(t('Deleting Activity'));
      
      await databases.deleteDocument(
        config.databaseId,
        config.landActivitiesCollectionId,
        activityId
      );
      
      Alert.alert(t('Success'), t('Activity Deleted'));
      router.replace({
        pathname: "/PersonDetails",
        params: {
          ...params,
          activities: JSON.stringify(
            activities.filter((a: any) => a.$id !== activityId)
          )
        }
      });
    } catch (error) {
      console.error('Error deleting activity:', error);
      Alert.alert(t('Error'), t('Failed to delete activity'));
    } finally {
      setIsLoading(false);
    }
  };
  const handleAddActivity = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage(t('Adding Activity'));
      
      const activityToSave = {
        name,
        landName,
        activity: activity === 'custom' ? customActivity : activity,
        date: selectedDate.toISOString(),
        landInAcres: parseFloat(landInAcres),
        amountPerAcre: parseFloat(amountPerAcre),
        totalAmount: parseFloat(landInAcres) * parseFloat(amountPerAcre)
      };
      
      const response = await databases.createDocument(
        config.databaseId,
        config.landActivitiesCollectionId,
        ID.unique(),
        activityToSave
      );
  
      const newTotalAmount = totalAmount + activityToSave.totalAmount;
      const newIsSettled = settledAmount >= newTotalAmount;
  
      if (params.groupSettlementId) {
        await databases.updateDocument(
          config.databaseId,
          config.groupSettlementsCollectionId,
          params.groupSettlementId as string,
          {
            totalAmount: newTotalAmount,
            isSettled: newIsSettled
          }
        );
      } else {
        await databases.createDocument(
          config.databaseId,
          config.groupSettlementsCollectionId,
          ID.unique(),
          {
            groupName: name,
            totalAmount: newTotalAmount,
            settledAmount: 0,
            isSettled: false,
            settlements: [],
            settlementDates: [],
            settlementAmounts: [],
            settlementRemarks: []
          }
        );
      }
      
      Alert.alert(t('Success'), t('Activity Added'));
      router.replace({
        pathname: "/PersonDetails",
        params: {
          ...params,
          activities: JSON.stringify([...activities, response]),
          totalAmount: newTotalAmount.toString(), // Convert to string
          isSettled: newIsSettled.toString(), // Convert boolean to string
        }
      });
    } catch (error) {
      console.error('Error adding activity:', error);
      Alert.alert(t('Error'), t('Failed to add activity'));
    } finally {
      setIsLoading(false);
      setAddActivityModalVisible(false);
    }
  };

  const handleSettle = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage(t('Processing Settlement'));
    
      const newSettlement = {
        date: settlementDate.toISOString(),
        amount: parseFloat(settleAmount),
        remarks: settleRemarks
      };
    
      const updatedSettlements = [...settlements, newSettlement];
      const newSettledAmount = settledAmount + parseFloat(settleAmount);
      const newIsSettled = newSettledAmount >= totalAmount;
    
      if (!params.groupSettlementId) {
        throw new Error('Group settlement ID not found');
      }
  
      await databases.updateDocument(
        config.databaseId,
        config.groupSettlementsCollectionId,
        params.groupSettlementId as string,
        {
          settledAmount: newSettledAmount,
          isSettled: newIsSettled,
          settlementDates: [...(settlements.map(s => s.date)), newSettlement.date],
          settlementAmounts: [...(settlements.map(s => s.amount)), newSettlement.amount],
          settlementRemarks: [...(settlements.map(s => s.remarks)), newSettlement.remarks]
        }
      );
    
      Alert.alert(t('Success'), t('Settlement Added'));
      router.replace({
        pathname: "/PersonDetails",
        params: {
          ...params,
          settlements: JSON.stringify(updatedSettlements),
          settledAmount: newSettledAmount.toString(), // Convert to string
          isSettled: newIsSettled.toString(), // Convert boolean to string
        }
      });
    } catch (error) {
      console.error('Error processing settlement:', error);
      Alert.alert(t('Error'), t('Failed to process settlement'));
    } finally {
      setIsLoading(false);
      setSettleModalVisible(false);
    }
  };
  const handleInputChange = (key: string, value: string) => {
    setEditingActivity((prev: any) => {
        // Keep the raw input as a string temporarily
        const updatedActivity = { ...prev, [key]: value };
    
        // Recalculate totalAmount only when valid numbers are provided
        const landInAcres = parseFloat(updatedActivity.landInAcres);
        const amountPerAcre = parseInt(updatedActivity.amountPerAcre, 10);
    
        if (!isNaN(landInAcres) && !isNaN(amountPerAcre)) {
          updatedActivity.totalAmount = landInAcres * amountPerAcre;
        }
    
        return updatedActivity;
      });

  };
  return (
    <ThemedView className='flex-2 padding-4'>
      <ScrollView>
        <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10,marginTop: 14, justifyContent: 'flex-end' }}>
              <ThemedText style={{ marginRight: 8 }}>తెలుగు</ThemedText>
              <Switch
                value={i18n.language === 'en' ? false : true}
                onValueChange={toggleLanguage}
                trackColor={{ false: "#767577", true: "#81b0ff" }}
                thumbColor={i18n.language === 'en'? "#f5dd4b" : "#f4f3f4"}
              />
            </ThemedView>
        
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="headlineMedium" style={styles.name}>{name}</Text>
            <View style={styles.row}>
              <Text variant="bodyMedium">{t('Total Amount')}:</Text>
              <Text variant="bodyMedium" style={styles.value}>₹{totalAmount}</Text>
            </View>
            <View style={styles.row}>
              <Text variant="bodyMedium">{t('Settled Amount')}:</Text>
              <Text variant="bodyMedium" style={styles.value}>₹{settledAmount}</Text>
            </View>
            <View style={styles.row}>
              <Text variant="bodyMedium">{t('Remaining Amount')}:</Text>
              <Text variant="bodyMedium" style={styles.value}>₹{totalAmount-settledAmount}</Text>
            </View>
            <View style={styles.row}>
              <Text variant="bodyMedium">{t('Status')}:</Text>
              <Chip mode="flat" style={isSettled ? styles.settledChip : styles.unsettledChip}>
                {isSettled ? t('Settled') : t('Not Settled')}
              </Chip>
            </View>
            
            {!isSettled && (
              <Button 
                mode="contained" 
                onPress={() => setSettleModalVisible(true)}
                style={styles.button}
              >
                {t('Settle Up')}
              </Button>
            )}
            
            <Button 
              mode="contained" 
              onPress={() => setAddActivityModalVisible(true)}
              style={styles.button}
            >
              {t('Add Activity')}
            </Button>
          </Card.Content>
        </Card>

        <Text variant="titleLarge" style={styles.sectionTitle}>{t('Activities')}</Text>
        {activities.map((activity: any, index: number) => (
          <Card key={index} style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.activityTitle}>{t(activity.landName)}</Text>
              <View style={styles.row}>
                <Text variant="bodyMedium">{t('Activity')}:</Text>
                <Text variant="bodyMedium" style={styles.value}>{t(activity.activity)}</Text>
              </View>
              <View style={styles.row}>
                <Text variant="bodyMedium">{t('Date')}:</Text>
                <Text variant="bodyMedium" style={styles.value}>
                  {new Date(activity.date).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.row}>
                <Text variant="bodyMedium">{t('Land Size')}:</Text>
                <Text variant="bodyMedium" style={styles.value}>
                  {convertAcresToDisplay(activity.landInAcres)}
                </Text>
              </View>
              <View style={styles.row}>
                <Text variant="bodyMedium">{t('Amount Per Acre')}:</Text>
                <Text variant="bodyMedium" style={styles.value}>₹{activity.amountPerAcre}</Text>
              </View>
              <View style={styles.row}>
                <Text variant="bodyMedium">{t('Total Amount')}:</Text>
                <Text variant="bodyMedium" style={styles.value}>₹{activity.totalAmount}</Text>
              </View>
              
              <View style={styles.buttonContainer}>
                <Button 
                  mode="contained"
                  onPress={() => {
                    setEditingActivity(activity);
                    setEditModalVisible(true);
                  }}
                  style={styles.actionButton}
                >
                  {t('Edit')}
                </Button>
                <Button 
                  mode="contained"
                  onPress={() => {
                    Alert.alert(
                      t('Confirm Deletion'),
                      t('Are you sure you want to delete this activity?'),
                      [
                        { text: t('Cancel'), style: 'cancel' },
                        { 
                          text: t('Delete'),
                          onPress: () => handleDeleteActivity(activity.$id),
                          style: 'destructive'
                        }
                      ]
                    );
                  }}
                  style={[styles.actionButton, styles.deleteButton]}
                >
                  {t('Delete')}
                </Button>
              </View>
            </Card.Content>
          </Card>
        ))}

        <Text variant="titleLarge" style={styles.sectionTitle}>{t('Settlement History')}</Text>
        {settlements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((settlement, index) => (
          <Card key={index} style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <Text variant="bodyMedium">{t('Date')}:</Text>
                <Text variant="bodyMedium" style={styles.value}>
                  {new Date(settlement.date).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.row}>
                <Text variant="bodyMedium">{t('Amount')}:</Text>
                <Text variant="bodyMedium" style={styles.value}>₹{settlement.amount}</Text>
              </View>
              <View style={styles.row}>
                <Text variant="bodyMedium">{t('Remarks')}:</Text>
                <Text variant="bodyMedium" style={styles.value}>{settlement.remarks}</Text>
              </View>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>

      {/* Edit Activity Modal */}
      <Modal
        visible={isEditModalVisible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <Card style={styles.modalCard}>
            <Card.Content>
              <Text variant="titleLarge">{t('Edit Activity')}</Text>
              <TextInput
                label={t('Land Name')}
                value={editingActivity?.landName}
                onChangeText={(text) => setEditingActivity({...editingActivity, landName: text})}
                style={styles.input}
              />
              <Picker
                selectedValue={editingActivity?.activity}
                onValueChange={(value) => setEditingActivity({...editingActivity, activity: value})}
              >
                {existingActivities.map((act, index) => (
                  <Picker.Item key={index} label={act} value={act} />
                ))}
                <Picker.Item label={t('Custom')} value="custom" />
              </Picker>
              {editingActivity?.activity === 'custom' && (
                <TextInput
                  label={t('Custom Activity')}
                  value={customActivity}
                  onChangeText={setCustomActivity}
                  style={styles.input}
                />
              )}
              <TextInput
                label={t('Land Size (Acres)')}
                value={String(editingActivity?.landInAcres||'')}
                onChangeText={(text) => handleInputChange('landInAcres', text)}
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                label={t('Amount Per Acre')}
                value={String(editingActivity?.amountPerAcre|| '')}
                onChangeText={(text) => handleInputChange('amountPerAcre', text)}
                keyboardType="numeric"
                style={styles.input}
              />
              <View style={styles.modalButtons}>
                <Button onPress={() => setEditModalVisible(false)}>
                  {t('Cancel')}
                </Button>
                <Button onPress={() => handleEditActivity(editingActivity)}>
                  {t('Save')}
                </Button>
              </View>
            </Card.Content>
          </Card>
        </View>
      </Modal>

      {/* Add Activity Modal */}
      <Modal
        visible={isAddActivityModalVisible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <Card style={styles.modalCard}>
            <Card.Content>
              <Text variant="titleLarge">{t('Add Activity')}</Text>
              <TextInput
                label={t('Land Name')}
                value={landName}
                onChangeText={setLandName}
                style={styles.input}
              />
              <Picker
                selectedValue={activity}
                onValueChange={setActivity}
              >
                {existingActivities.map((act, index) => (
                  <Picker.Item key={index} label={act} value={act} />
                ))}
                <Picker.Item label={t('Custom')} value="custom" />
              </Picker>
              {activity === 'custom' && (
                <TextInput
                  label={t('Custom Activity')}
                  value={customActivity}
                  onChangeText={setCustomActivity}
                  style={styles.input}
                />
              )}
              <TouchableOpacity onPress={() => setDatePickerVisible(true)}>
                <TextInput
                  label={t('Date')}
                  value={selectedDate.toLocaleDateString()}
                  editable={false}
                  style={styles.input}
                />
              </TouchableOpacity>
              {isDatePickerVisible && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  onChange={(event, date) => {
                    setDatePickerVisible(false);
                    if (date) setSelectedDate(date);
                  }}
                />
              )}
              <TextInput
                label={t('Land Size (Acres)')}
                value={landInAcres}
                onChangeText={setLandInAcres}
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                label={t('Amount Per Acre')}
                value={amountPerAcre}
                onChangeText={setAmountPerAcre}
                keyboardType="numeric"
                style={styles.input}
              />
              <View style={styles.modalButtons}>
                <Button onPress={() => setAddActivityModalVisible(false)}>
                  {t('Cancel')}
                </Button>
                <Button onPress={handleAddActivity}>
                  {t('Add')}
                </Button>
              </View>
            </Card.Content>
          </Card>
        </View>
      </Modal>

      {/* Settlement Modal */}
      <Modal
        visible={isSettleModalVisible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <Card style={styles.modalCard}>
            <Card.Content>
              <Text variant="titleLarge">{t('Settle Up')}</Text>
              <TouchableOpacity onPress={() => setSettlementDatePickerVisible(true)}>
                <TextInput
                  label={t('Date')}
                  value={settlementDate.toLocaleDateString()}
                  editable={false}
                  style={styles.input}
                />
              </TouchableOpacity>
              {isSettlementDatePickerVisible && (
                <DateTimePicker
                  value={settlementDate}
                  mode="date"
                  onChange={(event, date) => {
                    setSettlementDatePickerVisible(false);
                    if (date) setSettlementDate(date);
                  }}
                />
              )}
              <TextInput
                label={t('Amount')}
                value={settleAmount}
                onChangeText={setSettleAmount}
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                label={t('Remarks')}
                value={settleRemarks}
                onChangeText={setSettleRemarks}
                style={styles.input}
              />
              <View style={styles.modalButtons}>
                <Button onPress={() => setSettleModalVisible(false)}>
                  {t('Cancel')}
                </Button>
                <Button onPress={handleSettle}>
                  {t('Settle')}
                </Button>
              </View>
            </Card.Content>
          </Card>
        </View>
      </Modal>

      {isLoading && <LoadingOverlay message={loadingMessage} />}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
  },
  name: {
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  value: {
    fontWeight: 'bold',
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
  },
  activityTitle: {
    marginBottom: 8,
  },
  settledChip: {
    backgroundColor: '#9c8686',
  },
  unsettledChip: {
    backgroundColor: '#86e33e',
  },
  button: {
    marginTop: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: '#ff4444',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 16,
  },
  modalCard: {
    maxHeight: '80%',
  },
  input: {
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
});



