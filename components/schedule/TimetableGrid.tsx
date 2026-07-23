import React, { useState, useRef, useEffect, memo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOUR_HEIGHT = 60; // Pixels per hour
const TIME_COL_WIDTH = 44;
const SCREEN_WIDTH = Dimensions.get('window').width;
// Responsive day column width: fit all visible days within screen
const getDayWidth = (numDays: number) => {
    const available = SCREEN_WIDTH - TIME_COL_WIDTH - 32; // account for container padding
    const fitWidth = Math.floor(available / numDays);
    return Math.max(80, Math.min(fitWidth, 140)); // clamp between 80-140
};

const COLORS = [
  { bg: 'rgba(41, 151, 255, 0.2)', border: '#2997ff', text: '#2997ff' },
  { bg: 'rgba(48, 209, 88, 0.2)', border: '#30d158', text: '#30d158' },
  { bg: 'rgba(191, 90, 242, 0.2)', border: '#bf5af2', text: '#bf5af2' },
  { bg: 'rgba(255, 159, 10, 0.2)', border: '#ff9f0a', text: '#ff9f0a' },
  { bg: 'rgba(255, 69, 58, 0.2)', border: '#ff453a', text: '#ff453a' },
  { bg: 'rgba(100, 210, 255, 0.2)', border: '#64d2ff', text: '#64d2ff' },
];

// Brighter, more saturated colors for dark mode export
const EXPORT_DARK_COLORS = [
  { bg: 'rgba(56, 162, 255, 0.22)', border: '#56aaff', text: '#8ec5ff' },
  { bg: 'rgba(60, 220, 100, 0.2)', border: '#4ade80', text: '#7defa0' },
  { bg: 'rgba(200, 100, 252, 0.2)', border: '#c084fc', text: '#d8b4fe' },
  { bg: 'rgba(255, 170, 30, 0.2)', border: '#fbbf24', text: '#fcd34d' },
  { bg: 'rgba(255, 80, 70, 0.2)', border: '#f87171', text: '#fca5a5' },
  { bg: 'rgba(110, 220, 255, 0.2)', border: '#7dd3fc', text: '#a5e1fc' },
];

// Softer, pastel colors for light mode export
const EXPORT_LIGHT_COLORS = [
  { bg: 'rgba(41, 151, 255, 0.1)', border: '#2997ff', text: '#1a7fd4' },
  { bg: 'rgba(48, 209, 88, 0.1)', border: '#30d158', text: '#1da34a' },
  { bg: 'rgba(191, 90, 242, 0.1)', border: '#bf5af2', text: '#a03cd1' },
  { bg: 'rgba(255, 159, 10, 0.1)', border: '#ff9f0a', text: '#d4830a' },
  { bg: 'rgba(255, 69, 58, 0.1)', border: '#ff453a', text: '#d43a30' },
  { bg: 'rgba(100, 210, 255, 0.1)', border: '#64d2ff', text: '#3ba8d9' },
];

const ClassBlock = memo(({ 
  cls, isDark, isQuickEditMode, isSelected, onToggleSelect,
  onPressClass, START_HOUR, END_HOUR, displayDayIndices, dayWidth, isExportMode = false
}: any) => {
  const exportColors = isDark ? EXPORT_DARK_COLORS : EXPORT_LIGHT_COLORS;
  const color = isExportMode ? exportColors[cls.colorIdx % exportColors.length] : COLORS[cls.colorIdx % COLORS.length];
  
  const top = (cls.startHour - START_HOUR) * HOUR_HEIGHT + 10;
  const height = cls.duration * HOUR_HEIGHT;
  const blockWidth = (dayWidth - 4) / (cls.maxCol || 1);
  const left = displayDayIndices.indexOf(cls.day) * dayWidth + ((cls.col || 0) * blockWidth);

  return (
    <View
      style={{
        position: 'absolute',
        top: top,
        left: left,
        width: blockWidth,
        height: height,
        zIndex: isSelected ? 100 : 10,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          if (isQuickEditMode) {
            onToggleSelect();
          } else {
            onPressClass(cls);
          }
        }}
        style={{
          flex: 1,
          backgroundColor: isExportMode ? color.bg : (isDark ? color.bg : `${color.border}15`),
          borderLeftColor: color.border,
          borderLeftWidth: isExportMode ? 3 : 4,
          borderRadius: isExportMode ? 10 : 14,
          marginLeft: 2,
          marginRight: isExportMode ? 2 : 0,
          padding: isExportMode ? 6 : 4,
          overflow: 'hidden',
          borderWidth: isSelected ? 2 : (isExportMode ? 1 : 0),
          borderColor: isSelected ? (isDark ? 'white' : 'black') : (isExportMode ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)') : 'transparent'),
        }}
      >
          {isSelected && (
              <View style={{ position: 'absolute', right: 4, top: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: isDark ? 'white' : 'black', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                  <Ionicons name="checkmark" size={12} color={isDark ? 'black' : 'white'} />
              </View>
          )}
          <Text style={{ color: color.text, fontWeight: 'bold', fontSize: isExportMode ? 12 : 11, marginBottom: 2 }} numberOfLines={1}>
            {cls.name}
          </Text>
          {cls.duration >= 0.75 && (
            <Text style={{ color: isExportMode ? (isDark ? '#8b9cb3' : '#64748b') : (isDark ? '#94a3b8' : '#64748b'), fontSize: isExportMode ? 10 : 9, fontWeight: isExportMode ? '500' : '400' }} numberOfLines={2}>
              {(() => {
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
                return `${formatH(cls.startHour)} - ${formatH(cls.startHour + cls.duration)} (${formatDuration(cls.duration)})`;
              })()}
            </Text>
          )}
      </TouchableOpacity>
    </View>
  );
});

export default function TimetableGrid({ classes, isDark, isQuickEditMode = false, isExportMode = false, onUpdateClass, onUpdateClasses, onDeleteClasses, onPressClass }: any) {
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

  const headerScrollRef = useRef<ScrollView>(null);
  const hasSundayClass = classes?.some((c: any) => c.day === 6);
  const displayDayIndices = isExportMode ? [6, 0, 1, 2, 3, 4, 5] : (hasSundayClass ? [6, 0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5]);
  const DAY_WIDTH = isExportMode ? 116 : getDayWidth(displayDayIndices.length);

  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isQuickEditMode) {
      setSelectedClassIds(new Set());
    }
  }, [isQuickEditMode]);

  const handleToggleSelect = (clsId: string) => {
    const newSet = new Set(selectedClassIds);
    if (newSet.has(clsId)) newSet.delete(clsId);
    else newSet.add(clsId);
    setSelectedClassIds(newSet);
  };

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

  // Pre-process classes to find overlaps and assign them columns
  const processedClasses = classes?.map((c: any) => ({ ...c, col: 0, maxCol: 1 })) || [];
  displayDayIndices.forEach(dayIdx => {
    const dayClasses = processedClasses.filter((c: any) => c.day === dayIdx).sort((a: any, b: any) => a.startHour - b.startHour);
    const columns: any[][] = [];
    
    dayClasses.forEach((cls: any) => {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const lastClassInCol = columns[i][columns[i].length - 1];
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

    dayClasses.forEach((cls: any) => {
      cls.maxCol = columns.length;
    });
  });

  return (
    <View style={{ height: isExportMode ? undefined : 600, backgroundColor: isDark ? '#0f172a' : '#ffffff', borderRadius: isExportMode ? 0 : 28, overflow: 'hidden', borderWidth: isExportMode ? 0 : 1.5, borderColor: isDark ? '#1e293b' : '#e2e8f0' }}>
      {/* Header: Days */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? '#162032' : '#f8fafc' }}>
        <View style={{ width: TIME_COL_WIDTH, borderRightWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0' }} />
        {isExportMode ? (
          <View style={{ flexDirection: 'row' }}>
            {displayDayIndices.map((dayIdx, idx) => (
              <View key={idx} style={{ width: DAY_WIDTH, alignItems: 'center', borderRightWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: isDark ? '#e2e8f0' : '#334155', paddingVertical: 12, letterSpacing: 0.3 }}>{FULL_DAYS[dayIdx]}</Text>
              </View>
            ))}
          </View>
        ) : (
          <ScrollView ref={headerScrollRef} horizontal showsHorizontalScrollIndicator={false} bounces={false} scrollEnabled={false}>
            {displayDayIndices.map((dayIdx, idx) => (
              <View key={idx} style={{ width: DAY_WIDTH, alignItems: 'center', borderRightWidth: 1, borderColor: isDark ? '#1e293b' : '#e2e8f0' }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: isDark ? '#94a3b8' : '#64748b', paddingVertical: 8 }}>{DAYS[dayIdx]}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Grid */}
      {isExportMode ? (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row' }}>
            {/* Time Column */}
            <View style={{ width: TIME_COL_WIDTH, borderRightWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0', paddingTop: 10 }}>
              {HOURS.map((h, i) => (
                <View key={i} style={{ height: HOUR_HEIGHT, justifyContent: 'flex-start', alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? '#64748b' : '#94a3b8', marginTop: i === 0 ? 0 : -6, backgroundColor: isDark ? '#1e293b' : '#ffffff', paddingHorizontal: 3 }}>
                    {formatTime(h)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Grid Area */}
            <View>
              <View style={{ width: displayDayIndices.length * DAY_WIDTH, height: HOURS_COUNT * HOUR_HEIGHT, paddingTop: 10 }}>
                {/* Weekend shading */}
                {isExportMode && displayDayIndices.map((dayIdx, i) => (
                  (dayIdx === 5 || dayIdx === 6) ? (
                    <View key={`wk-${i}`} style={{ position: 'absolute', left: i * DAY_WIDTH, top: 0, width: DAY_WIDTH, height: '100%', backgroundColor: isDark ? 'rgba(99,102,241,0.04)' : 'rgba(99,102,241,0.03)' }} />
                  ) : null
                ))}
                {/* Grid Lines */}
                {HOURS.map((_, i) => (
                  <View key={i} style={{ position: 'absolute', top: i * HOUR_HEIGHT + 10, width: '100%', height: 1, backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }} />
                ))}
                {displayDayIndices.map((_, i) => (
                  <View key={i} style={{ position: 'absolute', left: i * DAY_WIDTH, width: 1, height: '100%', backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }} />
                ))}

                {/* Classes */}
                {processedClasses.map((cls: any) => (
                  <ClassBlock 
                    key={cls.id} 
                    cls={cls} 
                    isDark={isDark}
                    isQuickEditMode={isQuickEditMode}
                    isSelected={selectedClassIds.has(cls.id)}
                    onToggleSelect={() => handleToggleSelect(cls.id)}
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
            <View style={{ width: TIME_COL_WIDTH, borderRightWidth: 1, borderColor: isDark ? '#1e293b' : '#e2e8f0', paddingTop: 10 }}>
              {HOURS.map((h, i) => (
                <View key={i} style={{ height: HOUR_HEIGHT, justifyContent: 'flex-start', alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, color: isDark ? '#64748b' : '#94a3b8', marginTop: i === 0 ? 0 : -6, backgroundColor: isDark ? '#0f172a' : '#ffffff', paddingHorizontal: 2 }}>
                    {formatTime(h)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Grid Area */}
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
              <View style={{ width: displayDayIndices.length * DAY_WIDTH, height: HOURS_COUNT * HOUR_HEIGHT, paddingTop: 10 }}>
                {/* Grid Lines */}
                {HOURS.map((_, i) => (
                  <View key={i} style={{ position: 'absolute', top: i * HOUR_HEIGHT + 10, width: '100%', height: 1, backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }} />
                ))}
                {displayDayIndices.map((_, i) => (
                  <View key={i} style={{ position: 'absolute', left: i * DAY_WIDTH, width: 1, height: '100%', backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }} />
                ))}

                {/* Classes */}
                {processedClasses.map((cls: any) => (
                  <ClassBlock 
                    key={cls.id} 
                    cls={cls} 
                    isDark={isDark}
                    isQuickEditMode={isQuickEditMode}
                    isSelected={selectedClassIds.has(cls.id)}
                    onToggleSelect={() => handleToggleSelect(cls.id)}
                    onPressClass={onPressClass}
                    START_HOUR={START_HOUR}
                    END_HOUR={END_HOUR}
                    displayDayIndices={displayDayIndices}
                    dayWidth={DAY_WIDTH}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}

      {/* Editing Controls */}
      {isQuickEditMode && (
        <View style={{ position: 'absolute', bottom: 10, left: TIME_COL_WIDTH + 10, right: 10, padding: 12, backgroundColor: isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)', borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }}>
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
