import React from 'react';
import { FlexWidget, TextWidget, ImageWidget } from 'react-native-android-widget';
import { Appearance } from 'react-native';

interface FinScholarWidgetProps {
  courseName?: string;
  room?: string;
  timeStr?: string;
  timeRemainingStr?: string;
  isOngoing?: boolean;
}

export function FinScholarWidget({ courseName, room, timeStr, timeRemainingStr, isOngoing }: FinScholarWidgetProps) {
  const isFallback = !courseName || (typeof courseName === 'string' ? courseName.trim() === '' : true);
  const isDark = Appearance.getColorScheme() === 'dark';

  const bgColor = isDark ? '#1e1e22' : '#ffffff';
  const textColor = isDark ? '#FFFFFF' : '#111111';
  const subTextColor = isDark ? '#A1A1AA' : '#666666';
  const dotColor = isDark ? '#52525B' : '#cccccc';

  const badgeBg = isOngoing
    ? (isDark ? '#2622c55e' : '#3322c55e')
    : (isDark ? '#2638bdf8' : '#3338bdf8');
  const badgeTextColor = isOngoing ? '#22C55E' : '#38BDF8';
  const badgeText = isOngoing ? 'ONGOING' : 'NEXT CLASS';

  if (isFallback) {
    return (
      <FlexWidget
        style={{
          flex: 1,
          backgroundColor: bgColor,
          borderRadius: 20,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 12,
        }}
      >
        <ImageWidget
          image={require('../assets/images/studying_small.png')}
          imageWidth={40}
          imageHeight={40}
          style={{ marginBottom: 6 }}
        />
        <TextWidget
          text="No upcoming classes!"
          style={{ fontSize: 13, color: textColor, fontWeight: 'bold' }}
        />
        <TextWidget
          text="Enjoy your free time"
          style={{ fontSize: 11, color: subTextColor, marginTop: 2 }}
        />
      </FlexWidget>
    );
  }

  const safeClassName = String(courseName || 'Unnamed Class');
  const safeTimeStr = timeStr ? String(timeStr) : '';
  const safeRoom = room ? String(room) : 'TBA';
  const safeTimeRemainingStr = timeRemainingStr ? String(timeRemainingStr) : '';

  const todayStr = new Date().toISOString().split('T')[0];
  const deepLinkUrl = `finscholarapp://schedule?viewMode=attendance&targetDate=${todayStr}&trigger=${Date.now()}`;

  // Build the subtitle line: "10:30 AM • TBA"
  const subtitleParts: string[] = [];
  if (safeTimeStr) subtitleParts.push(safeTimeStr);
  if (safeRoom) subtitleParts.push(safeRoom);
  const subtitleText = subtitleParts.join('  •  ');

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      clickActionData={{ uri: deepLinkUrl }}
      style={{
        flex: 1,
        backgroundColor: bgColor,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 10,
        justifyContent: 'center',
      }}
    >
      {/* Row 1: badge + countdown + mascot */}
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <FlexWidget
            style={{
              backgroundColor: badgeBg,
              borderRadius: 6,
              paddingHorizontal: 6,
              paddingVertical: 3,
              marginRight: 6,
            }}
          >
            <TextWidget
              text={badgeText}
              style={{ fontSize: 9, color: badgeTextColor, fontWeight: 'bold' }}
            />
          </FlexWidget>
          {!!safeTimeRemainingStr && (
            <TextWidget
              text={safeTimeRemainingStr}
              style={{ fontSize: 10, color: subTextColor, fontWeight: 'bold' }}
            />
          )}
        </FlexWidget>
        <ImageWidget
          image={require('../assets/images/studying_small.png')}
          imageWidth={20}
          imageHeight={20}
        />
      </FlexWidget>

      {/* Row 2: Class name */}
      <TextWidget
        text={safeClassName}
        style={{ fontSize: 16, color: textColor, fontWeight: 'bold', marginTop: 6 }}
        maxLines={1}
      />

      {/* Row 3: Time • Room */}
      <TextWidget
        text={subtitleText}
        style={{ fontSize: 11, color: subTextColor, marginTop: 2 }}
        maxLines={1}
      />
    </FlexWidget>
  );
}
