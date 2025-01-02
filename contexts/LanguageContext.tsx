import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nextProvider } from 'react-i18next';
import i18n from '../components/i18n'; // Make sure you have this file set up with your translations

interface LanguageContextType {
  isTeluguEnabled: boolean;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [isTeluguEnabled, setIsTeluguEnabled] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('isTeluguEnabled').then((value) => {
      if (value !== null) {
        const savedPreference = JSON.parse(value);
        setIsTeluguEnabled(savedPreference);
        i18n.changeLanguage(savedPreference ? 'te' : 'en');
      }
    });
  }, []);

  const toggleLanguage = async () => {
    const newValue = !isTeluguEnabled;
    setIsTeluguEnabled(newValue);
    await AsyncStorage.setItem('isTeluguEnabled', JSON.stringify(newValue));
    i18n.changeLanguage(newValue ? 'te' : 'en');
  };

  return (
    <LanguageContext.Provider value={{ isTeluguEnabled, toggleLanguage }}>
      <I18nextProvider i18n={i18n}>
        {children}
      </I18nextProvider>
    </LanguageContext.Provider>
  );
};