import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';
import {Colors} from '../../constants/Colors';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { HapticTab } from '../../components/HapticTab';
import TabBarBackground  from '../../components/ui/TabBarBackground';
import { LanguageToggle } from '../../components/LanguageToggle';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { PaperProvider } from 'react-native-paper';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  return (
    <PaperProvider>
    <LanguageProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: true,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarStyle: Platform.select({
            ios: {
              position: 'absolute',
            },
            default: {},
          }),
          headerRight: () => <LanguageToggle />,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: t('Home'),
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="landactivity"
          options={{
            title: t('LandActivity'),
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="land" color={color} />,
          }}
        />
        <Tabs.Screen
          name="ledger"
          options={{
            title: t('Loans'),
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="menu" color={color} />,
          }}
        />
      </Tabs>
    </LanguageProvider>
    </PaperProvider>
  );
}

