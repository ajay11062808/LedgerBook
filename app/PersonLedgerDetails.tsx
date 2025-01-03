import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert, Modal, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Text, Chip, TextInput, Button } from 'react-native-paper';
import { ThemedView } from '@/components/ThemedView';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { databases, config, ID } from './appwrite';
import { LoadingOverlay } from '@/components/landactivity/Loading';

interface Transaction {
  $id: string;
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

export default function PersonLedgerDetails() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams();
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [isSettleModalVisible, setSettleModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  // Form states for new transaction
  const [name] = useState(params.name as string);
  const [amount, setAmount] = useState('');
  const [rateOfInterest, setRateOfInterest] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [transactionType, setTransactionType] = useState<'given' | 'taken'>('given');
  const [remarks, setRemarks] = useState('');
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  
  // Settlement states
  const [settleAmount, setSettleAmount] = useState('');
  const [settleRemarks, setSettleRemarks] = useState('');
  const [settlingTransaction, setSettlingTransaction] = useState<Transaction | null>(null);

  const transactions = JSON.parse(params.transactions as string) as Transaction[];
  const totalGiven = Number(params.totalGiven);
  const totalTaken = Number(params.totalTaken);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'te' : 'en';
    i18n.changeLanguage(newLang);
  };

  const calculateCurrentAmount = (transaction: Transaction) => {
    const currentDate = new Date();
    const initialDate = new Date(transaction.initialDate);
    const daysElapsed = Math.floor((currentDate.getTime() - initialDate.getTime()) / (1000 * 60 * 60 * 24));
    const dailyInterest = (transaction.amount * transaction.rateOfInterest) / (100 * 365);
    return transaction.amount + (dailyInterest * daysElapsed);
  };

  const handleAddTransaction = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage(t('Adding Transaction'));
      
      const newTransaction = {
        type: transactionType,
        name,
        amount: parseFloat(amount),
        rateOfInterest: parseFloat(rateOfInterest),
        initialDate: selectedDate.toISOString(),
        currentAmount: parseFloat(amount),
        daysElapsed: 0,
        isSettled: false,
        remarks
      };
      
      const response = await databases.createDocument(
        config.databaseId,
        config.loansCollectionId,
        ID.unique(),
        newTransaction
      );
      
      Alert.alert(t('Success'), t('Transaction Added'));
      router.replace({
        pathname: "/PersonLedgerDetails",
        params: {
          ...params,
          transactions: JSON.stringify([...transactions, response]),
          totalGiven: (totalGiven + (transactionType === 'given' ? parseFloat(amount) : 0)).toString(),
          totalTaken: (totalTaken + (transactionType === 'taken' ? parseFloat(amount) : 0)).toString()
        }
      });
    } catch (error) {
      console.error('Error adding transaction:', error);
      Alert.alert(t('Error'), t('Failed to add transaction'));
    } finally {
      setIsLoading(false);
      setAddModalVisible(false);
    }
  };

  const handleEditTransaction = async (updatedTransaction: Transaction) => {
    try {
      setIsLoading(true);
      setLoadingMessage(t('Updating Transaction'));
      
      await databases.updateDocument(
        config.databaseId,
        config.loansCollectionId,
        updatedTransaction.$id,
        updatedTransaction
      );
      
      Alert.alert(t('Success'), t('Transaction Updated'));
      router.replace({
        pathname: "/PersonLedgerDetails",
        params: {
          ...params,
          transactions: JSON.stringify(
            transactions.map(t => 
              t.$id === updatedTransaction.$id ? updatedTransaction : t
            )
          )
        }
      });
    } catch (error) {
      console.error('Error updating transaction:', error);
      Alert.alert(t('Error'), t('Failed to update transaction'));
    } finally {
      setIsLoading(false);
      setEditModalVisible(false);
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      setIsLoading(true);
      setLoadingMessage(t('Deleting Transaction'));
      
      await databases.deleteDocument(
        config.databaseId,
        config.loansCollectionId,
        transactionId
      );
      
      Alert.alert(t('Success'), t('Transaction Deleted'));
      router.replace({
        pathname: "/PersonLedgerDetails",
        params: {
          ...params,
          transactions: JSON.stringify(
            transactions.filter(t => t.$id !== transactionId)
          )
        }
      });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      Alert.alert(t('Error'), t('Failed to delete transaction'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettleTransaction = async () => {
    if (!settlingTransaction) return;

    try {
      setIsLoading(true);
      setLoadingMessage(t('Settling Transaction'));
      
      const settledAmount = parseFloat(settleAmount);
      const settledDate = new Date();
      
      await databases.updateDocument(
        config.databaseId,
        config.loansCollectionId,
        settlingTransaction.$id,
        {
          isSettled: true,
          currentAmount: settledAmount,
          settledDate: settledDate.toISOString(),
          remarks: settleRemarks
        }
      );
      
      Alert.alert(t('Success'), t('Transaction Settled'));
      router.replace({
        pathname: "/PersonLedgerDetails",
        params: {
          ...params,
          transactions: JSON.stringify(
            transactions.map(t => 
              t.$id === settlingTransaction.$id 
                ? {...t, isSettled: true, currentAmount: settledAmount, settledDate, remarks: settleRemarks}
                : t
            )
          )
        }
      });
    } catch (error) {
      console.error('Error settling transaction:', error);
      Alert.alert(t('Error'), t('Failed to settle transaction'));
    } finally {
      setIsLoading(false);
      setSettleModalVisible(false);
    }
  };
  const updateTransactions = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage(t('Updating Transactions'));
      
      const currentDate = new Date();
      const updatedTransactions = await Promise.all(
        transactions.map(async (transaction) => {
          if (transaction.isSettled) return transaction;
          
          const initialDate = new Date(transaction.initialDate);
          const daysElapsed = Math.floor((currentDate.getTime() - initialDate.getTime()) / (1000 * 60 * 60 * 24));
          const dailyInterest = (transaction.amount * transaction.rateOfInterest) / (100 * 365);
          const currentAmount = transaction.amount + (dailyInterest * daysElapsed);

          const updatedTransaction = {
            ...transaction,
            daysElapsed,
            currentAmount
          };

          await databases.updateDocument(
            config.databaseId,
            config.loansCollectionId,
            transaction.$id,
            {
              daysElapsed,
              currentAmount
            }
          );

          return updatedTransaction;
        })
      );

      // Update local state and router params
      router.replace({
        pathname: "/PersonLedgerDetails",
        params: {
          ...params,
          transactions: JSON.stringify(updatedTransactions),
          totalGiven: updatedTransactions
            .filter(t => t.type === 'given')
            .reduce((sum, t) => sum + t.currentAmount, 0)
            .toString(),
          totalTaken: updatedTransactions
            .filter(t => t.type === 'taken')
            .reduce((sum, t) => sum + t.currentAmount, 0)
            .toString()
        }
      });
      
      Alert.alert(t('Success'), t('Transactions updated successfully'));
    } catch (error) {
      console.error('Error updating transactions:', error);
      Alert.alert(t('Error'), t('Failed to update transactions'));
    } finally {
      setIsLoading(false);
    }
  };
  const handleExport = async () => {
    try {
      let exportText = `${t('Transactions Report for')}: ${name}\n\n`;
      exportText += `${t('Total Given')}: ₹${totalGiven.toFixed(2)}\n`;
      exportText += `${t('Total Taken')}: ₹${totalTaken.toFixed(2)}\n`;
      exportText += `${t('Net Amount')}: ₹${(totalGiven - totalTaken).toFixed(2)}\n\n`;
      
      transactions.forEach((transaction, index) => {
        exportText += `${index + 1}. ${t(transaction.type === 'given' ? 'Given' : 'Taken')}\n`;
        exportText += `   ${t('Amount')}: ₹${transaction.amount.toFixed(2)}\n`;
        exportText += `   ${t('Interest Rate')}: ${transaction.rateOfInterest}%\n`;
        exportText += `   ${t('Date')}: ${new Date(transaction.initialDate).toLocaleDateString()}\n`;
        exportText += `   ${t('Current Amount')}: ₹${transaction.currentAmount.toFixed(2)}\n`;
        if (transaction.isSettled) {
          exportText += `   ${t('Status')}: ${t('Settled')}\n`;
          exportText += `   ${t('Settled Date')}: ${transaction.settledDate?.toLocaleDateString()}\n`;
        }
        if (transaction.remarks) {
          exportText += `   ${t('Remarks')}: ${transaction.remarks}\n`;
        }
        exportText += '\n';
      });

      await Share.share({
        message: exportText
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert(t('Error'), t('Failed to export data'));
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Button onPress={toggleLanguage}>
            {i18n.language === 'en' ? 'తెలుగు' : 'English'}
          </Button>
        </View>
        
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="headlineMedium" style={styles.name}>{name}</Text>
            <View style={styles.row}>
              <Text variant="bodyMedium">{t('Total Given')}:</Text>
              <Text variant="bodyMedium" style={styles.value}>₹{totalGiven.toFixed(2)}</Text>
            </View>
            <View style={styles.row}>
              <Text variant="bodyMedium">{t('Total Taken')}:</Text>
              <Text variant="bodyMedium" style={styles.value}>₹{totalTaken.toFixed(2)}</Text>
            </View>
            <View style={styles.row}>
              <Text variant="bodyMedium">{t('Net Amount')}:</Text>
              <Text variant="bodyMedium" style={[
                styles.value,
                { color: totalGiven - totalTaken > 0 ? '#4CAF50' : '#f44336' }
              ]}>
                ₹{(totalGiven - totalTaken).toFixed(2)}
              </Text>
            </View>
            
            <View style={styles.buttonContainer}>
              <Button 
                mode="contained" 
                onPress={() => setAddModalVisible(true)}
                style={styles.button}
              >
                {t('Add Transaction')}
              </Button>
              <Button 
                mode="contained" 
                onPress={updateTransactions}
                style={[styles.button, { backgroundColor: '#1E90FF' }]}
              >
                {t('Update')}
              </Button>
              <Button 
                mode="contained" 
                onPress={handleExport}
                style={styles.button}
              >
                {t('Export')}
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Text variant="titleLarge" style={styles.sectionTitle}>{t('Transactions')}</Text>
        {transactions.map((transaction, index) => (
          <Card key={index} style={[styles.card, transaction.isSettled && styles.settledCard]}>
            <Card.Content>
              <View style={styles.row}>
                <Text variant="titleMedium" style={styles.transactionType}>
                  {t(transaction.type === 'given' ? 'Given' : 'Taken')}
                </Text>
                <Chip mode="flat" style={transaction.isSettled ? styles.settledChip : styles.pendingChip}>
                  {transaction.isSettled ? t('Settled') : t('Pending')}
                </Chip>
              </View>
              
              <View style={styles.row}>
                <Text variant="bodyMedium">{t('Initial Amount')}:</Text>
                <Text variant="bodyMedium" style={styles.value}>₹{transaction.amount.toFixed(2)}</Text>
              </View>
              
              <View style={styles.row}>
                <Text variant="bodyMedium">{t('Interest Rate')}:</Text>
                <Text variant="bodyMedium" style={styles.value}>{transaction.rateOfInterest}%</Text>
              </View>
              
              <View style={styles.row}>
                <Text variant="bodyMedium">{t('Date')}:</Text>
                <Text variant="bodyMedium" style={styles.value}>
                  {new Date(transaction.initialDate).toLocaleDateString()}
                </Text>
              </View>
              
              <View style={styles.row}>
                <Text variant="bodyMedium">{t('Current Amount')}:</Text>
                <Text variant="bodyMedium" style={styles.value}>₹{transaction.currentAmount.toFixed(2)}</Text>
              </View>
              
              {transaction.isSettled && (
                <>
                  <View style={styles.row}>
                    <Text variant="bodyMedium">{t('Settled Date')}:</Text>
                    <Text variant="bodyMedium" style={styles.value}>
                      {transaction.settledDate?.toLocaleDateString()}
                    </Text>
                  </View>
                  {transaction.remarks && (
                    <View style={styles.row}>
                      <Text variant="bodyMedium">{t('Remarks')}:</Text>
                      <Text variant="bodyMedium" style={styles.value}>{transaction.remarks}</Text>
                    </View>
                  )}
                </>
              )}
              
              {!transaction.isSettled && (
                <View style={styles.buttonContainer}>
                  <Button 
                    mode="contained"
                    onPress={() => {
                      setEditingTransaction(transaction);
                      setEditModalVisible(true);
                    }}
                    style={styles.actionButton}
                  >
                    {t('Edit')}
                  </Button>
                  <Button 
                    mode="contained"
                    onPress={() => {
                      setSettlingTransaction(transaction);
                      setSettleAmount(transaction.currentAmount.toFixed(2));
                      setSettleModalVisible(true);
                    }}
                    style={styles.actionButton}
                  >
                    {t('Settle')}
                  </Button>
                  <Button 
                    mode="contained"
                    onPress={() => {
                      Alert.alert(
                        t('Confirm Deletion'),
                        t('Are you sure you want to delete this transaction?'),
                        [
                          { text: t('Cancel'), style: 'cancel' },
                          { 
                            text: t('Delete'),
                            onPress: () => handleDeleteTransaction(transaction.$id),
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
              )}
            </Card.Content>
          </Card>
        ))}
      </ScrollView>

      {/* Add Transaction Modal */}
      <Modal
        visible={isAddModalVisible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <Card style={styles.modalCard}>
            <Card.Content>
              <Text variant="titleLarge">{t('Add Transaction')}</Text>
              
              <View style={styles.buttonContainer}>
                <Button 
                  mode={transactionType === 'given' ? 'contained' : 'outlined'}
                  onPress={() => setTransactionType('given')}
                  style={styles.typeButton}
                >
                  {t('Given')}
                </Button>
                <Button 
                  mode={transactionType === 'taken' ? 'contained' : 'outlined'}
                  onPress={() => setTransactionType('taken')}
                  style={styles.typeButton}
                >
                  {t('Taken')}
                </Button>
              </View>

              <TextInput
                label={t('Amount')}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                style={styles.input}
              />
              
              <TextInput
                label={t('Interest Rate (%)')}
                value={rateOfInterest}
                onChangeText={setRateOfInterest}
                keyboardType="numeric"
                style={styles.input}
              />
              
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
                label={t('Remarks')}
                value={remarks}
                onChangeText={setRemarks}
                style={styles.input}
              />
              
              <View style={styles.modalButtons}>
                <Button onPress={() => setAddModalVisible(false)}>
                  {t('Cancel')}
                </Button>
                <Button onPress={handleAddTransaction}>
                  {t('Add')}
                </Button>
              </View>
            </Card.Content>
          </Card>
        </View>
      </Modal>

      {/* Edit Transaction Modal */}
      <Modal
        visible={isEditModalVisible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <Card style={styles.modalCard}>
            <Card.Content>
              <Text variant="titleLarge">{t('Edit Transaction')}</Text>
              
              <TextInput
                label={t('Amount')}
                value={editingTransaction?.amount.toString()}
                onChangeText={(text) => setEditingTransaction(prev => 
                  prev ? {...prev, amount: parseFloat(text)} : null
                )}
                keyboardType="numeric"
                style={styles.input}
              />
              
              <TextInput
                label={t('Interest Rate (%)')}
                value={editingTransaction?.rateOfInterest.toString()}
                onChangeText={(text) => setEditingTransaction(prev => 
                  prev ? {...prev, rateOfInterest: parseFloat(text)} : null
                )}
                keyboardType="numeric"
                style={styles.input}
              />
              
              <TouchableOpacity onPress={() => setDatePickerVisible(true)}>
                <TextInput
                  label={t('Date')}
                  value={editingTransaction?.initialDate.toLocaleDateString()}
                  editable={false}
                  style={styles.input}
                />
              </TouchableOpacity>
              
              {isDatePickerVisible && (
                <DateTimePicker
                  value={editingTransaction?.initialDate || new Date()}
                  mode="date"
                  onChange={(event, date) => {
                    setDatePickerVisible(false);
                    if (date) setEditingTransaction(prev => 
                      prev ? {...prev, initialDate: date} : null
                    );
                  }}
                />
              )}
              
              <View style={styles.modalButtons}>
                <Button onPress={() => setEditModalVisible(false)}>
                  {t('Cancel')}
                </Button>
                <Button onPress={() => editingTransaction && handleEditTransaction(editingTransaction)}>
                  {t('Save')}
                </Button>
              </View>
            </Card.Content>
          </Card>
        </View>
      </Modal>

      {/* Settle Transaction Modal */}
      <Modal
        visible={isSettleModalVisible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <Card style={styles.modalCard}>
            <Card.Content>
              <Text variant="titleLarge">{t('Settle Transaction')}</Text>
              
              <TextInput
                label={t('Settlement Amount')}
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
                <Button onPress={handleSettleTransaction}>
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
  settledCard: {
    opacity: 0.8,
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
  transactionType: {
    fontWeight: 'bold',
  },
  settledChip: {
    backgroundColor: '#9c8686',
  },
  pendingChip: {
    backgroundColor: '#86e33e',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  button: {
    marginLeft: 8,
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
  typeButton: {
    flex: 1,
    marginHorizontal: 4,
  },
});

