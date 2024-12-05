import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

export const LoadingOverlay = ({ message }: { message?: string }) => (
  <View 
    style={{
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}
  >
    <ThemedView 
      className="p-6 rounded-lg bg-white items-center justify-center"
      style={{ elevation: 5, shadowOpacity: 0.3 }}
    >
      <ActivityIndicator size="large" color="#007bff" />
      {message && (
        <ThemedText className="mt-4 text-center">
          {message}
        </ThemedText>
      )}
    </ThemedView>
  </View>
);