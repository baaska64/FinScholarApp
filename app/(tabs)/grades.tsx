import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Modal, TextInput, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabaseClient';
import { SyncService } from '@/services/SyncService';
import { Calculator } from '@/utils/calculator';
import { useColorScheme } from 'nativewind';
import { useFocusEffect, router } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';

import GwaHero from '@/components/ledger/GwaHero';
import BandSurface from '@/components/dashboard/BandSurface';
import Tabs from '@/components/ledger/Tabs';
import SubjectCard from '@/components/ledger/SubjectCard';
import ActiveSubjectView from '@/components/ledger/ActiveSubjectView';
import { AlertService } from '@/components/CustomAlert';
import { useSemesterContext } from '@/components/SemesterContext';
import { getTheme, getTints, getBrand, Typography, Radius } from '@/constants/Theme';
import Card from '@/components/ui/Card';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import { ListSkeleton } from '@/components/ui/LoadingSkeleton';
import PremiumPaywallModal from '@/components/PremiumPaywallModal';
import {
  ensureSubjectExists,
  toggleGradeTracking,
  getUnscheduledSubjects,
  getTrackedSubjects,
} from '@/utils/subjectRegistry';
import SpotlightTarget from '@/components/spotlight/SpotlightTarget';
import { useScreenTour } from '@/components/spotlight/useScreenTour';
import { SPOTLIGHT_IDS, TOUR_KEYS, GRADES_TOUR } from '@/constants/tours';
import { useTabBarHeight } from '@/components/CustomTabBar';

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

const GRADING_SYSTEMS: { key: string; label: string; hint: string }[] = [
  { key: '1_IS_BEST', label: '1.0 is Best', hint: 'Philippine standard — 1.00 highest, 5.00 lowest' },
  { key: '5_IS_BEST', label: '5.0 is Best', hint: '5.00 highest, 1.00 lowest' },
  { key: '4_IS_BEST', label: '4.0 is Best', hint: 'US-style GPA — 4.00 highest' },
  { key: 'PERCENT', label: 'Percentage', hint: 'Raw 0–100% with no conversion' },
];

const GUTTER = 14;
/**
 * Rise of the band's slanted lower edge. Each tab's band ends in its own
 * shape — dome on the dashboard, flat under a sheet on study, a slant here.
 */
const BAND_SLANT = 22;

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
  const tints = getTints(isDark);
  const brand = getBrand(isDark);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();

  // The band runs under the status bar, so its icons go light while this tab
  // is focused — the subject screen has a band too, so this holds for both.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light', true);
      return () => setStatusBarStyle(isDark ? 'light' : 'dark', true);
    }, [isDark])
  );

  // ── Add Subject modal state
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [addSubjectError, setAddSubjectError] = useState('');

  // ── Per-subject action sheet. One modal for the whole list rather than three
  //    buttons parked on every card.
  const [menuSubjectId, setMenuSubjectId] = useState<string | null>(null);

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

  // First visit only: point at whichever "add subject" control is on screen.
  useScreenTour(TOUR_KEYS.grades, GRADES_TOUR, data !== null);

  if (!data) return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ height: insets.top + 150, backgroundColor: brand.heroFrom }} />
      <ListSkeleton count={3} cardHeight={84} />
    </SafeAreaView>
  );

  const currentYear = data.years?.find((y: any) => y.id === activeYearId);
  const currentSem = currentYear?.semesters?.find((s: any) => s.id === activeSemId);
  const system = data.settings?.gradingSystem || '1_IS_BEST';
  const systemLabel = GRADING_SYSTEMS.find(s => s.key === system)?.label || '1.0 is Best';

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
  const pausedCount = allSubjects.length - trackedSubjects.length;
  const displayedSubjects = activeTab === 'tracked' ? trackedSubjects : allSubjects;

  const unitsCounted = trackedSubjects.reduce((n: number, s: any) => n + (Number(s.units) || 0), 0);
  const yearTerms = currentYear?.semesters?.length || 0;
  const allTerms = (data.years || []).reduce((n: number, y: any) => n + (y.semesters?.length || 0), 0);

  const sortedSubjects = [...displayedSubjects].sort((a: any, b: any) => {
    const aTracked = a.gradeTrackingEnabled !== false;
    const bTracked = b.gradeTrackingEnabled !== false;
    if (aTracked === bTracked) return 0;
    return aTracked ? -1 : 1;
  });

  const activeSubject = activeSubId ? currentSem?.subjects?.find((s: any) => s.id === activeSubId) : null;
  const menuSubject = menuSubjectId ? allSubjects.find((s: any) => s.id === menuSubjectId) : null;

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

  const microLabel = {
    fontFamily: 'Nunito_800ExtraBold' as const,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: theme.textTertiary,
  };

  /* ══════════════════════════════════════════════════════════════════════════
     Subject detail replaces the whole screen rather than rendering inside the
     list's ScrollView. It used to be nested inside one, so the detail view's
     own scroll fought the page's — and its Back button scrolled away with the
     content.
     ══════════════════════════════════════════════════════════════════════════ */
  if (activeSubject && currentSem) {
    return (
      <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
        <ActiveSubjectView
          subject={activeSubject}
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
      {/* ══ App bar, on the band ══════════════════════════════════════════
             Same brand field as the dashboard and study tabs, same pinned
             anatomy (title, term switcher as the subtitle, one gear), so the
             tabs read as one app. What differs is below it. ═══════════════ */}
      <View style={{ backgroundColor: brand.heroFrom, paddingTop: insets.top, zIndex: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 8, gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" numberOfLines={1} style={{ fontFamily: 'Nunito_900Black', fontSize: 20, color: brand.onHero, letterSpacing: -0.4 }}>
              Grades
            </Text>
            <Tabs
              years={data.years}
              activeYearId={activeYearId}
              activeSemId={activeSemId}
              onSelectYear={() => { setActiveSubId(null); setIsEditing(false); setSelectedSubjects(new Set()); }}
              onSelectSem={() => { setActiveSubId(null); setIsEditing(false); setSelectedSubjects(new Set()); }}
              renderTrigger={(open, label) => (
                <TouchableOpacity
                  onPress={open}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Active term: ${label}. Tap to switch term.`}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 10 }}
                  style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingVertical: 2, paddingRight: 4 }}
                >
                  <Text numberOfLines={1} style={{ maxWidth: 190, fontFamily: 'Nunito_700Bold', fontSize: 12, color: brand.onHeroMuted }}>
                    {label}
                  </Text>
                  <Ionicons name="chevron-down" size={12} color={brand.onHeroMuted} style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              )}
            />
          </View>

          {isPremium ? (
            <View style={{ paddingHorizontal: 8, height: 24, borderRadius: 999, justifyContent: 'center', backgroundColor: brand.well, borderWidth: 1, borderColor: brand.wellLine }}>
              <Text style={{ fontSize: 9.5, fontFamily: 'Nunito_800ExtraBold', color: brand.onHero, letterSpacing: 0.4 }}>PRO</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setShowPaywall(true)}
              accessibilityRole="button"
              accessibilityLabel="Upgrade to FinScholar Pro"
              style={{ backgroundColor: '#ffffff', paddingHorizontal: 10, height: 27, borderRadius: Radius.full, flexDirection: 'row', alignItems: 'center', gap: 3.5 }}
            >
              <Ionicons name="diamond" size={9} color={brand.heroTo} />
              <Text style={{ fontSize: 9.5, fontFamily: 'Nunito_800ExtraBold', color: brand.heroTo }}>GET PRO</Text>
            </TouchableOpacity>
          )}

          <View
            accessible
            accessibilityLabel={syncStatus === 'syncing' ? 'Syncing' : syncStatus === 'saved' ? 'Synced' : 'Offline'}
            style={{ width: 22, alignItems: 'center' }}
          >
            {syncStatus === 'syncing' && <Ionicons name="cloud-upload" size={18} color={brand.onHeroMuted} />}
            {syncStatus === 'saved' && <Ionicons name="cloud-done" size={18} color={brand.onHero} />}
            {(syncStatus === 'offline' || syncStatus === 'error') && <Ionicons name="cloud-offline" size={18} color={brand.onHeroMuted} />}
          </View>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={{
              width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
              backgroundColor: brand.well, borderWidth: 1, borderColor: brand.wellLine,
            }}
          >
            <Ionicons name="settings-outline" size={18} color={brand.onHero} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ══ Standing, in the band ══════════════════════════════════════ */}
        <BandSurface isDark={isDark} motif="bars" slant={BAND_SLANT} style={{ paddingBottom: BAND_SLANT + 18 }}>
          <View style={{ width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: GUTTER + 4, paddingTop: 6 }}>
            {currentSem ? (
              <GwaHero
                isDark={isDark}
                system={system}
                systemLabel={systemLabel}
                sem={{
                  value: system === 'PERCENT' ? semPercent : semEq,
                  percent: semPercent,
                  hasData: Boolean(semEq || semPercent),
                  caption: `${trackedSubjects.length} of ${allSubjects.length} subject${allSubjects.length !== 1 ? 's' : ''} counted · ${unitsCounted} unit${unitsCounted !== 1 ? 's' : ''}`,
                }}
                year={{
                  value: system === 'PERCENT' ? yearPercent : yearEq,
                  percent: yearPercent,
                  hasData: Boolean(yearEq || yearPercent),
                  caption: `${currentYear?.name || 'This year'} · ${yearTerms} term${yearTerms !== 1 ? 's' : ''}`,
                }}
                cum={{
                  value: system === 'PERCENT' ? cumPercent : cumEq,
                  percent: cumPercent,
                  hasData: Boolean(cumEq || cumPercent),
                  caption: `Every term so far · ${allTerms} term${allTerms !== 1 ? 's' : ''}`,
                }}
                onOpenSettings={() => setShowSettings(true)}
              />
            ) : (
              <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, lineHeight: 20, color: brand.onHeroMuted, maxWidth: 300 }}>
                Every score you log rolls up into your subject grades, your semester GWA and your standing overall.
              </Text>
            )}
          </View>
        </BandSurface>

        <View style={{ width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: GUTTER, paddingTop: 10 }}>

          {!currentSem ? (
            /* ══ No term, or none picked ═════════════════════════════════ */
            data?.years?.length === 0 ? (
              <EmptyPanel
                theme={theme} tint={tints.schedule} icon="folder-open-outline"
                title="No academic terms yet"
                body="Your subjects, grades and classes all live inside a term. Create your first one to start tracking."
                actionLabel="Set up academic term"
                actionIcon="add-circle-outline"
                onAction={() => router.push('/academic-manager')}
              />
            ) : (
              <EmptyPanel
                theme={theme} tint={tints.schedule} icon="calendar-outline"
                title="No semester selected"
                body="Pick a term from the switcher at the top to manage its subjects and grades."
              />
            )
          ) : (
            <>
              {/* ══ Subjects missing class times — a quiet strip, not a card ══ */}
              {unscheduledSubjects.length > 0 && (
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/schedule')}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`${unscheduledSubjects.length} subjects have no class times. Opens the schedule.`}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    padding: 12, borderRadius: Radius.lg, marginBottom: 16,
                    backgroundColor: tints.tasks.fill,
                    borderWidth: 1, borderColor: tints.tasks.line,
                  }}
                >
                  <View style={{
                    width: 34, height: 34, borderRadius: 11, marginRight: 11,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)',
                  }}>
                    <Ionicons name="time-outline" size={17} color={tints.tasks.ink} />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: theme.text }}>
                      {unscheduledSubjects.length} subject{unscheduledSubjects.length > 1 ? 's' : ''} without class times
                    </Text>
                    <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textSecondary, marginTop: 1 }}>
                      {unscheduledSubjects.map((s: any) => s.name).join(', ')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={tints.tasks.ink} />
                </TouchableOpacity>
              )}

              {/* ══ Section heading + the one primary action ════════════════ */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: tints.grades.solid, marginRight: 9 }} />
                <Text
                  accessibilityRole="header"
                  style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: theme.text, letterSpacing: -0.2 }}
                >
                  Subjects
                </Text>
                <View style={{
                  marginLeft: 8, minWidth: 22, paddingHorizontal: 7, paddingVertical: 2,
                  borderRadius: Radius.full, alignItems: 'center', backgroundColor: theme.surfaceSecondary,
                }}>
                  <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textSecondary }}>
                    {displayedSubjects.length}
                  </Text>
                </View>

                <View style={{ flex: 1 }} />

                <SpotlightTarget id={SPOTLIGHT_IDS.gradesAddSubject}>
                  <AnimatedPressable
                    onPress={handleAddSubject}
                    accessibilityRole="button"
                    accessibilityLabel="Add subject"
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                      paddingHorizontal: 12, height: 32, borderRadius: Radius.full,
                      backgroundColor: theme.primary,
                      borderBottomWidth: 2, borderBottomColor: isDark ? '#4338ca' : '#3730a3',
                    }}
                  >
                    <Ionicons name="add" size={16} color="#ffffff" />
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: '#ffffff' }}>Add</Text>
                  </AnimatedPressable>
                </SpotlightTarget>
              </View>

              {/* ══ Filter + selection, sitting with the list they act on ═══ */}
              {allSubjects.length > 0 && (
                isEditing ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <TouchableOpacity
                      onPress={handleToggleSelectAll}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        paddingHorizontal: 12, height: 32, borderRadius: Radius.full,
                        backgroundColor: theme.surface,
                        borderWidth: 1, borderColor: theme.cardBorder,
                        borderBottomWidth: 2, borderBottomColor: theme.lip,
                      }}
                    >
                      <Ionicons
                        name={selectedSubjects.size === sortedSubjects.length && sortedSubjects.length > 0 ? 'checkbox' : 'square-outline'}
                        size={14}
                        color={theme.textSecondary}
                      />
                      <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textSecondary }}>
                        {selectedSubjects.size === sortedSubjects.length && sortedSubjects.length > 0 ? 'None' : 'All'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleDeleteSelected}
                      disabled={selectedSubjects.size === 0}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${selectedSubjects.size} selected subjects`}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        paddingHorizontal: 12, height: 32, borderRadius: Radius.full,
                        backgroundColor: selectedSubjects.size > 0 ? tints.danger.fill : theme.surfaceSecondary,
                        borderWidth: 1,
                        borderColor: selectedSubjects.size > 0 ? tints.danger.line : theme.cardBorder,
                        opacity: selectedSubjects.size > 0 ? 1 : 0.55,
                      }}
                    >
                      <Ionicons name="trash-outline" size={14} color={selectedSubjects.size > 0 ? tints.danger.ink : theme.textTertiary} />
                      <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: selectedSubjects.size > 0 ? tints.danger.ink : theme.textTertiary }}>
                        Delete{selectedSubjects.size > 0 ? ` (${selectedSubjects.size})` : ''}
                      </Text>
                    </TouchableOpacity>

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity
                      onPress={() => { setIsEditing(false); setSelectedSubjects(new Set()); }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      style={{ paddingHorizontal: 14, height: 32, borderRadius: Radius.full, justifyContent: 'center', backgroundColor: theme.primary }}
                    >
                      <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: '#ffffff' }}>Done</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Card variant="sunken" padding={3} radius={Radius.full} style={{ flexDirection: 'row' }}>
                      {([
                        { key: 'all', label: 'All', count: allSubjects.length },
                        { key: 'tracked', label: 'Counted', count: trackedSubjects.length },
                      ] as const).map(opt => {
                        const active = activeTab === opt.key;
                        return (
                          <TouchableOpacity
                            key={opt.key}
                            onPress={() => setActiveTab(opt.key)}
                            activeOpacity={0.75}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={opt.key === 'tracked'
                              ? `Counted towards GWA, ${opt.count} subjects`
                              : `All subjects, ${opt.count}`}
                            style={{
                              flexDirection: 'row', alignItems: 'center', gap: 5,
                              paddingHorizontal: 13, height: 28, borderRadius: Radius.full,
                              backgroundColor: active ? theme.surface : 'transparent',
                              borderWidth: active ? 1 : 0,
                              borderColor: theme.cardBorder,
                            }}
                          >
                            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: active ? theme.text : theme.textTertiary }}>
                              {opt.label}
                            </Text>
                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: active ? theme.textSecondary : theme.textTertiary }}>
                              {opt.count}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </Card>

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity
                      onPress={() => setIsEditing(true)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Select subjects to delete"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 }}
                    >
                      <Ionicons name="checkbox-outline" size={15} color={theme.textSecondary} />
                      <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.textSecondary }}>Select</Text>
                    </TouchableOpacity>
                  </View>
                )
              )}

              {/* ══ The list ═══════════════════════════════════════════════ */}
              {allSubjects.length === 0 ? (
                <EmptyPanel
                  theme={theme} tint={tints.grades} icon="book-outline"
                  title="No subjects yet"
                  body="Add each subject with its units and passing mark, then log scores as they come in. Your GWA updates as you go."
                  actionLabel="Add your first subject"
                  actionIcon="add-circle"
                  onAction={handleAddSubject}
                />
              ) : activeTab === 'tracked' && trackedSubjects.length === 0 ? (
                <EmptyPanel
                  theme={theme} tint={tints.tasks} icon="pause-circle-outline"
                  title="Nothing counted right now"
                  body={`All ${allSubjects.length} subject${allSubjects.length > 1 ? 's' : ''} in this term are paused, so none are included in your GWA.`}
                  actionLabel="Show all subjects"
                  actionIcon="layers-outline"
                  onAction={() => setActiveTab('all')}
                  subdued
                />
              ) : (
                <>
                  {sortedSubjects.map((sub: any) => (
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
                      onOpenMenu={() => setMenuSubjectId(sub.id)}
                    />
                  ))}

                  {/* A slim end-of-list add row rather than a second big card */}
                  {!isEditing && (
                    <TouchableOpacity
                      onPress={handleAddSubject}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Add another subject"
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                        gap: 6, height: 44, borderRadius: Radius.lg, marginTop: 2,
                        borderWidth: 1, borderStyle: 'dashed',
                        borderColor: isDark ? '#3d4468' : '#cbd5e1',
                      }}
                    >
                      <Ionicons name="add" size={16} color={theme.textSecondary} />
                      <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: theme.textSecondary }}>
                        Add subject
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Explains why a paused subject is greyed out, only when one is */}
                  {activeTab === 'all' && pausedCount > 0 && (
                    <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary, textAlign: 'center', marginTop: 12, lineHeight: 16 }}>
                      {pausedCount} paused subject{pausedCount > 1 ? 's are' : ' is'} excluded from your GWA.
                      {'\n'}Resume from the ··· menu on the card.
                    </Text>
                  )}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* ══ Subject actions ═══════════════════════════════════════════════ */}
      <Modal
        visible={Boolean(menuSubject)}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuSubjectId(null)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.overlay }}>
          <Pressable style={{ flex: 1 }} onPress={() => setMenuSubjectId(null)} />
          <View
            style={{
              borderTopLeftRadius: Radius['4xl'], borderTopRightRadius: Radius['4xl'],
              backgroundColor: theme.surface,
              paddingTop: 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 20,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: theme.cardBorder }} />
            </View>

            <Text numberOfLines={1} style={{ fontFamily: 'Nunito_900Black', fontSize: 19, color: theme.text, marginBottom: 2 }}>
              {menuSubject?.name}
            </Text>
            <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: theme.textTertiary, marginBottom: 14 }}>
              {menuSubject?.gradeTrackingEnabled === false ? 'Paused · not counted in your GWA' : 'Counted in your GWA'}
            </Text>

            {[
              {
                key: 'open',
                icon: 'create-outline' as const,
                label: 'Open subject',
                hint: 'Edit periods, weights and scores',
                tint: tints.grades,
                onPress: () => setActiveSubId(menuSubject.id),
              },
              {
                key: 'track',
                icon: (menuSubject?.gradeTrackingEnabled === false ? 'play-circle-outline' : 'pause-circle-outline') as keyof typeof Ionicons.glyphMap,
                label: menuSubject?.gradeTrackingEnabled === false ? 'Resume grade tracking' : 'Pause grade tracking',
                hint: menuSubject?.gradeTrackingEnabled === false
                  ? 'Include this subject in GWA again'
                  : 'Keep the scores, leave it out of your GWA',
                tint: tints.tasks,
                onPress: () => handleToggleTracking(menuSubject.id),
              },
              {
                key: 'duplicate',
                icon: 'copy-outline' as const,
                label: 'Duplicate',
                hint: 'Copy the whole grading setup to a new subject',
                tint: tints.tools,
                onPress: () => handleDuplicateSubject(menuSubject),
              },
              {
                key: 'delete',
                icon: 'trash-outline' as const,
                label: 'Delete subject',
                hint: 'Removes the subject and all its scores',
                tint: tints.danger,
                onPress: () => handleDeleteSubject(menuSubject),
              },
            ].map(action => (
              <TouchableOpacity
                key={action.key}
                onPress={() => {
                  const run = action.onPress;
                  setMenuSubjectId(null);
                  // Let the sheet dismiss before an alert or a screen change lands.
                  setTimeout(run, 220);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${action.label}. ${action.hint}`}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11 }}
              >
                <View style={{
                  width: 38, height: 38, borderRadius: 12, marginRight: 12,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: action.tint.fill,
                  borderWidth: 1, borderColor: action.tint.line,
                }}>
                  <Ionicons name={action.icon} size={18} color={action.tint.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14.5, color: action.key === 'delete' ? action.tint.ink : theme.text }}>
                    {action.label}
                  </Text>
                  <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary, marginTop: 1 }}>
                    {action.hint}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ══ Add Subject ═══════════════════════════════════════════════════ */}
      <Modal
        visible={showAddSubjectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddSubjectModal(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.overlay }}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowAddSubjectModal(false)} />
          <View
            style={{
              borderTopLeftRadius: Radius['4xl'],
              borderTopRightRadius: Radius['4xl'],
              backgroundColor: theme.surface,
              paddingTop: 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 28,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: theme.cardBorder }} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ ...Typography.title, color: theme.text }}>New subject</Text>
                <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: theme.textTertiary, marginTop: 2 }}>
                  Units, passing mark and scores come next.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAddSubjectModal(false)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={{ width: 32, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceSecondary }}
              >
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ ...microLabel, marginBottom: 8 }}>Subject name</Text>
            <TextInput
              style={{
                borderRadius: Radius.lg,
                borderWidth: 1,
                borderColor: theme.inputBorder,
                backgroundColor: theme.inputBg,
                color: theme.text,
                padding: 14,
                fontFamily: 'Nunito_600SemiBold',
                fontSize: 15,
                marginBottom: 8,
              }}
              placeholder="e.g. MATH101, Physics, English Lit"
              placeholderTextColor={theme.textTertiary}
              value={newSubjectName}
              onChangeText={t => { setNewSubjectName(t); setAddSubjectError(''); }}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleConfirmAddSubject}
            />
            {addSubjectError ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="alert-circle" size={14} color={theme.error} style={{ marginRight: 5 }} />
                <Text style={{ ...Typography.captionBold, color: theme.error, flex: 1 }}>
                  {addSubjectError}
                </Text>
              </View>
            ) : (
              <Text style={{ ...Typography.caption, color: theme.textTertiary, marginBottom: 16 }}>
                Use the same name as your schedule so the two stay linked.
              </Text>
            )}

            <AnimatedPressable
              onPress={handleConfirmAddSubject}
              accessibilityRole="button"
              accessibilityLabel="Add subject"
              style={{
                borderRadius: Radius.lg,
                backgroundColor: theme.primary,
                paddingVertical: 14,
                alignItems: 'center',
                borderBottomWidth: 3, borderBottomColor: isDark ? '#4338ca' : '#3730a3',
              }}
            >
              <Text style={{ ...Typography.bodyBold, color: 'white', fontSize: 16 }}>
                Add subject
              </Text>
            </AnimatedPressable>
          </View>
        </View>
      </Modal>

      {/* ══ Ledger settings ═══════════════════════════════════════════════ */}
      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={{ flex: 1, paddingTop: 24, paddingHorizontal: GUTTER + 6, backgroundColor: theme.background }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ ...Typography.heading, color: theme.text, fontSize: 24 }}>Ledger settings</Text>
              <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: theme.textTertiary, marginTop: 2 }}>
                How every grade in the app is shown.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowSettings(false)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={{ width: 34, height: 34, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceSecondary }}
            >
              <Ionicons name="close" size={19} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={{ ...microLabel, marginBottom: 8, paddingLeft: 2 }}>Grading system</Text>
          <Card padding={0} radius={Radius.xl} style={{ overflow: 'hidden', marginBottom: 24 }}>
            {GRADING_SYSTEMS.map((sys, i) => {
              const selected = system === sys.key;
              return (
                <TouchableOpacity
                  key={sys.key}
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${sys.label}. ${sys.hint}`}
                  onPress={() => {
                    const nd = JSON.parse(JSON.stringify(data));
                    if (!nd.settings) nd.settings = {};
                    nd.settings.gradingSystem = sys.key;
                    saveData(nd);
                  }}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingVertical: 13, paddingHorizontal: 14,
                    borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.cardBorder,
                    backgroundColor: selected ? tints.grades.fill : 'transparent',
                  }}
                >
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: theme.text }}>
                      {sys.label}
                    </Text>
                    <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary, marginTop: 1 }}>
                      {sys.hint}
                    </Text>
                  </View>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={21}
                    color={selected ? theme.primary : theme.textTertiary}
                  />
                </TouchableOpacity>
              );
            })}
          </Card>

          <Text style={{ ...microLabel, marginBottom: 8, paddingLeft: 2 }}>Danger zone</Text>
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
            accessibilityRole="button"
            accessibilityLabel="Erase all ledger data"
            style={{
              flexDirection: 'row', alignItems: 'center',
              borderRadius: Radius.xl, padding: 14,
              backgroundColor: tints.danger.fill,
              borderWidth: 1, borderColor: tints.danger.line,
            }}
          >
            <Ionicons name="trash-outline" size={18} color={tints.danger.ink} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14.5, color: tints.danger.ink }}>
                Erase all data
              </Text>
              <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textSecondary, marginTop: 1 }}>
                Deletes every term, subject and score on this device.
              </Text>
            </View>
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

interface EmptyPanelProps {
  theme: any;
  tint: { fill: string; line: string; ink: string; solid: string };
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  actionLabel?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
  /** Renders the action as a quiet button — for "nothing to see" rather than "get started". */
  subdued?: boolean;
}

/**
 * The one empty state on this screen. There used to be three hand-rolled ones
 * with different padding, icon sizes and button weights, so "no terms", "no
 * subjects" and "nothing tracked" each looked like a different product.
 */
function EmptyPanel({ theme, tint, icon, title, body, actionLabel, actionIcon, onAction, subdued }: EmptyPanelProps) {
  return (
    <Card padding={0} radius={Radius['2xl']} style={{ overflow: 'hidden' }}>
      <View style={{
        alignItems: 'center', paddingTop: 24, paddingBottom: 20,
        backgroundColor: tint.fill,
        borderBottomWidth: 1, borderBottomColor: tint.line,
      }}>
        <View style={{
          width: 60, height: 60, borderRadius: 20,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: theme.surface,
          borderWidth: 2, borderColor: tint.line,
        }}>
          <Ionicons name={icon} size={28} color={tint.ink} />
        </View>
      </View>

      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 17, color: theme.text, textAlign: 'center', letterSpacing: -0.3 }}>
          {title}
        </Text>
        <Text style={{
          fontFamily: 'Nunito_400Regular', fontSize: 13, color: theme.textSecondary,
          textAlign: 'center', lineHeight: 19, marginTop: 6,
          marginBottom: actionLabel && onAction ? 18 : 0,
        }}>
          {body}
        </Text>

        {actionLabel && onAction && (
          <AnimatedPressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              paddingVertical: 12, paddingHorizontal: 20, borderRadius: Radius.lg, width: '100%',
              backgroundColor: subdued ? theme.surfaceSecondary : theme.primary,
              borderWidth: subdued ? 1 : 0, borderColor: theme.cardBorder,
              borderBottomWidth: subdued ? 2 : 3,
              borderBottomColor: subdued ? theme.lip : theme.primaryDark,
            }}
          >
            {actionIcon && (
              <Ionicons name={actionIcon} size={16} color={subdued ? theme.textSecondary : '#ffffff'} style={{ marginRight: 7 }} />
            )}
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: subdued ? theme.textSecondary : '#ffffff' }}>
              {actionLabel}
            </Text>
          </AnimatedPressable>
        )}
      </View>
    </Card>
  );
}
