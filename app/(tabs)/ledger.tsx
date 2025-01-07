import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, Modal, Alert, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { Text, Button, Card, Title, Paragraph, TextInput, FAB, Portal, Dialog, ActivityIndicator, List, Divider } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { databases, config, ID, Query } from '../appwrite';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Picker } from '@react-native-picker/picker';
import { usePathname } from 'expo-router';

interface Transaction {
  $id?: string;
  type: 'given' | 'taken';
  name: string;
  amount: number;
  rateOfInterest: number;
  initialDate: Date;
  currentAmount: number;
  daysElapsed: number;
  transactionRemarks : string;
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
  const pathname = usePathname();
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
  const [transactionRemarks, setTransactionRemarks] = useState('');
  const [isSettleModalVisible, setIsSettleModalVisible] = useState(false);
  const [settlingTransaction, setSettlingTransaction] = useState<Transaction | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleRemarks, setSettleRemarks] = useState('');
  const [customName, setCustomName] = useState('');
  const [fabOpen, setFabOpen] = useState(false);

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
        transactionRemarks: doc.transactionRemarks,
        isSettled: doc.isSettled,
        settledDate: doc.settledDate ? new Date(doc.settledDate) : undefined,
        remarks: doc.remarks
      }));
      setTransactions(fetchedTransactions);
      const names = [...new Set(fetchedTransactions.map(t => t.name))];
      setExistingNames(names);
      groupTransactions(fetchedTransactions);
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
    setGroupedTransactions(grouped);
  };

  const calculateInterest = (transaction: Transaction, endDate: Date) => {
    const { years, months, days } = calculateElapsedTime(transaction.initialDate, endDate);
    const dailyInterestRate = (transaction.rateOfInterest) / 30;
    const monthlyInterestRate = transaction.rateOfInterest;
    const yearlyInterestRate = transaction.rateOfInterest * 12;

    const interestAccruedDays = transaction.amount * (dailyInterestRate / 100) * days;
    const interestAccruedMonths = transaction.amount * (monthlyInterestRate / 100) * months;
    const interestAccruedYears = transaction.amount * (yearlyInterestRate / 100) * years;

    return transaction.amount + interestAccruedDays + interestAccruedMonths + interestAccruedYears;
  };

  const calculateElapsedTime = (startDate: Date, endDate: Date) => {
    const isLeapYear = (year: number) =>
      (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

    const daysInMonth = (year: number, month: number) => {
      return new Date(year, month + 1, 0).getDate();
    };

    let years = endDate.getFullYear() - startDate.getFullYear();
    let months = endDate.getMonth() - startDate.getMonth();
    let days = endDate.getDate() - startDate.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonthDays = daysInMonth(
        endDate.getFullYear(),
        endDate.getMonth() - 1
      );
      days += prevMonthDays;
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    return { years, months, days };
  };

  const formatElapsedTime = (startDate: Date, endDate: Date) => {
    const { years, months, days } = calculateElapsedTime(startDate, endDate);
    return `${years > 0 ? `${years} ${t('years')} ` : ''}${months > 0 ? `${months} ${t('months')} ` : ''}${days} ${t('days')}`;
  };

  const calculateDailyInterest = useCallback(async () => {
    const today = new Date();
    const updatedTransactions = transactions.map(transaction => {
      if (!transaction.isSettled) {
        const currentAmount = calculateInterest(transaction, today);
        const { years, months, days } = calculateElapsedTime(transaction.initialDate, today);
        const totalDays = years * 365 + months * 30 + days;
        return {
          ...transaction,
          currentAmount: parseFloat(currentAmount.toFixed(2)),
          daysElapsed: totalDays
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
        name: nameToSave,
        amount: parseFloat(amount),
        rateOfInterest: parseFloat(rateOfInterest),
        initialDate: selectedDate.toISOString(),
        currentAmount: parseFloat(amount),
        daysElapsed: 0,
        transactionRemarks: transactionRemarks,
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
    setTransactionRemarks(transaction.transactionRemarks || '');
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
        `${t('TimeElapsed')}: ${formatElapsedTime(settlingTransaction.initialDate, new Date())}\n` +
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
      const { years, months, days } = calculateElapsedTime(editingTransaction.initialDate, calculationDate);
      const totalDays = years * 365 + months * 30 + days;
      const calculatedAmount = calculateInterest(editingTransaction, calculationDate);
      const interestAmount = calculatedAmount - editingTransaction.amount;
      setCalculatedAmount(calculatedAmount);
      Alert.alert(
        t('CalculationResult'),
        `${t('CalculatedAmount')}: ${calculatedAmount.toFixed(2)}\n` +
        `${t('InitialAmount')}: ${editingTransaction.amount.toFixed(2)}\n` +
        `${t('InterestAmount')}: ${interestAmount.toFixed(2)}\n` +
        `${t('TimeElapsed')}: ${formatElapsedTime(editingTransaction.initialDate, calculationDate)}`
      );
    }
  };

  const resetForm = () => {
    setName('');
    setAmount('');
    setRateOfInterest('');
    setSelectedDate(new Date());
    setTransactionRemarks('');
    setIsEditing(false);
    setEditingTransaction(null);
    setModalVisible(false);
    setRemarks('');
  };

  const exportToCSV = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage(t('Exporting To CSV'));

      let csvContent = "Name,Type,Amount,Current Amount,Interest Rate,Initial Date,Days Elapsed,Transaction Remarks,Is Settled,Settled Date,Settlement Remarks\n";

      groupedTransactions.forEach(group => {
        group.transactions.forEach(transaction => {
          csvContent += `${transaction.name},${transaction.type},${transaction.amount},${transaction.currentAmount},${transaction.rateOfInterest},${transaction.initialDate.toISOString()},${transaction.daysElapsed},${transaction.transactionRemarks},${transaction.isSettled},${transaction.settledDate ? transaction.settledDate.toISOString() : ''},${transaction.remarks || ''}\n`;
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

  const updateAllTransactions = async () => {
    setIsLoading(true);
    setLoadingMessage(t('UpdatingTransactions'));
    await calculateDailyInterest();
    await fetchTransactions();
    setIsLoading(false);
    setLoadingMessage('');
  };

  const renderGroupedTransaction = ({ item }: { item: GroupedTransaction }) => (
    <List.Accordion
      title={t(item.name)}
      description={(
          <View>
              <Text style={{ color: 'green' }}>{`${t('Total Given')}: ₹${item.totalGiven.toFixed(2)}`}</Text>
              <Text style={{ color: 'red' }}>{`${t('Total Taken')}: ₹${item.totalTaken.toFixed(2)}`}</Text>
          </View>
      )}
      style={{ backgroundColor: '#fff', marginBottom: 10 }}
    >
      <Card style={{ marginBottom: 16 }}>
        <Card.Content>
          <List.Accordion
            title={t('Active Transactions')}
            left={props => <List.Icon {...props} icon="cash" />}
            style={{ marginBottom: 2 }}
          >
            {item.transactions.filter(t => !t.isSettled).map((transaction, index) => (
              <Card key={index} style={{ marginTop: 8,marginBottom:8, backgroundColor: '#f9f9f9' }}>
                <Card.Content>
                  <Paragraph style={{ color: transaction.type === 'given' ? 'green' : 'red' }}>
                    {t('Type')}: {t(transaction.type)}
                  </Paragraph>
                  <Paragraph>{t('InitialAmount')}: ₹{transaction.amount}</Paragraph>
                  <Paragraph>{t('InterestAmount')}: ₹{(transaction.currentAmount - transaction.amount).toFixed(2)}</Paragraph>
                  <Paragraph>{t('CurrentAmount')}: ₹{transaction.currentAmount.toFixed(2)}</Paragraph>
                  <Paragraph>{t('InterestRate')}: ₹{transaction.rateOfInterest}</Paragraph>
                  <Paragraph>{t('InitialDate')}: {transaction.initialDate.toLocaleDateString()}</Paragraph>
                  <Paragraph>{t('DaysElapsed')}: {formatElapsedTime(transaction.initialDate, new Date())}</Paragraph>
                  <Paragraph>{t('Transaction Remarks')}: {transaction.transactionRemarks}</Paragraph>
                  <Paragraph>{t('Status')}: {t('Pending')}</Paragraph>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, flexWrap: 'wrap' }}>
                    <Button 
                      mode="contained" 
                      icon="pencil"
                      buttonColor="blue"
                      onPress={() => editTransaction(transaction)}
                      style={{ margin: 4 }}
                    >
                      {t('Edit')}
                    </Button>
                    <Button 
                      mode="contained" 
                      icon="cash-multiple"
                      buttonColor="green"
                      onPress={() => openSettleModal(transaction)}
                      style={{ margin: 4 }}
                    >
                      {t('Settle')}
                    </Button>
                    <Button 
                      mode="contained" 
                      icon="calculator"
                      buttonColor="orange"
                      onPress={() => calculateAmountForDate(transaction)}
                      style={{ margin: 4 }}
                    >
                      {t('Calculate')}
                    </Button>
                    <Button 
                      mode="contained" 
                      icon="delete"
                      buttonColor="red"
                      textColor="white"
                      onPress={() => {
                        Alert.alert(
                          t('Confirm Deletion'),
                          t('Are You Sure To Delete'),
                          [
                            { 
                              text: t('Cancel'), 
                              style: 'cancel',
                              onPress: () => console.log('Delete cancelled') 
                            },
                            { 
                              text: t('Delete'), 
                              style: 'destructive', 
                              onPress: () => deleteTransaction(transaction.$id!) 
                            }
                          ]
                        );
                      }}
                      style={{ margin: 4 }}
                    >
                      {t('Delete')}
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </List.Accordion>

          <List.Accordion
            title={t('Settled Transactions')}
            left={props => <List.Icon {...props} icon="check-circle" />}
            style={{ backgroundColor: 'lightgrey' }}
          >
            {item.transactions.filter(t => t.isSettled).map((transaction, index) => (
              <Card key={index} style={{ marginTop: 8, backgroundColor: '#e6e6e6' }}>
                <Card.Content>
                  <Paragraph style={{ color: transaction.type === 'given' ? 'green' : 'red' }}>
                    {t('Type')}: {t(transaction.type)}
                  </Paragraph>
                  <Paragraph>{t('InitialAmount')}: ₹{transaction.amount}</Paragraph>
                  <Paragraph>{t('SettledAmount')}: ₹{transaction.currentAmount.toFixed(2)}</Paragraph>
                  <Paragraph>{t('InterestRate')}: ₹{transaction.rateOfInterest}</Paragraph>
                  <Paragraph>{t('InitialDate')}: {transaction.initialDate.toLocaleDateString()}</Paragraph>
                  <Paragraph>{t('SettledDate')}: {transaction.settledDate?.toLocaleDateString()}</Paragraph>
                  <Paragraph>{t('TimeElapsed')}: {formatElapsedTime(transaction.initialDate, transaction.settledDate!)}</Paragraph>
                  <Paragraph>{t('Transaction Remarks')}: {transaction.transactionRemarks}</Paragraph>
                  <Paragraph>{t('Settlement Remarks')}: {transaction.remarks}</Paragraph>
                </Card.Content>
              </Card>
            ))}
          </List.Accordion>
        </Card.Content>
      </Card>
    </List.Accordion>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#f0f0f0' }}>
      <FlatList
        data={groupedTransactions}
        renderItem={renderGroupedTransaction}
        keyExtractor={(item) => item.name}
        ListHeaderComponent={() => (
          <View style={{ padding: 16 }}>
            <Card style={{ marginBottom: 12 }}>
              <Card.Content>
                <Title>{t('Transaction Summary')}</Title>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Button
                    mode="contained"
                    icon="update"
                    onPress={updateAllTransactions}
                  >
                    {t('Update All')}
                  </Button>
                  <Button
                    mode="contained"
                    icon="file-export"
                    onPress={exportToCSV}
                  >
                    {t('Export CSV')}
                  </Button>
                </View>
              </Card.Content>
            </Card>
          </View>
        )}
        ListEmptyComponent={() => (
          <Text style={{ textAlign: 'center', marginTop: 20 }}>{t('No transactions found')}</Text>
        )}
        contentContainerStyle={{ padding: 16 }}
      />

      {pathname === '/ledger' && (
        <Portal>
          <FAB.Group
            visible={true}
            open={fabOpen}
            icon={fabOpen ? 'close' : 'plus'}
            actions={[
              { icon: 'cash-plus', label: t('Add Given'), onPress: () => { setCurrentTransactionType('given'); setModalVisible(true); } },
              { icon: 'cash-minus', label: t('Add Taken'), onPress: () => { setCurrentTransactionType('taken'); setModalVisible(true); } },
            ]}
            onStateChange={({ open }) => setFabOpen(open)}
            onPress={() => {
              if (fabOpen) {
                // do something if the speed dial is open
              }
            }}
            style={{
              position: 'absolute',
              bottom: 80, // Adjust this value to move the FAB higher
              right: 0,
            }}
          />
        </Portal>
      )}

      <Portal>
        <Dialog visible={isModalVisible} onDismiss={() => setModalVisible(false)}>
          <Dialog.Title>{isEditing ? t('Edit Transaction') : t('Add New Transaction')}</Dialog.Title>
          <Dialog.Content>
            <View style={{ marginBottom: 16 }}>
              <Text>{t('Name')}</Text>
              <Picker
                selectedValue={t(name)}
                onValueChange={(itemValue) => {
                  setName(itemValue);
                  if (itemValue !== 'new') {
                    setCustomName('');
                  }
                }}
                style={{ backgroundColor: 'white' }}
              >
                <Picker.Item label={t('Select Name')} value="" />
                {existingNames.map((existingName, index) => (
                  <Picker.Item key={index} label={t(existingName)} value={existingName} />
                ))}
                <Picker.Item label={t('Enter New Name')} value="new" />
              </Picker>
              {name === 'new' && (
                <TextInput
                  label={t('Enter New Name')}
                  value={customName}
                  onChangeText={(text) => setCustomName(text)}
                  style={{ marginTop: 8 }}
                />
              )}
            </View>
            <TextInput
              label={t('Amount')}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              style={{ marginBottom: 16 }}
            />
            <TextInput
              label={t('InterestRate')}
              value={rateOfInterest}
              onChangeText={setRateOfInterest}
              keyboardType="numeric"
              style={{ marginBottom: 16 }}
            />
            <TextInput
              label={t('Transaction Remarks')}
              value={transactionRemarks}
              onChangeText={setTransactionRemarks}
              multiline
              numberOfLines={4}
              style={{ marginBottom: 16 }}
            />
            <Button
              mode="outlined"
              onPress={() => setDatePickerVisible(true)}
              style={{ marginBottom: 16 }}
            >
              {t('SelectDate')}: {selectedDate.toLocaleDateString()}
            </Button>
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
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setModalVisible(false)} style={{ marginRight: 8 }}>
              {t('Cancel')}
            </Button>
            <Button mode="contained" onPress={addTransaction}>
              {isEditing ? t('Update') : t('Add')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={isCalculationModalVisible} onDismiss={() => setCalculationModalVisible(false)}>
          <Dialog.Title>{t('Calculate Amount')}</Dialog.Title>
          <Dialog.Content>
            <Button
              mode="outlined"
              onPress={() => setDatePickerVisible(true)}
              style={{ marginBottom: 16 }}
            >
              {t('SelectDate')}: {calculationDate.toLocaleDateString()}
            </Button>
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
            {calculatedAmount > 0 && (
              <Paragraph style={{ marginTop: 16 }}>
                {t('CalculatedAmount')}: {calculatedAmount.toFixed(2)}
              </Paragraph>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCalculationModalVisible(false)} style={{ marginRight: 8 }}>
              {t('Close')}
            </Button>
            <Button mode="contained" onPress={performCalculation}>
              {t('Calculate')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={isSettleModalVisible} onDismiss={() => setIsSettleModalVisible(false)}>
          <Dialog.Title>{t('Settle Transaction')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label={t('Settle Amount')}
              value={settleAmount}
              onChangeText={setSettleAmount}
              keyboardType="numeric"
              style={{ marginBottom: 16 }}
            />
            <TextInput
              label={t('Remarks')}
              value={settleRemarks}
              onChangeText={setSettleRemarks}
              multiline
              numberOfLines={3}
              style={{ marginBottom: 16 }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsSettleModalVisible(false)} style={{ marginRight: 8 }}>
              {t('Cancel')}
            </Button>
            <Button mode="contained" onPress={settleTransaction}>
              {t('Settle')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={isLoading} dismissable={false}>
          <Dialog.Title>{loadingMessage}</Dialog.Title>
          <Dialog.Content>
            <ActivityIndicator animating={true} size="large" />
          </Dialog.Content>
        </Dialog>
      </Portal>
    </View>
  );
}

