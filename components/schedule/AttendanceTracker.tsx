import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';

const COLORS = [
  { bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-500', hex: '#ff453a' },
  { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-500', hex: '#30d158' },
  { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500', hex: '#0a84ff' },
  { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-500', hex: '#ff9f0a' },
  { bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-500', hex: '#bf5af2' },
  { bg: 'bg-cyan-500', border: 'border-cyan-500', text: 'text-cyan-500', hex: '#64d2ff' }
];

const formatTimeStr = (hourFloat: number) => {
  const h = Math.floor(hourFloat);
  const m = Math.round((hourFloat - h) * 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  const displayM = m < 10 ? `0${m}` : m;
  return `${displayH}:${displayM} ${ampm}`;
};

export default function AttendanceTracker({ data, activeYearId, activeSemId, saveData, targetDate, trigger }: any) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [currentDate] = useState(new Date());
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [takeawayInputs, setTakeawayInputs] = useState<Record<string, string>>({});
  const [editingTakeaway, setEditingTakeaway] = useState<string | null>(null);
  const [selectedDayDateStr, setSelectedDayDateStr] = useState<string | null>(null);

  const currentSem = useMemo(() => {
    if (!data || !activeYearId || !activeSemId) return null;
    return data.years.find((y: any) => y.id === activeYearId)?.semesters.find((s: any) => s.id === activeSemId);
  }, [data, activeYearId, activeSemId]);

  if (!currentSem) return null;

  const defaultStart = new Date().toISOString().split('T')[0];
  const defaultEnd = new Date(Date.now() + 1000 * 60 * 60 * 24 * 120).toISOString().split('T')[0];
  
  const startDateStr = currentSem.startDate || defaultStart;
  const endDateStr = currentSem.endDate || defaultEnd;
  const attendanceLog = currentSem.attendanceLog || {};
  const classes = currentSem.classes || [];

  const handleUpdateBounds = (field: string, value: string) => {
    const nd = JSON.parse(JSON.stringify(data));
    const sem = nd.years.find((y: any) => y.id === activeYearId).semesters.find((s: any) => s.id === activeSemId);
    sem[field] = value;
    saveData(nd);
  };

  const getLogEntry = (sessionKey: string) => {
    const raw = attendanceLog[sessionKey];
    if (typeof raw === 'boolean') {
      return { status: raw ? 'present' : null, takeaway: '' };
    }
    return raw || {};
  };

  const handleUpdateStatus = (sessionKey: string, newStatus: string) => {
    const nd = JSON.parse(JSON.stringify(data));
    const sem = nd.years.find((y: any) => y.id === activeYearId).semesters.find((s: any) => s.id === activeSemId);
    if (!sem.attendanceLog) sem.attendanceLog = {};
    
    let current = sem.attendanceLog[sessionKey];
    if (typeof current === 'boolean') {
      current = { status: current ? 'present' : null };
    }
    
    sem.attendanceLog[sessionKey] = {
      ...(current || {}),
      status: newStatus,
      isManual: true
    };
    saveData(nd);
  };

  const handleUpdateTakeaway = (sessionKey: string, text: string) => {
    const nd = JSON.parse(JSON.stringify(data));
    const sem = nd.years.find((y: any) => y.id === activeYearId).semesters.find((s: any) => s.id === activeSemId);
    if (!sem.attendanceLog) sem.attendanceLog = {};
    
    let current = sem.attendanceLog[sessionKey];
    if (typeof current === 'boolean') {
      current = { status: current ? 'present' : null };
    }
    
    sem.attendanceLog[sessionKey] = {
      ...(current || {}),
      takeaway: text
    };
    saveData(nd);
    setEditingTakeaway(null);
  };

  const { groupedWeeks, stats } = useMemo<{ groupedWeeks: Record<string, any>; stats: Record<string, any> }>(() => {
    const sessList: any[] = [];
    if (!classes.length) return { groupedWeeks: {}, stats: {} };
    
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const oneWeekAgo = new Date(currentDate);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
      const dateStr = d.toISOString().split('T')[0];
      
      const dayClasses = classes.filter((c: any) => c.day === dayIdx);
      dayClasses.forEach((cls: any) => {
        const key = `${dateStr}_${cls.id}`;
        const log = getLogEntry(key);
        const sessionDate = new Date(d);
        sessionDate.setHours(Math.floor(cls.startHour), (cls.startHour % 1) * 60);

        let status = log.status || 'pending';
        const isPast = sessionDate < currentDate;
        
        if (!log.isManual && status === 'pending' && sessionDate < oneWeekAgo) {
          status = 'absent';
        }

        if (!isPast && status === 'pending') {
          status = 'future';
        }

        sessList.push({
          key,
          date: new Date(d),
          dateStr,
          classObj: cls,
          status,
          takeaway: log.takeaway || '',
          isPast
        });
      });
    }

    sessList.sort((a, b) => a.date.getTime() - b.date.getTime() || a.classObj.startHour - b.classObj.startHour);

    const groups: Record<string, any> = {};
    const firstDate = new Date(startDateStr);
    const startOffset = firstDate.getDay() === 0 ? 6 : firstDate.getDay() - 1;
    firstDate.setDate(firstDate.getDate() - startOffset);

    sessList.forEach(s => {
      const diffTime = s.date.getTime() - firstDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const weekNum = Math.floor(diffDays / 7) + 1;
      
      if (!groups[weekNum]) {
        groups[weekNum] = {
          weekNum,
          sessions: [],
          startDate: new Date(firstDate.getTime() + (weekNum - 1) * 7 * 24 * 60 * 60 * 1000),
          endDate: new Date(firstDate.getTime() + (weekNum * 7 - 1) * 24 * 60 * 60 * 1000)
        };
      }
      groups[weekNum].sessions.push(s);
    });

    let past7Total = 0, past7Attended = 0;
    let past30Total = 0, past30Attended = 0;
    let overallTotal = 0, overallAttended = 0;

    const sevenDaysAgo = new Date(currentDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(currentDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    sessList.forEach(s => {
      if (s.isPast && s.status !== 'cancelled') {
        overallTotal += s.classObj.duration;
        if (s.status === 'present') overallAttended += s.classObj.duration;

        if (s.date >= sevenDaysAgo) {
          past7Total += s.classObj.duration;
          if (s.status === 'present') past7Attended += s.classObj.duration;
        }

        if (s.date >= thirtyDaysAgo) {
          past30Total += s.classObj.duration;
          if (s.status === 'present') past30Attended += s.classObj.duration;
        }
      }
    });

    return { groupedWeeks: groups, stats: { past7Total, past7Attended, past30Total, past30Attended, overallTotal, overallAttended } };
  }, [startDateStr, endDateStr, classes, attendanceLog, currentDate]);

  const getFinMessage = () => {
    if (!stats.past7Total) return "You didn't have any classes to attend in the past 7 days!";
    const ratio = stats.past7Attended / stats.past7Total;
    if (ratio === 1) return "Incredible job! You had perfect attendance this week! Keep up the great work!";
    if (ratio >= 0.75) return "Great work! You're keeping up with your classes nicely. Almost perfect attendance!";
    if (ratio >= 0.5) return "You've missed a few classes this week. Try to stay consistent!";
    return "Looks like you missed quite a few classes this week. Don't fall behind!";
  };

  const renderStatBox = (label: string, attended: number, total: number) => {
    const ratio = total === 0 ? 0 : attended / total;
    let colorClass = 'bg-red-500';
    if (ratio >= 0.8) colorClass = 'bg-green-500';
    else if (ratio >= 0.5) colorClass = 'bg-orange-500';

    return (
      <View className={`flex-1 rounded-xl border p-4 m-1 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <Text className={`text-xs font-bold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</Text>
        <View className="flex-row items-baseline mb-3">
          <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{attended.toFixed(1)}</Text>
          <Text className={`text-sm font-medium ml-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>/ {total.toFixed(1)} hrs</Text>
        </View>
        <View className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
          <View className={`h-full ${colorClass}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
        </View>
      </View>
    );
  };

  const sortedWeeksArray = useMemo(() => {
    const activeGroup: any[] = [];
    const completedGroup: any[] = [];

    const firstDate = new Date(startDateStr);
    const startOffset = firstDate.getDay() === 0 ? 6 : firstDate.getDay() - 1;
    firstDate.setDate(firstDate.getDate() - startOffset);
    const diffTime = currentDate.getTime() - firstDate.getTime();
    const currentWeekNum = Math.floor(diffTime / (1000 * 60 * 60 * 24) / 7) + 1;

    Object.values(groupedWeeks).forEach((w: any) => {
      const isCurrentOrFuture = w.weekNum >= currentWeekNum;
      const hasPendingAction = w.sessions.some((s: any) => s.isPast && s.status === 'pending');
      
      if (isCurrentOrFuture || hasPendingAction) {
        w.isCompleted = false;
        activeGroup.push(w);
      } else {
        w.isCompleted = true;
        completedGroup.push(w);
      }
    });

    activeGroup.sort((a, b) => a.weekNum - b.weekNum);
    completedGroup.sort((a, b) => b.weekNum - a.weekNum);

    return { activeGroup, completedGroup };
  }, [groupedWeeks, startDateStr, currentDate]);

  const [processedTrigger, setProcessedTrigger] = useState<string | null>(null);

  useEffect(() => {
    if (targetDate && trigger && trigger !== processedTrigger && Object.keys(groupedWeeks).length > 0) {
      let foundWeekNum: any = null;
      Object.values(groupedWeeks).forEach((w: any) => {
        if (w.sessions.some((s: any) => s.dateStr === targetDate)) {
          foundWeekNum = w.weekNum;
        }
      });
      if (foundWeekNum) {
        setExpandedWeek(foundWeekNum.toString());
        setSelectedDayDateStr(targetDate);
        setProcessedTrigger(trigger);
      }
    }
  }, [targetDate, trigger, processedTrigger, groupedWeeks]);

  const renderStatusButton = (session: any) => {
    if (session.status === 'future') {
      return (
        <View className="flex-row items-center">
          <Ionicons name="time-outline" size={14} color={isDark ? '#94a3b8' : '#64748b'} />
          <Text className={`ml-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Upcoming</Text>
        </View>
      );
    }
    
    return (
      <View className={`flex-row rounded-lg border overflow-hidden ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
        <TouchableOpacity 
          onPress={() => handleUpdateStatus(session.key, session.status === 'present' ? 'pending' : 'present')}
          className={`px-3 py-1.5 flex-row items-center border-r ${isDark ? 'border-slate-700' : 'border-slate-200'} ${session.status === 'present' ? 'bg-green-500' : ''}`}
        >
          <Ionicons name="checkmark-circle" size={14} color={session.status === 'present' ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b')} />
          <Text className={`ml-1 text-xs font-semibold ${session.status === 'present' ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>Present</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => handleUpdateStatus(session.key, session.status === 'absent' ? 'pending' : 'absent')}
          className={`px-3 py-1.5 flex-row items-center border-r ${isDark ? 'border-slate-700' : 'border-slate-200'} ${session.status === 'absent' ? 'bg-red-500' : ''}`}
        >
          <Ionicons name="close-circle" size={14} color={session.status === 'absent' ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b')} />
          <Text className={`ml-1 text-xs font-semibold ${session.status === 'absent' ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>Absent</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => handleUpdateStatus(session.key, session.status === 'cancelled' ? 'pending' : 'cancelled')}
          className={`px-3 py-1.5 flex-row items-center ${session.status === 'cancelled' ? 'bg-slate-500' : ''}`}
        >
          <Ionicons name="remove-circle-outline" size={14} color={session.status === 'cancelled' ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b')} />
          <Text className={`ml-1 text-xs font-semibold ${session.status === 'cancelled' ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>No Class</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView className="flex-1" contentContainerClassName="p-4">
      

      {/* Stats Dashboard */}
      <View className="mb-6">
        <View className="flex-row items-center mb-4">
          <Ionicons name="trending-up" size={20} color="#0a84ff" />
          <Text className={`text-lg font-bold ml-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Attendance Statistics</Text>
        </View>
        
        {stats.past7Total !== undefined && stats.past7Total > 0 && (
          <View className={`p-4 rounded-xl mb-4 border ${stats.past7Attended / stats.past7Total >= 0.8 ? (isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200') : (stats.past7Attended / stats.past7Total >= 0.5 ? (isDark ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-50 border-orange-200') : (isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'))}`}>
            <View className="flex-row items-start">
              <Ionicons name="information-circle" size={20} color={stats.past7Attended / stats.past7Total >= 0.8 ? (isDark ? '#4ade80' : '#22c55e') : (stats.past7Attended / stats.past7Total >= 0.5 ? (isDark ? '#fb923c' : '#f97316') : (isDark ? '#60a5fa' : '#0a84ff'))} />
              <Text className={`ml-2 flex-1 font-medium ${stats.past7Attended / stats.past7Total >= 0.8 ? (isDark ? 'text-green-400' : 'text-green-700') : (stats.past7Attended / stats.past7Total >= 0.5 ? (isDark ? 'text-orange-400' : 'text-orange-700') : (isDark ? 'text-blue-400' : 'text-blue-700'))}`}>{getFinMessage()}</Text>
            </View>
          </View>
        )}

        <View className="flex-row flex-wrap -mx-1">
          {renderStatBox("Past 7 Days", stats.past7Attended || 0, stats.past7Total || 0)}
          {renderStatBox("Past 30 Days", stats.past30Attended || 0, stats.past30Total || 0)}
        </View>
        <View className="flex-row mt-2 -mx-1">
          {renderStatBox("Overall Semester", stats.overallAttended || 0, stats.overallTotal || 0)}
        </View>
      </View>

      {/* Checklist */}
      <View>
        <View className="flex-row items-center mb-4">
          <Ionicons name="calendar-outline" size={20} color="#0a84ff" />
          <Text className={`text-lg font-bold ml-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Class Checklist</Text>
        </View>

        {Object.keys(groupedWeeks).length === 0 ? (
          <View className={`p-8 rounded-xl items-center border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <Text className={`text-center font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No classes found for the selected dates. Make sure you have classes added!</Text>
          </View>
        ) : (
          <View className="mb-10">
            {sortedWeeksArray.activeGroup.map(week => {
              const weekTotal = week.sessions.length;
              const weekPresent = week.sessions.filter((s: any) => s.status === 'present').length;
              const weekAbsent = week.sessions.filter((s: any) => s.status === 'absent').length;
              const weekPending = week.sessions.filter((s: any) => s.isPast && s.status === 'pending').length;

              return (
                <TouchableOpacity
                  key={week.weekNum}
                  activeOpacity={0.7}
                  onPress={() => { setExpandedWeek(week.weekNum.toString()); setSelectedDayDateStr(null); setEditingTakeaway(null); }}
                  className={`p-5 rounded-xl border mb-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                >
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Week {week.weekNum}</Text>
                    <View className={`px-3 py-1 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                      <Text className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{weekTotal} sessions</Text>
                    </View>
                  </View>
                  <Text className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {week.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {week.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                  
                  <View className="flex-row">
                    <View className="flex-row items-center mr-4">
                      <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                      <Text className="ml-1 text-sm font-medium text-green-500">{weekPresent} Present</Text>
                    </View>
                    <View className="flex-row items-center mr-4">
                      <Ionicons name="close-circle" size={16} color="#ef4444" />
                      <Text className="ml-1 text-sm font-medium text-red-500">{weekAbsent} Absent</Text>
                    </View>
                    {weekPending > 0 && (
                      <View className="flex-row items-center">
                        <Ionicons name="alert-circle" size={16} color="#f59e0b" />
                        <Text className="ml-1 text-sm font-medium text-amber-500">{weekPending} Unlogged</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            {sortedWeeksArray.completedGroup.length > 0 && (
              <View className="mt-4 mb-4 pt-6 border-t border-slate-200 dark:border-slate-800">
                <Text className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>Completed Weeks</Text>
                <Text className={`text-xs mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>All past classes in these weeks have been logged.</Text>
                
                {sortedWeeksArray.completedGroup.map(week => {
                  const weekTotal = week.sessions.length;
                  const weekPresent = week.sessions.filter((s: any) => s.status === 'present').length;
                  const weekAbsent = week.sessions.filter((s: any) => s.status === 'absent').length;

                  return (
                    <TouchableOpacity
                      key={week.weekNum}
                      activeOpacity={0.7}
                      onPress={() => { setExpandedWeek(week.weekNum.toString()); setSelectedDayDateStr(null); setEditingTakeaway(null); }}
                      className={`p-5 rounded-xl border mb-4 opacity-60 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                    >
                      <View className="flex-row justify-between items-center mb-3">
                        <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Week {week.weekNum}</Text>
                        <View className={`px-3 py-1 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                          <Text className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{weekTotal} sessions</Text>
                        </View>
                      </View>
                      <Text className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {week.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {week.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                      
                      <View className="flex-row">
                        <View className="flex-row items-center mr-4">
                          <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                          <Text className="ml-1 text-sm font-medium text-green-500">{weekPresent} Present</Text>
                        </View>
                        <View className="flex-row items-center">
                          <Ionicons name="close-circle" size={16} color="#ef4444" />
                          <Text className="ml-1 text-sm font-medium text-red-500">{weekAbsent} Absent</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Week Details Modal */}
      {!!expandedWeek && (
        <Modal 
          visible={true} 
          animationType="slide" 
          transparent={true}
          onRequestClose={() => { setExpandedWeek(null); setSelectedDayDateStr(null); setEditingTakeaway(null); }}
        >
          <View className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
            {groupedWeeks[expandedWeek] && (() => {
            const week = groupedWeeks[expandedWeek];
            return (
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                {/* Header */}
                <View className={`px-4 py-5 flex-row justify-between items-center border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <View>
                    <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Week {week.weekNum}</Text>
                    <Text className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {week.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {week.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => { setExpandedWeek(null); setSelectedDayDateStr(null); setEditingTakeaway(null); }} className={`p-2 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                    <Ionicons name="close" size={24} color={isDark ? '#fff' : '#000'} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView className="flex-1" contentContainerClassName="p-4">
                  <Text className={`text-base font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>Select a Day</Text>
                  
                  {/* Days Horizontal Scroll */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6 h-32" contentContainerClassName="gap-3 pr-4">
                    {Array.from({ length: 7 }).map((_, i) => {
                      const d = new Date(week.startDate);
                      d.setDate(d.getDate() + i);
                      const dateStr = d.toISOString().split('T')[0];
                      const daySessions = week.sessions.filter((s: any) => s.dateStr === dateStr);
                      const isToday = dateStr === currentDate.toISOString().split('T')[0];
                      const isSelected = selectedDayDateStr === dateStr;
                      const hasPendingLogs = daySessions.some((s: any) => s.isPast && s.status === 'pending');
                      const isDayCompleted = daySessions.length > 0 && daySessions.every((s: any) => s.status !== 'pending');

                      return (
                        <TouchableOpacity
                          key={dateStr}
                          activeOpacity={daySessions.length > 0 ? 0.7 : 1}
                          onPress={() => { if (daySessions.length > 0) { setSelectedDayDateStr(dateStr); setEditingTakeaway(null); } }}
                          className={`w-24 p-3 rounded-xl border justify-between ${
                            isSelected ? 'bg-blue-500 border-blue-500' : 
                            (isToday ? (isDark ? 'bg-blue-900 border-blue-500' : 'bg-blue-50 border-blue-200') : 
                            (hasPendingLogs ? (isDark ? 'bg-red-900/20 border-red-500' : 'bg-red-50 border-red-500') : 
                            (isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')))
                          } ${daySessions.length === 0 ? 'opacity-40' : (isDayCompleted && !isSelected ? 'opacity-60' : '')}`}
                        >
                          <View>
                            <Text className={`text-xs font-bold uppercase mb-1 ${isSelected ? 'text-white' : (isToday ? 'text-blue-500' : (hasPendingLogs && !isSelected ? 'text-red-500' : (isDark ? 'text-slate-400' : 'text-slate-500')))}`}>
                              {d.toLocaleDateString('en-US', { weekday: 'short' })}
                            </Text>
                            <Text className={`text-2xl font-bold ${isSelected ? 'text-white' : (isToday ? 'text-blue-500' : (hasPendingLogs && !isSelected ? 'text-red-500' : (isDark ? 'text-white' : 'text-slate-800')))}`}>
                              {d.getDate()}
                            </Text>
                          </View>

                          {hasPendingLogs && !isSelected && (
                            <View className="mt-1 mb-1 px-1 py-0.5 rounded border border-red-500 items-center bg-red-500/10">
                                <Text className="text-[8px] font-bold text-red-500 uppercase">Unlogged</Text>
                            </View>
                          )}

                          {daySessions.length > 0 ? (
                            <View className="flex-row gap-1 mt-1 flex-wrap">
                              {daySessions.map((s: any) => {
                                const col = COLORS[(s.classObj.colorIdx || 0) % COLORS.length] || COLORS[0];
                                return (
                                  <View key={s.key} className={`w-2 h-2 rounded-full ${s.status === 'present' ? 'bg-green-500' : (s.status === 'absent' ? 'bg-red-500' : (s.status === 'cancelled' ? 'bg-slate-400' : 'bg-blue-500'))}`} style={s.status === 'pending' ? { backgroundColor: col.hex } : {}} />
                                );
                              })}
                            </View>
                          ) : (
                            <Text className={`text-xs mt-2 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>-</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Selected Day Details */}
                  {selectedDayDateStr && (
                    <View className="pb-8">
                      <View className="flex-row items-center mb-4">
                        <Ionicons name="calendar" size={20} color="#0a84ff" />
                        <Text className={`text-lg font-bold ml-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                          {new Date(selectedDayDateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </Text>
                      </View>

                      {week.sessions.filter((s: any) => s.dateStr === selectedDayDateStr).map((s: any) => {
                        const col = COLORS[(s.classObj.colorIdx || 0) % COLORS.length] || COLORS[0];
                        const isEditing = editingTakeaway === s.key;

                        return (
                          <View key={s.key} className={`p-4 rounded-xl border mb-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                            <View className="flex-row justify-between items-start mb-4">
                              <View className="flex-1 mr-4">
                                <View className={`self-start px-2 py-1 rounded border mb-2 ${col.bg} ${col.border}`}>
                                  <Text className={`text-xs font-bold text-white`}>{s.classObj.name}</Text>
                                </View>
                                <Text className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                  {formatTimeStr(s.classObj.startHour)} - {formatTimeStr(s.classObj.startHour + s.classObj.duration)}
                                  {s.classObj.room ? ` • ${s.classObj.room}` : ''}
                                </Text>
                              </View>
                            </View>
                            
                            <View className="mb-4">
                              {renderStatusButton(s)}
                            </View>

                            <View className={`pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                              {isEditing ? (
                                <View className="flex-row items-start">
                                  <TextInput
                                    autoFocus
                                    multiline
                                    placeholder="Add notes or takeaways..."
                                    placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                                    value={takeawayInputs[s.key] ?? s.takeaway}
                                    onChangeText={t => setTakeawayInputs(prev => ({ ...prev, [s.key]: t }))}
                                    className={`flex-1 min-h-[80px] p-3 rounded-lg border text-sm mr-2 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                                    textAlignVertical="top"
                                  />
                                  <View className="gap-2">
                                    <TouchableOpacity 
                                      onPress={() => handleUpdateTakeaway(s.key, takeawayInputs[s.key] ?? s.takeaway)}
                                      className="w-10 h-10 rounded-full bg-blue-500 items-center justify-center"
                                    >
                                      <Ionicons name="checkmark" size={20} color="#fff" />
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                      onPress={() => setEditingTakeaway(null)}
                                      className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}
                                    >
                                      <Ionicons name="close" size={20} color={isDark ? '#fff' : '#000'} />
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              ) : (
                                <TouchableOpacity 
                                  activeOpacity={0.7}
                                  onPress={() => { setTakeawayInputs(prev => ({ ...prev, [s.key]: s.takeaway })); setEditingTakeaway(s.key); }}
                                  className={`flex-row items-center p-3 rounded-lg ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}
                                >
                                  <Ionicons name="chatbubble-outline" size={16} color={s.takeaway ? '#0a84ff' : (isDark ? '#475569' : '#94a3b8')} />
                                  <Text className={`flex-1 ml-2 text-sm font-medium ${s.takeaway ? (isDark ? 'text-white' : 'text-slate-800') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>
                                    {s.takeaway ? s.takeaway : "Add optional takeaway..."}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </ScrollView>
              </KeyboardAvoidingView>
            );
          })()}
        </View>
      </Modal>
      )}
    </ScrollView>
  );
}

