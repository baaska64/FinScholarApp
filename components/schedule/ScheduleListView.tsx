import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, ImageBackground } from 'react-native';
import { BlurView } from 'expo-blur';

const DAY_LABELS: Record<number, string> = {
  0: 'M',
  1: 'T',
  2: 'W',
  3: 'TH',
  4: 'F',
  5: 'S',
  6: 'SU'
};

const formatTime = (hour: number) => {
  const totalMins = Math.round(hour * 60);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const ampm = hrs >= 12 && hrs < 24 ? 'PM' : 'AM';
  const displayH = hrs > 12 ? hrs - 12 : (hrs === 0 ? 12 : hrs);
  const minStr = mins > 0 ? `:${mins.toString().padStart(2, '0')}` : '';
  return `${displayH}${minStr}${ampm}`;
};

export default function ScheduleListView({ classes, currentSem, currentYear }: any) {
  // Group classes by day and sort by start hour
  const groupedClasses = useMemo(() => {
    if (!classes) return {};
    const grouped: Record<number, any[]> = {};
    classes.forEach((cls: any) => {
      if (!grouped[cls.day]) grouped[cls.day] = [];
      grouped[cls.day].push(cls);
    });
    
    // Sort each day's classes
    Object.keys(grouped).forEach(day => {
      grouped[parseInt(day)].sort((a, b) => a.startHour - b.startHour);
    });
    
    return grouped;
  }, [classes]);

  // Only show days that have classes, or Mon-Fri if empty
  // Sort so that Sunday (6) appears first, then Mon-Sat (0-5)
  const activeDays = Object.keys(groupedClasses).map(Number).sort((a, b) => {
    const weightA = a === 6 ? -1 : a;
    const weightB = b === 6 ? -1 : b;
    return weightA - weightB;
  });
  const daysToRender = activeDays.length > 0 ? activeDays : [6, 0, 1, 2, 3, 4, 5];

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={require('../../assets/images/GlassBg.png')} 
        style={styles.bgImage}
        resizeMode="cover"
      >
        <View style={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.titleLight}>Weekly</Text>
              <Text style={styles.titleBold}>Schedule</Text>
            </View>
            
            <BlurView intensity={70} tint="dark" style={styles.badgeContainer}>
              <View style={styles.badgeInner}>
                <Text style={styles.badgeProgram} numberOfLines={1}>{currentYear?.name || 'Year'}</Text>
                <Text style={styles.badgeSem}>{currentSem?.name || 'Semester'}</Text>
              </View>
            </BlurView>
          </View>

          {/* List of Days */}
          <View style={styles.listContainer}>
            {daysToRender.map(dayIdx => {
              const dayClasses = groupedClasses[dayIdx] || [];
              if (dayClasses.length === 0) return null; // Skip empty days for a cleaner list

              return (
                <BlurView intensity={70} tint="dark" style={styles.dayCard} key={dayIdx}>
                  <View style={styles.dayCardInner}>
                    {/* Left: Day Circle */}
                    <View style={styles.dayCircleContainer}>
                      <View style={styles.dayCircle}>
                        <Text style={styles.dayLetter}>{DAY_LABELS[dayIdx]}</Text>
                      </View>
                    </View>

                    {/* Right: Classes Stack */}
                    <View style={styles.classesStack}>
                      {dayClasses.map((cls, idx) => (
                        <View key={cls.id || idx} style={styles.classRow}>
                            <View style={styles.timeCol}>
                              <Text style={styles.timeText} numberOfLines={1} adjustsFontSizeToFit>
                                {formatTime(cls.startHour)} – {formatTime(cls.startHour + cls.duration)}
                              </Text>
                            </View>
                            <View style={styles.subjectCol}>
                              <Text style={styles.subjectText} numberOfLines={2}>
                                {cls.name}
                              </Text>
                              {(cls.room || cls.instructor) && (
                                <View style={styles.detailsRow}>
                                  {cls.room && (
                                    <Text style={styles.roomText} numberOfLines={1}>
                                      {cls.room}
                                    </Text>
                                  )}
                                  {cls.room && cls.instructor && (
                                    <Text style={styles.dotSeparator}>•</Text>
                                  )}
                                  {cls.instructor && (
                                    <Text style={styles.teacherText} numberOfLines={1}>
                                      {cls.instructor}
                                    </Text>
                                  )}
                                </View>
                              )}
                            </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </BlurView>
              );
            })}
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  bgImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  titleLight: {
    fontSize: 28,
    fontFamily: 'Nunito_400Regular',
    color: '#ffffff',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  titleBold: {
    fontSize: 34,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#ffffff',
    marginTop: -8,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  badgeContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  badgeInner: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  badgeProgram: {
    fontSize: 16,
    fontFamily: 'Nunito_700Bold',
    color: '#ffffff',
    maxWidth: 120,
  },
  badgeSem: {
    fontSize: 10,
    fontFamily: 'Nunito_400Regular',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  listContainer: {
    gap: 16,
  },
  dayCard: {
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  dayCardInner: {
    flexDirection: 'row',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dayCircleContainer: {
    justifyContent: 'center',
    marginRight: 24,
  },
  dayCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  dayLetter: {
    fontSize: 26,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  classesStack: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeCol: {
    width: 115,
    marginRight: 10,
  },
  timeText: {
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
    color: '#a5b4fc', // distinct light indigo for time
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subjectCol: {
    flex: 1,
  },
  subjectText: {
    fontSize: 15,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  roomText: {
    fontSize: 11,
    fontFamily: 'Nunito_700Bold',
    color: '#fde047', // distinct yellow for room
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  teacherText: {
    fontSize: 11,
    fontFamily: 'Nunito_700Bold',
    color: '#86efac', // distinct green for teacher
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dotSeparator: {
    color: 'rgba(255,255,255,0.5)',
    marginHorizontal: 6,
    fontSize: 10,
  }
});
