import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBrand } from '@/constants/Theme';
import { getGradeTierLabel } from '@/utils/gradeTiers';
import GradeScale from '@/components/ledger/GradeScale';

export interface GwaFigure {
    /** In the student's system (percent when the system is PERCENT). */
    value: number;
    percent: number;
    hasData: boolean;
    /** One quiet line of context under the scale. */
    caption: string;
    /**
     * Where the student's current pace lands this figure, already formatted
     * ("2.10", "78.4%"). Omitted when nothing is graded or nothing is left.
     */
    onTrack?: string | null;
}

type Scope = 'sem' | 'year' | 'cum';

interface GwaHeroProps {
    /** Which of the three numbers the figure is ("banked so far", …). */
    modeShort: string;
    isDark: boolean;
    system: string;
    systemLabel: string;
    sem: GwaFigure;
    year: GwaFigure;
    cum: GwaFigure;
    onOpenSettings: () => void;
}

const SCOPES: { key: Scope; label: string }[] = [
    { key: 'sem', label: 'Semester' },
    { key: 'year', label: 'Year' },
    { key: 'cum', label: 'Overall' },
];

/**
 * The grades tab's standing, set on the brand band.
 *
 * One figure at a time with a scope switch, rather than the dashboard's three
 * numbers on a card: the semester is what moves while a student enters scores,
 * so it leads, and Year / Overall are one tap away instead of competing with
 * it. The scale underneath places the figure against the tier lines.
 *
 * Content only — the caller draws the band behind it.
 */
export default function GwaHero({ isDark, system, systemLabel, modeShort, sem, year, cum, onOpenSettings }: GwaHeroProps) {
    const brand = getBrand(isDark);
    const [scope, setScope] = useState<Scope>('sem');
    const fig = scope === 'sem' ? sem : scope === 'year' ? year : cum;

    const valueText = !fig.hasData
        ? '– –'
        : system === 'PERCENT'
            ? `${fig.percent.toFixed(1)}%`
            : fig.value.toFixed(3);
    const tier = getGradeTierLabel(fig.percent, fig.hasData);
    const scopeName = SCOPES.find((s) => s.key === scope)!.label.toLowerCase();

    return (
        <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                    accessibilityRole="tablist"
                    style={{
                        flexDirection: 'row', padding: 3, borderRadius: 999,
                        backgroundColor: brand.well, borderWidth: 1, borderColor: brand.wellLine,
                    }}
                >
                    {SCOPES.map((s) => {
                        const active = s.key === scope;
                        return (
                            <TouchableOpacity
                                key={s.key}
                                onPress={() => setScope(s.key)}
                                activeOpacity={0.8}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: active }}
                                style={{
                                    paddingHorizontal: 11, height: 28, borderRadius: 999, justifyContent: 'center',
                                    backgroundColor: active ? '#ffffff' : 'transparent',
                                }}
                            >
                                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: active ? brand.heroTo : brand.onHero }}>
                                    {s.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                    onPress={onOpenSettings}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`Grading system: ${systemLabel}. Opens ledger settings.`}
                    style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1,
                        paddingHorizontal: 10, height: 30, borderRadius: 999,
                        backgroundColor: brand.well, borderWidth: 1, borderColor: brand.wellLine,
                    }}
                >
                    <Ionicons name="options-outline" size={13} color={brand.onHero} />
                    <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: 'Nunito_800ExtraBold', fontSize: 11.5, color: brand.onHero }}>
                        {systemLabel}
                    </Text>
                </TouchableOpacity>
            </View>

            <View
                accessible
                accessibilityLabel={`${scopeName} GWA ${fig.hasData ? valueText : 'not calculated yet'}. ${tier}.`}
                style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 14 }}
            >
                <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    // A dash at display size reads as a stray white bar, so the
                    // no-data placeholder drops to a smaller, dimmed glyph.
                    style={{
                        fontFamily: 'Nunito_900Black', fontSize: fig.hasData ? 46 : 30, lineHeight: 52, letterSpacing: fig.hasData ? -1.6 : 0,
                        color: fig.hasData ? brand.onHero : brand.onHeroMuted, maxWidth: '58%',
                    }}
                >
                    {valueText}
                </Text>
                <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: 'Nunito_900Black', fontSize: 16, color: brand.onHero, letterSpacing: -0.3 }}>
                        {tier}
                    </Text>
                    <Text numberOfLines={1} style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: brand.onHeroMuted, marginTop: 1 }}>
                        {fig.hasData
                            ? system === 'PERCENT' ? modeShort : `${fig.percent.toFixed(1)}% · ${modeShort}`
                            : 'Log a score to see it'}
                    </Text>
                </View>
            </View>

            <View style={{ marginTop: 12 }}>
                <GradeScale
                    percent={fig.hasData ? fig.percent : null}
                    marks={[
                        { at: 60, label: 'Pass 60', strong: true },
                        { at: 75, label: '75' },
                        { at: 90, label: '90' },
                    ]}
                    track={brand.wellStrong}
                    fill="#ffffff"
                    ink={brand.onHero}
                    inkMuted={brand.onHeroMuted}
                    pinRing={brand.heroTo}
                    accessibilityLabel={fig.hasData ? `${fig.percent.toFixed(1)} percent on a scale with a passing line at 60` : 'No grades on the scale yet'}
                />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: brand.onHeroMuted }}>
                    {fig.caption}
                </Text>
                {/* The pace projection is the one figure that is neither the
                    floor nor the ceiling, so it rides alongside whichever the
                    setting leads with. */}
                {fig.onTrack ? (
                    <View
                        accessible
                        accessibilityLabel={`On track for ${fig.onTrack} at your current pace`}
                        style={{
                            flexDirection: 'row', alignItems: 'center', gap: 4,
                            paddingHorizontal: 9, height: 24, borderRadius: 999,
                            backgroundColor: brand.well, borderWidth: 1, borderColor: brand.wellLine,
                        }}
                    >
                        <Ionicons name="trending-up" size={12} color={brand.onHero} />
                        <Text numberOfLines={1} style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: brand.onHeroMuted }}>
                            On track for <Text style={{ fontFamily: 'Nunito_900Black', color: brand.onHero }}>{fig.onTrack}</Text>
                        </Text>
                    </View>
                ) : null}
            </View>
        </View>
    );
}
