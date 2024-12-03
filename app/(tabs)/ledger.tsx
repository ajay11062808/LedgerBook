import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { databases, config, ID } from '../appwrite'; // Ensure correct import path
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { Entypo } from '@expo/vector-icons'; // Make sure to install @expo/vector-icons
import { StatusBar } from 'expo-status-bar';
import { Collapsible } from '@/components/Collapsible';

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

function LoanTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [currentTransactionType, setCurrentTransactionType] = useState<'given' | 'taken'>('given');
  
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [rateOfInterest, setRateOfInterest] = useState('');

  // State for edit functionality
  const [isEditing, setIsEditing] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // State for three-dot menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
   useEffect(() => {
    fetchTransactions();
    const intervalId = setInterval(calculateDailyInterest, 86400000); // Daily update
    return () => clearInterval(intervalId);
  }, []);

  const fetchTransactions = async () => {
    try {
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
    }
  };

  const calculateDailyInterest = () => {
    const updatedTransactions = transactions.map(transaction => {
      const today = new Date();
      const initialDate = transaction.initialDate;
      const daysElapsed = Math.floor((today.getTime() - initialDate.getTime()) / (1000 * 3600 * 24));
      
      // Daily interest calculation
      const dailyInterestRate = transaction.rateOfInterest / 365;
      const interestAccrued = transaction.amount * (dailyInterestRate / 100) * daysElapsed;
      const currentAmount = transaction.amount + interestAccrued;

      return {
        ...transaction,
        currentAmount: parseFloat(currentAmount.toFixed(2)),
        daysElapsed
      };
    });

    setTransactions(updatedTransactions);
    updateTransactionsInDatabase(updatedTransactions);
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
      Alert.alert('Validation Error', 'Please fill all fields');
      return;
    }

    try {
      if (isEditing && editingTransaction?.$id) {
        // Update existing transaction
        const updatedTransaction: Transaction = {
          ...editingTransaction,
          name,
          amount: parseFloat(amount),
          rateOfInterest: parseFloat(rateOfInterest),
        };

        await databases.updateDocument(
          config.databaseId,
          config.loansCollectionId,
          editingTransaction.$id,
          {
            name,
            amount: parseFloat(amount),
            rateOfInterest: parseFloat(rateOfInterest),
          }
        );

        // Update local state
        setTransactions(transactions.map(t => 
          t.$id === editingTransaction.$id ? updatedTransaction : t
        ));
      } else {
        // Create new transaction
        const newTransaction: Omit<Transaction, '$id'> = {
          type: currentTransactionType,
          name,
          amount: parseFloat(amount),
          rateOfInterest: parseFloat(rateOfInterest),
          initialDate: new Date(),
          currentAmount: parseFloat(amount),
          daysElapsed: 0
        };

        const response = await databases.createDocument(
          config.databaseId,
          config.loansCollectionId,
          ID.unique(),
          newTransaction
        );

        // Update local state
        setTransactions([
          ...transactions, 
          { ...newTransaction, $id: response.$id }
        ]);
      }

      // Reset form
      resetForm();
    } catch (error) {
      console.error('Error saving transaction', error);
      Alert.alert('Error', 'Failed to save transaction');
    }
  };

  const deleteTransaction = async (transactionId: string) => {
    try {
      // Delete from Appwrite database
      await databases.deleteDocument(
        config.databaseId,
        config.loansCollectionId,
        transactionId
      );

      // Update local state
      setTransactions(transactions.filter(t => t.$id !== transactionId));
    } catch (error) {
      console.error('Error deleting transaction', error);
      Alert.alert('Error', 'Failed to delete transaction');
    }
  };

  const resetForm = () => {
    setName('');
    setAmount('');
    setRateOfInterest('');
    setModalVisible(false);
    setIsEditing(false);
    setEditingTransaction(null);
  };

  const startEditTransaction = (transaction: Transaction) => {
    setIsEditing(true);
    setEditingTransaction(transaction);
    setName(transaction.name);
    setAmount(transaction.amount.toString());
    setRateOfInterest(transaction.rateOfInterest.toString());
    setCurrentTransactionType(transaction.type);
    setModalVisible(true);
    setOpenMenuId(null); // Close the three-dot menu
  };

  const toggleMenu = (itemId: string | null) => {
    setOpenMenuId(prevId => prevId === itemId ? null : itemId);
    
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isGiven = item.type === 'given';

    return (
      <ThemedView style={{ backgroundColor: isGiven ? '#86e33e' : '#ff4444' }}
        className={`rounded mb-2 p-3 flex-row justify-between items-start`}>
        <Collapsible title={item.name}>
          {/* <ThemedText className="font-bold text-lg mb-1">{item.name}</ThemedText> */}
          <ThemedView className="flex-col pr-20">
          <ThemedText className="text-gray-600">Initial Amount: ₹{item.amount}</ThemedText>
          <ThemedText className="text-gray-600">Current Amount: ₹{item.currentAmount.toFixed(2)}</ThemedText>
          <ThemedText className="text-gray-600">Interest Rate: {item.rateOfInterest}%</ThemedText>
          <ThemedText className="text-gray-600">Days Elapsed: {item.daysElapsed}</ThemedText>
          <ThemedText  className={'font-semibold'}>
            Type: {item.type}
          </ThemedText>
          </ThemedView>
        </Collapsible>
        
        <View className="relative">
          <TouchableOpacity 
            className="p-2"
            onPress={() => toggleMenu(item.$id ?? null)}
          >
            <Entypo name="dots-three-vertical" size={20} className="text-gray-700" />
          </TouchableOpacity>
          
          {openMenuId === item.$id && (
            <ThemedView 
              className="absolute top-10 right-0 bg-white rounded-lg shadow-lg z-10 w-36"
            >
              <TouchableOpacity 
                className="p-4 border-b border-gray-100"
                onPress={() => startEditTransaction(item)}
              >
                <ThemedText className="text-center">Edit</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                className="p-4"
                onPress={() => {
                  Alert.alert(
                    'Confirm Deletion',
                    'Are you sure you want to delete this transaction?',
                    [
                      { 
                        text: 'Cancel', 
                        style: 'cancel' 
                      },
                      { 
                        text: 'Delete', 
                        style: 'destructive', 
                        onPress: () => {
                          if (item.$id) deleteTransaction(item.$id);
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
    );
  };

  return (
    <ThemedView className="flex-1 p-3 mt-8">
      <ThemedView className="flex-row justify-between mb-3">
        <TouchableOpacity 
          className="bg-blue-300 p-3 rounded-lg flex-1 mr-2"
          onPress={() => {
            setCurrentTransactionType('given');
            setModalVisible(true);
          }}
        >
          <ThemedText className='text-center'>Add Given Loan</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity 
          className="bg-red-300 p-3 rounded-lg flex-1 ml-2"
          onPress={() => {
            setCurrentTransactionType('taken');
            setModalVisible(true);
          }}
        >
          <ThemedText className="text-center">Add Taken Loan</ThemedText>
        </TouchableOpacity>
      </ThemedView>

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-end"
        >
          <ThemedView className="bg-white rounded-t-2xl p-6 shadow-2xl">
            <ThemedTextInput
              className="border border-gray-300 p-3 rounded-lg mb-4"
              placeholder="Name"
              value={name}
              onChangeText={setName}
            />
            <ThemedTextInput
              className="border border-gray-300 p-3 rounded-lg mb-4"
              placeholder="Amount"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
            <ThemedTextInput
              className="border border-gray-300 p-3 rounded-lg mb-4"
              placeholder="Rate of Interest"
              value={rateOfInterest}
              onChangeText={setRateOfInterest}
              keyboardType="numeric"
            />
            <TouchableOpacity 
              className="bg-blue-500 p-4 rounded-lg mb-2"
              onPress={addTransaction}
            >
              <ThemedText className="text-white text-center">
                {isEditing ? 'Update Transaction' : 'Save Transaction'}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              className="bg-red-500 p-4 rounded-lg"
              onPress={() => {
                resetForm();
                setModalVisible(false);
              }}
            >
              <ThemedText className="text-center">Cancel</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </KeyboardAvoidingView>
      </Modal>

      <FlatList 
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.$id || Date.now().toString()}
        onScrollBeginDrag={() => setOpenMenuId(null)}
      />
    </ThemedView>
  );
};

export default LoanTransactions;