import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabaseClient';
import { SyncService } from '@/services/SyncService';
import DateTimePicker from '@react-native-community/datetimepicker';

import Tabs from '@/components/ledger/Tabs';
import { VisualCalendar } from '@/components/calendar/VisualCalendar';
import CalendarImportModal from '@/components/calendar/CalendarImportModal';
import { AlertService } from '@/components/CustomAlert';
import { useSemesterContext } from '@/components/SemesterContext';
import { getTheme, Typography, Radius, Shadows } from '@/constants/Theme';
import { ListSkeleton } from '@/components/ui/LoadingSkeleton';

const generateId = () => Math.random().toString(36).substr(2, 9);

const MILESTONE_TYPES: any = {
    enrollment: { label: 'Enrollment', color: '#14b8a6', bg: '#ccfbf1' },
    drop_deadline: { label: 'Drop Deadline', color: '#ef4444', bg: '#fee2e2' },
    finals: { label: 'Finals', color: '#f59e0b', bg: '#fef3c7' },
    holiday: { label: 'Holiday', color: '#10b981', bg: '#d1fae5' },
    org_event: { label: 'Org Event', color: '#8b5cf6', bg: '#ede9fe' },
    custom: { label: 'Custom', color: '#64748b', bg: '#f1f5f9' }
};

const MILESTONE_TYPES_DARK: any = {
    enrollment: { label: 'Enrollment', color: '#2dd4bf', bg: '#115e59' },
    drop_deadline: { label: 'Drop Deadline', color: '#f87171', bg: '#991b1b' },
    finals: { label: 'Finals', color: '#fbbf24', bg: '#b45309' },
    holiday: { label: 'Holiday', color: '#34d399', bg: '#065f46' },
    org_event: { label: 'Org Event', color: '#a78bfa', bg: '#5b21b6' },
    custom: { label: 'Custom', color: '#94a3b8', bg: '#334155' }
};

export default function CalendarScreen() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const activeTypes = isDark ? MILESTONE_TYPES_DARK : MILESTONE_TYPES;

    const [data, setData] = useState<any>(null);
    const [user, setUser] = useState<any>(null);
  const { selectedYear, selectedSemester, setYearAndSemester, isLoaded } = useSemesterContext();
  const [activeYearId, setLocalYearId] = useState<string | null>(null);
  const [activeSemId, setLocalSemId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded) {
      if (selectedYear) setLocalYearId(selectedYear);
      if (selectedSemester) setLocalSemId(selectedSemester);
    }
  }, [isLoaded, selectedYear, selectedSemester]);

  const setActiveYearId = (id: string | null) => {
    setLocalYearId(id);
    if (id && activeSemId) setYearAndSemester(id, activeSemId);
  };

  const setActiveSemId = (id: string | null) => {
    setLocalSemId(id);
    if (activeYearId && id) setYearAndSemester(activeYearId, id);
  };
    const [syncStatus, setSyncStatus] = useState<'syncing' | 'saved' | 'error' | 'offline'>('offline');

    const [showImportModal, setShowImportModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingMilestone, setEditingMilestone] = useState<any>(null);

    const [form, setForm] = useState({ title: '', date: new Date(), type: 'custom', note: '' });
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedMilestones, setSelectedMilestones] = useState<Set<string>>(new Set());
    const [semDatePicker, setSemDatePicker] = useState<{ show: boolean, field: 'startDate' | 'endDate' }>({ show: false, field: 'startDate' });

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
        let loaded = null;
        try {
            const local = await AsyncStorage.getItem('grade_ledger_v2_data');
            if (local) loaded = JSON.parse(local);
        } catch (e) {}

        if (!loaded) loaded = { settings: {}, years: [] };

        loaded.years.forEach((y: any) => y.semesters.forEach((s: any) => {
            if (!s.milestones) s.milestones = [];
            // Backfill unique IDs for milestones that were imported without one
            s.milestones.forEach((m: any) => {
                if (!m.id) m.id = generateId();
            });
        }));

        setData(loaded);
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
        const unsubState = SyncService.subscribe((state) => {
            setSyncStatus(state === 'conflict' ? 'offline' : state);
        });
        return () => {
            unsubData();
            unsubState();
        };
    }, [loadLocalData]);

    const saveAndSync = async (newData: any) => {
        setData(newData);
        await SyncService.pushLocalChanges(newData);
    };

    const saveSemesterDate = (field: 'startDate' | 'endDate', date: Date) => {
        const nd = JSON.parse(JSON.stringify(data));
        const sem = nd.years.find((y: any) => y.id === activeYearId)?.semesters.find((s: any) => s.id === activeSemId);
        if (!sem) return;
        const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        sem[field] = formatted;
        saveAndSync(nd);
        setSemDatePicker({ show: false, field });
    };

    const handleSaveMilestone = () => {
        if (!form.title || !form.date) return;
        
        const nd = JSON.parse(JSON.stringify(data));
        const sem = nd.years.find((y: any) => y.id === activeYearId)?.semesters.find((s: any) => s.id === activeSemId);
        if (!sem) return;
        
        const dateStr = `${form.date.getFullYear()}-${String(form.date.getMonth() + 1).padStart(2, '0')}-${String(form.date.getDate()).padStart(2, '0')}`;

        if (editingMilestone) {
            if (!editingMilestone.id) return; // safety: never edit without a valid ID
            sem.milestones = sem.milestones.map((m: any) => m.id === editingMilestone.id ? { ...form, date: dateStr, id: m.id } : m);
        } else {
            sem.milestones.push({ ...form, date: dateStr, id: generateId() });
        }
        
        saveAndSync(nd);
        setEditingMilestone(null);
        setShowAddModal(false);
        setForm({ title: '', date: new Date(), type: 'custom', note: '' });
    };

    const handleDeleteMilestone = (id: string, customYearId?: string, customSemId?: string) => {
        AlertService.alert("Delete Event", "Are you sure you want to delete this event?", [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Delete", 
                style: "destructive", 
                onPress: () => {
                    const nd = JSON.parse(JSON.stringify(data));
                    const yId = customYearId || activeYearId;
                    const sId = customSemId || activeSemId;
                    const sem = nd.years.find((y: any) => y.id === yId)?.semesters.find((s: any) => s.id === sId);
                    if (!sem) return;
                    sem.milestones = sem.milestones.filter((m: any) => m.id !== id);
                    saveAndSync(nd);
                }
            }
        ]);
    };

    const handleImport = (importedMilestones: any[]) => {
        const nd = JSON.parse(JSON.stringify(data));
        let yr = nd.years.find((y: any) => y.id === activeYearId);
        
        if (!yr) {
            if (nd.years.length === 0) {
                const yId = generateId();
                yr = { id: yId, name: 'Year 1', semesters: [] };
                nd.years.push(yr);
                setActiveYearId(yId);
            } else {
                yr = nd.years[0];
                setActiveYearId(yr.id);
            }
        }

        importedMilestones.forEach(event => {
            const semIndex = event.target_semester_index || 1;
            while (yr.semesters.length < semIndex) {
                yr.semesters.push({ 
                    id: generateId(), 
                    name: `Semester ${yr.semesters.length + 1}`, 
                    subjects: [], 
                    milestones: [] 
                });
            }
            const targetSem = yr.semesters[semIndex - 1];
            if (!targetSem.milestones) targetSem.milestones = [];
            targetSem.milestones.push({ ...event, id: generateId() });
        });

        saveAndSync(nd);
        AlertService.alert("Success", "Imported events to your calendar.");
    };

    if (!data) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
                <ListSkeleton count={4} cardHeight={70} />
            </SafeAreaView>
        );
    }

    const currentYear = data.years.find((y: any) => y.id === activeYearId);
    const currentSem = currentYear?.semesters.find((s: any) => s.id === activeSemId);
    
    // Sort milestones
    let allMilestones: any[] = [];
    data.years.forEach((y: any) => {
        y.semesters.forEach((s: any) => {
            if (s.milestones) {
                s.milestones.forEach((m: any) => {
                    allMilestones.push({ ...m, yearId: y.id, semId: s.id, yearName: y.name, semName: s.name });
                });
            }
        });
    });
    
    const semesterMilestones = [...(currentSem?.milestones || [])].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const sortedAllMilestones = allMilestones.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const getEventsForDate = (dateStr: string) => {
        const targetDateString = dateStr.slice(0, 10);
        return sortedAllMilestones.filter(m => {
            if (!m.date) return false;
            const mDateStr = typeof m.date === 'string' ? m.date.slice(0, 10) : new Date(m.date).toISOString().slice(0, 10);
            return mDateStr === targetDateString;
        });
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <View style={{
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                paddingHorizontal: 24, paddingVertical: 16, zIndex: 10,
                borderBottomWidth: 1, borderBottomColor: isDark ? theme.cardBorder : '#f1f5f9',
                backgroundColor: theme.surface,
                ...(!isDark ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 } : {}),
            }}>
                <Text style={{ ...Typography.title, color: theme.text }}>Calendar</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {syncStatus === 'syncing' && <Ionicons name="cloud-upload" size={22} color={theme.textTertiary} />}
                    {syncStatus === 'saved' && <Ionicons name="cloud-done" size={22} color={theme.success} />}
                    {syncStatus === 'error' && <Ionicons name="cloud-offline" size={22} color={theme.error} />}
                    {syncStatus === 'offline' && <Ionicons name="cloud-offline" size={22} color={theme.textTertiary} />}
                    
                    <TouchableOpacity onPress={() => setShowImportModal(true)} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9' }}>
                        <Ionicons name="sparkles" size={20} color={isDark ? '#cbd5e1' : '#475569'} />
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        onPress={() => router.push('/(tabs)/profile')} 
                        style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9' }}
                    >
                        <Ionicons name="settings-outline" size={22} color={isDark ? '#cbd5e1' : '#475569'} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
                {data.years.length > 0 ? (
                    <View>
                        <View className="px-6">
                            <Tabs 
                                years={data.years} 
                                activeYearId={activeYearId} 
                                activeSemId={activeSemId} 
                                onSelectYear={id => {
                                    setActiveYearId(id);
                                    const yr = data.years.find((y: any) => y.id === id);
                                    if (yr && yr.semesters.length > 0) setActiveSemId(yr.semesters[0].id);
                                    else setActiveSemId(null);
                                }}
                                onSelectSem={id => setActiveSemId(id)}
                            />
                        </View>

                        {activeSemId ? (
                            <View className="px-6 mt-4">
                                {/* Auto-Import Banner */}
                                <TouchableOpacity 
                                    onPress={() => setShowImportModal(true)}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 16,
                                        borderWidth: 1.5, borderColor: isDark ? 'rgba(99,102,241,0.3)' : '#c7d2fe',
                                        backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : '#eef2ff',
                                    }}
                                >
                                    <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff' }}>
                                        <Ionicons name="sparkles" size={20} color={isDark ? '#a5b4fc' : '#6366f1'} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, color: isDark ? '#e2e8f0' : '#312e81' }}>Auto-Import Events</Text>
                                        <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: isDark ? '#94a3b8' : '#6366f1', marginTop: 2 }}>Scan a calendar image to add events instantly</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={isDark ? '#64748b' : '#a5b4fc'} />
                                </TouchableOpacity>

                                {/* Semester Duration Card */}
                                <View style={{
                                    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 16,
                                    borderWidth: 1, borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                                    backgroundColor: isDark ? theme.surface : '#ffffff',
                                }}>
                                    <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#d1fae5' }}>
                                        <Ionicons name="calendar-number-outline" size={18} color={isDark ? '#34d399' : '#059669'} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8 }}>Semester Duration</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
                                            <TouchableOpacity onPress={() => setSemDatePicker({ show: true, field: 'startDate' })}>
                                                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: currentSem?.startDate ? (isDark ? '#e2e8f0' : '#1e293b') : theme.textTertiary, textDecorationLine: currentSem?.startDate ? 'none' : 'underline' }}>
                                                    {currentSem?.startDate ? new Date(currentSem.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Set start'}
                                                </Text>
                                            </TouchableOpacity>
                                            <Text style={{ color: theme.textTertiary, fontSize: 12 }}>→</Text>
                                            <TouchableOpacity onPress={() => setSemDatePicker({ show: true, field: 'endDate' })}>
                                                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: currentSem?.endDate ? (isDark ? '#e2e8f0' : '#1e293b') : theme.textTertiary, textDecorationLine: currentSem?.endDate ? 'none' : 'underline' }}>
                                                    {currentSem?.endDate ? new Date(currentSem.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Set end'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <Ionicons name="pencil-outline" size={15} color={theme.textTertiary} />
                                </View>

                                {/* Semester Date Picker */}
                                {semDatePicker.show && (
                                    <DateTimePicker
                                        value={currentSem?.[semDatePicker.field] ? new Date(currentSem[semDatePicker.field] + 'T00:00:00') : new Date()}
                                        mode="date"
                                        display="default"
                                        onChange={(event, selectedDate) => {
                                            if (selectedDate) saveSemesterDate(semDatePicker.field, selectedDate);
                                            else setSemDatePicker({ ...semDatePicker, show: false });
                                        }}
                                    />
                                )}
                                {/* Visual Calendar */}
                                <VisualCalendar 
                                    events={sortedAllMilestones} 
                                    onDateClick={(dateStr) => {
                                        setSelectedDateStr(dateStr);
                                        setShowDetailsModal(true);
                                    }}
                                />

                                {/* Semester Events List */}
                                <View className="flex-row justify-between items-center mb-4">
                                    <Text className={`font-nunito-black text-lg ${isDark ? 'text-white' : 'text-slate-800'}`}>Semester Events</Text>
                                    <View className="flex-row gap-2">
                                        <TouchableOpacity 
                                            onPress={() => {
                                                if (isEditing) {
                                                    setIsEditing(false);
                                                    setSelectedMilestones(new Set());
                                                } else {
                                                    setIsEditing(true);
                                                }
                                            }}
                                            className={`${isEditing ? 'bg-indigo-500' : (isDark ? 'bg-slate-800' : 'bg-slate-200')} px-3 py-1.5 rounded-full flex-row items-center`}
                                        >
                                            <Ionicons name={isEditing ? "checkmark" : "create-outline"} size={16} color={isEditing ? 'white' : (isDark ? '#cbd5e1' : '#475569')} />
                                            <Text className={`font-nunito-bold ml-1 text-xs ${isEditing ? 'text-white' : (isDark ? 'text-slate-300' : 'text-slate-600')}`}>{isEditing ? 'Done' : 'Edit'}</Text>
                                        </TouchableOpacity>
                                        
                                        {!isEditing && (
                                            <TouchableOpacity 
                                                onPress={() => {
                                                    setForm({ title: '', date: new Date(), type: 'custom', note: '' });
                                                    setEditingMilestone(null);
                                                    setShowAddModal(true);
                                                }}
                                                className="bg-indigo-500 px-3 py-1.5 rounded-full flex-row items-center"
                                            >
                                                <Ionicons name="add" size={16} color="white" />
                                                <Text className="font-nunito-bold text-white ml-1 text-xs">Add</Text>
                                            </TouchableOpacity>
                                        )}
                                        
                                        {isEditing && selectedMilestones.size > 0 && (
                                            <TouchableOpacity 
                                                onPress={() => {
                                                    AlertService.alert(
                                                        "Delete Selected",
                                                        `Are you sure you want to delete ${selectedMilestones.size} event(s)?`,
                                                        [
                                                            { text: "Cancel", style: "cancel" },
                                                            { text: "Delete", style: "destructive", onPress: () => {
                                                                const nd = {...data};
                                                                const sem = nd.years.find((y: any) => y.id === activeYearId).semesters.find((s: any) => s.id === activeSemId);
                                                                sem.milestones = sem.milestones.filter((m: any) => !selectedMilestones.has(m.id));
                                                                saveAndSync(nd);
                                                                setSelectedMilestones(new Set());
                                                                setIsEditing(false);
                                                            }}
                                                        ]
                                                    );
                                                }}
                                                className="bg-red-500 px-3 py-1.5 rounded-full flex-row items-center"
                                            >
                                                <Ionicons name="trash" size={16} color="white" />
                                                <Text className="font-nunito-bold text-white ml-1 text-xs">Delete ({selectedMilestones.size})</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>


                                {semesterMilestones.length === 0 ? (
                                    <View className={`py-12 rounded-3xl items-center justify-center border border-dashed ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-300 bg-slate-100/50'}`}>
                                        <Ionicons name="calendar-clear-outline" size={48} color={isDark ? '#475569' : '#94a3b8'} />
                                        <Text className={`font-nunito-bold mt-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No events for this semester.</Text>
                                    </View>
                                ) : (
                                    <View className="space-y-4 flex-col">
                                        {semesterMilestones.map((m: any, index: number) => {
                                            const typeConfig = activeTypes[m.type as keyof typeof activeTypes] || activeTypes.custom;
                                            
                                            // Calculate days difference
                                            const parts = m.date.split('-');
                                            const mDate = parts.length === 3 
                                                ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
                                                : new Date(m.date);
                                            const today = new Date();
                                            today.setHours(0,0,0,0);
                                            mDate.setHours(0,0,0,0);
                                            const diffTime = mDate.getTime() - today.getTime();
                                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                            
                                            let daysText = 'Today';
                                            if (diffDays > 0) daysText = `In ${diffDays} days`;
                                            else if (diffDays < 0) daysText = `${Math.abs(diffDays)} days ago`;

                                            return (
                                                <TouchableOpacity 
                                                    key={m.id || `milestone-${index}`}
                                                    activeOpacity={isEditing ? 0.8 : 1}
                                                    onPress={() => {
                                                        if (isEditing) {
                                                            const newSet = new Set(selectedMilestones);
                                                            if (newSet.has(m.id)) newSet.delete(m.id);
                                                            else newSet.add(m.id);
                                                            setSelectedMilestones(newSet);
                                                        }
                                                    }}
                                                    className={`p-4 rounded-3xl shadow-sm border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`} style={{ marginBottom: 12 }}>
                                                    <View className="flex-row items-center">
                                                        {isEditing && (
                                                            <View className={`w-6 h-6 rounded-full border-2 mr-3 items-center justify-center ${selectedMilestones.has(m.id) ? (isDark ? 'bg-indigo-500 border-indigo-500' : 'bg-indigo-600 border-indigo-600') : (isDark ? 'border-slate-600' : 'border-slate-300')}`}>
                                                                {selectedMilestones.has(m.id) && <Ionicons name="checkmark" size={16} color="white" />}
                                                            </View>
                                                        )}
                                                        <View className={`w-14 h-16 rounded-2xl items-center justify-center mr-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                                            <Text className={`font-nunito-black text-2xl ${isDark ? 'text-white' : 'text-slate-800'}`}>{mDate.getDate()}</Text>
                                                            <Text className={`font-nunito-bold text-xs uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{mDate.toLocaleString('default', { month: 'short' })}</Text>
                                                        </View>
                                                        
                                                        <View className="flex-1">
                                                            <Text className={`font-nunito-bold text-base mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`} numberOfLines={1}>{m.title}</Text>
                                                            <View className="flex-row items-center">
                                                                <View style={{ backgroundColor: typeConfig.bg, borderColor: `${typeConfig.color}40`, borderWidth: 1 }} className="px-2 py-0.5 rounded-md mr-2">
                                                                    <Text style={{ color: typeConfig.color }} className="font-nunito-bold text-[10px]">{typeConfig.label}</Text>
                                                                </View>
                                                                {m.note && (
                                                                    <Text className={`font-nunito text-xs flex-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} numberOfLines={1}>{m.note}</Text>
                                                                )}
                                                            </View>
                                                        </View>
                                                    </View>

                                                    <View className={`mt-3 pt-3 border-t flex-row justify-between items-center ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                                        <Text className={`font-nunito-bold text-xs ${diffDays === 0 ? 'text-indigo-500' : (diffDays < 0 ? (isDark ? 'text-slate-500' : 'text-slate-400') : (isDark ? 'text-slate-300' : 'text-slate-600'))}`}>
                                                            {daysText}
                                                        </Text>
                                                        
                                                        <View className="flex-row space-x-3">
                                                            <TouchableOpacity onPress={() => {
                                                                const parts = m.date.split('-');
                                                                const d = parts.length === 3 
                                                                    ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
                                                                    : new Date(m.date);
                                                                setForm({ title: m.title, date: d, type: m.type, note: m.note || '' });
                                                                setEditingMilestone(m);
                                                                setShowAddModal(true);
                                                            }}>
                                                                <Ionicons name="pencil" size={16} color={isDark ? '#cbd5e1' : '#64748b'} />
                                                            </TouchableOpacity>
                                                            <TouchableOpacity onPress={() => handleDeleteMilestone(m.id)}>
                                                                <Ionicons name="trash" size={16} color="#ef4444" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        ) : (
                            <View className="px-6 py-12 items-center">
                                <Text className={`font-nunito text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No semester selected. Create a year and semester first.</Text>
                            </View>
                        )}
                    </View>
                ) : (
                    <View className="flex-1 justify-center items-center px-6 mt-20">
                        <Ionicons name="school-outline" size={64} color={isDark ? '#334155' : '#cbd5e1'} />
                        <Text className={`font-nunito-bold text-xl mt-4 mb-2 text-center ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>No Academic Years</Text>
                        <Text className={`font-nunito text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Go to the Manager tab to setup your curriculum before adding calendar events.</Text>
                        <TouchableOpacity onPress={() => router.push('/academic-manager')} className="mt-6 bg-indigo-500 px-6 py-3 rounded-full">
                            <Text className="font-nunito-bold text-white">Go to Manager</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* Add/Edit Modal */}
            <Modal visible={showAddModal} transparent animationType="slide">
                <View className="flex-1 justify-end bg-black/60">
                    <View className={`rounded-t-3xl p-6 h-[70%] ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className={`font-nunito-black text-xl ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                {editingMilestone ? 'Edit Event' : 'Add Event'}
                            </Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                            <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Event Title</Text>
                            <TextInput
                                className={`p-4 rounded-2xl mb-4 font-nunito border ${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-200'}`}
                                placeholder="e.g. Midterm Exams"
                                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                                value={form.title}
                                onChangeText={t => setForm({...form, title: t})}
                            />

                            <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Event Type</Text>
                            <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
                                {Object.entries(MILESTONE_TYPES).map(([key, config]: any) => (
                                    <TouchableOpacity 
                                        key={key}
                                        onPress={() => setForm({...form, type: key})}
                                        className={`px-3 py-1.5 rounded-full border ${form.type === key ? (isDark ? 'border-indigo-500 bg-indigo-500/20' : 'border-indigo-500 bg-indigo-50') : (isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white')}`}
                                    >
                                        <Text className={`font-nunito-bold text-xs ${form.type === key ? 'text-indigo-500' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>{config.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Date</Text>
                            <TouchableOpacity 
                                onPress={() => setShowDatePicker(true)}
                                className={`p-4 rounded-2xl mb-4 font-nunito border flex-row items-center justify-between ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                            >
                                <Text className={`font-nunito ${isDark ? 'text-white' : 'text-slate-900'}`}>{form.date.toLocaleDateString()}</Text>
                                <Ionicons name="calendar" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                            </TouchableOpacity>

                            {showDatePicker && (
                                <DateTimePicker
                                    value={form.date}
                                    mode="date"
                                    display="default"
                                    onChange={(event, selectedDate) => {
                                        setShowDatePicker(false);
                                        if (selectedDate) setForm({...form, date: selectedDate});
                                    }}
                                />
                            )}

                            <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Note (Optional)</Text>
                            <TextInput
                                className={`p-4 rounded-2xl mb-8 font-nunito border ${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-200'}`}
                                placeholder="Add any extra details..."
                                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                                value={form.note}
                                onChangeText={t => setForm({...form, note: t})}
                            />
                        </ScrollView>

                        <TouchableOpacity 
                            onPress={handleSaveMilestone}
                            disabled={!form.title}
                            className={`w-full py-4 rounded-2xl items-center shadow-lg shadow-indigo-500/30 ${!form.title ? 'bg-indigo-300' : 'bg-indigo-500'}`}
                        >
                            <Text className="font-nunito-black text-white text-lg">{editingMilestone ? 'Update Event' : 'Save Event'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <CalendarImportModal 
                visible={showImportModal} 
                onClose={() => setShowImportModal(false)}
                onImport={handleImport}
            />

            {/* Day Details Modal */}
            <Modal visible={showDetailsModal} transparent animationType="slide">
                <View className="flex-1 justify-end bg-black/60">
                    <View className={`rounded-t-3xl p-6 h-[60%] ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                        {/* Header */}
                        <View className="flex-row justify-between items-center mb-6">
                            <View>
                                <Text className={`font-nunito-black text-xl ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                    Day Details
                                </Text>
                                <Text className={`font-nunito text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {selectedDateStr ? (() => {
                                        const parts = selectedDateStr.split('-');
                                        if (parts.length === 3) {
                                            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                                            return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                                        }
                                        return '';
                                    })() : ''}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                                <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
                            </TouchableOpacity>
                        </View>

                        {/* Event List */}
                        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                            {selectedDateStr && getEventsForDate(selectedDateStr).length === 0 ? (
                                <View className="py-12 items-center justify-center">
                                    <Ionicons name="calendar-outline" size={48} color={isDark ? '#475569' : '#94a3b8'} />
                                    <Text className={`font-nunito-bold mt-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        No events scheduled for this day.
                                    </Text>
                                </View>
                            ) : (
                                <View className="space-y-4 flex-col">
                                    {selectedDateStr && getEventsForDate(selectedDateStr).map((m: any) => {
                                        const typeConfig = activeTypes[m.type as keyof typeof activeTypes] || activeTypes.custom;
                                        return (
                                            <View key={m.id} className={`p-4 rounded-3xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`} style={{ marginBottom: 12 }}>
                                                <View className="flex-row justify-between items-start">
                                                    <View className="flex-1 mr-4">
                                                        <Text className={`font-nunito-bold text-base mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                                            {m.title}
                                                        </Text>
                                                        <View className="flex-row items-center flex-wrap">
                                                            <View style={{ backgroundColor: typeConfig.bg, borderColor: `${typeConfig.color}40`, borderWidth: 1 }} className="px-2 py-0.5 rounded-md mr-2">
                                                                <Text style={{ color: typeConfig.color }} className="font-nunito-bold text-[10px]">
                                                                    {typeConfig.label}
                                                                </Text>
                                                            </View>
                                                            <Text className={`font-nunito text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                                {m.yearName} - {m.semName}
                                                            </Text>
                                                        </View>
                                                        {m.note && (
                                                            <Text className={`font-nunito text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                                {m.note}
                                                            </Text>
                                                        )}
                                                    </View>
                                                    <View className="flex-row space-x-3">
                                                        <TouchableOpacity onPress={() => {
                                                            setShowDetailsModal(false);
                                                            setActiveYearId(m.yearId);
                                                            setActiveSemId(m.semId);
                                                            const parts = m.date.split('-');
                                                            const d = parts.length === 3 
                                                                ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
                                                                : new Date(m.date);
                                                            setForm({ title: m.title, date: d, type: m.type, note: m.note || '' });
                                                            setEditingMilestone(m);
                                                            setShowAddModal(true);
                                                        }}>
                                                            <Ionicons name="pencil" size={18} color={isDark ? '#cbd5e1' : '#64748b'} />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={() => {
                                                            handleDeleteMilestone(m.id, m.yearId, m.semId);
                                                        }}>
                                                            <Ionicons name="trash" size={18} color="#ef4444" />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </ScrollView>

                        {/* Add New Event Button */}
                        <TouchableOpacity 
                            onPress={() => {
                                setShowDetailsModal(false);
                                setForm({ 
                                    title: '', 
                                    date: selectedDateStr ? (() => {
                                        const parts = selectedDateStr.split('-');
                                        return parts.length === 3 
                                            ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
                                            : new Date(selectedDateStr);
                                    })() : new Date(), 
                                    type: 'custom', 
                                    note: '' 
                                });
                                setEditingMilestone(null);
                                setShowAddModal(true);
                            }}
                            className="w-full py-4 rounded-2xl bg-indigo-500 items-center justify-center flex-row space-x-2 mt-4 shadow-lg shadow-indigo-500/30"
                        >
                            <Ionicons name="add" size={20} color="white" />
                            <Text className="font-nunito-black text-white text-lg">Add New Event</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
