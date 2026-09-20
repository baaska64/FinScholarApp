import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Animated,
    PanResponder,
    TextInput,
    LayoutAnimation,
    Platform,
    UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import { checklistProgress, getDueBucket } from '@/utils/taskModel';
import type { ChecklistItem, TaskItem } from './types';
import { formatAMPM, getTimeLeftText, parseDueDate, triggerHaptic } from './utils';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface TaskRowProps {
    task: TaskItem;
    nowMs: number;
    onToggleStatus: (task: TaskItem) => void;
    onOpenActions: (task: TaskItem) => void;
    /** Edit stays a visible, one-tap action; delete does not. */
    onEdit: (task: TaskItem) => void;
    onUpdateChecklist?: (task: TaskItem, next: ChecklistItem[]) => void;
    /** Divider above, for every row but the first in its group. */
    showDivider?: boolean;
}

const PRIORITY_COLOR: Record<string, { light: string; dark: string }> = {
    high: { light: '#dc4436', dark: '#f87171' },
    medium: { light: '#e08b12', dark: '#e89b2a' },
    low: { light: '#10a37a', dark: '#2dc597' },
};

/**
 * One task.
 *
 * The old card was ~150pt tall and carried five ways to act on a single row: a
 * status checkbox, a pencil, a trash can, an expand chevron, and two swipe
 * directions. It also printed the priority as a shouty uppercase chip
 * ("MEDIUM PRIORITY") that outweighed the task's own title.
 *
 * What is left is the anatomy of a to-do row: a checkbox that advances the
 * task, the title, one quiet meta line, then **edit** and a `···`. The split is
 * by frequency and by consequence — editing is common and harmless so it stays
 * one tap away; deleting is neither, so it lives in the sheet behind the `···`
 * rather than sitting next to a task's whole history on every row.
 *
 * Priority is a coloured rail; overdue is the only thing allowed to shout.
 * Swipe survives (right advances, left opens actions) and so does the
 * expandable description and checklist.
 */
export default function TaskRow({
    task,
    nowMs,
    onToggleStatus,
    onOpenActions,
    onEdit,
    onUpdateChecklist,
    showDivider,
}: TaskRowProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);

    const [expanded, setExpanded] = useState(false);
    const [draft, setDraft] = useState('');

    const done = task.status === 'submitted' || task.status === 'graded';
    const overdue = !done && getDueBucket(task, nowMs) === 'overdue';
    const due = parseDueDate(task.dueDate);
    const checklist: ChecklistItem[] = Array.isArray(task.checklist) ? task.checklist : [];
    const { done: checkDone, total: checkTotal } = checklistProgress(task);

    const priority = PRIORITY_COLOR[task.priority] || PRIORITY_COLOR.medium;
    const rail = done ? tints.attendance.solid : overdue ? tints.danger.solid : isDark ? priority.dark : priority.light;

    const translateX = useRef(new Animated.Value(0)).current;
    const pan = useRef(
        PanResponder.create({
            // Strict horizontal lock, or the list stops scrolling.
            onMoveShouldSetPanResponder: (_e, g) =>
                Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
            onPanResponderTerminationRequest: () => false,
            onPanResponderMove: (_e, g) => translateX.setValue(Math.max(-110, Math.min(110, g.dx))),
            onPanResponderRelease: (_e, g) => {
                Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
                if (g.dx > 80) {
                    triggerHaptic('success');
                    onToggleStatus(task);
                } else if (g.dx < -80) {
                    triggerHaptic('warning');
                    onOpenActions(task);
                }
            },
            onPanResponderTerminate: () => {
                Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
            },
        }),
    ).current;

    const toggleExpanded = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(v => !v);
    };

    const setChecklist = (next: ChecklistItem[]) => onUpdateChecklist?.(task, next);

    const timeLeft = done ? null : getTimeLeftText(task.dueDate, nowMs);
    const meta = [
        task.subjectName,
        due ? `${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${formatAMPM(due)}` : 'No due date',
    ]
        .filter(Boolean)
        .join('  ·  ');

    const hasDetail = !!task.description || checkTotal > 0 || !!onUpdateChecklist;

    return (
        <View>
            {showDivider && (
                <View
                    pointerEvents="none"
                    style={{ height: 1, marginLeft: 46, marginRight: 4, backgroundColor: theme.cardBorder }}
                />
            )}

            <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 11, paddingRight: 2 }}>
                    {/* Checkbox — the primary action, and the only one that is
                        one tap away. */}
                    <TouchableOpacity
                        onPress={() => {
                            triggerHaptic('light');
                            onToggleStatus(task);
                        }}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 6 }}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: done }}
                        accessibilityLabel={
                            done ? `Mark ${task.title} as pending` : `Mark ${task.title} as submitted`
                        }
                        style={{ paddingTop: 1, paddingRight: 10 }}
                    >
                        <View
                            style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                borderWidth: 2,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderColor: done ? tints.attendance.solid : theme.cardBorder,
                                backgroundColor: done ? tints.attendance.solid : 'transparent',
                            }}
                        >
                            {done && <Ionicons name="checkmark" size={13} color="#ffffff" />}
                        </View>
                    </TouchableOpacity>

                    {/* Priority rail */}
                    <View
                        style={{
                            width: 3,
                            alignSelf: 'stretch',
                            borderRadius: 2,
                            marginRight: 10,
                            backgroundColor: rail,
                            opacity: done ? 0.5 : 1,
                        }}
                    />

                    <TouchableOpacity
                        onPress={hasDetail ? toggleExpanded : () => onOpenActions(task)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${task.title}. ${meta}. ${timeLeft || 'Done'}`}
                        accessibilityHint={hasDetail ? 'Shows details' : 'Opens task actions'}
                        style={{ flex: 1, marginRight: 6 }}
                    >
                        <Text
                            numberOfLines={2}
                            style={{
                                fontFamily: 'Nunito_700Bold',
                                fontSize: 14.5,
                                color: done ? theme.textTertiary : theme.text,
                                textDecorationLine: done ? 'line-through' : 'none',
                            }}
                        >
                            {task.title}
                        </Text>

                        <Text
                            numberOfLines={1}
                            style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary, marginTop: 2 }}
                        >
                            {meta}
                        </Text>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 6 }}>
                            {overdue && (
                                <View
                                    style={{
                                        paddingHorizontal: 7,
                                        paddingVertical: 2,
                                        borderRadius: Radius.sm,
                                        backgroundColor: tints.danger.fill,
                                        borderWidth: 1,
                                        borderColor: tints.danger.line,
                                    }}
                                >
                                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 9.5, color: tints.danger.ink }}>
                                        OVERDUE
                                    </Text>
                                </View>
                            )}

                            {!done && !overdue && timeLeft && (
                                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textSecondary }}>
                                    {timeLeft}
                                </Text>
                            )}

                            {task.status === 'graded' && task.maxScore !== undefined && (
                                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: tints.grades.ink }}>
                                    {`${task.earnedScore ?? 0} / ${task.maxScore}`}
                                </Text>
                            )}

                            {checkTotal > 0 && (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="list-outline" size={11} color={theme.textTertiary} />
                                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textTertiary, marginLeft: 3 }}>
                                        {`${checkDone}/${checkTotal}`}
                                    </Text>
                                </View>
                            )}

                            {hasDetail && (
                                <Ionicons
                                    name={expanded ? 'chevron-up' : 'chevron-down'}
                                    size={12}
                                    color={theme.textTertiary}
                                />
                            )}
                        </View>
                    </TouchableOpacity>

                    {/* Edit is visible because it is frequent and harmless.
                        Delete is not, because it is neither. */}
                    <TouchableOpacity
                        onPress={() => {
                            triggerHaptic('light');
                            onEdit(task);
                        }}
                        activeOpacity={0.7}
                        hitSlop={{ top: 12, bottom: 12, left: 6, right: 4 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${task.title}`}
                        style={{ padding: 4, marginTop: 1 }}
                    >
                        <Ionicons name="create-outline" size={17} color={theme.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => {
                            triggerHaptic('light');
                            onOpenActions(task);
                        }}
                        activeOpacity={0.7}
                        hitSlop={{ top: 12, bottom: 12, left: 4, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={`More actions for ${task.title}`}
                        style={{ padding: 4, marginTop: 1 }}
                    >
                        <Ionicons name="ellipsis-horizontal" size={17} color={theme.textTertiary} />
                    </TouchableOpacity>
                </View>

                {expanded && (
                    <View style={{ paddingLeft: 46, paddingRight: 6, paddingBottom: 12 }}>
                        {!!task.description && (
                            <Text
                                style={{
                                    fontFamily: 'Nunito_400Regular',
                                    fontSize: 12.5,
                                    lineHeight: 18,
                                    color: theme.textSecondary,
                                    marginBottom: checkTotal > 0 || onUpdateChecklist ? 10 : 0,
                                }}
                            >
                                {task.description}
                            </Text>
                        )}

                        {checklist.map((item, idx) => (
                            <View key={item.id || idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                                <TouchableOpacity
                                    onPress={() => {
                                        triggerHaptic('light');
                                        setChecklist(
                                            checklist.map((c, i) => (i === idx ? { ...c, completed: !c.completed } : c)),
                                        );
                                    }}
                                    activeOpacity={0.7}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: item.completed }}
                                    accessibilityLabel={item.text}
                                    style={{ marginRight: 8 }}
                                >
                                    <Ionicons
                                        name={item.completed ? 'checkbox' : 'square-outline'}
                                        size={16}
                                        color={item.completed ? tints.attendance.solid : theme.textTertiary}
                                    />
                                </TouchableOpacity>
                                <Text
                                    style={{
                                        flex: 1,
                                        fontFamily: 'Nunito_400Regular',
                                        fontSize: 12.5,
                                        color: item.completed ? theme.textTertiary : theme.textSecondary,
                                        textDecorationLine: item.completed ? 'line-through' : 'none',
                                    }}
                                >
                                    {item.text}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setChecklist(checklist.filter((_, i) => i !== idx))}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Remove subtask ${item.text}`}
                                >
                                    <Ionicons name="close" size={14} color={theme.textTertiary} />
                                </TouchableOpacity>
                            </View>
                        ))}

                        {onUpdateChecklist && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                                <Ionicons name="add" size={15} color={theme.textTertiary} style={{ marginRight: 6 }} />
                                <TextInput
                                    value={draft}
                                    onChangeText={setDraft}
                                    placeholder="Add a subtask"
                                    placeholderTextColor={theme.textTertiary}
                                    accessibilityLabel="New subtask"
                                    returnKeyType="done"
                                    onSubmitEditing={() => {
                                        const text = draft.trim();
                                        if (!text) return;
                                        setChecklist([
                                            ...checklist,
                                            { id: `${Date.now()}`, text, completed: false },
                                        ]);
                                        setDraft('');
                                    }}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 4,
                                        fontFamily: 'Nunito_400Regular',
                                        fontSize: 12.5,
                                        color: theme.text,
                                    }}
                                />
                            </View>
                        )}
                    </View>
                )}
            </Animated.View>
        </View>
    );
}
