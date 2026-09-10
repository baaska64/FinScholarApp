import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SyncService } from '@/services/SyncService';
import Tabs from '@/components/ledger/Tabs';
import MonthGrid from '@/components/calendar/MonthGrid';
import DayPanel from '@/components/calendar/DayPanel';
import AgendaList, { AgendaEmpty } from '@/components/calendar/AgendaList';
import EventSheet, { type EventDraft } from '@/components/calendar/EventSheet';
import TermSheet from '@/components/calendar/TermSheet';
import CalendarImportModal from '@/components/calendar/CalendarImportModal';
import { getEventLabel, getEventTint } from '@/components/calendar/calendarTheme';
import { AlertService } from '@/components/CustomAlert';
import { useSemesterContext } from '@/components/SemesterContext';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import ProgressBar from '@/components/ui/ProgressBar';
import { ListSkeleton } from '@/components/ui/LoadingSkeleton';
import SpotlightTarget from '@/components/spotlight/SpotlightTarget';
import { useScreenTour } from '@/components/spotlight/useScreenTour';
import { SPOTLIGHT_IDS, TOUR_KEYS, CALENDAR_TOUR } from '@/constants/tours';
import { useTabBarHeight } from '@/components/CustomTabBar';
import {
    EVENT_TYPE_ORDER,
    addMonths,
    collectCalendarItems,
    filterItems,
    getClassesForDate,
    getTermProgress,
    groupByDateKey,
    parseDateKey,
    pastItems,
    toDateKey,
    upcomingItems,
    type CalendarItem,
    type EventTypeKey,
} from '@/utils/calendarModel';

const generateId = () => Math.random().toString(36).substr(2, 9);

/** Page gutter. Matches the schedule tab so the two calendars line up. */
const GUTTER = 14;

type ViewMode = 'month' | 'agenda';
type AgendaRange = 'upcoming' | 'past';

/**
 * The calendar tab.
 *
 * Rebuilt around one idea: **a day is not just its milestones.** The old screen
 * only knew about `sem.milestones`, so tapping October 14 could not tell a
 * student that they had three classes and a lab report due — that lived on two
 * other tabs. It now reads classes and task deadlines out of the same ledger
 * and merges all three into one dated stream (`utils/calendarModel.ts`).
 *
 * Structurally it is a fixed-height column like the schedule tab, not a long
 * scroll: app bar, controls, term strip, then the month grid with the selected
 * day's agenda underneath it. Previously the grid sat below a header, a
 * full-width term selector, an import banner and a term-dates card — roughly
 * 260pt of chrome before the calendar itself.
 */
export default function CalendarScreen() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);
    const tabBarHeight = useTabBarHeight();

    const { selectedYear: activeYearId, selectedSemester: activeSemId, setYearAndSemester } = useSemesterContext();

    const [data, setData] = useState<any>(null);
    const [syncStatus, setSyncStatus] = useState<'syncing' | 'saved' | 'error' | 'offline'>('offline');

    // `today` is state, not a fresh `new Date()` per render: every relative
    // label and the "is this cell today" test has to agree within one paint,
    // and re-deriving it on each render made those disagree across a midnight
    // boundary while the screen was open.
    const [today, setToday] = useState(() => new Date());
    const [monthAnchor, setMonthAnchor] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [selectedKey, setSelectedKey] = useState(() => toDateKey(new Date()));

    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [agendaRange, setAgendaRange] = useState<AgendaRange>('upcoming');

    const [showSearch, setShowSearch] = useState(false);
    const [query, setQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [activeTypes, setActiveTypes] = useState<EventTypeKey[]>([]);
    const [scope, setScope] = useState<'term' | 'all'>('all');
    const [showTasks, setShowTasks] = useState(true);
    const [showClasses, setShowClasses] = useState(true);

    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [showImport, setShowImport] = useState(false);
    const [showTermSheet, setShowTermSheet] = useState(false);
    const [eventSheet, setEventSheet] = useState<{ open: boolean; editing: CalendarItem | null }>({
        open: false,
        editing: null,
    });

    // ── Data ──────────────────────────────────────────────────────────────────

    const loadLocalData = useCallback(async () => {
        let loaded: any = null;
        try {
            const local = await AsyncStorage.getItem('grade_ledger_v2_data');
            if (local) loaded = JSON.parse(local);
        } catch (e) {
            // A corrupt ledger must not blank the tab; fall through to empty.
        }

        if (!loaded || !Array.isArray(loaded.years)) loaded = { settings: {}, years: [] };

        // Backfill ids for milestones imported before they carried one —
        // without an id, edit and delete have nothing to match on.
        loaded.years.forEach((y: any) =>
            (y.semesters || []).forEach((s: any) => {
                if (!s.milestones) s.milestones = [];
                s.milestones.forEach((m: any) => {
                    if (!m.id) m.id = generateId();
                });
            }),
        );

        setData(loaded);
        setToday(new Date());
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadLocalData();
        }, [loadLocalData]),
    );

    useEffect(() => {
        const unsubData = SyncService.subscribeDataChange(() => loadLocalData());
        const unsubState = SyncService.subscribe(state => {
            setSyncStatus(state === 'conflict' ? 'offline' : state);
        });
        return () => {
            unsubData();
            unsubState();
        };
    }, [loadLocalData]);

    const saveAndSync = useCallback(async (newData: any) => {
        setData(newData);
        await SyncService.pushLocalChanges(newData);
    }, []);

    useScreenTour(TOUR_KEYS.calendar, CALENDAR_TOUR, data !== null);

    // ── Derived ───────────────────────────────────────────────────────────────

    const currentYear = useMemo(
        () => data?.years?.find((y: any) => y.id === activeYearId),
        [data, activeYearId],
    );
    const currentSem = useMemo(
        () => currentYear?.semesters?.find((s: any) => s.id === activeSemId),
        [currentYear, activeSemId],
    );

    const allItems = useMemo(
        () => (data ? collectCalendarItems(data, { activeYearId, activeSemId }) : []),
        [data, activeYearId, activeSemId],
    );

    const visibleItems = useMemo(
        () =>
            filterItems(allItems, {
                query,
                types: activeTypes,
                scope,
                kinds: showTasks ? undefined : ['event'],
            }),
        [allItems, query, activeTypes, scope, showTasks],
    );

    const itemsByDate = useMemo(() => groupByDateKey(visibleItems), [visibleItems]);

    const termProgress = useMemo(() => getTermProgress(currentSem, today), [currentSem, today]);

    const selectedItems = itemsByDate[selectedKey] || [];
    const selectedClasses = useMemo(() => {
        const date = parseDateKey(selectedKey);
        if (!showClasses || !date) return [];
        return getClassesForDate(currentSem, date);
    }, [showClasses, currentSem, selectedKey]);

    const agendaItems = useMemo(
        () => (agendaRange === 'upcoming' ? upcomingItems(visibleItems, today) : pastItems(visibleItems, today)),
        [visibleItems, agendaRange, today],
    );

    const termLabel = currentYear && currentSem ? `${currentYear.name} · ${currentSem.name}` : 'this term';
    const filtersActive = activeTypes.length > 0 || scope === 'term' || !showTasks || !showClasses;

    /**
     * Memoised so the sheet's "reset the form when it opens" effect does not
     * see a brand-new object on every unrelated render of this screen — which
     * would wipe whatever the student had typed the moment the sync indicator
     * ticked over.
     */
    const editingDraft = useMemo<EventDraft | null>(
        () =>
            eventSheet.editing
                ? {
                    title: eventSheet.editing.title,
                    dateKey: eventSheet.editing.dateKey,
                    type: eventSheet.editing.type || 'custom',
                    note: eventSheet.editing.note || '',
                }
                : null,
        [eventSheet.editing],
    );

    // ── Mutations ─────────────────────────────────────────────────────────────

    /**
     * Finds the semester an item lives in, which is not necessarily the active
     * one. The old screen could only edit inside the active term, so editing an
     * event that belonged to another semester silently switched the student's
     * whole term selection out from under them first.
     */
    const withSemester = (
        draft: any,
        yearId: string | null | undefined,
        semId: string | null | undefined,
    ) => {
        const yr = draft.years?.find((y: any) => y.id === (yearId || activeYearId));
        return yr?.semesters?.find((s: any) => s.id === (semId || activeSemId));
    };

    const handleSaveEvent = (form: EventDraft) => {
        const editing = eventSheet.editing;
        const nd = JSON.parse(JSON.stringify(data));
        const sem = withSemester(nd, editing?.yearId, editing?.semId);
        if (!sem) {
            AlertService.alert('No term selected', 'Pick a term from the header before adding events.');
            return;
        }
        if (!sem.milestones) sem.milestones = [];

        if (editing) {
            sem.milestones = sem.milestones.map((m: any) =>
                m.id === editing.id
                    ? { ...m, title: form.title, date: form.dateKey, type: form.type, note: form.note }
                    : m,
            );
        } else {
            sem.milestones.push({
                id: generateId(),
                title: form.title,
                date: form.dateKey,
                type: form.type,
                note: form.note,
            });
        }

        saveAndSync(nd);
        setEventSheet({ open: false, editing: null });
        setSelectedKey(form.dateKey);
        const picked = parseDateKey(form.dateKey);
        if (picked) setMonthAnchor(new Date(picked.getFullYear(), picked.getMonth(), 1));
    };

    const deleteEvents = (targets: CalendarItem[]) => {
        const nd = JSON.parse(JSON.stringify(data));
        targets.forEach(target => {
            const sem = withSemester(nd, target.yearId, target.semId);
            if (!sem?.milestones) return;
            sem.milestones = sem.milestones.filter((m: any) => m.id !== target.id);
        });
        saveAndSync(nd);
    };

    const confirmDelete = (targets: CalendarItem[]) => {
        if (targets.length === 0) return;
        const label =
            targets.length === 1 ? `"${targets[0].title}"` : `${targets.length} events`;
        AlertService.alert('Delete event', `Delete ${label}? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    deleteEvents(targets);
                    setSelectedIds(new Set());
                    setSelectMode(false);
                    if (eventSheet.open) setEventSheet({ open: false, editing: null });
                },
            },
        ]);
    };

    const handleSetTermDate = (field: 'startDate' | 'endDate', dateKey: string) => {
        const nd = JSON.parse(JSON.stringify(data));
        const sem = withSemester(nd, activeYearId, activeSemId);
        if (!sem) return;
        sem[field] = dateKey;
        saveAndSync(nd);
    };

    const handleImport = (importedMilestones: any[]) => {
        const nd = JSON.parse(JSON.stringify(data));
        let yr = nd.years.find((y: any) => y.id === activeYearId);

        if (!yr) {
            if (nd.years.length === 0) {
                yr = { id: generateId(), name: 'Year 1', semesters: [] };
                nd.years.push(yr);
            } else {
                yr = nd.years[0];
            }
        }

        importedMilestones.forEach(event => {
            const semIndex = event.target_semester_index || 1;
            while (yr.semesters.length < semIndex) {
                yr.semesters.push({
                    id: generateId(),
                    name: `Semester ${yr.semesters.length + 1}`,
                    subjects: [],
                    milestones: [],
                });
            }
            const targetSem = yr.semesters[semIndex - 1];
            if (!targetSem.milestones) targetSem.milestones = [];
            targetSem.milestones.push({ ...event, id: generateId() });
        });

        saveAndSync(nd);
        if (yr && yr.semesters.length > 0) setYearAndSemester(yr.id, yr.semesters[0].id);
        AlertService.alert('Imported', `${importedMilestones.length} event${importedMilestones.length === 1 ? '' : 's'} added to your calendar.`);
    };

    // ── Navigation helpers ────────────────────────────────────────────────────

    const goToday = () => {
        const now = new Date();
        setToday(now);
        setMonthAnchor(new Date(now.getFullYear(), now.getMonth(), 1));
        setSelectedKey(toDateKey(now));
    };

    const selectDate = (dateKey: string) => {
        setSelectedKey(dateKey);
        const date = parseDateKey(dateKey);
        // Tapping a borrowed day from the next or previous month follows it.
        if (date && (date.getMonth() !== monthAnchor.getMonth() || date.getFullYear() !== monthAnchor.getFullYear())) {
            setMonthAnchor(new Date(date.getFullYear(), date.getMonth(), 1));
        }
    };

    const openTask = (item: CalendarItem) => {
        if (item.yearId && item.semId && !item.isCurrentTerm) setYearAndSemester(item.yearId, item.semId);
        router.push({ pathname: '/(tabs)/requirements', params: item.subjectId ? { subjectId: item.subjectId } : {} });
    };

    const openSchedule = () => router.push('/(tabs)/schedule');

    const toggleType = (type: EventTypeKey) => {
        setActiveTypes(prev => (prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]));
    };

    const toggleSelected = (item: CalendarItem) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(item.id)) next.delete(item.id);
            else next.add(item.id);
            return next;
        });
    };

    // ── Shared styles ─────────────────────────────────────────────────────────

    const iconButton = {
        width: 34,
        height: 34,
        borderRadius: Radius.full,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
    };

    const barStyle = {
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? theme.cardBorder : '#f1f5f9',
    };

    if (!data) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
                <ListSkeleton count={4} cardHeight={70} />
            </SafeAreaView>
        );
    }

    const hasTerms = data.years.length > 0;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
            {/* ── App bar ─────────────────────────────────────────────────── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 8, zIndex: 20, ...barStyle }}>
                <View
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        marginRight: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: tints.schedule.fill,
                        borderWidth: 1,
                        borderColor: tints.schedule.line,
                    }}
                >
                    <Ionicons name="calendar" size={17} color={tints.schedule.ink} />
                </View>

                <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 17, color: theme.text }}>Calendar</Text>
                    <Tabs years={data.years} activeYearId={activeYearId} activeSemId={activeSemId} compact />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {syncStatus === 'syncing' && <Ionicons name="cloud-upload" size={17} color={theme.textTertiary} />}
                    {syncStatus === 'saved' && <Ionicons name="cloud-done" size={17} color={theme.success} />}
                    {syncStatus === 'error' && <Ionicons name="cloud-offline" size={17} color={theme.error} />}
                    {syncStatus === 'offline' && <Ionicons name="cloud-offline" size={17} color={theme.textTertiary} />}

                    <SpotlightTarget id={SPOTLIGHT_IDS.calendarImport}>
                        <TouchableOpacity
                            onPress={() => setShowImport(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Scan an academic calendar image"
                            style={iconButton}
                        >
                            <Ionicons name="sparkles" size={17} color={isDark ? '#cbd5e1' : '#475569'} />
                        </TouchableOpacity>
                    </SpotlightTarget>

                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)/profile')}
                        accessibilityRole="button"
                        accessibilityLabel="Settings"
                        style={iconButton}
                    >
                        <Ionicons name="settings-outline" size={17} color={isDark ? '#cbd5e1' : '#475569'} />
                    </TouchableOpacity>
                </View>
            </View>

            {!hasTerms ? (
                <NoTermsState isDark={isDark} theme={theme} onSetup={() => router.push('/academic-manager')} />
            ) : !activeSemId ? (
                <NoSemesterState theme={theme} />
            ) : (
                <>
                    {/* ── View switch + search/filter ──────────────────────── */}
                    <View style={{ paddingHorizontal: GUTTER, paddingVertical: 7, ...barStyle }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View
                                style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    borderRadius: Radius.full,
                                    padding: 3,
                                    backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
                                    borderWidth: 1,
                                    borderColor: theme.cardBorder,
                                }}
                            >
                                {([
                                    { key: 'month', label: 'Month', icon: 'grid' },
                                    { key: 'agenda', label: 'Agenda', icon: 'list' },
                                ] as const).map(mode => {
                                    const active = viewMode === mode.key;
                                    return (
                                        <TouchableOpacity
                                            key={mode.key}
                                            onPress={() => setViewMode(mode.key)}
                                            accessibilityRole="tab"
                                            accessibilityState={{ selected: active }}
                                            accessibilityLabel={`${mode.label} view`}
                                            style={{
                                                flex: 1,
                                                paddingVertical: 6,
                                                borderRadius: Radius.full,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: active ? theme.primary : 'transparent',
                                            }}
                                        >
                                            <Ionicons name={mode.icon} size={13} color={active ? '#ffffff' : theme.textSecondary} />
                                            <Text
                                                style={{
                                                    marginLeft: 5,
                                                    fontSize: 12,
                                                    fontFamily: 'Nunito_700Bold',
                                                    color: active ? '#ffffff' : theme.textSecondary,
                                                }}
                                            >
                                                {mode.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <TouchableOpacity
                                onPress={() => {
                                    setShowSearch(s => !s);
                                    if (showSearch) setQuery('');
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={showSearch ? 'Close search' : 'Search events'}
                                accessibilityState={{ selected: showSearch }}
                                style={{
                                    ...iconButton,
                                    backgroundColor: showSearch ? theme.primary : iconButton.backgroundColor,
                                }}
                            >
                                <Ionicons name="search" size={16} color={showSearch ? '#ffffff' : theme.textSecondary} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setShowFilters(f => !f)}
                                accessibilityRole="button"
                                accessibilityLabel={showFilters ? 'Hide filters' : 'Show filters'}
                                accessibilityState={{ selected: showFilters }}
                                style={{
                                    ...iconButton,
                                    backgroundColor: showFilters || filtersActive ? theme.primary : iconButton.backgroundColor,
                                }}
                            >
                                <Ionicons
                                    name="options-outline"
                                    size={16}
                                    color={showFilters || filtersActive ? '#ffffff' : theme.textSecondary}
                                />
                            </TouchableOpacity>
                        </View>

                        {showSearch && (
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginTop: 7,
                                    paddingHorizontal: 12,
                                    height: 36,
                                    borderRadius: Radius.full,
                                    backgroundColor: theme.inputBg,
                                    borderWidth: 1,
                                    borderColor: theme.inputBorder,
                                }}
                            >
                                <Ionicons name="search" size={14} color={theme.textTertiary} />
                                <TextInput
                                    autoFocus
                                    value={query}
                                    onChangeText={setQuery}
                                    placeholder="Search events, tasks, subjects…"
                                    placeholderTextColor={theme.textTertiary}
                                    accessibilityLabel="Search the calendar"
                                    style={{
                                        flex: 1,
                                        marginLeft: 8,
                                        fontFamily: 'Nunito_400Regular',
                                        fontSize: 13.5,
                                        color: theme.text,
                                        paddingVertical: 0,
                                    }}
                                />
                                {query.length > 0 && (
                                    <TouchableOpacity
                                        onPress={() => setQuery('')}
                                        accessibilityRole="button"
                                        accessibilityLabel="Clear search"
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name="close-circle" size={15} color={theme.textTertiary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {showFilters && (
                            <View style={{ marginTop: 8 }}>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ gap: 6, paddingRight: 4 }}
                                >
                                    <FilterChip
                                        label={scope === 'term' ? 'This term' : 'All terms'}
                                        icon={scope === 'term' ? 'bookmark' : 'albums-outline'}
                                        active={scope === 'term'}
                                        theme={theme}
                                        onPress={() => setScope(s => (s === 'term' ? 'all' : 'term'))}
                                        accessibilityLabel={
                                            scope === 'term'
                                                ? 'Showing this term only. Tap to show all terms.'
                                                : 'Showing all terms. Tap to show this term only.'
                                        }
                                    />
                                    <FilterChip
                                        label="Deadlines"
                                        icon={showTasks ? 'checkbox' : 'square-outline'}
                                        active={showTasks}
                                        theme={theme}
                                        onPress={() => setShowTasks(v => !v)}
                                        accessibilityLabel={showTasks ? 'Hide task deadlines' : 'Show task deadlines'}
                                    />
                                    <FilterChip
                                        label="Classes"
                                        icon={showClasses ? 'checkbox' : 'square-outline'}
                                        active={showClasses}
                                        theme={theme}
                                        onPress={() => setShowClasses(v => !v)}
                                        accessibilityLabel={showClasses ? 'Hide classes' : 'Show classes'}
                                    />
                                </ScrollView>

                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ gap: 6, paddingRight: 4, marginTop: 6 }}
                                >
                                    {EVENT_TYPE_ORDER.map(type => {
                                        const tint = getEventTint(type, isDark);
                                        const active = activeTypes.includes(type);
                                        return (
                                            <TouchableOpacity
                                                key={type}
                                                onPress={() => toggleType(type)}
                                                accessibilityRole="checkbox"
                                                accessibilityState={{ checked: active }}
                                                accessibilityLabel={`Filter by ${getEventLabel(type)}`}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    paddingHorizontal: 10,
                                                    height: 28,
                                                    borderRadius: Radius.full,
                                                    borderWidth: 1,
                                                    backgroundColor: active ? tint.fill : 'transparent',
                                                    borderColor: active ? tint.solid : theme.cardBorder,
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: 3,
                                                        marginRight: 5,
                                                        backgroundColor: tint.solid,
                                                    }}
                                                />
                                                <Text
                                                    style={{
                                                        fontFamily: 'Nunito_700Bold',
                                                        fontSize: 11.5,
                                                        color: active ? tint.ink : theme.textSecondary,
                                                    }}
                                                >
                                                    {getEventLabel(type)}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        )}
                        {/* Term strip. It lives inside the control bar rather
                            than under it — as its own banded row it made a
                            third stacked bar between the app bar and the
                            calendar, and the screen read as chrome. */}
                        <TouchableOpacity
                            onPress={() => setShowTermSheet(true)}
                            accessibilityRole="button"
                            accessibilityLabel={
                                termProgress.state === 'active'
                                    ? `Term progress: week ${termProgress.weekNumber} of ${termProgress.totalWeeks}, ${termProgress.daysLeft} days left. Tap to edit term dates.`
                                    : 'Set the term dates'
                            }
                            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}
                        >
                            <Ionicons
                                name={termProgress.state === 'unset' ? 'alert-circle-outline' : 'flag-outline'}
                                size={12}
                                color={termProgress.state === 'unset' ? theme.primary : theme.textTertiary}
                                style={{ marginRight: 6 }}
                            />
                            <Text
                                numberOfLines={1}
                                style={{
                                    fontFamily: 'Nunito_700Bold',
                                    fontSize: 11.5,
                                    color: termProgress.state === 'unset' ? theme.primary : theme.textTertiary,
                                }}
                            >
                                {termProgress.state === 'active'
                                    ? `Week ${termProgress.weekNumber} of ${termProgress.totalWeeks} · ${termProgress.daysLeft} ${termProgress.daysLeft === 1 ? 'day' : 'days'} left`
                                    : termProgress.state === 'upcoming'
                                        ? `Term starts in ${termProgress.daysUntilStart} ${termProgress.daysUntilStart === 1 ? 'day' : 'days'}`
                                        : termProgress.state === 'ended'
                                            ? 'This term has ended'
                                            : 'Set your term dates'}
                            </Text>

                            {termProgress.state === 'active' && (
                                <View style={{ flex: 1, marginLeft: 10, marginRight: 6 }}>
                                    <ProgressBar
                                        progress={termProgress.percent}
                                        height={3}
                                        color={tints.schedule.solid}
                                        animate={false}
                                    />
                                </View>
                            )}
                            {termProgress.state !== 'active' && <View style={{ flex: 1 }} />}

                            <Ionicons name="chevron-forward" size={12} color={theme.textTertiary} />
                        </TouchableOpacity>
                    </View>

                    {/* ── Body ─────────────────────────────────────────────── */}
                    {viewMode === 'month' ? (
                        /**
                         * The month view is **one scrolling page**: the grid and
                         * the day's timeline share a single `ScrollView`. It was
                         * previously a fixed column with the grid pinned above a
                         * separately-scrolling panel, which left the day's
                         * content stuck behind the floating tab bar with nowhere
                         * to scroll to. Nothing here may own a nested vertical
                         * scroll.
                         */
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
                        >
                            {/* Month header */}
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: GUTTER,
                                    paddingTop: 12,
                                    paddingBottom: 4,
                                }}
                            >
                                <Text
                                    accessibilityRole="header"
                                    style={{ flex: 1, fontFamily: 'Nunito_900Black', fontSize: 19, color: theme.text, letterSpacing: -0.4 }}
                                >
                                    {monthAnchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </Text>

                                {(monthAnchor.getMonth() !== today.getMonth() ||
                                    monthAnchor.getFullYear() !== today.getFullYear() ||
                                    selectedKey !== toDateKey(today)) && (
                                    <TouchableOpacity
                                        onPress={goToday}
                                        accessibilityRole="button"
                                        accessibilityLabel="Jump to today"
                                        style={{
                                            paddingHorizontal: 11,
                                            height: 28,
                                            justifyContent: 'center',
                                            borderRadius: Radius.full,
                                            borderWidth: 1,
                                            borderColor: theme.cardBorder,
                                            backgroundColor: theme.surface,
                                            marginRight: 6,
                                        }}
                                    >
                                        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 11.5, color: theme.primary }}>
                                            Today
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    onPress={() => setMonthAnchor(m => addMonths(m, -1))}
                                    accessibilityRole="button"
                                    accessibilityLabel="Previous month"
                                    style={{ ...iconButton, width: 28, height: 28 }}
                                >
                                    <Ionicons name="chevron-back" size={15} color={theme.textSecondary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setMonthAnchor(m => addMonths(m, 1))}
                                    accessibilityRole="button"
                                    accessibilityLabel="Next month"
                                    style={{ ...iconButton, width: 28, height: 28, marginLeft: 4 }}
                                >
                                    <Ionicons name="chevron-forward" size={15} color={theme.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <View style={{ paddingHorizontal: GUTTER - 4 }}>
                                <MonthGrid
                                    month={monthAnchor}
                                    today={today}
                                    selectedKey={selectedKey}
                                    itemsByDate={itemsByDate}
                                    termStartKey={termProgress.startKey}
                                    termEndKey={termProgress.endKey}
                                    onSelectDate={selectDate}
                                    onChangeMonth={delta => setMonthAnchor(m => addMonths(m, delta))}
                                />
                            </View>

                            <View
                                style={{
                                    height: 1,
                                    backgroundColor: theme.cardBorder,
                                    marginTop: 10,
                                    marginBottom: 12,
                                }}
                            />

                            <View style={{ paddingHorizontal: GUTTER }}>
                                <DayPanel
                                    dateKey={selectedKey}
                                    today={today}
                                    items={selectedItems}
                                    classes={selectedClasses}
                                    onAddEvent={() => setEventSheet({ open: true, editing: null })}
                                    onEditEvent={item => setEventSheet({ open: true, editing: item })}
                                    onDeleteEvent={item => confirmDelete([item])}
                                    onPressTask={openTask}
                                    onPressClass={openSchedule}
                                />
                            </View>
                        </ScrollView>
                    ) : (
                        <View style={{ flex: 1 }}>
                            {/* Agenda controls */}
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: GUTTER,
                                    paddingTop: 10,
                                    paddingBottom: 6,
                                    gap: 6,
                                }}
                            >
                                {(['upcoming', 'past'] as const).map(range => {
                                    const active = agendaRange === range;
                                    return (
                                        <TouchableOpacity
                                            key={range}
                                            onPress={() => setAgendaRange(range)}
                                            accessibilityRole="tab"
                                            accessibilityState={{ selected: active }}
                                            accessibilityLabel={range === 'upcoming' ? 'Upcoming items' : 'Past items'}
                                            style={{
                                                paddingHorizontal: 12,
                                                height: 28,
                                                justifyContent: 'center',
                                                borderRadius: Radius.full,
                                                borderWidth: 1,
                                                backgroundColor: active ? theme.primary : 'transparent',
                                                borderColor: active ? theme.primary : theme.cardBorder,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontFamily: 'Nunito_800ExtraBold',
                                                    fontSize: 11.5,
                                                    color: active ? '#ffffff' : theme.textSecondary,
                                                }}
                                            >
                                                {range === 'upcoming' ? 'Upcoming' : 'Past'}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}

                                <View style={{ flex: 1 }} />

                                {selectMode ? (
                                    <>
                                        <TouchableOpacity
                                            onPress={() =>
                                                confirmDelete(
                                                    agendaItems.filter(i => i.kind === 'event' && selectedIds.has(i.id)),
                                                )
                                            }
                                            disabled={selectedIds.size === 0}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Delete ${selectedIds.size} selected events`}
                                            accessibilityState={{ disabled: selectedIds.size === 0 }}
                                            style={{
                                                paddingHorizontal: 12,
                                                height: 28,
                                                justifyContent: 'center',
                                                borderRadius: Radius.full,
                                                backgroundColor: selectedIds.size === 0 ? theme.surfaceSecondary : tints.danger.solid,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontFamily: 'Nunito_800ExtraBold',
                                                    fontSize: 11.5,
                                                    color: selectedIds.size === 0 ? theme.textTertiary : '#ffffff',
                                                }}
                                            >
                                                {`Delete ${selectedIds.size || ''}`.trim()}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setSelectMode(false);
                                                setSelectedIds(new Set());
                                            }}
                                            accessibilityRole="button"
                                            accessibilityLabel="Leave select mode"
                                            style={{ paddingHorizontal: 10, height: 28, justifyContent: 'center' }}
                                        >
                                            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 11.5, color: theme.textSecondary }}>
                                                Done
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <>
                                        <TouchableOpacity
                                            onPress={() => setSelectMode(true)}
                                            accessibilityRole="button"
                                            accessibilityLabel="Select events to delete"
                                            style={{
                                                paddingHorizontal: 12,
                                                height: 28,
                                                justifyContent: 'center',
                                                borderRadius: Radius.full,
                                                borderWidth: 1,
                                                borderColor: theme.cardBorder,
                                            }}
                                        >
                                            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 11.5, color: theme.textSecondary }}>
                                                Select
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setSelectedKey(toDateKey(today));
                                                setEventSheet({ open: true, editing: null });
                                            }}
                                            accessibilityRole="button"
                                            accessibilityLabel="Add an event"
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                paddingHorizontal: 12,
                                                height: 28,
                                                borderRadius: Radius.full,
                                                backgroundColor: theme.primary,
                                                borderBottomWidth: 2,
                                                borderBottomColor: isDark ? '#5b62c9' : '#3730a3',
                                            }}
                                        >
                                            <Ionicons name="add" size={14} color="#ffffff" />
                                            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 11.5, color: '#ffffff', marginLeft: 2 }}>
                                                Event
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>

                            <AgendaList
                                items={agendaItems}
                                today={today}
                                reversed={agendaRange === 'past'}
                                showTerm={scope === 'all'}
                                selectMode={selectMode}
                                selectedIds={selectedIds}
                                onToggleSelect={toggleSelected}
                                onPressEvent={item => setEventSheet({ open: true, editing: item })}
                                onEditEvent={item => setEventSheet({ open: true, editing: item })}
                                onDeleteEvent={item => confirmDelete([item])}
                                onPressTask={openTask}
                                bottomPadding={tabBarHeight + 20}
                                ListEmptyComponent={
                                    <AgendaEmpty
                                        title={
                                            query || filtersActive
                                                ? 'Nothing matches those filters'
                                                : agendaRange === 'upcoming'
                                                    ? 'Nothing coming up'
                                                    : 'Nothing behind you yet'
                                        }
                                        body={
                                            query || filtersActive
                                                ? 'Try clearing the search or turning a filter back on.'
                                                : 'Add exam weeks, deadlines and holidays — or scan your school’s academic calendar with the sparkle button.'
                                        }
                                    />
                                }
                            />
                        </View>
                    )}
                </>
            )}

            {/* ── Sheets ───────────────────────────────────────────────────── */}
            <EventSheet
                visible={eventSheet.open}
                editing={editingDraft}
                defaultDateKey={selectedKey}
                termLabel={
                    eventSheet.editing?.semName
                        ? `${eventSheet.editing.yearName} · ${eventSheet.editing.semName}`
                        : termLabel
                }
                onClose={() => setEventSheet({ open: false, editing: null })}
                onSave={handleSaveEvent}
                onDelete={
                    eventSheet.editing
                        ? () => {
                            // Dismiss the sheet before the confirm: two stacked
                            // native modals are unreliable, and the question is
                            // about the event, not the form.
                            const target = eventSheet.editing!;
                            setEventSheet({ open: false, editing: null });
                            confirmDelete([target]);
                        }
                        : undefined
                }
            />

            <TermSheet
                visible={showTermSheet}
                onClose={() => setShowTermSheet(false)}
                termLabel={termLabel}
                progress={termProgress}
                onSetDate={handleSetTermDate}
            />

            <CalendarImportModal visible={showImport} onClose={() => setShowImport(false)} onImport={handleImport} />
        </SafeAreaView>
    );
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

function FilterChip({
    label,
    icon,
    active,
    theme,
    onPress,
    accessibilityLabel,
}: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    active: boolean;
    theme: ReturnType<typeof getTheme>;
    onPress: () => void;
    accessibilityLabel: string;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={accessibilityLabel}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 10,
                height: 28,
                borderRadius: Radius.full,
                borderWidth: 1,
                backgroundColor: active ? theme.primary : 'transparent',
                borderColor: active ? theme.primary : theme.cardBorder,
            }}
        >
            <Ionicons name={icon} size={12} color={active ? '#ffffff' : theme.textSecondary} style={{ marginRight: 4 }} />
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: active ? '#ffffff' : theme.textSecondary }}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

function NoTermsState({
    isDark,
    theme,
    onSetup,
}: {
    isDark: boolean;
    theme: ReturnType<typeof getTheme>;
    onSetup: () => void;
}) {
    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Ionicons name="school-outline" size={54} color={isDark ? '#32365c' : '#cbd5e1'} />
            <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 18, color: theme.text, marginTop: 16 }}>
                No academic years yet
            </Text>
            <Text
                style={{
                    fontFamily: 'Nunito_400Regular',
                    fontSize: 13,
                    color: theme.textTertiary,
                    textAlign: 'center',
                    lineHeight: 19,
                    marginTop: 6,
                }}
            >
                Your calendar hangs off a term. Create one in the Academic Manager and every date you add will have a home.
            </Text>
            <TouchableOpacity
                onPress={onSetup}
                accessibilityRole="button"
                accessibilityLabel="Go to the Academic Manager"
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 22,
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: Radius.full,
                    backgroundColor: theme.primary,
                    borderBottomWidth: 2,
                    borderBottomColor: isDark ? '#5b62c9' : '#3730a3',
                }}
            >
                <Ionicons name="add" size={17} color="#ffffff" />
                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: '#ffffff', marginLeft: 6 }}>
                    Set up a term
                </Text>
            </TouchableOpacity>
        </View>
    );
}

function NoSemesterState({ theme }: { theme: ReturnType<typeof getTheme> }) {
    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Ionicons name="calendar-outline" size={44} color={theme.textTertiary} />
            <Text
                style={{
                    fontFamily: 'Nunito_700Bold',
                    fontSize: 14,
                    color: theme.textSecondary,
                    textAlign: 'center',
                    marginTop: 14,
                    lineHeight: 20,
                }}
            >
                No semester selected.{'\n'}Pick a term from the header to see its calendar.
            </Text>
        </View>
    );
}
