import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import {Link} from 'expo-router'
import { StatusBar } from 'expo-status-bar'


const index = () => {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-4xl">index</Text>
      <StatusBar style="auto"/>
      <Link href="/(tabs)" style={{color:"blue"}}>Go to the dashboard</Link>
    </View>
  )
}

export default index
