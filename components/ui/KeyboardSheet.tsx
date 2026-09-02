import React from 'react';
import {
    View,
    Text,
    Modal,
    Pressable,
    ScrollView,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    StyleProp,
    ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { getTheme, Radius } from '@/constants/Theme';

interface KeyboardSheetProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    /** Optional leading icon; pair with `tint` for a domain-coloured tile. */
    icon?: keyof typeof Ionicons.glyphMap;
    tint?: { fill: string; line: string; ink: string; solid: string };
    /** Extra controls that sit left of the close button. */
    headerRight?: React.ReactNode;
    /** Scrollable body. */
    children: React.ReactNode;
    /**
     * Pinned under the body and above the keyboard — put the primary action
     * here so it can never be the thing the keyboard covers.
     */
    footer?: React.ReactNode;
    /** Share of the screen the sheet may occupy. */
    maxHeightRatio?: number;
    bodyStyle?: StyleProp<ViewStyle>;
}

/**
 * The app's bottom sheet for anything with a text field in it.
 *
 * Every sheet in the study tab was a bare `Modal` + `justify-end` `View` with
 * no keyboard handling whatsoever, so on a form like "New Card" — two multiline
 * inputs stacked above a Save button — the keyboard covered the second field
 * and the button outright. Three things fix that here and must stay:
 *
 * 1. `KeyboardAvoidingView` with `behavior="padding"` on **both** platforms.
 *    Android `Modal` renders into its own dialog window, which `adjustResize`
 *    does not resize, so the usual `Platform.OS === 'ios' ? 'padding' :
 *    undefined` does nothing there. `padding` measures the gap between the
 *    view's frame and the keyboard, so on the platforms where the window *does*
 *    resize it computes ~0 and stays correct either way.
 * 2. The body scrolls, so a form taller than the remaining space is reachable
 *    rather than clipped.
 * 3. `keyboardShouldPersistTaps="handled"` — without it the first tap on the
 *    save button only dismisses the keyboard and the user has to tap twice.
 */
export default function KeyboardSheet({
    visible,
    onClose,
    title,
    subtitle,
    icon,
    tint,
    headerRight,
    children,
    footer,
    maxHeightRatio = 0.9,
    bodyStyle,
}: KeyboardSheetProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const insets = useSafeAreaInsets();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.overlay }}>
                <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />

                <View
                    style={{
                        maxHeight: `${Math.round(maxHeightRatio * 100)}%`,
                        borderTopLeftRadius: Radius['4xl'],
                        borderTopRightRadius: Radius['4xl'],
                        backgroundColor: theme.surface,
                        borderTopWidth: 1,
                        borderTopColor: theme.cardBorder,
                    }}
                >
                    <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 12 }}>
                        <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: theme.cardBorder }} />
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 14 }}>
                        {icon && tint && (
                            <View style={{
                                width: 38, height: 38, borderRadius: 13, marginRight: 11,
                                alignItems: 'center', justifyContent: 'center',
                                backgroundColor: tint.fill,
                                borderWidth: 1, borderColor: tint.line,
                            }}>
                                <Ionicons name={icon} size={19} color={tint.ink} />
                            </View>
                        )}

                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text
                                accessibilityRole="header"
                                numberOfLines={1}
                                style={{ fontFamily: 'Nunito_900Black', fontSize: 19, color: theme.text, letterSpacing: -0.4 }}
                            >
                                {title}
                            </Text>
                            {subtitle ? (
                                <Text numberOfLines={2} style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textTertiary, marginTop: 1 }}>
                                    {subtitle}
                                </Text>
                            ) : null}
                        </View>

                        {headerRight}

                        <TouchableOpacity
                            onPress={onClose}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel="Close"
                            style={{
                                width: 32, height: 32, borderRadius: Radius.full, marginLeft: 8,
                                alignItems: 'center', justifyContent: 'center',
                                backgroundColor: theme.surfaceSecondary,
                            }}
                        >
                            <Ionicons name="close" size={18} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={[
                            { paddingHorizontal: 18, paddingBottom: footer ? 8 : insets.bottom + 20 },
                            bodyStyle,
                        ]}
                    >
                        {children}
                    </ScrollView>

                    {footer && (
                        <View
                            style={{
                                paddingHorizontal: 18,
                                paddingTop: 12,
                                paddingBottom: insets.bottom + 14,
                                borderTopWidth: 1,
                                borderTopColor: theme.cardBorder,
                                backgroundColor: theme.surface,
                            }}
                        >
                            {footer}
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
