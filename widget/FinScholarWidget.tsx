import React from 'react';
import { FlexWidget, TextWidget, ImageWidget } from 'react-native-android-widget';
import { Appearance } from 'react-native';

export interface WidgetClassData {
  courseName: string;
  room: string;
  timeStr: string;
  timeRemainingStr: string;
  isOngoing: boolean;
}

interface FinScholarWidgetProps {
  classes?: WidgetClassData[];
}

export function FinScholarWidget({ classes = [] }: FinScholarWidgetProps) {
  const isDark = Appearance.getColorScheme() === 'dark';

  // ── Colour Tokens (mirrors app Theme.ts) ────────────────────────────────────
  const bgColor          = isDark ? '#0f172a' : '#f8fafc';
  const cardColor        = isDark ? '#1e293b' : '#ffffff';
  const cardBorder       = isDark ? '#334155' : '#e2e8f0';
  const textColor        = isDark ? '#f8fafc'  : '#0f172a';
  const textSecondary    = isDark ? '#cbd5e1'  : '#475569';
  const textTertiary     = isDark ? '#64748b'  : '#94a3b8';
  const primaryColor     = isDark ? '#818cf8'  : '#4f46e5';
  const successColor     = isDark ? '#34d399'  : '#10b981';
  const successBg        = isDark ? '#134e3a'  : '#d1fae5';
  const upcomingBg       = isDark ? '#1e1b4b'  : '#e0e7ff';

  const todayStr    = new Date().toISOString().split('T')[0];
  const deepLinkUrl = `finscholarapp://schedule?viewMode=attendance&targetDate=${todayStr}&trigger=${Date.now()}`;

  // ── Fallback State ───────────────────────────────────────────────────────────
  if (!classes || classes.length === 0) {
    return (
      <FlexWidget
        style={{
          flex: 1,
          backgroundColor: bgColor,
          borderRadius: 24,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        <ImageWidget
          image={require('../assets/images/studying_small.png')}
          imageWidth={48}
          imageHeight={48}
          style={{ marginBottom: 10 }}
        />
        <TextWidget
          text="No upcoming classes!"
          style={{ fontSize: 15, color: textColor, fontWeight: 'bold' }}
        />
        <TextWidget
          text="Enjoy your free time ☀️"
          style={{ fontSize: 12, color: textSecondary, marginTop: 4 }}
        />
      </FlexWidget>
    );
  }

  // ── Class Card Renderer ──────────────────────────────────────────────────────
  const renderClassCard = (cls: WidgetClassData, index: number) => {
    const badgeBg        = cls.isOngoing ? successBg   : upcomingBg;
    const badgeTextColor = cls.isOngoing ? successColor : primaryColor;
    const badgeText      = cls.isOngoing ? '● ONGOING' : '◎ NEXT';
    const safeName       = String(cls.courseName || 'Unnamed Class');
    const safeTime       = String(cls.timeStr || '');
    const safeRoom       = String(cls.room || 'TBA');
    const safeCountdown  = String(cls.timeRemainingStr || '');
    const subtitleText   = [safeTime, safeRoom].filter(Boolean).join('  •  ');

    return (
      <FlexWidget
        key={index}
        style={{
          backgroundColor: cardColor,
          borderRadius: 16,
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginBottom: index < classes.length - 1 ? 8 : 0,
          borderWidth: 1,
          borderColor: cardBorder,
        }}
      >
        {/* Row 1: Badge + Countdown */}
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <FlexWidget
            style={{
              backgroundColor: badgeBg,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <TextWidget
              text={badgeText}
              style={{ fontSize: 10, color: badgeTextColor, fontWeight: 'bold' }}
            />
          </FlexWidget>
          {!!safeCountdown && (
            <TextWidget
              text={safeCountdown}
              style={{ fontSize: 11, color: textTertiary, fontWeight: 'bold' }}
            />
          )}
        </FlexWidget>

        {/* Row 2: Course Name */}
        <TextWidget
          text={safeName}
          style={{ fontSize: 17, color: textColor, fontWeight: 'bold', marginBottom: 4 }}
          maxLines={1}
        />

        {/* Row 3: Time • Room */}
        <TextWidget
          text={subtitleText}
          style={{ fontSize: 12, color: textSecondary }}
          maxLines={1}
        />
      </FlexWidget>
    );
  };

  // ── Main Widget Shell ────────────────────────────────────────────────────────
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      clickActionData={{ uri: deepLinkUrl }}
      style={{
        flex: 1,
        backgroundColor: bgColor,
        borderRadius: 24,
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 14,
      }}
    >
      {/* Header */}
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <TextWidget
          text="My Schedule"
          style={{ fontSize: 13, color: textTertiary, fontWeight: 'bold' }}
        />
        <ImageWidget
          image={require('../assets/images/studying_small.png')}
          imageWidth={22}
          imageHeight={22}
        />
      </FlexWidget>

      {/* Class Cards */}
      {classes.map((cls, index) => renderClassCard(cls, index))}
    </FlexWidget>
  );
}
