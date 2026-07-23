import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StatusBar, Platform, ScrollView, Animated, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import Svg, { Defs, LinearGradient, Stop, Rect, RadialGradient } from 'react-native-svg';
import { AlertService } from '@/components/CustomAlert';
import { getTheme, Radius, Typography } from '@/constants/Theme';

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
  const logoAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance
    Animated.parallel([
      Animated.spring(logoAnim, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true, delay: 100 }),
      Animated.spring(cardAnim, { toValue: 1, friction: 7, tension: 40, useNativeDriver: true, delay: 250 }),
    ]).start();

    // Floating logo loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration: 2000, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
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
    <View style={{ flex: 1, backgroundColor: isDark ? '#0f172a' : '#f8fafc' }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* Decorative SVG Background */}
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 0 }}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={isDark ? "#0f172a" : "#f8fafc"} stopOpacity="1" />
              <Stop offset="100%" stopColor={isDark ? "#1e1b4b" : "#e0e7ff"} stopOpacity="1" />
            </LinearGradient>
            <RadialGradient id="rad1" cx="20%" cy="10%" r="50%" fx="20%" fy="10%">
              <Stop offset="0%" stopColor={isDark ? "#4c1d95" : "#a5b4fc"} stopOpacity="0.8" />
              <Stop offset="100%" stopColor={isDark ? "#4c1d95" : "#a5b4fc"} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="rad2" cx="80%" cy="80%" r="60%" fx="80%" fy="80%">
              <Stop offset="0%" stopColor={isDark ? "#1d4ed8" : "#93c5fd"} stopOpacity="0.6" />
              <Stop offset="100%" stopColor={isDark ? "#1d4ed8" : "#93c5fd"} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="rad3" cx="90%" cy="20%" r="40%" fx="90%" fy="20%">
              <Stop offset="0%" stopColor={isDark ? "#be185d" : "#fbcfe8"} stopOpacity="0.4" />
              <Stop offset="100%" stopColor={isDark ? "#be185d" : "#fbcfe8"} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#grad1)" />
          <Rect width="100%" height="100%" fill="url(#rad1)" />
          <Rect width="100%" height="100%" fill="url(#rad2)" />
          <Rect width="100%" height="100%" fill="url(#rad3)" />
        </Svg>
      </View>

      {/* Theme Toggle Button */}
      <TouchableOpacity 
        onPress={toggleColorScheme}
        style={{
          position: 'absolute', top: 56, right: 24, zIndex: 50,
          padding: 14, borderRadius: Radius.full,
          backgroundColor: isDark ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.9)',
          borderWidth: 1, borderColor: isDark ? '#334155' : '#f1f5f9',
          ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 }, android: { elevation: 4 } }),
        }}
      >
        <Ionicons name={isDark ? 'sunny' : 'moon'} size={22} color={isDark ? '#fbbf24' : '#64748b'} />
      </TouchableOpacity>

      <ScrollView 
        style={{ flex: 1, zIndex: 10 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, paddingVertical: 80 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo & Branding */}
        <Animated.View
          style={{
            alignItems: 'center', marginBottom: 40, zIndex: 10,
            opacity: logoAnim,
            transform: [{ translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          }}
        >
          <Animated.View
            style={{
              width: 128, height: 128, borderRadius: 64, alignItems: 'center', justifyContent: 'center',
              marginBottom: 28, overflow: 'hidden',
              backgroundColor: isDark ? '#312e81' : '#ffffff',
              borderWidth: 4, borderColor: isDark ? '#6366f1' : '#ffffff',
              transform: [{ translateY: floatAnim }],
              ...Platform.select({ ios: { shadowColor: '#6366f1', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 }, android: { elevation: 8 } }),
            }}
          >
            <Image 
              source={require('../assets/images/FinLogo.png')} 
              style={{ width: 140, height: 140, transform: [{ scale: 1.65 }, { translateY: 12 }] }}
              resizeMode="contain"
            />
          </Animated.View>
          <Text style={{ ...Typography.display, color: isDark ? '#ffffff' : '#1e293b', letterSpacing: -1, marginBottom: 10 }}>
            FinScholar
          </Text>
          <Text style={{ ...Typography.body, color: isDark ? '#94a3b8' : '#64748b', textAlign: 'center', paddingHorizontal: 24 }}>
            Your friendly academic companion.{'\n'}Track your grades, beat those deadlines! 🐬
          </Text>
        </Animated.View>
        
        {/* Auth Card */}
        <Animated.View
          style={{
            padding: 32, borderRadius: Radius['4xl'], zIndex: 10,
            backgroundColor: isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.97)',
            borderWidth: 1, borderColor: isDark ? '#334155' : 'rgba(255,255,255,0.8)',
            opacity: cardAnim,
            transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
            ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24 }, android: { elevation: 8 } }),
          }}
        >
          {/* Email Field */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ ...Typography.label, textTransform: 'uppercase', letterSpacing: 1.5, color: isDark ? '#818cf8' : '#4f46e5', marginBottom: 8, marginLeft: 4 }}>
              Email Address
            </Text>
            <Animated.View
              style={{
                flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16,
                borderRadius: Radius.xl,
                borderWidth: 2,
                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                borderColor: emailFocused ? (isDark ? '#818cf8' : '#6366f1') : (isDark ? '#334155' : '#e2e8f0'),
              }}
            >
              <Ionicons name="mail" size={20} color={emailFocused ? (isDark ? '#818cf8' : '#6366f1') : (isDark ? '#64748b' : '#94a3b8')} style={{ marginRight: 12 }} />
              <TextInput
                style={{ flex: 1, fontSize: 16, fontFamily: 'Nunito_400Regular', color: isDark ? '#ffffff' : '#1e293b' }}
                onChangeText={setEmail}
                value={email}
                placeholder="student@university.edu"
                placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                autoCapitalize="none"
                keyboardType="email-address"
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </Animated.View>
          </View>

          {/* Password Field */}
          <View style={{ marginBottom: 8 }}>
            <Text style={{ ...Typography.label, textTransform: 'uppercase', letterSpacing: 1.5, color: isDark ? '#818cf8' : '#4f46e5', marginBottom: 8, marginLeft: 4 }}>
              Password
            </Text>
            <Animated.View
              style={{
                flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16,
                borderRadius: Radius.xl,
                borderWidth: 2,
                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                borderColor: passwordFocused ? (isDark ? '#818cf8' : '#6366f1') : (isDark ? '#334155' : '#e2e8f0'),
              }}
            >
              <Ionicons name="lock-closed" size={20} color={passwordFocused ? (isDark ? '#818cf8' : '#6366f1') : (isDark ? '#64748b' : '#94a3b8')} style={{ marginRight: 12 }} />
              <TextInput
                style={{ flex: 1, fontSize: 16, fontFamily: 'Nunito_400Regular', color: isDark ? '#ffffff' : '#1e293b' }}
                onChangeText={setPassword}
                value={password}
                secureTextEntry={!showPassword}
                placeholder="••••••••"
                placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                autoCapitalize="none"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={isDark ? '#64748b' : '#94a3b8'} />
              </TouchableOpacity>
            </Animated.View>
            
            {isLogin && (
              <TouchableOpacity onPress={handleResetPassword} disabled={loading} style={{ alignSelf: 'flex-end', marginTop: 12 }}>
                <Text style={{ ...Typography.captionBold, color: isDark ? '#818cf8' : '#4f46e5' }}>Forgot Password?</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Auth Button */}
          <TouchableOpacity 
            style={{
              marginTop: 24, height: 56, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row',
              backgroundColor: isDark ? '#6366f1' : '#4f46e5',
              opacity: loading ? 0.8 : 1,
              ...Platform.select({ ios: { shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 }, android: { elevation: 6 } }),
            }}
            disabled={loading}
            onPress={handleAuth}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Text style={{ color: '#ffffff', fontFamily: 'Nunito_900Black', fontSize: 18, marginRight: 8, letterSpacing: 0.5 }}>
                  {isLogin ? 'Sign In' : 'Create Account'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>

          {/* Toggle Auth Mode */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
            <Text style={{ ...Typography.body, color: isDark ? '#94a3b8' : '#64748b' }}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
            </Text>
            <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
              <Text style={{ ...Typography.bodyBold, color: isDark ? '#818cf8' : '#4f46e5' }}>
                {isLogin ? 'Sign up free' : 'Sign in'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 20 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: isDark ? '#334155' : '#e2e8f0' }} />
            <Text style={{ ...Typography.caption, color: isDark ? '#64748b' : '#94a3b8', marginHorizontal: 16 }}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: isDark ? '#334155' : '#e2e8f0' }} />
          </View>

          {/* Guest Access - Ghost Button */}
          <TouchableOpacity 
            style={{
              paddingVertical: 14, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: isDark ? '#334155' : '#e2e8f0',
              backgroundColor: 'transparent',
            }}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.7}
          >
            <Text style={{ ...Typography.bodyBold, color: isDark ? '#cbd5e1' : '#475569' }}>
              Continue without logging in
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
