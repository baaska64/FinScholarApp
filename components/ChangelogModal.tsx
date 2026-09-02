import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Dimensions, StyleSheet, ImageBackground } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { triggerHaptic } from './tasks/utils';
import Constants from 'expo-constants';
import { OnboardingService } from '../services/OnboardingService';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const CHANGELOG_KEY = '@changelog_last_seen_version';
const CURRENT_VERSION = Constants.expoConfig?.version || '1.0.7';

export default function ChangelogModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const lastSeenVersion = await AsyncStorage.getItem(CHANGELOG_KEY);
        if (lastSeenVersion === CURRENT_VERSION) return;

        // Nothing is "new" on a fresh install — the intro already covered it.
        // Record the version silently so the changelog starts from the next update.
        if (await OnboardingService.isFirstRun()) {
          await AsyncStorage.setItem(CHANGELOG_KEY, CURRENT_VERSION);
          return;
        }

        setVisible(true);
      } catch (e) {
        console.error('Error reading changelog version', e);
      }
    };

    setTimeout(checkVersion, 800);
  }, []);

  const handleClose = async () => {
    triggerHaptic('success');
    setVisible(false);
    try {
      await AsyncStorage.setItem(CHANGELOG_KEY, CURRENT_VERSION);
    } catch (e) {
      console.error('Error saving changelog version', e);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/60">
        <TouchableOpacity className="absolute inset-0" onPress={handleClose} activeOpacity={1} />
        
        <View className="w-full rounded-t-[32px] overflow-hidden" style={{ maxHeight: SCREEN_HEIGHT * 0.85 }}>
          <ImageBackground 
            source={require('../assets/images/GlassBg.png')} 
            style={{ width: '100%' }}
            imageStyle={{ height: SCREEN_HEIGHT, top: undefined, bottom: 0 }}
            resizeMode="cover"
          >
            <BlurView intensity={90} tint="dark" style={{ width: '100%' }}>
              <ScrollView contentContainerStyle={{ padding: 28, paddingTop: 40, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
                
                {/* Header Section */}
                <View className="items-center mb-8">
                  <View className="w-16 h-16 rounded-[20px] items-center justify-center bg-indigo-500/20 border border-indigo-400/30 mb-4 shadow-lg shadow-indigo-500/20">
                    <Ionicons name="sparkles" size={30} color="#a5b4fc" />
                  </View>
                  <Text style={[styles.textShadow, { fontFamily: 'Nunito_900Black', fontSize: 32, color: 'white', textAlign: 'center', marginBottom: 4 }]}>
                    What's New
                  </Text>
                  <Text style={[styles.textShadow, { fontFamily: 'Nunito_600SemiBold', fontSize: 16, color: '#c7d2fe', textAlign: 'center', marginBottom: 4 }]}>
                    FinScholar v{CURRENT_VERSION} is here!
                  </Text>
                </View>

                {/* Features List */}
                <View className="bg-black/40 rounded-[28px] p-6 mb-8 border border-white/10">
                  <ChangelogItem 
                    icon="albums" 
                    color="#818cf8"
                    title="Flash Study UI Overhaul" 
                    desc="A completely redesigned dashboard for your decks with a gorgeous new UI." 
                    isLast={false}
                  />
                  <ChangelogItem 
                    icon="trophy" 
                    color="#fbbf24"
                    title="Gamification & Streaks" 
                    desc="Earn XP and keep your daily streak alive by reviewing your flashcards every day!" 
                    isLast={false}
                  />
                  <ChangelogItem 
                    icon="game-controller" 
                    color="#2dd4bf"
                    title="Speed Match Game" 
                    desc="Race against the clock in the new Speed Match mini-game for your flashcard decks." 
                    isLast={false}
                  />
                  <ChangelogItem 
                    icon="options" 
                    color="#34d399"
                    title="Study Options" 
                    desc="New SM-2 algorithm settings and daily review goals configurable in your profile." 
                    isLast={true}
                  />
                </View>

                {/* Action Button */}
                <TouchableOpacity
                  accessible={true}
                  accessibilityRole="button"
                  onPress={handleClose}
                  activeOpacity={0.8}
                  className="py-[16px] rounded-full flex-row items-center justify-center shadow-lg bg-indigo-500 shadow-indigo-500/50 border border-indigo-400/50"
                >
                  <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 18, color: '#ffffff', letterSpacing: 0.5 }}>Awesome!</Text>
                </TouchableOpacity>

              </ScrollView>
            </BlurView>
          </ImageBackground>
        </View>
      </View>
    </Modal>
  );
}

function ChangelogItem({ icon, title, desc, color, isLast }: any) {
  return (
    <View className={`flex-row items-start ${isLast ? '' : 'mb-6'}`}>
      <View style={{ backgroundColor: `${color}25` }} className="w-12 h-12 rounded-2xl items-center justify-center mr-4 border border-white/5">
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <View className="flex-1 pt-0.5">
        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: 'white', marginBottom: 2 }}>{title}</Text>
        <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: '#cbd5e1', lineHeight: 20 }}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  textShadow: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  }
});
