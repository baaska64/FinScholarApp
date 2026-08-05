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
import { supabase } from '../services/supabaseClient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

  function handleGoogleSignIn() {
    // Dummy handler — ready for future @react-native-google-signin integration
    console.log('[FinScholar] Google Sign-In tapped — not yet implemented');
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
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Forgot Password (Sign In mode only) */}
                {isLogin && (
                  <TouchableOpacity onPress={handleResetPassword} disabled={loading} style={{ alignSelf: 'flex-end', marginTop: 10 }}>
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#6366f1' }}>
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
                  opacity: loading ? 0.7 : 1,
                  ...Platform.select({
                    ios: { shadowColor: BRAND.primaryBtn, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 },
                    android: { elevation: 6 },
                  }),
                }}
                disabled={loading}
                onPress={handleAuth}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Text style={{ color: '#ffffff', fontFamily: 'Nunito_900Black', fontSize: 16, marginRight: 8 }}>
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
                  }}
                >
                  or
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: isDark ? '#2d2f54' : '#e2e2f0' }} />
              </View>

              {/* ─── Continue with Google (Dummy) ─── */}
              <TouchableOpacity
                style={{
                  height: 54, borderRadius: 16,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isDark ? BRAND.googleBgDark : BRAND.googleBgLight,
                  borderWidth: 1.5,
                  borderColor: isDark ? BRAND.googleBorderDark : BRAND.googleBorderLight,
                }}
                onPress={handleGoogleSignIn}
                activeOpacity={0.7}
              >
                {/* Google "G" Icon */}
                <View style={{ marginRight: 12 }}>
                  <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18, fontFamily: 'Nunito_900Black', color: '#4285F4' }}>G</Text>
                  </View>
                </View>
                <Text
                  style={{
                    fontFamily: 'Nunito_700Bold',
                    fontSize: 15,
                    color: textPrimary,
                  }}
                >
                  Continue with Google
                </Text>
                <Ionicons name="arrow-forward" size={16} color={textSecondary} style={{ marginLeft: 8 }} />
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
