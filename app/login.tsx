import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StatusBar, Platform, ScrollView, Animated, ActivityIndicator, Dimensions, KeyboardAvoidingView } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { AlertService } from '@/components/CustomAlert';
import { getTheme, Radius, Typography } from '@/constants/Theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const { colorScheme, toggleColorScheme } = useColorScheme();

  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);

  // Entrance animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerAnim, { toValue: 1, friction: 7, tension: 40, useNativeDriver: true, delay: 50 }),
      Animated.spring(formAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true, delay: 200 }),
    ]).start();
  }, []);

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

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#0f172a' : '#ffffff' }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Theme Toggle */}
      <TouchableOpacity
        onPress={toggleColorScheme}
        style={{
          position: 'absolute', top: 56, right: 24, zIndex: 50,
          width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
          backgroundColor: isDark ? 'rgba(30,41,59,0.9)' : 'rgba(241,245,249,0.95)',
          borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0',
        }}
      >
        <Ionicons name={isDark ? 'sunny' : 'moon'} size={20} color={isDark ? '#fbbf24' : '#64748b'} />
      </TouchableOpacity>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* ─── Header / Branding Area ─── */}
          <Animated.View
            style={{
              alignItems: 'center', paddingTop: SCREEN_H * 0.12, paddingBottom: 28,
              opacity: headerAnim,
              transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            }}
          >
            {/* Logo */}
            <View
              style={{
                width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isDark ? '#1e1b4b' : '#eef2ff',
                borderWidth: 3, borderColor: isDark ? '#4338ca' : '#c7d2fe',
                marginBottom: 20, overflow: 'hidden',
                ...Platform.select({ ios: { shadowColor: '#6366f1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12 }, android: { elevation: 6 } }),
              }}
            >
              <Image
                source={require('../assets/images/FinLogo.png')}
                style={{ width: 120, height: 120, transform: [{ scale: 1.45 }, { translateY: 18 }] }}
                resizeMode="contain"
              />
            </View>
            <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 30, color: isDark ? '#ffffff' : '#1e293b', letterSpacing: -0.5 }}>
              FinScholar
            </Text>
            <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: isDark ? '#94a3b8' : '#64748b', marginTop: 6, textAlign: 'center', paddingHorizontal: 40 }}>
              Your friendly academic companion 🐬
            </Text>
          </Animated.View>

          {/* ─── Form Area ─── */}
          <Animated.View
            style={{
              flex: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40,
              opacity: formAnim,
              transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
            }}
          >
            {/* Card */}
            <View
              style={{
                padding: 28, borderRadius: 28,
                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0',
              }}
            >
              {/* Mode Toggle Tabs */}
              <View style={{ flexDirection: 'row', marginBottom: 24, backgroundColor: isDark ? '#0f172a' : '#e2e8f0', borderRadius: 14, padding: 4 }}>
                <TouchableOpacity
                  onPress={() => setIsLogin(true)}
                  style={{
                    flex: 1, paddingVertical: 12, borderRadius: 11, alignItems: 'center',
                    backgroundColor: isLogin ? (isDark ? '#4338ca' : '#4f46e5') : 'transparent',
                  }}
                >
                  <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: isLogin ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b') }}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsLogin(false)}
                  style={{
                    flex: 1, paddingVertical: 12, borderRadius: 11, alignItems: 'center',
                    backgroundColor: !isLogin ? (isDark ? '#4338ca' : '#4f46e5') : 'transparent',
                  }}
                >
                  <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: !isLogin ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b') }}>Sign Up</Text>
                </TouchableOpacity>
              </View>

              {/* Email Field */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 8, marginLeft: 2 }}>
                  Email
                </Text>
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 54,
                    borderRadius: 16, borderWidth: 1.5,
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: emailFocused ? '#6366f1' : (isDark ? '#334155' : '#e2e8f0'),
                  }}
                >
                  <Ionicons name="mail-outline" size={19} color={emailFocused ? '#6366f1' : (isDark ? '#64748b' : '#94a3b8')} style={{ marginRight: 12 }} />
                  <TextInput
                    style={{ flex: 1, fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: isDark ? '#f1f5f9' : '#1e293b', padding: 0 }}
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

              {/* Password Field */}
              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 8, marginLeft: 2 }}>
                  Password
                </Text>
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 54,
                    borderRadius: 16, borderWidth: 1.5,
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: passwordFocused ? '#6366f1' : (isDark ? '#334155' : '#e2e8f0'),
                  }}
                >
                  <Ionicons name="lock-closed-outline" size={19} color={passwordFocused ? '#6366f1' : (isDark ? '#64748b' : '#94a3b8')} style={{ marginRight: 12 }} />
                  <TextInput
                    style={{ flex: 1, fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: isDark ? '#f1f5f9' : '#1e293b', padding: 0 }}
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
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={isDark ? '#64748b' : '#94a3b8'} />
                  </TouchableOpacity>
                </View>

                {isLogin && (
                  <TouchableOpacity onPress={handleResetPassword} disabled={loading} style={{ alignSelf: 'flex-end', marginTop: 10 }}>
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#6366f1' }}>Forgot password?</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Auth Button */}
              <TouchableOpacity
                style={{
                  marginTop: 22, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'row', backgroundColor: '#4f46e5',
                  opacity: loading ? 0.7 : 1,
                  ...Platform.select({ ios: { shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 }, android: { elevation: 5 } }),
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
            </View>

            {/* Guest Access */}
            <TouchableOpacity
              style={{ marginTop: 20, paddingVertical: 16, alignItems: 'center' }}
              onPress={() => router.replace('/(tabs)')}
              activeOpacity={0.7}
            >
              <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, color: isDark ? '#94a3b8' : '#64748b' }}>
                Continue without logging in
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
