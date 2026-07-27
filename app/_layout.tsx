import { useFonts as useExpoFonts } from 'expo-font';
import { useFonts, Nunito_400Regular, Nunito_700Bold, Nunito_900Black } from '@expo-google-fonts/nunito';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import './global.css';

import { NotificationService } from '../services/NotificationService';
import { widgetTaskHandler } from '../widget/WidgetTaskHandler';
import { LogBox, View, ActivityIndicator, Text, Appearance, Image, Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

LogBox.ignoreLogs(['Unable to activate keep awake']);

import { useColorScheme } from 'nativewind';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loadedNative, errorNative] = useExpoFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [loadedNunito, errorNunito] = useFonts({
    Nunito_400Regular,
    Nunito_700Bold,
    Nunito_900Black,
  });

  const loaded = loadedNative && loadedNunito;
  const error = errorNative || errorNunito;

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    NotificationService.initNotifications();
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
    // Hide native splash screen immediately to show our beautiful custom React Native loading screen
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    // Initialize RevenueCat for In-App Purchases
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    if (Platform.OS === 'android') {
      Purchases.configure({ apiKey: "goog_luYileuwzYYGXaCLgqyUUIXigxp" });
    }
  }, []);

  if (!loaded) {
    const isDark = Appearance.getColorScheme() === 'dark';
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#0f172a' : '#f8fafc', justifyContent: 'center', alignItems: 'center' }}>
        <Image
          source={require('../assets/images/icon.png')}
          style={{ width: 120, height: 120 }}
          resizeMode="contain"
        />
        <Text style={{ marginTop: 20, color: isDark ? '#f1f5f9' : '#1e293b', fontSize: 24, fontFamily: 'Nunito_900Black', letterSpacing: 0.5 }}>
          FinScholar
        </Text>
        <ActivityIndicator size="small" color={isDark ? '#818cf8' : '#6366f1'} style={{ marginTop: 28 }} />
      </View>
    );
  }

  return <RootLayoutNav />;
}

import { CustomAlertProvider } from '@/components/CustomAlert';
import { SemesterProvider } from '@/components/SemesterContext';
import { SyncProvider } from '@/components/SyncProvider';

function RootLayoutNav() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const navTheme = isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, primary: '#818cf8', background: '#0f172a', card: '#1e293b', text: '#f1f5f9', border: '#334155', notification: '#818cf8' } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: '#6366f1', background: '#f8fafc', card: '#ffffff', text: '#1e293b', border: '#e2e8f0', notification: '#6366f1' } };

  return (
    <ThemeProvider value={navTheme}>
      <SyncProvider>
        <SemesterProvider>
          <Stack screenOptions={{ animation: 'slide_from_right' }}>
            <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack>
          <CustomAlertProvider />
        </SemesterProvider>
      </SyncProvider>
    </ThemeProvider>
  );
}
