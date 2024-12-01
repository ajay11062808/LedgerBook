import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';

interface Transaction {
  id: number;
  name: string;
  amount: number;
  rateOfInterest: number;
  givenAt: Date | null;
  takenAt: Date | null;
}

const Ledger: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [rateOfInterest, setRateOfInterest] = useState<string>('');
  const [givenAt, setGivenAt] = useState<Date | null>(null);
  const [takenAt, setTakenAt] = useState<Date | null>(null);
  const [showGivenPicker, setShowGivenPicker] = useState(false);
  const [showTakenPicker, setShowTakenPicker] = useState(false);

  const addTransaction = () => {
    const parsedAmount = parseFloat(amount);
    const parsedRate = parseFloat(rateOfInterest);

    if (name && parsedAmount > 0) {
      const newTransaction: Transaction = {
        id: transactions.length + 1,
        name,
        amount: parsedAmount,
        rateOfInterest: parsedRate,
        givenAt,
        takenAt,
      };
      setTransactions([...transactions, newTransaction]);
      setName('');
      setAmount('0');
      setRateOfInterest('0');
      setGivenAt(null);
      setTakenAt(null);
    } else {
      alert('Please provide valid details!');
    }
  };

  const deleteTransaction = (id: number) => {
    setTransactions(transactions.filter((transaction) => transaction.id !== id));
  };

  const handleGivenDateChange = (_: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowGivenPicker(false);
    if (selectedDate) setGivenAt(selectedDate);
  };

  const handleTakenDateChange = (_: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowTakenPicker(false);
    if (selectedDate) setTakenAt(selectedDate);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Ledger Book</ThemedText>

      <ThemedView style={styles.inputContainer}>
        <ThemedTextInput
          style={styles.input}
          placeholder="Name"
          value={name}
          onChangeText={setName}
        />
        <ThemedTextInput
          style={styles.input}
          placeholder="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />
        <ThemedTextInput
          style={styles.input}
          placeholder="Rate of Interest"
          value={rateOfInterest}
          onChangeText={setRateOfInterest}
          keyboardType="numeric"
        />
      </ThemedView>

      <ThemedView>
        <Button title="Select Given Date" onPress={() => setShowGivenPicker(true)} />
        {showGivenPicker && (
          <DateTimePicker
            mode="date"
            display="default"
            value={givenAt || new Date()}
            onChange={handleGivenDateChange}
          />
        )}
        <ThemedText>{givenAt ? `Given At: ${givenAt.toLocaleDateString()}` : 'Given At: Not set'}</ThemedText>
      </ThemedView>

      <ThemedView>
        <Button title="Select Taken Date" onPress={() => setShowTakenPicker(true)} />
        {showTakenPicker && (
          <DateTimePicker
            mode="date"
            display="default"
            value={takenAt || new Date()}
            onChange={handleTakenDateChange}
          />
        )}
        <ThemedText>{takenAt ? `Taken At: ${takenAt.toLocaleDateString()}` : 'Taken At: Not set'}</ThemedText>
      </ThemedView>

      <Button title="Add Transaction" onPress={addTransaction} />

      <FlatList
        data={transactions}
        renderItem={({ item }) => (
          <ThemedView style={styles.transaction}>
            <ThemedText>{item.name}</ThemedText>
            <ThemedText>Amount: {item.amount}</ThemedText>
            <ThemedText>Rate of Interest: {item.rateOfInterest}%</ThemedText>
            <ThemedText>Given At: {item.givenAt?.toLocaleDateString() || 'Not set'}</ThemedText>
            <ThemedText>Taken At: {item.takenAt?.toLocaleDateString() || 'Not set'}</ThemedText>
            <Button title="Delete" onPress={() => deleteTransaction(item.id)} />
          </ThemedView>
        )}
        keyExtractor={(item) => item.id.toString()}
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    marginTop:28
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 8,
  },
  transaction: {
    padding: 16,
    marginBottom: 8,
    marginTop:10,
    borderRadius: 8,
  },
});

export default Ledger;
