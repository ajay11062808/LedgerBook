import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, ScrollView, Text, Modal } from 'react-native';
import { databases, config, Query ,ID} from '../appwrite';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useTranslation } from 'react-i18next';
import { Collapsible } from '@/components/Collapsible';
import { LoadingOverlay } from '../../components/landactivity/Loading';
import { useRouter } from 'expo-router';
import { Button, Card, TextInput } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';

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
  settlementDates?: string[];
  settlementAmounts?: number[];
  settlementRemarks?: string[];
}

interface GroupedActivity {
  name: string;
  totalAmount: number;
  settledAmount: number;
  isSettled: boolean;
  activities: LandActivity[];
  settlements: Settlement[];
}

export default function LandActivitiesTracker() {
  const [activities, setActivities] = useState<LandActivity[]>([]);
  const [groupedActivities, setGroupedActivities] = useState<GroupedActivity[]>([]);
  const [groupSettlements, setGroupSettlements] = useState<GroupSettlement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage(t('Fetching Activities'));
      
      const [activitiesResponse, settlementsResponse] = await Promise.all([
        databases.listDocuments(
          config.databaseId,
          config.landActivitiesCollectionId,
          [Query.orderDesc('$createdAt')]
        ),
        databases.listDocuments(
          config.databaseId,
          config.groupSettlementsCollectionId
        )
      ]);

      // Map activities
      const mappedActivities: LandActivity[] = activitiesResponse.documents.map(doc => ({
        $id: doc.$id,
        name: doc.name,
        landName: doc.landName,
        activity: doc.activity,
        date: new Date(doc.date),
        landInAcres: doc.landInAcres,
        amountPerAcre: doc.amountPerAcre,
        totalAmount: doc.totalAmount
      }));

      // Map settlements with proper array handling
      const mappedSettlements: GroupSettlement[] = settlementsResponse.documents.map(doc => {
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
        return {
          $id: doc.$id,
          groupName: doc.groupName,
          totalAmount: doc.totalAmount,
          settledAmount: doc.settledAmount || 0,
          isSettled: doc.isSettled || false,
          settlements: settlements,
          settlementDates: doc.settlementDates || [],
          settlementAmounts: doc.settlementAmounts || [],
          settlementRemarks: doc.settlementRemarks || []
        };
      });

      setActivities(mappedActivities);
      setGroupSettlements(mappedSettlements);
      
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setIsLoading(false);
    }
  };
// Refetch data whenever the screen is focused
useFocusEffect(
  React.useCallback(() => {
    fetchActivities();
  }, [])
);
  const groupActivitiesByName = (
    activities: LandActivity[],
    settlements: GroupSettlement[]
  ): GroupedActivity[] => {
    const groupedByName = activities.reduce((acc, activity) => {
      const name = activity.name;
      if (!acc[name]) {
        const settlement = settlements.find(s => s.groupName === name);
        acc[name] = {
          name,
          totalAmount: 0,
          settledAmount: settlement?.settledAmount || 0,
          isSettled: settlement?.isSettled || false,
          activities: [],
          settlements: settlement?.settlements || []
        };
      }
      acc[name].activities.push(activity);
      acc[name].totalAmount += activity.totalAmount;
      
      // Update isSettled status based on total and settled amounts
      acc[name].isSettled = acc[name].settledAmount >= acc[name].totalAmount;
      
      return acc;
    }, {} as Record<string, GroupedActivity>);

    return Object.values(groupedByName);
  };

  useEffect(() => {
    const grouped = groupActivitiesByName(activities, groupSettlements);
    setGroupedActivities(grouped);
  }, [activities, groupSettlements]);

  const renderGroupedActivity = ({ item }: { item: GroupedActivity }) => (
    <TouchableOpacity
      onPress={() => router.push({
        pathname: "/PersonDetails",
        params: {
          name: item.name,
          totalAmount: item.totalAmount.toString(),
          settledAmount: item.settledAmount.toString(),
          isSettled: item.isSettled.toString(),
          activities: JSON.stringify(item.activities),
          settlements: JSON.stringify(item.settlements),
          groupSettlementId: groupSettlements.find(s => s.groupName === item.name)?.$id,
          
        }
      })}
    >
        <Card className='mb-2'>
            <Card.Content style={{ backgroundColor: !item.isSettled ? '#2da42f' : '#eb3b3b' }}>
            <ThemedText>{t(item.name)}</ThemedText>
            </Card.Content>
            </Card>
      {/* <Collapsible title={t(item.name)}>
        <ThemedView style={{backgroundColor: item.isSettled ? "#9c8686" : "#86e33e"}} className={'rounded mb-2 p-3'}>
          <ThemedText className="text-lg font-bold">{t(item.name)}</ThemedText>
          <ThemedText>{t('Total Amount')}: ₹{item.totalAmount.toFixed(2)}</ThemedText>
          <ThemedText>{t('Settled Amount')}: ₹{item.settledAmount.toFixed(2)}</ThemedText>
          <ThemedText>{t('Remaining Amount')}: ₹{(item.totalAmount - item.settledAmount).toFixed(2)}</ThemedText>
          <ThemedText>{t('Status')}: {item.isSettled ? t('Settled') : t('Pending')}</ThemedText>
        </ThemedView>
      </Collapsible> */}
    </TouchableOpacity>
  );

  const [showNewNameModal, setShowNewNameModal] = useState(false);
  const [newName, setNewName] = useState('');

  return (
    <ThemedView className="flex-1 p-4">
      
      <Button
  mode="contained"
  onPress={() => setShowNewNameModal(true)}
  style={{ margin: 8 }}
>
  Add New Name
</Button>
<Modal visible={showNewNameModal} transparent={true} animationType="slide">
  <View style={{ flex: 1, justifyContent: 'flex-end', padding: 24 }}>
    <Card >
      <Card.Content className='flex flex-col'>
        <TextInput
          label="Enter Name"
          value={newName}
          onChangeText={setNewName}
          style={{ marginBottom: 4 }}
        />
        <View className='flex flex-row justify-between'>
        <Button
          style={{ backgroundColor: '#f10808', padding: 4, borderRadius: 20 }}
          labelStyle={{ color: '#ffffff' }}
          onPress={() => setShowNewNameModal(false)}
        >
          Cancel
        </Button >
        <Button  style={{ backgroundColor: '#109f12', padding: 4, borderRadius: 20 }}
          labelStyle={{ color: '#ffffff' }}
          onPress={async () => {
            const response = await databases.createDocument(
              config.databaseId,
              config.groupSettlementsCollectionId,
              ID.unique(),
              { groupName: newName, totalAmount: 0, settledAmount: 0, isSettled: false }
            );
            const newGroupedActivity: GroupedActivity = {
              name: newName,
              totalAmount: 0,
              settledAmount: 0,
              isSettled: false,
              activities: [],
              settlements: []
            };
            setGroupedActivities([...groupedActivities, newGroupedActivity]);
            setShowNewNameModal(false);
          }}
        >
          Save
        </Button>
        </View>
      </Card.Content>
    </Card>
  </View>
</Modal>

      <ScrollView>
        {groupedActivities.map((item, index) => (
          <View key={index}>
            {renderGroupedActivity({ item })}
          </View>
        ))}
      </ScrollView>
      {isLoading && <LoadingOverlay message={loadingMessage} />}
    </ThemedView>
  );
}

