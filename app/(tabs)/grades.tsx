import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Modal, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabaseClient';
import { SyncService } from '@/services/SyncService';
import { Calculator } from '@/utils/calculator';
import { useColorScheme } from 'nativewind';
import { useFocusEffect, router } from 'expo-router';

import GwaSummary from '@/components/ledger/GwaSummary';
import Tabs from '@/components/ledger/Tabs';
import SubjectCard from '@/components/ledger/SubjectCard';
import ActiveSubjectView from '@/components/ledger/ActiveSubjectView';
import { AlertService } from '@/components/CustomAlert';
import { useSemesterContext } from '@/components/SemesterContext';
import { getTheme, Typography, Radius, Shadows } from '@/constants/Theme';
import { ListSkeleton } from '@/components/ui/LoadingSkeleton';
import {
  ensureSubjectExists,
  toggleGradeTracking,
  getUnscheduledSubjects,
} from '@/utils/subjectRegistry';

const generateId = () => Math.random().toString(36).substr(2, 9);

/** Recursively clone a subject and regenerate every ID in the tree so React keys never collide. */
function deepCloneSubject(sub: any): any {
    const cloned = JSON.parse(JSON.stringify(sub));
    cloned.id = generateId();
    (cloned.periods || []).forEach((p: any) => {
        p.id = generateId();
        (p.components || []).forEach((c: any) => {
            c.id = generateId();
            (c.items || []).forEach((item: any) => {
                item.id = generateId();
                (item.subItems || []).forEach((si: any) => { si.id = generateId(); });
            });
        });
    });
    return cloned;
}

const INITIAL_DATA = {
  settings: { gradingSystem: '1_IS_BEST' },
  years: []
};

export default function GradeLedgerTab() {
  const [data, setData] = useState<any>(null);
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
  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [syncStatus, setSyncStatus] = useState('offline');
  const [user, setUser] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);

  // ── Add Subject modal state
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [addSubjectError, setAddSubjectError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) setSyncStatus('offline');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) setSyncStatus('offline');
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadLocalData = useCallback(async () => {
      let loaded = null;
      try {
        const local = await AsyncStorage.getItem('grade_ledger_v2_data');
        if (loaded) loaded = JSON.parse(local!);
        if (local) loaded = JSON.parse(local);
      } catch(e) {}

      if (!loaded) loaded = INITIAL_DATA;

      loaded.years.forEach((y: any) => y.semesters.forEach((s: any) => {
        if (!s.classes) s.classes = [];
        if (!s.subjects) s.subjects = [];
        if (!s.milestones) s.milestones = [];
        // Backfill defaults for subjects created before this feature
        s.subjects.forEach((sub: any) => {
          if (sub.gradeTrackingEnabled === undefined) sub.gradeTrackingEnabled = true;
          if (sub.hasSchedule === undefined) sub.hasSchedule = false;
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

  const saveData = useCallback(async (newData: any) => {
    setData(newData);
    await SyncService.pushLocalChanges(newData);
  }, []);

  if (!data) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ListSkeleton count={3} cardHeight={140} />
    </SafeAreaView>
  );

  const currentYear = data.years.find((y: any) => y.id === activeYearId);
  const currentSem = currentYear?.semesters.find((s: any) => s.id === activeSemId);
  const system = data.settings?.gradingSystem || '1_IS_BEST';

  let semPercent = 0, semEq = 0, yearPercent = 0, yearEq = 0, cumPercent = 0, cumEq = 0;
  if (currentSem) {
    const semRes = Calculator.calculateSemester(currentSem, system);
    semPercent = semRes.percent; semEq = semRes.equivalent;
  }
  if (currentYear) {
    const yrRes = Calculator.calculateYear(currentYear, system);
    yearPercent = yrRes.percent; yearEq = yrRes.equivalent;
  }
  const cumRes = Calculator.calculateCumulative(data.years, system);
  cumPercent = cumRes.percent; cumEq = cumRes.equivalent;

  // ── Unscheduled subjects for the current semester
  const unscheduledSubjects = currentSem ? getUnscheduledSubjects(currentSem) : [];

  // ── Add Subject handler (via registry — prevents duplicates)
  const handleAddSubject = () => {
    setNewSubjectName('');
    setAddSubjectError('');
    setShowAddSubjectModal(true);
  };

  const handleConfirmAddSubject = () => {
    const name = newSubjectName.trim();
    if (!name) {
      setAddSubjectError('Please enter a subject name.');
      return;
    }
    const result = ensureSubjectExists(data, activeYearId, activeSemId, name, { fromSchedule: false });
    if (!result.isNew) {
      setAddSubjectError(`"${name}" already exists. Tap it to manage grades.`);
      return;
    }
    setShowAddSubjectModal(false);
    setNewSubjectName('');
    saveData(result.data);
  };

  // ── Grade tracking toggle handler
  const handleToggleTracking = (subId: string) => {
    const sem = data.years.find((y: any) => y.id === activeYearId)?.semesters.find((s: any) => s.id === activeSemId);
    const subject = sem?.subjects?.find((s: any) => s.id === subId);
    if (!subject) return;

    const isCurrentlyTracked = subject.gradeTrackingEnabled !== false;
    AlertService.alert(
      isCurrentlyTracked ? 'Pause Grade Tracking' : 'Resume Grade Tracking',
      isCurrentlyTracked
        ? `"${subject.name}" will be excluded from GWA calculations. You can re-enable it anytime.`
        : `"${subject.name}" will be included in GWA calculations again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isCurrentlyTracked ? 'Pause' : 'Resume',
          style: isCurrentlyTracked ? 'destructive' : 'default',
          onPress: () => {
            const nd = toggleGradeTracking(data, activeYearId, activeSemId, subId);
            saveData(nd);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{
        paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, zIndex: 10,
        borderBottomWidth: 1, borderBottomColor: isDark ? theme.cardBorder : '#f1f5f9',
        backgroundColor: theme.surface,
        ...(!isDark ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 } : {}),
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12,
              backgroundColor: isDark ? 'rgba(37,99,235,0.2)' : '#dbeafe',
            }}>
              <Ionicons name="school" size={20} color={isDark ? '#60a5fa' : '#3b82f6'} />
            </View>
            <View>
              <Text style={{ ...Typography.title, color: theme.text }}>Grade Tracker</Text>
              <Text style={{ ...Typography.caption, color: theme.textTertiary }}>Manage your grades</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {syncStatus === 'syncing' && <Ionicons name="cloud-upload" size={22} color={theme.textTertiary} />}
            {syncStatus === 'saved' && <Ionicons name="cloud-done" size={22} color={theme.success} />}
            {syncStatus === 'offline' && <Ionicons name="cloud-offline" size={22} color={theme.textTertiary} />}

            <TouchableOpacity 
              onPress={() => setShowSettings(true)}
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9' }}
            >
              <Ionicons name="options" size={22} color={isDark ? '#cbd5e1' : '#475569'} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/profile')}
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9' }}
            >
              <Ionicons name="settings-outline" size={22} color={isDark ? '#cbd5e1' : '#475569'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-6" contentContainerStyle={{ paddingBottom: 100 }} removeClippedSubviews={true}>
        {activeSubId && currentSem ? (
            <ActiveSubjectView 
                subject={currentSem.subjects.find((s: any) => s.id === activeSubId)}
                system={system}
                onBack={() => setActiveSubId(null)}
                onChange={(newSubject: any) => {
                    const nd = JSON.parse(JSON.stringify(data));
                    const sem = nd.years.find((y: any) => y.id === activeYearId)?.semesters.find((s: any) => s.id === activeSemId);
                    if (sem) {
                        const idx = sem.subjects.findIndex((s: any) => s.id === activeSubId);
                        if (idx !== -1) {
                            const oldName = sem.subjects[idx].name;
                            sem.subjects[idx] = newSubject;
                            
                            // IF renamed, update all connected schedule blocks!
                            if (newSubject.name !== oldName && sem.classes) {
                                sem.classes.forEach((c: any) => {
                                    if (c.subjectId === activeSubId) {
                                        c.name = newSubject.name;
                                    }
                                });
                            }
                            
                            saveData(nd);
                        }
                    }
                }}
            />
        ) : (
            <>
                <GwaSummary 
                    semGwa={system === 'PERCENT' ? semPercent : semEq} 
                    yearGwa={system === 'PERCENT' ? yearPercent : yearEq} 
                    cumGwa={system === 'PERCENT' ? cumPercent : cumEq} 
                    semPercent={semPercent}
                    yearPercent={yearPercent}
                    cumPercent={cumPercent}
                    system={system} 
                />

                <Tabs 
                    years={data.years} 
                    activeYearId={activeYearId} 
                    activeSemId={activeSemId}
                    onSelectYear={id => {
                        setActiveYearId(id);
                        setActiveSubId(null);
                        const yr = data.years.find((y: any) => y.id === id);
                        if (yr && yr.semesters.length > 0) setActiveSemId(yr.semesters[0].id);
                        else setActiveSemId(null);
                    }}
                    onSelectSem={id => {
                        setActiveSemId(id);
                        setActiveSubId(null);
                    }}
                />

                {!currentSem ? (
                    <View className={`mt-10 items-center justify-center p-8 rounded-[32px] ${isDark ? 'bg-slate-800' : 'bg-white shadow-sm'}`}>
                        <Ionicons name="folder-open" size={48} color={isDark ? "#475569" : "#94a3b8"} style={{marginBottom: 16}} />
                        {data?.years?.length === 0 ? (
                            <>
                                <Text className={`text-center font-medium mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No years added yet. {'\n'}Setup your academic terms to get started!</Text>
                                <TouchableOpacity 
                                    onPress={() => router.push('/academic-manager')}
                                    className={`px-6 py-3 rounded-full flex-row items-center ${isDark ? 'bg-indigo-500' : 'bg-indigo-600'}`}
                                >
                                    <Ionicons name="add" size={20} color="white" />
                                    <Text className="font-nunito-bold text-white ml-2">Setup Academic Term</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <Text className={`text-center font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No semester selected. {'\n'}Select a semester above to get started!</Text>
                        )}
                    </View>
                ) : (
                    <View className="mt-2">
                        {/* ── Unscheduled subjects alert ──────────────────────── */}
                        {unscheduledSubjects.length > 0 && (
                          <TouchableOpacity
                            onPress={() => router.push('/(tabs)/schedule')}
                            className={`mb-4 p-4 rounded-[24px] border flex-row items-center ${isDark ? 'bg-amber-950/40 border-amber-800/40' : 'bg-amber-50 border-amber-200'}`}
                          >
                            <Ionicons name="time-outline" size={18} color="#f59e0b" style={{ marginRight: 10 }} />
                            <View className="flex-1">
                              <Text className={`font-bold text-sm ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                                {unscheduledSubjects.length} subject{unscheduledSubjects.length > 1 ? 's' : ''} without a schedule
                              </Text>
                              <Text className={`text-xs mt-0.5 ${isDark ? 'text-amber-500/70' : 'text-amber-600/80'}`}>
                                {unscheduledSubjects.map((s: any) => s.name).join(', ')} · Tap to add class times →
                              </Text>
                            </View>
                          </TouchableOpacity>
                        )}

                        <View className="flex-row justify-between items-center mb-4 px-2">
                            <Text className={`font-nunito-black text-lg ${isDark ? 'text-white' : 'text-slate-800'}`}>Subjects</Text>
                            <View className="flex-row gap-2">
                                <TouchableOpacity 
                                    onPress={() => {
                                        if (isEditing) {
                                            setIsEditing(false);
                                            setSelectedSubjects(new Set());
                                        } else {
                                            setIsEditing(true);
                                        }
                                    }}
                                    className={`${isEditing ? 'bg-indigo-500' : (isDark ? 'bg-slate-800' : 'bg-slate-200')} px-3 py-1.5 rounded-full flex-row items-center`}
                                >
                                    <Ionicons name={isEditing ? "checkmark" : "create-outline"} size={16} color={isEditing ? 'white' : (isDark ? '#cbd5e1' : '#475569')} />
                                    <Text className={`font-nunito-bold ml-1 text-xs ${isEditing ? 'text-white' : (isDark ? 'text-slate-300' : 'text-slate-600')}`}>{isEditing ? 'Done' : 'Edit'}</Text>
                                </TouchableOpacity>
                                
                                {isEditing && selectedSubjects.size > 0 && (
                                    <TouchableOpacity 
                                        onPress={() => {
                                            AlertService.alert(
                                                "Delete Selected",
                                                `Are you sure you want to delete ${selectedSubjects.size} subject(s)?`,
                                                [
                                                    { text: "Cancel", style: "cancel" },
                                                    { text: "Delete", style: "destructive", onPress: () => {
                                                        const nd = {...data};
                                                        const sem = nd.years.find((y: any) => y.id === activeYearId).semesters.find((s: any) => s.id === activeSemId);
                                                        sem.subjects = sem.subjects.filter((s: any) => !selectedSubjects.has(s.id));
                                                        saveData(nd);
                                                        setSelectedSubjects(new Set());
                                                        setIsEditing(false);
                                                    }}
                                                ]
                                            );
                                        }}
                                        className="bg-red-500 px-3 py-1.5 rounded-full flex-row items-center"
                                    >
                                        <Ionicons name="trash" size={16} color="white" />
                                        <Text className="font-nunito-bold text-white ml-1 text-xs">Delete ({selectedSubjects.size})</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {[...currentSem.subjects].sort((a: any, b: any) => {
                            const aTracked = a.gradeTrackingEnabled !== false;
                            const bTracked = b.gradeTrackingEnabled !== false;
                            if (aTracked === bTracked) return 0;
                            return aTracked ? -1 : 1;
                        }).map((sub: any, i: number) => (
                            <SubjectCard 
                                key={sub.id} 
                                subject={sub} 
                                system={system} 
                                isSelectionMode={isEditing}
                                isSelected={selectedSubjects.has(sub.id)}
                                onSelect={() => {
                                    const newSet = new Set(selectedSubjects);
                                    if (newSet.has(sub.id)) newSet.delete(sub.id);
                                    else newSet.add(sub.id);
                                    setSelectedSubjects(newSet);
                                }}
                                onClick={() => setActiveSubId(sub.id)}
                                onToggleTracking={() => handleToggleTracking(sub.id)}
                                onDelete={() => {
                                    AlertService.alert(
                                        "Delete Subject",
                                        `Are you sure you want to delete ${sub.name}?`,
                                        [
                                            { text: "Cancel", style: "cancel" },
                                            { text: "Delete", style: "destructive", onPress: () => {
                                                const nd = {...data};
                                                const sem = nd.years.find((y: any) => y.id === activeYearId).semesters.find((s: any) => s.id === activeSemId);
                                                sem.subjects = sem.subjects.filter((s: any) => s.id !== sub.id);
                                                saveData(nd);
                                            }}
                                        ]
                                    );
                                }}
                                onDuplicate={() => {
                                    // Use deep copy so the push doesn't mutate shared state references
                                    const nd = JSON.parse(JSON.stringify(data));
                                    const sem = nd.years.find((y: any) => y.id === activeYearId).semesters.find((s: any) => s.id === activeSemId);
                                    const clone = deepCloneSubject(sub);
                                    clone.name = sub.name + ' Copy';
                                    sem.subjects.push(clone);
                                    saveData(nd);
                                }}
                            />
                        ))}

                        
                        {/* Add New Subject button */}
                        <TouchableOpacity 
                            onPress={handleAddSubject}
                            className={`border-dashed rounded-[32px] p-4 mt-2 items-center justify-center py-6 border-[2px] ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-blue-50 border-blue-200'}`}
                        >
                            <View className="w-12 h-12 rounded-full bg-blue-500 items-center justify-center shadow-sm shadow-blue-500 mb-2">
                                <Ionicons name="add" size={24} color="#ffffff" />
                            </View>
                            <Text className="text-blue-500 font-bold text-base">Add New Subject</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </>
        )}
      </ScrollView>

      {/* ── Add Subject Modal ──────────────────────────────────── */}
      <Modal visible={showAddSubjectModal} transparent animationType="slide" onRequestClose={() => setShowAddSubjectModal(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className={`rounded-t-[32px] px-6 pt-4 pb-12 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <View className="items-center mb-5">
              <View className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
            </View>
            <View className="flex-row justify-between items-center mb-6">
              <Text className={`font-nunito-black text-xl ${isDark ? 'text-white' : 'text-slate-800'}`}>New Subject</Text>
              <TouchableOpacity onPress={() => setShowAddSubjectModal(false)} className={`w-8 h-8 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <Ionicons name="close" size={18} color={isDark ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>

            <Text className={`font-bold text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Subject Name *</Text>
            <TextInput
              className={`p-4 rounded-2xl mb-2 font-nunito border ${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-200'}`}
              placeholder="e.g. MATH101, Physics, English Lit"
              placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
              value={newSubjectName}
              onChangeText={t => { setNewSubjectName(t); setAddSubjectError(''); }}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleConfirmAddSubject}
            />
            {addSubjectError ? (
              <Text className="text-red-500 text-xs mb-4 font-bold">{addSubjectError}</Text>
            ) : (
              <Text className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                If this subject already exists, you'll be notified.
              </Text>
            )}

            <TouchableOpacity
              onPress={handleConfirmAddSubject}
              className="py-4 rounded-2xl items-center bg-blue-500 shadow-lg shadow-blue-500/30"
            >
              <Text className="font-bold text-white text-base">Add Subject</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSettings(false)}>
        <View className={`flex-1 pt-12 px-6 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
            <View className="flex-row justify-between items-center mb-8">
                <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Settings</Text>
                <TouchableOpacity onPress={() => setShowSettings(false)} className={`p-2 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    <Ionicons name="close" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                </TouchableOpacity>
            </View>

            <View className={`p-4 rounded-3xl mb-6 shadow-sm ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                <Text className={`text-xs font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Grading System</Text>
                {['1_IS_BEST', '5_IS_BEST', '4_IS_BEST', 'PERCENT'].map((sys) => (
                    <TouchableOpacity 
                        key={sys}
                        onPress={() => {
                            const nd = {...data};
                            if (!nd.settings) nd.settings = {};
                            nd.settings.gradingSystem = sys;
                            saveData(nd);
                        }}
                        className={`flex-row items-center justify-between py-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}`}
                    >
                        <Text className={`text-base font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            {sys === '1_IS_BEST' ? '1.0 is Best (e.g. UP)' : 
                             sys === '5_IS_BEST' ? '5.0 is Best (e.g. PUP)' : 
                             sys === '4_IS_BEST' ? '4.0 is Best (e.g. DLSU)' : 
                             'Percentage (0-100%)'}
                        </Text>
                        {system === sys && <Ionicons name="checkmark-circle" size={24} color="#3b82f6" />}
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity 
                onPress={() => {
                    AlertService.alert(
                        "Reset Data",
                        "Are you sure you want to reset all Ledger data? This cannot be undone.",
                        [
                            { text: "Cancel", style: "cancel" },
                            { text: "Reset", style: "destructive", onPress: () => {
                                saveData(INITIAL_DATA);
                                setShowSettings(false);
                            }}
                        ]
                    );
                }}
                className={`p-4 rounded-3xl items-center border ${isDark ? 'bg-red-950 border-red-900' : 'bg-red-50 border-red-100'}`}
            >
                <Text className={`font-bold text-base ${isDark ? 'text-red-500' : 'text-red-600'}`}>Erase All Data</Text>
            </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
