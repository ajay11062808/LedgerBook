import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity,Image,Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { databases, config, Query } from '../appwrite';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useAnimations } from '../../hooks/useAnimations';

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const navigation = useNavigation();


  const { fadeAnim, scaleAnim, fadeIn } = useAnimations();

  useEffect(() => {
    fadeIn();
  }, []);

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
    <Animated.View style={[styles.resultItem, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        onPress={() => {
          if (item.type === 'loan') {
            navigation.navigate('ledger', { screen: 'LoanDetails', params: { loanId: item.$id } });
          } else {
            navigation.navigate('landactivity', { screen: 'LandDetails', params: { activityId: item.$id } });
          }
        }}
      >
        <LinearGradient
          colors={['#4c669f', '#3b5998', '#192f6a']}
          style={styles.gradientCard}
        >
          <Image
            source={item.type === 'loan' ? require('../../assets/images/react-logo.png') : require('../../assets/images/icon.png')}
            style={styles.icon}
          />
          <ThemedView style={styles.textContainer}>
            <ThemedText style={styles.itemName}>{item.name}</ThemedText>
            <ThemedText style={styles.itemDetails}>
              {item.type === 'loan' ? `${t('amount')}: ₹${item.amount}` : `${t('LandActivity')}: ${item.landName}`}
            </ThemedText>
          </ThemedView>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <LinearGradient colors={['#4c669f', '#3b5998', '#192f6a']} style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
        <ThemedText style={styles.title}>Ravi's Ledger Book</ThemedText>
        <ThemedView style={styles.searchContainer}>
          <Feather name="search" size={24} color="#fff" style={styles.searchIcon} />
          <ThemedTextInput
            style={styles.searchInput}
            placeholder={t('Search')}
            placeholderTextColor="#ccc"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </ThemedView>
        <TouchableOpacity onPress={toggleLanguage} style={styles.languageToggle}>
          <ThemedText style={styles.languageToggleText}>
            {i18n.language === 'en' ? 'Switch to Telugu' : 'ఆంగ్లానికి మారండి'}
          </ThemedText>
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
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 30,
  },
  title: {
    fontSize: 25,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 50,
    color: '#fff',
    fontSize: 16,
  },
  resultItem: {
    marginBottom: 15,
  },
  gradientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 15,
  },
  icon: {
    width: 40,
    height: 40,
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemDetails: {
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#fff',
  },
  languageToggle: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    marginBottom: 15,
  },
  languageToggleText: {
    color: '#fff',
    textAlign: 'center',
  },
});