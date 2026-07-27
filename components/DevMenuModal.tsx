import React from 'react';
import { View, Text, TouchableOpacity, Modal, Switch, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { SyncService } from '../services/SyncService';
import { supabase } from '../services/supabaseClient';

export default function DevMenuModal({ visible, onClose, isDark, onShowPaywall }: any) {
    const isPremium = SyncService.getIsPremium();

    const handleTogglePremium = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const newVal = !isPremium;
            // Update SyncService directly for immediate effect
            (SyncService as any).isPremiumUser = newVal; 
            
            // Update Supabase
            await supabase.from('profiles').update({ is_premium: newVal }).eq('id', user.id);
            alert(`Premium status forced to: ${newVal}`);
            onClose();
        } else {
            alert('Must be logged in to test premium');
        }
    };

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <View className="flex-1 justify-center items-center bg-black/60 p-6">
                <TouchableOpacity className="absolute inset-0" onPress={onClose} />
                <BlurView intensity={90} tint={isDark ? "dark" : "light"} className="w-full rounded-3xl p-6 overflow-hidden">
                    <Text className={`text-2xl font-black mb-6 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        Developer Menu
                    </Text>

                    <View className="flex-row items-center justify-between mb-6 p-4 rounded-xl bg-indigo-500/10">
                        <View>
                            <Text className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Force Premium Status</Text>
                            <Text className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Bypass RevenueCat check</Text>
                        </View>
                        <Switch 
                            value={isPremium} 
                            onValueChange={handleTogglePremium} 
                            trackColor={{ true: '#6366f1', false: isDark ? '#334155' : '#cbd5e1' }}
                        />
                    </View>

                    <TouchableOpacity 
                        className="w-full py-4 rounded-xl bg-indigo-500 items-center mb-4"
                        onPress={() => {
                            onClose();
                            setTimeout(() => onShowPaywall(), 300);
                        }}
                    >
                        <Text className="text-white font-bold">Test Paywall UI</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        className="absolute top-4 right-4 w-8 h-8 items-center justify-center rounded-full bg-slate-500/20"
                        onPress={onClose}
                    >
                        <Ionicons name="close" size={20} color={isDark ? "white" : "black"} />
                    </TouchableOpacity>
                </BlurView>
            </View>
        </Modal>
    );
}
