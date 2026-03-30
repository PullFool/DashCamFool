import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Image, ActivityIndicator } from 'react-native';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.appName}>DashCamFool</Text>
      <Text style={styles.tagline}>Ride Safe. Record Everything.</Text>
      <ActivityIndicator
        size="large"
        color="#FF4444"
        style={styles.loader}
      />
      <Text style={styles.footer}>by PullFool</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 180,
    height: 180,
    marginBottom: 20,
  },
  appName: {
    color: '#FF4444',
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  tagline: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
    fontFamily: 'monospace',
  },
  loader: {
    marginTop: 40,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    color: '#666',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
