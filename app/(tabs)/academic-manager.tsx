import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabaseClient';
import { SyncService } from '@/services/SyncService';
import { AlertService } from '@/components/CustomAlert';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTabBarHeight } from '@/components/CustomTabBar';

export default function AcademicManagerScreen() {
    const tabBarHeight = useTabBarHeight();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    const [data, setData] = useState<any>(null);
    const [user, setUser] = useState<any>(null);
    const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});

    // Editing State
    const [editingNode, setEditingNode] = useState<{ type: 'year' | 'sem', yearId: string, semId?: string } | null>(null);
    const [editValue, setEditValue] = useState('');

    // Date Picker State
    const [pickerState, setPickerState] = useState<{show: boolean, type: 'startDate' | 'endDate', semId: string | null, yearId: string | null, date: Date}>({
        show: false,
        type: 'startDate',
        semId: null,
        yearId: null,
        date: new Date()
    });

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });
        return () => subscription.unsubscribe();
    }, []);

    const loadLocalData = useCallback(async () => {
        try {
            const local = await AsyncStorage.getItem('grade_ledger_v2_data');
            if (local) {
                setData(JSON.parse(local));
            } else {
                setData({ settings: {}, years: [] });
            }
        } catch(e) {
            console.error("Failed to load local data:", e);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadLocalData();
        }, [loadLocalData])
    );

    useEffect(() => {
        const unsubData = SyncService.subscribeDataChange(() => {
            loadLocalData();
        });
        return () => {
            unsubData();
        };
    }, [loadLocalData]);

    const saveAndSync = async (newData: any) => {
        setData(newData);
        await SyncService.pushLocalChanges(newData);
    };

    const generateId = () => Math.random().toString(36).substr(2, 9);

    const toggleYear = (yearId: string) => {
        setExpandedYears(prev => ({ ...prev, [yearId]: !prev[yearId] }));
    };

    const handleAddYear = () => {
        const yearCount = data?.years?.length || 0;
        const newYear = { 
            id: generateId(), 
            name: `Year ${yearCount + 1}`, 
            semesters: [
                { id: generateId(), name: 'Semester 1', subjects: [], classes: [], milestones: [] }
            ] 
        };
        const newData = { ...data, years: [...(data?.years || []), newYear] };
        saveAndSync(newData);
        setExpandedYears(prev => ({ ...prev, [newYear.id]: true }));
    };

    const handleAddSem = (yearId: string) => {
        const newData = { ...data };
        const y = newData.years?.find((y: any) => y.id === yearId);
        if (y) {
            const semCount = y.semesters?.length || 0;
            y.semesters = [...(y.semesters || []), { id: generateId(), name: `Semester ${semCount + 1}`, subjects: [], classes: [], milestones: [] }];
            saveAndSync(newData);
            setExpandedYears(prev => ({ ...prev, [yearId]: true }));
        }
    };

    const handleDeleteYear = (year: any) => {
        AlertService.alert(
            "Delete Year",
            `Are you sure you want to delete ${year.name} and all its semesters?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive",
                    onPress: () => {
                        const newData = { ...data, years: data.years.filter((y: any) => y.id !== year.id) };
                        saveAndSync(newData);
                    }
                }
            ]
        );
    };

    const handleDeleteSem = (yearId: string, sem: any) => {
        AlertService.alert(
            "Delete Semester",
            `Are you sure you want to delete ${sem.name}?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive",
                    onPress: () => {
                        const newData = { ...data };
                        const y = newData.years.find((y: any) => y.id === yearId);
                        if (y) {
                            y.semesters = y.semesters.filter((s: any) => s.id !== sem.id);
                            saveAndSync(newData);
                        }
                    }
                }
            ]
        );
    };

    const startEditing = (type: 'year' | 'sem', yearId: string, semId: string | undefined, currentValue: string) => {
        setEditingNode({ type, yearId, semId });
        setEditValue(currentValue);
    };

    const saveEditing = () => {
        if (!editingNode || !editValue.trim()) {
            setEditingNode(null);
            return;
        }

        const newData = JSON.parse(JSON.stringify(data));
        const y = newData.years?.find((y: any) => y.id === editingNode.yearId);
        if (y) {
            if (editingNode.type === 'year') {
                y.name = editValue.trim();
            } else if (editingNode.type === 'sem') {
                const s = y.semesters?.find((s: any) => s.id === editingNode.semId);
                if (s) s.name = editValue.trim();
            }
        }
        
        saveAndSync(newData);
        setEditingNode(null);
    };

    const saveSemesterDate = (yearId: string, semId: string, field: 'startDate' | 'endDate', value: string) => {
        const newData = JSON.parse(JSON.stringify(data));
        const y = newData.years?.find((y: any) => y.id === yearId);
        if (y) {
            const s = y.semesters?.find((s: any) => s.id === semId);
            if (s) s[field] = value;
        }
        saveAndSync(newData);
    };

    if (!data) {
        return (
            <SafeAreaView className={`flex-1 justify-center items-center ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                <Text className={`font-nunito ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading Manager...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className={`flex-1 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
            {/* Header */}
            <View className={`px-6 py-4 border-b flex-row items-center justify-between z-10 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()} className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <Ionicons name="arrow-back" size={20} color={isDark ? '#e2e8f0' : '#475569'} />
                    </TouchableOpacity>
                    <Text className={`text-xl font-nunito-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Academic Terms</Text>
                </View>
                <TouchableOpacity onPress={handleAddYear} className="flex-row items-center bg-blue-500 px-4 py-2 rounded-full">
                    <Ionicons name="add" size={16} color="#fff" />
                    <Text className="text-white font-nunito-bold ml-1 text-sm">Year</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                className="flex-1 px-4 py-6"
                contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
                showsVerticalScrollIndicator={false}
            >
                {(!data.years || data.years.length === 0) ? (
                    <View className="items-center justify-center py-12 px-6">
                        <Image 
                            source={require('../../assets/images/sleeping.png')} 
                            className="w-48 h-48 mb-6"
                            resizeMode="contain"
                        />
                        <Text className={`font-nunito-bold text-center text-lg mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            Fin is taking a nap...
                        </Text>
                        <Text className={`font-nunito text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Fin is taking a nap because there are no academic terms yet. Add a Year to wake him up!
                        </Text>
                    </View>
                ) : (
                    data.years.map((y: any) => {
                        const isExpanded = expandedYears[y.id];
                        const isEditingYear = editingNode?.type === 'year' && editingNode.yearId === y.id;

                        return (
                            <View key={y.id} className={`mb-4 rounded-2xl overflow-hidden border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                                {/* Year Header */}
                                <View className={`flex-row items-center justify-between p-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                    <View className="flex-row items-center flex-1 pr-4">
                                        <TouchableOpacity onPress={() => toggleYear(y.id)} className="mr-3">
                                            <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                                        </TouchableOpacity>
                                        
                                        {isEditingYear ? (
                                            <TextInput
                                                autoFocus
                                                value={editValue}
                                                onChangeText={setEditValue}
                                                onBlur={saveEditing}
                                                onSubmitEditing={saveEditing}
                                                placeholder="e.g. 2025 - 2026"
                                                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                                                selectTextOnFocus={true}
                                                className={`flex-1 font-nunito-bold text-lg px-2 py-1 rounded border ${isDark ? 'text-white border-blue-500 bg-slate-950' : 'text-slate-800 border-blue-400 bg-blue-50'}`}
                                            />
                                        ) : (
                                            <TouchableOpacity onPress={() => startEditing('year', y.id, undefined, y.name)} className="flex-1">
                                                <Text className={`font-nunito-bold text-lg ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{y.name}</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    
                                    <View className="flex-row items-center gap-2">
                                        <TouchableOpacity onPress={() => handleAddSem(y.id)} className={`p-2 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                            <Ionicons name="add" size={16} color={isDark ? '#e2e8f0' : '#475569'} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleDeleteYear(y)} className={`p-2 rounded-full ${isDark ? 'bg-red-900' : 'bg-red-100'}`}>
                                            <Ionicons name="trash" size={16} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Semesters List */}
                                {isExpanded && (
                                    <View className={`px-4 py-2 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                                        {(!y.semesters || y.semesters.length === 0) ? (
                                            <Text className={`py-3 text-center font-nunito italic text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No semesters yet.</Text>
                                        ) : (
                                            y.semesters.map((s: any, index: number) => {
                                                const isEditingSem = editingNode?.type === 'sem' && editingNode.semId === s.id;
                                                const isLast = index === y.semesters.length - 1;
                                                
                                                return (
                                                    <View key={s.id} className={`py-3 ${!isLast ? (isDark ? 'border-b border-slate-800' : 'border-b border-slate-200') : ''}`}>
                                                        <View className="flex-row items-center justify-between">
                                                            <View className="flex-row items-center flex-1 pr-4 pl-8">
                                                                <View className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3" />
                                                                {isEditingSem ? (
                                                                    <TextInput
                                                                        autoFocus
                                                                        value={editValue}
                                                                        onChangeText={setEditValue}
                                                                        onBlur={saveEditing}
                                                                        onSubmitEditing={saveEditing}
                                                                        placeholder="e.g. 1st Semester"
                                                                        placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                                                                        selectTextOnFocus={true}
                                                                        className={`flex-1 font-nunito text-base px-2 py-1 rounded border ${isDark ? 'text-white border-blue-500 bg-slate-900' : 'text-slate-700 border-blue-400 bg-white'}`}
                                                                    />
                                                                ) : (
                                                                    <TouchableOpacity onPress={() => startEditing('sem', y.id, s.id, s.name)} className="flex-1">
                                                                        <Text className={`font-nunito text-base ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{s.name}</Text>
                                                                    </TouchableOpacity>
                                                                )}
                                                            </View>
                                                            
                                                            <TouchableOpacity onPress={() => handleDeleteSem(y.id, s)} className="p-2">
                                                                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                                            </TouchableOpacity>
                                                        </View>
                                                        
                                                        {/* Duration Settings */}
                                                        <View className={`mt-3 pl-12 pr-4 flex-row justify-between`}>
                                                            <View className="flex-1 mr-2">
                                                                <Text className={`text-[10px] font-bold uppercase mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Start Date</Text>
                                                                <TouchableOpacity 
                                                                    onPress={() => {
                                                                        const parsedDate = s.startDate ? new Date(s.startDate) : new Date();
                                                                        setPickerState({
                                                                            show: true,
                                                                            type: 'startDate',
                                                                            semId: s.id,
                                                                            yearId: y.id,
                                                                            date: isNaN(parsedDate.getTime()) ? new Date() : parsedDate
                                                                        });
                                                                    }}
                                                                    className={`h-10 px-3 justify-center rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                                                                >
                                                                    <Text className={`text-sm font-nunito ${s.startDate ? (isDark ? 'text-slate-300' : 'text-slate-600') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>
                                                                        {s.startDate || 'Select Date'}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            </View>
                                                            <View className="flex-1 ml-2">
                                                                <Text className={`text-[10px] font-bold uppercase mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>End Date</Text>
                                                                <TouchableOpacity 
                                                                    onPress={() => {
                                                                        const parsedDate = s.endDate ? new Date(s.endDate) : new Date();
                                                                        setPickerState({
                                                                            show: true,
                                                                            type: 'endDate',
                                                                            semId: s.id,
                                                                            yearId: y.id,
                                                                            date: isNaN(parsedDate.getTime()) ? new Date() : parsedDate
                                                                        });
                                                                    }}
                                                                    className={`h-10 px-3 justify-center rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                                                                >
                                                                    <Text className={`text-sm font-nunito ${s.endDate ? (isDark ? 'text-slate-300' : 'text-slate-600') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>
                                                                        {s.endDate || 'Select Date'}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            </View>
                                                        </View>
                                                    </View>
                                                );
                                            })
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}
                <View className="h-20" />
            </ScrollView>

            {pickerState.show && (
                <DateTimePicker
                    value={pickerState.date}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                        setPickerState(prev => ({ ...prev, show: false }));
                        if (event.type === 'set' && selectedDate && pickerState.semId && pickerState.yearId) {
                            // Extract YYYY-MM-DD safely considering local timezone
                            const year = selectedDate.getFullYear();
                            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                            const day = String(selectedDate.getDate()).padStart(2, '0');
                            const formatted = `${year}-${month}-${day}`;
                            saveSemesterDate(pickerState.yearId, pickerState.semId, pickerState.type, formatted);
                        }
                    }}
                />
            )}
        </SafeAreaView>
    );
}
