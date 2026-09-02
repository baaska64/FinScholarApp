import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { View, ActivityIndicator } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { OnboardingService } from '../services/OnboardingService';
import { ALL_TOUR_KEYS } from '../constants/tours';

export default function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Listen for auth state changes FIRST — this fires on TOKEN_REFRESHED,
    // SIGNED_IN, SIGNED_OUT, etc. and is the reliable source of truth.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (cancelled) return;
        setSession(session);

        // Only a genuinely fresh install sees the intro. Anyone with a session
        // or an existing local ledger is silently marked as already onboarded
        // so an update never drops them back into the first-run flow.
        const firstRun = await OnboardingService.isFirstRun();
        if (cancelled) return;
        if (firstRun && !session) {
          setShowOnboarding(true);
        } else {
          setShowOnboarding(false);
          OnboardingService.markExistingUserOnboarded(ALL_TOUR_KEYS);
        }
        setLoading(false);
      }
    );

    // Kick off a session check. If the stored refresh token is still valid,
    // Supabase will auto-refresh the access token and fire onAuthStateChange
    // with the fresh session. If no session exists at all, onAuthStateChange
    // fires with null. Either way, loading will be set to false above.
    //
    // We set a safety timeout in case onAuthStateChange doesn't fire
    // (e.g. no network + no stored session).
    const safetyTimer = setTimeout(async () => {
      const firstRun = await OnboardingService.isFirstRun();
      if (cancelled) return;
      setLoading((prev) => {
        if (prev) {
          // Still loading after 3s — no session, let them through
          setSession(null);
          setShowOnboarding(firstRun);
          if (!firstRun) OnboardingService.markExistingUserOnboarded(ALL_TOUR_KEYS);
          return false;
        }
        return prev;
      });
    }, 3000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-900">
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  if (showOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/welcome" />;
}
