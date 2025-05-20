import React from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.6)']}
        style={StyleSheet.absoluteFill}
      />
      
      <Image
        source={require('../assets/images/heavygymlogga_optimized.webp')}
        style={styles.logo}
        resizeMode="contain"
      />
      
      <ActivityIndicator 
        size="large" 
        color="#009dff"
        style={styles.spinner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 250,
    height: 80,
    marginBottom: 48,
  },
  spinner: {
    transform: [{ scale: 1.2 }],
  },
});