import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncService } from '@/services/SyncService';
import { getTheme, Typography } from '@/constants/Theme';

export default function StudyOptionsScreen() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);

    const [settingsForm, setSettingsForm] = useState({
        learningSteps: '1 10',
        graduatingInterval: '1',
        easyInterval: '4',
        dailyGoal: 20,
    });

    const DAILY_GOAL_PRESETS = [5, 10, 15, 20, 30, 50];

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const raw = await AsyncStorage.getItem('grade_ledger_v2_data');
                if (raw) {
                    const ledger = JSON.parse(raw);
                    const savedDailyGoal =
                        typeof ledger.flashcards?.stats?.dailyGoal === 'number'
                            ? ledger.flashcards.stats.dailyGoal
                            : typeof ledger.flashcards?.settings?.dailyGoal === 'number'
                            ? ledger.flashcards.settings.dailyGoal
                            : 20;

                    setSettingsForm({
                        learningSteps: ledger.flashcards?.settings?.learningSteps || '1 10',
                        graduatingInterval: String(ledger.flashcards?.settings?.graduatingInterval || 1),
                        easyInterval: String(ledger.flashcards?.settings?.easyInterval || 4),
                        dailyGoal: savedDailyGoal,
                    });
                }
            } catch (e) {
                console.error('Failed to load SR settings:', e);
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        try {
            const raw = await AsyncStorage.getItem('grade_ledger_v2_data');
            const ledger = raw ? JSON.parse(raw) : { settings: {}, years: [] };
            if (!ledger.flashcards) ledger.flashcards = { decks: [], stats: {} };

            const goalNum = Math.max(1, Math.floor(Number(settingsForm.dailyGoal) || 20));
            
            ledger.flashcards.settings = {
                ...ledger.flashcards.settings,
                learningSteps: settingsForm.learningSteps || '1 10',
                graduatingInterval: parseInt(settingsForm.graduatingInterval, 10) || 1,
                easyInterval: parseInt(settingsForm.easyInterval, 10) || 4,
                dailyGoal: goalNum,
            };

            ledger.flashcards.stats = {
                ...(ledger.flashcards.stats || {}),
                dailyGoal: goalNum,
            };
            
            await SyncService.pushLocalChanges(ledger);
            router.back();
        } catch (e) {
            console.error('Failed to save SR settings:', e);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={{ ...Typography.heading, color: theme.text, marginLeft: 8 }}>Study Options</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
                <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 14, color: theme.textSecondary, marginBottom: 24 }}>
                    FinScholar uses SM-2 Spaced Repetition. Customize your learning steps and intervals.
                </Text>

                <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, color: theme.text, marginBottom: 4 }}>
                        Learning Steps (Minutes)
                    </Text>
                    <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textTertiary, marginBottom: 8 }}>
                        Space-separated (e.g., "1 10")
                    </Text>
                    <TextInput
                        value={settingsForm.learningSteps}
                        onChangeText={(t) => setSettingsForm((prev) => ({ ...prev, learningSteps: t }))}
                        style={{
                            backgroundColor: theme.card,
                            borderWidth: 1,
                            borderColor: theme.cardBorder,
                            color: theme.text,
                            padding: 16,
                            borderRadius: 16,
                            fontFamily: 'Nunito_700Bold',
                            fontSize: 16,
                        }}
                    />
                </View>

                <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, color: theme.text, marginBottom: 8 }}>
                        Graduating Interval (Days)
                    </Text>
                    <TextInput
                        value={settingsForm.graduatingInterval}
                        onChangeText={(t) => setSettingsForm((prev) => ({ ...prev, graduatingInterval: t }))}
                        keyboardType="numeric"
                        style={{
                            backgroundColor: theme.card,
                            borderWidth: 1,
                            borderColor: theme.cardBorder,
                            color: theme.text,
                            padding: 16,
                            borderRadius: 16,
                            fontFamily: 'Nunito_700Bold',
                            fontSize: 16,
                        }}
                    />
                </View>

                <View style={{ marginBottom: 32 }}>
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, color: theme.text, marginBottom: 8 }}>
                        Easy Interval (Days)
                    </Text>
                    <TextInput
                        value={settingsForm.easyInterval}
                        onChangeText={(t) => setSettingsForm((prev) => ({ ...prev, easyInterval: t }))}
                        keyboardType="numeric"
                        style={{
                            backgroundColor: theme.card,
                            borderWidth: 1,
                            borderColor: theme.cardBorder,
                            color: theme.text,
                            padding: 16,
                            borderRadius: 16,
                            fontFamily: 'Nunito_700Bold',
                            fontSize: 16,
                        }}
                    />
                </View>

                {/* Daily Goal Configuration */}
                <View style={{ marginBottom: 36 }}>
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, color: theme.text, marginBottom: 4 }}>
                        Daily Review Goal
                    </Text>
                    <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textTertiary, marginBottom: 12 }}>
                        Target number of cards to review each day to maintain your streak.
                    </Text>

                    {/* Stepper Control */}
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: theme.card,
                            borderWidth: 1,
                            borderColor: theme.cardBorder,
                            borderRadius: 16,
                            padding: 8,
                            marginBottom: 12,
                        }}
                    >
                        <TouchableOpacity
                            onPress={() =>
                                setSettingsForm((prev) => ({
                                    ...prev,
                                    dailyGoal: Math.max(1, (prev.dailyGoal || 20) - 5),
                                }))
                            }
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Decrease daily goal"
                        >
                            <Ionicons name="remove" size={20} color={theme.text} />
                        </TouchableOpacity>

                        <View style={{ alignItems: 'center' }}>
                            <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 20, color: theme.primary }}>
                                {settingsForm.dailyGoal}
                            </Text>
                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textSecondary }}>
                                cards / day
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={() =>
                                setSettingsForm((prev) => ({
                                    ...prev,
                                    dailyGoal: Math.min(200, (prev.dailyGoal || 20) + 5),
                                }))
                            }
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Increase daily goal"
                        >
                            <Ionicons name="add" size={20} color={theme.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Quick Preset Chips */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {DAILY_GOAL_PRESETS.map((preset) => {
                            const isSelected = settingsForm.dailyGoal === preset;
                            return (
                                <TouchableOpacity
                                    key={preset}
                                    onPress={() => setSettingsForm((prev) => ({ ...prev, dailyGoal: preset }))}
                                    style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 8,
                                        borderRadius: 12,
                                        backgroundColor: isSelected
                                            ? theme.primary
                                            : isDark
                                            ? theme.surfaceSecondary
                                            : '#f1f5f9',
                                        borderWidth: 1,
                                        borderColor: isSelected ? theme.primary : theme.cardBorder,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontFamily: 'Nunito_800ExtraBold',
                                            fontSize: 12,
                                            color: isSelected ? '#ffffff' : theme.textSecondary,
                                        }}
                                    >
                                        {preset} cards
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <TouchableOpacity
                    onPress={handleSave}
                    style={{
                        backgroundColor: theme.primary,
                        paddingVertical: 16,
                        borderRadius: 16,
                        alignItems: 'center',
                    }}
                >
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: '#fff' }}>
                        Save Settings
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}
