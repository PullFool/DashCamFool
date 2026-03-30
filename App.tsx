import React, { useState } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import SplashScreen from './src/screens/SplashScreen';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AppProvider, useApp } from './src/context/AppContext';
import HomeScreen from './src/screens/HomeScreen';
import GalleryScreen from './src/screens/GalleryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { COLORS } from './src/utils/constants';

const Tab = createBottomTabNavigator();

const MotoDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: COLORS.dark.background,
    card: COLORS.dark.surface,
    text: COLORS.dark.text,
    border: COLORS.dark.border,
    primary: COLORS.dark.primary,
  },
};

const MotoLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.light.background,
    card: COLORS.light.surface,
    text: COLORS.light.text,
    border: COLORS.light.border,
    primary: COLORS.light.primary,
  },
};

function AppNavigator() {
  const { state } = useApp();
  const isDark = state.settings.darkMode;
  const colors = isDark ? COLORS.dark : COLORS.light;

  return (
    <NavigationContainer theme={isDark ? MotoDarkTheme : MotoLightTheme}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 60,
            paddingBottom: 8,
            paddingTop: 4,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: '700',
          },
        }}>
        <Tab.Screen
          name="Record"
          component={HomeScreen}
          options={{
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <TabIcon label="🎥" color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Gallery"
          component={GalleryScreen}
          options={{
            title: 'Gallery',
            tabBarIcon: ({ color, size }) => (
              <TabIcon label="📁" color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <TabIcon label="⚙️" color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

function TabIcon({ label, color }: { label: string; color: string }) {
  return (
    <React.Fragment>
      <StatusBar />
      <React.Fragment>
        {React.createElement(
          require('react-native').Text,
          { style: { fontSize: 22 } },
          label,
        )}
      </React.Fragment>
    </React.Fragment>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <AppProvider>
      <AppNavigator />
    </AppProvider>
  );
}
