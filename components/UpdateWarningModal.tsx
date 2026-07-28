import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { supabase } from '../services/supabaseClient';
import Constants from 'expo-constants';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';

export default function UpdateWarningModal() {
  const [visible, setVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    checkUpdate();
  }, []);

  const checkUpdate = async () => {
    try {
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .eq('id', 1)
        .single();
        
      if (error || !data) return;

      const currentVersion = Constants.expoConfig?.version || '1.0.0';
      
      // Simple semver compare
      if (isNewerVersion(currentVersion, data.latest_version)) {
        setUpdateInfo(data);
        setVisible(true);
      }
    } catch (e) {
      console.error("Failed to check for updates:", e);
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

  if (!visible || !updateInfo) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: isDark ? '#1e293b' : 'white' }]}>
          <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff' }]}>
            <Ionicons name="cloud-download" size={32} color="#6366f1" />
          </View>
          
          <Text style={[styles.title, { color: isDark ? 'white' : '#0f172a' }]}>Update Available</Text>
          <Text style={[styles.message, { color: isDark ? '#94a3b8' : '#475569' }]}>
            {updateInfo.update_message || "A new version is available. Update now to get the latest features!"}
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.button, styles.laterButton, { backgroundColor: isDark ? '#334155' : '#f1f5f9' }]} 
              onPress={() => setVisible(false)}
            >
              <Text style={[styles.buttonText, { color: isDark ? '#cbd5e1' : '#475569' }]}>Later</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, styles.updateButton]} 
              onPress={() => {
                if (updateInfo.store_url) {
                  Linking.openURL(updateInfo.store_url);
                }
                setVisible(false);
              }}
            >
              <Text style={[styles.buttonText, { color: 'white' }]}>Update Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  laterButton: {
    // bg injected
  },
  updateButton: {
    backgroundColor: '#6366f1',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
