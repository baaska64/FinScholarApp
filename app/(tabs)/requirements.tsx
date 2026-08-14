import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabaseClient';
import { SyncService } from '@/services/SyncService';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import Tabs from '@/components/ledger/Tabs';
import { AlertService } from '@/components/CustomAlert';
import { useSemesterContext } from '@/components/SemesterContext';
import { getTheme, Typography, Radius, Shadows, Spacing } from '@/constants/Theme';
import { ListSkeleton } from '@/components/ui/LoadingSkeleton';
import Badge from '@/components/ui/Badge';

/** Staggered fade-in wrapper for task cards */
const FadeInTaskCard = ({ index, children }: { index: number; children: React.ReactNode }) => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const timer = setTimeout(() => {
            Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }).start();
        }, index * 80);
        return () => clearTimeout(timer);
    }, []);
    return (
        <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
            {children}
        </Animated.View>
    );
};

/** Returns urgency color based on time left */
const getUrgencyColor = (timeLeftText: string, isDark: boolean) => {
    if (timeLeftText === 'Overdue') return { bg: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2', text: '#ef4444', icon: '#ef4444' };
    if (timeLeftText.includes('s left') || timeLeftText.includes('m ')) return { bg: isDark ? 'rgba(249,115,22,0.15)' : '#fff7ed', text: '#f97316', icon: '#f97316' };
    if (timeLeftText.includes('hr')) return { bg: isDark ? 'rgba(245,158,11,0.15)' : '#fffbeb', text: '#f59e0b', icon: '#f59e0b' };
    return { bg: isDark ? 'rgba(34,197,94,0.12)' : '#f0fdf4', text: isDark ? '#4ade80' : '#16a34a', icon: isDark ? '#4ade80' : '#16a34a' };
};

const generateId = () => Math.random().toString(36).substr(2, 9);

const formatAMPM = (date: Date) => {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
};

const getTimeLeftText = (dueDateIso: string, nowMs: number) => {
    const isOldFormat = !dueDateIso.includes('T');
    let dueTime = 0;
    if (isOldFormat) {
        const parts = dueDateIso.split('-');
        dueTime = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59).getTime();
    } else {
        dueTime = new Date(dueDateIso).getTime();
    }
    
    const diff = dueTime - nowMs;
    if (diff <= 0) return 'Overdue';

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days >= 1) return `${days} day${days > 1 ? 's' : ''} left`;
    if (hours >= 1) return `${hours} hr${hours > 1 ? 's' : ''} ${minutes % 60} min${minutes % 60 !== 1 ? 's' : ''} left`;
    if (minutes >= 1) return `${minutes}m ${seconds % 60}s left`;
    return `${seconds}s left`;
};

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

    useEffect(() => {
        if (params.subjectId && typeof params.subjectId === 'string') {
            setSelectedSubjectFilter(params.subjectId);
        }
    }, [params.subjectId]);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingTask, setEditingTask] = useState<any>(null);

    // Form
    const [form, setForm] = useState({
        title: '',
        description: '',
        dueDate: new Date(),
        priority: 'medium' as 'low' | 'medium' | 'high',
        status: 'pending' as 'pending' | 'submitted' | 'graded',
        subjectId: '',
        linkedComponentId: '',
        earnedScore: '',
        maxScore: '100'
    });
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(timer);
    }, []);

    // Pomodoro Timer State
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isRunning, setIsRunning] = useState(false);
    const [timerMode, setTimerMode] = useState<'focus' | 'break'>('focus');

    // Load user auth session
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
            if (!s.subjects) s.subjects = [];
            s.subjects.forEach((subj: any) => {
                if (!subj.requirements) subj.requirements = [];
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

    const saveData = async (newData: any) => {
        setData(newData);
        SyncService.pushLocalChanges(newData);
    };

    // Pomodoro timer hook
    useEffect(() => {
        let interval: any = null;
        if (isRunning && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && isRunning) {
            setIsRunning(false);
            AlertService.alert(
                timerMode === 'focus' ? "Focus Done!" : "Break Done!",
                timerMode === 'focus' ? "Great job! Time for a short break." : "Break is over! Ready to focus?"
            );
        }
        return () => clearInterval(interval);
    }, [isRunning, timeLeft, timerMode]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    if (!data) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
                <ListSkeleton count={4} cardHeight={90} />
            </SafeAreaView>
        );
    }

    const currentYear = data.years.find((y: any) => y.id === activeYearId);
    const currentSem = currentYear?.semesters.find((s: any) => s.id === activeSemId);
    const subjects = currentSem?.subjects || [];

    // Aggregate tasks
    let allTasks: any[] = [];
    subjects.forEach((subj: any) => {
        if (subj.requirements) {
            subj.requirements.forEach((req: any) => {
                allTasks.push({ ...req, subjectName: subj.name, subjectId: subj.id });
            });
        }
    });

    // Filter tasks
    const filteredTasks = selectedSubjectFilter === 'ALL' 
        ? allTasks 
        : allTasks.filter(t => t.subjectId === selectedSubjectFilter);

    // Group tasks
    const pendingTasks = filteredTasks.filter(t => t.status === 'pending');
    const submittedTasks = filteredTasks.filter(t => t.status === 'submitted');
    const gradedTasks = filteredTasks.filter(t => t.status === 'graded');

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
        // Always run a complete cleanup pass across all periods and components of the subject
        // to filter out any grade items with it.id === task.gradeItemId BEFORE inserting/updating it in the target component.
        if (task.gradeItemId) {
            subject.periods.forEach((p: any) => {
                p.components.forEach((c: any) => {
                    c.items = c.items.filter((it: any) => it.id !== task.gradeItemId);
                });
            });
        }

        // First, if task has an old gradeItemId but is no longer graded or no longer linked, remove it
        if (task.gradeItemId && (task.status !== 'graded' || !task.linkedComponentId)) {
            task.gradeItemId = undefined;
        }

        // Sync or insert
        if (task.status === 'graded' && task.linkedComponentId) {
            let found = false;
            subject.periods.forEach((p: any) => {
                p.components.forEach((c: any) => {
                    if (c.id === task.linkedComponentId) {
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
                                subItems: []
                            });
                        }
                    }
                });
            });
        }
    };

    const handleSaveTask = async () => {
        if (!form.title || !form.subjectId) {
            AlertService.alert("Missing Fields", "Please enter a title and select a subject.");
            return;
        }

        const nd = JSON.parse(JSON.stringify(data));
        const yr = nd.years.find((y: any) => y.id === activeYearId);
        const sem = yr?.semesters.find((s: any) => s.id === activeSemId);
        const subject = sem?.subjects.find((s: any) => s.id === form.subjectId);

        if (!subject) {
            AlertService.alert("Subject Missing", "Please select a valid subject to save this task.");
            return;
        }

        const dateStr = form.dueDate.toISOString();

        const taskObj = {
            id: editingTask ? editingTask.id : generateId(),
            title: form.title,
            description: form.description,
            dueDate: dateStr,
            priority: form.priority,
            status: form.status,
            linkedComponentId: form.linkedComponentId || null,
            earnedScore: form.status === 'graded' ? Number(form.earnedScore) || 0 : undefined,
            maxScore: form.status === 'graded' ? Number(form.maxScore) || 100 : undefined,
            gradeItemId: editingTask ? editingTask.gradeItemId : undefined
        };

        // If shifting subject
        if (editingTask && editingTask.subjectId !== form.subjectId) {
            const oldSubject = sem.subjects.find((s: any) => s.id === editingTask.subjectId);
            if (oldSubject && oldSubject.requirements) {
                if (editingTask.gradeItemId) {
                    oldSubject.periods.forEach((p: any) => {
                        p.components.forEach((c: any) => {
                            c.items = c.items.filter((it: any) => it.id !== editingTask.gradeItemId);
                        });
                    });
                }
                oldSubject.requirements = oldSubject.requirements.filter((r: any) => r.id !== editingTask.id);
            }
        }

        syncGradeItem(subject, taskObj);

        if (!subject.requirements) subject.requirements = [];
        if (editingTask && editingTask.subjectId === form.subjectId) {
            subject.requirements = subject.requirements.map((r: any) => r.id === editingTask.id ? taskObj : r);
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

    const handleDeleteTask = (task: any) => {
        AlertService.alert("Delete Task", "Are you sure you want to delete this task?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    const nd = JSON.parse(JSON.stringify(data));
                    const yr = nd.years.find((y: any) => y.id === activeYearId);
                    const sem = yr?.semesters.find((s: any) => s.id === activeSemId);
                    const subject = sem?.subjects.find((s: any) => s.id === task.subjectId);
                    if (subject) {
                        if (task.gradeItemId) {
                            subject.periods.forEach((p: any) => {
                                p.components.forEach((c: any) => {
                                    c.items = c.items.filter((it: any) => it.id !== task.gradeItemId);
                                });
                            });
                        }
                        subject.requirements = subject.requirements.filter((r: any) => r.id !== task.id);
                        await saveData(nd);
                    }
                }
            }
        ]);
    };

    const openAddModal = () => {
        if (!activeYearId || !activeSemId) {
            AlertService.alert("No Term Selected", "Please select or create an academic term (Year & Semester) before adding a task.");
            return;
        }
        if (!subjects || subjects.length === 0) {
            AlertService.alert("No Subjects Found", "Please add at least one subject to this semester before creating a task.");
            return;
        }

        const defaultDate = new Date();
        defaultDate.setHours(23, 59, 59, 0);
        setForm({
            title: '',
            description: '',
            dueDate: defaultDate,
            priority: 'medium',
            status: 'pending',
            subjectId: subjects[0]?.id || '',
            linkedComponentId: '',
            earnedScore: '',
            maxScore: '100'
        });
        setEditingTask(null);
        setShowAddModal(true);
    };

    const openEditModal = (task: any) => {
        const parsedDate = task.dueDate.includes('T') 
            ? new Date(task.dueDate)
            : (() => {
                const parts = task.dueDate.split('-');
                return parts.length === 3 
                    ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59)
                    : new Date(task.dueDate)
            })();

        setForm({
            title: task.title,
            description: task.description || '',
            dueDate: parsedDate,
            priority: task.priority,
            status: task.status,
            subjectId: task.subjectId,
            linkedComponentId: task.linkedComponentId || '',
            earnedScore: task.earnedScore !== undefined ? String(task.earnedScore) : '',
            maxScore: task.maxScore !== undefined ? String(task.maxScore) : '100'
        });
        setEditingTask(task);
        setShowAddModal(true);
    };

    const handleQuickStatusChange = async (task: any, nextStatus: 'pending' | 'submitted' | 'graded') => {
        if (nextStatus === 'graded') {
            // open edit modal so they can input scores
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
            status: nextStatus
        };

        syncGradeItem(subject, updatedTask);

        subject.requirements = subject.requirements.map((r: any) => r.id === task.id ? updatedTask : r);
        await saveData(nd);
    };

    const renderTaskCard = (task: any, index: number = 0) => {
        const isOldFormat = !task.dueDate.includes('T');
        let d = new Date();
        if (isOldFormat) {
            const parts = task.dueDate.split('-');
            if (parts.length === 3) {
                d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59);
            }
        } else {
            d = new Date(task.dueDate);
        }
        
        let displayDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        let displayTime = formatAMPM(d);
        let timeLeft = getTimeLeftText(task.dueDate, now);
        const urgency = getUrgencyColor(timeLeft, isDark);

        const priorityVariant = task.priority === 'high' ? 'high' : task.priority === 'low' ? 'low' : 'medium';

        return (
            <FadeInTaskCard key={task.id} index={index}>
            <View 
                style={{
                    padding: 16, borderRadius: 20, marginBottom: 12,
                    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.cardBorder,
                    ...(!isDark ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 } : {}),
                }}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 15, color: theme.text }}>{task.title}</Text>
                        {task.description ? (
                            <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, marginTop: 4, color: theme.textSecondary }}>{task.description}</Text>
                        ) : null}
                        
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 10, gap: 6 }}>
                            <Badge label={task.subjectName} variant="info" />
                            <Badge label={`${task.priority} priority`} variant={priorityVariant as any} />
                            {task.linkedComponentId ? (
                                <Badge label="Linked" variant="success" />
                            ) : null}
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                            <Ionicons name="calendar-outline" size={12} color={theme.textTertiary} />
                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 10, marginLeft: 4, marginRight: 12, color: theme.textSecondary }}>
                                {displayDate} at {displayTime}
                            </Text>
                            {task.status === 'pending' && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: urgency.bg }}>
                                    <Ionicons name="time-outline" size={10} color={urgency.icon} />
                                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 9, marginLeft: 4, color: urgency.text }}>{timeLeft}</Text>
                                </View>
                            )}
                        </View>

                        {task.status === 'graded' && task.earnedScore !== undefined ? (
                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, marginTop: 8, color: theme.success }}>
                                Score: {task.earnedScore} / {task.maxScore}
                            </Text>
                        ) : null}
                    </View>
                    
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity onPress={() => openEditModal(task)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="pencil" size={16} color={theme.textTertiary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteTask(task)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="trash" size={16} color={theme.error} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Transition Action Buttons */}
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.cardBorder, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                    {task.status === 'pending' && (
                        <TouchableOpacity 
                            onPress={() => handleQuickStatusChange(task, 'submitted')}
                            style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: theme.primary, flexDirection: 'row', alignItems: 'center' }}
                        >
                            <Ionicons name="checkmark-circle-outline" size={12} color="white" />
                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 10, color: 'white', marginLeft: 4 }}>Submit Task</Text>
                        </TouchableOpacity>
                    )}
                    {task.status === 'submitted' && (
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity 
                                onPress={() => handleQuickStatusChange(task, 'pending')}
                                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: theme.cardBorder }}
                            >
                                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 10, color: theme.textSecondary }}>Unsubmit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => handleQuickStatusChange(task, 'graded')}
                                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: theme.success, flexDirection: 'row', alignItems: 'center' }}
                            >
                                <Ionicons name="ribbon-outline" size={12} color="white" />
                                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 10, color: 'white', marginLeft: 4 }}>Grade Task</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    {task.status === 'graded' && (
                        <TouchableOpacity 
                            onPress={() => handleQuickStatusChange(task, 'submitted')}
                            style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: theme.cardBorder }}
                        >
                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 10, color: theme.textSecondary }}>Move to Submitted</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
            </FadeInTaskCard>
        );
    };

    const activeComponentsList = form.subjectId ? getComponentsForSubject(form.subjectId) : [];

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            {/* Header */}
            <View style={{
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                paddingHorizontal: 16, paddingVertical: 16, zIndex: 10,
                borderBottomWidth: 1, borderBottomColor: isDark ? theme.cardBorder : '#f1f5f9',
                backgroundColor: theme.surface,
                ...(!isDark ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 } : {}),
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: isDark ? 'rgba(37,99,235,0.2)' : '#dbeafe' }}>
                        <Ionicons name="list" size={20} color={isDark ? '#60a5fa' : '#3b82f6'} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ ...Typography.title, color: theme.text }}>Tasks & Tracker</Text>
                    </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {syncStatus === 'syncing' && <Ionicons name="cloud-upload" size={22} color={theme.textTertiary} />}
                    {syncStatus === 'saved' && <Ionicons name="cloud-done" size={22} color={theme.success} />}
                    {(syncStatus === 'error' || syncStatus === 'offline') && <Ionicons name="cloud-offline" size={22} color={theme.textTertiary} />}
                    
                    <TouchableOpacity onPress={openAddModal} style={{
                        width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: theme.primary,
                        ...(!isDark ? { shadowColor: theme.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 } : {}),
                    }}>
                        <Ionicons name="add" size={24} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => router.push('/(tabs)/profile')} 
                        style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9' }}
                    >
                        <Ionicons name="settings-outline" size={22} color={isDark ? '#cbd5e1' : '#475569'} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView className="flex-1 px-6 pt-4" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false} removeClippedSubviews={true}>
                {/* Academic Selector */}
                {data.years.length > 0 ? (
                    <Tabs 
                        years={data.years} 
                        activeYearId={activeYearId} 
                        activeSemId={activeSemId} 
                    />
                ) : (
                    <View className="py-8 items-center">
                        <Text className={`font-nunito text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Set up Year and Semester in academic manager first.</Text>
                    </View>
                )}

                {/* Pomodoro Timer Widget */}
                <View className={`p-4 rounded-[28px] mt-4 mb-6 border ${isDark ? 'bg-slate-900 border-indigo-500/20 shadow-slate-950' : 'bg-white border-indigo-100/70 shadow-indigo-100/30'} shadow-md`}>
                    <View className="flex-row items-center justify-between mb-4">
                        <Text className={`font-nunito-black text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>Fin's Focus Station</Text>
                        <TouchableOpacity 
                            onPress={() => {
                                const nextMode = timerMode === 'focus' ? 'break' : 'focus';
                                setTimerMode(nextMode);
                                setTimeLeft(nextMode === 'focus' ? 25 * 60 : 5 * 60);
                                setIsRunning(false);
                            }}
                            className={`px-3 py-1.5 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                        >
                            <Text className={`font-nunito-bold text-[10px] ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                                Switch to {timerMode === 'focus' ? 'Break' : 'Focus'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View className="flex-row items-center">
                        <Image 
                            source={
                                isRunning 
                                    ? require('../../assets/images/studying.png') 
                                    : (timeLeft === 0 
                                        ? require('../../assets/images/happy.png') 
                                        : require('../../assets/images/sleeping.png')
                                      )
                            }
                            className="w-16 h-16 mr-4"
                            resizeMode="contain"
                        />

                        <View className="flex-1">
                            <Text className={`font-nunito-black text-3xl mb-0.5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                                {formatTime(timeLeft)}
                            </Text>
                            <Text className={`font-nunito text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {isRunning 
                                    ? "Fin is studying hard with you!" 
                                    : (timeLeft === 0 
                                        ? "Session complete! Fin is proud of you." 
                                        : "Fin is sleeping. Tap Start to focus!"
                                      )
                                }
                            </Text>

                            <View className="flex-row" style={{ gap: 8 }}>
                                <TouchableOpacity 
                                    onPress={() => setIsRunning(!isRunning)}
                                    className={`px-4 py-2 rounded-xl flex-row items-center ${isRunning ? 'bg-amber-500' : 'bg-green-500'}`}
                                >
                                    <Ionicons name={isRunning ? "pause" : "play"} size={14} color="white" />
                                    <Text className="font-nunito-bold text-white ml-1 text-xs">{isRunning ? 'Pause' : 'Start'}</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    onPress={() => {
                                        setIsRunning(false);
                                        setTimeLeft(timerMode === 'focus' ? 25 * 60 : 5 * 60);
                                    }}
                                    className={`px-4 py-2 rounded-xl bg-slate-500 flex-row items-center`}
                                >
                                    <Ionicons name="refresh" size={14} color="white" />
                                    <Text className="font-nunito-bold text-white ml-1 text-xs">Reset</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Subject Filter Chips */}
                {subjects.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity 
                                onPress={() => setSelectedSubjectFilter('ALL')}
                                style={{
                                    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1,
                                    backgroundColor: selectedSubjectFilter === 'ALL' ? theme.primary : theme.card,
                                    borderColor: selectedSubjectFilter === 'ALL' ? theme.primary : theme.cardBorder,
                                    ...(!isDark && selectedSubjectFilter === 'ALL' ? { shadowColor: theme.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 } : {}),
                                }}
                            >
                                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: selectedSubjectFilter === 'ALL' ? '#fff' : theme.textSecondary }}>
                                    All Subjects
                                </Text>
                            </TouchableOpacity>
                            {subjects.map((sub: any) => (
                                <TouchableOpacity 
                                    key={sub.id}
                                    onPress={() => setSelectedSubjectFilter(sub.id)}
                                    style={{
                                        paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1,
                                        backgroundColor: selectedSubjectFilter === sub.id ? theme.primary : theme.card,
                                        borderColor: selectedSubjectFilter === sub.id ? theme.primary : theme.cardBorder,
                                        ...(!isDark && selectedSubjectFilter === sub.id ? { shadowColor: theme.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 } : {}),
                                    }}
                                >
                                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: selectedSubjectFilter === sub.id ? '#fff' : theme.textSecondary }}>
                                        {sub.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                ) : null}

                {/* Tasks List grouped by Status */}
                {subjects.length === 0 ? (
                    <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                        <Ionicons name="document-text-outline" size={48} color={theme.textTertiary} />
                        <Text style={{ fontFamily: 'Nunito_700Bold', marginTop: 16, textAlign: 'center', color: theme.textSecondary }}>
                            No subjects found in this term. Create one in Grade Tracker or Academic Manager first!
                        </Text>
                    </View>
                ) : (
                    <View>
                        {/* Pending Section */}
                        <View style={{ marginBottom: 20 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <View style={{ backgroundColor: '#f59e0b', width: 10, height: 10, borderRadius: 5, marginRight: 8 }} />
                                <Text style={{ ...Typography.heading, color: theme.text }}>Pending Tasks</Text>
                                <View style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9' }}>
                                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textSecondary }}>{pendingTasks.length}</Text>
                                </View>
                            </View>
                            {pendingTasks.length === 0 ? (
                                <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, fontStyle: 'italic', color: theme.textTertiary, marginLeft: 16 }}>No pending tasks.</Text>
                            ) : (
                                pendingTasks.map((t, i) => renderTaskCard(t, i))
                            )}
                        </View>

                        {/* Submitted Section */}
                        <View style={{ marginBottom: 20 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <View style={{ backgroundColor: theme.primary, width: 10, height: 10, borderRadius: 5, marginRight: 8 }} />
                                <Text style={{ ...Typography.heading, color: theme.text }}>Submitted Tasks</Text>
                                <View style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9' }}>
                                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textSecondary }}>{submittedTasks.length}</Text>
                                </View>
                            </View>
                            {submittedTasks.length === 0 ? (
                                <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, fontStyle: 'italic', color: theme.textTertiary, marginLeft: 16 }}>No submitted tasks.</Text>
                            ) : (
                                submittedTasks.map((t, i) => renderTaskCard(t, i + pendingTasks.length))
                            )}
                        </View>

                        {/* Graded Section */}
                        <View style={{ marginBottom: 20 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <View style={{ backgroundColor: theme.success, width: 10, height: 10, borderRadius: 5, marginRight: 8 }} />
                                <Text style={{ ...Typography.heading, color: theme.text }}>Graded Tasks</Text>
                                <View style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9' }}>
                                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textSecondary }}>{gradedTasks.length}</Text>
                                </View>
                            </View>
                            {gradedTasks.length === 0 ? (
                                <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, fontStyle: 'italic', color: theme.textTertiary, marginLeft: 16 }}>No graded tasks.</Text>
                            ) : (
                                gradedTasks.map((t, i) => renderTaskCard(t, i + pendingTasks.length + submittedTasks.length))
                            )}
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Add / Edit Task Modal */}
            <Modal visible={showAddModal} transparent animationType="slide">
                <View className="flex-1 justify-end bg-black/60">
                    <View className={`rounded-t-3xl p-6 h-[80%] ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className={`font-nunito-black text-xl ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                {editingTask ? 'Edit Task' : 'Add Task'}
                            </Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                            {/* Title */}
                            <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Task Title</Text>
                            <TextInput
                                className={`p-4 rounded-2xl mb-4 font-nunito border ${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-200'}`}
                                placeholder="e.g. Essay Draft 1"
                                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                                value={form.title}
                                onChangeText={t => setForm({ ...form, title: t })}
                            />

                            {/* Description */}
                            <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Description</Text>
                            <TextInput
                                className={`p-4 rounded-2xl mb-4 font-nunito border ${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-200'}`}
                                placeholder="Details about this task..."
                                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                                value={form.description}
                                onChangeText={t => setForm({ ...form, description: t })}
                            />

                            {/* Subject */}
                            <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Subject</Text>
                            <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
                                {subjects.map((sub: any) => (
                                    <TouchableOpacity 
                                        key={sub.id}
                                        onPress={() => setForm({ ...form, subjectId: sub.id, linkedComponentId: '' })}
                                        className={`px-3 py-1.5 rounded-full border ${form.subjectId === sub.id ? 'border-indigo-500 bg-indigo-505/20' : (isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white')}`}
                                    >
                                        <Text className={`font-nunito-bold text-xs ${form.subjectId === sub.id ? 'text-indigo-500' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>{sub.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Linked Component */}
                            {form.subjectId ? (
                                <>
                                    <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Link to Grade Component (Optional)</Text>
                                    {activeComponentsList.length === 0 ? (
                                        <Text className={`font-nunito text-xs italic mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No grading components available for this subject.</Text>
                                    ) : (
                                        <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
                                            <TouchableOpacity 
                                                onPress={() => setForm({ ...form, linkedComponentId: '' })}
                                                className={`px-3 py-1.5 rounded-full border ${!form.linkedComponentId ? 'border-indigo-500 bg-indigo-505/20' : (isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white')}`}
                                            >
                                                <Text className={`font-nunito-bold text-xs ${!form.linkedComponentId ? 'text-indigo-500' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>None</Text>
                                            </TouchableOpacity>
                                            {activeComponentsList.map((comp: any) => (
                                                <TouchableOpacity 
                                                    key={comp.id}
                                                    onPress={() => setForm({ ...form, linkedComponentId: comp.id })}
                                                    className={`px-3 py-1.5 rounded-full border ${form.linkedComponentId === comp.id ? 'border-indigo-500 bg-indigo-505/20' : (isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white')}`}
                                                >
                                                    <Text className={`font-nunito-bold text-xs ${form.linkedComponentId === comp.id ? 'text-indigo-500' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>{comp.label}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </>
                            ) : null}

                            {/* Priority */}
                            <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Priority</Text>
                            <View className="flex-row mb-4" style={{ gap: 8 }}>
                                {['low', 'medium', 'high'].map((p) => (
                                    <TouchableOpacity 
                                        key={p}
                                        onPress={() => setForm({ ...form, priority: p as any })}
                                        className={`px-4 py-2 rounded-full border flex-1 items-center ${form.priority === p ? 'border-indigo-500 bg-indigo-505/20' : (isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white')}`}
                                    >
                                        <Text className={`font-nunito-bold text-xs capitalize ${form.priority === p ? 'text-indigo-500' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>{p}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Status */}
                            <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Status</Text>
                            <View className="flex-row mb-4" style={{ gap: 8 }}>
                                {['pending', 'submitted', 'graded'].map((s) => (
                                    <TouchableOpacity 
                                        key={s}
                                        onPress={() => setForm({ ...form, status: s as any })}
                                        className={`px-4 py-2 rounded-full border flex-1 items-center ${form.status === s ? 'border-indigo-500 bg-indigo-505/20' : (isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white')}`}
                                    >
                                        <Text className={`font-nunito-bold text-xs capitalize ${form.status === s ? 'text-indigo-500' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>{s}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Score Inputs (only if graded and component linked) */}
                            {form.status === 'graded' && form.linkedComponentId ? (
                                <View className="flex-row mb-4" style={{ gap: 8 }}>
                                    <View className="flex-1">
                                        <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Earned Score</Text>
                                        <TextInput
                                            keyboardType="numeric"
                                            className={`p-4 rounded-2xl font-nunito border ${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-200'}`}
                                            placeholder="e.g. 85"
                                            placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                                            value={form.earnedScore}
                                            onChangeText={t => setForm({ ...form, earnedScore: t })}
                                        />
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Max Score</Text>
                                        <TextInput
                                            keyboardType="numeric"
                                            className={`p-4 rounded-2xl font-nunito border ${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-200'}`}
                                            placeholder="e.g. 100"
                                            placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                                            value={form.maxScore}
                                            onChangeText={t => setForm({ ...form, maxScore: t })}
                                        />
                                    </View>
                                </View>
                            ) : null}

                            {/* Due Date & Time */}
                            <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Deadline</Text>
                            <View className="flex-row" style={{ gap: 8 }}>
                                <TouchableOpacity 
                                    onPress={() => setShowDatePicker(true)}
                                    className={`flex-1 p-4 rounded-2xl mb-6 font-nunito border flex-row items-center justify-between ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                                >
                                    <Text className={`font-nunito ${isDark ? 'text-white' : 'text-slate-900'}`}>{form.dueDate.toLocaleDateString()}</Text>
                                    <Ionicons name="calendar" size={18} color={isDark ? '#94a3b8' : '#64748b'} />
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={() => setShowTimePicker(true)}
                                    className={`flex-1 p-4 rounded-2xl mb-6 font-nunito border flex-row items-center justify-between ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                                >
                                    <Text className={`font-nunito ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatAMPM(form.dueDate)}</Text>
                                    <Ionicons name="time" size={18} color={isDark ? '#94a3b8' : '#64748b'} />
                                </TouchableOpacity>
                            </View>

                            {showDatePicker && (
                                <DateTimePicker
                                    value={form.dueDate}
                                    mode="date"
                                    display="default"
                                    onChange={(event, selectedDate) => {
                                        setShowDatePicker(false);
                                        if (selectedDate) {
                                            const newDate = new Date(form.dueDate);
                                            newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                                            setForm({ ...form, dueDate: newDate });
                                        }
                                    }}
                                />
                            )}

                            {showTimePicker && (
                                <DateTimePicker
                                    value={form.dueDate}
                                    mode="time"
                                    display="default"
                                    onChange={(event, selectedDate) => {
                                        setShowTimePicker(false);
                                        if (selectedDate) {
                                            const newDate = new Date(form.dueDate);
                                            newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
                                            setForm({ ...form, dueDate: newDate });
                                        }
                                    }}
                                />
                            )}
                        </ScrollView>

                        <TouchableOpacity 
                            onPress={handleSaveTask}
                            disabled={!form.title || !form.subjectId}
                            className={`w-full py-4 rounded-2xl items-center shadow-lg shadow-indigo-500/30 ${(!form.title || !form.subjectId) ? 'bg-indigo-300' : 'bg-indigo-500'}`}
                        >
                            <Text className="font-nunito-black text-white text-lg">
                                {editingTask ? 'Update Task' : 'Save Task'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
