import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SyncService, ConflictResolution } from '../services/SyncService';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [conflictData, setConflictData] = useState<{ localData: any, remoteData: any } | null>(null);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    SyncService.sync();

    const unsubscribeConflict = SyncService.subscribeConflict((localData, remoteData) => {
      setConflictData({ localData, remoteData });
    });

    return () => {
      unsubscribeConflict();
    };
  }, []);

  const handleResolve = (resolution: ConflictResolution) => {
    if (conflictData) {
      SyncService.resolveConflict(resolution, conflictData.localData, conflictData.remoteData);
      setConflictData(null);
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Unknown time';
    return new Date(timestamp).toLocaleString();
  };

  return (
    <>
      {children}
      <Modal visible={!!conflictData} transparent animationType="slide">
        <SafeAreaView className={`flex-1 justify-center items-center px-4 ${isDark ? 'bg-slate-900/90' : 'bg-slate-800/90'}`}>
          <View className={`w-full max-w-md p-6 rounded-3xl shadow-2xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <View className="items-center mb-6">
              <View className="w-16 h-16 rounded-full bg-amber-500/20 items-center justify-center mb-4">
                <Ionicons name="warning" size={32} color="#f59e0b" />
              </View>
              <Text className={`text-2xl font-extrabold text-center ${isDark ? 'text-white' : 'text-slate-800'}`}>Sync Conflict Detected</Text>
              <Text className={`text-center mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Both this device and the cloud have made changes while offline. Which version would you like to keep?
              </Text>
            </View>

            <View className="space-y-4">
              <TouchableOpacity 
                onPress={() => handleResolve('keep_local')}
                className={`p-4 rounded-2xl border-2 ${isDark ? 'bg-slate-900 border-indigo-500/50' : 'bg-indigo-50 border-indigo-200'}`}
              >
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center">
                    <Ionicons name="phone-portrait" size={20} color={isDark ? "#818cf8" : "#4f46e5"} />
                    <Text className={`ml-2 text-lg font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>Keep Local Device</Text>
                  </View>
                  <Text className={`text-xs font-semibold px-2 py-1 rounded-full ${isDark ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-100 text-indigo-700'}`}>This Phone</Text>
                </View>
                <Text className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Last modified: {formatDate(conflictData?.localData?.last_updated)}
                </Text>
                <Text className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  (This will overwrite the cloud with this device's data)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => handleResolve('keep_remote')}
                className={`p-4 rounded-2xl border-2 mb-4 ${isDark ? 'bg-slate-900 border-emerald-500/50' : 'bg-emerald-50 border-emerald-200'}`}
              >
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center">
                    <Ionicons name="cloud" size={20} color={isDark ? "#34d399" : "#059669"} />
                    <Text className={`ml-2 text-lg font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>Keep Cloud Version</Text>
                  </View>
                  <Text className={`text-xs font-semibold px-2 py-1 rounded-full ${isDark ? 'bg-emerald-900 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>Remote</Text>
                </View>
                <Text className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Last modified: {formatDate(conflictData?.remoteData?.last_updated)}
                </Text>
                <Text className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  (This will overwrite this device with the cloud data)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
};
