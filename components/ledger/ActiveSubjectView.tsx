import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Image, LayoutAnimation, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calculator } from '../../utils/calculator';
import { useColorScheme } from 'nativewind';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../services/supabaseClient';
import { AlertService } from '@/components/CustomAlert';
import Card from '@/components/ui/Card';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import { getGradeTierColor } from '@/utils/gradeTiers';
import { useTabBarHeight } from '@/components/CustomTabBar';

// Removed LayoutAnimation config as it causes warnings in the New Architecture

const generateId = () => Math.random().toString(36).substr(2, 9);

const GUTTER = 14;

const getWeightWarning = (explicitSum: number, blankCount: number, arrValues: any[]) => {
    let msgs = [];
    if (blankCount === 0 && Math.abs(explicitSum - 100) > 0.1) msgs.push(`Total ${explicitSum}% (should be 100%)`);
    if (explicitSum > 100) msgs.push(`Exceeds 100%`);
    if (arrValues.some(w => w !== '' && w !== null && w !== undefined && Number(w) === 0)) msgs.push(`A weight is 0%`);
    return msgs.length ? msgs.join(' | ') : null;
};

/**
 * The inline "WT __ %" control used at every level of the tree.
 *
 * Hoisted to module scope on purpose: defined inside `ActiveSubjectView` it
 * would be a fresh component type on every render, so React would remount the
 * TextInput — and drop the keyboard — after each keystroke.
 */
function WeightField({ theme, value, placeholder, onChange, compact }: {
    theme: any; value: any; placeholder: string; onChange: (t: string) => void; compact?: boolean;
}) {
    return (
        <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 7, height: compact ? 24 : 28, borderRadius: 8,
            backgroundColor: theme.surfaceSecondary,
            borderWidth: 1, borderColor: theme.cardBorder,
        }}>
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 9.5, color: theme.textTertiary, marginRight: 3 }}>WT</Text>
            <TextInput
                keyboardType="numeric"
                placeholder={placeholder}
                placeholderTextColor={theme.textTertiary}
                value={value?.toString()}
                onChangeText={onChange}
                accessibilityLabel="Weight percentage"
                style={{
                    fontFamily: 'Nunito_800ExtraBold', color: theme.text, padding: 0, textAlign: 'right',
                    fontSize: compact ? 11 : 12, minWidth: 26,
                }}
            />
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 9.5, color: theme.textTertiary, marginLeft: 1 }}>%</Text>
        </View>
    );
}

/** Weight totals that do not add to 100 are a data problem, not a style. */
function WeightWarning({ tints, text, compact }: { tints: any; text: string; compact?: boolean }) {
    return (
        <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 10, paddingVertical: compact ? 5 : 7, borderRadius: Radius.sm,
            marginBottom: compact ? 8 : 12,
            backgroundColor: tints.danger.fill,
            borderWidth: 1, borderColor: tints.danger.line,
        }}>
            <Ionicons name="warning" size={compact ? 11 : 13} color={tints.danger.ink} style={{ marginRight: 6 }} />
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: compact ? 10.5 : 11.5, color: tints.danger.ink, flex: 1 }}>{text}</Text>
        </View>
    );
}

/** Dashed "add another one of these" row. One recipe at three scales. */
function AddRow({ theme, isDark, label, onPress, size = 'md' }: {
    theme: any; isDark: boolean; label: string; onPress: () => void; size?: 'sm' | 'md' | 'lg';
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
                height: size === 'lg' ? 46 : size === 'md' ? 40 : 32,
                borderRadius: Radius.md,
                borderWidth: 1, borderStyle: 'dashed',
                borderColor: isDark ? '#3d4468' : '#cbd5e1',
            }}
        >
            <Ionicons name="add" size={size === 'sm' ? 13 : 15} color={theme.textSecondary} />
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: size === 'sm' ? 11.5 : 13, color: theme.textSecondary }}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

/**
 * One subject, in full: its standing, what it still needs, and the period /
 * component / item tree that produces the number.
 *
 * Two things about the old layout are deliberately reversed here. The Back
 * button used to live inside the scroll, so it disappeared the moment a student
 * started entering scores — it is now a fixed header. And the Target Goal panel
 * sat *below* every period, which put the one question a student actually opens
 * this screen to answer ("what do I still need?") at the very bottom of a long
 * page; it now sits directly under the standing card.
 */
export default function ActiveSubjectView({ subject, system, onChange, onBack }: any) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);
    const tabBarHeight = useTabBarHeight();

    const [finOpen, setFinOpen] = useState(false);
    const [autoConfigOpen, setAutoConfigOpen] = useState(false);
    const [syllabusText, setSyllabusText] = useState('');
    const [autoConfigImage, setAutoConfigImage] = useState<string | null>(null);
    const [autoConfigBase64, setAutoConfigBase64] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [expandedPeriods, setExpandedPeriods] = useState<Record<string, boolean>>({});
    const [expandedComponents, setExpandedComponents] = useState<Record<string, boolean>>({});

    const togglePeriod = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedPeriods(prev => ({...prev, [id]: !prev[id]}));
    };

    const toggleComponent = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedComponents(prev => ({...prev, [id]: !prev[id]}));
    };

    const updateSubject = (updater: (s: any) => void) => {
        const newSubject = JSON.parse(JSON.stringify(subject));
        updater(newSubject);
        onChange(newSubject);
    };

    const res = Calculator.calculateSubject(subject, system);
    const passPct = Number(subject.passingPercent) || 60;
    const barW = res.hasData ? Math.max(0, Math.min(100, res.percent)) : 0;
    const tierColor = getGradeTierColor(res.percent, isDark, res.hasData);

    let pExplicit = 0, pBlank = 0;
    subject.periods.forEach((p: any) => { if (p.weight !== '' && p.weight !== null && p.weight !== undefined) pExplicit += Number(p.weight) || 0; else pBlank++; });
    const pAutoW = pBlank > 0 ? (Math.max(0, 100 - pExplicit) / pBlank) : 0;
    const pWarning = getWeightWarning(pExplicit, pBlank, subject.periods.map((p:any) => p.weight));

    // Target GPA Logic
    const targetValue = subject.targetValue || passPct;
    const targetPercent = Number(targetValue); // Simplifying to percent for now
    const needed = targetPercent - res.absoluteEarned;
    const remainingWeight = res.absoluteAvailable;

    let targetMsg = "";
    let targetIcon = "";
    let targetTint = tints.schedule;
    let distributionHtml: any = null;

    if (needed <= 0) {
        targetMsg = "You have reached your desired grade!";
        targetIcon = "checkmark-circle";
        targetTint = tints.attendance;
    } else if (remainingWeight <= 0 && needed > 0) {
        targetMsg = "All components are filled. Target cannot be reached.";
        targetIcon = "warning";
        targetTint = tints.danger;
    } else if (needed > remainingWeight) {
        const passNeeded = passPct - res.absoluteEarned;
        if (passNeeded <= 0) {
            targetMsg = "Target is impossible, but you've already passed!";
            targetIcon = "alert-circle";
            targetTint = tints.tasks;
        } else if (passNeeded > remainingWeight) {
            targetMsg = "Target is impossible, and you cannot pass anymore.";
            targetIcon = "close-circle";
            targetTint = tints.danger;
        } else {
            targetMsg = "Target is impossible, but you can still pass!";
            targetIcon = "warning";
            targetTint = tints.tasks;
            const reqPct = passNeeded / remainingWeight;
            distributionHtml = { emptyComps: res.emptyComponents, reqPct, label: 'to pass the subject' };
        }
    } else {
        targetMsg = `You need ${needed.toFixed(1)} more points (out of remaining ${remainingWeight.toFixed(1)}%) to reach ${targetPercent.toFixed(1)}%.`;
        targetIcon = "locate";
        targetTint = tints.schedule;
        const reqPct = needed / remainingWeight;
        distributionHtml = { emptyComps: res.emptyComponents, reqPct, label: 'for your desired grade' };
    }

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            base64: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            setAutoConfigImage(result.assets[0].uri);
            if (result.assets[0].base64) {
                setAutoConfigBase64(result.assets[0].base64);
            }
        }
    };

    const handleAutoConfig = async () => {
        if (!syllabusText && !autoConfigImage) {
            AlertService.alert("Missing Input", "Please provide a text prompt or upload an image of your syllabus.");
            return;
        }

        setIsProcessing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                AlertService.alert("Authentication Required", "You must be logged in to use the AI AutoConfig feature.");
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
                body: { textPrompt: syllabusText, base64Data }
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
                updateSubject(s => {
                    // Make sure ids are generated
                    const addIds = (items: any[]): any[] => items.map(i => ({
                        ...i, id: generateId(),
                        components: i.components ? addIds(i.components) : [],
                        items: i.items ? addIds(i.items) : [],
                        subItems: i.subItems ? addIds(i.subItems) : []
                    }));
                    s.periods = addIds(data);
                });
                AlertService.alert("Success", "Grading system successfully configured!");
                setAutoConfigOpen(false);
                setSyllabusText('');
                setAutoConfigImage(null);
                setAutoConfigBase64(null);
            } else {
                throw new Error("Invalid response format from AI.");
            }

        } catch (error: any) {
            AlertService.alert("AutoConfig Error", error.message || "An unexpected error occurred.");
        } finally {
            setIsProcessing(false);
        }
    };

    // ─── Shared style atoms ───────────────────────────────────────────────────

    const microLabel = {
        fontFamily: 'Nunito_800ExtraBold' as const,
        fontSize: 10,
        letterSpacing: 0.8,
        textTransform: 'uppercase' as const,
        color: theme.textTertiary,
    };

    const numberField = {
        fontFamily: 'Nunito_800ExtraBold' as const,
        color: theme.text,
        padding: 0,
        textAlign: 'right' as const,
    };

    // ─── The score tree ───────────────────────────────────────────────────────

    const renderItemRecursive = (item: any, pIndex: number, cIndex: number, idx: number, depth: number, itemPath: number[], weightContext: any) => {
        let { iExplicit, iBlank } = weightContext;
        let iAutoW = iBlank > 0 ? (Math.max(0, 100 - iExplicit) / iBlank) : 0;
        const hasSub = !!(item.subItems && item.subItems.length > 0);

        let subWarning = null;
        let siExplicit = 0, siBlank = 0;
        if (hasSub) {
            item.subItems.forEach((si:any) => { if (si.weight !== '' && si.weight !== null && si.weight !== undefined) siExplicit += Number(si.weight) || 0; else siBlank++; });
            subWarning = getWeightWarning(siExplicit, siBlank, item.subItems.map((si:any) => si.weight));
        }

        const ip = Calculator.computeItemPercent(item);

        const updateThisItem = (updater: (it:any)=>void) => {
            updateSubject(s => {
                let targetList = s.periods[pIndex].components[cIndex].items;
                for(let i=0; i<itemPath.length - 1; i++) {
                    targetList = targetList[itemPath[i]].subItems;
                }
                updater(targetList[itemPath[itemPath.length-1]]);
            });
        };

        const deleteThisItem = () => {
            AlertService.alert("Delete", "Delete this item?", [
                {text: "Cancel", style: "cancel"},
                {text: "Delete", style: "destructive", onPress: () => {
                    updateSubject(s => {
                        let targetList = s.periods[pIndex].components[cIndex].items;
                        for(let i=0; i<itemPath.length - 1; i++) {
                            targetList = targetList[itemPath[i]].subItems;
                        }
                        targetList.splice(itemPath[itemPath.length-1], 1);
                    });
                }}
            ]);
        };

        const addSubItemToThis = () => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            updateSubject(s => {
                let targetList = s.periods[pIndex].components[cIndex].items;
                for(let i=0; i<itemPath.length - 1; i++) {
                    targetList = targetList[itemPath[i]].subItems;
                }
                const node = targetList[itemPath[itemPath.length-1]];
                if (!node.subItems) node.subItems = [];
                node.subItems.push({ id: generateId(), name: '', max: 100, isCollapsed: false });
                node.isCollapsed = false;
            });
        };

        return (
            <View
                key={item.id || idx}
                style={{
                    marginBottom: 6, paddingBottom: 6,
                    ...(depth > 0
                        ? { marginLeft: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: theme.cardBorder }
                        : { borderBottomWidth: 1, borderBottomColor: theme.cardBorder }),
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {hasSub && (
                        <TouchableOpacity
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                updateThisItem(it => it.isCollapsed = !it.isCollapsed);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={item.isCollapsed ? 'Expand sub-items' : 'Collapse sub-items'}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                            style={{ marginRight: 6 }}
                        >
                            <Ionicons name={item.isCollapsed ? 'chevron-forward' : 'chevron-down'} size={14} color={theme.textTertiary} />
                        </TouchableOpacity>
                    )}

                    <TextInput
                        selectTextOnFocus
                        value={item.name}
                        onChangeText={txt => updateThisItem(it => it.name = txt)}
                        placeholder={depth === 0 ? `Item ${idx + 1}` : `Sub-item ${idx + 1}`}
                        placeholderTextColor={theme.textTertiary}
                        accessibilityLabel="Item name"
                        style={{
                            flex: 1, paddingVertical: 5, marginRight: 6,
                            fontFamily: 'Nunito_600SemiBold',
                            fontSize: depth > 0 ? 11.5 : 12.5,
                            color: theme.textSecondary,
                        }}
                    />

                    {hasSub ? (
                        <View style={{ minWidth: 66, alignItems: 'center', marginRight: 6 }}>
                            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: theme.text }}>
                                {ip.isEmpty ? '—' : `${(ip.percent * 100).toFixed(1)}%`}
                            </Text>
                        </View>
                    ) : (
                        <View style={{
                            flexDirection: 'row', alignItems: 'center', marginRight: 6,
                            paddingHorizontal: 8, height: 28, borderRadius: 8,
                            backgroundColor: theme.inputBg,
                            borderWidth: 1, borderColor: theme.inputBorder,
                        }}>
                            <TextInput
                                keyboardType="numeric"
                                value={item.score?.toString()}
                                onChangeText={txt => updateThisItem(it => it.score = txt)}
                                placeholder="—"
                                placeholderTextColor={theme.textTertiary}
                                accessibilityLabel="Score"
                                style={{ ...numberField, textAlign: 'center', fontSize: 12.5, minWidth: 28 }}
                            />
                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textTertiary, marginHorizontal: 2 }}>/</Text>
                            <TextInput
                                keyboardType="numeric"
                                value={item.max?.toString()}
                                onChangeText={txt => updateThisItem(it => it.max = txt)}
                                placeholder="100"
                                placeholderTextColor={theme.textTertiary}
                                accessibilityLabel="Maximum score"
                                style={{ ...numberField, textAlign: 'center', fontSize: 11.5, minWidth: 26, color: theme.textSecondary }}
                            />
                        </View>
                    )}

                    <WeightField
                        theme={theme}
                        compact
                        value={item.weight}
                        placeholder={iAutoW.toFixed(1)}
                        onChange={txt => updateThisItem(it => it.weight = txt)}
                    />

                    {(!hasSub && depth < 3) && (
                        <TouchableOpacity
                            onPress={addSubItemToThis}
                            accessibilityRole="button"
                            accessibilityLabel="Add sub-item"
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                            style={{
                                marginLeft: 5, paddingHorizontal: 6, height: 24, borderRadius: 7,
                                alignItems: 'center', justifyContent: 'center',
                                backgroundColor: tints.grades.fill,
                                borderWidth: 1, borderColor: tints.grades.line,
                            }}
                        >
                            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 9.5, color: tints.grades.ink }}>+SUB</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        onPress={deleteThisItem}
                        accessibilityRole="button"
                        accessibilityLabel="Delete item"
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        style={{
                            marginLeft: 5, width: 24, height: 24, borderRadius: 8,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: tints.danger.fill,
                        }}
                    >
                        <Ionicons name="close" size={12} color={tints.danger.ink} />
                    </TouchableOpacity>
                </View>

                {hasSub && !item.isCollapsed && (
                    <View style={{ marginTop: 8 }}>
                        {subWarning && <WeightWarning tints={tints} text={subWarning} compact />}
                        {item.subItems.map((si:any, sidx:number) =>
                            renderItemRecursive(si, pIndex, cIndex, sidx, depth + 1, [...itemPath, sidx], { iExplicit: siExplicit, iBlank: siBlank })
                        )}
                        {depth < 3 && (
                            <View style={{ marginLeft: 8, marginTop: 2 }}>
                                <AddRow theme={theme} isDark={isDark} size="sm" label="Add sub-item" onPress={addSubItemToThis} />
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    // ─── Screen ───────────────────────────────────────────────────────────────

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            {/* ══ Fixed header. Back never scrolls away mid-entry. ═══════════ */}
            <View
                style={{
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 10,
                    backgroundColor: theme.background,
                }}
            >
                <TouchableOpacity
                    onPress={onBack}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Back to subjects"
                    style={{
                        flexDirection: 'row', alignItems: 'center', gap: 2,
                        paddingLeft: 6, paddingRight: 11, height: 34, borderRadius: 12,
                        backgroundColor: theme.surface,
                        borderWidth: 1, borderColor: theme.cardBorder,
                        borderBottomWidth: 2, borderBottomColor: theme.lip,
                    }}
                >
                    <Ionicons name="chevron-back" size={16} color={theme.textSecondary} />
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: theme.textSecondary }}>Subjects</Text>
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                    onPress={() => setFinOpen(true)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="FinSights — what Fin noticed about this subject"
                    style={{
                        width: 34, height: 34, borderRadius: 12, overflow: 'hidden',
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: tints.grades.fill,
                        borderWidth: 1, borderColor: tints.grades.line,
                    }}
                >
                    <Image
                        source={require('../../assets/images/FinSights.png')}
                        style={{ width: 40, height: 40, transform: [{ translateY: 3 }] }}
                        resizeMode="cover"
                    />
                </TouchableOpacity>

                <AnimatedPressable
                    onPress={() => setAutoConfigOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="AutoConfig — build this subject's grading setup from a syllabus"
                    style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        paddingHorizontal: 12, height: 34, borderRadius: 12,
                        backgroundColor: theme.primary,
                        borderBottomWidth: 2, borderBottomColor: theme.primaryDark,
                    }}
                >
                    <Ionicons name="color-wand" size={15} color="#ffffff" />
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: '#ffffff' }}>AutoConfig</Text>
                </AnimatedPressable>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: tabBarHeight + 24 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={{ width: '100%', maxWidth: 620, alignSelf: 'center' }}>

                    {/* ══ Standing ═══════════════════════════════════════════ */}
                    <Card padding={0} radius={Radius['2xl']} style={{ overflow: 'hidden', marginBottom: 14 }}>
                        <View style={{ padding: 16, backgroundColor: tints.grades.fill, borderBottomWidth: 1, borderBottomColor: tints.grades.line }}>
                            <Text style={{ ...microLabel, color: tints.grades.ink }}>Subject</Text>
                            <TextInput
                                selectTextOnFocus
                                value={subject.name}
                                onChangeText={txt => updateSubject(s => s.name = txt)}
                                placeholder="Subject name"
                                placeholderTextColor={theme.textTertiary}
                                autoCapitalize="characters"
                                accessibilityLabel="Subject name"
                                style={{
                                    fontFamily: 'Nunito_900Black', fontSize: 26, letterSpacing: -0.6,
                                    color: theme.text, padding: 0, marginTop: 2,
                                }}
                            />

                            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 14, marginBottom: 8 }}>
                                <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 34, letterSpacing: -1, color: res.hasData ? tierColor : theme.textTertiary, lineHeight: 38 }}>
                                    {res.hasData ? `${res.percent.toFixed(1)}%` : '—'}
                                </Text>
                                <View style={{ flex: 1 }} />
                                <View style={{
                                    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
                                    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.cardBorder,
                                }}>
                                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: theme.text }}>
                                        {system === 'PERCENT'
                                            ? (res.hasData ? `${res.equivalent.toFixed(1)}%` : 'No data')
                                            : (res.hasData ? `GWA ${res.equivalent.toFixed(2)}` : 'No data')}
                                    </Text>
                                </View>
                            </View>

                            {/* Bar with the passing mark drawn on it */}
                            <View style={{
                                height: 10, borderRadius: Radius.full, overflow: 'hidden',
                                backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(15,23,42,0.08)',
                            }}>
                                <View style={{ height: '100%', width: `${barW}%`, borderRadius: Radius.full, backgroundColor: res.hasData ? tierColor : theme.textTertiary }} />
                                <View style={{ position: 'absolute', height: '100%', width: 2, left: `${Math.max(0, Math.min(100, passPct))}%`, backgroundColor: theme.text, opacity: 0.55 }} />
                            </View>
                            <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 10.5, color: theme.textSecondary, marginTop: 5 }}>
                                The marker is your {passPct}% passing mark
                            </Text>
                        </View>

                        {pWarning && (
                            <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
                                <WeightWarning tints={tints} text={`Period weights: ${pWarning}`} />
                            </View>
                        )}

                        {/* Units / pass % / target — the three numbers that define the subject */}
                        <View style={{ flexDirection: 'row' }}>
                            {([
                                {
                                    key: 'units', label: 'Units', suffix: '',
                                    value: subject.units?.toString(), placeholder: '3',
                                    onChange: (txt: string) => updateSubject(s => s.units = txt),
                                    hint: 'Weight in your GWA',
                                },
                                {
                                    key: 'pass', label: 'Pass mark', suffix: '%',
                                    value: subject.passingPercent?.toString(), placeholder: '60',
                                    onChange: (txt: string) => updateSubject(s => s.passingPercent = txt),
                                    hint: 'Lowest passing score',
                                },
                                {
                                    key: 'target', label: 'Target', suffix: '%',
                                    value: subject.targetValue?.toString(), placeholder: passPct.toString(),
                                    onChange: (txt: string) => updateSubject(s => s.targetValue = txt),
                                    hint: 'What you are aiming for',
                                },
                            ]).map((field, i) => (
                                <View
                                    key={field.key}
                                    style={{
                                        flex: 1, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 12,
                                        borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: theme.cardBorder,
                                    }}
                                >
                                    <Text numberOfLines={1} style={microLabel}>{field.label}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 2 }}>
                                        <TextInput
                                            keyboardType="numeric"
                                            value={field.value}
                                            placeholder={field.placeholder}
                                            placeholderTextColor={theme.textTertiary}
                                            onChangeText={field.onChange}
                                            accessibilityLabel={`${field.label}. ${field.hint}`}
                                            style={{
                                                fontFamily: 'Nunito_900Black', fontSize: 20, letterSpacing: -0.5,
                                                color: theme.text, padding: 0, minWidth: 30,
                                            }}
                                        />
                                        {!!field.suffix && (
                                            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13, color: theme.textTertiary }}>{field.suffix}</Text>
                                        )}
                                    </View>
                                    <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 10, color: theme.textTertiary, marginTop: 1 }}>
                                        {field.hint}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </Card>

                    {/* ══ What you still need — the reason this screen exists,
                           so it sits above the tree rather than under it. ═════ */}
                    <Card
                        padding={0}
                        radius={Radius['2xl']}
                        fill={targetTint.fill}
                        border={targetTint.line}
                        style={{ overflow: 'hidden', marginBottom: 20 }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 14 }}>
                            <View style={{
                                width: 36, height: 36, borderRadius: 12, marginRight: 11,
                                alignItems: 'center', justifyContent: 'center',
                                backgroundColor: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.75)',
                            }}>
                                <Ionicons name={targetIcon as any} size={19} color={targetTint.ink} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ ...microLabel, color: targetTint.ink }}>Target · {targetPercent.toFixed(0)}%</Text>
                                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: theme.text, lineHeight: 19, marginTop: 3 }}>
                                    {targetMsg}
                                </Text>
                            </View>
                        </View>

                        {distributionHtml && distributionHtml.emptyComps.length > 0 && (
                            <View style={{ borderTopWidth: 1, borderTopColor: targetTint.line, padding: 14 }}>
                                <Text style={{ ...microLabel, color: targetTint.ink, marginBottom: 10 }}>
                                    Scores needed {distributionHtml.label}
                                </Text>

                                <View style={{ gap: 6 }}>
                                    {distributionHtml.emptyComps.map((c:any) => {
                                        const scoreNeeded = distributionHtml.reqPct * c.sumMax;
                                        return (
                                            <View
                                                key={c.id}
                                                style={{
                                                    flexDirection: 'row', alignItems: 'center',
                                                    paddingHorizontal: 12, paddingVertical: 10, borderRadius: Radius.md,
                                                    backgroundColor: theme.surface,
                                                    borderWidth: 1, borderColor: theme.cardBorder,
                                                }}
                                            >
                                                <Text numberOfLines={2} style={{ flex: 1, marginRight: 10, fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: theme.textSecondary }}>
                                                    {c.periodName} — {c.name}
                                                </Text>
                                                <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 14, color: theme.text }}>
                                                    {scoreNeeded.toFixed(1)}
                                                    <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 10.5, color: theme.textTertiary }}> / {c.sumMax}</Text>
                                                </Text>
                                                <View style={{
                                                    marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
                                                    backgroundColor: targetTint.fill, borderWidth: 1, borderColor: targetTint.line,
                                                }}>
                                                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 9.5, color: targetTint.ink }}>
                                                        {(distributionHtml.reqPct * 100).toFixed(1)}%
                                                    </Text>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        )}
                    </Card>

                    {/* ══ Periods ════════════════════════════════════════════ */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: tints.grades.solid, marginRight: 9 }} />
                        <Text accessibilityRole="header" style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: theme.text, letterSpacing: -0.2 }}>
                            Grading setup
                        </Text>
                        <View style={{
                            marginLeft: 8, minWidth: 22, paddingHorizontal: 7, paddingVertical: 2,
                            borderRadius: Radius.full, alignItems: 'center', backgroundColor: theme.surfaceSecondary,
                        }}>
                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textSecondary }}>
                                {subject.periods.length}
                            </Text>
                        </View>
                    </View>

                    {subject.periods.map((per: any, pIndex: number) => {
                        const pd = Calculator.calculatePeriod(per, passPct);
                        const pdGradeEq = Calculator.interpolateGrade(pd.percent, passPct, system);
                        const pdDisplayGrade = system === 'PERCENT' ? pd.percent.toFixed(2) + '%' : pdGradeEq.toFixed(2);

                        let cExplicit = 0, cBlank = 0;
                        const safeComps = per.components || [];
                        safeComps.forEach((c: any) => { if (c.weight !== '' && c.weight !== null && c.weight !== undefined) cExplicit += Number(c.weight) || 0; else cBlank++; });
                        const cAutoW = cBlank > 0 ? (Math.max(0, 100 - cExplicit) / cBlank) : 0;
                        const cWarning = getWeightWarning(cExplicit, cBlank, safeComps.map((c:any) => c.weight));

                        const isExpanded = expandedPeriods[per.id];
                        const periodTier = getGradeTierColor(pd.percent, isDark, pd.hasData);

                        return (
                            <Card key={per.id} padding={0} radius={Radius.xl} style={{ overflow: 'hidden', marginBottom: 12 }}>
                                {/* ── Period header ───────────────────────── */}
                                <TouchableOpacity
                                    onPress={() => togglePeriod(per.id)}
                                    activeOpacity={0.75}
                                    accessibilityRole="button"
                                    accessibilityState={{ expanded: Boolean(isExpanded) }}
                                    accessibilityLabel={`Period ${per.name}, ${pd.hasData ? pdDisplayGrade : 'no scores'}`}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center', padding: 14,
                                        borderBottomWidth: isExpanded ? 1 : 0, borderBottomColor: theme.cardBorder,
                                    }}
                                >
                                    <Ionicons
                                        name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                                        size={16}
                                        color={theme.textTertiary}
                                        style={{ marginRight: 8 }}
                                    />
                                    <View style={{ flex: 1, marginRight: 10 }}>
                                        <Text style={microLabel}>Period</Text>
                                        <TextInput
                                            selectTextOnFocus
                                            value={per.name}
                                            onChangeText={txt => updateSubject(s => s.periods[pIndex].name = txt)}
                                            placeholder="Period name"
                                            placeholderTextColor={theme.textTertiary}
                                            autoCapitalize="characters"
                                            accessibilityLabel="Period name"
                                            style={{ fontFamily: 'Nunito_900Black', fontSize: 16, letterSpacing: -0.3, color: theme.text, padding: 0, marginTop: 1 }}
                                        />
                                    </View>

                                    <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 16, color: pd.hasData ? periodTier : theme.textTertiary, marginRight: 10 }}>
                                        {pd.hasData ? pdDisplayGrade : '—'}
                                    </Text>

                                    <WeightField
                                        theme={theme}
                                        value={per.weight}
                                        placeholder={pAutoW.toFixed(1)}
                                        onChange={txt => updateSubject(s => s.periods[pIndex].weight = txt)}
                                    />

                                    <TouchableOpacity
                                        onPress={() => {
                                            AlertService.alert("Delete", "Delete Period?", [{text:"Cancel"},{text:"Delete", style:"destructive", onPress:()=>updateSubject(s => s.periods.splice(pIndex, 1))}]);
                                        }}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Delete period ${per.name}`}
                                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                        style={{
                                            marginLeft: 6, width: 28, height: 28, borderRadius: 9,
                                            alignItems: 'center', justifyContent: 'center',
                                            backgroundColor: tints.danger.fill,
                                        }}
                                    >
                                        <Ionicons name="trash-outline" size={13} color={tints.danger.ink} />
                                    </TouchableOpacity>
                                </TouchableOpacity>

                                {/* ── Components ──────────────────────────── */}
                                {isExpanded && (
                                    <View style={{ padding: 12 }}>
                                        {cWarning && <WeightWarning tints={tints} text={cWarning} />}

                                        {safeComps.map((comp: any, cIndex: number) => {
                                            let iExplicit = 0, iBlank = 0;
                                            const safeItems = comp.items || [];
                                            safeItems.forEach((i: any) => { if (i.weight !== '' && i.weight !== null && i.weight !== undefined) iExplicit += Number(i.weight) || 0; else iBlank++; });
                                            const iWarning = getWeightWarning(iExplicit, iBlank, safeItems.map((i:any) => i.weight));

                                            const isCompExpanded = expandedComponents[comp.id];

                                            return (
                                                <Card
                                                    key={comp.id}
                                                    variant="sunken"
                                                    padding={12}
                                                    radius={Radius.lg}
                                                    style={{ marginBottom: 10 }}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <TouchableOpacity
                                                            onPress={() => toggleComponent(comp.id)}
                                                            activeOpacity={0.75}
                                                            accessibilityRole="button"
                                                            accessibilityState={{ expanded: Boolean(isCompExpanded) }}
                                                            accessibilityLabel={`Component ${comp.name}`}
                                                            style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}
                                                        >
                                                            <Ionicons
                                                                name={isCompExpanded ? 'chevron-down' : 'chevron-forward'}
                                                                size={14}
                                                                color={theme.textTertiary}
                                                                style={{ marginRight: 7 }}
                                                            />
                                                            <TextInput
                                                                selectTextOnFocus
                                                                value={comp.name}
                                                                onChangeText={txt => updateSubject(s => s.periods[pIndex].components[cIndex].name = txt)}
                                                                placeholder="Component name"
                                                                placeholderTextColor={theme.textTertiary}
                                                                autoCapitalize="characters"
                                                                accessibilityLabel="Component name"
                                                                style={{ flex: 1, fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: theme.text, padding: 0 }}
                                                            />
                                                        </TouchableOpacity>

                                                        <WeightField
                                                            theme={theme}
                                                            compact
                                                            value={comp.weight}
                                                            placeholder={cAutoW.toFixed(1)}
                                                            onChange={txt => updateSubject(s => s.periods[pIndex].components[cIndex].weight = txt)}
                                                        />

                                                        <TouchableOpacity
                                                            onPress={() => {
                                                                AlertService.alert("Delete", "Delete Component?", [{text:"Cancel"},{text:"Delete", style:"destructive", onPress:()=>updateSubject(s => s.periods[pIndex].components.splice(cIndex, 1))}]);
                                                            }}
                                                            accessibilityRole="button"
                                                            accessibilityLabel={`Delete component ${comp.name}`}
                                                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                                            style={{
                                                                marginLeft: 5, width: 24, height: 24, borderRadius: 8,
                                                                alignItems: 'center', justifyContent: 'center',
                                                                backgroundColor: tints.danger.fill,
                                                            }}
                                                        >
                                                            <Ionicons name="close" size={12} color={tints.danger.ink} />
                                                        </TouchableOpacity>
                                                    </View>

                                                    {isCompExpanded && (
                                                        <View style={{ marginTop: 12 }}>
                                                            {iWarning && <WeightWarning tints={tints} text={iWarning} compact />}
                                                            {safeItems.map((item: any, iIndex: number) =>
                                                                renderItemRecursive(item, pIndex, cIndex, iIndex, 0, [iIndex], { iExplicit, iBlank })
                                                            )}
                                                            <View style={{ marginTop: 6 }}>
                                                                <AddRow
                                                                    theme={theme}
                                                                    isDark={isDark}
                                                                    size="sm"
                                                                    label="Add item"
                                                                    onPress={() => updateSubject(s => { if (!s.periods[pIndex].components[cIndex].items) s.periods[pIndex].components[cIndex].items = []; s.periods[pIndex].components[cIndex].items.push({ id: generateId(), max: 100, subItems: [] }) })}
                                                                />
                                                            </View>
                                                        </View>
                                                    )}
                                                </Card>
                                            );
                                        })}

                                        {safeComps.length === 0 && (
                                            <View style={{
                                                flexDirection: 'row', alignItems: 'center',
                                                padding: 11, borderRadius: Radius.md, marginBottom: 10,
                                                backgroundColor: tints.tasks.fill,
                                                borderWidth: 1, borderColor: tints.tasks.line,
                                            }}>
                                                <Ionicons name="information-circle-outline" size={15} color={tints.tasks.ink} style={{ marginRight: 7 }} />
                                                <Text style={{ flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 11.5, color: theme.textSecondary }}>
                                                    No components yet — add Quizzes, Exams, Projects and so on.
                                                </Text>
                                            </View>
                                        )}

                                        <AddRow
                                            theme={theme}
                                            isDark={isDark}
                                            label="Add component"
                                            onPress={() => updateSubject(s => { if (!s.periods[pIndex].components) s.periods[pIndex].components = []; s.periods[pIndex].components.push({ id: generateId(), name: 'New Component', items: [] }) })}
                                        />

                                        {/* ── Period breakdown ────────────── */}
                                        <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.cardBorder }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                                <Text numberOfLines={1} style={{ ...microLabel, flex: 1, marginRight: 8 }}>
                                                    {per.name} breakdown
                                                </Text>
                                                {pd.hasData && (
                                                    <TouchableOpacity
                                                        onPress={() => setFinOpen(true)}
                                                        activeOpacity={0.7}
                                                        accessibilityRole="button"
                                                        accessibilityLabel="Open FinSights"
                                                        style={{
                                                            flexDirection: 'row', alignItems: 'center',
                                                            paddingLeft: 4, paddingRight: 9, height: 26, borderRadius: Radius.full,
                                                            backgroundColor: tints.grades.fill,
                                                            borderWidth: 1, borderColor: tints.grades.line,
                                                        }}
                                                    >
                                                        <View style={{ width: 19, height: 19, borderRadius: 10, overflow: 'hidden', marginRight: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface }}>
                                                            <Image
                                                                source={require('../../assets/images/FinSights.png')}
                                                                style={{ width: 23, height: 23, transform: [{ translateY: 2 }] }}
                                                                resizeMode="cover"
                                                            />
                                                        </View>
                                                        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 10.5, color: tints.grades.ink }}>FinSights</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>

                                            {pd.hasData ? (
                                                <View style={{ gap: 7 }}>
                                                    {pd.comps.map((c: any) => {
                                                        const cDisplay = system === 'PERCENT' ? `${c.percent.toFixed(2)}%` : Calculator.interpolateGrade(c.percent, passPct, system).toFixed(2);
                                                        return (
                                                            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                <Text numberOfLines={1} style={{ flex: 1, marginRight: 10, fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: theme.textSecondary }}>
                                                                    {c.name}
                                                                </Text>
                                                                <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 12.5, color: c.hasData ? getGradeTierColor(c.percent, isDark, true) : theme.textTertiary }}>
                                                                    {c.hasData ? cDisplay : '—'}
                                                                </Text>
                                                            </View>
                                                        );
                                                    })}
                                                </View>
                                            ) : (
                                                <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textTertiary }}>
                                                    Add scores to see the breakdown.
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                )}
                            </Card>
                        );
                    })}

                    <AddRow
                        theme={theme}
                        isDark={isDark}
                        size="lg"
                        label="Add period"
                        onPress={() => {
                        const newId = generateId();
                        setExpandedPeriods(prev => ({...prev, [newId]: true}));
                        updateSubject(s => s.periods.push({ id: newId, name: 'New Period', components: [] }));
                        }}
                    />
                </View>
            </ScrollView>

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
                                        <Text style={{ fontSize: 20, marginRight: 11 }}>{targetIcon === 'checkmark-circle' ? '🎉' : '🎯'}</Text>
                                        <Text style={{ flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: theme.textSecondary, lineHeight: 20 }}>{targetMsg}</Text>
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

            {/* ══ AutoConfig ════════════════════════════════════════════════ */}
            <Modal visible={autoConfigOpen} animationType="fade" transparent onRequestClose={() => setAutoConfigOpen(false)}>
                <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20, backgroundColor: theme.overlay }}>
                    <Card padding={0} radius={Radius['3xl']} style={{ overflow: 'hidden' }}>
                        <View style={{
                            flexDirection: 'row', alignItems: 'center', padding: 16,
                            backgroundColor: tints.tools.fill,
                            borderBottomWidth: 1, borderBottomColor: tints.tools.line,
                        }}>
                            <View style={{
                                width: 44, height: 44, borderRadius: 15, marginRight: 12,
                                alignItems: 'center', justifyContent: 'center',
                                backgroundColor: theme.surface, borderWidth: 1, borderColor: tints.tools.line,
                            }}>
                                <Ionicons name="color-wand" size={22} color={tints.tools.ink} />
                            </View>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 20, color: theme.text, letterSpacing: -0.4 }}>AutoConfig</Text>
                                <Text numberOfLines={2} style={{ fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: theme.textSecondary }}>
                                    Paste your syllabus below or let Fin scan it
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setAutoConfigOpen(false)}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel="Close"
                                style={{ width: 32, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface }}
                            >
                                <Ionicons name="close" size={17} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={{ padding: 16 }}>
                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                                <TouchableOpacity
                                    onPress={pickImage}
                                    activeOpacity={0.75}
                                    accessibilityRole="button"
                                    accessibilityLabel={autoConfigImage ? 'Change syllabus image' : 'Add a syllabus image'}
                                    style={{
                                        flex: 1, height: 104, borderRadius: Radius.lg,
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
                                            <Text numberOfLines={1} style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textSecondary, marginTop: 5 }}>
                                                Add image
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <TextInput
                                    multiline
                                    value={syllabusText}
                                    onChangeText={setSyllabusText}
                                    placeholder="Or type instructions…"
                                    placeholderTextColor={theme.textTertiary}
                                    accessibilityLabel="Syllabus text"
                                    style={{
                                        flex: 1, height: 104, padding: 12, borderRadius: Radius.lg,
                                        textAlignVertical: 'top',
                                        fontFamily: 'Nunito_400Regular', fontSize: 13,
                                        color: theme.text,
                                        backgroundColor: theme.inputBg,
                                        borderWidth: 1, borderColor: theme.inputBorder,
                                    }}
                                />
                            </View>

                            <AnimatedPressable
                                onPress={handleAutoConfig}
                                disabled={isProcessing}
                                accessibilityRole="button"
                                accessibilityLabel={isProcessing ? 'Analyzing' : 'Auto-configure this subject'}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                    paddingVertical: 14, borderRadius: Radius.lg,
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
                        </View>
                    </Card>
                </View>
            </Modal>
        </View>
    );
}
