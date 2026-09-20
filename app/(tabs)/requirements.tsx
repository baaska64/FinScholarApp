import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl, Image, LayoutAnimation } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncService } from '@/services/SyncService';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import Tabs from '@/components/ledger/Tabs';
import { AlertService } from '@/components/CustomAlert';
import { useSemesterContext } from '@/components/SemesterContext';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import ProgressBar from '@/components/ui/ProgressBar';
import { ListSkeleton } from '@/components/ui/LoadingSkeleton';
import {
    TaskFormModal,
    TaskRow,
    FocusBar,
    TaskActionSheet,
    TaskOverviewSheet,
    FocusSheet,
    useFocusTimer,
    TaskItem,
    TaskPriority,
    TaskStatus,
    SortOption,
    StatusFilterOption,
    ChecklistItem,
    formatTimer,
    sanitizeScore,
    triggerHaptic,
} from '@/components/tasks';
import SpotlightTarget from '@/components/spotlight/SpotlightTarget';
import { useScreenTour } from '@/components/spotlight/useScreenTour';
import { SPOTLIGHT_IDS, TOUR_KEYS, TASKS_TOUR } from '@/constants/tours';
import { useTabBarHeight } from '@/components/CustomTabBar';
import {
    doneTasks as selectDoneTasks,
    filterTasks,
    getDigest,
    getTaskCounts,
    groupTasksByDue,
    sortTasks,
} from '@/utils/taskModel';

const generateId = () => Math.random().toString(36).substr(2, 9);

/** Page gutter, matching the calendar and schedule tabs. */
const GUTTER = 14;

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
    { key: 'dueDate', label: 'Due date' },
    { key: 'priority', label: 'Priority' },
    { key: 'title', label: 'Title' },
    { key: 'status', label: 'Status' },
];

const STATUS_OPTIONS: { key: StatusFilterOption; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'To do' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'graded', label: 'Graded' },
];

/**
 * The tasks tab.
 *
 * Rebuilt around the question the screen exists to answer: **what do I need to
 * do next?**
 *
 * The old screen answered it last. It opened on Fin's Focus Station — a timer
 * filling the entire first viewport — then a 330pt stats card, then three rows
 * of filters, and only then the list. The list itself was grouped by *status*
 * (Pending / Submitted / Graded), an administrative axis, and rendered all
 * three headings unconditionally, so a term with one submitted task showed two
 * empty sections with placeholder cards. Reaching that one task took two and a
 * half screens of scrolling.
 *
 * Now: tasks are grouped by **when they are due**, only non-empty groups exist,
 * finished work collapses into one Done section, and the two things that used
 * to occupy the top — the timer and the stats — are a sheet each, reachable in
 * one tap and free to be larger than they ever were inline. The timer's state
 * lives here rather than in its sheet, so a session keeps running while the
 * student browses their list.
 */
export default function RequirementsScreen() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);
    const tabBarHeight = useTabBarHeight();

    const { selectedYear: activeYearId, selectedSemester: activeSemId } = useSemesterContext();
    const params = useLocalSearchParams();

    const [data, setData] = useState<any>(null);
    const [syncStatus, setSyncStatus] = useState<'syncing' | 'saved' | 'error' | 'offline'>('offline');
    const [refreshing, setRefreshing] = useState(false);

    const [subjectFilter, setSubjectFilter] = useState<string>((params.subjectId as string) || 'ALL');
    const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all');
    const [sort, setSort] = useState<SortOption>('dueDate');
    const [query, setQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showDone, setShowDone] = useState(false);

    const [showForm, setShowForm] = useState(false);
    const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
    const [actionTask, setActionTask] = useState<TaskItem | null>(null);
    const [showOverview, setShowOverview] = useState(false);
    const [showFocus, setShowFocus] = useState(false);

    /**
     * The focus timer lives on the screen, not in its sheet. Mounted inside the
     * sheet, a 25-minute session would die the moment the student closed it to
     * go look at their list — which is precisely when they would close it.
     */
    const timer = useFocusTimer();

    // Ticks the urgency labels and the overdue split without a re-render storm.
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (typeof params.subjectId === 'string' && params.subjectId) {
            setSubjectFilter(params.subjectId);
        }
    }, [params.subjectId]);

    // ── Data ──────────────────────────────────────────────────────────────────

    const loadLocalData = useCallback(async () => {
        let loaded: any = null;
        try {
            const local = await AsyncStorage.getItem('grade_ledger_v2_data');
            if (local) loaded = JSON.parse(local);
        } catch (e) {
            // A corrupt ledger must not blank the tab.
        }
        if (!loaded || !Array.isArray(loaded.years)) loaded = { settings: {}, years: [] };

        loaded.years.forEach((y: any) =>
            (y.semesters || []).forEach((s: any) => {
                if (!s.subjects) s.subjects = [];
                s.subjects.forEach((subj: any) => {
                    if (!subj.requirements) subj.requirements = [];
                });
            }),
        );

        setData(loaded);
        setNow(Date.now());
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadLocalData();
        }, [loadLocalData]),
    );

    useEffect(() => {
        const unsubData = SyncService.subscribeDataChange(() => loadLocalData());
        const unsubState = SyncService.subscribe(state => setSyncStatus(state === 'conflict' ? 'offline' : state));
        return () => {
            unsubData();
            unsubState();
        };
    }, [loadLocalData]);

    const saveData = useCallback(async (next: any) => {
        setData(next);
        await SyncService.pushLocalChanges(next);
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadLocalData();
        setRefreshing(false);
    };

    useScreenTour(TOUR_KEYS.tasks, TASKS_TOUR, data !== null);

    // ── Derived ───────────────────────────────────────────────────────────────

    const currentYear = data?.years?.find((y: any) => y.id === activeYearId);
    const currentSem = currentYear?.semesters?.find((s: any) => s.id === activeSemId);
    const subjects: any[] = useMemo(() => currentSem?.subjects || [], [currentSem]);

    useEffect(() => {
        if (subjectFilter !== 'ALL' && subjects.length > 0 && !subjects.some((s: any) => s.id === subjectFilter)) {
            setSubjectFilter('ALL');
        }
    }, [subjects, subjectFilter]);

    const allTasks: TaskItem[] = useMemo(() => {
        const list: TaskItem[] = [];
        subjects.forEach((subj: any) => {
            (subj.requirements || []).forEach((req: any) => {
                list.push({ ...req, subjectName: subj.name, subjectId: subj.id });
            });
        });
        return list;
    }, [subjects]);

    const counts = useMemo(() => getTaskCounts(allTasks, now), [allTasks, now]);
    const digest = useMemo(() => getDigest(counts), [counts]);

    const visibleTasks = useMemo(
        () => sortTasks(filterTasks(allTasks, { query, subjectId: subjectFilter, status: statusFilter }, now), sort),
        [allTasks, query, subjectFilter, statusFilter, sort, now],
    );

    const groups = useMemo(() => groupTasksByDue(visibleTasks, now), [visibleTasks, now]);
    const done = useMemo(() => selectDoneTasks(visibleTasks), [visibleTasks]);

    /** Counts for the always-visible status chips, keyed by filter option. */
    const statusCounts: Record<StatusFilterOption, number> = useMemo(
        () => ({
            all: counts.total,
            pending: counts.pending,
            overdue: counts.overdue,
            submitted: counts.submitted,
            graded: counts.graded,
        }),
        [counts],
    );

    // The status chips are on screen now, so they are not "an active filter"
    // in the sense the funnel badge means — only the hidden controls are.
    const filtersActive = subjectFilter !== 'ALL' || sort !== 'dueDate';
    const termLabel = currentYear && currentSem ? `${currentYear.name} · ${currentSem.name}` : 'No term selected';

    // ── Grade ledger sync ─────────────────────────────────────────────────────

    /**
     * Keeps a graded task mirrored into the subject's grade ledger. Unchanged
     * from the previous screen — this is the contract the Grades tab reads.
     */
    const syncGradeItem = (subject: any, task: any) => {
        if (!subject || !Array.isArray(subject.periods)) return;

        if (task.gradeItemId && (task.status !== 'graded' || !task.linkedComponentId)) {
            subject.periods.forEach((p: any) =>
                (p.components || []).forEach((c: any) => {
                    if (c.items) c.items = c.items.filter((it: any) => it.id !== task.gradeItemId);
                }),
            );
            task.gradeItemId = undefined;
        }

        if (task.status === 'graded' && task.linkedComponentId) {
            let found = false;
            subject.periods.forEach((p: any) =>
                (p.components || []).forEach((c: any) => {
                    if (c.id === task.linkedComponentId) {
                        if (!c.items) c.items = [];
                        if (task.gradeItemId) {
                            const item = c.items.find((it: any) => it.id === task.gradeItemId);
                            if (item) {
                                item.name = task.title;
                                item.score = task.earnedScore;
                                item.max = task.maxScore;
                                found = true;
                            }
                        }
                        if (!found) {
                            const newId = task.gradeItemId || generateId();
                            task.gradeItemId = newId;
                            c.items.push({
                                id: newId,
                                name: task.title,
                                score: task.earnedScore,
                                max: task.maxScore,
                                subItems: [],
                            });
                            found = true;
                        }
                    } else if (task.gradeItemId && c.items) {
                        c.items = c.items.filter((it: any) => it.id !== task.gradeItemId);
                    }
                }),
            );
        }
    };

    const findSubject = (draft: any, subjectId: string) =>
        draft.years
            ?.find((y: any) => y.id === activeYearId)
            ?.semesters?.find((s: any) => s.id === activeSemId)
            ?.subjects?.find((s: any) => s.id === subjectId);

    // ── Mutations ─────────────────────────────────────────────────────────────

    const handleSaveTask = async (form: {
        title: string;
        description: string;
        dueDate: Date;
        priority: TaskPriority;
        status: TaskStatus;
        subjectId: string;
        linkedComponentId: string;
        earnedScore: string;
        maxScore: string;
        checklist?: ChecklistItem[];
    }) => {
        if (!form.title || !form.subjectId) {
            AlertService.alert('Missing fields', 'Please enter a title and pick a subject.');
            return;
        }

        const nd = JSON.parse(JSON.stringify(data));
        const subject = findSubject(nd, form.subjectId);
        if (!subject) {
            AlertService.alert('Subject missing', 'Please select a valid subject for this task.');
            return;
        }

        const taskObj: any = {
            id: editingTask ? editingTask.id : generateId(),
            title: form.title,
            description: form.description,
            dueDate: form.dueDate.toISOString(),
            priority: form.priority,
            status: form.status,
            linkedComponentId: form.linkedComponentId || null,
            earnedScore: form.status === 'graded' ? sanitizeScore(form.earnedScore, 0, false) : undefined,
            maxScore: form.status === 'graded' ? sanitizeScore(form.maxScore, 100, true) : undefined,
            gradeItemId: editingTask ? editingTask.gradeItemId : undefined,
            checklist: form.checklist || [],
        };

        // Moving a task between subjects has to take its grade item with it.
        if (editingTask && editingTask.subjectId !== form.subjectId) {
            const oldSubject = findSubject(nd, editingTask.subjectId);
            if (oldSubject?.requirements) {
                if (editingTask.gradeItemId && oldSubject.periods) {
                    oldSubject.periods.forEach((p: any) =>
                        (p.components || []).forEach((c: any) => {
                            if (c.items) c.items = c.items.filter((it: any) => it.id !== editingTask.gradeItemId);
                        }),
                    );
                }
                oldSubject.requirements = oldSubject.requirements.filter((r: any) => r.id !== editingTask.id);
            }
        }

        syncGradeItem(subject, taskObj);

        if (!subject.requirements) subject.requirements = [];
        if (editingTask && editingTask.subjectId === form.subjectId) {
            subject.requirements = subject.requirements.map((r: any) => (r.id === editingTask.id ? taskObj : r));
        } else {
            const idx = subject.requirements.findIndex((r: any) => r.id === taskObj.id);
            if (idx >= 0) subject.requirements[idx] = taskObj;
            else subject.requirements.push(taskObj);
        }

        setShowForm(false);
        setEditingTask(null);
        await saveData(nd);
    };

    const handleDeleteTask = (task: TaskItem) => {
        AlertService.alert('Delete task', `Delete "${task.title}"? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const nd = JSON.parse(JSON.stringify(data));
                    const subject = findSubject(nd, task.subjectId);
                    if (!subject) return;
                    if (task.gradeItemId && subject.periods) {
                        subject.periods.forEach((p: any) =>
                            (p.components || []).forEach((c: any) => {
                                if (c.items) c.items = c.items.filter((it: any) => it.id !== task.gradeItemId);
                            }),
                        );
                    }
                    subject.requirements = (subject.requirements || []).filter((r: any) => r.id !== task.id);
                    await saveData(nd);
                },
            },
        ]);
    };

    const setTaskStatus = async (task: TaskItem, status: TaskStatus) => {
        // A grade needs a score and a component, so it goes through the form.
        if (status === 'graded') {
            setEditingTask({ ...task, status: 'graded' });
            setShowForm(true);
            return;
        }

        const nd = JSON.parse(JSON.stringify(data));
        const subject = findSubject(nd, task.subjectId);
        if (!subject) return;

        const updated = { ...task, status };
        syncGradeItem(subject, updated);
        subject.requirements = subject.requirements.map((r: any) => (r.id === task.id ? updated : r));
        await saveData(nd);
    };

    /** The checkbox is binary: to do ↔ submitted. Grading is an explicit act. */
    const toggleTaskStatus = (task: TaskItem) =>
        setTaskStatus(task, task.status === 'pending' ? 'submitted' : 'pending');

    const handleUpdateChecklist = async (task: TaskItem, checklist: ChecklistItem[]) => {
        const nd = JSON.parse(JSON.stringify(data));
        const subject = findSubject(nd, task.subjectId);
        if (!subject) return;
        subject.requirements = subject.requirements.map((r: any) => (r.id === task.id ? { ...task, checklist } : r));
        await saveData(nd);
    };

    const openEditTask = (task: TaskItem) => {
        setEditingTask(task);
        setShowForm(true);
    };

    const openAddTask = () => {
        if (!activeYearId || !activeSemId) {
            AlertService.alert('No term selected', 'Pick or create an academic term before adding a task.');
            return;
        }
        if (subjects.length === 0) {
            AlertService.alert('No subjects yet', 'Add at least one subject to this semester before creating a task.');
            return;
        }
        triggerHaptic('light');
        setEditingTask(null);
        setShowForm(true);
    };

    const getComponentsForSubject = (subjectId: string) => {
        const subj = subjects.find((s: any) => s.id === subjectId);
        if (!subj?.periods) return [];
        const list: any[] = [];
        subj.periods.forEach((p: any) =>
            (p.components || []).forEach((c: any) => list.push({ id: c.id, label: `${p.name} - ${c.name}` })),
        );
        return list;
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

    const digestTint =
        digest.tone === 'danger' ? tints.danger : digest.tone === 'warning' ? tints.tasks : tints.attendance;

    if (!data) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
                <ListSkeleton count={5} cardHeight={64} />
            </SafeAreaView>
        );
    }

    const hasTerms = data.years.length > 0;
    const nothingToShow = groups.length === 0 && done.length === 0;

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
                        backgroundColor: tints.tasks.fill,
                        borderWidth: 1,
                        borderColor: tints.tasks.line,
                    }}
                >
                    <Ionicons name="checkbox" size={17} color={tints.tasks.ink} />
                </View>

                <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 17, color: theme.text }}>Tasks</Text>
                    <Tabs years={data.years} activeYearId={activeYearId} activeSemId={activeSemId} compact />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {syncStatus === 'syncing' && <Ionicons name="cloud-upload" size={17} color={theme.textTertiary} />}
                    {syncStatus === 'saved' && <Ionicons name="cloud-done" size={17} color={theme.success} />}
                    {(syncStatus === 'error' || syncStatus === 'offline') && (
                        <Ionicons name="cloud-offline" size={17} color={theme.textTertiary} />
                    )}

                    {/* Only while a session is running. Idle, this would just
                        duplicate the focus bar sitting at the top of the list;
                        running, it is the one place the countdown stays visible
                        after that bar has scrolled away. */}
                    {timer.isRunning && (
                        <TouchableOpacity
                            onPress={() => {
                                triggerHaptic('light');
                                setShowFocus(true);
                            }}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel={`Focus session running, ${formatTimer(timer.timeLeft)} left. Open Fin's Focus Station.`}
                            style={{
                                height: 34,
                                paddingHorizontal: 10,
                                borderRadius: Radius.full,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: tints.schedule.fill,
                                borderWidth: 1,
                                borderColor: tints.schedule.line,
                            }}
                        >
                            <Ionicons name="flame" size={15} color={tints.schedule.ink} />
                            <Text
                                allowFontScaling={false}
                                style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: tints.schedule.ink, marginLeft: 4 }}
                            >
                                {formatTimer(timer.timeLeft)}
                            </Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)/profile')}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel="Settings"
                        style={iconButton}
                    >
                        <Ionicons name="settings-outline" size={17} color={isDark ? '#cbd5e1' : '#475569'} />
                    </TouchableOpacity>
                </View>
            </View>

            {!hasTerms ? (
                <FinEmpty
                    theme={theme}
                    sprite={require('../../assets/images/sleeping.png')}
                    title="No academic terms yet"
                    body="Tasks belong to a subject inside a term. Set one up and Fin will start keeping track."
                    actionLabel="Set up a term"
                    onAction={() => router.push('/academic-manager')}
                    isDark={isDark}
                />
            ) : (
                <>
                    {/* ── Digest + controls ────────────────────────────────── */}
                    <View style={{ paddingHorizontal: GUTTER, paddingVertical: 8, ...barStyle }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity
                                onPress={() => setShowOverview(true)}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel={`${digest.headline}. ${counts.completionPercent} percent done. Open the task overview.`}
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                            >
                                <View
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        marginRight: 8,
                                        backgroundColor: digest.tone === 'neutral' ? theme.textTertiary : digestTint.solid,
                                    }}
                                />
                                <Text
                                    numberOfLines={1}
                                    style={{
                                        fontFamily: 'Nunito_800ExtraBold',
                                        fontSize: 13,
                                        color: digest.tone === 'danger' ? tints.danger.ink : theme.text,
                                    }}
                                >
                                    {digest.headline}
                                </Text>
                                {counts.total > 0 && (
                                    <View style={{ flex: 1, marginLeft: 10, marginRight: 6 }}>
                                        <ProgressBar
                                            progress={counts.completionPercent / 100}
                                            height={3}
                                            color={tints.attendance.solid}
                                            animate={false}
                                        />
                                    </View>
                                )}
                                <Ionicons name="chevron-forward" size={13} color={theme.textTertiary} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    setShowSearch(s => !s);
                                    if (showSearch) setQuery('');
                                }}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityLabel={showSearch ? 'Close search' : 'Search tasks'}
                                accessibilityState={{ selected: showSearch }}
                                style={{ ...iconButton, width: 30, height: 30, backgroundColor: showSearch ? theme.primary : iconButton.backgroundColor }}
                            >
                                <Ionicons name="search" size={15} color={showSearch ? '#ffffff' : theme.textSecondary} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setShowFilters(f => !f)}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityLabel={showFilters ? 'Hide filters' : 'Show filters'}
                                accessibilityState={{ selected: showFilters }}
                                style={{
                                    ...iconButton,
                                    width: 30,
                                    height: 30,
                                    backgroundColor: showFilters || filtersActive ? theme.primary : iconButton.backgroundColor,
                                }}
                            >
                                <Ionicons
                                    name="options-outline"
                                    size={15}
                                    color={showFilters || filtersActive ? '#ffffff' : theme.textSecondary}
                                />
                            </TouchableOpacity>
                        </View>

                        {showSearch && (
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginTop: 8,
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
                                    placeholder="Search tasks, subjects…"
                                    placeholderTextColor={theme.textTertiary}
                                    accessibilityLabel="Search tasks"
                                    style={{
                                        flex: 1,
                                        marginLeft: 8,
                                        paddingVertical: 0,
                                        fontFamily: 'Nunito_400Regular',
                                        fontSize: 13.5,
                                        color: theme.text,
                                    }}
                                />
                                {query.length > 0 && (
                                    <TouchableOpacity
                                        onPress={() => setQuery('')}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        accessibilityRole="button"
                                        accessibilityLabel="Clear search"
                                    >
                                        <Ionicons name="close-circle" size={15} color={theme.textTertiary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* Status chips are ALWAYS visible and carry their
                            counts, so they are both the filter and the tally.
                            Hiding these behind the filter icon is what made the
                            four numbers feel buried. */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 6, paddingRight: 8, marginTop: 8 }}
                        >
                            {STATUS_OPTIONS.map(option => {
                                const selected = statusFilter === option.key;
                                const count = statusCounts[option.key];
                                const isRisk = option.key === 'overdue' && count > 0;
                                return (
                                    <TouchableOpacity
                                        key={option.key}
                                        onPress={() => setStatusFilter(option.key)}
                                        activeOpacity={0.8}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected }}
                                        accessibilityLabel={`${option.label}, ${count} ${count === 1 ? 'task' : 'tasks'}`}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            paddingHorizontal: 11,
                                            height: 30,
                                            borderRadius: Radius.full,
                                            borderWidth: 1,
                                            backgroundColor: selected
                                                ? theme.primary
                                                : isRisk
                                                    ? tints.danger.fill
                                                    : 'transparent',
                                            borderColor: selected
                                                ? theme.primary
                                                : isRisk
                                                    ? tints.danger.line
                                                    : theme.cardBorder,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontFamily: 'Nunito_700Bold',
                                                fontSize: 12,
                                                color: selected ? '#ffffff' : isRisk ? tints.danger.ink : theme.textSecondary,
                                            }}
                                        >
                                            {option.label}
                                        </Text>
                                        <Text
                                            style={{
                                                fontFamily: 'Nunito_800ExtraBold',
                                                fontSize: 12,
                                                marginLeft: 6,
                                                color: selected ? '#ffffff' : isRisk ? tints.danger.ink : theme.textTertiary,
                                            }}
                                        >
                                            {count}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {showFilters && (
                            <View style={{ marginTop: 8, gap: 6 }}>
                                {subjects.length > 1 && (
                                    <ChipRow
                                        label="Subject"
                                        options={[
                                            { key: 'ALL', label: 'All subjects' },
                                            ...subjects.map((s: any) => ({ key: s.id, label: s.code || s.name })),
                                        ]}
                                        active={subjectFilter}
                                        onSelect={setSubjectFilter}
                                        theme={theme}
                                    />
                                )}
                                <ChipRow
                                    label="Sort by"
                                    options={SORT_OPTIONS.map(o => ({ key: o.key, label: o.label }))}
                                    active={sort}
                                    onSelect={k => setSort(k as SortOption)}
                                    theme={theme}
                                />
                            </View>
                        )}
                    </View>

                    {/* ── The list ─────────────────────────────────────────── */}
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: tabBarHeight + 88 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
                        }
                    >
                        {subjects.length > 0 && <FocusBar timer={timer} onOpen={() => setShowFocus(true)} />}

                        {subjects.length === 0 ? (
                            <FinEmpty
                                inline
                                theme={theme}
                                isDark={isDark}
                                sprite={require('../../assets/images/confused.png')}
                                title="No subjects in this term"
                                body="A task hangs off a subject. Add your subjects first and they will show up here."
                                actionLabel="Go to Grades"
                                onAction={() => router.push('/(tabs)/grades')}
                            />
                        ) : nothingToShow ? (
                            <FinEmpty
                                inline
                                theme={theme}
                                isDark={isDark}
                                sprite={
                                    allTasks.length === 0
                                        ? require('../../assets/images/sleeping.png')
                                        : require('../../assets/images/confused.png')
                                }
                                title={allTasks.length === 0 ? 'No tasks yet' : 'Nothing matches'}
                                body={
                                    allTasks.length === 0
                                        ? 'Add an assignment, a quiz or an exam and Fin will keep an eye on the deadline.'
                                        : 'Try clearing the search or switching a filter back on.'
                                }
                                actionLabel={allTasks.length === 0 ? 'Add a task' : 'Clear filters'}
                                onAction={
                                    allTasks.length === 0
                                        ? openAddTask
                                        : () => {
                                            setQuery('');
                                            setStatusFilter('all');
                                            setSubjectFilter('ALL');
                                        }
                                }
                            />
                        ) : (
                            <>
                                {groups.length === 0 && done.length > 0 && (
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            padding: 14,
                                            borderRadius: Radius.xl,
                                            backgroundColor: tints.attendance.fill,
                                            borderWidth: 1,
                                            borderColor: tints.attendance.line,
                                            marginBottom: 14,
                                        }}
                                    >
                                        <Image
                                            source={require('../../assets/images/happy.png')}
                                            style={{ width: 46, height: 46, marginRight: 10 }}
                                            resizeMode="contain"
                                        />
                                        <Text style={{ flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: tints.attendance.ink }}>
                                            All caught up — nothing left to do in this term.
                                        </Text>
                                    </View>
                                )}

                                {groups.map(group => (
                                    <View key={group.key} style={{ marginBottom: 16 }}>
                                        <GroupHeader
                                            label={group.label}
                                            count={group.tasks.length}
                                            tone={group.key === 'overdue' ? tints.danger.solid : group.key === 'today' ? tints.tasks.solid : theme.textTertiary}
                                            emphasised={group.key === 'overdue'}
                                            theme={theme}
                                        />
                                        <ListCard theme={theme} accent={group.key === 'overdue' ? tints.danger.line : undefined}>
                                            {group.tasks.map((task, idx) => (
                                                <TaskRow
                                                    key={task.id}
                                                    task={task}
                                                    nowMs={now}
                                                    showDivider={idx > 0}
                                                    onToggleStatus={toggleTaskStatus}
                                                    onOpenActions={setActionTask}
                                                    onEdit={openEditTask}
                                                    onUpdateChecklist={handleUpdateChecklist}
                                                />
                                            ))}
                                        </ListCard>
                                    </View>
                                ))}

                                {done.length > 0 && (
                                    <View style={{ marginBottom: 16 }}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                setShowDone(v => !v);
                                            }}
                                            activeOpacity={0.7}
                                            accessibilityRole="button"
                                            accessibilityState={{ expanded: showDone }}
                                            accessibilityLabel={`Done, ${done.length} ${done.length === 1 ? 'task' : 'tasks'}`}
                                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, marginBottom: 8 }}
                                        >
                                            <Ionicons
                                                name={showDone ? 'chevron-down' : 'chevron-forward'}
                                                size={14}
                                                color={theme.textTertiary}
                                                style={{ marginRight: 5 }}
                                            />
                                            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13, color: theme.textSecondary }}>
                                                Done
                                            </Text>
                                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textTertiary, marginLeft: 7 }}>
                                                {done.length}
                                            </Text>
                                        </TouchableOpacity>

                                        {showDone && (
                                            <ListCard theme={theme}>
                                                {done.map((task, idx) => (
                                                    <TaskRow
                                                        key={task.id}
                                                        task={task}
                                                        nowMs={now}
                                                        showDivider={idx > 0}
                                                        onToggleStatus={toggleTaskStatus}
                                                        onOpenActions={setActionTask}
                                                        onEdit={openEditTask}
                                                        onUpdateChecklist={handleUpdateChecklist}
                                                    />
                                                ))}
                                            </ListCard>
                                        )}
                                    </View>
                                )}
                            </>
                        )}
                    </ScrollView>

                    {/* ── Add ──────────────────────────────────────────────── */}
                    <SpotlightTarget
                        id={SPOTLIGHT_IDS.tasksAdd}
                        style={{ position: 'absolute', right: 16, bottom: tabBarHeight + 12 }}
                    >
                        <TouchableOpacity
                            onPress={openAddTask}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel="Add a task"
                            style={{
                                width: 54,
                                height: 54,
                                borderRadius: Radius.full,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: theme.primary,
                                borderBottomWidth: 3,
                                borderBottomColor: isDark ? '#5b62c9' : '#3730a3',
                            }}
                        >
                            <Ionicons name="add" size={27} color="#ffffff" />
                        </TouchableOpacity>
                    </SpotlightTarget>
                </>
            )}

            {/* ── Sheets ───────────────────────────────────────────────────── */}
            <TaskFormModal
                visible={showForm}
                onClose={() => {
                    setShowForm(false);
                    setEditingTask(null);
                }}
                onSave={handleSaveTask}
                editingTask={editingTask}
                subjects={subjects}
                getComponentsForSubject={getComponentsForSubject}
                initialSubjectId={subjectFilter !== 'ALL' ? subjectFilter : undefined}
            />

            <TaskActionSheet
                task={actionTask}
                onClose={() => setActionTask(null)}
                onEdit={task => {
                    setActionTask(null);
                    setEditingTask(task);
                    setShowForm(true);
                }}
                onDelete={task => {
                    setActionTask(null);
                    handleDeleteTask(task);
                }}
                onSetStatus={(task, status) => {
                    setActionTask(null);
                    setTaskStatus(task, status);
                }}
                onFocus={task => {
                    setActionTask(null);
                    timer.startForTask(task.title);
                    setShowFocus(true);
                }}
            />

            <TaskOverviewSheet
                visible={showOverview}
                onClose={() => setShowOverview(false)}
                counts={counts}
                termLabel={termLabel}
            />

            <FocusSheet visible={showFocus} onClose={() => setShowFocus(false)} timer={timer} />
        </SafeAreaView>
    );
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

function GroupHeader({
    label,
    count,
    tone,
    emphasised,
    theme,
}: {
    label: string;
    count: number;
    tone: string;
    emphasised?: boolean;
    theme: ReturnType<typeof getTheme>;
}) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingLeft: 1 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, marginRight: 8, backgroundColor: tone }} />
            <Text
                accessibilityRole="header"
                style={{
                    fontFamily: 'Nunito_800ExtraBold',
                    fontSize: 13.5,
                    color: emphasised ? tone : theme.text,
                    letterSpacing: -0.1,
                }}
            >
                {label}
            </Text>
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textTertiary, marginLeft: 7 }}>
                {count}
            </Text>
        </View>
    );
}

/** The one surface a group of rows sits on: hairline border, lip, no shadow. */
function ListCard({
    children,
    theme,
    accent,
}: {
    children: React.ReactNode;
    theme: ReturnType<typeof getTheme>;
    accent?: string;
}) {
    return (
        <View
            style={{
                borderRadius: Radius.xl,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: accent || theme.cardBorder,
                borderBottomWidth: 2,
                borderBottomColor: accent || theme.lip,
                paddingHorizontal: 12,
            }}
        >
            {children}
        </View>
    );
}

/**
 * Every empty state on this tab, with Fin in it. The screen previously had
 * three differently-styled empties plus two placeholder cards for sections that
 * simply had nothing in them.
 */
function FinEmpty({
    sprite,
    title,
    body,
    actionLabel,
    onAction,
    theme,
    isDark,
    inline,
}: {
    sprite: any;
    title: string;
    body: string;
    actionLabel?: string;
    onAction?: () => void;
    theme: ReturnType<typeof getTheme>;
    isDark: boolean;
    inline?: boolean;
}) {
    return (
        <View
            style={{
                flex: inline ? undefined : 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 28,
                paddingVertical: inline ? 34 : 0,
            }}
        >
            <Image source={sprite} style={{ width: 116, height: 116, marginBottom: 6 }} resizeMode="contain" />
            <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 17, color: theme.text, textAlign: 'center' }}>
                {title}
            </Text>
            <Text
                style={{
                    fontFamily: 'Nunito_400Regular',
                    fontSize: 13,
                    lineHeight: 19,
                    color: theme.textTertiary,
                    textAlign: 'center',
                    marginTop: 6,
                }}
            >
                {body}
            </Text>
            {actionLabel && onAction && (
                <TouchableOpacity
                    onPress={onAction}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={actionLabel}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginTop: 18,
                        paddingHorizontal: 20,
                        paddingVertical: 11,
                        borderRadius: Radius.full,
                        backgroundColor: theme.primary,
                        borderBottomWidth: 2,
                        borderBottomColor: isDark ? '#5b62c9' : '#3730a3',
                    }}
                >
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: '#ffffff' }}>
                        {actionLabel}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

function ChipRow({
    label,
    options,
    active,
    onSelect,
    theme,
}: {
    label: string;
    options: { key: string; label: string }[];
    active: string;
    onSelect: (key: string) => void;
    theme: ReturnType<typeof getTheme>;
}) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
                style={{
                    width: 52,
                    fontFamily: 'Nunito_700Bold',
                    fontSize: 10.5,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    color: theme.textTertiary,
                }}
            >
                {label}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
                {options.map(option => {
                    const selected = option.key === active;
                    return (
                        <TouchableOpacity
                            key={option.key}
                            onPress={() => onSelect(option.key)}
                            activeOpacity={0.8}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`${label}: ${option.label}`}
                            style={{
                                paddingHorizontal: 11,
                                height: 27,
                                justifyContent: 'center',
                                borderRadius: Radius.full,
                                borderWidth: 1,
                                backgroundColor: selected ? theme.primary : 'transparent',
                                borderColor: selected ? theme.primary : theme.cardBorder,
                            }}
                        >
                            <Text
                                numberOfLines={1}
                                style={{
                                    fontFamily: 'Nunito_700Bold',
                                    fontSize: 11.5,
                                    color: selected ? '#ffffff' : theme.textSecondary,
                                }}
                            >
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}
