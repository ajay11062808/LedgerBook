import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { databases, config, Query } from '../appwrite';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { useTranslation } from 'react-i18next';

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const navigation = useNavigation();

  useEffect(() => {
    if (searchQuery.length > 2) {
      performSearch();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const performSearch = async () => {
    try {
      const loansResponse = await databases.listDocuments(
        config.databaseId,
        config.loansCollectionId,
        [Query.search('name', searchQuery)]
      );

      const landResponse = await databases.listDocuments(
        config.databaseId,
        config.landActivitiesCollectionId,
        [Query.search('name', searchQuery)]
      );

      const combinedResults = [
        ...loansResponse.documents.map(doc => ({ ...doc, type: 'loan' })),
        ...landResponse.documents.map(doc => ({ ...doc, type: 'land' }))
      ];

      setSearchResults(combinedResults);
    } catch (error) {
      console.error('Error performing search', error);
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'te' : 'en';
    i18n.changeLanguage(newLang);
  };

  const renderSearchResult = ({ item }) => (
    <TouchableOpacity
      onPress={() => {
        if (item.type === 'loan') {
          navigation.navigate('ledger', { screen: 'LoanDetails', params: { loanId: item.$id } });
        } else {
          navigation.navigate('landactivity', { screen: 'LandDetails', params: { activityId: item.$id } });
        }
      }}
    >
      <ThemedView style={styles.resultItem}>
        <ThemedText>{item.name}</ThemedText>
        <ThemedText>{item.type === 'loan' ? `${t('amount')}: ₹${item.amount}` : `${t('LandActivity')}: ${item.landName}`}</ThemedText>
      </ThemedView>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Ravi's Ledger Book</ThemedText>
      <ThemedTextInput
        style={styles.searchInput}
        placeholder={t('Search')}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      <TouchableOpacity onPress={toggleLanguage} style={styles.languageToggle}>
        <ThemedText>{i18n.language === 'en' ? 'Switch to Telugu' : 'ఆంగ్లానికి మారండి'}</ThemedText>
      </TouchableOpacity>
      <FlatList
        data={searchResults}
        renderItem={renderSearchResult}
        keyExtractor={(item) => `${item.type}-${item.$id}`}
        ListEmptyComponent={() => (
          <ThemedText style={styles.emptyText}>
            {searchQuery.length > 2 ? t('noResults') : t('enterSearchCriteria')}
          </ThemedText>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  searchInput: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  resultItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
  },
  languageToggle: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    marginBottom: 10,
  },
});

