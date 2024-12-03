import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import {Link} from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ThemedView } from '@/components/ThemedView'
import { ThemedText } from '@/components/ThemedText'


const index = () => {
  return (
    <ThemedView className="flex-1 items-center justify-center bg-white">
      <ThemedText style={{fontsize:"400px"}}>index</ThemedText>
      <Link href="/(tabs)" style={{color:"blue"}}>Go to the dashboard</Link>
    </ThemedView>
  )
}

export default index
