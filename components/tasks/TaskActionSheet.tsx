import React from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import type { TaskItem, TaskStatus } from './types';

interface TaskActionSheetProps {
    task: TaskItem | null;
    onClose: () => void;
    onEdit: (task: TaskItem) => void;
    onDelete: (task: TaskItem) => void;
    onSetStatus: (task: TaskItem, status: TaskStatus) => void;
    onFocus: (task: TaskItem) => void;
}

/**
 * Everything you can do to one task.
 *
 * The list used to carry a pencil and a trash can on **every** row, which put
 * Delete one mis-tap from a task's whole history and made a list of homework
 * read as a management console. The grades tab solved this the same way: one
 * `···` per row opening one screen-level sheet, so the list renders a single
 * modal rather than one per card.
 */
export default function TaskActionSheet({
    task,
    onClose,
    onEdit,
    onDelete,
    onSetStatus,
    onFocus,
}: TaskActionSheetProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);
    const insets = useSafeAreaInsets();

    if (!task) return null;

    const statusRows: { status: TaskStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
        { status: 'pending', label: 'Mark as to do', icon: 'ellipse-outline' },
        { status: 'submitted', label: 'Mark as submitted', icon: 'checkmark-circle-outline' },
        { status: 'graded', label: 'Add a grade', icon: 'ribbon-outline' },
    ];

    const row = (
        icon: keyof typeof Ionicons.glyphMap,
        label: string,
        onPress: () => void,
        opts: { danger?: boolean; selected?: boolean } = {},
    ) => (
        <TouchableOpacity
            key={label}
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: opts.selected }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 4 }}
        >
            <Ionicons
                name={icon}
                size={19}
                color={opts.danger ? tints.danger.ink : opts.selected ? theme.primary : theme.textSecondary}
                style={{ marginRight: 13 }}
            />
            <Text
                style={{
                    flex: 1,
                    fontFamily: opts.selected ? 'Nunito_800ExtraBold' : 'Nunito_700Bold',
                    fontSize: 14.5,
                    color: opts.danger ? tints.danger.ink : opts.selected ? theme.primary : theme.text,
                }}
            >
                {label}
            </Text>
            {opts.selected && <Ionicons name="checkmark" size={17} color={theme.primary} />}
        </TouchableOpacity>
    );

    return (
        <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.overlay }}>
                <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />

                <View
                    style={{
                        borderTopLeftRadius: Radius['4xl'],
                        borderTopRightRadius: Radius['4xl'],
                        backgroundColor: theme.surface,
                        borderTopWidth: 1,
                        borderTopColor: theme.cardBorder,
                        paddingHorizontal: 18,
                        paddingBottom: insets.bottom + 14,
                    }}
                >
                    <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 12 }}>
                        <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: theme.cardBorder }} />
                    </View>

                    <Text
                        accessibilityRole="header"
                        numberOfLines={2}
                        style={{ fontFamily: 'Nunito_900Black', fontSize: 17, color: theme.text, letterSpacing: -0.3 }}
                    >
                        {task.title}
                    </Text>
                    <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textTertiary, marginTop: 2, marginBottom: 6 }}>
                        {task.subjectName || 'Task'}
                    </Text>

                    <View style={{ height: 1, backgroundColor: theme.cardBorder, marginVertical: 6 }} />

                    {statusRows.map(s =>
                        row(s.icon, s.label, () => onSetStatus(task, s.status), { selected: task.status === s.status }),
                    )}

                    <View style={{ height: 1, backgroundColor: theme.cardBorder, marginVertical: 6 }} />

                    {row('flame-outline', 'Start a focus session', () => onFocus(task))}
                    {row('create-outline', 'Edit task', () => onEdit(task))}
                    {row('trash-outline', 'Delete task', () => onDelete(task), { danger: true })}
                </View>
            </View>
        </Modal>
    );
}
