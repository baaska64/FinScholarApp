import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, useColorScheme, TextInput, Image, Animated, Easing, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { supabase } from '../../services/supabaseClient';
import { AlertService } from '@/components/CustomAlert';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import {
    isTransientFailure,
    friendlyScanError,
    scanBackoffMs,
    MAX_SCAN_ATTEMPTS,
} from '@/utils/scannerErrors';
import { parseOcrToClasses, groupLinesIntoRows, collectOcrLines } from '@/utils/ocrSchedule';

/**
 * Anthropic-style vision models downscale beyond ~1568px anyway, and Gemini is
 * similar; only genuinely oversized camera photos are worth touching.
 */
const DOWNSCALE_ABOVE = 2400;
const DOWNSCALE_TO = 2000;
const JPEG_QUALITY = 0.92;

/** Text below ~16px per glyph defeats ML Kit; small images are enlarged to this. */
const OCR_MIN_EDGE = 2600;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ScanMode = 'ai' | 'device';

export default function ScheduleScannerModal({ visible, onClose, onApply, isPremium = true, onRequestPremium }: any) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);

    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [customInstructions, setCustomInstructions] = useState('');
    const [selectedImage, setSelectedImage] = useState<{uri: string, base64: string} | null>(null);
    const [statusNote, setStatusNote] = useState<string | null>(null);
    const [mode, setMode] = useState<ScanMode>('ai');

    // Sweep band travels the height of the preview while a scan is running.
    const sweepY = useRef(new Animated.Value(-64)).current;
    useEffect(() => {
        if (!isProcessing) return;
        sweepY.setValue(-64);
        const loop = Animated.loop(
            Animated.timing(sweepY, {
                toValue: 210,
                duration: 1600,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
            }),
        );
        loop.start();
        return () => loop.stop();
    }, [isProcessing]);

    useEffect(() => {
        if (visible) {
            setSelectedImage(null);
            setCustomInstructions('');
            setError(null);
            setIsProcessing(false);
            setStatusNote(null);
            // Free accounts land on the scanner that costs nothing to run.
            setMode(isPremium ? 'ai' : 'device');
        }
    }, [visible, isPremium]);

    const accent = mode === 'ai' ? tints.schedule : tints.attendance;

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                base64: true,
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                const prepared = await downscaleForUpload(asset);
                if (prepared) {
                    setSelectedImage(prepared);
                } else {
                    AlertService.alert("Error", "Could not extract image data.");
                }
            }
        } catch (e) {
            AlertService.alert("Error", "Could not pick image.");
        }
    };

    /**
     * Shrinks the longest edge and re-encodes as JPEG. Only oversized photos
     * are touched: an earlier version resized everything over 1568px at quality
     * 0.7, which re-compressed the picker's already-lossy JPEG a second time and
     * softened small timetable text. Falls back to the original on any failure.
     */
    const downscaleForUpload = async (asset: any) => {
        const longestEdge = Math.max(asset.width || 0, asset.height || 0);
        const kb = (b64?: string) => (b64 ? Math.round((b64.length * 3) / 4 / 1024) : 0);
        if (!longestEdge || longestEdge <= DOWNSCALE_ABOVE) {
            console.warn(`[scanner] using original ${asset.width}x${asset.height}, ${kb(asset.base64)}KB`);
            return asset.base64 ? { uri: asset.uri, base64: asset.base64 } : null;
        }
        try {
            const resize = (asset.width >= asset.height)
                ? { width: DOWNSCALE_TO }
                : { height: DOWNSCALE_TO };
            const out = await ImageManipulator.manipulateAsync(
                asset.uri,
                [{ resize }],
                { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true },
            );
            if (out.base64) {
                console.warn(`[scanner] downscaled ${asset.width}x${asset.height} (${kb(asset.base64)}KB) -> ${out.width}x${out.height} (${kb(out.base64)}KB)`);
                return { uri: out.uri, base64: out.base64 };
            }
        } catch (e) {
            console.warn('[scanner] downscale failed, sending original', e);
        }
        return asset.base64 ? { uri: asset.uri, base64: asset.base64 } : null;
    };

    /**
     * Enlarges a small image so on-device text detection has enough pixels per
     * character. PNG, not JPEG: re-compressing already-marginal small text is
     * exactly what we are trying to avoid, and nothing here leaves the device.
     */
    const upscaleForOcr = async (uri: string) => {
        try {
            const probe = await ImageManipulator.manipulateAsync(uri, [], {});
            const longestEdge = Math.max(probe.width || 0, probe.height || 0);
            if (!longestEdge || longestEdge >= OCR_MIN_EDGE) {
                console.warn(`[scanner] ocr input ${probe.width}x${probe.height} (no upscale)`);
                return uri;
            }
            const scale = Math.min(OCR_MIN_EDGE / longestEdge, 3);
            const target = probe.width >= probe.height
                ? { width: Math.round(probe.width * scale) }
                : { height: Math.round(probe.height * scale) };
            const out = await ImageManipulator.manipulateAsync(
                uri, [{ resize: target }], { format: ImageManipulator.SaveFormat.PNG },
            );
            console.warn(`[scanner] ocr upscaled ${probe.width}x${probe.height} -> ${out.width}x${out.height}`);
            return out.uri;
        } catch (e) {
            console.warn('[scanner] upscale failed, using original', e);
            return uri;
        }
    };

    const handleScanNow = () => {
        if (!selectedImage) return;
        if (mode === 'device') {
            runDeviceScan(selectedImage.uri);
        } else {
            processFile(selectedImage.uri, selectedImage.base64);
        }
    };

    /**
     * On-device path. ML Kit reads the text and its bounding boxes; the row
     * reconstruction and the day/time conversion are ours, so nothing leaves
     * the phone and there is no network, quota or cost involved.
     */
    const runDeviceScan = async (uri: string) => {
        setError(null);
        setStatusNote(null);
        setIsProcessing(true);
        try {
            // ML Kit needs glyphs above roughly 16px to resolve them. A wide
            // study load screenshotted at 1556x570 puts each character below
            // that, which turns "M 07:30" into "MO720". Upscaling first gives
            // the detector something to work with — and because this path never
            // uploads, a big intermediate PNG costs nothing but a moment.
            const scanUri = await upscaleForOcr(uri);
            const result = await TextRecognition.recognize(scanUri);
            // Log the reconstructed rows, not just the count: when a scan comes
            // back wrong, the row text is what says whether OCR misread the page
            // or the row parser mishandled a layout.
            const rows = groupLinesIntoRows(collectOcrLines(result as any));
            console.warn(`[scanner] on-device rows (${rows.length}):`);
            rows.slice(0, 12).forEach((r, i) => console.warn(`[scanner]   ${i}: ${r.slice(0, 180)}`));

            const classes = parseOcrToClasses(result as any);
            console.warn(`[scanner] on-device found ${classes.length} classes from ${result?.blocks?.length ?? 0} blocks`);

            if (classes.length === 0) {
                throw new Error(
                    rows.length > 0
                        ? "Quick Scan read the page but couldn't line up any class rows. Low-resolution screenshots are the usual cause — try a full-size screenshot, or use AI Scan."
                        : "Quick Scan couldn't find any text in this image. Try a clearer, full-size screenshot, or use AI Scan.",
                );
            }

            setIsProcessing(false);
            onApply(classes);
        } catch (err: any) {
            if (err?.message) console.warn('[scanner] on-device failed:', err.message);
            const linking = /doesn't seem to be linked/i.test(err?.message || '');
            setError(
                linking
                    ? 'Quick Scan needs the app to be rebuilt after install. Use AI Scan for now.'
                    : (err?.message || 'Could not read this image on device.'),
            );
            setIsProcessing(false);
        }
    };

    /** One call to the parser. Throws with the server's own wording on failure. */
    const invokeParser = async (dataUrl: string) => {
        const { data: parsedClasses, error: funcError } = await supabase.functions.invoke('parse-schedule', {
            body: { base64Data: dataUrl, customInstructions: customInstructions.trim() || undefined }
        });

        if (funcError) {
            let errMsg = funcError.message;
            try {
                if (funcError.context) {
                    const status = funcError.context.status;
                    const raw = await funcError.context.text();
                    console.warn(`[scanner] edge fn status=${status} body=${String(raw || '').slice(0, 400)}`);
                    try {
                        const ctx = JSON.parse(raw);
                        if (ctx?.error) errMsg = ctx.error;
                    } catch (_) {}
                }
            } catch (e: any) {
                console.warn('[scanner] could not read edge fn body:', e?.message);
            }
            throw new Error(errMsg);
        }

        if (!parsedClasses || !Array.isArray(parsedClasses) || parsedClasses.length === 0) {
            throw new Error('Could not extract schedule. Make sure the image clearly shows times and days.');
        }
        return parsedClasses;
    };

    const processFile = async (uri: string, base64?: string) => {
        setError(null);
        setStatusNote(null);
        setIsProcessing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error("You must be logged in to use AI Scan. Quick Scan works without an account.");
            }
            if (!base64) throw new Error("Could not extract image data.");

            const dataUrl = `data:image/jpeg;base64,${base64}`;
            console.warn(`[scanner] sending ${Math.round((base64.length * 3) / 4 / 1024)}KB to parse-schedule`);

            // The provider returns a 503/529 when at capacity, and says so
            // itself: those are temporary. Retry rather than making the student
            // tap Scan again.
            let lastError: any = null;
            for (let attempt = 0; attempt < MAX_SCAN_ATTEMPTS; attempt++) {
                try {
                    const parsedClasses = await invokeParser(dataUrl);
                    setIsProcessing(false);
                    setStatusNote(null);
                    onApply(parsedClasses);
                    return;
                } catch (err: any) {
                    lastError = err;
                    const isLast = attempt === MAX_SCAN_ATTEMPTS - 1;
                    if (isLast || !isTransientFailure(err?.message)) break;
                    console.warn(`[scanner] attempt ${attempt + 1} failed, retrying:`, err?.message);
                    setStatusNote(`Scanner is busy — retrying (${attempt + 2} of ${MAX_SCAN_ATTEMPTS})…`);
                    await delay(scanBackoffMs(attempt));
                }
            }
            throw lastError;
        } catch (err: any) {
            if (err?.message) console.warn('[scanner] failed:', err.message);
            setError(friendlyScanError(err?.message));
            setStatusNote(null);
            setIsProcessing(false);
        }
    };

    /** One of the two mode cards. */
    const ModeCard = ({ value, icon, title, blurb, tint, locked }: any) => {
        const active = mode === value;
        return (
            <TouchableOpacity
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${title}. ${blurb}`}
                onPress={() => {
                    if (locked) {
                        onRequestPremium?.();
                        return;
                    }
                    setMode(value);
                    setError(null);
                }}
                style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: Radius.lg,
                    backgroundColor: active ? tint.fill : (isDark ? 'rgba(255,255,255,0.03)' : theme.surfaceSecondary),
                    borderWidth: 1.5,
                    borderColor: active ? tint.line : theme.cardBorder,
                    borderBottomWidth: active ? 3 : 1.5,
                    borderBottomColor: active ? tint.solid : theme.cardBorder,
                    opacity: locked ? 0.75 : 1,
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                    <Ionicons name={icon} size={15} color={active ? tint.ink : theme.textTertiary} />
                    <Text
                        numberOfLines={1}
                        style={{
                            marginLeft: 6, flexShrink: 1,
                            fontFamily: 'Nunito_800ExtraBold', fontSize: 13,
                            color: active ? tint.ink : theme.textSecondary,
                        }}
                    >
                        {title}
                    </Text>
                    {locked && (
                        <View style={{ marginLeft: 5, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: theme.primary }}>
                            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 8, color: '#fff' }}>PRO</Text>
                        </View>
                    )}
                </View>
                <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11, lineHeight: 15, color: theme.textSecondary }}>
                    {blurb}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
                <View
                    style={{
                        width: '100%',
                        maxHeight: '92%',
                        borderTopLeftRadius: Radius['4xl'],
                        borderTopRightRadius: Radius['4xl'],
                        backgroundColor: theme.surface,
                        paddingTop: 10,
                    }}
                >
                    <View style={{ alignItems: 'center', marginBottom: 8 }}>
                        <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: theme.cardBorder }} />
                    </View>

                    {/* Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14 }}>
                        <View style={{
                            width: 38, height: 38, borderRadius: 12, marginRight: 11,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: accent.fill, borderWidth: 1, borderColor: accent.line,
                        }}>
                            <Ionicons name="scan" size={19} color={accent.ink} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 19, color: theme.text, letterSpacing: -0.3 }}>
                                Scan Schedule
                            </Text>
                            <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textSecondary }}>
                                Auto-populate your timetable
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={onClose}
                            disabled={isProcessing}
                            accessibilityRole="button"
                            accessibilityLabel="Close scanner"
                            style={{
                                width: 34, height: 34, borderRadius: 17,
                                alignItems: 'center', justifyContent: 'center',
                                backgroundColor: theme.surfaceSecondary,
                                opacity: isProcessing ? 0.4 : 1,
                            }}
                        >
                            <Ionicons name="close" size={18} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 26 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Mode choice — hidden mid-scan so it cannot change under a running job */}
                        {!isProcessing && (
                            <>
                                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                                    <ModeCard
                                        value="ai"
                                        icon="sparkles"
                                        title="AI Scan"
                                        blurb="Reads any layout, including grid timetables and photos taken at an angle."
                                        tint={tints.schedule}
                                        locked={!isPremium}
                                    />
                                    <ModeCard
                                        value="device"
                                        icon="phone-portrait"
                                        title="Quick Scan"
                                        blurb="Instant, offline and free. Best on a clearly printed study load."
                                        tint={tints.attendance}
                                    />
                                </View>

                                <View style={{
                                    flexDirection: 'row', alignItems: 'flex-start',
                                    padding: 10, borderRadius: Radius.md, marginBottom: 16,
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : theme.surfaceSecondary,
                                }}>
                                    <Ionicons name="information-circle-outline" size={14} color={theme.textTertiary} style={{ marginRight: 7, marginTop: 1 }} />
                                    <Text style={{ flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 11, lineHeight: 16, color: theme.textSecondary }}>
                                        {mode === 'ai'
                                            ? 'AI Scan sends the image to Fin\'s server. It handles messy layouts and grid timetables, takes a few seconds, and needs internet.'
                                            : 'Quick Scan runs entirely on your phone — nothing is uploaded and it works offline. It reads printed tables well, but can miss grid timetables and angled photos.'}
                                    </Text>
                                </View>
                            </>
                        )}

                        {error && (
                            <View style={{
                                padding: 12, borderRadius: Radius.md, marginBottom: 14,
                                backgroundColor: tints.danger.fill,
                                borderWidth: 1, borderColor: tints.danger.line,
                            }}>
                                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, lineHeight: 16, color: tints.danger.ink }}>
                                    {error}
                                </Text>
                            </View>
                        )}

                        {isProcessing ? (
                            <View style={{ alignItems: 'center', paddingBottom: 8 }}>
                                <View style={{
                                    width: '100%', height: 210, borderRadius: 18, overflow: 'hidden',
                                    backgroundColor: theme.surfaceSecondary,
                                    borderWidth: 1, borderColor: theme.cardBorder,
                                }}>
                                    {selectedImage && (
                                        <Image
                                            source={{ uri: selectedImage.uri }}
                                            style={{ width: '100%', height: '100%', opacity: 0.55 }}
                                            resizeMode="cover"
                                        />
                                    )}
                                    <Animated.View
                                        style={{
                                            position: 'absolute', left: 0, right: 0, height: 64,
                                            transform: [{ translateY: sweepY }],
                                        }}
                                    >
                                        <View style={{ flex: 1, backgroundColor: accent.fill }} />
                                        <View style={{ height: 2, backgroundColor: accent.solid }} />
                                    </Animated.View>
                                    {[
                                        { top: 10, left: 10, bt: 2, bl: 2 },
                                        { top: 10, right: 10, bt: 2, br: 2 },
                                        { bottom: 10, left: 10, bb: 2, bl: 2 },
                                        { bottom: 10, right: 10, bb: 2, br: 2 },
                                    ].map((c, i) => (
                                        <View
                                            key={i}
                                            style={{
                                                position: 'absolute', width: 22, height: 22,
                                                top: c.top, left: c.left, right: c.right, bottom: c.bottom,
                                                borderTopWidth: c.bt, borderBottomWidth: c.bb,
                                                borderLeftWidth: c.bl, borderRightWidth: c.br,
                                                borderColor: accent.solid, borderRadius: 4,
                                            }}
                                        />
                                    ))}
                                </View>

                                <Text style={{ marginTop: 18, fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: theme.text }}>
                                    {statusNote
                                        ? 'Waiting for the scanner…'
                                        : mode === 'device' ? 'Reading on your phone…' : 'Reading your timetable…'}
                                </Text>
                                <Text style={{ marginTop: 5, textAlign: 'center', paddingHorizontal: 16, fontFamily: 'Nunito_400Regular', fontSize: 11.5, lineHeight: 16, color: theme.textSecondary }}>
                                    {statusNote || (mode === 'device'
                                        ? 'Picking out rows, days and times — nothing leaves your device.'
                                        : 'Fin is picking out the time slots and subjects.')}
                                </Text>
                            </View>
                        ) : selectedImage ? (
                            <View>
                                <View style={{ marginBottom: 14, position: 'relative' }}>
                                    <Image
                                        source={{ uri: selectedImage.uri }}
                                        style={{ width: '100%', height: 200, borderRadius: Radius.lg }}
                                        resizeMode="cover"
                                    />
                                    <TouchableOpacity
                                        onPress={() => setSelectedImage(null)}
                                        accessibilityRole="button"
                                        accessibilityLabel="Remove image"
                                        style={{
                                            position: 'absolute', top: 8, right: 8,
                                            width: 30, height: 30, borderRadius: 15,
                                            alignItems: 'center', justifyContent: 'center',
                                            backgroundColor: 'rgba(0,0,0,0.6)',
                                        }}
                                    >
                                        <Ionicons name="close" size={16} color="#fff" />
                                    </TouchableOpacity>
                                </View>

                                {/* Instructions only reach the AI path, so they are hidden
                                    in Quick Scan rather than silently ignored. */}
                                {mode === 'ai' && (
                                    <View style={{
                                        marginBottom: 14, borderRadius: Radius.md,
                                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : theme.surfaceSecondary,
                                        borderWidth: 1, borderColor: theme.cardBorder,
                                    }}>
                                        <TextInput
                                            placeholder="Optional: add instructions (e.g. 'use the course code as the subject name')"
                                            placeholderTextColor={theme.textTertiary}
                                            value={customInstructions}
                                            onChangeText={setCustomInstructions}
                                            multiline
                                            style={{
                                                padding: 12, minHeight: 58, textAlignVertical: 'top',
                                                fontFamily: 'Nunito_400Regular', fontSize: 13, color: theme.text,
                                            }}
                                        />
                                    </View>
                                )}

                                <TouchableOpacity
                                    onPress={handleScanNow}
                                    accessibilityRole="button"
                                    accessibilityLabel={mode === 'device' ? 'Run Quick Scan' : 'Run AI Scan'}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                        paddingVertical: 15, borderRadius: Radius.lg,
                                        backgroundColor: accent.solid,
                                        borderBottomWidth: 3,
                                        borderBottomColor: isDark ? 'rgba(0,0,0,0.35)' : accent.ink,
                                    }}
                                >
                                    <Ionicons name={mode === 'device' ? 'flash' : 'sparkles'} size={18} color="#fff" />
                                    <Text style={{ marginLeft: 8, fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: '#fff' }}>
                                        {mode === 'device' ? 'Quick Scan' : 'AI Scan'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={pickImage}
                                accessibilityRole="button"
                                accessibilityLabel="Select an image from your gallery"
                                style={{
                                    borderWidth: 2, borderStyle: 'dashed', borderRadius: Radius['2xl'],
                                    paddingVertical: 40, alignItems: 'center', justifyContent: 'center',
                                    borderColor: accent.line, backgroundColor: accent.fill,
                                }}
                            >
                                <Ionicons name="image" size={40} color={accent.ink} style={{ marginBottom: 10 }} />
                                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: accent.ink }}>
                                    Select image from gallery
                                </Text>
                                <Text style={{ marginTop: 3, fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textSecondary }}>
                                    A study load or a timetable screenshot
                                </Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
