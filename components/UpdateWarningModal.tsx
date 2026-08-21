import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Linking, ImageBackground, Dimensions, ScrollView } from 'react-native';
import { supabase } from '../services/supabaseClient';
import appJson from '../app.json';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const LAST_SEEN_VERSION_KEY = '@last_seen_version';

// The hardcoded changelog for the current version
const CURRENT_CHANGELOG = [
  { icon: 'grid', title: '4x5 Widget Redesign', desc: 'The home screen widget is now natively 4x5, perfectly padded and properly sized out of the box.' },
  { icon: 'color-palette', title: 'Premium UI Polish', desc: 'Sleek new glassmorphism and rounded corners applied across menus and popups.' },
  { icon: 'bug', title: 'Bug Fixes', desc: 'General performance improvements and Android 12+ launcher compatibility fixes.' }
];

export default function UpdateWarningModal() {
  const [modalType, setModalType] = useState<'none' | 'update'>('none');
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const currentVersion = appJson.expo.version || '1.0.0';

  useEffect(() => {
    checkAppStates();
  }, []);

  const checkAppStates = async () => {
    try {
      // Check Supabase for remote updates in the background
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .eq('id', 1)
        .single();
        
      if (!error && data) {
        if (isNewerVersion(currentVersion, data.latest_version)) {
          setUpdateInfo(data);
          setModalType('update');
        }
      }
    } catch (e) {
      console.error("Failed to check app states:", e);
    }
  };

  const isNewerVersion = (current: string, latest: string) => {
    const currParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((latestParts[i] || 0) > (currParts[i] || 0)) return true;
      if ((latestParts[i] || 0) < (currParts[i] || 0)) return false;
    }
    return false;
  };

  const handleDismiss = () => {
    setModalType('none');
  };

  if (modalType === 'none') return null;

  return (
    <Modal visible={true} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/60">
        <TouchableOpacity className="absolute inset-0" onPress={handleDismiss} activeOpacity={1} />
        
        <View className="w-full rounded-t-3xl overflow-hidden" style={{ maxHeight: SCREEN_HEIGHT * 0.85 }}>
          <ImageBackground 
            source={require('../assets/images/GlassBg.png')} 
            style={{ width: '100%' }}
            imageStyle={{ height: SCREEN_HEIGHT, top: undefined, bottom: 0 }}
            resizeMode="cover"
          >
            <BlurView intensity={90} tint="dark" style={{ width: '100%' }}>
              <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: 40 }}>
                
                {modalType === 'update' && (
                  <>
                    <View className="w-16 h-16 rounded-full items-center justify-center bg-emerald-500/20 border border-emerald-400/30 self-center mb-4">
                      <Ionicons name="cloud-download" size={32} color="#34d399" />
                    </View>
                    <Text className="text-3xl font-extrabold text-white text-center mb-2" style={styles.textShadow}>
                      Update Available
                    </Text>
                    <Text className="text-base text-center text-slate-200 font-semibold mb-8 px-2" style={styles.textShadow}>
                      {updateInfo?.update_message || "A new version is available. Update now to get the latest features!"}
                    </Text>

                    <View className="flex-row justify-between mb-4 gap-4">
                      <TouchableOpacity 
                        style={{ flex: 1 }}
                        className="py-4 rounded-full items-center justify-center border-2 border-white/10 bg-black/40"
                        onPress={() => setModalType('none')}
                      >
                        <Text className="text-white font-bold text-base">Later</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={{ flex: 1 }}
                        className="py-4 rounded-full items-center justify-center shadow-lg bg-emerald-500 shadow-emerald-500/50"
                        onPress={() => {
                          if (updateInfo?.store_url) {
                            Linking.openURL(updateInfo.store_url);
                          }
                          setModalType('none');
                        }}
                      >
                        <Text className="text-white font-extrabold text-base">Update Now</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

              </ScrollView>
            </BlurView>
          </ImageBackground>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  textShadow: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  }
});

