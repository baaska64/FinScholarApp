# FinScholar Design Tokens & Visual Style Analysis Report

**Target Project**: FinScholar App (`c:/Projects/FinScholarApp`)  
**Purpose**: Comprehensive extraction of design tokens, visual style rules, mascot integration patterns, card styles, and component specs from Dashboard (`app/(tabs)/index.tsx`) and Grade Ledger (`app/(tabs)/grades.tsx`) to guide the Schedule Tab (`app/(tabs)/schedule.tsx`) redesign.  
**Author**: `teamwork_preview_explorer` (explorer_survey_2)  
**Date**: 2026-08-09  

---

## Executive Summary

The FinScholar application has established a refined, modern visual design language across its flagship **Dashboard** (`app/(tabs)/index.tsx`) and **Grade Ledger** (`app/(tabs)/grades.tsx`) tabs. Key visual hallmarks include:
- A rich 2-layer **Hero Banner + Overlapping Stats Card** structure featuring the **Fin mascot** (`finanimated.gif` or `FinSights.png`) with speech bubbles and SVG linear gradients.
- Pill-shaped controls (`Radius.full` / `9999`) for tab filtering, segment controls, action buttons, and status badges.
- Elevated rounded card containers (`Radius['2xl']` / `24px` and `Radius['4xl']` / `32px`) with subtle borders (`#e2e8f0` in Light mode, `#334155` in Dark mode) and platform-specific drop shadows.
- Staggered entry animations (`FadeInItem` with opacity and `translateY` spring) and tactile press scale feedback (`AnimatedPressable` scaling down to `0.96`-`0.97` with spring physics).
- A unified typography hierarchy built entirely on **Nunito** font weights (`Nunito_900Black`, `Nunito_700Bold`, `Nunito_400Regular`).

---

## 1. Core Design Tokens

### 1.1 Color Systems (`constants/Theme.ts` & `constants/Colors.ts`)

FinScholar implements dual-mode color tokens with semantically named variables.

| Token Name | Light Mode | Dark Mode | Usage Scope |
| :--- | :--- | :--- | :--- |
| **`primary`** | `#4f46e5` (Indigo-600) | `#818cf8` (Indigo-400) | Main brand CTA buttons, progress fills, active tab icons |
| **`primaryLight`** | `#818cf8` | `#a5b4fc` | Subtle badge backgrounds, icon container fills |
| **`primaryDark`** | `#3730a3` (Indigo-800) | `#6366f1` (Indigo-500) | Gradient stops, dark hero backgrounds |
| **`secondary`** | `#0ea5e9` (Sky-500) | `#38bdf8` (Sky-400) | Secondary stats, Sem GWA accents |
| **`accent`** | `#f472b6` (Pink-400) | `#f472b6` / `#831843` | Special highlights & decorative accents |
| **`success`** | `#10b981` (Emerald-500) | `#34d399` (Emerald-400) | Pro status badge, Present attendance, high progress |
| **`successLight`** | `#d1fae5` | `#065f46` | Light background container for success states |
| **`warning`** | `#f59e0b` (Amber-500) | `#fbbf24` (Amber-400) | Pending tasks count, warning pills, unscheduled subject warning |
| **`warningLight`** | `#fef3c7` | `#b45309` | Light container for warning states |
| **`error`** | `#ef4444` (Red-500) | `#f87171` (Red-400) | Absent state, destructive actions, high priority tasks |
| **`errorLight`** | `#fee2e2` | `#991b1b` | Destructive container fill |
| **`background`** | `#f8fafc` (Slate-50) | `#0f172a` (Slate-900) | Main screen background |
| **`surface`** | `#ffffff` (White) | `#1e293b` (Slate-800) | Cards, app bars, modal content sheets |
| **`surfaceSecondary`** | `#f1f5f9` (Slate-100) | `#334155` (Slate-700) | Inner card stat blocks, input backgrounds, disabled pills |
| **`card`** | `#ffffff` | `#1e293b` | Subject cards, task items, class cards |
| **`cardBorder`** | `#e2e8f0` (Slate-200) | `#334155` (Slate-700) | All container border outlines |
| **`text`** | `#0f172a` (Slate-900) | `#f8fafc` (Slate-50) | Primary headers, card titles, main values |
| **`textSecondary`** | `#475569` (Slate-600) | `#cbd5e1` (Slate-300) | Subtitles, secondary text, metadata labels |
| **`textTertiary`** | `#94a3b8` (Slate-400) | `#64748b` (Slate-500) | Dates, inactive icons, placeholder text |
| **`textInverse`** | `#ffffff` | `#0f172a` | Text over primary background |
| **`tabBg`** | `#ffffff` | `#1e293b` | Tab bar background |
| **`tabBorder`** | `#e2e8f0` | `#334155` | Tab bar top border |
| **`tabActive`** | `#4f46e5` | `#818cf8` | Selected tab color |
| **`tabInactive`** | `#94a3b8` | `#64748b` | Unselected tab color |

#### Subject & Class Palette Palettes (Index Indexed % 6)
- **Subject Accent Colors**: `['#4f46e5', '#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899']`
- **Class Grid Accent Colors**: `['#ff453a', '#30d158', '#0a84ff', '#ff9f0a', '#bf5af2', '#64d2ff']`

---

### 1.2 Typography Scale (`constants/Theme.ts`)

Font Family across all styles: `Nunito` (`Nunito_900Black`, `Nunito_700Bold`, `Nunito_400Regular`).

```typescript
export const Typography = {
  display:     { fontSize: 36, fontFamily: 'Nunito_900Black', lineHeight: 44 },
  heading:     { fontSize: 28, fontFamily: 'Nunito_900Black', lineHeight: 34 },
  title:       { fontSize: 22, fontFamily: 'Nunito_700Bold',   lineHeight: 28 },
  subtitle:    { fontSize: 18, fontFamily: 'Nunito_700Bold',   lineHeight: 24 },
  body:        { fontSize: 16, fontFamily: 'Nunito_400Regular',lineHeight: 24 },
  bodyBold:    { fontSize: 16, fontFamily: 'Nunito_700Bold',   lineHeight: 24 },
  caption:     { fontSize: 13, fontFamily: 'Nunito_400Regular',lineHeight: 18 },
  captionBold: { fontSize: 13, fontFamily: 'Nunito_700Bold',   lineHeight: 18 },
  label:       { fontSize: 11, fontFamily: 'Nunito_700Bold',   lineHeight: 16 },
};
```

---

### 1.3 Spacing, Border Radius, & Elevation Presets

#### Radius Scale (`constants/Theme.ts`)
- **`sm`** (8px): Inner badges, quick chips.
- **`md`** (12px): Sub-card blocks, button groups.
- **`lg`** (16px): Input fields, medium popups.
- **`xl`** (20px): Inner stats containers, task date blocks.
- **`2xl`** (24px): Standard cards (SubjectCard, Class item cards, Task cards).
- **`3xl`** (28px): Section headers background pills, Hero banner inner cards.
- **`4xl`** (32px): Main screen Hero containers, outer modal sheets.
- **`full`** (9999px): Circular avatars, filter tabs, pill action buttons.

#### Shadow Presets (`constants/Theme.ts`)
```typescript
export const Shadows = {
  sm: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    android: { elevation: 1 },
  }),
  md: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
    android: { elevation: 3 },
  }),
  lg: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16 },
    android: { elevation: 6 },
  }),
  xl: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 24 },
    android: { elevation: 10 },
  }),
};
```

---

## 2. Structural & Layout Patterns

### 2.1 Screen App Bar Header

Both Dashboard and Grades tabs share an identical top bar architecture:
```tsx
<View style={{
  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  paddingHorizontal: 16, paddingVertical: 14, zIndex: 10,
  borderBottomWidth: 1, borderBottomColor: theme.cardBorder,
  backgroundColor: theme.surface,
  ...(!isDark ? Shadows.sm : {}),
}}>
  {/* Left Title & Status */}
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Text style={{ ...Typography.title, color: theme.text }}>Screen Title</Text>
    {/* PRO badge / pill */}
  </View>

  {/* Right Controls: Cloud Sync Icon, Settings Button, Profile Avatar */}
</View>
```

### 2.2 Hero Card & Overlapping Stats Architecture

Used in both Dashboard (`index.tsx`) and Grade Ledger (`grades.tsx` / `GwaSummary.tsx`):

1. **Outer Container**: `Radius['4xl']` (32px), `theme.surface` background, `Shadows.lg`, `borderWidth: isDark ? 1 : 0`, `borderColor: theme.cardBorder`.
2. **Top Vibrant Banner**:
   - Background: SVG LinearGradient (`#4f46e5` to `#3730a3` in Light mode, `#312e81` to `#1e1b4b` in Dark mode).
   - Decorative SVG circles: Right top `r=90` at `rgba(255,255,255,0.08/0.1)`, Left bottom `r=60` at `rgba(255,255,255,0.05)`.
   - Content Padding: 20px padding (paddingBottom: 48px to allow overlap).
   - Left side: Speech bubble ("Fin says: ...") with translucent white/slate fill (`rgba(255,255,255,0.2)` Light, `rgba(15,23,42,0.6)` Dark) and subtle border (`rgba(255,255,255,0.3)` Light, `rgba(255,255,255,0.15)` Dark).
   - Right side: Mascot image (`finanimated.gif` or `FinSights.png`) positioned dynamically.
3. **Bottom Overlapping Stats Card**:
   - `marginTop: -28px` (pulls up into the banner).
   - `borderRadius: Radius['4xl']` (32px).
   - Background: `theme.surface`.
   - Contains progress bars or 2x2 grid of metric tiles (`backgroundColor: theme.surfaceSecondary`, `borderRadius: Radius['2xl']`, `borderWidth: 1`, `borderColor: theme.cardBorder`).

---

## 3. Mascot Integration & Mascot Asset Catalog

Fin Scholar features the **Fin mascot** in specific contextual roles across the app:

| Asset Name | Relative Path | Visual Aspect | Primary Use Case |
| :--- | :--- | :--- | :--- |
| `finanimated.gif` | `@/assets/images/finanimated.gif` | Animated shark mascot | Top Hero Banners & Welcome setup cards |
| `FinSights.png` | `@/assets/images/FinSights.png` | Static smart shark avatar | GWA Summary Header, AI Scanner advice modal |
| `FinDashboard.png` | `@/assets/images/FinDashboard.png` | Mascot dashboard graphic | Alternative banner mascot graphic |
| `confused.png` | `@/assets/images/confused.png` | Confused Fin mascot | Empty state banners (e.g. "No classes today! Fin is confused") |
| `studying.png` | `@/assets/images/studying.png` | Studying Fin mascot | All-clear task state & study empty states |
| `sleeping.png` | `@/assets/images/sleeping.png` | Sleeping Fin mascot | Night / rest state indicators |
| `happy.png` | `@/assets/images/happy.png` | Celebrating Fin mascot | Milestone achievements & grade milestone celebration |

---

## 4. Components, Controls & Filter Specs

### 4.1 Academic Term Selector (`components/ledger/Tabs.tsx`)
- **Pill Container**: `Radius.full`, `borderWidth: 1`, `borderColor: cardBorder`, `backgroundColor: surface` (Light) or `surfaceSecondary` (Dark).
- **Calendar Icon Badge**: `width: 32, height: 32, borderRadius: 16`, background `bg-indigo-50` (Light) / `bg-indigo-950/60` (Dark), icon `#4f46e5` / `#818cf8`.
- **Text**: `Nunito_700Bold`, 14px text.

### 4.2 Segmented Control Filter Tabs ("All" vs "Tracked" / "Grid" vs "Glass" vs "Attendance")
- **Container**: Outer pill container (`Radius.full`), padding `4px`, background `#f1f5f9` (Light) / `#1e293b` (Dark), border `1px #e2e8f0` / `#334155`.
- **Active Segment**: `Radius.full`, background `#4f46e5` (Light) / `#818cf8` (Dark), white text, `Shadows.sm`.
- **Inactive Segment**: Background transparent, text `theme.textSecondary` / `textTertiary`.

### 4.3 Section Headers (`components/ui/SectionHeader.tsx`)
- **Title Tag**: Pill container (`paddingHorizontal: 16, paddingVertical: 7, borderRadius: 9999`), background `theme.surface`, `borderWidth: 1`, `borderColor: theme.cardBorder`.
- **Title Text**: `Typography.label`, uppercase, `letterSpacing: 1.2`, color `theme.textSecondary`.
- **Action Button**: Icon `arrow-forward-circle` (size 28) or text `Typography.captionBold` in `theme.primary`.

---

## 5. Micro-Animations & Interactivity Rules

1. **Screen Loading State**: Uses skeleton components (`DashboardSkeleton`, `ListSkeleton`) with `#e2e8f0` (Light) / `#334155` (Dark) shimmer paths.
2. **Staggered Entry (`FadeInItem`)**:
   - `opacity`: `0 -> 1` over `350ms` (delay = `index * 80ms`).
   - `translateY`: `16 -> 0` over `350ms` (delay = `index * 80ms`).
3. **Card Touch Feedback (`AnimatedPressable`)**:
   - `onPressIn`: Spring scale down to `0.96`-`0.97` (`friction: 8`, `useNativeDriver: true`).
   - `onPressOut`: Spring scale back to `1.00` (`friction: 6`, `useNativeDriver: true`).

---

## 6. Schedule Tab Redesign Blueprint (`app/(tabs)/schedule.tsx`)

To achieve 100% visual parity with Dashboard and Grades tabs, the Schedule tab will be refactored to incorporate the exact design system specifications:

### 6.1 Hero Card Header Redesign
Replace the flat text header with a modern **Fin Mascot Schedule Banner**:
- **Gradient Top**: Vibrant SVG gradient banner with `finanimated.gif` mascot and speech bubble ("Fin says: Keep up your momentum today!").
- **Overlapping Quick Stats Sheet**:
  - Semester Progress Bar
  - 4-tile metric grid: Today's Classes Count, Next Class Countdown, Overall Attendance %, Unscheduled Subjects Count.

### 6.2 Filter & View Mode Controls
- Standardize the Year/Semester selector with `Tabs.tsx`.
- Refactor the View Toggle ("Grid", "Glass", "Attendance") into a floating Segmented Control pill using `Radius.full` and `Shadows.sm`.

### 6.3 Class & Timetable Card Refactoring
- Wrap timetable grid & list class items in `Radius['2xl']` cards with `theme.surface` background, `theme.cardBorder` outlines, color accent strips, and `AnimatedPressable` scale animations.

### 6.4 Mascot Empty State & Contextual Alert
- Upgrade empty schedule states with `confused.png` or `studying.png` mascot graphics in styled glass cards.

### 6.5 Full Feature Parity Checklist
All existing interactions must be strictly preserved:
- [x] Academic Term Switcher modal
- [x] Scan Schedule Image (AI Modal)
- [x] Add / Edit / Delete Class modals
- [x] Quick Edit Schedule mode (drag & drop / multi-select updates)
- [x] Export Schedule as Image (Light & Dark themes)
- [x] Attendance Tracker view mode
- [x] Glass & Grid view modes
