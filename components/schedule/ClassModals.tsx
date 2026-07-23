import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

const COLORS = [
  { bg: '#2997ff', name: 'Blue' },
  { bg: '#30d158', name: 'Green' },
  { bg: '#bf5af2', name: 'Purple' },
  { bg: '#ff9f0a', name: 'Orange' },
  { bg: '#ff453a', name: 'Red' },
  { bg: '#64d2ff', name: 'Cyan' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const formatTime = (h: number) => {
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    const ampm = hours >= 12 && hours < 24 ? 'PM' : 'AM';
    const displayH = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return `${displayH}:${mins.toString().padStart(2, '0')} ${ampm}`;
};

export function ClassDetailsModal({ visible, cls, isDark, onClose, onEdit, onDelete }: any) {
    if (!cls) return null;
    
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View className="flex-1 justify-center items-center bg-black/60 px-6">
                <View className={`w-full rounded-3xl p-6 shadow-xl ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center">
                            <View className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: COLORS[cls.colorIdx % COLORS.length]?.bg || COLORS[0].bg }} />
                            <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{cls.name}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className={`p-2 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                            <Ionicons name="close" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                        </TouchableOpacity>
                    </View>

                    <View className="mb-6 space-y-4">
                        <View className="flex-row justify-between">
                            <Text className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Day</Text>
                            <Text className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{DAYS[cls.day]}</Text>
                        </View>
                        <View className="flex-row justify-between mt-3">
                            <Text className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Time</Text>
                            <Text className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{formatTime(cls.startHour)} - {formatTime(cls.startHour + cls.duration)}</Text>
                        </View>
                        <View className="flex-row justify-between mt-3">
                            <Text className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Room</Text>
                            <Text className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{cls.room || 'TBA'}</Text>
                        </View>
                        {cls.instructor && (
                            <View className="flex-row justify-between mt-3">
                                <Text className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Instructor</Text>
                                <Text className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{cls.instructor}</Text>
                            </View>
                        )}
                    </View>

                    <View className="flex-row gap-3">
                        <TouchableOpacity onPress={onDelete} className={`flex-1 py-3 rounded-xl border items-center justify-center ${isDark ? 'bg-red-500 border-red-500' : 'bg-red-50 border-red-200'}`}>
                            <Text className={`${isDark ? 'text-white' : 'text-red-500'} font-bold`}>Remove</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onEdit} className="flex-1 py-3 rounded-xl bg-blue-500 items-center justify-center">
                            <Text className="text-white font-bold">Edit</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const parseTimeInput = (t: string, currentVal: number) => {
    if (!t || t.trim() === '') return currentVal;
    if (!isNaN(Number(t))) {
        let v = Number(t);
        if (v >= 0 && v <= 24) return v;
    }
    const match = t.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!match) return currentVal;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2] || '0', 10);
    const ampm = match[3]?.toLowerCase();
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    if (h >= 0 && h <= 24 && m >= 0 && m < 60) return h + (m / 60);
    return currentVal;
};

export const ClassEditModal = ({ visible, initialCls, isDark, onClose, onSave }: any) => {
    const [cls, setCls] = useState<any>(null);
    const [dayPickerIdx, setDayPickerIdx] = useState<number | null>(null);
    const [showTimePickerFor, setShowTimePickerFor] = useState<number | null>(null);

    useEffect(() => {
        if (visible && initialCls) {
            setCls(JSON.parse(JSON.stringify(initialCls))); // Deep copy
        } else if (visible && !initialCls) {
            setCls({ 
                name: '', 
                instructor: '', 
                colorIdx: 0, 
                schedules: [{ id: Math.random().toString(), room: '', day: 0, startHour: 8, duration: 1.5 }] 
            });
        }
    }, [visible, initialCls]);

    if (!visible || !cls) return null;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View className="flex-1 justify-end bg-black/60">
                <View className={`w-full h-[85%] rounded-t-3xl p-6 shadow-xl ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center">
                            <View className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: COLORS[cls.colorIdx % COLORS.length]?.bg || COLORS[0].bg }} />
                            <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{initialCls ? 'Edit Class' : 'New Class'}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className={`p-2 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                            <Ionicons name="close" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                        <View className={`mb-4 rounded-xl border px-4 py-1 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <TextInput
                                value={cls.name}
                                onChangeText={(t) => setCls({...cls, name: t})}
                                placeholder="Class Name (e.g. CSIT221)"
                                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                                className={`h-12 font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}
                            />
                        </View>

                        <View className={`mb-4 rounded-xl border px-4 py-1 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <TextInput
                                value={cls.instructor}
                                onChangeText={(t) => setCls({...cls, instructor: t})}
                                placeholder="Instructor Name"
                                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                                className={`h-12 font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}
                            />
                        </View>

                        <View className="flex-row items-center justify-between mb-6">
                            <Text className={`font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Color</Text>
                            <View className="flex-row space-x-2">
                                {COLORS.map((c, i) => (
                                    <TouchableOpacity 
                                        key={i} 
                                        onPress={() => setCls({...cls, colorIdx: i})}
                                        style={{ backgroundColor: c.bg, borderWidth: cls.colorIdx === i ? 2 : 0, borderColor: isDark ? 'white' : 'black' }}
                                        className="w-8 h-8 rounded-full ml-2 items-center justify-center"
                                    />
                                ))}
                            </View>
                        </View>

                        <Text className={`font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>Time Blocks</Text>

                        {cls.schedules?.map((sched: any, index: number) => (
                            <View key={sched.id} className={`p-4 rounded-2xl border mb-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                <View className="flex-row justify-between items-center mb-4">
                                    <View className={`flex-1 rounded-xl border px-3 py-1 mr-2 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                        <TextInput
                                            value={sched.room}
                                            onChangeText={(t) => {
                                                const ns = [...cls.schedules];
                                                ns[index].room = t;
                                                setCls({...cls, schedules: ns});
                                            }}
                                            placeholder="Room (e.g. NGE103)"
                                            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                                            className={`h-10 font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}
                                        />
                                    </View>
                                    <TouchableOpacity 
                                        onPress={() => {
                                            const ns = cls.schedules.filter((s: any) => s.id !== sched.id);
                                            setCls({...cls, schedules: ns});
                                        }}
                                        className={`p-2 rounded-full ${isDark ? 'bg-red-500' : 'bg-red-50'}`}
                                    >
                                        <Ionicons name="trash" size={18} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>

                                <View className="flex-row justify-between items-center mb-4">
                                    <Text className={`text-xs font-bold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Day</Text>
                                    <View className="flex-row items-center relative">
                                        <TouchableOpacity 
                                            onPress={() => setDayPickerIdx(index)}
                                            className={`flex-row items-center justify-between px-3 h-9 rounded-lg border min-w-[120px] ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                                        >
                                            <Text className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{DAYS[sched.day]}</Text>
                                            <Ionicons name="chevron-down" size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View className="flex-row justify-between items-center mb-4">
                                    <Text className={`text-xs font-bold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Start Time</Text>
                                    <View className="flex-row items-center gap-2">
                                        <TouchableOpacity 
                                            onPress={() => setShowTimePickerFor(index)}
                                            className={`flex-row items-center justify-between px-3 h-9 rounded-lg border min-w-[100px] ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                                        >
                                            <Text className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                                {(() => {
                                                    let h = Math.floor(sched.startHour) % 12 || 12;
                                                    let m = Math.round((sched.startHour % 1) * 60).toString().padStart(2, '0');
                                                    let ampm = Math.floor(sched.startHour) >= 12 ? 'PM' : 'AM';
                                                    return `${h}:${m} ${ampm}`;
                                                })()}
                                            </Text>
                                            <Ionicons name="time-outline" size={16} color={isDark ? "#94a3b8" : "#64748b"} style={{ marginLeft: 8 }} />
                                        </TouchableOpacity>
                                        {showTimePickerFor === index && (
                                            <DateTimePicker
                                                value={(() => {
                                                    const d = new Date();
                                                    d.setHours(Math.floor(sched.startHour));
                                                    d.setMinutes(Math.round((sched.startHour % 1) * 60));
                                                    return d;
                                                })()}
                                                mode="time"
                                                is24Hour={false}
                                                display="default"
                                                onChange={(event, selectedDate) => {
                                                    setShowTimePickerFor(null);
                                                    if (event.type === 'set' && selectedDate) {
                                                        const ns = [...cls.schedules];
                                                        ns[index].startHour = selectedDate.getHours() + (selectedDate.getMinutes() / 60);
                                                        setCls({...cls, schedules: ns});
                                                    }
                                                }}
                                            />
                                        )}
                                    </View>
                                </View>

                                <View className="flex-row justify-between items-center">
                                    <Text className={`text-xs font-bold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Duration</Text>
                                    <View className="flex-row items-center gap-2">
                                        <View className={`flex-row items-center rounded-lg border h-9 px-3 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                            <TextInput
                                                value={sched.durHInput !== undefined ? sched.durHInput : Math.floor(sched.duration).toString()}
                                                onChangeText={(t) => {
                                                    const ns = [...cls.schedules];
                                                    ns[index].durHInput = t;
                                                    setCls({...cls, schedules: ns});
                                                }}
                                                onBlur={() => {
                                                    const ns = [...cls.schedules];
                                                    if (ns[index].durHInput !== undefined) {
                                                        let newH = parseInt(ns[index].durHInput);
                                                        if (!isNaN(newH) && newH >= 0) {
                                                            const m = ns[index].duration % 1;
                                                            ns[index].duration = newH + m;
                                                        }
                                                        ns[index].durHInput = undefined;
                                                        setCls({...cls, schedules: ns});
                                                    }
                                                }}
                                                keyboardType="numeric"
                                                maxLength={2}
                                                className={`font-bold text-center ${isDark ? 'text-white' : 'text-slate-800'}`}
                                                style={{width: 24, padding: 0}}
                                            />
                                            <Text className={`ml-2 text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>h</Text>
                                        </View>
                                        
                                        <View className={`flex-row items-center rounded-lg border h-9 px-3 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                            <TextInput
                                                value={sched.durMInput !== undefined ? sched.durMInput : Math.round((sched.duration % 1) * 60).toString()}
                                                onChangeText={(t) => {
                                                    const ns = [...cls.schedules];
                                                    ns[index].durMInput = t;
                                                    setCls({...cls, schedules: ns});
                                                }}
                                                onBlur={() => {
                                                    const ns = [...cls.schedules];
                                                    if (ns[index].durMInput !== undefined) {
                                                        let newM = parseInt(ns[index].durMInput);
                                                        if (!isNaN(newM) && newM >= 0 && newM <= 59) {
                                                            const h = Math.floor(ns[index].duration);
                                                            ns[index].duration = h + (newM / 60);
                                                        }
                                                        ns[index].durMInput = undefined;
                                                        setCls({...cls, schedules: ns});
                                                    }
                                                }}
                                                keyboardType="numeric"
                                                maxLength={2}
                                                className={`font-bold text-center ${isDark ? 'text-white' : 'text-slate-800'}`}
                                                style={{width: 24, padding: 0}}
                                            />
                                            <Text className={`ml-2 text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>min</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        ))}

                        <TouchableOpacity 
                            onPress={() => {
                                setCls({
                                    ...cls, 
                                    schedules: [...cls.schedules, { id: Math.random().toString(), room: '', day: 0, startHour: 8, duration: 1.5 }]
                                });
                            }}
                            className={`w-full py-3 rounded-xl border border-dashed flex-row items-center justify-center mb-6 ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-300'}`}
                        >
                            <Ionicons name="add" size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                            <Text className={`ml-2 font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Add Another Schedule</Text>
                        </TouchableOpacity>
                    </ScrollView>

                        <TouchableOpacity 
                            onPress={() => {
                                const flushedCls = { ...cls, schedules: cls.schedules.map((s: any) => ({ ...s })) };
                                flushedCls.schedules.forEach((sched: any) => {
                                    if (sched.startHInput !== undefined) {
                                        let newH = parseInt(sched.startHInput);
                                        if (!isNaN(newH) && newH >= 1 && newH <= 12) {
                                            let isPM = Math.floor(sched.startHour) >= 12;
                                            let h24 = newH === 12 ? (isPM ? 12 : 0) : newH + (isPM ? 12 : 0);
                                            sched.startHour = h24 + (sched.startHour % 1);
                                        }
                                        sched.startHInput = undefined;
                                    }
                                    if (sched.startMInput !== undefined) {
                                        let newM = parseInt(sched.startMInput);
                                        if (!isNaN(newM) && newM >= 0 && newM <= 59) {
                                            sched.startHour = Math.floor(sched.startHour) + (newM / 60);
                                        }
                                        sched.startMInput = undefined;
                                    }
                                    if (sched.durHInput !== undefined) {
                                        let newH = parseInt(sched.durHInput);
                                        if (!isNaN(newH) && newH >= 0) {
                                            sched.duration = newH + (sched.duration % 1);
                                        }
                                        sched.durHInput = undefined;
                                    }
                                    if (sched.durMInput !== undefined) {
                                        let newM = parseInt(sched.durMInput);
                                        if (!isNaN(newM) && newM >= 0 && newM <= 59) {
                                            sched.duration = Math.floor(sched.duration) + (newM / 60);
                                        }
                                        sched.durMInput = undefined;
                                    }
                                });
                                setCls(flushedCls);
                                onSave(flushedCls);
                            }} 
                            className="p-4 rounded-xl w-full items-center bg-blue-500 mt-4"
                        >
                            <Text className="text-white font-bold text-lg">Save Changes</Text>
                        </TouchableOpacity>
                </View>
            </View>

            {/* Day Picker Modal */}
            <Modal visible={dayPickerIdx !== null} transparent animationType="fade">
                <TouchableOpacity 
                    activeOpacity={1} 
                    onPress={() => setDayPickerIdx(null)} 
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                >
                    <View className={`w-[80%] rounded-2xl overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                        <View className={`px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                            <Text className={`text-center font-bold text-lg ${isDark ? 'text-white' : 'text-slate-800'}`}>Select Day</Text>
                        </View>
                        <ScrollView style={{ maxHeight: 350 }}>
                            {[6, 0, 1, 2, 3, 4, 5].map((dIdx) => (
                                <TouchableOpacity 
                                    key={dIdx}
                                    onPress={() => {
                                        if (dayPickerIdx !== null && cls) {
                                            const ns = [...cls.schedules];
                                            ns[dayPickerIdx].day = dIdx;
                                            setCls({...cls, schedules: ns});
                                        }
                                        setDayPickerIdx(null);
                                    }}
                                    className={`px-6 py-4 border-b flex-row justify-between items-center ${isDark ? 'border-slate-700' : 'border-slate-100'}`}
                                >
                                    <Text className={`font-medium text-base ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{DAYS[dIdx]}</Text>
                                    {cls?.schedules[dayPickerIdx!]?.day === dIdx && (
                                        <Ionicons name="checkmark" size={20} color="#3b82f6" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </Modal>
    );
}

