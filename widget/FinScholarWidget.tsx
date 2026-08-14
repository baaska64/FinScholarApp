import React from 'react';
import { FlexWidget, TextWidget, SvgWidget, ColorProp } from 'react-native-android-widget';

export interface WidgetClassData {
  courseName: string;
  room: string;
  timeStr: string;
  timeRemainingStr: string;
  isOngoing: boolean;
}

export interface FinScholarWidgetProps {
  classes?: WidgetClassData[];
  isDark?: boolean;
  widgetInfo?: { width: number; height: number };
}

const calendarIconSvg = `
<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="4" width="18" height="17" rx="3" />
  <path d="M3 9h18M8 2.5v3M16 2.5v3" />
  <circle cx="16.5" cy="15" r="1.5" fill="#ffffff" stroke="none" />
</svg>
`;

const greenDotSvg = `
<svg viewBox="0 0 8 8" width="8" height="8">
  <circle cx="4" cy="4" r="4" fill="#34d399" />
</svg>
`;

const wavyDividerSvg = `
<svg viewBox="0 0 400 24" width="100%" height="24" preserveAspectRatio="none" fill="none">
  <path d="M0,12 C100,24 200,0 300,16 C350,24 380,18 400,12 L400,24 L0,24 Z" fill="#ffffff" />
</svg>
`;

export function getFirstGrapheme(str: string): string {
  const cleanStr = String(str ?? '').trim();
  if (!cleanStr) return 'C';
  if (typeof Intl !== 'undefined' && typeof (Intl as any).Segmenter === 'function') {
    try {
      const segmenter = new (Intl as any).Segmenter();
      const iterator = segmenter.segment(cleanStr)[Symbol.iterator]();
      const first = iterator.next();
      if (!first.done && first.value?.segment) {
        return first.value.segment.toUpperCase();
      }
    } catch {
      // fallback
    }
  }
  return (Array.from(cleanStr)[0] || 'C').toUpperCase();
}

export function FinScholarWidget({ classes = [], widgetInfo }: FinScholarWidgetProps) {
  const todayStr    = new Date().toISOString().split('T')[0];
  const deepLinkUrl = `finscholarapp://schedule?viewMode=attendance&targetDate=${todayStr}&trigger=${Date.now()}`;

  const wHeight = typeof widgetInfo?.height === 'number' && !isNaN(widgetInfo.height) ? widgetInfo.height : 400; 
  const isVerySmall = wHeight < 150; 
  const isSmall = wHeight < 260; 

  let visibleCount = 3;
  if (isVerySmall) visibleCount = 0;
  else if (isSmall) visibleCount = 1;

  const safeClassesList = Array.isArray(classes)
    ? classes.filter((c): c is WidgetClassData => Boolean(c && typeof c === 'object' && !Array.isArray(c)))
    : [];
  const activeClass = safeClassesList.length > 0 ? safeClassesList[0] : null;
  const upcomingClasses = safeClassesList.length > 1 ? safeClassesList.slice(1, 1 + visibleCount) : [];

  if (!activeClass) {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        clickActionData={{ uri: deepLinkUrl }}
        style={{
          flex: 1,
          width: 'match_parent',
          height: 'match_parent',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 32,
          overflow: 'hidden',
          backgroundColor: '#6366f1' as ColorProp,
          backgroundGradient: {
            from: '#6366f1' as ColorProp,
            to: '#4338ca' as ColorProp,
            orientation: 'TOP_BOTTOM',
          },
          padding: 12,
        }}
      >
        <FlexWidget
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.18)' as ColorProp,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
          }}
        >
          <SvgWidget svg={calendarIconSvg} style={{ width: 18, height: 18 }} />
        </FlexWidget>
        <TextWidget
          text="No upcoming classes!"
          style={{ fontSize: 14, color: '#ffffff' as ColorProp, fontWeight: 'bold', marginBottom: 2 }}
          maxLines={1}
        />
        <TextWidget
          text="Enjoy your free time ☀️"
          style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' as ColorProp }}
        />
      </FlexWidget>
    );
  }

  const rawActiveName = String(activeClass.courseName ?? '').trim() || 'Unnamed Class';
  const safeActiveName = rawActiveName.split(/\s+[-–—]\s+/)[0].trim() || 'Unnamed Class';
  const activeRoom = String(activeClass.room ?? '').trim() || 'TBA';
  const activeCountdown = String(activeClass.timeRemainingStr ?? '').trim();
  const activeSubtitle = activeCountdown ? `${activeRoom} • ${activeCountdown}` : activeRoom;
  const activeTimeStr = String(activeClass.timeStr ?? '').trim();

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      clickActionData={{ uri: deepLinkUrl }}
      style={{
        flex: 1,
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        borderRadius: 32,
        overflow: 'hidden',
        backgroundColor: '#6366f1' as ColorProp,
        backgroundGradient: {
          from: '#6366f1' as ColorProp,
          to: '#4338ca' as ColorProp,
          orientation: 'TOP_BOTTOM',
        },
      }}
    >
      {/* ── Top Section: Calendar Icon & Translucent "Next Class" Panel ── */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'column',
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 2,
        }}
      >
        {/* Calendar icon button */}
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
          <FlexWidget
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.18)' as ColorProp,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SvgWidget svg={calendarIconSvg} style={{ width: 14, height: 14 }} />
          </FlexWidget>
        </FlexWidget>

        {/* Translucent panel for Next Class */}
        <FlexWidget
          style={{
            width: 'match_parent',
            marginTop: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.16)' as ColorProp,
          }}
        >
          <TextWidget
            text={activeClass.isOngoing ? 'ONGOING CLASS' : 'NEXT CLASS'}
            style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)' as ColorProp, fontWeight: 'bold' }}
          />

          <TextWidget
            text={safeActiveName}
            style={{ fontSize: 15, color: '#ffffff' as ColorProp, fontWeight: 'bold', marginTop: 2, marginBottom: 1 }}
            maxLines={1}
          />

          <TextWidget
            text={activeSubtitle}
            style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' as ColorProp }}
            maxLines={1}
          />

          {/* Time badge */}
          {Boolean(activeTimeStr) && (
            <FlexWidget style={{ flexDirection: 'row', marginTop: 5 }}>
              <FlexWidget
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.22)' as ColorProp,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 10,
                }}
              >
                <SvgWidget svg={greenDotSvg} style={{ width: 6, height: 6 }} />
                <TextWidget
                  text={activeTimeStr}
                  style={{ fontSize: 9.5, color: '#ffffff' as ColorProp, fontWeight: 'bold', marginLeft: 4 }}
                />
              </FlexWidget>
            </FlexWidget>
          )}
        </FlexWidget>
      </FlexWidget>

      {/* ── Middle Section: Wavy SVG Divider ── */}
      <FlexWidget style={{ width: 'match_parent', height: 14, marginTop: 2 }}>
        <SvgWidget svg={wavyDividerSvg} style={{ width: 'match_parent', height: 14 }} />
      </FlexWidget>

      {/* ── Bottom Section: Solid White Container holding Upcoming Classes ── */}
      <FlexWidget
        style={{
          flex: 1,
          width: 'match_parent',
          backgroundColor: '#ffffff' as ColorProp,
          paddingHorizontal: 10,
          paddingTop: 2,
          paddingBottom: 8,
          flexDirection: 'column',
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
        }}
      >
        {upcomingClasses.length > 0 ? (
          <FlexWidget style={{ width: 'match_parent', flexDirection: 'column' }}>
            {upcomingClasses.map((item, idx) => {
              const rawName = String(item.courseName ?? '').trim() || 'Unnamed Class';
              const safeName = rawName.split(/\s+[-–—]\s+/)[0].trim() || 'Unnamed Class';
              const initial = getFirstGrapheme(safeName);
              const countdown = String(item.timeRemainingStr ?? '').trim().replace(/^In\s+/i, '');
              const itemRoom = String(item.room ?? '').trim() || 'TBA';
              const itemTime = String(item.timeStr ?? '').trim();
              const itemSubtitle = itemTime ? `${itemRoom} • ${itemTime}` : itemRoom;

              return (
                <FlexWidget
                  key={idx}
                  style={{
                    width: 'match_parent',
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderRadius: 28,
                    backgroundColor: '#f1f5f9' as ColorProp,
                    padding: 5,
                    marginBottom: 4,
                  }}
                >
                  {/* Left Circular Slot: Avatar */}
                  <FlexWidget
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: '#e0e7ff' as ColorProp,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TextWidget text={initial} style={{ fontSize: 12, color: '#4f46e5' as ColorProp, fontWeight: 'bold' }} />
                  </FlexWidget>

                  {/* Middle Content Slot */}
                  <FlexWidget style={{ flex: 1, paddingHorizontal: 7, justifyContent: 'center' }}>
                    <TextWidget text={safeName} style={{ fontSize: 11.5, color: '#0f172a' as ColorProp, fontWeight: 'bold' }} maxLines={1} />
                    <TextWidget text={itemSubtitle} style={{ fontSize: 9.5, color: '#64748b' as ColorProp }} maxLines={1} />
                  </FlexWidget>

                  {/* Right Circular Slot: Time Remaining */}
                  <FlexWidget
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: '#e0e7ff' as ColorProp,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TextWidget text={countdown} style={{ fontSize: 8.5, color: '#4f46e5' as ColorProp, fontWeight: 'bold' }} maxLines={1} />
                  </FlexWidget>
                </FlexWidget>
              );
            })}
          </FlexWidget>
        ) : (
          <FlexWidget style={{ width: 'match_parent', flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }}>
            <TextWidget text="No other classes today" style={{ fontSize: 11, color: '#94a3b8' as ColorProp }} />
          </FlexWidget>
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
