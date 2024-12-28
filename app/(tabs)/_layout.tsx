import { Tabs } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Platform, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { toggleLanguage, getStoredLanguagePreference } from '../../components/i18n';

function LanguageToggle() {
  const [isTeluguEnabled, setIsTeluguEnabled] = useState(false);
  const { i18n } = useTranslation();

  useEffect(() => {
    getStoredLanguagePreference().then(setIsTeluguEnabled);
  }, []);

  const onToggle = async (value: boolean) => {
    setIsTeluguEnabled(value);
    await toggleLanguage(value);
  };

  return (
    <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
      <ThemedText style={{ marginRight: 8 }}>తెలుగు</ThemedText>
      <Switch
        value={isTeluguEnabled}
        onValueChange={onToggle}
        trackColor={{ false: "#767577", true: "#81b0ff" }}
        thumbColor={isTeluguEnabled ? "#f5dd4b" : "#f4f3f4"}
      />
    </ThemedView>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  return (
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
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
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
  );
}

