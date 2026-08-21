import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  ScrollView,
  Animated,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import { supabase } from '../services/supabaseClient';
import { configureGoogleSignIn, getGoogleWebClientId } from '../services/googleAuth';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useColorScheme } from 'nativewind';
import { AlertService } from '@/components/CustomAlert';
import { getTheme } from '@/constants/Theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Brand Palette (no gradients — solid, bold, original) ───────────────────
const BRAND = {
  // Deep navy-indigo hero zone
  heroDark: '#12103d',
  heroLight: '#f0f0ff',
  // Accent blobs
  blobIndigo: '#4f46e5',
  blobSky: '#38bdf8',
  blobViolet: '#7c3aed',
  blobTeal: '#14b8a6',
  // Card
  cardLight: '#ffffff',
  cardDark: '#1a1f3d',
  cardBorderLight: '#e8e8f4',
  cardBorderDark: '#2d2f54',
  // Inputs
  inputBgLight: '#f7f7fd',
  inputBgDark: '#12103d',
  inputBorderLight: '#e2e2f0',
  inputBorderDark: '#2d2f54',
  inputFocusBorder: '#6366f1',
  // Primary button
  primaryBtn: '#4f46e5',
  primaryBtnPressed: '#4338ca',
  // Text
  textHeroTitle: '#ffffff',
  textHeroSub: 'rgba(255,255,255,0.75)',
  textDarkTitle: '#ffffff',
  textDarkSub: 'rgba(255,255,255,0.6)',
  // Google button
  googleBorderLight: '#e2e2f0',
  googleBorderDark: '#2d2f54',
  googleBgLight: '#ffffff',
  googleBgDark: '#1a1f3d',
};

export default function LoginScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(mode !== 'signup');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const { colorScheme } = useColorScheme();
  
  // Force light mode per user request
  const isDark = false;
  const theme = getTheme(isDark);

  // ─── Animations ──────────────────────────────────────────────────────────
  const mascotFloat = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(0)).current;
  const headerFade = useRef(new Animated.Value(0)).current;
  const blob1Scale = useRef(new Animated.Value(0.7)).current;
  const blob2Scale = useRef(new Animated.Value(0.6)).current;
  const blob3Scale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    // Mascot floating loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(mascotFloat, { toValue: -10, duration: 1800, useNativeDriver: true }),
        Animated.timing(mascotFloat, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();

    // Entrance animations
    Animated.stagger(120, [
      Animated.spring(headerFade, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.spring(blob1Scale, { toValue: 1, friction: 5, tension: 30, useNativeDriver: true }),
      Animated.spring(blob2Scale, { toValue: 1, friction: 5, tension: 30, useNativeDriver: true }),
      Animated.spring(blob3Scale, { toValue: 1, friction: 5, tension: 30, useNativeDriver: true }),
      Animated.spring(cardSlide, { toValue: 1, friction: 7, tension: 35, useNativeDriver: true }),
    ]).start();

    // Initialize Google Sign-In configuration robustly
    configureGoogleSignIn();
  }, []);

  // ─── Auth Handlers (unchanged logic) ─────────────────────────────────────
  async function handleResetPassword() {
    if (!email) {
      AlertService.alert('Missing Email', 'Please enter your email address in the field above to reset your password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      AlertService.alert('Reset Failed', error.message);
    } else {
      AlertService.alert('Email Sent', 'Check your inbox for the password reset link!');
    }
    setLoading(false);
  }

  async function handleAuth() {
    setLoading(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        AlertService.alert('Login Failed', error.message);
      } else {
        router.replace('/(tabs)');
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        AlertService.alert('Signup Failed', error.message);
      } else {
        AlertService.alert('Signup Successful', 'Please check your email for the verification link!');
      }
    }
    setLoading(false);
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      const webClientId = configureGoogleSignIn();

      if (!webClientId) {
        AlertService.alert(
          'Google Sign-In Setup Required',
          'Google Web Client ID is not configured. Please check your configuration.'
        );
        return;
      }

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      if (response?.type === 'cancelled') {
        return;
      }

      let idToken: string | null | undefined = null;
      if (isSuccessResponse(response)) {
        idToken = response.data.idToken;
      } else if (response && 'data' in response && (response as any).data?.idToken) {
        idToken = (response as any).data.idToken;
      } else if (response && (response as any).idToken) {
        idToken = (response as any).idToken;
      }

      if (!idToken) {
        AlertService.alert(
          'Sign-In Incomplete',
          'Could not obtain Google ID token. Please verify your Google Cloud Console configuration.'
        );
        return;
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        AlertService.alert('Google Sign-In Failed', error.message);
      } else if (data?.session) {
        router.replace('/(tabs)');
      } else if (data?.user) {
        AlertService.alert('Sign-In Successful', 'Please check your email to complete verification if required.');
      } else {
        AlertService.alert('Google Sign-In Incomplete', 'Unable to start session. Please try again.');
      }
    } catch (error: any) {
      const errorString =
        typeof error === 'string'
          ? error
          : typeof error?.message === 'string'
          ? error.message
          : String(error ?? '');

      const isCode10 =
        error?.code === 10 ||
        error?.code === '10' ||
        String(error?.code) === '10' ||
        error?.code === 'DEVELOPER_ERROR' ||
        errorString.includes('10') ||
        errorString.toLowerCase().includes('developer error') ||
        errorString.toLowerCase().includes('developer_error');

      const genericErrorMessage =
        (typeof error === 'string' ? error : error?.message) ||
        'An unexpected error occurred during Google Sign-In.';

      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            // User cancelled the sign-in flow
            break;
          case statusCodes.IN_PROGRESS:
            AlertService.alert('Sign-In In Progress', 'Google Sign-In is already in progress.');
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            AlertService.alert(
              'Play Services Unavailable',
              'Google Play Services is not available or outdated on this device. Please update Play Services and try again.'
            );
            break;
          default:
            if (isCode10) {
              AlertService.alert(
                'Configuration Error (Code 10)',
                'Developer Error: Check that the SHA-1 fingerprint (5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25) and package name (com.lalex.finscholar) match your Google Cloud Console Android Client ID.'
              );
            } else {
              AlertService.alert('Google Sign-In Error', genericErrorMessage);
            }
        }
      } else if (isCode10) {
        AlertService.alert(
          'Configuration Error (Code 10)',
          'Developer Error: Check that the SHA-1 fingerprint (5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25) and package name (com.lalex.finscholar) match your Google Cloud Console Android Client ID.'
        );
      } else {
        AlertService.alert('Google Sign-In Error', genericErrorMessage);
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  // ─── Derived Styles ──────────────────────────────────────────────────────
  const heroZoneBg = isDark ? BRAND.heroDark : BRAND.blobIndigo;
  const cardBg = isDark ? BRAND.cardDark : BRAND.cardLight;
  const cardBorder = isDark ? BRAND.cardBorderDark : BRAND.cardBorderLight;
  const inputBg = isDark ? BRAND.inputBgDark : BRAND.inputBgLight;
  const inputBorder = isDark ? BRAND.inputBorderDark : BRAND.inputBorderLight;
  const labelColor = isDark ? '#a5b4fc' : '#64748b';
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const pageBg = isDark ? '#0c0b2b' : '#f0f0ff';

  // Hero zone height
  const HERO_H = SCREEN_H * 0.45;
  const CARD_OVERLAP = 32;

  return (
    <View style={{ flex: 1, backgroundColor: pageBg }}>
      <StatusBar barStyle="light-content" />

      {/* ─── Theme Toggle Removed (Forced Light Mode) ─── */}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* ═══════════════════════════════════════════════════════════════════
              HERO ZONE — Solid branded background with decorative blobs + mascot
              ═══════════════════════════════════════════════════════════════════ */}
          <View
            style={{
              height: HERO_H + CARD_OVERLAP,
              backgroundColor: heroZoneBg,
              overflow: 'visible', // Changed from hidden to prevent clipping the mascot's graduation cap
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
            }}
          >
            {/* ─── Subtle Decorative Blobs ─── */}
            <Animated.View
              style={{
                position: 'absolute', top: -60, left: -70,
                width: 140, height: 140, borderRadius: 70,
                backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.06)',
                transform: [{ scale: blob1Scale }],
              }}
            />
            <Animated.View
              style={{
                position: 'absolute', top: 10, right: -50,
                width: 100, height: 100, borderRadius: 50,
                backgroundColor: isDark ? 'rgba(124,58,237,0.06)' : 'rgba(255,255,255,0.04)',
                transform: [{ scale: blob2Scale }],
              }}
            />

            {/* ─── Mascot + Branding Content ─── */}
            <Animated.View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: Platform.OS === 'ios' ? 80 : 70,
                paddingBottom: CARD_OVERLAP + 10,
                opacity: headerFade,
                transform: [{ translateY: headerFade.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }],
              }}
            >
              {/* Mascot */}
              <Animated.View
                style={{
                  transform: [{ translateY: mascotFloat }],
                  marginBottom: 10,
                }}
              >
                <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
                  <Image
                    source={require('../assets/images/loginfin.png')}
                    style={{ width: SCREEN_W * 0.7, height: SCREEN_W * 0.7, position: 'absolute' }}
                    resizeMode="contain"
                  />
                </View>
              </Animated.View>

              {/* Title */}
              <Text
                style={{
                  fontFamily: 'Nunito_900Black',
                  fontSize: 32,
                  color: BRAND.textHeroTitle,
                  letterSpacing: -0.5,
                  textAlign: 'center',
                  width: '100%',
                }}
              >
                FinScholar
              </Text>

              {/* Tagline */}
              <Text
                style={{
                  fontFamily: 'Nunito_600SemiBold',
                  fontSize: 14,
                  color: BRAND.textHeroSub,
                  marginTop: 4,
                  textAlign: 'center',
                }}
              >
                Your friendly academic companion 🐬
              </Text>
            </Animated.View>
          </View>

          {/* ═══════════════════════════════════════════════════════════════════
              FORM ZONE — Overlapping card with auth form
              ═══════════════════════════════════════════════════════════════════ */}
          <Animated.View
            style={{
              marginTop: -CARD_OVERLAP,
              paddingHorizontal: 20,
              paddingBottom: 40,
              opacity: cardSlide,
              transform: [{ translateY: cardSlide.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }],
            }}
          >
            {/* ─── Main Auth Card ─── */}
            <View
              style={{
                padding: 24,
                borderRadius: 28,
                backgroundColor: cardBg,
                borderWidth: 1,
                borderColor: cardBorder,
                ...Platform.select({
                  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: isDark ? 0.4 : 0.1, shadowRadius: 20 },
                  android: { elevation: isDark ? 12 : 8 },
                }),
              }}
            >
              {/* ─── Sign In / Sign Up Toggle ─── */}
              <View
                style={{
                  flexDirection: 'row',
                  marginBottom: 24,
                  backgroundColor: isDark ? '#0c0b2b' : '#ededfa',
                  borderRadius: 14,
                  padding: 4,
                }}
              >
                <TouchableOpacity
                  onPress={() => setIsLogin(true)}
                  style={{
                    flex: 1, paddingVertical: 12, borderRadius: 11, alignItems: 'center',
                    backgroundColor: isLogin ? BRAND.primaryBtn : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Nunito_800ExtraBold',
                      fontSize: 14,
                      color: isLogin ? '#ffffff' : textSecondary,
                      textAlign: 'center',
                      width: '100%',
                    }}
                  >
                    Sign In
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsLogin(false)}
                  style={{
                    flex: 1, paddingVertical: 12, borderRadius: 11, alignItems: 'center',
                    backgroundColor: !isLogin ? BRAND.primaryBtn : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Nunito_800ExtraBold',
                      fontSize: 14,
                      color: !isLogin ? '#ffffff' : textSecondary,
                      textAlign: 'center',
                      width: '100%',
                    }}
                  >
                    Sign Up
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ─── Email Field ─── */}
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontFamily: 'Nunito_700Bold',
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                    color: labelColor,
                    marginBottom: 8,
                    marginLeft: 2,
                  }}
                >
                  Email
                </Text>
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 54,
                    borderRadius: 16, borderWidth: 1.5,
                    backgroundColor: inputBg,
                    borderColor: emailFocused ? BRAND.inputFocusBorder : inputBorder,
                  }}
                >
                  <Ionicons
                    name="mail-outline"
                    size={19}
                    color={emailFocused ? BRAND.inputFocusBorder : textSecondary}
                    style={{ marginRight: 12 }}
                  />
                    <TextInput
                      style={{
                        flex: 1, fontSize: 15, fontFamily: 'Nunito_600SemiBold',
                        color: textPrimary, padding: 0,
                      }}
                      onChangeText={setEmail}
                      value={email}
                      placeholder="student@university.edu"
                      placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      textContentType="username"
                      autoComplete="username"
                      importantForAutofill="yes"
                      nativeID="email"
                      accessibilityLabel="Email address"
                    />
                </View>
              </View>

              {/* ─── Password Field ─── */}
              <View style={{ marginBottom: 6 }}>
                <Text
                  style={{
                    fontFamily: 'Nunito_700Bold',
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                    color: labelColor,
                    marginBottom: 8,
                    marginLeft: 2,
                  }}
                >
                  Password
                </Text>
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 54,
                    borderRadius: 16, borderWidth: 1.5,
                    backgroundColor: inputBg,
                    borderColor: passwordFocused ? BRAND.inputFocusBorder : inputBorder,
                  }}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={19}
                    color={passwordFocused ? BRAND.inputFocusBorder : textSecondary}
                    style={{ marginRight: 12 }}
                  />
                  <TextInput
                    style={{
                      flex: 1, fontSize: 15, fontFamily: 'Nunito_600SemiBold',
                      color: textPrimary, padding: 0,
                    }}
                    onChangeText={setPassword}
                    value={password}
                    secureTextEntry={!showPassword}
                    placeholder="••••••••"
                    placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                    autoCapitalize="none"
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    textContentType={isLogin ? 'password' : 'newPassword'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    importantForAutofill="yes"
                    nativeID="password"
                    accessibilityLabel="Password"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Forgot Password (Sign In mode only) */}
                {isLogin && (
                  <TouchableOpacity 
                    onPress={handleResetPassword} 
                    disabled={loading || googleLoading} 
                    style={{ 
                      marginTop: 8,
                      width: '100%',
                      alignItems: 'flex-end',
                      paddingVertical: 8,
                    }}
                  >
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, color: '#6366f1' }}>
                      Forgot password?
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* ─── Primary Auth Button ─── */}
              <TouchableOpacity
                style={{
                  marginTop: 22, height: 54, borderRadius: 16,
                  alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
                  backgroundColor: BRAND.primaryBtn,
                  opacity: loading || googleLoading ? 0.7 : 1,
                  ...Platform.select({
                    ios: { shadowColor: BRAND.primaryBtn, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 },
                    android: { elevation: 6 },
                  }),
                }}
                disabled={loading || googleLoading}
                onPress={handleAuth}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Text style={{ color: '#ffffff', fontFamily: 'Nunito_900Black', fontSize: 16, marginRight: 8, paddingHorizontal: 6 }}>
                      {isLogin ? 'Sign In' : 'Create Account'}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                  </>
                )}
              </TouchableOpacity>

              {/* ─── "or" Divider ─── */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: isDark ? '#2d2f54' : '#e2e2f0' }} />
                <Text
                  style={{
                    marginHorizontal: 14,
                    fontFamily: 'Nunito_600SemiBold',
                    fontSize: 12,
                    color: textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    width: 30,
                    textAlign: 'center',
                  }}
                >
                  or
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: isDark ? '#2d2f54' : '#e2e2f0' }} />
              </View>

              {/* ─── Continue with Google ─── */}
              <TouchableOpacity
                style={{
                  height: 54, borderRadius: 16,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isDark ? BRAND.googleBgDark : BRAND.googleBgLight,
                  borderWidth: 1.5,
                  borderColor: isDark ? BRAND.googleBorderDark : BRAND.googleBorderLight,
                  opacity: googleLoading ? 0.7 : 1,
                }}
                disabled={loading || googleLoading}
                onPress={handleGoogleSignIn}
                activeOpacity={0.7}
              >
                {googleLoading ? (
                  <ActivityIndicator color={isDark ? '#ffffff' : BRAND.primaryBtn} size="small" />
                ) : (
                  <>
                    {/* Google SVG Logo */}
                    <View style={{ marginRight: 12 }}>
                      <Svg width="22" height="22" viewBox="0 0 48 48">
                        <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"/>
                        <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                        <Path fill="none" d="M0 0h48v48H0z"/>
                      </Svg>
                    </View>
                    <Text
                      style={{
                        fontFamily: 'Nunito_700Bold',
                        fontSize: 15,
                        color: textPrimary,
                        paddingHorizontal: 4,
                      }}
                    >
                      Continue with Google
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color={textSecondary} style={{ marginLeft: 8 }} />
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* ─── Guest Access ─── */}
            <TouchableOpacity
              style={{ marginTop: 20, paddingVertical: 16, alignItems: 'center' }}
              onPress={() => router.replace('/(tabs)')}
              activeOpacity={0.7}
            >
              <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, color: textSecondary }}>
                Continue without logging in
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
