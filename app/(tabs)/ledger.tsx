import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { databases, config, ID, Query } from '../appwrite';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { Collapsible } from '@/components/Collapsible';
import { Entypo } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LoadingOverlay } from '@/components/landactivity/Loading';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Picker } from '@react-native-picker/picker';

interface Transaction {
  $id?: string;
  type: 'given' | 'taken';
  name: string;
  amount: number;
  rateOfInterest: number;
  initialDate: Date;
  currentAmount: number;
  daysElapsed: number;
  isSettled: boolean;
  settledDate?: Date;
  remarks?: string;
}

interface GroupedTransaction {
  name: string;
  totalGiven: number;
  totalTaken: number;
  transactions: Transaction[];
}

export default function LoanTransactions() {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [groupedTransactions, setGroupedTransactions] = useState<GroupedTransaction[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [isCalculationModalVisible, setCalculationModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [rateOfInterest, setRateOfInterest] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calculationDate, setCalculationDate] = useState(new Date());
  const [calculatedAmount, setCalculatedAmount] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [currentTransactionType, setCurrentTransactionType] = useState<'given' | 'taken'>('given');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [remarks, setRemarks] = useState('');
  const [isSettleModalVisible, setIsSettleModalVisible] = useState(false);
  const [settlingTransaction, setSettlingTransaction] = useState<Transaction | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleRemarks, setSettleRemarks] = useState('');
  const [customName, setCustomName] = useState('');


  useEffect(() => {
    fetchTransactions();
    calculateDailyInterest();
  }, []);
  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage(t('FetchingTransactions'));
      const response = await databases.listDocuments(
        config.databaseId,
        config.loansCollectionId,
        [Query.orderDesc('$createdAt')]
      );
      const fetchedTransactions: Transaction[] = response.documents.map((doc: any) => ({
        $id: doc.$id,
        type: doc.type,
        name: doc.name,
        amount: doc.amount,
        rateOfInterest: doc.rateOfInterest,
        initialDate: new Date(doc.initialDate),
        currentAmount: doc.currentAmount,
        daysElapsed: doc.daysElapsed,
        isSettled: doc.isSettled,
        settledDate: doc.settledDate ? new Date(doc.settledDate) : undefined,
        remarks: doc.remarks
      }));
      setTransactions(fetchedTransactions);
      const names = [...new Set(fetchedTransactions.map(t => t.name))];
      setExistingNames(names);
      // console.log('Fetched transactions:', fetchedTransactions); // Debug log
      groupTransactions(fetchedTransactions); // Call groupTransactions with fetched data
    } catch (error) {
      console.error('Error fetching transactions', error);
      Alert.alert(t('Error'), t('Failed To Fetch Transactions'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const groupTransactions = (transactions: Transaction[]) => {
    const grouped = transactions.reduce((acc, transaction) => {
      const existingGroup = acc.find(group => group.name === transaction.name);
      if (existingGroup) {
        if (transaction.type === 'given') {
          existingGroup.totalGiven += transaction.currentAmount;
        } else {
          existingGroup.totalTaken += transaction.currentAmount;
        }
        existingGroup.transactions.push(transaction);
      } else {
        acc.push({
          name: transaction.name,
          totalGiven: transaction.type === 'given' ? transaction.currentAmount : 0,
          totalTaken: transaction.type === 'taken' ? transaction.currentAmount : 0,
          transactions: [transaction]
        });
      }
      return acc;
    }, [] as GroupedTransaction[]);
    // console.log('Grouped transactions:', grouped); // Debug log
    setGroupedTransactions(grouped);
  };

  const calculateInterest = (transaction: Transaction, daysElapsed: number) => {
    const years= Math.floor(daysElapsed / 365);
    const days= daysElapsed % 365;
    const dailyInterestRate = (transaction.rateOfInterest) / 30;
    const interestAccrued = transaction.amount * (dailyInterestRate / 100) * days;
    const dailyInterestRate1 = (transaction.rateOfInterest*12);
    const interestAccrued1 = transaction.amount * (dailyInterestRate1 / 100) * years;
    return transaction.amount + interestAccrued+interestAccrued1;
  };

  const formatElapsedTime = (days: number) => {
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    const remainingDays = days % 30;
    return `${years > 0 ? `${years} ${t('years')} ` : ''}${months > 0 ? `${months} ${t('months')} ` : ''}${remainingDays} ${t('days')}`;
  };

  const calculateDailyInterest = useCallback(async () => {
    const today = new Date();
    const updatedTransactions = transactions.map(transaction => {
      if (!transaction.isSettled) {
        const daysElapsed = Math.floor((today.getTime() - transaction.initialDate.getTime()) / (1000 * 3600 * 24));
        const currentAmount = calculateInterest(transaction, daysElapsed);
        return {
          ...transaction,
          currentAmount: parseFloat(currentAmount.toFixed(2)),
          daysElapsed
        };
      }
      return transaction;
    });

    setTransactions(updatedTransactions);
    await updateTransactionsInDatabase(updatedTransactions);
  }, [transactions]);


  const updateTransactionsInDatabase = async (updatedTransactions: Transaction[]) => {
    for (const transaction of updatedTransactions) {
      if (transaction.$id && !transaction.isSettled) {
        try {
          await databases.updateDocument(
            config.databaseId,
            config.loansCollectionId,
            transaction.$id,
            {
              currentAmount: transaction.currentAmount,
              daysElapsed: transaction.daysElapsed
            }
          );
        } catch (error) {
          console.error('Error updating transaction', error);
        }
      }
    }
  };

  const addTransaction = async () => {
    const nameToSave = name === 'new' ? customName : name;
    if ((!nameToSave) || !amount || !rateOfInterest) {
      Alert.alert(t('ValidationError'), t('Please Fill All Fields'));
      return;
    }

    try {
      setIsLoading(true);
      setLoadingMessage(isEditing ? t('UpdatingTransaction') : t('AddingTransaction'));

      const transactionData = {
        type: currentTransactionType,
        name: nameToSave, // Handle 'new' name case
        amount: parseFloat(amount),
        rateOfInterest: parseFloat(rateOfInterest),
        initialDate: selectedDate.toISOString(),
        currentAmount: parseFloat(amount),
        daysElapsed: 0,
        isSettled: false
      };

      if (isEditing && editingTransaction?.$id) {
        await databases.updateDocument(
          config.databaseId,
          config.loansCollectionId,
          editingTransaction.$id,
          transactionData
        );
      } else {
        await databases.createDocument(
          config.databaseId,
          config.loansCollectionId,
          ID.unique(),
          transactionData
        );
      }

      await fetchTransactions();
      resetForm();
    } catch (error) {
      console.error('Error adding/updating transaction', error);
      Alert.alert(t('Error'), t('Failed To Add/Update Transaction'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };
  const deleteTransaction = async (id: string) => {
    try {
      setIsLoading(true);
      setLoadingMessage(t('DeletingTransaction'));
      await databases.deleteDocument(
        config.databaseId,
        config.loansCollectionId,
        id
      );
      await fetchTransactions();
    } catch (error) {
      console.error('Error deleting transaction', error);
      Alert.alert(t('Error'), t('FailedToDeleteTransaction'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const editTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setCurrentTransactionType(transaction.type);
    setName(transaction.name);
    setAmount(transaction.amount.toString());
    setRateOfInterest(transaction.rateOfInterest.toString());
    setSelectedDate(transaction.initialDate);
    setIsEditing(true);
    setModalVisible(true);
  };
  const openSettleModal = (transaction: Transaction) => {
    setSettlingTransaction(transaction);
    setSettleAmount(transaction.currentAmount.toFixed(2));
    setSettleRemarks('');
    setIsSettleModalVisible(true);
  };
  const settleTransaction = async () => {
    if (!settlingTransaction) return;

    try {
      setIsLoading(true);
      setLoadingMessage(t('Settling Transaction'));

      const settledAmount = parseFloat(settleAmount);
      const settledDate = new Date();

      await databases.updateDocument(
        config.databaseId,
        config.loansCollectionId,
        settlingTransaction.$id!,
        {
          isSettled: true,
          currentAmount: settledAmount,
          settledDate: settledDate.toISOString(),
          remarks: settleRemarks
        }
      );

      // Update the total given/taken amount for the group
      setGroupedTransactions(prevGroups => 
        prevGroups.map(group => {
          if (group.name === settlingTransaction.name) {
            return {
              ...group,
              totalGiven: settlingTransaction.type === 'given' 
                ? group.totalGiven - settlingTransaction.currentAmount + settledAmount 
                : group.totalGiven,
              totalTaken: settlingTransaction.type === 'taken' 
                ? group.totalTaken - settlingTransaction.currentAmount + settledAmount 
                : group.totalTaken,
            };
          }
          return group;
        })
      );

      await fetchTransactions();
      setIsSettleModalVisible(false);
      Alert.alert(
        t('TransactionSettled'),
        `${t('SettledAmount')}: ${settledAmount.toFixed(2)}\n` +
        `${t('InitialAmount')}: ${settlingTransaction.amount.toFixed(2)}\n` +
        `${t('InterestAmount')}: ${(settledAmount - settlingTransaction.amount).toFixed(2)}\n` +
        `${t('TimeElapsed')}: ${formatElapsedTime(settlingTransaction.daysElapsed)}\n` +
        `${t('Remarks')}: ${settleRemarks}`
      );
    } catch (error) {
      console.error('Error settling transaction', error);
      Alert.alert(t('Error'), t('FailedToSettleTransaction'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
      setSettlingTransaction(null);
    }
  };

  const calculateAmountForDate = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setCalculationDate(new Date());
    setCalculationModalVisible(true);
  };

  const performCalculation = () => {
    if (editingTransaction) {
      const daysElapsed = Math.floor((calculationDate.getTime() - editingTransaction.initialDate.getTime()) / (1000 * 3600 * 24));
      const calculatedAmount = calculateInterest(editingTransaction, daysElapsed);
      const interestAmount = calculatedAmount - editingTransaction.amount;
      setCalculatedAmount(calculatedAmount);
      Alert.alert(
        t('CalculationResult'),
        `${t('CalculatedAmount')}: ${calculatedAmount.toFixed(2)}\n` +
        `${t('InitialAmount')}: ${editingTransaction.amount.toFixed(2)}\n` +
        `${t('InterestAmount')}: ${interestAmount.toFixed(2)}\n` +
        `${t('TimeElapsed')}: ${formatElapsedTime(daysElapsed)}`
      );
    }
  };

  const resetForm = () => {
    setName('');
    setAmount('');
    setRateOfInterest('');
    setSelectedDate(new Date());
    setIsEditing(false);
    setEditingTransaction(null);
    setModalVisible(false);
    setRemarks('');
  };

  const exportToCSV = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage(t('Exporting To CSV'));

      let csvContent = "Name,Type,Amount,Current Amount,Interest Rate,Initial Date,Days Elapsed,Is Settled,Settled Date,Remarks\n";

      groupedTransactions.forEach(group => {
        group.transactions.forEach(transaction => {
          csvContent += `${transaction.name},${transaction.type},${transaction.amount},${transaction.currentAmount},${transaction.rateOfInterest},${transaction.initialDate.toISOString()},${transaction.daysElapsed},${transaction.isSettled},${transaction.settledDate ? transaction.settledDate.toISOString() : ''},${transaction.remarks || ''}\n`;
        });
      });

      const fileName = `transactions_${new Date().toISOString()}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

      await Sharing.shareAsync(filePath, { dialogTitle: t('Export Transactions') });

    } catch (error) {
      console.error('Error exporting to CSV', error);
      Alert.alert(t('Error'), t('Failed To Export CSV'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const renderGroupedTransaction = ({ item }: { item: GroupedTransaction }) => (
    <Collapsible title={item.name}>
      <ThemedView className="mb-4 p-4 bg-card rounded-lg">
        <ThemedText className="text-xl font-bold">{item.name}</ThemedText>
        <ThemedText  style={{color: 'green'}}>{t('Total Given')}: ₹{item.totalGiven.toFixed(2)}</ThemedText>
        <ThemedText style={{color:'red'}}>{t('Total Taken')}: ₹{item.totalTaken.toFixed(2)}</ThemedText>

        <Collapsible title={t('Active Transactions')}>
          {item.transactions.filter(t => !t.isSettled).map((transaction, index) => (
            <ThemedView key={index} className="mt-2 p-2 bg-muted rounded">
              {/* Existing transaction details */}
              <ThemedText  style={{
                color: transaction.type === 'given' ? 'green' : 'red',
              }}>{t('Type')}: {transaction.type}</ThemedText>
              <ThemedText style={{
                color: transaction.type === 'given' ? 'green' : 'red',
              }}>{t('Amount')}: ₹{transaction.amount}</ThemedText>
              <ThemedText>{t('InterestAmount')}: ₹{(transaction.currentAmount-transaction.amount).toFixed(2)}</ThemedText>
              <ThemedText>{t('CurrentAmount')}: ₹{transaction.currentAmount.toFixed(2)}</ThemedText>
              <ThemedText>{t('InterestRate')}: ₹{transaction.rateOfInterest}</ThemedText>
              <ThemedText>{t('InitialDate')}: {transaction.initialDate.toLocaleDateString()}</ThemedText>
              <ThemedText>{t('DaysElapsed')}: {formatElapsedTime(transaction.daysElapsed)}</ThemedText>
              <ThemedText>{t('Status')}: {t('Pending')}</ThemedText>

              {/* Action buttons */}
              <View className="flex-row justify-between mt-2">
                <TouchableOpacity onPress={() => editTransaction(transaction)} className="bg-blue-500 p-2 rounded">
                  <ThemedText className="text-white">{t('Edit')}</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  className="bg-red-500 p-2 rounded"
                  onPress={() => {
                    Alert.alert(
                      t('Confirm Deletion'),
                      t('Are You Sure To Delete'),
                      [
                        { text: t('Cancel'), style: 'cancel' },
                        {
                          text: t('Delete'),
                          style: 'destructive',
                          onPress: () => {
                            deleteTransaction(transaction.$id!);
                          }
                        }
                      ]
                    );
                  }}
                >
                  <ThemedText className="text-white">{t('Delete')}</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openSettleModal(transaction)} className="bg-green-500 p-2 rounded">
                  <ThemedText className="text-white">{t('Settle')}</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => calculateAmountForDate(transaction)} className="bg-yellow-500 p-2 rounded">
                  <ThemedText className="text-white">{t('Calculate')}</ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          ))}
        </Collapsible>

        <Collapsible title={t('Settled Transactions')}>
          {item.transactions.filter(t => t.isSettled).map((transaction, index) => (
            <ThemedView key={index} className="mt-2 p-2 bg-muted rounded">
              <ThemedText  style={{
                color: transaction.type === 'given' ? 'green' : 'red',
              }}>{t('Type')}: {transaction.type}</ThemedText>
              <ThemedText>{t('InitialAmount')}: {transaction.amount}</ThemedText>
              <ThemedText>{t('SettledAmount')}: {transaction.currentAmount.toFixed(2)}</ThemedText>
              <ThemedText>{t('InterestRate')}: ₹{transaction.rateOfInterest}</ThemedText>
              <ThemedText>{t('InitialDate')}: {transaction.initialDate.toLocaleDateString()}</ThemedText>
              <ThemedText>{t('SettledDate')}: {transaction.settledDate?.toLocaleDateString()}</ThemedText>
              <ThemedText>{t('TimeElapsed')}: {formatElapsedTime(transaction.daysElapsed)}</ThemedText>
              <ThemedText>{t('Remarks')}: {transaction.remarks}</ThemedText>
            </ThemedView>
          ))}
        </Collapsible>
      </ThemedView>
    </Collapsible>
  );
  const updateAllTransactions = async () => {
    setIsLoading(true);
    setLoadingMessage(t('UpdatingTransactions'));
    await calculateDailyInterest();
    await fetchTransactions();
    setIsLoading(false);
    setLoadingMessage('');
  };
  return (
    <ThemedView className="flex-1 p-4">
      <View className="flex-row justify-between mb-3">
        <TouchableOpacity
          onPress={() => {
            setCurrentTransactionType('given');
            setModalVisible(true);
          }}
          className="bg-green-500 p-4 rounded flex-1 mr-2"
        >
          <ThemedText className="text-center text-white">{t('Add Given')}</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setCurrentTransactionType('taken');
            setModalVisible(true);
          }}
          className="bg-red-300 p-4 rounded flex-1 ml-2"
        >
          <ThemedText className="text-center text-white">{t('Add Taken')}</ThemedText>
        </TouchableOpacity>
      </View>

 <View style={{ marginVertical: 10 }}>
  {/* <View
    style={{
      backgroundColor: '#FFEFD5',
      padding: 10,
      borderRadius: 10,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
    }}
  >
    <Image
      source={require('../../assets/images/Booklogo.png')} // Add a reminder icon in your assets folder
      style={{ width: 20, height: 20, marginRight: 10 }}
    />
    <Text style={{ color: '#8B0000', fontSize: 14, fontWeight: 'bold' }}>
      Don’t forget to update transactions daily to keep data accurate!
    </Text>
  </View>  */}

  {/* Buttons in a Row */}
  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
    {/* Update All Transactions Button */}
    <TouchableOpacity
      // onPress={() => {
      //   Alert.alert(
      //     'Update Transactions',
      //     'Updating transactions will refresh the days elapsed for each loan. Are you sure you want to proceed?',
      //     [
      //       { text: 'Cancel', style: 'cancel' },
      //       { text: 'Update', onPress: updateAllTransactions },
      //     ]
      //   );
      // }}
      onPress={updateAllTransactions}
      style={{
        flex: 1,
        backgroundColor: '#1E90FF',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 10,
        marginRight: 10,
        alignItems: 'center',
        flexDirection: 'row',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
      }}
    >
      <Image
        source={require('../../assets/images/update.jpg')} // Add an update icon in your assets folder
        style={{ width: 30, height: 30, marginRight: 8 }}
      />
      <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
        {t('Update All')}
      </Text>
    </TouchableOpacity>

    {/* Export to CSV Button */}
    <TouchableOpacity
      onPress={exportToCSV}
      style={{
        flex: 1,
        backgroundColor: '#6A0DAD',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 10,
        marginLeft: 10,
        alignItems: 'center',
        flexDirection: 'row',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
      }}
    >
      <Image
        source={require('../../assets/images/exportcsv.png')} // Add an export icon in your assets folder
        style={{ width: 30, height: 30, marginRight: 8 }}
      />
      <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
        {t('Export CSV')}
      </Text>
    </TouchableOpacity>
  </View>
</View>
      {/* <ThemedText>Debug: {groupedTransactions.length} grouped transactions</ThemedText> */}

      <FlatList
        data={groupedTransactions}
        renderItem={renderGroupedTransaction}
        keyExtractor={(item) => item.name}
        ListEmptyComponent={() => (
          <ThemedText className="text-center mt-4">{t('No transactions found')}</ThemedText>
        )}
      />

      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-center"
        >
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <ThemedView className="bg-background m-4 p-4 rounded-lg">
              <ThemedText className="text-xl font-bold mb-4">
                {isEditing ? t('Edit Transaction') : t('Add New Transaction')}
              </ThemedText>
              <View className="mb-3">
                <ThemedText className="mb-1">{t('Name')}</ThemedText>
                <View className="flex-row">
                  <View className="flex-1 mr-2">
                    <Picker
                      selectedValue={name}
                      onValueChange={(itemValue) => {
                        setName(itemValue);
                        if (itemValue !== 'new') {
                          setCustomName(''); // Reset custom input when a predefined name is selected
                        }
                      }}
                      style={{ backgroundColor: 'white', color: 'black' }}
                    >
                      <Picker.Item label={t('Select Name')} value="" />
                      {existingNames.map((existingName, index) => (
                        <Picker.Item key={index} label={existingName} value={existingName} />
                      ))}
                      <Picker.Item label={t('Enter New Name')} value="new" />
                    </Picker>
                  </View>
                  {name === 'new' && (
                    <View className="flex-1 ml-2">
                      <ThemedTextInput
                        placeholder={t('Enter New Name')}
                        value={customName}
                        onChangeText={(text) => setCustomName(text)} 
                        className="border rounded-lg p-2"
                      />
                    </View>
                  )}
                </View>
              </View>
              <ThemedTextInput
                placeholder={t('Amount')}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                className="mb-3 border rounded-lg p-2"
              />
              <ThemedTextInput
                placeholder={t('InterestRate')}
                value={rateOfInterest}
                onChangeText={setRateOfInterest}
                keyboardType="numeric"
                className="mb-3 border rounded-lg p-2"
              />
              <TouchableOpacity
                onPress={() => setDatePickerVisible(true)}
                className="p-2 mb-4 bg-blue-600 rounded-md"
              >
                <ThemedText className="text-center">
                  {t('SelectDate')}: {selectedDate.toLocaleDateString()}
                </ThemedText>
              </TouchableOpacity>
              {isDatePickerVisible && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setDatePickerVisible(false);
                    if (date) setSelectedDate(date);
                  }}
                />
              )}
              <TouchableOpacity onPress={addTransaction} className="bg-green-500 p-3 rounded-md">
                <ThemedText className="text-white text-center">
                  {isEditing ? t('Update') : t('Add')}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity onPress={resetForm} className="bg-red-500 p-3 rounded-md mt-2">
                <ThemedText className="text-white text-center">{t('Cancel')}</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={isCalculationModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-center"
        >
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <ThemedView className="bg-background m-4 p-4 rounded-lg">
              <ThemedText className="text-xl font-bold mb-4">{t('Calculate Amount')}</ThemedText>
              <TouchableOpacity
                onPress={() => setDatePickerVisible(true)}
                className="p-2 mb-4 bg-blue-600 rounded-md"
              >
                <ThemedText className="text-center">
                  {t('SelectDate')}: {calculationDate.toLocaleDateString()}
                </ThemedText>
              </TouchableOpacity>
              {isDatePickerVisible && (
                <DateTimePicker
                  value={calculationDate}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setDatePickerVisible(false);
                    if (date) setCalculationDate(date);
                  }}
                />
              )}
              <TouchableOpacity onPress={performCalculation} className="bg-green-500 p-3 rounded-md mb-2">
                <ThemedText className="text-white text-center">{t('Calculate')}</ThemedText>
              </TouchableOpacity>
              {calculatedAmount > 0 && (
                <ThemedText className="text-lg mt-4">
                  {t('CalculatedAmount')}: {calculatedAmount.toFixed(2)}
                </ThemedText>
              )}
              <TouchableOpacity
                onPress={() => {
                  setCalculationModalVisible(false);
                  setCalculatedAmount(0);
                }}
                className="bg-red-500 p-3 rounded-md mt-4"
              >
                <ThemedText className="text-white text-center">{t('Close')}</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={isSettleModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-center"
        >
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <ThemedView className="bg-background m-4 p-4 rounded-lg">
              <ThemedText className="text-xl font-bold mb-4">{t('Settle Transaction')}</ThemedText>
              <ThemedTextInput
                placeholder={t('Settle Amount')}
                value={settleAmount}
                onChangeText={setSettleAmount}
                keyboardType="numeric"
                className="mb-3 border rounded-lg p-2"
              />
              <ThemedTextInput
                placeholder={t('Remarks')}
                value={settleRemarks}
                onChangeText={setSettleRemarks}
                multiline
                numberOfLines={3}
                className="mb-3 border rounded-lg p-2"
              />
              <TouchableOpacity onPress={settleTransaction} className="bg-green-500 p-3 rounded-md">
                <ThemedText className="text-white text-center">{t('Settle')}</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setIsSettleModalVisible(false)} 
                className="bg-red-500 p-3 rounded-md mt-2"
              >
                <ThemedText className="text-white text-center">{t('Cancel')}</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {isLoading && (<LoadingOverlay message={loadingMessage} />)}
    </ThemedView>
  );
}


