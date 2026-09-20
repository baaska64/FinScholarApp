import React from 'react';
import { View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import KeyboardSheet from '@/components/ui/KeyboardSheet';
import ProgressBar from '@/components/ui/ProgressBar';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import type { TaskCounts } from '@/utils/taskModel';

interface TaskOverviewSheetProps {
    visible: boolean;
    onClose: () => void;
    counts: TaskCounts;
    termLabel: string;
}

/**
 * The numbers, on demand.
 *
 * These were a permanently mounted card — a progress bar, four equal-weight
 * stat tiles and a celebration banner, about 330pt of screen above the task
 * list. Four equal tiles meant nothing stood out, so the one number that
 * actually changes behaviour (overdue) had to be hunted for. The tab now shows
 * that single number in a one-line strip and keeps the full breakdown here,
 * where Fin has room to react to it.
 */
export default function TaskOverviewSheet({ visible, onClose, counts, termLabel }: TaskOverviewSheetProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);

    const message =
        counts.total === 0
            ? 'No tasks yet. Add one and Fin will help you keep track.'
            : counts.completionPercent === 100
                ? 'Everything is submitted. Fin is impressed!'
                : counts.overdue > 0
                    ? `${counts.overdue} ${counts.overdue === 1 ? 'task is' : 'tasks are'} past due. Start with those.`
                    : counts.completionPercent >= 75
                        ? 'Nearly there — the finish line is in sight.'
                        : counts.completionPercent >= 50
                            ? 'Halfway through. Keep the momentum going.'
                            : counts.dueToday > 0
                                ? `${counts.dueToday} due today. One at a time.`
                                : 'Plenty of runway. Pick one and start.';

    // `happy` when there is nothing left to do, `studying` while work remains,
    // `sleeping` before there is any. Fin reacts to the real state rather than
    // being an ornament.
    const mascot =
        counts.total === 0
            ? require('../../assets/images/sleeping.png')
            : counts.completionPercent === 100
                ? require('../../assets/images/happy.png')
                : require('../../assets/images/studying.png');

    const tiles: { label: string; value: number; tint: { fill: string; line: string; ink: string } }[] = [
        { label: 'To do', value: counts.pending, tint: tints.tasks },
        { label: 'Overdue', value: counts.overdue, tint: tints.danger },
        { label: 'Submitted', value: counts.submitted, tint: tints.schedule },
        { label: 'Graded', value: counts.graded, tint: tints.attendance },
    ];

    return (
        <KeyboardSheet
            visible={visible}
            onClose={onClose}
            title="Task overview"
            subtitle={termLabel}
            icon="stats-chart"
            tint={tints.tasks}
            maxHeightRatio={0.8}
        >
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderRadius: Radius['3xl'],
                    backgroundColor: tints.tasks.fill,
                    borderWidth: 1,
                    borderColor: tints.tasks.line,
                }}
            >
                <Image source={mascot} style={{ width: 76, height: 76, marginRight: 12 }} resizeMode="contain" />
                <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 26, color: tints.tasks.ink }}>
                        {`${counts.completionPercent}%`}
                    </Text>
                    <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                        {message}
                    </Text>
                </View>
            </View>

            <View style={{ marginTop: 14 }}>
                <ProgressBar
                    progress={counts.completionPercent / 100}
                    height={8}
                    color={tints.attendance.solid}
                    accessibilityLabel={`${counts.completionPercent} percent of tasks done`}
                />
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                {tiles.map(tile => (
                    <View
                        key={tile.label}
                        accessible
                        accessibilityLabel={`${tile.value} ${tile.label}`}
                        style={{
                            flexGrow: 1,
                            flexBasis: '46%',
                            paddingVertical: 14,
                            paddingHorizontal: 14,
                            borderRadius: Radius.xl,
                            backgroundColor: tile.value > 0 ? tile.tint.fill : (isDark ? 'rgba(0,0,0,0.18)' : theme.surfaceSecondary),
                            borderWidth: 1,
                            borderColor: tile.value > 0 ? tile.tint.line : 'transparent',
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: 'Nunito_900Black',
                                fontSize: 22,
                                color: tile.value > 0 ? tile.tint.ink : theme.textTertiary,
                            }}
                        >
                            {tile.value}
                        </Text>
                        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: theme.textTertiary, marginTop: 1 }}>
                            {tile.label}
                        </Text>
                    </View>
                ))}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 6 }}>
                <Ionicons name="albums-outline" size={13} color={theme.textTertiary} style={{ marginRight: 6 }} />
                <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textTertiary }}>
                    {`${counts.total} ${counts.total === 1 ? 'task' : 'tasks'} in this term`}
                </Text>
            </View>
        </KeyboardSheet>
    );
}
