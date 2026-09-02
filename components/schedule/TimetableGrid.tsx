import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, useWindowDimensions, Animated, Easing } from 'react-native';
import { getClassColor } from '@/constants/Theme';
import { Ionicons } from '@expo/vector-icons';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const getHourHeight = (isExport: boolean) => isExport ? 160 : 90;
const getTimeColWidth = (isExport: boolean) => isExport ? 70 : 44;
// Responsive day column width: fit all visible days within screen
const getDayWidth = (numDays: number, isExport: boolean, screenWidth: number) => {
    if (isExport) return 420;
    const available = screenWidth - getTimeColWidth(false) - 32;
    const fitWidth = Math.floor(available / numDays);
    return Math.max(200, Math.min(fitWidth, 260)); // Extra wide cells for landscape feel
};

const TYPOGRAPHY = {
  subjectTitle: { fontSize: 13, fontWeight: '700', lineHeight: 16 },
  time: { fontSize: 10, fontWeight: '500' }
};

const getThemeStyles = (isDark: boolean, isExportMode: boolean) => ({
  gridBg: isDark ? '#0F172A' : '#FCFCFD',
  headerBg: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF',
  hourBg: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF', 
  gridLine: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
  textColor: isDark ? '#F8FAFC' : '#1E293B',
  timeTextColor: isDark ? '#94A3B8' : '#64748B',
  outerBorderColor: isDark ? '#3B82F6' : '#60A5FA',
  borderWidth: 1, 
  outerBorderWidth: isExportMode ? 0 : 3,
  borderRadius: isExportMode ? 0 : 20,
});

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

const ClassBlock = memo(({ 
  cls, isDark, isQuickEditMode, isSelected, onToggleSelect,
  onPressClass, START_HOUR, END_HOUR, displayDayIndices, dayWidth, isExportMode = false, zoomScale = 1,
  appearIndex = 0, appearToken = 0
}: any) => {
  // Solid fill in both themes: a wash over grid lines reads as a smudge.
  const color = getClassColor(cls.colorIdx, isExportMode ? isDark : isDark);
  const z = isExportMode ? 1 : zoomScale;

  // Blocks drop in one after another when a scan fills the timetable, so the
  // result reads as "these were just added" rather than appearing all at once.
  const reveal = useRef(new Animated.Value(appearToken ? 0 : 1)).current;
  useEffect(() => {
    if (isExportMode || !appearToken) {
      reveal.setValue(1);
      return;
    }
    reveal.setValue(0);
    const anim = Animated.timing(reveal, {
      toValue: 1,
      duration: 320,
      delay: Math.min(appearIndex * 55, 1600),
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [appearToken, appearIndex, isExportMode]);
  
  const hourHeight = getHourHeight(isExportMode) * z;
  const timeColWidth = getTimeColWidth(isExportMode) * z;
  
  const top = (cls.startHour - START_HOUR) * hourHeight + (10 * z);
  const height = cls.duration * hourHeight;
  const blockWidth = (dayWidth - (4 * z)) / (cls.maxCol || 1);
  const left = displayDayIndices.indexOf(cls.day) * dayWidth + ((cls.col || 0) * blockWidth);

    const formatH = (h: number) => {
      const totalMins = Math.round(h * 60);
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      const ampm = hrs >= 12 && hrs < 24 ? 'PM' : 'AM';
      const displayH = hrs > 12 ? hrs - 12 : (hrs === 0 ? 12 : hrs);
      return `${displayH}:${mins.toString().padStart(2, '0')} ${ampm}`;
    };
    
    const formatDuration = (dur: number) => {
      const totalMins = Math.round(dur * 60);
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      let str = '';
      if (hrs > 0) str += `${hrs}h`;
      if (mins > 0) str += `${hrs > 0 ? ' ' : ''}${mins}m`;
      return str || '0m';
    };

    const showTime = cls.duration >= 0.5;
    const showRoom = cls.duration >= 0.75;
    const showTeacher = cls.duration >= 1.0 && !!cls.instructor;
    const showDuration = cls.duration >= 1.25;

    return (
      <Animated.View
        style={{
          position: 'absolute',
          top: top,
          left: left,
          width: blockWidth,
          height: height,
          zIndex: isSelected ? 100 : 10,
          opacity: reveal,
          transform: [
            { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
            { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          ],
        }}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            if (isQuickEditMode) {
              onToggleSelect(cls.id);
            } else {
              onPressClass(cls);
            }
          }}
          style={{
            flex: 1,
            backgroundColor: color.solid,
            // The app's tactile lip, not a cast shadow. Selection swaps it for
            // a full ring so the state is obvious at any zoom.
            borderWidth: isSelected ? (isExportMode ? 3 : Math.max(2, 2 * z)) : 0,
            borderColor: isSelected ? (isDark ? '#ffffff' : '#0f172a') : 'transparent',
            borderBottomWidth: isSelected ? (isExportMode ? 3 : Math.max(2, 2 * z)) : (isExportMode ? 4 : Math.max(2, 3 * z)),
            borderBottomColor: isSelected ? (isDark ? '#ffffff' : '#0f172a') : color.edge,
            borderRadius: isExportMode ? 14 : Math.max(6, 10 * z),
            marginLeft: 2 * z,
            marginRight: isExportMode ? 2 : 0,
            padding: isExportMode ? 12 : 8 * z,
            overflow: 'hidden',
          }}
        >
            {isSelected && (
                <View style={{ position: 'absolute', right: 4 * z, top: 4 * z, width: 16 * z, height: 16 * z, borderRadius: 8 * z, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                    <Ionicons name="checkmark" size={12 * z} color={color.solid} />
                </View>
            )}
            
            <Text style={{ color: '#ffffff', fontSize: isExportMode ? 18 : Math.max(8, 13 * z), fontFamily: 'Nunito_800ExtraBold', lineHeight: isExportMode ? 22 : Math.max(10, 16 * z), marginBottom: isExportMode ? 4 : 2 * z }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
              {cls.name}
            </Text>
            
            {showTime && (
              <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: isExportMode ? 13 : Math.max(7, 9 * z), fontFamily: 'Nunito_700Bold', marginBottom: isExportMode ? 4 : 2 * z }} numberOfLines={1}>
                 {formatH(cls.startHour)} - {formatH(cls.startHour + cls.duration)}
              </Text>
            )}

            {showRoom && cls.displayRoom && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: isExportMode ? 2 : 1 * z, marginBottom: isExportMode ? 4 : 2 * z }}>
                <Ionicons name="location" size={isExportMode ? 12 : 9 * z} color="rgba(255,255,255,0.8)" />
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: isExportMode ? 12 : Math.max(7, 9 * z), fontFamily: 'Nunito_600SemiBold', marginLeft: 2 * z }} numberOfLines={1}>
                  {cls.displayRoom}
                </Text>
              </View>
            )}

            {showTeacher && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: isExportMode ? 2 : 1 * z, marginBottom: isExportMode ? 4 : 2 * z }}>
                <Ionicons name="person" size={isExportMode ? 12 : 9 * z} color="rgba(255,255,255,0.8)" />
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: isExportMode ? 12 : Math.max(7, 9 * z), fontFamily: 'Nunito_400Regular', marginLeft: 2 * z }} numberOfLines={1}>
                  {cls.instructor}
                </Text>
              </View>
            )}

            {showDuration && (
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: isExportMode ? 11 : Math.max(6, 8 * z), fontFamily: 'Nunito_600SemiBold', position: 'absolute', bottom: isExportMode ? 8 : 4 * z, left: isExportMode ? 12 : 8 * z }}>
                {formatDuration(cls.duration)}
              </Text>
            )}
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function TimetableGrid({ classes, isDark, isQuickEditMode = false, isExportMode = false, zoomScale = 1, fillHeight = false, revealToken = 0, onUpdateClass, onUpdateClasses, onDeleteClasses, onPressClass }: any) {
  const minClassHour = classes?.length > 0 ? Math.min(...classes.map((c:any) => c.startHour)) : 7;
  const maxClassHour = classes?.length > 0 ? Math.max(...classes.map((c:any) => c.startHour + c.duration)) : 20;
  
  const START_HOUR = isExportMode 
      ? (classes?.length > 0 ? Math.max(0, Math.floor(minClassHour) - 1) : 7)
      : Math.max(0, Math.min(7, Math.floor(minClassHour)));
  const END_HOUR = isExportMode 
      ? (classes?.length > 0 ? Math.min(24, Math.ceil(maxClassHour) + 1) : 20)
      : Math.min(24, Math.max(20, Math.ceil(maxClassHour)));
  const HOURS_COUNT = END_HOUR - START_HOUR;
  const HOURS = Array.from({ length: HOURS_COUNT }, (_, i) => START_HOUR + i);

  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const styles = getThemeStyles(isDark, isExportMode);
  const headerScrollRef = useRef<ScrollView>(null);
  const hasSundayClass = classes?.some((c: any) => c.day === 6);
  const displayDayIndices = useMemo(
    () => (isExportMode ? [6, 0, 1, 2, 3, 4, 5] : (hasSundayClass ? [6, 0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5])),
    [isExportMode, hasSundayClass],
  );
  const DAY_WIDTH = getDayWidth(displayDayIndices.length, isExportMode, SCREEN_WIDTH) * (isExportMode ? 1 : zoomScale);
  const hourHeight = getHourHeight(isExportMode) * (isExportMode ? 1 : zoomScale);
  const timeColWidth = getTimeColWidth(isExportMode) * (isExportMode ? 1 : zoomScale);

  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isQuickEditMode) {
      setSelectedClassIds(new Set());
    }
  }, [isQuickEditMode]);

  // Stable identity, so every block does not get a fresh callback each render.
  const handleToggleSelect = useCallback((clsId: string) => {
    setSelectedClassIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(clsId)) newSet.delete(clsId);
      else newSet.add(clsId);
      return newSet;
    });
  }, []);

  const handleSelectAll = () => {
    if (selectedClassIds.size === classes.length) {
      setSelectedClassIds(new Set());
    } else {
      setSelectedClassIds(new Set(classes.map((c: any) => c.id)));
    }
  };

  const applyBulkUpdate = (updateFn: (cls: any) => any) => {
    if (!onUpdateClasses) return;
    const updatesList: any[] = [];
    classes.forEach((cls: any) => {
      if (selectedClassIds.has(cls.id)) {
        updatesList.push({ id: cls.id, updates: updateFn(cls) });
      }
    });
    if (updatesList.length > 0) {
      onUpdateClasses(updatesList);
    }
  };

  const moveTimeBulk = (hourDelta: number) => {
    applyBulkUpdate(cls => {
      let newHour = cls.startHour + hourDelta;
      if (newHour < START_HOUR) newHour = START_HOUR;
      if (newHour + cls.duration > END_HOUR) newHour = END_HOUR - cls.duration;
      return { startHour: newHour };
    });
  };

  const moveDayBulk = (direction: number) => {
    applyBulkUpdate(cls => {
      const currentColIdx = displayDayIndices.indexOf(cls.day);
      const newColIdx = Math.max(0, Math.min(displayDayIndices.length - 1, currentColIdx + direction));
      return { day: displayDayIndices[newColIdx] };
    });
  };

  const changeDurationBulk = (durDelta: number) => {
    applyBulkUpdate(cls => {
      let newDur = Math.max(5/60, cls.duration + durDelta);
      if (cls.startHour + newDur > END_HOUR) newDur = END_HOUR - cls.startHour;
      return { duration: newDur };
    });
  };

  const formatTime = (h: number) => {
    const ampm = h >= 12 && h < 24 ? 'PM' : 'AM';
    const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return `${displayH} ${ampm}`;
  };

  // The overlap layout used to run on every render and rebuild every class
  // object, so the memo on ClassBlock could never hit. It now recomputes only
  // when the classes actually change, and carries each block's resolved room
  // so ClassBlock no longer depends on the whole array.
  const processedClasses = useMemo(() => {
  const processed = classes?.map((c: any) => ({ ...c, col: 0, maxCol: 1, displayRoom: getRoomForClass(c, classes) })) || [];
  displayDayIndices.forEach(dayIdx => {
    const dayClasses = processed.filter((c: any) => c.day === dayIdx).sort((a: any, b: any) => a.startHour - b.startHour);
    
    // Group overlapping classes into contiguous blocks
    const groups: any[][] = [];
    let currentGroup: any[] = [];
    let groupEnd = -1;

    dayClasses.forEach((cls: any) => {
      if (currentGroup.length === 0) {
        currentGroup.push(cls);
        groupEnd = cls.startHour + cls.duration;
      } else if (cls.startHour >= groupEnd) {
        // No overlap with current group, push and start new group
        groups.push(currentGroup);
        currentGroup = [cls];
        groupEnd = cls.startHour + cls.duration;
      } else {
        // Overlaps with current group
        currentGroup.push(cls);
        groupEnd = Math.max(groupEnd, cls.startHour + cls.duration);
      }
    });
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    // Now layout each group independently
    groups.forEach(group => {
      const columns: any[][] = [];
      group.forEach((cls: any) => {
        let placed = false;
        for (let i = 0; i < columns.length; i++) {
          const lastClassInCol = columns[i][columns[i].length - 1];
          // We can place it in this column if it starts after the last class ends
          if (lastClassInCol.startHour + lastClassInCol.duration <= cls.startHour) {
            columns[i].push(cls);
            cls.col = i;
            placed = true;
            break;
          }
        }
        if (!placed) {
          cls.col = columns.length;
          columns.push([cls]);
        }
      });
      // All classes in this connected group get the same maxCol
      group.forEach((cls: any) => {
        cls.maxCol = columns.length;
      });
    });
  });
  const order = [...processed].sort((a: any, b: any) => {
    const da = displayDayIndices.indexOf(a.day);
    const db = displayDayIndices.indexOf(b.day);
    if (da !== db) return da - db;
    return (a.startHour || 0) - (b.startHour || 0);
  });
  order.forEach((c: any, i: number) => { c.appearIndex = i; });

  return processed;
  }, [classes, displayDayIndices]);

  return (
    <View style={{ ...(isExportMode ? {} : (fillHeight ? { flex: 1 } : { height: 600 })), backgroundColor: styles.gridBg, borderRadius: styles.borderRadius, overflow: 'hidden', borderWidth: styles.outerBorderWidth, borderColor: styles.outerBorderColor }}>
      <View style={{ flexDirection: 'row', backgroundColor: styles.headerBg }}>
        <View style={{ width: timeColWidth, borderRightWidth: isExportMode ? 2 : 1, borderColor: styles.gridLine }} />
        {isExportMode ? (
          <View style={{ flexDirection: 'row' }}>
            {displayDayIndices.map((dayIdx, idx) => (
              <View key={idx} style={{ width: DAY_WIDTH, alignItems: 'center', borderRightWidth: 2, borderColor: styles.gridLine }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: styles.textColor, paddingVertical: 18, letterSpacing: 0.5 }}>{FULL_DAYS[dayIdx]}</Text>
              </View>
            ))}
          </View>
        ) : (
          <ScrollView ref={headerScrollRef} horizontal showsHorizontalScrollIndicator={false} bounces={false} scrollEnabled={false}>
            <View style={{ flexDirection: 'row', width: displayDayIndices.length * DAY_WIDTH }}>
              {displayDayIndices.map((dayIdx, idx) => (
                <View key={idx} style={{ width: DAY_WIDTH, alignItems: 'center', borderRightWidth: 1, borderColor: isDark ? '#1e293b' : '#e2e8f0' }}>
                  <Text style={{ fontSize: Math.max(9, 12 * zoomScale), fontWeight: 'bold', color: isDark ? '#94a3b8' : '#64748b', paddingVertical: 8 * zoomScale }}>{DAYS[dayIdx]}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Grid */}
      {isExportMode ? (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row' }}>
            {/* Time Column */}
            <View style={{ width: timeColWidth, borderRightWidth: 2, borderColor: isDark ? '#334155' : '#e2e8f0', paddingTop: 10 }}>
              {HOURS.map((h, i) => (
                <View key={i} style={{ height: hourHeight, justifyContent: 'flex-start', alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: isDark ? '#64748b' : '#94a3b8', marginTop: i === 0 ? 0 : -9, backgroundColor: isDark ? '#1e293b' : '#ffffff', paddingHorizontal: 6 }}>
                    {formatTime(h)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Grid Area */}
            <View>
              <View style={{ width: displayDayIndices.length * DAY_WIDTH, height: HOURS_COUNT * hourHeight, paddingTop: 10 }}>
                {/* Weekend shading */}
                {isExportMode && displayDayIndices.map((dayIdx, i) => (
                  (dayIdx === 5 || dayIdx === 6) ? (
                    <View key={`wk-${i}`} style={{ position: 'absolute', left: i * DAY_WIDTH, top: 0, width: DAY_WIDTH, height: '100%', backgroundColor: isDark ? 'rgba(99,102,241,0.04)' : 'rgba(99,102,241,0.03)' }} />
                  ) : null
                ))}
                {/* Grid Lines */}
                {HOURS.map((_, i) => (
                  <View key={i} style={{ position: 'absolute', top: i * hourHeight + 10, width: '100%', height: 2, backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }} />
                ))}
                <View style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', flexDirection: 'row', pointerEvents: 'none' }}>
                  {displayDayIndices.map((_, i) => (
                    <View key={i} style={{ width: DAY_WIDTH, borderRightWidth: 2, borderColor: isDark ? '#1e293b' : '#f1f5f9' }} />
                  ))}
                </View>

                {/* Classes */}
                {processedClasses.map((cls: any) => (
                  <ClassBlock 
                    key={cls.id} 
                    cls={cls} 
                    isDark={isDark}
                    isQuickEditMode={isQuickEditMode}
                    isSelected={selectedClassIds.has(cls.id)}
                    onToggleSelect={handleToggleSelect}
                    onPressClass={onPressClass}
                    START_HOUR={START_HOUR}
                    END_HOUR={END_HOUR}
                    displayDayIndices={displayDayIndices}
                    dayWidth={DAY_WIDTH}
                    isExportMode={true}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>
      ) : (
    <ScrollView style={{ flex: 1 }} nestedScrollEnabled={true}>
          <View style={{ flexDirection: 'row' }}>
            {/* Time Column */}
            <View style={{ width: timeColWidth, borderRightWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0', paddingTop: 10 * zoomScale }}>
              {HOURS.map((h, i) => (
                <View key={i} style={{ height: hourHeight, justifyContent: 'flex-start', alignItems: 'center' }}>
                  <Text style={{ fontSize: Math.max(7, 10 * zoomScale), fontWeight: '700', color: isDark ? '#64748b' : '#94a3b8', marginTop: i === 0 ? 0 : -6 * zoomScale, backgroundColor: styles.gridBg, paddingHorizontal: 3 * zoomScale }}>
                    {formatTime(h)}
                  </Text>
                </View>
              ))}
            </View>

            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              bounces={false}
              nestedScrollEnabled={true}
              onScroll={(e) => {
                if (headerScrollRef.current) {
                  headerScrollRef.current.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });
                }
              }}
              scrollEventThrottle={16}
            >
              <View style={{ width: displayDayIndices.length * DAY_WIDTH, height: HOURS_COUNT * hourHeight, paddingTop: 10 * zoomScale }}>
                {/* Grid Lines */}
                {HOURS.map((_, i) => (
                  <View key={i} style={{ position: 'absolute', top: i * hourHeight + (10 * zoomScale), width: '100%', height: 1, backgroundColor: styles.gridLine }} />
                ))}
                <View style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', flexDirection: 'row', pointerEvents: 'none' }}>
                  {displayDayIndices.map((_, i) => (
                    <View key={i} style={{ width: DAY_WIDTH, borderRightWidth: 1, borderColor: isDark ? '#1e293b' : '#e2e8f0' }} />
                  ))}
                </View>

                {/* Classes */}
                {processedClasses.map((cls: any) => (
                  <ClassBlock 
                    key={cls.id}
                    cls={cls} 
                    isDark={isDark}
                    isQuickEditMode={isQuickEditMode}
                    isSelected={selectedClassIds.has(cls.id)}
                    onToggleSelect={handleToggleSelect}
                    onPressClass={onPressClass}
                    START_HOUR={START_HOUR}
                    END_HOUR={END_HOUR}
                    displayDayIndices={displayDayIndices}
                    dayWidth={DAY_WIDTH}
                    zoomScale={zoomScale}
                    appearIndex={cls.appearIndex}
                    appearToken={revealToken}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}

      {/* Editing Controls */}
      {isQuickEditMode && (
        <View style={{ position: 'absolute', bottom: 10, left: getTimeColWidth(isExportMode) + 10, right: 10, padding: 12, backgroundColor: isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)', borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: selectedClassIds.size > 0 ? 12 : 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="information-circle" size={24} color="#6366f1" />
              <Text style={{ marginLeft: 10, fontSize: 12, fontWeight: '600', color: isDark ? '#cbd5e1' : '#475569' }}>
                {selectedClassIds.size > 0 
                  ? `${selectedClassIds.size} block${selectedClassIds.size > 1 ? 's' : ''} selected` 
                  : "Tap blocks to select them for bulk editing."}
              </Text>
            </View>
            <TouchableOpacity onPress={handleSelectAll} style={{ backgroundColor: isDark ? '#334155' : '#e2e8f0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: isDark ? '#94a3b8' : '#475569' }}>
                {selectedClassIds.size === classes.length && classes.length > 0 ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {selectedClassIds.size > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDark ? '#0f172a' : '#f1f5f9', padding: 8, borderRadius: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => moveDayBulk(-1)} style={{ padding: 6 }}><Ionicons name="arrow-back" size={18} color={isDark ? '#e2e8f0' : '#475569'} /></TouchableOpacity>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: isDark ? '#94a3b8' : '#64748b', marginHorizontal: 4 }}>DAY</Text>
                <TouchableOpacity onPress={() => moveDayBulk(1)} style={{ padding: 6 }}><Ionicons name="arrow-forward" size={18} color={isDark ? '#e2e8f0' : '#475569'} /></TouchableOpacity>
              </View>
              
              <View style={{ width: 1, height: 20, backgroundColor: isDark ? '#334155' : '#cbd5e1' }} />
              
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => moveTimeBulk(-5/60)} style={{ padding: 6 }}><Ionicons name="arrow-up" size={18} color={isDark ? '#e2e8f0' : '#475569'} /></TouchableOpacity>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: isDark ? '#94a3b8' : '#64748b', marginHorizontal: 4 }}>TIME</Text>
                <TouchableOpacity onPress={() => moveTimeBulk(5/60)} style={{ padding: 6 }}><Ionicons name="arrow-down" size={18} color={isDark ? '#e2e8f0' : '#475569'} /></TouchableOpacity>
              </View>

              <View style={{ width: 1, height: 20, backgroundColor: isDark ? '#334155' : '#cbd5e1' }} />
              
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => changeDurationBulk(-5/60)} style={{ padding: 6 }}><Ionicons name="remove" size={18} color={isDark ? '#e2e8f0' : '#475569'} /></TouchableOpacity>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: isDark ? '#94a3b8' : '#64748b', marginHorizontal: 4 }}>DUR</Text>
                <TouchableOpacity onPress={() => changeDurationBulk(5/60)} style={{ padding: 6 }}><Ionicons name="add" size={18} color={isDark ? '#e2e8f0' : '#475569'} /></TouchableOpacity>
              </View>

              {onDeleteClasses && (
                <>
                  <View style={{ width: 1, height: 20, backgroundColor: isDark ? '#334155' : '#cbd5e1', marginLeft: 4 }} />
                  <TouchableOpacity 
                    onPress={() => {
                      Alert.alert("Delete Selected", `Are you sure you want to delete ${selectedClassIds.size} class block(s)?`, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => {
                            onDeleteClasses(Array.from(selectedClassIds));
                            setSelectedClassIds(new Set());
                        }}
                      ]);
                    }}
                    style={{ padding: 6, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, marginLeft: 8 }}
                  >
                    <Ionicons name="trash" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
