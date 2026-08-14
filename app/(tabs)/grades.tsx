import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Modal, TextInput, TouchableOpacity, Pressable } from 'react-native';
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
import PremiumPaywallModal from '@/components/PremiumPaywallModal';
import {
  ensureSubjectExists,
  toggleGradeTracking,
  getUnscheduledSubjects,
  getTrackedSubjects,
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
  const { selectedYear: activeYearId, selectedSemester: activeSemId } = useSemesterContext();
  const [activeTab, setActiveTab] = useState<'all' | 'tracked'>('all');

  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [syncStatus, setSyncStatus] = useState('offline');
  const [user, setUser] = useState<any>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);

  // ── Add Subject modal state
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [addSubjectError, setAddSubjectError] = useState('');

  useEffect(() => {
    setIsPremium(SyncService.getIsPremium());

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) setSyncStatus('offline');
      if (session?.user) {
        SyncService.checkAndRestorePremium().then(() => {
          setIsPremium(SyncService.getIsPremium());
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) setSyncStatus('offline');
      if (session?.user) {
        SyncService.checkAndRestorePremium().then(() => {
          setIsPremium(SyncService.getIsPremium());
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadLocalData = useCallback(async () => {
      let loaded = null;
      try {
        const local = await AsyncStorage.getItem('grade_ledger_v2_data');
        if (local) loaded = JSON.parse(local);
      } catch(e) {}

      if (!loaded) loaded = INITIAL_DATA;

      loaded.years?.forEach((y: any) => y.semesters?.forEach((s: any) => {
        if (!s.classes) s.classes = [];
        if (!s.subjects) s.subjects = [];
        if (!s.milestones) s.milestones = [];
        s.subjects.forEach((sub: any) => {
          if (sub.gradeTrackingEnabled === undefined) sub.gradeTrackingEnabled = true;
          if (sub.hasSchedule === undefined) sub.hasSchedule = false;
        });
      }));
      
      setIsPremium(SyncService.getIsPremium());
      setData(loaded);
  }, []);

  useFocusEffect(
    useCallback(() => {
        loadLocalData();
    }, [loadLocalData])
  );

  useEffect(() => {
      const unsubData = SyncService.subscribeDataChange(() => {
          setIsPremium(SyncService.getIsPremium());
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

  const currentYear = data.years?.find((y: any) => y.id === activeYearId);
  const currentSem = currentYear?.semesters?.find((s: any) => s.id === activeSemId);
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
  const cumRes = Calculator.calculateCumulative(data.years || [], system);
  cumPercent = cumRes.percent; cumEq = cumRes.equivalent;

  // Unscheduled subjects for current semester
  const unscheduledSubjects = currentSem ? getUnscheduledSubjects(currentSem) : [];

  // Active filter subjects
  const allSubjects = currentSem?.subjects || [];
  const trackedSubjects = currentSem ? getTrackedSubjects(currentSem) : [];
  const displayedSubjects = activeTab === 'tracked' ? trackedSubjects : allSubjects;

  const sortedSubjects = [...displayedSubjects].sort((a: any, b: any) => {
    const aTracked = a.gradeTrackingEnabled !== false;
    const bTracked = b.gradeTrackingEnabled !== false;
    if (aTracked === bTracked) return 0;
    return aTracked ? -1 : 1;
  });

  // ── Add Subject handler
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

  // ── Single subject delete handler
  const handleDeleteSubject = (sub: any) => {
    AlertService.alert(
      "Delete Subject",
      `Are you sure you want to delete ${sub.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: () => {
            const nd = JSON.parse(JSON.stringify(data));
            const sem = nd.years.find((y: any) => y.id === activeYearId)?.semesters.find((s: any) => s.id === activeSemId);
            if (sem) {
              sem.subjects = sem.subjects.filter((s: any) => s.id !== sub.id);
              saveData(nd);
            }
          } 
        }
      ]
    );
  };

  // ── Duplicate subject handler
  const handleDuplicateSubject = (sub: any) => {
    const nd = JSON.parse(JSON.stringify(data));
    const sem = nd.years.find((y: any) => y.id === activeYearId)?.semesters.find((s: any) => s.id === activeSemId);
    if (sem) {
      const clone = deepCloneSubject(sub);
      clone.name = sub.name + ' Copy';
      sem.subjects.push(clone);
      saveData(nd);
    }
  };

  // ── Batch Delete handler
  const handleDeleteSelected = () => {
    AlertService.alert(
      "Delete Selected",
      `Are you sure you want to delete ${selectedSubjects.size} subject(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: () => {
            const nd = JSON.parse(JSON.stringify(data));
            const sem = nd.years.find((y: any) => y.id === activeYearId)?.semesters.find((s: any) => s.id === activeSemId);
            if (sem) {
              sem.subjects = sem.subjects.filter((s: any) => !selectedSubjects.has(s.id));
              saveData(nd);
            }
            setSelectedSubjects(new Set());
            setIsEditing(false);
          }
        }
      ]
    );
  };

  // ── Toggle Select All handler
  const handleToggleSelectAll = () => {
    if (selectedSubjects.size === sortedSubjects.length) {
      setSelectedSubjects(new Set());
    } else {
      setSelectedSubjects(new Set(sortedSubjects.map((s: any) => s.id)));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Screen Header Actions Bar */}
      <View style={{
        paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, zIndex: 10,
        borderBottomWidth: 1, borderBottomColor: isDark ? theme.cardBorder : '#f1f5f9',
        backgroundColor: theme.surface,
        ...(!isDark ? Shadows.sm : {}),
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Header Title & Subtitle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12 }}>
            <View style={{
              width: 38, height: 38, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginRight: 10,
              backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff',
              flexShrink: 0
            }}>
              <Ionicons name="school" size={19} color={isDark ? '#818cf8' : '#4f46e5'} />
            </View>
            
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <Text numberOfLines={1} style={{ ...Typography.title, color: theme.text, fontSize: 20, flexShrink: 1, marginRight: 8 }}>
                    Grade Ledger
                  </Text>
                </View>
                
                <Text numberOfLines={1} style={{ ...Typography.caption, color: theme.textTertiary, fontSize: 12 }}>
                  Track grades & calculate GWAs
                </Text>
              </View>
          </View>

          {/* Header Controls (Sync, Settings, Profile) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {syncStatus === 'syncing' && <Ionicons name="cloud-upload" size={20} color={theme.textTertiary} />}
            {syncStatus === 'saved' && <Ionicons name="cloud-done" size={20} color={theme.success} />}
            {syncStatus === 'offline' && <Ionicons name="cloud-offline" size={20} color={theme.textTertiary} />}

            <TouchableOpacity 
              onPress={() => setShowSettings(true)}
              activeOpacity={0.7}
              style={{ 
                width: 36, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', 
                backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9' 
              }}
            >
              <Ionicons name="options-outline" size={20} color={isDark ? '#cbd5e1' : '#475569'} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.7}
              style={{ 
                width: 36, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', 
                backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9' 
              }}
            >
              <Ionicons name="settings-outline" size={20} color={isDark ? '#cbd5e1' : '#475569'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView 
        className="flex-1 px-4 pt-4" 
        contentContainerStyle={{ paddingBottom: 100 }} 
        removeClippedSubviews={true}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: '100%', maxWidth: 800, alignSelf: 'center' }}>
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
                  
                  // Update connected schedule blocks if subject was renamed
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
            {/* Top GWA Summary (Overall Hero Banner + Side-by-side Semester/Year Donut Cards) */}
            <GwaSummary 
              semGwa={system === 'PERCENT' ? semPercent : semEq} 
              yearGwa={system === 'PERCENT' ? yearPercent : yearEq} 
              cumGwa={system === 'PERCENT' ? cumPercent : cumEq} 
              semPercent={semPercent}
              yearPercent={yearPercent}
              cumPercent={cumPercent}
              system={system} 
            />

            {/* Academic Term Switcher & View Filter Tabs */}
            <Tabs 
              years={data.years} 
              activeYearId={activeYearId} 
              activeSemId={activeSemId}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onSelectYear={() => setActiveSubId(null)}
              onSelectSem={() => setActiveSubId(null)}
            />

            {/* Empty State A: No Academic Terms / Semester Selected */}
            {!currentSem ? (
              <View 
                style={{
                  borderRadius: Radius['2xl'],
                  padding: 28,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 16,
                  borderWidth: 1,
                  borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                  backgroundColor: isDark ? theme.card : theme.surface,
                  ...Shadows.md,
                }}
              >
                <View style={{
                  width: 60, height: 60, borderRadius: Radius.full,
                  alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                  backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff',
                }}>
                  <Ionicons name="folder-open-outline" size={32} color={isDark ? '#818cf8' : '#4f46e5'} />
                </View>
                {data?.years?.length === 0 ? (
                  <>
                    <Text style={{ ...Typography.title, fontSize: 18, color: theme.text, textAlign: 'center', marginBottom: 8 }}>
                      No Academic Terms Found
                    </Text>
                    <Text style={{ ...Typography.body, fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
                      Set up your academic terms to get started with grade tracking!
                    </Text>
                    <TouchableOpacity 
                      onPress={() => router.push('/academic-manager')}
                      activeOpacity={0.8}
                      style={{
                        paddingHorizontal: 20, paddingVertical: 12, borderRadius: Radius.full,
                        flexDirection: 'row', alignItems: 'center',
                        backgroundColor: theme.primary,
                        ...Shadows.sm,
                      }}
                    >
                      <Ionicons name="add-circle-outline" size={18} color="white" />
                      <Text style={{ ...Typography.bodyBold, color: 'white', marginLeft: 8, fontSize: 14 }}>
                        Setup Academic Term
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={{ ...Typography.title, fontSize: 18, color: theme.text, textAlign: 'center', marginBottom: 8 }}>
                      No Semester Selected
                    </Text>
                    <Text style={{ ...Typography.body, fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 20 }}>
                      Select a semester above to manage your subjects and grades!
                    </Text>
                  </>
                )}
              </View>
            ) : (
              <View className="mt-1">
                {/* Unscheduled subjects warning pill banner */}
                {unscheduledSubjects.length > 0 && (
                  <TouchableOpacity
                    onPress={() => router.push('/(tabs)/schedule')}
                    activeOpacity={0.8}
                    style={{
                      borderRadius: Radius.xl,
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(217,119,6,0.3)' : '#fde68a',
                      backgroundColor: isDark ? 'rgba(69,26,3,0.5)' : '#fffbeb',
                      padding: 14,
                      marginBottom: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      ...Shadows.sm,
                    }}
                  >
                    <View style={{
                      width: 32, height: 32, borderRadius: Radius.full,
                      backgroundColor: isDark ? 'rgba(245,158,11,0.2)' : '#fef3c7',
                      alignItems: 'center', justifyContent: 'center', marginRight: 10,
                    }}>
                      <Ionicons name="time-outline" size={18} color="#f59e0b" />
                    </View>
                    <View className="flex-1">
                      <Text style={{ ...Typography.captionBold, color: isDark ? '#fbbf24' : '#b45309', fontSize: 13 }}>
                        {unscheduledSubjects.length} subject{unscheduledSubjects.length > 1 ? 's' : ''} without a schedule
                      </Text>
                      <Text style={{ ...Typography.caption, color: isDark ? '#fcd34d' : '#d97706', fontSize: 11, marginTop: 1 }}>
                        {unscheduledSubjects.map((s: any) => s.name).join(', ')} · Tap to add class times →
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Section Header Toolbar & Edit Selection Mode Bar */}
                <View 
                  style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 14, paddingHorizontal: 4,
                  }}
                >
                  {isEditing ? (
                    /* Edit Mode Selection Toolbar */
                    <View 
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1,
                        backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
                        borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 8,
                        borderWidth: 1, borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                        ...Shadows.sm,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {/* Select All / Deselect All Pill */}
                        <TouchableOpacity
                          onPress={handleToggleSelectAll}
                          activeOpacity={0.7}
                          style={{
                            paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
                            backgroundColor: isDark ? theme.card : '#ffffff',
                            borderWidth: 1, borderColor: isDark ? theme.cardBorder : '#cbd5e1',
                          }}
                        >
                          <Text style={{ ...Typography.captionBold, color: isDark ? '#cbd5e1' : '#475569', fontSize: 12 }}>
                            {selectedSubjects.size === sortedSubjects.length && sortedSubjects.length > 0 ? 'Deselect All' : 'Select All'}
                          </Text>
                        </TouchableOpacity>

                        {/* Delete Selected Pill Button */}
                        <TouchableOpacity
                          onPress={handleDeleteSelected}
                          disabled={selectedSubjects.size === 0}
                          activeOpacity={0.7}
                          style={{
                            paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
                            backgroundColor: selectedSubjects.size > 0 ? theme.error : (isDark ? '#334155' : '#e2e8f0'),
                            flexDirection: 'row', alignItems: 'center', gap: 4,
                            opacity: selectedSubjects.size > 0 ? 1 : 0.6,
                            ... (selectedSubjects.size > 0 ? Shadows.sm : {}),
                          }}
                        >
                          <Ionicons name="trash" size={14} color={selectedSubjects.size > 0 ? 'white' : (isDark ? '#94a3b8' : '#64748b')} />
                          <Text style={{ ...Typography.captionBold, color: selectedSubjects.size > 0 ? 'white' : (isDark ? '#94a3b8' : '#64748b'), fontSize: 12 }}>
                            Delete ({selectedSubjects.size})
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Cancel / Done Pill */}
                      <TouchableOpacity
                        onPress={() => {
                          setIsEditing(false);
                          setSelectedSubjects(new Set());
                        }}
                        activeOpacity={0.7}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
                          backgroundColor: theme.primary,
                        }}
                      >
                        <Text style={{ ...Typography.captionBold, color: 'white', fontSize: 12 }}>
                          Done
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    /* Standard Section Header Bar */
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ ...Typography.subtitle, color: theme.text, fontSize: 18 }}>
                          Subjects
                        </Text>
                        <View 
                          style={{ 
                            backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff', 
                            paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full 
                          }}
                        >
                          <Text style={{ ...Typography.captionBold, color: isDark ? '#818cf8' : '#4f46e5', fontSize: 11 }}>
                            {displayedSubjects.length}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {/* Edit Mode Pill Toggle */}
                        {allSubjects.length > 0 && (
                          <TouchableOpacity 
                            onPress={() => setIsEditing(true)}
                            activeOpacity={0.7}
                            style={{
                              paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
                              backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
                              borderWidth: 1, borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                              flexDirection: 'row', alignItems: 'center', gap: 4,
                            }}
                          >
                            <Ionicons name="create-outline" size={14} color={isDark ? '#cbd5e1' : '#475569'} />
                            <Text style={{ ...Typography.captionBold, color: isDark ? '#cbd5e1' : '#475569', fontSize: 12 }}>
                              Edit
                            </Text>
                          </TouchableOpacity>
                        )}

                        {/* Add Subject Pill Button */}
                        <TouchableOpacity 
                          onPress={handleAddSubject}
                          activeOpacity={0.8}
                          style={{
                            paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
                            backgroundColor: theme.primary,
                            flexDirection: 'row', alignItems: 'center', gap: 4,
                            ...Shadows.sm,
                          }}
                        >
                          <Ionicons name="add" size={16} color="white" />
                          <Text style={{ ...Typography.captionBold, color: 'white', fontSize: 12 }}>
                            Add Subject
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>

                {/* Empty State B: No subjects in current semester */}
                {allSubjects.length === 0 ? (
                  <View 
                    style={{
                      borderRadius: Radius['2xl'],
                      padding: 24,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 8,
                      marginBottom: 16,
                      borderWidth: 1,
                      borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                      backgroundColor: isDark ? theme.card : theme.surface,
                      ...Shadows.md,
                    }}
                  >
                    <View style={{
                      width: 52, height: 52, borderRadius: Radius.full,
                      alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                      backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#e0e7ff',
                    }}>
                      <Ionicons name="book-outline" size={26} color={isDark ? '#818cf8' : '#4f46e5'} />
                    </View>
                    <Text style={{ ...Typography.subtitle, fontSize: 16, color: theme.text, textAlign: 'center', marginBottom: 4 }}>
                      No Subjects Added Yet
                    </Text>
                    <Text style={{ ...Typography.body, fontSize: 13, color: theme.textSecondary, textAlign: 'center', marginBottom: 18, lineHeight: 18 }}>
                      Add your subjects to start tracking your grades, weights, and GWAs!
                    </Text>
                    <TouchableOpacity 
                      onPress={handleAddSubject}
                      activeOpacity={0.8}
                      style={{
                        paddingHorizontal: 18, paddingVertical: 10, borderRadius: Radius.full,
                        flexDirection: 'row', alignItems: 'center',
                        backgroundColor: theme.primary,
                        ...Shadows.sm,
                      }}
                    >
                      <Ionicons name="add-circle" size={16} color="white" />
                      <Text style={{ ...Typography.bodyBold, color: 'white', marginLeft: 6, fontSize: 13 }}>
                        Add First Subject
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : activeTab === 'tracked' && trackedSubjects.length === 0 ? (
                  /* Empty State C: No tracked subjects when activeTab === 'tracked' */
                  <View 
                    style={{
                      borderRadius: Radius['2xl'],
                      padding: 24,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 8,
                      marginBottom: 16,
                      borderWidth: 1,
                      borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                      backgroundColor: isDark ? theme.card : theme.surface,
                      ...Shadows.md,
                    }}
                  >
                    <View style={{
                      width: 52, height: 52, borderRadius: Radius.full,
                      alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                      backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#fef3c7',
                    }}>
                      <Ionicons name="eye-off-outline" size={26} color={isDark ? '#fbbf24' : '#d97706'} />
                    </View>
                    <Text style={{ ...Typography.subtitle, fontSize: 16, color: theme.text, textAlign: 'center', marginBottom: 4 }}>
                      No Tracked Subjects
                    </Text>
                    <Text style={{ ...Typography.body, fontSize: 13, color: theme.textSecondary, textAlign: 'center', marginBottom: 18, lineHeight: 18 }}>
                      All subjects in this term are currently paused from GWA calculation.
                    </Text>
                    <TouchableOpacity 
                      onPress={() => setActiveTab('all')}
                      activeOpacity={0.8}
                      style={{
                        paddingHorizontal: 18, paddingVertical: 10, borderRadius: Radius.full,
                        flexDirection: 'row', alignItems: 'center',
                        backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
                        borderWidth: 1, borderColor: isDark ? theme.cardBorder : '#cbd5e1',
                      }}
                    >
                      <Ionicons name="layers-outline" size={16} color={isDark ? '#cbd5e1' : '#475569'} />
                      <Text style={{ ...Typography.bodyBold, color: isDark ? '#cbd5e1' : '#475569', marginLeft: 6, fontSize: 13 }}>
                        Show All Subjects
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* Subject List Cards */
                  sortedSubjects.map((sub: any) => (
                    <SubjectCard 
                      key={sub.id} 
                      subject={sub} 
                      system={system} 
                      isSelectionMode={isEditing}
                      isEditMode={isEditing}
                      isSelected={selectedSubjects.has(sub.id)}
                      onSelect={() => {
                        const newSet = new Set(selectedSubjects);
                        if (newSet.has(sub.id)) newSet.delete(sub.id);
                        else newSet.add(sub.id);
                        setSelectedSubjects(newSet);
                      }}
                      onToggleSelect={() => {
                        const newSet = new Set(selectedSubjects);
                        if (newSet.has(sub.id)) newSet.delete(sub.id);
                        else newSet.add(sub.id);
                        setSelectedSubjects(newSet);
                      }}
                      onClick={() => setActiveSubId(sub.id)}
                      onToggleTracking={() => handleToggleTracking(sub.id)}
                      onDelete={() => handleDeleteSubject(sub)}
                      onDuplicate={() => handleDuplicateSubject(sub)}
                    />
                  ))
                )}

                {/* Dashed Add Subject Card Button (shown below list when subjects exist) */}
                {allSubjects.length > 0 && !isEditing && (
                  <TouchableOpacity 
                    onPress={handleAddSubject}
                    activeOpacity={0.7}
                    style={{
                      borderRadius: Radius['2xl'],
                      borderWidth: 2,
                      borderStyle: 'dashed',
                      borderColor: isDark ? 'rgba(99,102,241,0.4)' : '#a5b4fc',
                      backgroundColor: isDark ? 'rgba(30,41,59,0.5)' : '#eff6ff',
                      paddingVertical: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 4,
                      marginBottom: 16,
                    }}
                  >
                    <View style={{
                      width: 40, height: 40, borderRadius: Radius.full,
                      backgroundColor: theme.primary,
                      alignItems: 'center', justifyContent: 'center',
                      marginBottom: 8,
                      ...Shadows.sm,
                    }}>
                      <Ionicons name="add" size={22} color="white" />
                    </View>
                    <Text style={{ ...Typography.bodyBold, color: isDark ? '#818cf8' : '#3b82f6', fontSize: 15 }}>
                      Add New Subject
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}
        </View>
      </ScrollView>

      {/* Add Subject Modal */}
      <Modal 
        visible={showAddSubjectModal} 
        transparent 
        animationType="slide" 
        onRequestClose={() => setShowAddSubjectModal(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <Pressable className="flex-1" onPress={() => setShowAddSubjectModal(false)} />
          <View 
            style={{
              borderTopLeftRadius: Radius['4xl'],
              borderTopRightRadius: Radius['4xl'],
              backgroundColor: isDark ? theme.surface : '#ffffff',
            }}
            className="px-6 pt-4 pb-12"
          >
            <View className="items-center mb-5">
              <View className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
            </View>
            <View className="flex-row justify-between items-center mb-6">
              <Text style={{ ...Typography.title, color: theme.text }}>New Subject</Text>
              <TouchableOpacity 
                onPress={() => setShowAddSubjectModal(false)} 
                activeOpacity={0.7}
                className={`w-8 h-8 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
              >
                <Ionicons name="close" size={18} color={isDark ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>

            <Text style={{ ...Typography.captionBold, color: theme.textSecondary, marginBottom: 8 }}>
              Subject Name *
            </Text>
            <TextInput
              style={{
                borderRadius: Radius.xl,
                borderWidth: 1,
                borderColor: isDark ? theme.cardBorder : '#cbd5e1',
                backgroundColor: isDark ? theme.inputBg : '#f8fafc',
                color: theme.text,
                padding: 14,
                fontFamily: 'Nunito_600SemiBold',
                fontSize: 15,
                marginBottom: 8,
              }}
              placeholder="e.g. MATH101, Physics, English Lit"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              value={newSubjectName}
              onChangeText={t => { setNewSubjectName(t); setAddSubjectError(''); }}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleConfirmAddSubject}
            />
            {addSubjectError ? (
              <Text style={{ ...Typography.captionBold, color: theme.error, marginBottom: 16 }}>
                {addSubjectError}
              </Text>
            ) : (
              <Text style={{ ...Typography.caption, color: theme.textTertiary, marginBottom: 16 }}>
                If this subject already exists, you'll be notified.
              </Text>
            )}

            <TouchableOpacity
              onPress={handleConfirmAddSubject}
              activeOpacity={0.8}
              style={{
                borderRadius: Radius.xl,
                backgroundColor: theme.primary,
                paddingVertical: 14,
                alignItems: 'center',
                ...Shadows.md,
              }}
            >
              <Text style={{ ...Typography.bodyBold, color: 'white', fontSize: 16 }}>
                Add Subject
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* System Settings Grading System Modal */}
      <Modal 
        visible={showSettings} 
        animationType="slide" 
        presentationStyle="pageSheet" 
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={{ flex: 1, paddingTop: 24, paddingHorizontal: 24, backgroundColor: theme.background }}>
          <View className="flex-row justify-between items-center mb-8">
            <Text style={{ ...Typography.heading, color: theme.text, fontSize: 24 }}>Settings</Text>
            <TouchableOpacity 
              onPress={() => setShowSettings(false)} 
              activeOpacity={0.7}
              style={{ borderRadius: Radius.full, padding: 8, backgroundColor: isDark ? theme.surfaceSecondary : '#e2e8f0' }}
            >
              <Ionicons name="close" size={20} color={isDark ? "#cbd5e1" : "#475569"} />
            </TouchableOpacity>
          </View>

          <View 
            style={{ 
              borderRadius: Radius['3xl'], padding: 20, marginBottom: 24, 
              backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.cardBorder,
              ...Shadows.sm,
            }}
          >
            <Text style={{ ...Typography.label, color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 16 }}>
              Grading System
            </Text>
            {['1_IS_BEST', '5_IS_BEST', '4_IS_BEST', 'PERCENT'].map((sys) => (
              <TouchableOpacity 
                key={sys}
                activeOpacity={0.7}
                onPress={() => {
                  const nd = JSON.parse(JSON.stringify(data));
                  if (!nd.settings) nd.settings = {};
                  nd.settings.gradingSystem = sys;
                  saveData(nd);
                }}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: isDark ? theme.cardBorder : '#f1f5f9',
                }}
              >
                <Text style={{ ...Typography.bodyBold, color: theme.text, fontSize: 15 }}>
                  {sys === '1_IS_BEST' ? '1.0 is Best (e.g. UP)' : 
                   sys === '5_IS_BEST' ? '5.0 is Best (e.g. PUP)' : 
                   sys === '4_IS_BEST' ? '4.0 is Best (e.g. DLSU)' : 
                   'Percentage (0-100%)'}
                </Text>
                {system === sys && <Ionicons name="checkmark-circle" size={24} color={theme.primary} />}
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
                  { 
                    text: "Reset", 
                    style: "destructive", 
                    onPress: () => {
                      saveData(INITIAL_DATA);
                      setShowSettings(false);
                    }
                  }
                ]
              );
            }}
            activeOpacity={0.8}
            style={{
              borderRadius: Radius['2xl'], padding: 16, alignItems: 'center',
              backgroundColor: isDark ? 'rgba(153,27,27,0.3)' : '#fee2e2',
              borderWidth: 1, borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#fca5a5',
            }}
          >
            <Text style={{ ...Typography.bodyBold, color: theme.error, fontSize: 15 }}>
              Erase All Data
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Premium Paywall Modal */}
      <PremiumPaywallModal 
        visible={showPaywall} 
        onClose={() => setShowPaywall(false)} 
        entryPoint="grades" 
      />
    </SafeAreaView>
  );
}
