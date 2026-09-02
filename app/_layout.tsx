import { useFonts as useExpoFonts } from 'expo-font';
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black } from '@expo-google-fonts/nunito';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import './global.css';

import { NotificationService } from '../services/NotificationService';
import { OnboardingService } from '../services/OnboardingService';
import { widgetTaskHandler } from '../widget/WidgetTaskHandler';
import { LogBox, View, ActivityIndicator, Text, Appearance, Image, Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import Constants from 'expo-constants';

LogBox.ignoreLogs(['Unable to activate keep awake']);

import { useColorScheme } from 'nativewind';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

import { StatusBar } from 'expo-status-bar';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

import AnimatedSplash from '../components/AnimatedSplash';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loadedNative, errorNative] = useExpoFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [loadedNunito, errorNunito] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  const loaded = loadedNative && loadedNunito;
  const error = errorNative || errorNunito;

  const [showSplash, setShowSplash] = useState(true);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    // On a fresh install we only create the Android channel and let onboarding
    // ask for the permission in context. Everyone else keeps the old behaviour.
    OnboardingService.isFirstRun().then((firstRun) => {
      if (firstRun) {
        NotificationService.ensureAndroidChannel();
      } else {
        NotificationService.initNotifications();
      }
    });
    // ScreenOrientation removed to prevent native module crash
  }, []);

  useEffect(() => {
    // Force update widget on app launch to push latest design to home screen
    widgetTaskHandler();
    
    const subscription = Appearance.addChangeListener(() => {
      // Re-render widget when system theme changes to automatically update colors
      widgetTaskHandler();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // Hide native splash screen immediately to show our animated React Native splash
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    // Initialize RevenueCat for In-App Purchases (Skip if in Expo Go)
    if (Constants.appOwnership !== 'expo') {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      if (Platform.OS === 'android') {
        Purchases.configure({ apiKey: "goog_luYileuwzYYGXaCLgqyUUIXigxp" });
      }
    }
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  // The splash owns its own exit: it plays its intro, waits for `ready`, then
  // animates out and calls back. Passing `loaded` here is what stops a slow
  // font load from leaving a faded-out splash on screen.
  if (!loaded || showSplash) {
    return <AnimatedSplash onFinish={handleSplashFinish} ready={loaded} />;
  }

  return <RootLayoutNav />;
}

import { CustomAlertProvider } from '@/components/CustomAlert';
import { SemesterProvider } from '@/components/SemesterContext';
import { SyncProvider } from '@/components/SyncProvider';
import UpdateWarningModal from '@/components/UpdateWarningModal';
import ChangelogModal from '@/components/ChangelogModal';
import SpotlightProvider from '@/components/spotlight/SpotlightProvider';

function RootLayoutNav() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const navTheme = isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, primary: '#818cf8', background: '#0f172a', card: '#1e293b', text: '#f1f5f9', border: '#334155', notification: '#818cf8' } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: '#6366f1', background: '#f8fafc', card: '#ffffff', text: '#1e293b', border: '#e2e8f0', notification: '#6366f1' } };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SyncProvider>
        <SemesterProvider>
          <SpotlightProvider>
          <Stack screenOptions={{ animation: 'slide_from_right' }}>
            <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="welcome" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="login" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack>
          </SpotlightProvider>
          <CustomAlertProvider />
          <ChangelogModal />
        </SemesterProvider>
      </SyncProvider>
    </ThemeProvider>
  );
}
