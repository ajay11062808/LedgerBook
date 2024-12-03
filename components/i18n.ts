import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import teTranslations from './locales/te.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      te: { translation: teTranslations },
    },
    lng: 'en', // Set English as the default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export const toggleLanguage = async (isTeluguEnabled: boolean) => {
  const newLang = isTeluguEnabled ? 'te' : 'en';
  await i18n.changeLanguage(newLang);
  try {
    await AsyncStorage.setItem('isTeluguEnabled', JSON.stringify(isTeluguEnabled));
  } catch (error) {
    console.error('Error saving language preference:', error);
  }
};

export const getStoredLanguagePreference = async (): Promise<boolean> => {
  try {
    const storedPreference = await AsyncStorage.getItem('isTeluguEnabled');
    return storedPreference ? JSON.parse(storedPreference) : false;
  } catch (error) {
    console.error('Error reading language preference:', error);
    return false;
  }
};

export default i18n;

