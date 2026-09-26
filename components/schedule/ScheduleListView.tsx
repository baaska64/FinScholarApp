import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';

const SCREEN_W = Dimensions.get('window').width;
const PREVIEW_W = SCREEN_W - 48; // Margin
const PREVIEW_H = PREVIEW_W * (1920 / 1080);
const scale = PREVIEW_W / 1080;

const BASE_W = 1080;
const BASE_H = 1920;

const DAY_LABELS = ['SU', 'M', 'T', 'W', 'TH', 'F', 'S'];

const DAY_THEMES: Record<number, { lightBg: string, lightText: string, darkBg: string, darkText: string }> = {
  0: { lightBg: '#FFE4E6', lightText: '#E11D48', darkBg: '#4C0519', darkText: '#FDA4AF' }, // Rose
  1: { lightBg: '#FEF3C7', lightText: '#D97706', darkBg: '#451A03', darkText: '#FDE047' }, // Amber
  2: { lightBg: '#D1FAE5', lightText: '#059669', darkBg: '#022C22', darkText: '#6EE7B7' }, // Emerald
  3: { lightBg: '#E0E7FF', lightText: '#4F46E5', darkBg: '#1E1B4B', darkText: '#A5B4FC' }, // Indigo
  4: { lightBg: '#FCE7F3', lightText: '#DB2777', darkBg: '#500724', darkText: '#F9A8D4' }, // Pink
  5: { lightBg: '#E0F2FE', lightText: '#0284C7', darkBg: '#082F49', darkText: '#7DD3FC' }, // Sky
  6: { lightBg: '#F3E8FF', lightText: '#9333EA', darkBg: '#3B0764', darkText: '#D8B4FE' }, // Purple
};

const formatTime = (timeNum: number) => {
  const hrs = Math.floor(timeNum);
  const mins = Math.round((timeNum - hrs) * 60);
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  const displayH = hrs > 12 ? hrs - 12 : (hrs === 0 ? 12 : hrs);
  const minStr = mins > 0 ? `:${mins.toString().padStart(2, '0')}` : '';
  return `${displayH}${minStr}${ampm}`;
};

const getRoomForClass = (cls: any, allClasses: any[]) => {
  if (!cls.room) return null;
  const rooms = cls.room.split(',').map((r: string) => r.trim()).filter(Boolean);
  if (rooms.length <= 1) return cls.room;
  
  if (!allClasses) return rooms[0];

  const siblings = allClasses
    .filter((c: any) => c.name === cls.name)
    .sort((a: any, b: any) => {
      const wa = a.day === 6 ? -1 : a.day;
      const wb = b.day === 6 ? -1 : b.day;
      if (wa !== wb) return wa - wb;
      return a.startHour - b.startHour;
    });
    
  const idx = siblings.findIndex((c: any) => c.id === cls.id);
  if (idx === -1) return rooms[0];
  return rooms[idx % rooms.length];
};

export default function ScheduleListView({ classes, currentSem, currentYear }: any) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bgColor = isDark ? '#0b0e14' : '#F8FAFC';
  const textColor = isDark ? '#F8FAFC' : '#0F172A';
  const subTextColor = isDark ? '#94A3B8' : '#64748B';
  const cardBgColor = isDark ? '#1E293B' : '#FFFFFF';
  const cardBorderColor = isDark ? '#2a3140' : '#E2E8F0';

  const groupedClasses = useMemo(() => {
    if (!classes) return {};
    const grouped: Record<number, any[]> = {};
    classes.forEach((cls: any) => {
      if (!grouped[cls.day]) grouped[cls.day] = [];
      grouped[cls.day].push(cls);
    });
    Object.keys(grouped).forEach(day => {
      grouped[parseInt(day)].sort((a, b) => a.startHour - b.startHour);
    });
    return grouped;
  }, [classes]);

  const activeDays = Object.keys(groupedClasses).map(Number).sort((a, b) => {
    const wa = a === 6 ? -1 : a;
    const wb = b === 6 ? -1 : b;
    return wa - wb;
  });
  const daysToRender = activeDays.filter(d => (groupedClasses[d]?.length ?? 0) > 0);
  const numDays = daysToRender.length || 1;

  // 1080x1920 layout calculations
  const HEADER_H = 200;
  const HEADER_MB = 60;
  const FOOTER_H = 60;
  const OUTER_PAD_V = 80;
  
  const DAY_GAP = 56; // Gap between different days
  const ROW_GAP = 20; // Gap between wrapped rows within the same day
  const MAX_COLS = 2; // 2 classes side-by-side

  // Calculate total vertical rows needed for the entire week
  const dayRowCounts = daysToRender.map(d => Math.ceil(Math.max(1, (groupedClasses[d]?.length || 1)) / MAX_COLS));
  const totalRows = dayRowCounts.reduce((a, b) => a + b, 0);

  // Distribute height based on rows
  const totalAvailableH = BASE_H - HEADER_H - HEADER_MB - FOOTER_H - (OUTER_PAD_V * 2);
  const totalGaps = (numDays - 1) * DAY_GAP + (totalRows - numDays) * ROW_GAP;
  const rowH = (totalAvailableH - totalGaps) / totalRows;

  // Dynamic font sizing - reserve vertical space for padding (32px total, 16px top/bottom)
  const availableTextH = Math.max(40, rowH - 32); 
  const subjectFs = Math.min(32, Math.max(16, availableTextH * 0.4));
  const timeFs = Math.min(18, Math.max(11, availableTextH * 0.22));
  const metaFs = Math.min(18, Math.max(11, availableTextH * 0.22));

  return (
    <View style={[styles.previewContainer, { width: PREVIEW_W, height: PREVIEW_H, backgroundColor: bgColor, borderColor: cardBorderColor }]}>
      <View style={[styles.canvas, { transform: [{ scale }], transformOrigin: 'top left' }]}>
        
        <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]} />
        
        {/* Fin Mascot Watermark */}
        <Image 
          source={require('../../assets/images/studying.png')} 
          style={{ 
            position: 'absolute', 
            bottom: 40, 
            right: 40, 
            width: 450, 
            height: 450, 
            opacity: isDark ? 0.15 : 0.4,
            resizeMode: 'contain' 
          }} 
        />

        <View style={styles.inner}>
          
          <View style={[styles.header, { height: HEADER_H, marginBottom: HEADER_MB }]}>
            <View>
              <Text style={[styles.titleLight, { color: subTextColor }]}>Weekly</Text>
              <Text style={[styles.titleBold, { color: textColor }]}>Schedule</Text>
            </View>
            <View style={[styles.badgeWrap, { backgroundColor: cardBgColor, borderColor: cardBorderColor }]}>
              <Text style={[styles.badgeYear, { color: textColor }]} numberOfLines={1}>{currentYear?.name || 'Year'}</Text>
              <Text style={[styles.badgeSem, { color: subTextColor }]}>{currentSem?.name || 'Semester'}</Text>
            </View>
          </View>

          <View style={{ flex: 1, gap: DAY_GAP }}>
            {daysToRender.map((dayIdx, index) => {
              const dayClasses = groupedClasses[dayIdx] || [];
              const theme = DAY_THEMES[dayIdx] || DAY_THEMES[1];
              
              const rowsForThisDay = Math.ceil(Math.max(1, dayClasses.length) / MAX_COLS);
              const dayContainerHeight = (rowsForThisDay * rowH) + ((rowsForThisDay - 1) * ROW_GAP);

              const pillBg = isDark ? theme.darkBg : theme.lightBg;
              const pillText = isDark ? theme.darkText : theme.lightText;

              return (
                <View style={[styles.dayRow, { height: dayContainerHeight }]} key={dayIdx}>
                  
                  {/* Dynamic Vertical Day Pill */}
                  <View style={[styles.dayPill, { backgroundColor: pillBg }]}>
                    <Text style={[styles.dayLetter, { color: pillText }]}>{DAY_LABELS[dayIdx]}</Text>
                  </View>

                  {/* Horizontal Divider Line */}
                  {index < daysToRender.length - 1 && (
                    <View 
                      style={{ 
                        position: 'absolute', 
                        bottom: -(DAY_GAP / 2) - 1.5, 
                        left: 0, 
                        right: 0, 
                        height: 3, 
                        backgroundColor: cardBorderColor,
                        borderRadius: 2,
                        opacity: isDark ? 0.5 : 1
                      }} 
                    />
                  )}

                  {/* Classes Wrapping Grid */}
                  <View style={[styles.classesContainer, { gap: ROW_GAP }]}>
                    {dayClasses.map((cls: any, idx: number) => {
                      const room = getRoomForClass(cls, classes);
                      return (
                        <View 
                          key={cls.id || idx} 
                          style={[
                            styles.classCard, 
                            { 
                              height: rowH, 
                              backgroundColor: cardBgColor, 
                              borderColor: cardBorderColor,
                              borderWidth: isDark ? 1 : 2,
                              shadowOpacity: isDark ? 0 : 0.04
                            }
                          ]}
                        >
                          <Text style={[styles.timeText, { fontSize: timeFs, color: subTextColor }]} numberOfLines={1}>
                            {formatTime(cls.startHour)} - {formatTime(cls.startHour + cls.duration)}
                          </Text>
                          <Text style={[styles.subjectText, { fontSize: subjectFs, color: textColor }]} numberOfLines={1}>
                            {cls.name}
                          </Text>
                          {room && (
                            <View style={styles.metaRow}>
                              <Text style={[styles.roomText, { fontSize: metaFs, color: pillText }]} numberOfLines={1}>
                                <Ionicons name="location" size={metaFs * 0.9} color={pillText} /> {room}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>

                </View>
              );
            })}
          </View>

          <View style={[styles.footer, { height: FOOTER_H }]}>
            <Text style={[styles.footerBrand, { color: cardBorderColor }]}>FINSCHOLAR</Text>
          </View>

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  previewContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    alignSelf: 'center',
    borderWidth: 1,
  },
  canvas: {
    width: BASE_W,
    height: BASE_H,
  },
  inner: {
    width: BASE_W,
    height: BASE_H,
    paddingHorizontal: 80,
    paddingVertical: 60,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleLight: {
    fontSize: 72,
    fontFamily: 'Nunito_700Bold',
  },
  titleBold: {
    fontSize: 100,
    fontFamily: 'Nunito_900Black',
    marginTop: -20,
  },
  badgeWrap: {
    paddingHorizontal: 36,
    paddingVertical: 20,
    borderRadius: 100,
    alignItems: 'center',
    borderWidth: 2,
  },
  badgeYear: {
    fontSize: 36,
    fontFamily: 'Nunito_900Black',
    maxWidth: 250,
  },
  badgeSem: {
    fontSize: 22,
    fontFamily: 'Nunito_700Bold',
    marginTop: 4,
  },

  /* Day Rows */
  dayRow: {
    flexDirection: 'row',
    alignItems: 'stretch', // Stretches the dayPill to fill height
    width: '100%',
  },
  dayPill: {
    width: 120,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 24,
  },
  dayLetter: {
    fontSize: 48,
    fontFamily: 'Nunito_900Black',
  },
  
  /* Classes */
  classesContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start', // Do not stretch vertically, respect rowH
  },
  classCard: {
    width: '48%', // Forces 2 columns
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 16, // Explicit vertical padding guarantees space from edges!
    justifyContent: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  timeText: {
    fontFamily: 'Nunito_800ExtraBold',
    marginBottom: 2,
  },
  subjectText: {
    fontFamily: 'Nunito_900Black',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  roomText: {
    fontFamily: 'Nunito_800ExtraBold',
  },

  /* Footer */
  footer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  footerBrand: {
    fontSize: 28,
    fontFamily: 'Nunito_900Black',
    letterSpacing: 12,
  },
});
