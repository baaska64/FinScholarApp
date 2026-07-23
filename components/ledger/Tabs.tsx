import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { useSemesterContext } from '@/components/SemesterContext';

interface TabsProps {
    years: any[];
    activeYearId: string | null;
    activeSemId: string | null;
    onSelectYear: (id: string) => void;
    onSelectSem: (id: string) => void;
}

export default function Tabs({ 
    years, activeYearId, activeSemId, 
    onSelectYear, onSelectSem
}: TabsProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const [modalVisible, setModalVisible] = useState(false);
    const { setYearAndSemester } = useSemesterContext();

    const currentYear = years.find(y => y.id === activeYearId);
    const currentSem = currentYear?.semesters.find((s: any) => s.id === activeSemId);

    const buttonLabel = currentYear && currentSem 
        ? `${currentYear.name} • ${currentSem.name}`
        : currentYear 
            ? currentYear.name 
            : 'Select Term';

    return (
        <View className="mb-4 mt-2 z-50">
            <TouchableOpacity 
                onPress={() => setModalVisible(true)}
                activeOpacity={0.8}
                className={`flex-row items-center justify-between px-5 py-3.5 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-sm shadow-slate-200'}`}
            >
                <View className="flex-row items-center">
                    <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${isDark ? 'bg-blue-900/40' : 'bg-blue-100'}`}>
                        <Ionicons name="calendar" size={16} color={isDark ? '#60a5fa' : '#3b82f6'} />
                    </View>
                    <Text className={`font-nunito-bold text-base ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                        {buttonLabel}
                    </Text>
                </View>
                <Ionicons name="chevron-down" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>

            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <Pressable className="flex-1" onPress={() => setModalVisible(false)} />
                    
                    <View className={`rounded-t-[32px] pt-4 pb-10 px-6 max-h-[80%] ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                        <View className="items-center mb-6">
                            <View className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
                        </View>
                        
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className={`font-nunito-black text-2xl ${isDark ? 'text-white' : 'text-slate-800'}`}>Select Term</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} className={`w-8 h-8 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <Ionicons name="close" size={20} color={isDark ? '#cbd5e1' : '#475569'} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {years.length === 0 && (
                                <Text className={`font-nunito text-center mt-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No years added yet.</Text>
                            )}
                            
                            {years.map(year => (
                                <View key={year.id} className="mb-6">
                                    <View className="flex-row items-center mb-3 px-2">
                                        <Ionicons name="school" size={18} color={isDark ? '#94a3b8' : '#64748b'} />
                                        <Text className={`font-nunito-bold text-base ml-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                            {year.name}
                                        </Text>
                                    </View>
                                    
                                    <View className={`rounded-3xl overflow-hidden border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                        {year.semesters.length === 0 && (
                                            <View className="p-4">
                                                <Text className={`font-nunito text-sm italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No semesters added.</Text>
                                            </View>
                                        )}
                                        {year.semesters.map((sem: any, index: number) => {
                                            const isSelected = year.id === activeYearId && sem.id === activeSemId;
                                            return (
                                                <TouchableOpacity
                                                    key={sem.id}
                                                    onPress={() => {
                                                        // Bypass the buggy sequential updates in parent components
                                                        setYearAndSemester(year.id, sem.id);
                                                        setModalVisible(false);
                                                    }}
                                                    className={`flex-row items-center justify-between p-4 ${index !== year.semesters.length - 1 ? (isDark ? 'border-b border-slate-700' : 'border-b border-slate-200') : ''} ${isSelected ? (isDark ? 'bg-blue-900/30' : 'bg-blue-50') : ''}`}
                                                >
                                                    <Text className={`font-nunito-bold text-lg ${isSelected ? (isDark ? 'text-blue-400' : 'text-blue-600') : (isDark ? 'text-slate-200' : 'text-slate-700')}`}>
                                                        {sem.name}
                                                    </Text>
                                                    {isSelected && (
                                                        <Ionicons name="checkmark-circle" size={24} color={isDark ? '#60a5fa' : '#3b82f6'} />
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
