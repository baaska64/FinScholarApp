import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';

const MILESTONE_TYPES = {
    enrollment: { label: 'Enrollment', color: '#06b6d4', bg: '#cffafe' }, // Bright Cyan
    drop_deadline: { label: 'Drop Deadline', color: '#f43f5e', bg: '#ffe4e6' }, // Bright Rose
    finals: { label: 'Finals', color: '#eab308', bg: '#fef08a' }, // Bright Yellow
    holiday: { label: 'Holiday', color: '#10b981', bg: '#d1fae5' }, // Bright Emerald
    org_event: { label: 'Org Event', color: '#a855f7', bg: '#f3e8ff' }, // Bright Purple
    custom: { label: 'Custom', color: '#3b82f6', bg: '#dbeafe' } // Bright Blue
};

const MILESTONE_TYPES_DARK = {
    enrollment: { label: 'Enrollment', color: '#22d3ee', bg: '#083344' }, // Neon Cyan
    drop_deadline: { label: 'Drop Deadline', color: '#fb7185', bg: '#4c0519' }, // Neon Rose
    finals: { label: 'Finals', color: '#fde047', bg: '#422006' }, // Neon Yellow
    holiday: { label: 'Holiday', color: '#34d399', bg: '#022c22' }, // Neon Emerald
    org_event: { label: 'Org Event', color: '#c084fc', bg: '#3b0764' }, // Neon Purple
    custom: { label: 'Custom', color: '#60a5fa', bg: '#172554' } // Neon Blue
};

interface VisualCalendarProps {
    events: any[];
    onDateClick?: (dateStr: string) => void;
}

export const VisualCalendar: React.FC<VisualCalendarProps> = ({ events, onDateClick }) => {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const activeTypes = isDark ? MILESTONE_TYPES_DARK : MILESTONE_TYPES;

    const [currentDate, setCurrentDate] = useState(new Date());

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const today = new Date();

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const getEventsForDay = (day: number) => {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const targetDateString = `${year}-${month}-${dayStr}`;
        
        return events.filter(e => {
            if (!e.date) return false;
            const eventDateStr = typeof e.date === 'string' ? e.date.slice(0, 10) : new Date(e.date).toISOString().slice(0, 10);
            return eventDateStr === targetDateString;
        });
    };

    const isToday = (day: number) => {
        return today.getDate() === day && 
               today.getMonth() === currentDate.getMonth() && 
               today.getFullYear() === currentDate.getFullYear();
    };

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const screenWidth = Dimensions.get('window').width;
    const padding = 48 + 40 + 4;
    const gap = 8;
    const cellWidth = (screenWidth - padding - (gap * 6)) / 7;

    return (
        <View className={`rounded-[32px] p-5 mb-6 shadow-md border-2 ${isDark ? 'bg-slate-900 border-indigo-500/10 shadow-slate-950' : 'bg-white border-indigo-100/70 shadow-indigo-100/30'}`}>
            {/* Header */}
            <View className="flex-row justify-between items-center mb-4 px-2">
                <Text className={`font-nunito-bold text-lg ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </Text>
                <View className="flex-row space-x-2">
                    <TouchableOpacity 
                        onPress={prevMonth}
                        className={`w-8 h-8 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                    >
                        <Ionicons name="chevron-back" size={16} color={isDark ? '#cbd5e1' : '#475569'} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={nextMonth}
                        className={`w-8 h-8 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                    >
                        <Ionicons name="chevron-forward" size={16} color={isDark ? '#cbd5e1' : '#475569'} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Days of Week Header */}
            <View className="flex-row justify-between mb-2">
                {daysOfWeek.map((day, idx) => (
                    <Text key={idx} style={{ width: cellWidth }} className={`text-center font-nunito-bold text-[10px] uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {day}
                    </Text>
                ))}
            </View>

            {/* Calendar Grid */}
            <View className="flex-row flex-wrap" style={{ gap: gap }}>
                {/* Empty Cells */}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                    <View key={`empty-${i}`} style={{ width: cellWidth, height: cellWidth * 1.2 }} className={`rounded-[16px] opacity-30 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`} />
                ))}

                {/* Day Cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dayEvents = getEventsForDay(day);
                    const todayFlag = isToday(day);

                    return (
                        <TouchableOpacity 
                            key={day}
                            onPress={() => {
                                const year = currentDate.getFullYear();
                                const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                                const dayStr = String(day).padStart(2, '0');
                                const dateStr = `${year}-${month}-${dayStr}`;
                                if (onDateClick) onDateClick(dateStr);
                            }}
                            style={{ 
                                width: cellWidth, 
                                height: cellWidth * 1.2,
                            }}
                            className={`rounded-[16px] p-1 justify-center items-center border ${
                                todayFlag 
                                ? (isDark ? 'border-teal-500 bg-teal-950/30' : 'border-teal-500 bg-teal-50')
                                : (isDark ? 'border-transparent bg-slate-800' : 'border-transparent bg-slate-50')
                            }`}
                        >
                            <Text className={`font-nunito-bold text-xs ${dayEvents.length > 0 ? 'mb-1' : ''} ${
                                todayFlag 
                                ? (isDark ? 'text-teal-400' : 'text-teal-600') 
                                : (isDark ? 'text-slate-300' : 'text-slate-600')
                            }`}>
                                {day}
                            </Text>

                            {dayEvents.length > 0 && (
                                <View className="flex-row flex-wrap justify-center items-center" style={{ gap: 3 }}>
                                    {dayEvents.slice(0, 3).map((event, idx) => {
                                        const typeConfig = activeTypes[event.type as keyof typeof activeTypes] || activeTypes.custom;
                                        return (
                                            <View 
                                                key={idx}
                                                style={{ backgroundColor: typeConfig.color }}
                                                className="w-2 h-2 rounded-full"
                                            />
                                        );
                                    })}
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};
