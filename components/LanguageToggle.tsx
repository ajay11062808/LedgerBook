import React from 'react';
import { Switch } from 'react-native';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { useLanguage } from '../contexts/LanguageContext';

export function LanguageToggle() {
  const { isTeluguEnabled, toggleLanguage } = useLanguage();

  return (
    <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
      <ThemedText style={{ marginRight: 8 }}>తెలుగు</ThemedText>
      <Switch
        value={isTeluguEnabled}
        onValueChange={toggleLanguage}
        trackColor={{ false: "#767577", true: "#81b0ff" }}
        thumbColor={isTeluguEnabled ? "#f5dd4b" : "#f4f3f4"}
      />
    </ThemedView>
  );
}