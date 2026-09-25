/**
 * The one place that decides what a score *means*.
 *
 * The same four bands were previously hardcoded in three separate places
 * (`GwaSummary`, `DonutChart`, `SubjectCard`) with different hexes, so an 88%
 * could render blue on a subject card and blue-but-a-different-blue in the
 * summary above it. Dark values are the lifted variants — the light ones sit
 * around 3:1 on `#12132b` and read as muddy.
 */

export interface GradeTier {
    /** Band key, useful for tests and for picking an icon. */
    key: 'none' | 'needs-work' | 'passing' | 'on-track' | 'outstanding';
    /** Short status word shown next to the number. */
    label: string;
}

/** Resolves a percentage to its band. `hasData` false always means "no grades yet". */
export function getGradeTier(percent: number, hasData: boolean = true): GradeTier {
    const p = Number(percent);
    if (!hasData || !Number.isFinite(p) || p <= 0) return { key: 'none', label: 'No grades yet' };
    if (p >= 90) return { key: 'outstanding', label: 'Outstanding' };
    if (p >= 75) return { key: 'on-track', label: 'On track' };
    if (p >= 60) return { key: 'passing', label: 'Passing' };
    return { key: 'needs-work', label: 'Needs work' };
}

const TIER_COLORS: Record<GradeTier['key'], { light: string; dark: string }> = {
    outstanding: { light: '#16a34a', dark: '#4ade80' },
    'on-track': { light: '#2563eb', dark: '#60a5fa' },
    passing: { light: '#d97706', dark: '#fbbf24' },
    'needs-work': { light: '#dc2626', dark: '#f87171' },
    none: { light: '#94a3b8', dark: '#7c8494' },
};

/** Tier colour for a percentage. Pass `hasData: false` for the neutral grey. */
export function getGradeTierColor(percent: number, isDark: boolean, hasData: boolean = true): string {
    const tier = getGradeTier(percent, hasData);
    return TIER_COLORS[tier.key][isDark ? 'dark' : 'light'];
}

/** Status word for a percentage — "On track", "Needs work", … */
export function getGradeTierLabel(percent: number, hasData: boolean = true): string {
    return getGradeTier(percent, hasData).label;
}

function withAlpha(hex: string, alpha: number): string {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * A tier's colour as a panel wash plus its inner border — for the grade tiles
 * that carry the tier as a surface rather than as text colour alone.
 */
export function getGradeTierWash(percent: number, isDark: boolean, hasData: boolean = true): { fill: string; line: string } {
    const c = getGradeTierColor(percent, isDark, hasData);
    return { fill: withAlpha(c, isDark ? 0.16 : 0.1), line: withAlpha(c, isDark ? 0.34 : 0.26) };
}
