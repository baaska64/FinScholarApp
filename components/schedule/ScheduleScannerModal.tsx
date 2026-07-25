import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, Alert, useColorScheme, TextInput, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../services/supabaseClient';
import { AlertService } from '@/components/CustomAlert';

export default function ScheduleScannerModal({ visible, onClose, onApply }: any) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [customInstructions, setCustomInstructions] = useState('');
    const [selectedImage, setSelectedImage] = useState<{uri: string, base64: string} | null>(null);

    useEffect(() => {
        if (visible) {
            setSelectedImage(null);
            setCustomInstructions('');
            setError(null);
            setIsProcessing(false);
        }
    }, [visible]);

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                base64: true,
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                if (asset.base64) {
                    setSelectedImage({ uri: asset.uri, base64: asset.base64 });
                } else {
                    AlertService.alert("Error", "Could not extract image data.");
                }
            }
        } catch (e) {
            AlertService.alert("Error", "Could not pick image.");
        }
    };

    const handleScanNow = () => {
        if (selectedImage) {
            processFile(selectedImage.uri, selectedImage.base64);
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

            const { data: parsedClasses, error: funcError } = await supabase.functions.invoke('parse-schedule', {
                body: { base64Data: dataUrl, customInstructions: customInstructions.trim() || undefined }
            });

            if (funcError) {
                let errMsg = funcError.message;
                try {
                    if (funcError.context) {
                        const ctx = await funcError.context.json();
                        if (ctx?.error) errMsg = ctx.error;
                    }
                } catch (_) {}
                throw new Error(errMsg);
            }

            if (!parsedClasses || !Array.isArray(parsedClasses) || parsedClasses.length === 0) {
                throw new Error('Could not extract schedule. Make sure the image clearly shows times and days.');
            }

            setIsProcessing(false);
            onApply(parsedClasses);
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
            setIsProcessing(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View className="flex-1 justify-end bg-black/60">
                <View className={`w-full rounded-t-[32px] p-6 shadow-xl ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center">
                            <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
                                <Ionicons name="sparkles" size={20} color={isDark ? "#818cf8" : "#6366f1"} />
                            </View>
                            <View>
                                <Text className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Scan Schedule</Text>
                                <Text className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Auto-populate your timetable</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} disabled={isProcessing} className={`p-2 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                            <Ionicons name="close" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                        </TouchableOpacity>
                    </View>

                    {error && (
                        <View className={`p-4 rounded-xl mb-4 border ${isDark ? 'bg-red-500 border-red-500' : 'bg-red-50 border-red-200'}`}>
                            <Text className="text-red-500 font-bold text-xs">{error}</Text>
                        </View>
                    )}

                    {isProcessing ? (
                        <View className="py-12 items-center">
                            <ActivityIndicator size="large" color="#6366f1" />
                            <Text className={`mt-4 font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Analyzing Image...</Text>
                            <Text className={`text-xs mt-2 text-center px-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Fin is reading the time slots and subjects.</Text>
                        </View>
                    ) : selectedImage ? (
                        <View>
                            <View className="mb-4 items-center justify-center relative">
                                <Image source={{ uri: selectedImage.uri }} style={{ width: '100%', height: 200, borderRadius: 16 }} resizeMode="cover" />
                                <TouchableOpacity 
                                    onPress={() => setSelectedImage(null)}
                                    style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 16 }}
                                >
                                    <Ionicons name="close" size={16} color="white" />
                                </TouchableOpacity>
                            </View>

                            <View className={`mb-6 p-1 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
                                <TextInput
                                    className={`p-3 text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}
                                    placeholder="Optional: Add instructions (e.g. 'Set course code as subject name')"
                                    placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                                    value={customInstructions}
                                    onChangeText={setCustomInstructions}
                                    multiline
                                    style={{ minHeight: 60, textAlignVertical: 'top' }}
                                />
                            </View>

                            <TouchableOpacity 
                                onPress={handleScanNow}
                                className="w-full bg-indigo-500 py-4 rounded-full items-center justify-center flex-row mb-4 shadow-lg shadow-indigo-500/30"
                            >
                                <Ionicons name="scan" size={20} color="white" />
                                <Text className="text-white font-extrabold text-base ml-2">Scan Now</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity 
                            onPress={pickImage}
                            className={`border-2 border-dashed rounded-3xl py-12 items-center justify-center mb-6 ${isDark ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-indigo-200 bg-indigo-50'}`}
                        >
                            <Ionicons name="image" size={48} color={isDark ? "#818cf8" : "#6366f1"} style={{marginBottom: 12}} />
                            <Text className={`text-base font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>Select Image from Gallery</Text>
                            <Text className={`text-xs mt-1 ${isDark ? 'text-indigo-400/80' : 'text-indigo-400'}`}>PNG, JPG up to 5MB</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
}

