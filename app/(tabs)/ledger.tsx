import React, { useState, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, Modal, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { databases, config, ID, Query } from '../appwrite';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { Entypo } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LoadingOverlay } from '@/components/landactivity/Loading';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface Transaction {
  $id?: string;
  type: 'given' | 'taken';
  name: string;
  amount: number;
  rateOfInterest: number;
  initialDate: Date;
  currentAmount: number;
  daysElapsed: number;
}

interface GroupedTransaction {
  name: string;
  totalGiven: number;
  totalTaken: number;
  transactions: Transaction[];
}

function LoanTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [groupedTransactions, setGroupedTransactions] = useState<GroupedTransaction[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [currentTransactionType, setCurrentTransactionType] = useState<'given' | 'taken'>('given');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [rateOfInterest, setRateOfInterest] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCalculationModalVisible, setCalculationModalVisible] = useState(false);
  const [calculationDate, setCalculationDate] = useState(new Date());
  const [calculatedAmount, setCalculatedAmount] = useState(0);

  const { t } = useTranslation();

  useEffect(() => {
    fetchTransactions();
    const dailyIntervalId = setInterval(calculateDailyInterest, 86400000); // Daily update
    return () => clearInterval(dailyIntervalId);
  }, []);

  useEffect(() => {
    groupTransactions();
  }, [transactions]);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage(t('Loading Transactions'));
      const response = await databases.listDocuments(
        config.databaseId, 
        config.loansCollectionId
      );
      const fetchedTransactions = response.documents.map(doc => ({
        $id: doc.$id,
        type: doc.type,
        name: doc.name,
        amount: doc.amount,
        rateOfInterest: doc.rateOfInterest,
        initialDate: new Date(doc.initialDate),
        currentAmount: doc.currentAmount,
        daysElapsed: doc.daysElapsed
      }));
      setTransactions(fetchedTransactions);
    } catch (error) {
      console.error('Error fetching transactions', error);
      Alert.alert(t('Error'), t('Failed To Fetch Transactions'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const groupTransactions = () => {
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
    setGroupedTransactions(grouped);
  };

  const calculateInterest = (transaction: Transaction, daysElapsed: number) => {
    const dailyInterestRate = transaction.rateOfInterest / 365;
    const interestAccrued = transaction.amount * (dailyInterestRate / 100) * daysElapsed;
    return transaction.amount + interestAccrued;
  };

  const calculateDailyInterest = async () => {
    const today = new Date();
    const updatedTransactions = transactions.map(transaction => {
      const daysElapsed = Math.floor((today.getTime() - transaction.initialDate.getTime()) / (1000 * 3600 * 24));
      const currentAmount = calculateInterest(transaction, daysElapsed);
      return {
        ...transaction,
        currentAmount: parseFloat(currentAmount.toFixed(2)),
        daysElapsed
      };
    });

    setTransactions(updatedTransactions);
    await updateTransactionsInDatabase(updatedTransactions);
  };

  const updateTransactionsInDatabase = async (updatedTransactions: Transaction[]) => {
    for (const transaction of updatedTransactions) {
      if (transaction.$id) {
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
    if (!name || !amount || !rateOfInterest) {
      Alert.alert(t('ValidationError'), t('Please Fill All Fields'));
      return;
    }

    try {
      setIsLoading(true);
      setLoadingMessage(isEditing ? t('UpdatingTransaction') : t('AddingTransaction'));

      const transactionData = {
        type: currentTransactionType,
        name,
        amount: parseFloat(amount),
        rateOfInterest: parseFloat(rateOfInterest),
        initialDate: selectedDate.toISOString(),
        currentAmount: parseFloat(amount),
        daysElapsed: 0
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
      console.error('Error saving transaction', error);
      Alert.alert(t('Error'), t('FailedToSaveTransaction'));
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

  const settleTransaction = async (transaction: Transaction) => {
    try {
      setIsLoading(true);
      setLoadingMessage(t('Settling Transaction'));
      const settledAmount = calculateInterest(transaction, transaction.daysElapsed);
      
      await databases.updateDocument(
        config.databaseId,
        config.loansCollectionId,
        transaction.$id!,
        {
          amount: 0,
          currentAmount: 0,
          daysElapsed: 0,
          initialDate: new Date().toISOString()
        }
      );
      
      await fetchTransactions();
      Alert.alert(t('TransactionSettled'), `${t('SettledAmount')}: ${settledAmount.toFixed(2)}`);
    } catch (error) {
      console.error('Error settling transaction', error);
      Alert.alert(t('Error'), t('FailedToSettleTransaction'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
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
      setCalculatedAmount(calculatedAmount);
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
  };

  const exportToCSV = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage(t('Exporting To CSV'));

      let csvContent = "Name,Type,Amount,Current Amount,Interest Rate,Initial Date,Days Elapsed\n";

      groupedTransactions.forEach(group => {
        group.transactions.forEach(transaction => {
          csvContent += `${group.name},${transaction.type},${transaction.amount},${transaction.currentAmount},${transaction.rateOfInterest},${transaction.initialDate},${transaction.daysElapsed}\n`;
        });
      });

      const fileName = `LedgerBookExport_${new Date().toISOString()}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath);
      } else {
        Alert.alert(t('Export Success'), t('CSVSavedTo') + filePath);
      }
    } catch (error) {
      console.error('Error exporting to CSV', error);
      Alert.alert(t('Error'), t('Failed To Export CSV'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const renderGroupedTransaction = ({ item }: { item: GroupedTransaction }) => (
    <ThemedView className="p-4 mb-4 rounded-lg bg-muted">
      <ThemedText className="text-xl font-bold">{item.name}</ThemedText>
      <ThemedText className="text-lg text-green-600">{t('TotalGiven')}: {item.totalGiven?item.totalGiven.toFixed(2):0.00}</ThemedText>
      <ThemedText className="text-lg text-red-600">{t('TotalTaken')}: {item.totalTaken?item.totalTaken.toFixed(2):0.00}</ThemedText>
      {item.transactions.map((transaction, index) => (
        <ThemedView key={transaction.$id} className={`mt-2 p-2 rounded ${transaction.type === 'given' ? 'bg-green-100' : 'bg-red-100'}`}>
          <ThemedText>{t('Type')}: {transaction.type === 'given' ? t('Given') : t('Taken')}</ThemedText>
          <ThemedText>{t('Amount')}: {transaction.amount}</ThemedText>
          <ThemedText>{t('CurrentAmount')}: {transaction.currentAmount.toFixed(2)}</ThemedText>
          <ThemedText>{t('InterestRate')}: {transaction.rateOfInterest}%</ThemedText>
          <ThemedText>{t('InitialDate')}: {transaction.initialDate.toLocaleDateString()}</ThemedText>
          <ThemedText>{t('DaysElapsed')}: {transaction.daysElapsed}</ThemedText>
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
                            <ThemedText className="text-red-600">{t('Delete')}</ThemedText>
                          </TouchableOpacity>
            <TouchableOpacity onPress={() => settleTransaction(transaction)} className="bg-green-500 p-2 rounded">
              <ThemedText className="text-white">{t('Settle')}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => calculateAmountForDate(transaction)} className="bg-yellow-500 p-2 rounded">
              <ThemedText className="text-white">{t('Calculate')}</ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      ))}
    </ThemedView>
  );

  return (
    <ThemedView className="flex-1 p-4">
      <View className="flex-row justify-between mb-4">
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

      <TouchableOpacity 
        onPress={exportToCSV} 
        className="bg-purple-500 p-4 rounded mb-4"
      >
        <ThemedText className="text-center text-white">{t('ExportToCSV')}</ThemedText>
      </TouchableOpacity>

      <FlatList
        data={groupedTransactions}
        renderItem={renderGroupedTransaction}
        keyExtractor={(item) => item.name}
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
              <ThemedTextInput
                placeholder={t('Name')}
                value={name}
                onChangeText={setName}
                className="mb-3 border rounded-lg p-2"
              />
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
              <TouchableOpacity onPress={addTransaction} className="bg-green-500 p-3 rounded-md mb-2">
                <ThemedText className="text-white text-center">
                  {isEditing ? t('UpdateTransaction') : t('AddTransaction')}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity onPress={resetForm} className="bg-red-500 p-3 rounded-md">
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
            <ThemedText className="text-xl font-bold mb-4">{t('CalculateAmount')}</ThemedText>
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

      {isLoading && <LoadingOverlay message={loadingMessage} />}
    </ThemedView>
  );
}

export default LoanTransactions;

