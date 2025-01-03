import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card, Text, Chip, Divider } from 'react-native-paper';
import { ThemedView } from '@/components/ThemedView';

export default function PersonDetails() {
  const { name, totalAmount, settledAmount, isSettled, activities, settlements } = useLocalSearchParams();

  const parsedActivities = JSON.parse(activities as string);
  const parsedSettlements = JSON.parse(settlements as string);

  return (
    <ThemedView style={styles.container}>
      <ScrollView>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="headlineMedium" style={styles.name}>{name}</Text>
            <View style={styles.row}>
              <Text variant="bodyMedium">Total Amount:</Text>
              <Text variant="bodyMedium" style={styles.value}>₹{totalAmount}</Text>
            </View>
            <View style={styles.row}>
              <Text variant="bodyMedium">Settled Amount:</Text>
              <Text variant="bodyMedium" style={styles.value}>₹{settledAmount}</Text>
            </View>
            <View style={styles.row}>
              <Text variant="bodyMedium">Status:</Text>
              <Chip mode="flat" style={isSettled === 'true' ? styles.settledChip : styles.unsettledChip}>
                {isSettled === 'true' ? 'Settled' : 'Not Settled'}
              </Chip>
            </View>
          </Card.Content>
        </Card>

        <Text variant="titleLarge" style={styles.sectionTitle}>Activities</Text>
        {parsedActivities.map((activity: any, index: number) => (
          <Card key={index} style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.activityTitle}>{activity.landName}</Text>
              <View style={styles.row}>
                <Text variant="bodyMedium">Activity:</Text>
                <Text variant="bodyMedium" style={styles.value}>{activity.activity}</Text>
              </View>
              <View style={styles.row}>
                <Text variant="bodyMedium">Date:</Text>
                <Text variant="bodyMedium" style={styles.value}>{new Date(activity.date).toLocaleDateString()}</Text>
              </View>
              <View style={styles.row}>
                <Text variant="bodyMedium">Amount:</Text>
                <Text variant="bodyMedium" style={styles.value}>₹{activity.totalAmount}</Text>
              </View>
            </Card.Content>
          </Card>
        ))}

        <Divider style={styles.divider} />

        <Text variant="titleLarge" style={styles.sectionTitle}>Settlements</Text>
        {parsedSettlements.map((settlement: any, index: number) => (
          <Card key={index} style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <Text variant="bodyMedium">Date:</Text>
                <Text variant="bodyMedium" style={styles.value}>{new Date(settlement.date).toLocaleDateString()}</Text>
              </View>
              <View style={styles.row}>
                <Text variant="bodyMedium">Amount:</Text>
                <Text variant="bodyMedium" style={styles.value}>₹{settlement.amount}</Text>
              </View>
              <View style={styles.row}>
                <Text variant="bodyMedium">Remarks:</Text>
                <Text variant="bodyMedium" style={styles.value}>{settlement.remarks}</Text>
              </View>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  name: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  value: {
    fontWeight: '500',
  },
  settledChip: {
    backgroundColor: '#4CAF50',
  },
  unsettledChip: {
    backgroundColor: '#F44336',
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  activityTitle: {
    fontWeight: '500',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 16,
  },
});
