import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Calculator } from '../../utils/calculator';
import { supabase } from '../../services/supabaseClient';
import { AlertService } from '@/components/CustomAlert';
import Card from '@/components/ui/Card';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import KeyboardSheet from '@/components/ui/KeyboardSheet';
import SectionHeader from '@/components/ui/SectionHeader';
import BandSurface from '@/components/dashboard/BandSurface';
import GradeScale, { ScaleMark } from '@/components/ledger/GradeScale';
import ScoreSheet from '@/components/ledger/ScoreSheet';
import GroupSheet from '@/components/ledger/GroupSheet';
import SubjectSheet, { SubjectDraft } from '@/components/ledger/SubjectSheet';
import { getTheme, getTints, getBrand, Radius } from '@/constants/Theme';
import { getGradeTierColor, getGradeTierLabel, getGradeTierWash } from '@/utils/gradeTiers';
import { useTabBarHeight } from '@/components/CustomTabBar';
import {
    generateId,
    weightSummary,
    effectiveWeight,
    formatWeight,
    formatGrade,
    getItemAt,
    siblingsAt,
    updateItemAt,
    removeItemAt,
    addItem,
    addPeriod,
    updatePeriod,
    removePeriod,
    addComponent,
    updateComponent,
    removeComponent,
    suggestItemName,
    scorePercent,
    countScores,
    subjectOutlook,
    MAX_ITEM_DEPTH,
    ItemPath,
    ItemDraft,
    NodeDraft,
    OutlookKind,
} from '@/utils/gradeEntry';

const GUTTER = 14;
const BAND_SLANT = 22;

type ScoreTarget =
    | { mode: 'create'; period: number; component: number; parentItems: number[] | null }
    | { mode: 'edit'; path: ItemPath };

type GroupTarget =
    | { kind: 'period'; mode: 'create' }
    | { kind: 'period'; mode: 'edit'; period: number }
    | { kind: 'component'; mode: 'create'; period: number }
    | { kind: 'component'; mode: 'edit'; period: number; component: number };

/** Weight totals that do not add to 100 are a data problem, not a style. */
function WeightWarning({ tints, text }: { tints: any; text: string }) {
    return (
        <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 11, paddingVertical: 8, borderRadius: Radius.md, marginBottom: 12,
            backgroundColor: tints.danger.fill, borderWidth: 1, borderColor: tints.danger.line,
        }}>
            <Ionicons name="warning" size={13} color={tints.danger.ink} style={{ marginRight: 7 }} />
            <Text style={{ flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: tints.danger.ink }}>{text}</Text>
        </View>
    );
}

/**
 * One score row, and its parts beneath it. Read-only on purpose: tapping opens
 * the score sheet. Module scope so a re-render never remounts the rows.
 */
function ItemRow({
    item, depth, index, siblings, path, theme, tints, isDark, collapsed, onToggle, onOpen, isLast,
}: {
    item: any; depth: number; index: number; siblings: any[]; path: ItemPath; theme: any; tints: any; isDark: boolean;
    collapsed: Record<string, boolean>; onToggle: (id: string) => void; onOpen: (path: ItemPath) => void; isLast: boolean;
}) {
    const parts: any[] = item.subItems || [];
    const hasParts = parts.length > 0;
    const isOpen = hasParts && !collapsed[item.id];
    const ws = weightSummary(siblings.map((s: any) => s.weight));
    const typedWeight = item.weight !== '' && item.weight !== null && item.weight !== undefined;

    const ip = Calculator.computeItemPercent(item);
    const pct = hasParts ? (ip.isEmpty ? null : ip.percent * 100) : scorePercent(item.score, item.max);
    const color = pct === null ? theme.textTertiary : getGradeTierColor(pct, isDark, true);
    const name = item.name || (depth === 0 ? `Item ${index + 1}` : `Part ${index + 1}`);
    const counts = countScores(item);

    return (
        <View>
            <TouchableOpacity
                onPress={() => onOpen(path)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${name}. ${pct === null ? 'Not graded yet' : `${pct.toFixed(1)} percent`}. Weight ${formatWeight(effectiveWeight(item.weight, ws))} percent. Opens editor.`}
                style={{
                    flexDirection: 'row', alignItems: 'center', minHeight: 46,
                    paddingLeft: 14 + depth * 16, paddingRight: 12, paddingVertical: 8,
                    borderTopWidth: 1, borderTopColor: theme.cardBorder,
                }}
            >
                {depth > 0 && (
                    <View style={{ position: 'absolute', left: 14 + (depth - 1) * 16 + 4, top: 0, bottom: isLast ? '50%' : 0, width: 2, backgroundColor: theme.cardBorder }} />
                )}

                {hasParts ? (
                    <TouchableOpacity
                        onPress={() => onToggle(item.id)}
                        accessibilityRole="button"
                        accessibilityLabel={isOpen ? 'Hide parts' : 'Show parts'}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
                        style={{ width: 18, marginRight: 8, alignItems: 'center' }}
                    >
                        <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={14} color={theme.textTertiary} />
                    </TouchableOpacity>
                ) : (
                    <View style={{
                        width: 10, height: 10, borderRadius: 5, marginLeft: 4, marginRight: 12,
                        backgroundColor: pct === null ? 'transparent' : color,
                        borderWidth: pct === null ? 2 : 0, borderColor: theme.textTertiary,
                    }} />
                )}

                <View style={{ flex: 1, marginRight: 8 }}>
                    <Text numberOfLines={1} style={{ fontFamily: depth === 0 ? 'Nunito_700Bold' : 'Nunito_600SemiBold', fontSize: depth === 0 ? 13.5 : 12.5, color: theme.text }}>
                        {name}
                    </Text>
                    {(hasParts || typedWeight) && (
                        <Text numberOfLines={1} style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 11, color: theme.textTertiary, marginTop: 1 }}>
                            {hasParts ? `${parts.length} parts · ${counts.filled} of ${counts.total} in` : ''}
                            {hasParts && typedWeight ? ' · ' : ''}
                            {typedWeight ? `weight ${formatWeight(Number(item.weight) || 0)}%` : ''}
                        </Text>
                    )}
                </View>

                {!hasParts && (
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: pct === null ? theme.textTertiary : theme.text, marginRight: 10 }}>
                        {pct === null ? '—' : `${item.score}`}
                        <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: theme.textTertiary }}> / {item.max ?? 100}</Text>
                    </Text>
                )}
                <Text style={{ minWidth: 48, textAlign: 'right', fontFamily: 'Nunito_900Black', fontSize: 13, color }}>
                    {pct === null ? '' : `${pct.toFixed(pct >= 99.95 ? 0 : 1)}%`}
                </Text>
            </TouchableOpacity>

            {isOpen && parts.map((si: any, i: number) => (
                <ItemRow
                    key={si.id || i}
                    item={si}
                    depth={depth + 1}
                    index={i}
                    siblings={parts}
                    path={{ ...path, items: [...path.items, i] }}
                    theme={theme}
                    tints={tints}
                    isDark={isDark}
                    collapsed={collapsed}
                    onToggle={onToggle}
                    onOpen={onOpen}
                    isLast={i === parts.length - 1}
                />
            ))}
        </View>
    );
}

const OUTLOOK_STYLE: Record<OutlookKind, { tint: 'attendance' | 'schedule' | 'tasks' | 'danger'; icon: keyof typeof Ionicons.glyphMap; title: string }> = {
    reached: { tint: 'attendance', icon: 'checkmark-circle', title: 'Target reached' },
    'on-course': { tint: 'schedule', icon: 'locate', title: 'Within reach' },
    'pass-only': { tint: 'tasks', icon: 'alert-circle', title: 'Target out of reach' },
    'passed-only': { tint: 'tasks', icon: 'ribbon-outline', title: 'Passed' },
    lost: { tint: 'danger', icon: 'close-circle', title: 'Cannot pass' },
    'no-room': { tint: 'tasks', icon: 'flag-outline', title: 'All scores in' },
};

/**
 * One subject: where it stands, what it still needs, and how it is graded.
 *
 * The standing sits on the brand band under a pinned header, so Back never
 * scrolls away mid-entry. Periods are tabs rather than an accordion — a student
 * is entering Midterm scores, not all four periods at once — and every score
 * is a read-only row that opens `ScoreSheet`. Nothing on this screen is a live
 * text field any more: edits are drafts that commit on Save.
 */
export default function ActiveSubjectView({ subject, system, onChange, onBack }: any) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);
    const brand = getBrand(isDark);
    const insets = useSafeAreaInsets();
    const tabBarHeight = useTabBarHeight();

    const [finOpen, setFinOpen] = useState(false);
    const [autoConfigOpen, setAutoConfigOpen] = useState(false);
    const [syllabusText, setSyllabusText] = useState('');
    const [autoConfigImage, setAutoConfigImage] = useState<string | null>(null);
    const [autoConfigBase64, setAutoConfigBase64] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [scoreTarget, setScoreTarget] = useState<ScoreTarget | null>(null);
    const [scoreResetKey, setScoreResetKey] = useState(0);
    const [groupTarget, setGroupTarget] = useState<GroupTarget | null>(null);
    const [subjectSheetOpen, setSubjectSheetOpen] = useState(false);
    const [showAllRemaining, setShowAllRemaining] = useState(false);

    const periods: any[] = subject.periods || [];
    const foundIdx = periods.findIndex((p) => p.id === selectedPeriodId);
    const selIdx = periods.length === 0 ? -1 : foundIdx === -1 ? 0 : foundIdx;
    const selPeriod = selIdx >= 0 ? periods[selIdx] : null;

    const res = Calculator.calculateSubject(subject, system);
    const passPct = Number(subject.passingPercent) || 60;
    const outlook = subjectOutlook(subject, system);
    const isTracked = subject.gradeTrackingEnabled !== false;

    let filled = 0, total = 0;
    for (const per of periods) for (const c of per?.components || []) for (const it of c?.items || []) {
        const n = countScores(it);
        filled += n.filled;
        total += n.total;
    }

    const pSummary = weightSummary(periods.map((p) => p.weight));

    // ─── AutoConfig ───────────────────────────────────────────────────────────

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            base64: true,
            quality: 0.8,
        });
        if (!result.canceled) {
            setAutoConfigImage(result.assets[0].uri);
            if (result.assets[0].base64) setAutoConfigBase64(result.assets[0].base64);
        }
    };

    const handleAutoConfig = async () => {
        if (!syllabusText && !autoConfigImage) {
            AlertService.alert('Missing Input', 'Please provide a text prompt or upload an image of your syllabus.');
            return;
        }

        setIsProcessing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                AlertService.alert('Authentication Required', 'You must be logged in to use the AI AutoConfig feature.');
                setIsProcessing(false);
                return;
            }

            let base64Data = null;
            if (autoConfigImage && autoConfigBase64) {
                let mimeType = 'image/jpeg';
                if (autoConfigImage.toLowerCase().endsWith('.png')) mimeType = 'image/png';
                base64Data = `data:${mimeType};base64,${autoConfigBase64}`;
            }

            const { data, error: funcError } = await supabase.functions.invoke('parse-syllabus', {
                body: { textPrompt: syllabusText, base64Data },
            });

            if (funcError) {
                let errMsg = funcError.message;
                try {
                    if (funcError.context) {
                        const ctx = await funcError.context.json();
                        if (ctx && ctx.error) errMsg = ctx.error;
                    }
                } catch (e) {}
                throw new Error(errMsg);
            }

            if (Array.isArray(data)) {
                const addIds = (items: any[]): any[] => items.map((i) => ({
                    ...i, id: generateId(),
                    components: i.components ? addIds(i.components) : [],
                    items: i.items ? addIds(i.items) : [],
                    subItems: i.subItems ? addIds(i.subItems) : [],
                }));
                const next = JSON.parse(JSON.stringify(subject));
                next.periods = addIds(data);
                onChange(next);
                setSelectedPeriodId(null);
                AlertService.alert('Success', 'Grading system successfully configured!');
                setAutoConfigOpen(false);
                setSyllabusText('');
                setAutoConfigImage(null);
                setAutoConfigBase64(null);
            } else {
                throw new Error('Invalid response format from AI.');
            }
        } catch (error: any) {
            AlertService.alert('AutoConfig Error', error.message || 'An unexpected error occurred.');
        } finally {
            setIsProcessing(false);
        }
    };

    // ─── Score sheet wiring ───────────────────────────────────────────────────

    const openCreateScore = (period: number, component: number, parentItems: number[] | null = null) => {
        setScoreTarget({ mode: 'create', period, component, parentItems });
        setScoreResetKey((k) => k + 1);
    };
    const openEditScore = (path: ItemPath) => {
        setScoreTarget({ mode: 'edit', path });
        setScoreResetKey((k) => k + 1);
    };

    let scoreProps: {
        context: string; initial: ItemDraft; autoWeight: number; weightScope: string; partCount: number; canAddPart: boolean;
    } | null = null;

    if (scoreTarget) {
        if (scoreTarget.mode === 'create') {
            const per = periods[scoreTarget.period];
            const comp = per?.components?.[scoreTarget.component];
            const parent = scoreTarget.parentItems
                ? getItemAt(subject, { period: scoreTarget.period, component: scoreTarget.component, items: scoreTarget.parentItems })
                : null;
            const siblings: any[] = parent ? parent.subItems || [] : comp?.items || [];
            const last = siblings[siblings.length - 1];
            if (comp) {
                scoreProps = {
                    context: parent ? `Part of ${parent.name || 'this score'} · ${comp.name}` : `${comp.name || 'Component'} · ${per.name || 'Period'}`,
                    initial: {
                        name: parent ? `Part ${siblings.length + 1}` : suggestItemName(comp.name, siblings.length),
                        score: '',
                        max: last?.max ?? 100,
                        weight: '',
                    },
                    autoWeight: weightSummary([...siblings.map((s) => s.weight), '']).auto,
                    weightScope: parent ? parent.name || 'this score' : comp.name || 'this component',
                    partCount: 0,
                    canAddPart: false,
                };
            }
        } else {
            const node = getItemAt(subject, scoreTarget.path);
            const comp = periods[scoreTarget.path.period]?.components?.[scoreTarget.path.component];
            const per = periods[scoreTarget.path.period];
            if (node && comp) {
                const siblings = siblingsAt(subject, scoreTarget.path);
                const parent = scoreTarget.path.items.length > 1
                    ? getItemAt(subject, { ...scoreTarget.path, items: scoreTarget.path.items.slice(0, -1) })
                    : null;
                scoreProps = {
                    context: parent ? `Part of ${parent.name || 'a score'} · ${comp.name}` : `${comp.name || 'Component'} · ${per.name || 'Period'}`,
                    initial: { name: node.name ?? '', score: node.score ?? '', max: node.max ?? 100, weight: node.weight ?? '' },
                    autoWeight: weightSummary(siblings.map((s) => s.weight)).auto,
                    weightScope: parent ? parent.name || 'its score' : comp.name || 'this component',
                    partCount: node.subItems?.length || 0,
                    canAddPart: scoreTarget.path.items.length <= MAX_ITEM_DEPTH,
                };
            }
        }
    }

    const handleScoreSave = (draft: ItemDraft, next: 'close' | 'another' | 'part') => {
        if (!scoreTarget) return;
        if (scoreTarget.mode === 'create') {
            const out = addItem(subject, scoreTarget.period, scoreTarget.component, draft, scoreTarget.parentItems);
            if (!out) return;
            onChange(out.subject);
            if (next === 'another') setScoreResetKey((k) => k + 1);
            else setScoreTarget(null);
            return;
        }

        const path = scoreTarget.path;
        let updated = updateItemAt(subject, path, draft);
        if (next === 'part') {
            const node = getItemAt(subject, path);
            // Splitting a plain score keeps what was typed: it becomes Part 1.
            if (node && !(node.subItems?.length)) {
                const first = addItem(updated, path.period, path.component, { name: 'Part 1', score: draft.score ?? '', max: draft.max ?? 100 }, path.items);
                if (first) updated = first.subject;
            }
            onChange(updated);
            if (node?.id) setCollapsed((c) => ({ ...c, [node.id]: false }));
            setScoreTarget({ mode: 'create', period: path.period, component: path.component, parentItems: path.items });
            setScoreResetKey((k) => k + 1);
            return;
        }
        onChange(updated);
        setScoreTarget(null);
    };

    const handleScoreDelete = () => {
        if (!scoreTarget || scoreTarget.mode !== 'edit') return;
        const path = scoreTarget.path;
        const node = getItemAt(subject, path);
        const partCount = node?.subItems?.length || 0;
        AlertService.alert(
            'Delete score',
            partCount > 0 ? `Delete "${node?.name || 'this score'}" and its ${partCount} parts?` : `Delete "${node?.name || 'this score'}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: () => {
                        onChange(removeItemAt(subject, path));
                        setScoreTarget(null);
                    },
                },
            ]
        );
    };

    // ─── Group sheet wiring ───────────────────────────────────────────────────

    let groupProps: { initial: NodeDraft; parentName: string; autoWeight: number } | null = null;
    if (groupTarget) {
        if (groupTarget.kind === 'period') {
            const siblings = periods.map((p) => p.weight);
            groupProps = groupTarget.mode === 'create'
                ? { initial: { name: '', weight: '' }, parentName: subject.name || 'this subject', autoWeight: weightSummary([...siblings, '']).auto }
                : {
                    initial: { name: periods[groupTarget.period]?.name ?? '', weight: periods[groupTarget.period]?.weight ?? '' },
                    parentName: subject.name || 'this subject',
                    autoWeight: weightSummary(siblings).auto,
                };
        } else {
            const per = periods[groupTarget.period];
            const siblings = (per?.components || []).map((c: any) => c.weight);
            const comp = groupTarget.mode === 'edit' ? per?.components?.[groupTarget.component] : null;
            groupProps = {
                initial: comp ? { name: comp.name ?? '', weight: comp.weight ?? '' } : { name: '', weight: '' },
                parentName: per?.name || 'this period',
                autoWeight: weightSummary(groupTarget.mode === 'create' ? [...siblings, ''] : siblings).auto,
            };
        }
    }

    const handleGroupSave = (draft: NodeDraft) => {
        if (!groupTarget) return;
        if (groupTarget.kind === 'period') {
            if (groupTarget.mode === 'create') {
                const out = addPeriod(subject, draft);
                onChange(out.subject);
                setSelectedPeriodId(out.subject.periods[out.index].id);
            } else {
                onChange(updatePeriod(subject, groupTarget.period, draft));
            }
        } else if (groupTarget.mode === 'create') {
            onChange(addComponent(subject, groupTarget.period, draft));
        } else {
            onChange(updateComponent(subject, groupTarget.period, groupTarget.component, draft));
        }
        setGroupTarget(null);
    };

    const handleGroupDelete = () => {
        if (!groupTarget || groupTarget.mode !== 'edit') return;
        const t = groupTarget;
        const isPeriod = t.kind === 'period';
        const node = isPeriod ? periods[t.period] : periods[t.period]?.components?.[(t as any).component];
        AlertService.alert(
            isPeriod ? 'Delete period' : 'Delete component',
            `Delete "${node?.name || 'this'}" and every score in it?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: () => {
                        onChange(isPeriod ? removePeriod(subject, t.period) : removeComponent(subject, t.period, (t as any).component));
                        if (isPeriod) setSelectedPeriodId(null);
                        setGroupTarget(null);
                    },
                },
            ]
        );
    };

    // ─── Shared atoms ─────────────────────────────────────────────────────────

    const microLabel = {
        fontFamily: 'Nunito_800ExtraBold' as const,
        fontSize: 10,
        letterSpacing: 0.8,
        textTransform: 'uppercase' as const,
        color: theme.textTertiary,
    };

    const bandChip = (text: string, icon?: keyof typeof Ionicons.glyphMap) => (
        <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 10, height: 26, borderRadius: 999,
            backgroundColor: brand.well, borderWidth: 1, borderColor: brand.wellLine,
        }}>
            {icon && <Ionicons name={icon} size={11} color={brand.onHero} />}
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 11.5, color: brand.onHero }}>{text}</Text>
        </View>
    );

    const targetPct = Number(subject.targetValue) || passPct;
    const marks: ScaleMark[] = [{ at: passPct, label: `Pass ${formatWeight(passPct)}`, strong: true }];
    if (Math.abs(targetPct - passPct) >= 8) marks.push({ at: targetPct, label: `Goal ${formatWeight(targetPct)}` });

    const subjectDraft: SubjectDraft = {
        name: subject.name ?? '',
        units: subject.units === undefined || subject.units === null ? '' : String(subject.units),
        passingPercent: subject.passingPercent === undefined || subject.passingPercent === null ? '' : String(subject.passingPercent),
        targetValue: subject.targetValue === undefined || subject.targetValue === null ? '' : String(subject.targetValue),
    };

    // ─── Outlook ──────────────────────────────────────────────────────────────

    const renderOutlook = () => {
        if (total === 0) return null;
        const style = OUTLOOK_STYLE[outlook.kind];
        const tint = outlook.kind === 'no-room' && res.absoluteEarned >= passPct ? tints.attendance : tints[style.tint];
        const remaining = showAllRemaining ? outlook.remaining : outlook.remaining.slice(0, 3);

        return (
            <Card padding={0} radius={Radius['2xl']} fill={tint.fill} border={tint.line} style={{ marginBottom: 20, overflow: 'hidden' }}>
                <View style={{ padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name={style.icon} size={14} color={tint.ink} />
                        <Text style={{ ...microLabel, color: tint.ink }}>{style.title} · goal {formatWeight(outlook.target)}%</Text>
                    </View>

                    {outlook.requiredAverage !== null ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 }}>
                            <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 32, color: tint.ink, letterSpacing: -1 }}>
                                {outlook.requiredAverage > 100 ? '100+' : outlook.requiredAverage.toFixed(1)}
                                <Text style={{ fontSize: 17 }}>%</Text>
                            </Text>
                            <Text style={{ flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12.5, lineHeight: 17, color: theme.text }}>
                                average needed on the {outlook.remaining.length} score{outlook.remaining.length !== 1 ? 's' : ''} left
                                {outlook.requiredFor === 'pass' ? ' just to pass' : ` to reach ${formatWeight(outlook.target)}%`}
                            </Text>
                        </View>
                    ) : (
                        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, lineHeight: 20, color: theme.text, marginTop: 6 }}>
                            {outlook.message}
                        </Text>
                    )}
                </View>

                {outlook.remaining.length > 0 && (
                    <View style={{ borderTopWidth: 1, borderTopColor: tint.line, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 }}>
                        <Text style={{ ...microLabel, color: tint.ink, marginBottom: 8 }}>What each needs</Text>
                        {remaining.map((r) => (
                            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
                                <Text numberOfLines={1} style={{ flex: 1, marginRight: 10, fontFamily: 'Nunito_600SemiBold', fontSize: 12.5, color: theme.textSecondary }}>
                                    {r.name} <Text style={{ color: theme.textTertiary }}>· {r.periodName}</Text>
                                </Text>
                                <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 13.5, color: theme.text }}>
                                    {r.needed.toFixed(1)}
                                    <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 11.5, color: theme.textTertiary }}> / {r.sumMax}</Text>
                                </Text>
                            </View>
                        ))}
                        {outlook.remaining.length > 3 && (
                            <TouchableOpacity
                                onPress={() => setShowAllRemaining((v) => !v)}
                                accessibilityRole="button"
                                style={{ paddingTop: 6 }}
                            >
                                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: tint.ink }}>
                                    {showAllRemaining ? 'Show fewer' : `Show all ${outlook.remaining.length}`}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </Card>
        );
    };

    // ─── The selected period ─────────────────────────────────────────────────

    const renderPeriod = () => {
        if (!selPeriod) return null;
        const pIndex = selIdx;
        const pd = Calculator.calculatePeriod(selPeriod, passPct);
        const comps: any[] = selPeriod.components || [];
        const cSummary = weightSummary(comps.map((c) => c.weight));
        const pWeight = effectiveWeight(selPeriod.weight, pSummary);
        const periodTier = getGradeTierColor(pd.percent, isDark, pd.hasData);

        return (
            <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 2 }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <Text numberOfLines={1} style={{ fontFamily: 'Nunito_900Black', fontSize: 19, color: theme.text, letterSpacing: -0.4 }}>
                            {selPeriod.name || 'Untitled period'}
                        </Text>
                        <Text numberOfLines={1} style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: theme.textTertiary, marginTop: 1 }}>
                            {formatWeight(pWeight)}% of the subject{selPeriod.weight === '' || selPeriod.weight === undefined || selPeriod.weight === null ? ' (split evenly)' : ''}
                            {pd.hasData ? ` · ${pd.percent.toFixed(1)}%` : ''}
                        </Text>
                    </View>
                    <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 22, color: pd.hasData ? periodTier : theme.textTertiary, letterSpacing: -0.6, marginRight: 8 }}>
                        {pd.hasData ? formatGrade(pd.percent, passPct, system) : '—'}
                    </Text>
                    <TouchableOpacity
                        onPress={() => setGroupTarget({ kind: 'period', mode: 'edit', period: pIndex })}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit period ${selPeriod.name}`}
                        style={{
                            width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
                            backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.cardBorder,
                            borderBottomWidth: 2, borderBottomColor: theme.lip,
                        }}
                    >
                        <Ionicons name="create-outline" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                </View>

                {cSummary.warning && <WeightWarning tints={tints} text={`Components in ${selPeriod.name || 'this period'}: ${cSummary.warning}`} />}

                {comps.map((comp: any, cIndex: number) => {
                    const items: any[] = comp.items || [];
                    const cStat = pd.comps.find((x: any) => x.id === comp.id);
                    const cWeight = effectiveWeight(comp.weight, cSummary);
                    const iSummary = weightSummary(items.map((i) => i.weight));
                    let cFilled = 0, cTotal = 0;
                    for (const it of items) { const n = countScores(it); cFilled += n.filled; cTotal += n.total; }
                    const cColor = cStat?.hasData ? getGradeTierColor(cStat.percent, isDark, true) : theme.textTertiary;

                    return (
                        <Card key={comp.id || cIndex} padding={0} radius={Radius.xl} style={{ marginBottom: 12, overflow: 'hidden' }}>
                            <TouchableOpacity
                                onPress={() => setGroupTarget({ kind: 'component', mode: 'edit', period: pIndex, component: cIndex })}
                                activeOpacity={0.75}
                                accessibilityRole="button"
                                accessibilityLabel={`${comp.name}, ${formatWeight(cWeight)} percent of ${selPeriod.name}. ${cStat?.hasData ? `${cStat.percent.toFixed(1)} percent` : 'No scores yet'}. Edit component.`}
                                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 }}
                            >
                                <View style={{
                                    minWidth: 44, height: 26, paddingHorizontal: 7, borderRadius: 8, marginRight: 10,
                                    alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: tints.grades.fill, borderWidth: 1, borderColor: tints.grades.line,
                                }}>
                                    <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 11.5, color: tints.grades.ink }}>{formatWeight(cWeight)}%</Text>
                                </View>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text numberOfLines={1} style={{ fontFamily: 'Nunito_900Black', fontSize: 15, color: theme.text, letterSpacing: -0.2 }}>
                                        {comp.name || 'Untitled component'}
                                    </Text>
                                    <Text numberOfLines={1} style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 11, color: theme.textTertiary, marginTop: 1 }}>
                                        {cTotal === 0 ? 'No scores yet' : `${cFilled} of ${cTotal} in`}
                                        {iSummary.warning ? ' · ' : ''}
                                        {iSummary.warning ? <Text style={{ color: tints.danger.ink, fontFamily: 'Nunito_700Bold' }}>check weights</Text> : null}
                                    </Text>
                                </View>
                                <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 16, color: cColor, letterSpacing: -0.4, marginRight: 6 }}>
                                    {cStat?.hasData ? `${cStat.percent.toFixed(1)}%` : '—'}
                                </Text>
                                <Ionicons name="create-outline" size={15} color={theme.textTertiary} />
                            </TouchableOpacity>

                            {iSummary.warning && (
                                <View style={{ paddingHorizontal: 14 }}>
                                    <WeightWarning tints={tints} text={iSummary.warning} />
                                </View>
                            )}

                            {items.map((item: any, iIndex: number) => (
                                <ItemRow
                                    key={item.id || iIndex}
                                    item={item}
                                    depth={0}
                                    index={iIndex}
                                    siblings={items}
                                    path={{ period: pIndex, component: cIndex, items: [iIndex] }}
                                    theme={theme}
                                    tints={tints}
                                    isDark={isDark}
                                    collapsed={collapsed}
                                    onToggle={(id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }))}
                                    onOpen={openEditScore}
                                    isLast={iIndex === items.length - 1}
                                />
                            ))}

                            <TouchableOpacity
                                onPress={() => openCreateScore(pIndex, cIndex)}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel={`Add a score to ${comp.name}`}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44,
                                    borderTopWidth: 1, borderTopColor: theme.cardBorder,
                                    backgroundColor: isDark ? 'rgba(0,0,0,0.12)' : theme.surfaceSecondary,
                                }}
                            >
                                <Ionicons name="add-circle" size={17} color={tints.grades.ink} />
                                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13, color: tints.grades.ink }}>Add score</Text>
                            </TouchableOpacity>
                        </Card>
                    );
                })}

                {comps.length === 0 && (
                    <View style={{
                        padding: 14, borderRadius: Radius.lg, marginBottom: 10,
                        backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.cardBorder,
                    }}>
                        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: theme.text }}>What makes up {selPeriod.name || 'this period'}?</Text>
                        <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12.5, lineHeight: 18, color: theme.textSecondary, marginTop: 3 }}>
                            Add its components, like Quizzes 30% and Exams 70%. Scores go inside them.
                        </Text>
                    </View>
                )}

                <TouchableOpacity
                    onPress={() => setGroupTarget({ kind: 'component', mode: 'create', period: pIndex })}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Add a component to ${selPeriod.name}`}
                    style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46,
                        borderRadius: Radius.lg, borderWidth: 1, borderStyle: 'dashed',
                        borderColor: isDark ? '#3d4468' : '#cbd5e1',
                    }}
                >
                    <Ionicons name="add" size={16} color={theme.textSecondary} />
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: theme.textSecondary }}>Add component</Text>
                </TouchableOpacity>
            </View>
        );
    };

    // ─── Screen ───────────────────────────────────────────────────────────────

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            {/* ══ Pinned header on the band. Back never scrolls away mid-entry. ══ */}
            <View style={{ backgroundColor: brand.heroFrom, paddingTop: insets.top, zIndex: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 8 }}>
                    <TouchableOpacity
                        onPress={onBack}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel="Back to subjects"
                        style={{
                            flexDirection: 'row', alignItems: 'center', gap: 2,
                            paddingLeft: 7, paddingRight: 12, height: 36, borderRadius: 18,
                            backgroundColor: brand.well, borderWidth: 1, borderColor: brand.wellLine,
                        }}
                    >
                        <Ionicons name="chevron-back" size={17} color={brand.onHero} />
                        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13, color: brand.onHero }}>Subjects</Text>
                    </TouchableOpacity>

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity
                        onPress={() => setFinOpen(true)}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel="FinSights — what Fin noticed about this subject"
                        style={{
                            width: 36, height: 36, borderRadius: 18, overflow: 'hidden',
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: brand.markRing,
                        }}
                    >
                        <Image
                            source={require('../../assets/images/FinSights.png')}
                            style={{ width: 42, height: 42, transform: [{ translateY: 3 }] }}
                            resizeMode="cover"
                        />
                    </TouchableOpacity>

                    <AnimatedPressable
                        onPress={() => setAutoConfigOpen(true)}
                        accessibilityRole="button"
                        accessibilityLabel="AutoConfig — build this subject's grading setup from a syllabus"
                        style={{
                            flexDirection: 'row', alignItems: 'center', gap: 5,
                            paddingHorizontal: 12, height: 36, borderRadius: 18,
                            backgroundColor: '#ffffff',
                        }}
                    >
                        <Ionicons name="color-wand" size={15} color={brand.heroTo} />
                        <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 12.5, color: brand.heroTo }}>AutoConfig</Text>
                    </AnimatedPressable>
                </View>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ══ Standing, in the band ═══════════════════════════════════ */}
                <BandSurface isDark={isDark} motif="bars" slant={BAND_SLANT} style={{ paddingBottom: BAND_SLANT + 16 }}>
                    <View style={{ width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: GUTTER + 4, paddingTop: 4 }}>
                        <TouchableOpacity
                            onPress={() => setSubjectSheetOpen(true)}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel={`${subject.name}. ${Number(subject.units) || 0} units, pass mark ${passPct} percent, target ${targetPct} percent. Edit subject details.`}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text numberOfLines={2} style={{ flexShrink: 1, fontFamily: 'Nunito_900Black', fontSize: 23, lineHeight: 28, color: brand.onHero, letterSpacing: -0.5 }}>
                                    {subject.name || 'Untitled subject'}
                                </Text>
                                <Ionicons name="create-outline" size={16} color={brand.onHeroMuted} />
                            </View>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                {bandChip(`${Number(subject.units) || 0} unit${Number(subject.units) === 1 ? '' : 's'}`)}
                                {bandChip(`Pass ${formatWeight(passPct)}%`)}
                                {bandChip(`Goal ${formatWeight(targetPct)}%`, 'flag')}
                                {!isTracked && bandChip('Paused', 'pause')}
                            </View>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 12 }}>
                            <Text numberOfLines={1} style={{ fontFamily: 'Nunito_900Black', fontSize: 42, lineHeight: 48, color: brand.onHero, letterSpacing: -1.4 }}>
                                {res.hasData ? `${res.percent.toFixed(1)}%` : '—'}
                            </Text>
                            <View style={{ flex: 1 }}>
                                {res.hasData && system !== 'PERCENT' && (
                                    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 9, height: 24, borderRadius: 999, justifyContent: 'center', backgroundColor: '#ffffff' }}>
                                        <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 12, color: brand.heroTo }}>Grade {res.equivalent.toFixed(2)}</Text>
                                    </View>
                                )}
                                <Text numberOfLines={1} style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: brand.onHeroMuted, marginTop: 4 }}>
                                    {res.hasData ? getGradeTierLabel(res.percent, true) : total === 0 ? 'Set up grading below' : 'Log a score to start'}
                                    {total > 0 ? ` · ${filled}/${total} in` : ''}
                                </Text>
                            </View>
                        </View>

                        <View style={{ marginTop: 12 }}>
                            <GradeScale
                                percent={res.hasData ? res.percent : null}
                                marks={marks}
                                track={brand.wellStrong}
                                fill="#ffffff"
                                ink={brand.onHero}
                                inkMuted={brand.onHeroMuted}
                                pinRing={brand.heroTo}
                                accessibilityLabel={res.hasData ? `${res.percent.toFixed(1)} percent against a passing mark of ${passPct}` : 'No score on the scale yet'}
                            />
                        </View>
                    </View>
                </BandSurface>

                <View style={{ width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: GUTTER, paddingTop: 12 }}>
                    {/* ══ What you still need ═════════════════════════════════ */}
                    {renderOutlook()}

                    {periods.length === 0 ? (
                        /* ══ No grading setup yet ═══════════════════════════ */
                        <Card padding={0} radius={Radius['2xl']} style={{ overflow: 'hidden' }}>
                            <View style={{ padding: 18 }}>
                                <View style={{
                                    width: 46, height: 46, borderRadius: 15, marginBottom: 12, alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: tints.grades.fill, borderWidth: 1, borderColor: tints.grades.line,
                                }}>
                                    <Ionicons name="layers-outline" size={22} color={tints.grades.ink} />
                                </View>
                                <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 17, color: theme.text, letterSpacing: -0.3 }}>How is this subject graded?</Text>
                                <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 13, lineHeight: 19, color: theme.textSecondary, marginTop: 4 }}>
                                    Start with its periods, like Prelim, Midterm and Finals. Or let Fin read your syllabus and set everything up.
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                                    <AnimatedPressable
                                        onPress={() => setGroupTarget({ kind: 'period', mode: 'create' })}
                                        accessibilityRole="button"
                                        accessibilityLabel="Add a period"
                                        style={{
                                            flex: 1, height: 46, borderRadius: Radius.lg, flexDirection: 'row', gap: 6,
                                            alignItems: 'center', justifyContent: 'center',
                                            backgroundColor: theme.primary, borderBottomWidth: 3, borderBottomColor: theme.primaryDark,
                                        }}
                                    >
                                        <Ionicons name="add" size={17} color="#ffffff" />
                                        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: '#ffffff' }}>Add period</Text>
                                    </AnimatedPressable>
                                    <TouchableOpacity
                                        onPress={() => setAutoConfigOpen(true)}
                                        activeOpacity={0.75}
                                        accessibilityRole="button"
                                        accessibilityLabel="Set up from syllabus with AutoConfig"
                                        style={{
                                            flex: 1, height: 46, borderRadius: Radius.lg, flexDirection: 'row', gap: 6,
                                            alignItems: 'center', justifyContent: 'center',
                                            backgroundColor: tints.tools.fill, borderWidth: 1, borderColor: tints.tools.line,
                                        }}
                                    >
                                        <Ionicons name="color-wand" size={16} color={tints.tools.ink} />
                                        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: tints.tools.ink }}>From syllabus</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Card>
                    ) : (
                        <>
                            {/* ══ Periods, as tabs ═══════════════════════════ */}
                            <SectionHeader
                                title="Grading"
                                count={periods.length}
                                railColor={tints.grades.solid}
                                actionLabel="Period"
                                actionIcon="add"
                                actionColor={tints.grades.ink}
                                onAction={() => setGroupTarget({ kind: 'period', mode: 'create' })}
                            />

                            {pSummary.warning && <WeightWarning tints={tints} text={`Periods: ${pSummary.warning}`} />}

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={{ marginHorizontal: -GUTTER, marginBottom: 16 }}
                                contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 8 }}
                            >
                                {periods.map((per: any, i: number) => {
                                    const active = i === selIdx;
                                    const pd = Calculator.calculatePeriod(per, passPct);
                                    const wash = getGradeTierWash(pd.percent, isDark, pd.hasData);
                                    const color = getGradeTierColor(pd.percent, isDark, pd.hasData);
                                    return (
                                        <TouchableOpacity
                                            key={per.id || i}
                                            onPress={() => setSelectedPeriodId(per.id)}
                                            activeOpacity={0.8}
                                            accessibilityRole="tab"
                                            accessibilityState={{ selected: active }}
                                            accessibilityLabel={`${per.name}, ${pd.hasData ? formatGrade(pd.percent, passPct, system) : 'no scores'}, ${formatWeight(effectiveWeight(per.weight, pSummary))} percent of the subject`}
                                            style={{
                                                minWidth: 96, paddingHorizontal: 12, paddingTop: 9, paddingBottom: 10, borderRadius: 16,
                                                backgroundColor: active ? theme.surface : theme.surfaceSecondary,
                                                borderWidth: active ? 2 : 1,
                                                borderColor: active ? tints.grades.solid : theme.cardBorder,
                                            }}
                                        >
                                            <Text numberOfLines={1} style={{ maxWidth: 130, fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: active ? theme.text : theme.textSecondary }}>
                                                {per.name || `Period ${i + 1}`}
                                            </Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                                <View style={{ paddingHorizontal: 6, height: 22, borderRadius: 7, justifyContent: 'center', backgroundColor: wash.fill }}>
                                                    <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 14, color }}>
                                                        {pd.hasData ? formatGrade(pd.percent, passPct, system) : '—'}
                                                    </Text>
                                                </View>
                                                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textTertiary }}>
                                                    {formatWeight(effectiveWeight(per.weight, pSummary))}%
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            {renderPeriod()}
                        </>
                    )}
                </View>
            </ScrollView>

            {/* ══ Sheets ════════════════════════════════════════════════════ */}
            <ScoreSheet
                visible={Boolean(scoreTarget && scoreProps)}
                onClose={() => setScoreTarget(null)}
                mode={scoreTarget?.mode ?? 'create'}
                context={scoreProps?.context ?? ''}
                initial={scoreProps?.initial ?? {}}
                resetKey={scoreResetKey}
                autoWeight={scoreProps?.autoWeight ?? 0}
                weightScope={scoreProps?.weightScope ?? ''}
                partCount={scoreProps?.partCount ?? 0}
                canAddPart={scoreProps?.canAddPart ?? false}
                onSave={handleScoreSave}
                onDelete={handleScoreDelete}
            />

            <GroupSheet
                visible={Boolean(groupTarget && groupProps)}
                onClose={() => setGroupTarget(null)}
                kind={groupTarget?.kind ?? 'period'}
                mode={groupTarget?.mode ?? 'create'}
                initial={groupProps?.initial ?? {}}
                parentName={groupProps?.parentName ?? ''}
                autoWeight={groupProps?.autoWeight ?? 0}
                onSave={handleGroupSave}
                onDelete={handleGroupDelete}
            />

            <SubjectSheet
                visible={subjectSheetOpen}
                onClose={() => setSubjectSheetOpen(false)}
                initial={subjectDraft}
                onSave={(d) => {
                    const next = JSON.parse(JSON.stringify(subject));
                    next.name = d.name;
                    next.units = d.units;
                    next.passingPercent = d.passingPercent;
                    next.targetValue = d.targetValue;
                    onChange(next);
                    setSubjectSheetOpen(false);
                }}
            />

            {/* ══ FinSights ═════════════════════════════════════════════════ */}
            <Modal visible={finOpen} animationType="fade" transparent onRequestClose={() => setFinOpen(false)}>
                <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20, backgroundColor: theme.overlay }}>
                    <Card padding={0} radius={Radius['3xl']} style={{ overflow: 'hidden' }}>
                        <View style={{
                            flexDirection: 'row', alignItems: 'center', padding: 16,
                            backgroundColor: tints.grades.fill,
                            borderBottomWidth: 1, borderBottomColor: tints.grades.line,
                        }}>
                            <View style={{
                                width: 44, height: 44, borderRadius: 15, overflow: 'hidden', marginRight: 12,
                                alignItems: 'center', justifyContent: 'center',
                                backgroundColor: theme.surface, borderWidth: 1, borderColor: tints.grades.line,
                            }}>
                                <Image
                                    source={require('../../assets/images/FinSights.png')}
                                    style={{ width: 52, height: 52, transform: [{ translateY: 4 }] }}
                                    resizeMode="cover"
                                />
                            </View>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 20, color: theme.text, letterSpacing: -0.4 }}>FinSights</Text>
                                <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: theme.textSecondary }}>Here's what I noticed…</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setFinOpen(false)}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel="Close"
                                style={{ width: 32, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface }}
                            >
                                <Ionicons name="close" size={17} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={{ padding: 18, gap: 14 }}>
                            {res.hasData ? (
                                <>
                                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                        <Text style={{ fontSize: 20, marginRight: 11 }}>{outlook.kind === 'reached' ? '🎉' : '🎯'}</Text>
                                        <Text style={{ flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: theme.textSecondary, lineHeight: 20 }}>{outlook.message}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                        <Text style={{ fontSize: 20, marginRight: 11 }}>💡</Text>
                                        <Text style={{ flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: theme.textSecondary, lineHeight: 20 }}>
                                            Focus on upcoming heavily weighted items. Keep your momentum up!
                                        </Text>
                                    </View>
                                </>
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                    <Text style={{ fontSize: 20, marginRight: 11 }}>👋</Text>
                                    <Text style={{ flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: theme.textSecondary, lineHeight: 20 }}>
                                        Add some scores and I'll analyze your subject for you!
                                    </Text>
                                </View>
                            )}
                        </View>
                    </Card>
                </View>
            </Modal>

            {/* ══ AutoConfig ════════════════════════════════════════════════
                A sheet now, not a centred card: it has a text field, and the
                centred modal had no keyboard handling at all. */}
            <KeyboardSheet
                visible={autoConfigOpen}
                onClose={() => setAutoConfigOpen(false)}
                title="AutoConfig"
                subtitle="Paste your syllabus or let Fin scan a photo of it. This replaces the current setup."
                icon="color-wand"
                tint={tints.tools}
                footer={
                    <AnimatedPressable
                        onPress={handleAutoConfig}
                        disabled={isProcessing}
                        accessibilityRole="button"
                        accessibilityLabel={isProcessing ? 'Analyzing' : 'Auto-configure this subject'}
                        style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                            height: 50, borderRadius: Radius.lg,
                            backgroundColor: isProcessing ? theme.surfaceSecondary : theme.primary,
                            borderBottomWidth: 3,
                            borderBottomColor: isProcessing ? theme.cardBorder : theme.primaryDark,
                        }}
                    >
                        {isProcessing ? (
                            <ActivityIndicator color={theme.textSecondary} style={{ marginRight: 8 }} />
                        ) : (
                            <Ionicons name="sparkles" size={17} color="#ffffff" style={{ marginRight: 8 }} />
                        )}
                        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 15.5, color: isProcessing ? theme.textSecondary : '#ffffff' }}>
                            {isProcessing ? 'Analyzing…' : 'Auto-configure'}
                        </Text>
                    </AnimatedPressable>
                }
            >
                <TouchableOpacity
                    onPress={pickImage}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={autoConfigImage ? 'Change syllabus image' : 'Add a syllabus image'}
                    style={{
                        height: 120, borderRadius: Radius.lg, marginBottom: 12,
                        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                        borderWidth: 1, borderStyle: autoConfigImage ? 'solid' : 'dashed',
                        borderColor: autoConfigImage ? theme.cardBorder : (isDark ? '#3d4468' : '#cbd5e1'),
                        backgroundColor: theme.inputBg,
                    }}
                >
                    {autoConfigImage ? (
                        <View style={{ width: '100%', height: '100%' }}>
                            <Image source={{ uri: autoConfigImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            <TouchableOpacity
                                onPress={() => { setAutoConfigImage(null); setAutoConfigBase64(null); }}
                                accessibilityRole="button"
                                accessibilityLabel="Remove image"
                                style={{
                                    position: 'absolute', top: 6, right: 6,
                                    width: 26, height: 26, borderRadius: 13,
                                    alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: 'rgba(15,23,42,0.75)',
                                }}
                            >
                                <Ionicons name="close" size={15} color="#ffffff" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <Ionicons name="image-outline" size={26} color={theme.textTertiary} />
                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.textSecondary, marginTop: 5 }}>
                                Add a photo of the syllabus
                            </Text>
                        </>
                    )}
                </TouchableOpacity>

                <TextInput
                    multiline
                    value={syllabusText}
                    onChangeText={setSyllabusText}
                    placeholder="Or type it: Prelim 30% (Quizzes 40%, Exam 60%)…"
                    placeholderTextColor={theme.textTertiary}
                    accessibilityLabel="Syllabus text"
                    style={{
                        minHeight: 110, padding: 12, borderRadius: Radius.lg,
                        textAlignVertical: 'top',
                        fontFamily: 'Nunito_400Regular', fontSize: 13.5,
                        color: theme.text,
                        backgroundColor: theme.inputBg,
                        borderWidth: 1, borderColor: theme.inputBorder,
                    }}
                />
            </KeyboardSheet>
        </View>
    );
}
