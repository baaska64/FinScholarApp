import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useColorScheme } from 'nativewind';
import { supabase } from '../../services/supabaseClient';
import { AlertService } from '@/components/CustomAlert';

export default function CalendarImportModal({ visible, onClose, onImport }: any) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scannedMilestones, setScannedMilestones] = useState<any[] | null>(null);

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                base64: true,
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                processFile(result.assets[0].uri, result.assets[0].base64 ?? undefined);
            }
        } catch (e) {
            AlertService.alert("Error", "Could not pick image.");
        }
    };

    const processFile = async (uri: string, base64?: string) => {
        setError(null);
        setIsProcessing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error("You must be logged in to use AI FinSights.");
            }
            if (!base64) throw new Error("Could not extract image data.");

            const dataUrl = `data:image/jpeg;base64,${base64}`;

            const { data: parsedEvents, error: funcError } = await supabase.functions.invoke('parse-calendar', {
                body: { base64Data: dataUrl }
            });

            if (funcError) {
                let errMsg = funcError.message;
                try {
                    const ctx = await funcError.context?.json();
                    if (ctx?.error) errMsg = ctx.error;
                } catch(e){}
                throw new Error(errMsg);
            }

            if (!parsedEvents || !Array.isArray(parsedEvents) || parsedEvents.length === 0) {
                throw new Error("Could not detect any valid events from the image. Please try a clearer image.");
            }

            // Map and add unique IDs and checked state for the UI
            const eventsWithId = parsedEvents.map((evt, idx) => ({ ...evt, id: idx.toString(), checked: true }));
            setScannedMilestones(eventsWithId);

        } catch(err: any) {
            setError(err.message || "An unknown error occurred.");
        } finally {
            setIsProcessing(false);
        }
    };

    const toggleEvent = (id: string) => {
        if (!scannedMilestones) return;
        setScannedMilestones(scannedMilestones.map(evt => 
            evt.id === id ? { ...evt, checked: !evt.checked } : evt
        ));
    };

    const handleConfirmImport = () => {
        if (!scannedMilestones) return;
        const selected = scannedMilestones.filter(evt => evt.checked).map(evt => {
            const { id, checked, ...rest } = evt;
            return rest;
        });
        onImport(selected);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View className="flex-1 justify-end bg-black/60">
                <View className={`rounded-t-3xl p-6 h-[80%] ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 rounded-full bg-indigo-500/20 items-center justify-center mr-3">
                                <Ionicons name={scannedMilestones ? "list-outline" : "calendar-outline"} size={20} color={isDark ? '#818cf8' : '#6366f1'} />
                            </View>
                            <Text className={`font-nunito-black text-xl ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                {scannedMilestones ? "Review Milestones" : "Auto-Import Events"}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="p-2">
                            <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
                        </TouchableOpacity>
                    </View>

                    {error && (
                        <View className="bg-red-500/10 p-4 rounded-2xl mb-6 flex-row items-center">
                            <Ionicons name="alert-circle" size={20} color="#ef4444" className="mr-2" />
                            <Text className="font-nunito text-red-500 flex-1 ml-2">{error}</Text>
                        </View>
                    )}

                    {!scannedMilestones && !isProcessing && (
                        <View className="flex-1 justify-center items-center px-4">
                            <View className={`w-24 h-24 rounded-full items-center justify-center mb-6 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <Ionicons name="cloud-upload" size={48} color={isDark ? '#cbd5e1' : '#94a3b8'} />
                            </View>
                            <Text className={`font-nunito-bold text-lg mb-2 text-center ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                Upload School Calendar
                            </Text>
                            <Text className={`font-nunito text-center mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Take a screenshot of your university's academic calendar and FinSights AI will automatically extract all milestones, holidays, and deadlines.
                            </Text>

                            <TouchableOpacity 
                                onPress={pickImage}
                                className="w-full bg-indigo-500 py-4 rounded-2xl items-center flex-row justify-center shadow-lg shadow-indigo-500/30"
                            >
                                <Ionicons name="image-outline" size={20} color="white" style={{ marginRight: 8 }} />
                                <Text className="font-nunito-black text-white text-lg">Choose from Gallery</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {isProcessing && (
                        <View className="flex-1 justify-center items-center">
                            <ActivityIndicator size="large" color="#6366f1" />
                            <Text className={`font-nunito-bold mt-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>Analyzing Document...</Text>
                            <Text className={`font-nunito text-sm mt-2 text-center px-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                FinSights AI is extracting dates, event titles, and categorizing them. This may take a few seconds.
                            </Text>
                        </View>
                    )}

                    {scannedMilestones && !isProcessing && (
                        <View className="flex-1">
                            <TouchableOpacity 
                                onPress={() => setScannedMilestones(null)}
                                className="mb-4 self-end flex-row items-center"
                            >
                                <Ionicons name="refresh" size={16} color={isDark ? '#818cf8' : '#6366f1'} style={{ marginRight: 4 }} />
                                <Text className={`font-nunito-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>Rescan Image</Text>
                            </TouchableOpacity>

                            <ScrollView className="flex-1 mb-4" showsVerticalScrollIndicator={false}>
                                {scannedMilestones.map((evt: any) => (
                                    <TouchableOpacity 
                                        key={evt.id} 
                                        onPress={() => toggleEvent(evt.id)}
                                        className={`p-4 mb-3 rounded-2xl flex-row items-center border ${
                                            evt.checked 
                                                ? (isDark ? 'bg-slate-800 border-indigo-500/50' : 'bg-indigo-50 border-indigo-200')
                                                : (isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200')
                                        }`}
                                    >
                                        <View className={`w-6 h-6 rounded mr-4 items-center justify-center border ${
                                            evt.checked
                                                ? 'bg-indigo-500 border-indigo-500'
                                                : (isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')
                                        }`}>
                                            {evt.checked && <Ionicons name="checkmark" size={16} color="white" />}
                                        </View>
                                        <View className="flex-1">
                                            <Text className={`font-nunito-bold text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                                {evt.title || evt.name || 'Untitled Event'}
                                            </Text>
                                            <Text className={`font-nunito text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                {evt.date || 'Unknown Date'} • {evt.type || 'Custom'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <TouchableOpacity 
                                onPress={handleConfirmImport}
                                className={`w-full py-4 rounded-2xl items-center justify-center flex-row shadow-lg ${
                                    scannedMilestones.filter(e => e.checked).length > 0 
                                        ? 'bg-indigo-500 shadow-indigo-500/30' 
                                        : 'bg-slate-400 shadow-slate-400/20'
                                }`}
                                disabled={scannedMilestones.filter(e => e.checked).length === 0}
                            >
                                <Text className="font-nunito-black text-white text-lg">
                                    Import {scannedMilestones.filter(e => e.checked).length} Events
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}
