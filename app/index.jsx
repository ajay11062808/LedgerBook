import React, { useEffect } from 'react'
import { Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native'
import { Link } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ThemedView } from '@/components/ThemedView'
import { ThemedText } from '@/components/ThemedText'
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withTiming,
  withSequence,
  withDelay
} from 'react-native-reanimated'
import { BlurView } from 'expo-blur'

const { width, height } = Dimensions.get('window')

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity)

const index = () => {
  const logoScale = useSharedValue(0)
  const titleOpacity = useSharedValue(0)
  const subtitleOpacity = useSharedValue(0)
  const buttonScale = useSharedValue(0.8)
  const buttonOpacity = useSharedValue(0)

  useEffect(() => {
    // Animate elements in sequence
    logoScale.value = withSpring(1, { damping: 8 })
    titleOpacity.value = withDelay(400, withTiming(1, { duration: 800 }))
    subtitleOpacity.value = withDelay(800, withTiming(1, { duration: 800 }))
    buttonOpacity.value = withDelay(1200, withTiming(1, { duration: 800 }))
    buttonScale.value = withDelay(1200, withSpring(1, { damping: 12 }))
  }, [])

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }]
  }))

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: withTiming(titleOpacity.value * -20) }]
  }))

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: withTiming(subtitleOpacity.value * -20) }]
  }))

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ scale: buttonScale.value }]
  }))

  return (
    <ThemedView style={styles.container}>
      <StatusBar style="light" />
      <Animated.Image
        source={require('../assets/images/AppScreen.jpg')}
        style={styles.background}
        resizeMode="cover"
      />
      
      {/* <Animated.Image
        source={require('../assets/images/Booklogo.png')}
        style={[styles.logo, logoStyle]}
      /> */}

      <BlurView intensity={60} style={styles.contentContainer}>
        {/* <Animated.View style={[styles.textContainer, titleStyle]}>
          <ThemedText style={styles.title}>Farmer's Ledger</ThemedText>
        </Animated.View> */}

        <Animated.View style={[styles.textContainer, subtitleStyle]}>
          <ThemedText style={styles.subtitle}>
            Track your agricultural finances with ease and add loans and land activities
          </ThemedText>
        </Animated.View>

        <AnimatedTouchableOpacity style={[styles.button, buttonStyle]}>
          <Link href="/(tabs)" style={styles.buttonText}>
            Get Started
          </Link>
        </AnimatedTouchableOpacity>
      </BlurView>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  background: {
    position: 'absolute',
    width,
    height,
    left: 0,
    right: 0,
    top: 0,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
    zIndex: 2,
  },
  contentContainer: {
    marginTop:210,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 20,
    borderRadius: 20,
    width: width * 0.9,
    alignItems: 'center',
    overflow: 'hidden',
  },
  textContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    marginTop:20,
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4A3D1C',
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 18,
    color: '#65562D',
    textAlign: 'center',
    paddingHorizontal: 20,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 2,
  },
  button: {
    backgroundColor: '#8B7355',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginTop: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
})

export default index

