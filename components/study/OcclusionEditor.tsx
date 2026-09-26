import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, PanResponder, ActivityIndicator, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect, Ellipse } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import { AlertService } from '@/components/CustomAlert';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import { OcclusionData, OcclusionMask } from './types';
import {
    MIN_MASK, rectFromDrag, moveMask, resizeMask, maskAt, nextGroup, groupMasks, ungroupMasks, occlusionOrds, validateOcclusion,
} from './occlusion';
import { saveImage } from './imageStore';
import { useStoredImage, MASK_COLORS } from './OcclusionImage';

interface OcclusionEditorProps {
    visible: boolean;
    isDark: boolean;
    initial: OcclusionData | null;
    onClose: () => void;
    onDone: (data: OcclusionData) => void;
}

type Drag =
    | { kind: 'draw'; x0: number; y0: number; x1: number; y1: number }
    | { kind: 'move'; id: string; start: OcclusionMask; moved: boolean }
    | { kind: 'resize'; id: string; start: OcclusionMask; moved: boolean };

const newMaskId = () => `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
/** Touch target for the resize handle, in points. */
const HANDLE = 26;

/**
 * Drawing the boxes. One gesture does everything, because a phone has no
 * tool palette to spare: drag on empty picture to draw, drag a box to move
 * it, drag its corner handle to resize, tap a box to select it. Grouping —
 * Anki's way of asking several boxes as one card — works on a multi-select.
 */
export default function OcclusionEditor({ visible, isDark, initial, onClose, onDone }: OcclusionEditorProps) {
    const theme = getTheme(isDark);
    const tints = getTints(isDark);
    const insets = useSafeAreaInsets();

    const [data, setData] = useState<OcclusionData | null>(initial);
    const [selected, setSelected] = useState<string[]>([]);
    const [multi, setMulti] = useState(false);
    const [shape, setShape] = useState<'rect' | 'ellipse'>('rect');
    const [drag, setDrag] = useState<Drag | null>(null);
    const [busy, setBusy] = useState(false);
    const [undo, setUndo] = useState<OcclusionMask[][]>([]);
    const [canvas, setCanvas] = useState({ w: 0, h: 0 });

    useEffect(() => {
        if (!visible) return;
        setData(initial);
        setSelected([]);
        setMulti(false);
        setUndo([]);
        setDrag(null);
    }, [visible]);

    const uri = useStoredImage(data?.imageId);
    const masks = data?.masks || [];
    const ratio = data && data.width > 0 && data.height > 0 ? data.width / data.height : 4 / 3;

    // The responder closes over refs so it can be created once.
    const live = useRef({ data, selected, multi, shape, canvas, drag: null as Drag | null });
    live.current = { ...live.current, data, selected, multi, shape, canvas };

    const setMasks = (next: OcclusionMask[], snapshot = true) => {
        const d = live.current.data;
        if (!d) return;
        if (snapshot) setUndo((u) => [...u.slice(-29), d.masks]);
        const nd = { ...d, masks: next };
        live.current.data = nd;
        setData(nd);
    };

    const pickImage = async (camera: boolean) => {
        try {
            if (camera) {
                const perm = await ImagePicker.requestCameraPermissionsAsync();
                if (!perm.granted) {
                    AlertService.alert('Camera not allowed', 'Allow camera access in your phone settings, or choose a photo instead.');
                    return;
                }
            }
            const res = camera
                ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
                : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
            if (res.canceled || !res.assets?.[0]) return;
            setBusy(true);
            const a = res.assets[0];
            const stored = await saveImage(a.uri, a.width, a.height);
            setData((d) => ({
                imageId: stored.id,
                width: stored.width,
                height: stored.height,
                mode: d?.mode || 'hideAll',
                masks: d?.masks || [],
                locate: d?.locate || false,
            }));
        } catch (e: any) {
            AlertService.alert('Could not add that picture', e?.message || 'Try a different image.');
        } finally {
            setBusy(false);
        }
    };

    const pan = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: (e) => {
                const { canvas: c, data: d, selected: sel, multi: mul } = live.current;
                if (!d || c.w <= 0) return;
                const px = e.nativeEvent.locationX / c.w;
                const py = e.nativeEvent.locationY / c.h;
                // The resize handle of the one selected box wins over everything.
                if (sel.length === 1) {
                    const m = d.masks.find((x) => x.id === sel[0]);
                    if (m) {
                        const hx = (m.x + m.w) * c.w;
                        const hy = (m.y + m.h) * c.h;
                        if (Math.abs(e.nativeEvent.locationX - hx) < HANDLE && Math.abs(e.nativeEvent.locationY - hy) < HANDLE) {
                            live.current.drag = { kind: 'resize', id: m.id, start: m, moved: false };
                            setDrag(live.current.drag);
                            return;
                        }
                    }
                }
                const hit = maskAt(d.masks, px, py);
                if (hit) {
                    live.current.drag = { kind: 'move', id: hit.id, start: hit, moved: false };
                    if (mul) setSelected(sel.includes(hit.id) ? sel.filter((i) => i !== hit.id) : [...sel, hit.id]);
                    else setSelected([hit.id]);
                } else {
                    live.current.drag = { kind: 'draw', x0: px, y0: py, x1: px, y1: py };
                }
                setDrag(live.current.drag);
            },
            onPanResponderMove: (_e, g) => {
                const { canvas: c, data: d } = live.current;
                const dr = live.current.drag;
                if (!dr || !d || c.w <= 0) return;
                const dx = g.dx / c.w;
                const dy = g.dy / c.h;
                if (dr.kind === 'draw') {
                    live.current.drag = { ...dr, x1: dr.x0 + dx, y1: dr.y0 + dy };
                    setDrag(live.current.drag);
                } else if (dr.kind === 'move') {
                    if (!dr.moved && Math.abs(g.dx) + Math.abs(g.dy) < 6) return;
                    if (!dr.moved) setUndo((u) => [...u.slice(-29), d.masks]);
                    live.current.drag = { ...dr, moved: true };
                    setMasks(d.masks.map((m) => (m.id === dr.id ? moveMask(dr.start, dx, dy) : m)), false);
                } else {
                    // One undo step per drag, taken on the first movement.
                    if (!dr.moved) {
                        setUndo((u) => [...u.slice(-29), d.masks]);
                        live.current.drag = { ...dr, moved: true };
                    }
                    setMasks(d.masks.map((m) => (m.id === dr.id ? resizeMask(dr.start, dx, dy) : m)), false);
                }
            },
            onPanResponderRelease: () => {
                const dr = live.current.drag;
                const d = live.current.data;
                live.current.drag = null;
                setDrag(null);
                if (!dr || !d) return;
                if (dr.kind === 'draw') {
                    const r = rectFromDrag(dr.x0, dr.y0, dr.x1, dr.y1);
                    if (!r) {
                        setSelected([]);
                        return;
                    }
                    const m: OcclusionMask = { id: newMaskId(), shape: live.current.shape, ...r, group: nextGroup(d.masks) };
                    setMasks([...d.masks, m]);
                    setSelected(live.current.multi ? [...live.current.selected, m.id] : [m.id]);
                }
            },
            onPanResponderTerminate: () => {
                live.current.drag = null;
                setDrag(null);
            },
        })
    ).current;

    const selMasks = masks.filter((m) => selected.includes(m.id));
    const one = selMasks.length === 1 ? selMasks[0] : null;
    const groupsInSel = new Set(selMasks.map((m) => m.group));
    const cardCount = data ? occlusionOrds(data).length : 0;
    const groupIndex = new Map(Array.from(new Set(masks.map((m) => m.group))).sort((a, b) => a - b).map((g, i) => [g, i + 1]));

    const finish = () => {
        const problem = validateOcclusion(data);
        if (problem) {
            AlertService.alert('Not ready yet', problem);
            return;
        }
        onDone(data!);
    };

    const chip = (active: boolean) => ({
        flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, paddingHorizontal: 11, height: 34, borderRadius: Radius.full,
        backgroundColor: active ? tints.grades.fill : theme.surfaceSecondary, borderWidth: 1, borderColor: active ? tints.grades.line : theme.cardBorder,
    });
    const chipText = (active: boolean) => ({ fontFamily: 'Nunito_800ExtraBold' as const, fontSize: 12, color: active ? tints.grades.ink : theme.textSecondary });
    const label = {
        fontFamily: 'Nunito_800ExtraBold' as const, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' as const,
        color: theme.textTertiary, marginBottom: 8,
    };

    const preview = drag?.kind === 'draw' ? rectFromDrag(drag.x0, drag.y0, drag.x1, drag.y1) : null;

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top }}>
                {/* ── Bar ── */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.cardBorder }}>
                    <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel" style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceSecondary }}>
                        <Ionicons name="close" size={19} color={theme.textSecondary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 17, color: theme.text }}>Image occlusion</Text>
                        <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 11.5, color: theme.textTertiary }}>
                            {data ? `${masks.length} box${masks.length !== 1 ? 'es' : ''} · ${cardCount} card${cardCount !== 1 ? 's' : ''}` : 'Start with a picture'}
                        </Text>
                    </View>
                    <AnimatedPressable
                        onPress={finish}
                        accessibilityRole="button"
                        accessibilityLabel="Done"
                        style={{ paddingHorizontal: 16, height: 36, borderRadius: 18, justifyContent: 'center', backgroundColor: theme.primary, opacity: data && masks.length ? 1 : 0.5 }}
                    >
                        <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 13.5, color: '#ffffff' }}>Done</Text>
                    </AnimatedPressable>
                </View>

                <ScrollView
                    scrollEnabled={!drag}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 40 }}
                >
                    {!data ? (
                        /* ── No picture yet ── */
                        <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 12, borderRadius: Radius.xl, borderWidth: 1, borderStyle: 'dashed', borderColor: isDark ? '#2c3444' : '#cbd5e1' }}>
                            {busy ? (
                                <ActivityIndicator color={theme.primary} />
                            ) : (
                                <>
                                    <Ionicons name="images-outline" size={34} color={tints.grades.ink} />
                                    <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 16, color: theme.text, marginTop: 8 }}>Add a diagram, map or slide</Text>
                                    <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12.5, lineHeight: 18, color: theme.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 16 }}>
                                        Then draw boxes over the labels you want to learn. Each box becomes a card that asks what is hidden underneath.
                                    </Text>
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <TouchableOpacity onPress={() => pickImage(false)} activeOpacity={0.8} accessibilityRole="button" style={{ ...chip(true), height: 42, paddingHorizontal: 16 }}>
                                            <Ionicons name="images-outline" size={16} color={tints.grades.ink} />
                                            <Text style={chipText(true)}>Choose photo</Text>
                                        </TouchableOpacity>
                                        {Platform.OS !== 'web' && (
                                            <TouchableOpacity onPress={() => pickImage(true)} activeOpacity={0.8} accessibilityRole="button" style={{ ...chip(false), height: 42, paddingHorizontal: 16 }}>
                                                <Ionicons name="camera-outline" size={16} color={theme.textSecondary} />
                                                <Text style={chipText(false)}>Take photo</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </>
                            )}
                        </View>
                    ) : (
                        <>
                            <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 12.5, lineHeight: 17, color: theme.textSecondary, marginBottom: 10 }}>
                                <Text style={{ fontFamily: 'Nunito_800ExtraBold', color: theme.text }}>Drag</Text> over a label to cover it. Tap a box to select it, drag it to move, or drag its corner to resize.
                            </Text>

                            {/* ── Canvas ── */}
                            <View
                                onLayout={(e) => {
                                    const w = e.nativeEvent.layout.width;
                                    setCanvas({ w, h: w / ratio });
                                }}
                                style={{ width: '100%' }}
                            >
                                <View style={{ width: canvas.w, height: canvas.h, borderRadius: 10, overflow: 'hidden', backgroundColor: isDark ? '#07090d' : '#e9ebf3' }}>
                                    {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="stretch" /> : null}
                                    {canvas.w > 0 && (
                                        <Svg width={canvas.w} height={canvas.h} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
                                            {masks.map((m) => {
                                                const sel = selected.includes(m.id);
                                                const common = {
                                                    fill: MASK_COLORS.covered.fill,
                                                    fillOpacity: 0.88,
                                                    stroke: sel ? tints.grades.solid : MASK_COLORS.covered.stroke,
                                                    strokeWidth: sel ? 3 : 1.5,
                                                    vectorEffect: 'non-scaling-stroke' as const,
                                                };
                                                return m.shape === 'ellipse' ? (
                                                    <Ellipse key={m.id} {...common} cx={(m.x + m.w / 2) * 100} cy={(m.y + m.h / 2) * 100} rx={(m.w / 2) * 100} ry={(m.h / 2) * 100} />
                                                ) : (
                                                    <Rect key={m.id} {...common} x={m.x * 100} y={m.y * 100} width={m.w * 100} height={m.h * 100} />
                                                );
                                            })}
                                            {preview &&
                                                (shape === 'ellipse' ? (
                                                    <Ellipse cx={(preview.x + preview.w / 2) * 100} cy={(preview.y + preview.h / 2) * 100} rx={(preview.w / 2) * 100} ry={(preview.h / 2) * 100} fill={MASK_COLORS.covered.fill} fillOpacity={0.6} stroke={tints.grades.solid} strokeWidth={2} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
                                                ) : (
                                                    <Rect x={preview.x * 100} y={preview.y * 100} width={preview.w * 100} height={preview.h * 100} fill={MASK_COLORS.covered.fill} fillOpacity={0.6} stroke={tints.grades.solid} strokeWidth={2} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
                                                ))}
                                        </Svg>
                                    )}

                                    {/* Card numbers, so grouping is visible: same number, same card. */}
                                    {masks.map((m) => (
                                        <View key={`n-${m.id}`} pointerEvents="none" style={{ position: 'absolute', left: `${m.x * 100}%`, top: `${m.y * 100}%`, margin: 3 }}>
                                            <View style={{ minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' }}>
                                                <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 10, color: '#ffffff' }}>{groupIndex.get(m.group)}</Text>
                                            </View>
                                        </View>
                                    ))}

                                    {one && canvas.w > 0 && (
                                        <View pointerEvents="none" style={{
                                            position: 'absolute', left: (one.x + one.w) * canvas.w - 9, top: (one.y + one.h) * canvas.h - 9,
                                            width: 18, height: 18, borderRadius: 9, backgroundColor: '#ffffff', borderWidth: 3, borderColor: tints.grades.solid,
                                        }} />
                                    )}

                                    {/* The one surface that takes touches, so locationX/Y are canvas coordinates. */}
                                    <View {...pan.panHandlers} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
                                </View>
                            </View>

                            {/* ── Tools ── */}
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                                <TouchableOpacity onPress={() => setShape('rect')} style={chip(shape === 'rect')} accessibilityRole="radio" accessibilityState={{ selected: shape === 'rect' }}>
                                    <Ionicons name="square-outline" size={14} color={shape === 'rect' ? tints.grades.ink : theme.textSecondary} />
                                    <Text style={chipText(shape === 'rect')}>Box</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setShape('ellipse')} style={chip(shape === 'ellipse')} accessibilityRole="radio" accessibilityState={{ selected: shape === 'ellipse' }}>
                                    <Ionicons name="ellipse-outline" size={14} color={shape === 'ellipse' ? tints.grades.ink : theme.textSecondary} />
                                    <Text style={chipText(shape === 'ellipse')}>Oval</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => {
                                        setMulti((v) => !v);
                                        if (multi) setSelected(selected.slice(-1));
                                    }}
                                    style={chip(multi)}
                                    accessibilityRole="switch"
                                    accessibilityState={{ checked: multi }}
                                >
                                    <Ionicons name="checkmark-done-outline" size={14} color={multi ? tints.grades.ink : theme.textSecondary} />
                                    <Text style={chipText(multi)}>Select several</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    disabled={undo.length === 0}
                                    onPress={() => {
                                        const prev = undo[undo.length - 1];
                                        if (!prev) return;
                                        setUndo((u) => u.slice(0, -1));
                                        setMasks(prev, false);
                                        setSelected([]);
                                    }}
                                    style={{ ...chip(false), opacity: undo.length ? 1 : 0.45 }}
                                    accessibilityRole="button"
                                >
                                    <Ionicons name="arrow-undo-outline" size={14} color={theme.textSecondary} />
                                    <Text style={chipText(false)}>Undo</Text>
                                </TouchableOpacity>
                            </View>

                            {/* ── Selection ── */}
                            {selMasks.length > 0 && (
                                <View style={{ marginTop: 14, padding: 12, borderRadius: Radius.lg, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.cardBorder }}>
                                    <Text style={label}>
                                        {one ? `Box · card ${groupIndex.get(one.group)}` : `${selMasks.length} boxes selected`}
                                    </Text>
                                    {one && (
                                        <>
                                        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: theme.text, marginBottom: 6 }}>
                                            Name of what's hidden <Text style={{ fontFamily: 'Nunito_600SemiBold', color: theme.textTertiary }}>(optional)</Text>
                                        </Text>
                                        <TextInput
                                            value={one.label || ''}
                                            onChangeText={(t) => setMasks(masks.map((m) => (m.id === one.id ? { ...m, label: t } : m)), false)}
                                            placeholder="e.g. Left atrium"
                                            placeholderTextColor={theme.textTertiary}
                                            accessibilityLabel="Name of what is hidden under this box"
                                            style={{
                                                height: 44, paddingHorizontal: 12, borderRadius: Radius.md, marginBottom: 6,
                                                backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.inputBorder,
                                                color: theme.text, fontFamily: 'Nunito_700Bold', fontSize: 14,
                                            }}
                                        />
                                        <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, lineHeight: 16, color: theme.textTertiary, marginBottom: 10 }}>
                                            Shown as the answer when this box is asked. Write the thing itself, not a question.
                                        </Text>
                                        </>
                                    )}
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                        {one && (
                                            <TouchableOpacity
                                                onPress={() => setMasks(masks.map((m) => (m.id === one.id ? { ...m, shape: m.shape === 'rect' ? 'ellipse' : 'rect' } : m)))}
                                                style={chip(false)}
                                            >
                                                <Ionicons name={one.shape === 'rect' ? 'ellipse-outline' : 'square-outline'} size={14} color={theme.textSecondary} />
                                                <Text style={chipText(false)}>Make {one.shape === 'rect' ? 'oval' : 'box'}</Text>
                                            </TouchableOpacity>
                                        )}
                                        {selMasks.length > 1 && groupsInSel.size > 1 && (
                                            <TouchableOpacity onPress={() => setMasks(groupMasks(masks, selected))} style={chip(true)}>
                                                <Ionicons name="link-outline" size={14} color={tints.grades.ink} />
                                                <Text style={chipText(true)}>Ask together as one card</Text>
                                            </TouchableOpacity>
                                        )}
                                        {selMasks.length > 1 && groupsInSel.size === 1 && (
                                            <TouchableOpacity onPress={() => setMasks(ungroupMasks(masks, selected))} style={chip(false)}>
                                                <Ionicons name="unlink-outline" size={14} color={theme.textSecondary} />
                                                <Text style={chipText(false)}>Split into separate cards</Text>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                            onPress={() => {
                                                setMasks(masks.filter((m) => !selected.includes(m.id)));
                                                setSelected([]);
                                            }}
                                            style={{ ...chip(false), backgroundColor: tints.danger.fill, borderColor: tints.danger.line }}
                                        >
                                            <Ionicons name="trash-outline" size={14} color={tints.danger.ink} />
                                            <Text style={{ ...chipText(false), color: tints.danger.ink }}>Delete</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {/* ── How it asks ── */}
                            <Text style={{ ...label, marginTop: 20 }}>How to quiz you</Text>
                            {([
                                { key: 'hideAll', title: 'Hide all, guess one', body: 'Every box stays covered and one is asked. Best for labelled diagrams: nearby labels cannot give the answer away.' },
                                { key: 'hideOne', title: 'Hide one, guess one', body: 'Only the asked box is covered, the rest stay visible. Best when the surrounding labels are the context you need.' },
                            ] as const).map((opt) => {
                                const active = data.mode === opt.key;
                                return (
                                    <TouchableOpacity
                                        key={opt.key}
                                        onPress={() => setData({ ...data, mode: opt.key })}
                                        activeOpacity={0.8}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: active }}
                                        style={{
                                            flexDirection: 'row', gap: 10, padding: 12, borderRadius: Radius.lg, marginBottom: 8,
                                            backgroundColor: active ? tints.grades.fill : theme.surface, borderWidth: 1, borderColor: active ? tints.grades.line : theme.cardBorder,
                                        }}
                                    >
                                        <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={19} color={active ? tints.grades.ink : theme.textTertiary} style={{ marginTop: 1 }} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: theme.text }}>
                                                {opt.title}{opt.key === 'hideAll' ? <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 11.5, color: theme.textTertiary }}>  recommended</Text> : null}
                                            </Text>
                                            <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, lineHeight: 17, color: theme.textSecondary, marginTop: 2 }}>{opt.body}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}

                            <TouchableOpacity
                                onPress={() => setData({ ...data, locate: !data.locate })}
                                activeOpacity={0.8}
                                accessibilityRole="switch"
                                accessibilityState={{ checked: Boolean(data.locate) }}
                                style={{
                                    flexDirection: 'row', gap: 10, padding: 12, borderRadius: Radius.lg, marginTop: 4,
                                    backgroundColor: data.locate ? tints.grades.fill : theme.surface, borderWidth: 1, borderColor: data.locate ? tints.grades.line : theme.cardBorder,
                                }}
                            >
                                <Ionicons name={data.locate ? 'checkbox' : 'square-outline'} size={19} color={data.locate ? tints.grades.ink : theme.textTertiary} style={{ marginTop: 1 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: theme.text }}>Also quiz me the other way</Text>
                                    <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, lineHeight: 17, color: theme.textSecondary, marginTop: 2 }}>
                                        Extra cards that show a name, like "Find the left atrium", and you tap the box it is in. Good for maps and anatomy, where the place is what you are learning. Not needed for tables or notes.
                                    </Text>
                                    {data.locate && (() => {
                                        const unnamed = masks.filter((m) => !(m.label || '').trim()).length;
                                        return unnamed > 0 ? (
                                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, lineHeight: 16, color: tints.tasks.ink, marginTop: 5 }}>
                                                {unnamed} box{unnamed !== 1 ? 'es have' : ' has'} no name yet, so {unnamed !== 1 ? 'they are' : 'it is'} only asked the usual way. Tap a box to name it.
                                            </Text>
                                        ) : null;
                                    })()}
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => pickImage(false)}
                                activeOpacity={0.75}
                                accessibilityRole="button"
                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18, paddingVertical: 10 }}
                            >
                                <Ionicons name="swap-horizontal-outline" size={15} color={theme.textSecondary} />
                                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.textSecondary }}>Replace the picture (keeps the boxes)</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
}

export { MIN_MASK };
