import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabaseClient';
import { SyncService } from '@/services/SyncService';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import Tabs from '@/components/ledger/Tabs';
import { AlertService } from '@/components/CustomAlert';
import { useSemesterContext } from '@/components/SemesterContext';
import { getTheme, Typography, Radius, Shadows } from '@/constants/Theme';
import { ListSkeleton } from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import {
  PomodoroCard,
  TaskProgressIsland,
  TaskFilterBar,
  TaskIslandCard,
  TaskFormModal,
  TaskItem,
  TaskPriority,
  TaskStatus,
  SortOption,
  StatusFilterOption,
  ChecklistItem,
  parseDueDate,
  sanitizeScore,
  triggerHaptic,
} from '@/components/tasks';

/** Staggered fade-in wrapper for task cards */
const FadeInTaskCard = ({ index, children }: { index: number; children: React.ReactNode }) => {
  const anim = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }).start();
    }, Math.min(index * 60, 400));
    return () => clearTimeout(timer);
  }, []);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
};

const generateId = () => Math.random().toString(36).substr(2, 9);

export default function RequirementsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);

  const [data, setData] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const { selectedYear: activeYearId, selectedSemester: activeSemId } = useSemesterContext();

  const [syncStatus, setSyncStatus] = useState<'syncing' | 'saved' | 'error' | 'offline'>('offline');
  const params = useLocalSearchParams();
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>(
    (params.subjectId as string) || 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<StatusFilterOption>('all');
  const [selectedSort, setSelectedSort] = useState<SortOption>('dueDate');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (params.subjectId && typeof params.subjectId === 'string') {
      setSelectedSubjectFilter(params.subjectId);
    }
  }, [params.subjectId]);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  // Real-time clock for urgency tickers
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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

    loaded.years.forEach((y: any) =>
      y.semesters.forEach((s: any) => {
        if (!s.subjects) s.subjects = [];
        s.subjects.forEach((subj: any) => {
          if (!subj.requirements) subj.requirements = [];
        });
      })
    );

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

  const saveData = async (newData: any) => {
    setData(newData);
    SyncService.pushLocalChanges(newData);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLocalData();
    setRefreshing(false);
  };

  const subjects = data?.years?.find((y: any) => y.id === activeYearId)?.semesters?.find((s: any) => s.id === activeSemId)?.subjects || [];

  // Reset filter to 'ALL' if the active subject filter is not part of the current semester's subjects
  useEffect(() => {
    if (selectedSubjectFilter !== 'ALL' && subjects.length > 0 && !subjects.some((s: any) => s.id === selectedSubjectFilter)) {
      setSelectedSubjectFilter('ALL');
    }
  }, [subjects, selectedSubjectFilter]);

  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <ListSkeleton count={4} cardHeight={90} />
      </SafeAreaView>
    );
  }

  const currentYear = data.years.find((y: any) => y.id === activeYearId);
  const currentSem = currentYear?.semesters.find((s: any) => s.id === activeSemId);

  // Aggregate all tasks across semester subjects
  const allTasks: TaskItem[] = [];
  subjects.forEach((subj: any) => {
    if (subj.requirements) {
      subj.requirements.forEach((req: any) => {
        allTasks.push({ ...req, subjectName: subj.name, subjectId: subj.id });
      });
    }
  });

  // Calculate task counts for filter chips
  const countsBySubject: Record<string, number> = {};
  subjects.forEach((sub: any) => {
    countsBySubject[sub.id] = (sub.requirements || []).length;
  });

  const countsByStatus: Record<StatusFilterOption, number> = {
    all: allTasks.length,
    pending: allTasks.filter((t) => t.status === 'pending').length,
    submitted: allTasks.filter((t) => t.status === 'submitted').length,
    graded: allTasks.filter((t) => t.status === 'graded').length,
    overdue: allTasks.filter((t) => {
      if (t.status !== 'pending') return false;
      const due = parseDueDate(t.dueDate);
      if (!due) return false;
      return due.getTime() <= now;
    }).length,
  };

  // Filter tasks
  let filteredTasks = allTasks;

  // 1. Subject filter
  if (selectedSubjectFilter !== 'ALL') {
    filteredTasks = filteredTasks.filter((t) => t.subjectId === selectedSubjectFilter);
  }

  // 2. Search query filter
  if (searchQuery.trim().length > 0) {
    const q = searchQuery.toLowerCase().trim();
    filteredTasks = filteredTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.subjectName && t.subjectName.toLowerCase().includes(q))
    );
  }

  // 3. Status filter
  if (selectedStatusFilter === 'pending') {
    filteredTasks = filteredTasks.filter((t) => t.status === 'pending');
  } else if (selectedStatusFilter === 'submitted') {
    filteredTasks = filteredTasks.filter((t) => t.status === 'submitted');
  } else if (selectedStatusFilter === 'graded') {
    filteredTasks = filteredTasks.filter((t) => t.status === 'graded');
  } else if (selectedStatusFilter === 'overdue') {
    filteredTasks = filteredTasks.filter((t) => {
      if (t.status !== 'pending') return false;
      const due = parseDueDate(t.dueDate);
      if (!due) return false;
      return due.getTime() <= now;
    });
  }

  // 4. Sort tasks
  filteredTasks.sort((a, b) => {
    if (selectedSort === 'dueDate') {
      const timeA = parseDueDate(a.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const timeB = parseDueDate(b.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return timeA - timeB;
    }
    if (selectedSort === 'priority') {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
    }
    if (selectedSort === 'title') {
      return a.title.localeCompare(b.title);
    }
    if (selectedSort === 'status') {
      const statusOrder = { pending: 0, submitted: 1, graded: 2 };
      return (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0);
    }
    return 0;
  });

  // Group filtered tasks
  const pendingTasks = filteredTasks.filter((t) => t.status === 'pending');
  const submittedTasks = filteredTasks.filter((t) => t.status === 'submitted');
  const gradedTasks = filteredTasks.filter((t) => t.status === 'graded');

  const getComponentsForSubject = (subId: string) => {
    const subj = subjects.find((s: any) => s.id === subId);
    if (!subj || !subj.periods) return [];
    const list: any[] = [];
    subj.periods.forEach((p: any) => {
      if (p.components) {
        p.components.forEach((c: any) => {
          list.push({ id: c.id, label: `${p.name} - ${c.name}` });
        });
      }
    });
    return list;
  };

  const syncGradeItem = (subject: any, task: any) => {
    if (!subject || !subject.periods || !Array.isArray(subject.periods)) return;

    if (task.gradeItemId && (task.status !== 'graded' || !task.linkedComponentId)) {
      subject.periods.forEach((p: any) => {
        (p.components || []).forEach((c: any) => {
          if (c.items) {
            c.items = c.items.filter((it: any) => it.id !== task.gradeItemId);
          }
        });
      });
      task.gradeItemId = undefined;
    }

    if (task.status === 'graded' && task.linkedComponentId) {
      let found = false;
      subject.periods.forEach((p: any) => {
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
              const newGradeId = task.gradeItemId || generateId();
              task.gradeItemId = newGradeId;
              c.items.push({
                id: newGradeId,
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
        });
      });
    }
  };

  const handleSaveTask = async (formData: {
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
    if (!formData.title || !formData.subjectId) {
      AlertService.alert('Missing Fields', 'Please enter a title and select a subject.');
      return;
    }

    const nd = JSON.parse(JSON.stringify(data));
    const yr = nd.years.find((y: any) => y.id === activeYearId);
    const sem = yr?.semesters.find((s: any) => s.id === activeSemId);
    const subject = sem?.subjects.find((s: any) => s.id === formData.subjectId);

    if (!subject) {
      AlertService.alert('Subject Missing', 'Please select a valid subject to save this task.');
      return;
    }

    const dateStr = formData.dueDate.toISOString();
    const earnedNum = sanitizeScore(formData.earnedScore, 0, false);
    const maxNum = sanitizeScore(formData.maxScore, 100, true);

    const taskObj: any = {
      id: editingTask ? editingTask.id : generateId(),
      title: formData.title,
      description: formData.description,
      dueDate: dateStr,
      priority: formData.priority,
      status: formData.status,
      linkedComponentId: formData.linkedComponentId || null,
      earnedScore: formData.status === 'graded' ? earnedNum : undefined,
      maxScore: formData.status === 'graded' ? maxNum : undefined,
      gradeItemId: editingTask ? editingTask.gradeItemId : undefined,
      checklist: formData.checklist || [],
    };

    // If shifting subject
    if (editingTask && editingTask.subjectId !== formData.subjectId) {
      const oldSubject = sem.subjects.find((s: any) => s.id === editingTask.subjectId);
      if (oldSubject && oldSubject.requirements) {
        if (editingTask.gradeItemId && oldSubject.periods) {
          oldSubject.periods.forEach((p: any) => {
            (p.components || []).forEach((c: any) => {
              if (c.items) {
                c.items = c.items.filter((it: any) => it.id !== editingTask.gradeItemId);
              }
            });
          });
        }
        oldSubject.requirements = oldSubject.requirements.filter((r: any) => r.id !== editingTask.id);
      }
    }

    syncGradeItem(subject, taskObj);

    if (!subject.requirements) subject.requirements = [];
    if (editingTask && editingTask.subjectId === formData.subjectId) {
      subject.requirements = subject.requirements.map((r: any) => (r.id === editingTask.id ? taskObj : r));
    } else {
      const existingIdx = subject.requirements.findIndex((r: any) => r.id === taskObj.id);
      if (existingIdx >= 0) {
        subject.requirements[existingIdx] = taskObj;
      } else {
        subject.requirements.push(taskObj);
      }
    }

    setShowAddModal(false);
    setEditingTask(null);
    await saveData(nd);
  };

  const handleDeleteTask = (task: TaskItem) => {
    AlertService.alert('Delete Task', 'Are you sure you want to delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const nd = JSON.parse(JSON.stringify(data));
          const yr = nd.years.find((y: any) => y.id === activeYearId);
          const sem = yr?.semesters.find((s: any) => s.id === activeSemId);
          const subject = sem?.subjects.find((s: any) => s.id === task.subjectId);
          if (subject) {
            if (task.gradeItemId && subject.periods) {
              subject.periods.forEach((p: any) => {
                (p.components || []).forEach((c: any) => {
                  if (c.items) {
                    c.items = c.items.filter((it: any) => it.id !== task.gradeItemId);
                  }
                });
              });
            }
            subject.requirements = (subject.requirements || []).filter((r: any) => r.id !== task.id);
            await saveData(nd);
          }
        },
      },
    ]);
  };

  const openAddModal = () => {
    if (!activeYearId || !activeSemId) {
      AlertService.alert(
        'No Term Selected',
        'Please select or create an academic term (Year & Semester) before adding a task.'
      );
      return;
    }
    if (!subjects || subjects.length === 0) {
      AlertService.alert(
        'No Subjects Found',
        'Please add at least one subject to this semester before creating a task.'
      );
      return;
    }
    setEditingTask(null);
    setShowAddModal(true);
  };

  const openEditModal = (task: TaskItem) => {
    setEditingTask(task);
    setShowAddModal(true);
  };

  const handleQuickStatusChange = async (task: TaskItem, nextStatus: 'pending' | 'submitted' | 'graded') => {
    if (nextStatus === 'graded') {
      openEditModal({ ...task, status: 'graded' });
      return;
    }

    const nd = JSON.parse(JSON.stringify(data));
    const yr = nd.years.find((y: any) => y.id === activeYearId);
    const sem = yr?.semesters.find((s: any) => s.id === activeSemId);
    const subject = sem?.subjects.find((s: any) => s.id === task.subjectId);

    if (!subject) return;

    const updatedTask = {
      ...task,
      status: nextStatus,
    };

    syncGradeItem(subject, updatedTask);

    subject.requirements = subject.requirements.map((r: any) => (r.id === task.id ? updatedTask : r));
    await saveData(nd);
  };

  const handleUpdateChecklist = async (task: TaskItem, newChecklist: ChecklistItem[]) => {
    const nd = JSON.parse(JSON.stringify(data));
    const yr = nd.years.find((y: any) => y.id === activeYearId);
    const sem = yr?.semesters.find((s: any) => s.id === activeSemId);
    const subject = sem?.subjects.find((s: any) => s.id === task.subjectId);
    if (!subject) return;

    const updatedTask = {
      ...task,
      checklist: newChecklist,
    };

    subject.requirements = subject.requirements.map((r: any) => (r.id === task.id ? updatedTask : r));
    await saveData(nd);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* App Bar / Header Island */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 14,
          zIndex: 10,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? theme.cardBorder : '#e2e8f0',
          backgroundColor: theme.surface,
          ...Shadows.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12 }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
              backgroundColor: isDark ? 'rgba(79, 70, 229, 0.2)' : '#e0e7ff',
            }}
          >
            <Ionicons name="checkbox-outline" size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ ...Typography.title, color: theme.text }}>
              Tasks & Tracker
            </Text>
            <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 11, color: theme.textTertiary }}>
              {allTasks.length} {allTasks.length === 1 ? 'task' : 'tasks'} in current term
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {syncStatus === 'syncing' && <Ionicons name="cloud-upload" size={22} color={theme.textTertiary} />}
          {syncStatus === 'saved' && <Ionicons name="cloud-done" size={22} color={theme.success} />}
          {(syncStatus === 'error' || syncStatus === 'offline') && <Ionicons name="cloud-offline" size={22} color={theme.textTertiary} />}

          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Create new task"
            onPress={() => {
              triggerHaptic('light');
              openAddModal();
            }}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.primary,
              ...Shadows.md,
            }}
          >
            <Ionicons name="add" size={24} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={() => {
              triggerHaptic('light');
              router.push('/(tabs)/profile');
            }}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
              borderWidth: 1,
              borderColor: isDark ? theme.cardBorder : '#e2e8f0',
            }}
          >
            <Ionicons name="settings-outline" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Scroll Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
      >
        {/* Academic Term Selector Tabs */}
        {data.years.length > 0 ? (
          <View style={{ marginBottom: 16 }}>
            <Tabs years={data.years} activeYearId={activeYearId} activeSemId={activeSemId} />
          </View>
        ) : (
          <View style={{ paddingVertical: 24, alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontFamily: 'Nunito_600SemiBold', textAlign: 'center', color: theme.textTertiary }}>
              Set up Year and Semester in Academic Manager first.
            </Text>
          </View>
        )}

        {/* 1. Pomodoro Focus Station Island Widget (R1) */}
        <PomodoroCard />

        {/* 2. Task Progress & Overview Island (R1 & R2) */}
        <TaskProgressIsland tasks={allTasks} nowMs={now} />

        {/* 3. Task Filter & Search Controls (R2) */}
        <TaskFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          subjects={subjects}
          selectedSubjectId={selectedSubjectFilter}
          onSelectSubject={setSelectedSubjectFilter}
          selectedStatus={selectedStatusFilter}
          onSelectStatus={setSelectedStatusFilter}
          selectedSort={selectedSort}
          onSelectSort={setSelectedSort}
          countsBySubject={countsBySubject}
          countsByStatus={countsByStatus}
        />

        {/* 4. Task Cards / Sections (R1, R2, R3) */}
        {subjects.length === 0 ? (
          <EmptyState
            title="No Subjects Found"
            subtitle="Please create a subject in Academic Manager or Grade Tracker before adding tasks."
            actionLabel="Go to Grades"
            onAction={() => router.push('/(tabs)/grades')}
          />
        ) : filteredTasks.length === 0 ? (
          <EmptyState
            title="No Tasks Match"
            subtitle={
              searchQuery.trim()
                ? `No tasks found matching "${searchQuery}". Try clearing search.`
                : 'No tasks found for the selected subject or status filter.'
            }
            actionLabel="Create a Task"
            onAction={openAddModal}
          />
        ) : selectedStatusFilter !== 'all' ? (
          /* Filtered Single List View */
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ ...Typography.heading, fontSize: 20, color: theme.text }}>
                {selectedStatusFilter.charAt(0).toUpperCase() + selectedStatusFilter.slice(1)} Tasks
              </Text>
              <View
                style={{
                  marginLeft: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 10,
                  backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
                }}
              >
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textSecondary }}>
                  {filteredTasks.length}
                </Text>
              </View>
            </View>

            {filteredTasks.map((t, idx) => (
              <FadeInTaskCard key={t.id} index={idx}>
                <TaskIslandCard
                  task={t}
                  nowMs={now}
                  onEdit={openEditModal}
                  onDelete={handleDeleteTask}
                  onStatusChange={handleQuickStatusChange}
                  onUpdateChecklist={handleUpdateChecklist}
                />
              </FadeInTaskCard>
            ))}
          </View>
        ) : (
          /* Standard 3-Section Grouped View (Pending, Submitted, Graded) */
          <View>
            {/* Pending Section */}
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ backgroundColor: '#f59e0b', width: 10, height: 10, borderRadius: 5, marginRight: 8 }} />
                  <Text style={{ ...Typography.heading, fontSize: 18, color: theme.text }}>Pending Tasks</Text>
                  <View
                    style={{
                      marginLeft: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 10,
                      backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
                    }}
                  >
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textSecondary }}>
                      {pendingTasks.length}
                    </Text>
                  </View>
                </View>
              </View>

              {pendingTasks.length === 0 ? (
                <View
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
                    borderWidth: 1,
                    borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: theme.textTertiary }}>
                    ✨ No pending tasks right now. Great job staying ahead!
                  </Text>
                </View>
              ) : (
                pendingTasks.map((t, idx) => (
                  <FadeInTaskCard key={t.id} index={idx}>
                    <TaskIslandCard
                      task={t}
                      nowMs={now}
                      onEdit={openEditModal}
                      onDelete={handleDeleteTask}
                      onStatusChange={handleQuickStatusChange}
                      onUpdateChecklist={handleUpdateChecklist}
                    />
                  </FadeInTaskCard>
                ))
              )}
            </View>

            {/* Submitted Section */}
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ backgroundColor: theme.primary, width: 10, height: 10, borderRadius: 5, marginRight: 8 }} />
                  <Text style={{ ...Typography.heading, fontSize: 18, color: theme.text }}>Submitted Tasks</Text>
                  <View
                    style={{
                      marginLeft: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 10,
                      backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
                    }}
                  >
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textSecondary }}>
                      {submittedTasks.length}
                    </Text>
                  </View>
                </View>
              </View>

              {submittedTasks.length === 0 ? (
                <View
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
                    borderWidth: 1,
                    borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: theme.textTertiary }}>
                    No submitted tasks awaiting grading.
                  </Text>
                </View>
              ) : (
                submittedTasks.map((t, idx) => (
                  <FadeInTaskCard key={t.id} index={idx + pendingTasks.length}>
                    <TaskIslandCard
                      task={t}
                      nowMs={now}
                      onEdit={openEditModal}
                      onDelete={handleDeleteTask}
                      onStatusChange={handleQuickStatusChange}
                      onUpdateChecklist={handleUpdateChecklist}
                    />
                  </FadeInTaskCard>
                ))
              )}
            </View>

            {/* Graded Section */}
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ backgroundColor: theme.success, width: 10, height: 10, borderRadius: 5, marginRight: 8 }} />
                  <Text style={{ ...Typography.heading, fontSize: 18, color: theme.text }}>Graded Tasks</Text>
                  <View
                    style={{
                      marginLeft: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 10,
                      backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
                    }}
                  >
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textSecondary }}>
                      {gradedTasks.length}
                    </Text>
                  </View>
                </View>
              </View>

              {gradedTasks.length === 0 ? (
                <View
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
                    borderWidth: 1,
                    borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: theme.textTertiary }}>
                    No graded tasks yet.
                  </Text>
                </View>
              ) : (
                gradedTasks.map((t, idx) => (
                  <FadeInTaskCard key={t.id} index={idx + pendingTasks.length + submittedTasks.length}>
                    <TaskIslandCard
                      task={t}
                      nowMs={now}
                      onEdit={openEditModal}
                      onDelete={handleDeleteTask}
                      onStatusChange={handleQuickStatusChange}
                      onUpdateChecklist={handleUpdateChecklist}
                    />
                  </FadeInTaskCard>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add / Edit Task Modal Form */}
      <TaskFormModal
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        editingTask={editingTask}
        subjects={subjects}
        getComponentsForSubject={getComponentsForSubject}
        initialSubjectId={selectedSubjectFilter !== 'ALL' ? selectedSubjectFilter : undefined}
      />
    </SafeAreaView>
  );
}
