import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { useRouter } from 'expo-router';
import { useSemesterContext } from '@/components/SemesterContext';
import { getTheme, Radius, Shadows } from '@/constants/Theme';
import SpotlightTarget from '@/components/spotlight/SpotlightTarget';

export interface TabsProps {
    years?: any[];
    activeYearId?: string | null;
    activeSemId?: string | null;
    onSelectYear?: (id: string) => void;
    onSelectSem?: (id: string) => void;
    activeTab?: 'all' | 'tracked';
    setActiveTab?: (tab: 'all' | 'tracked') => void;
    /**
     * When set, the term selector registers itself as a guided-tour target.
     * Only one screen should pass this so the tour never highlights a copy
     * of the selector sitting on an unfocused tab.
     */
    spotlightId?: string;
    /**
     * Renders the trigger as a small inline chip instead of a full-width row.
     * Used by screens that put the term switcher inside their app bar so the
     * content underneath starts as high up the screen as possible.
     */
    compact?: boolean;
    /**
     * Lets a screen supply its own trigger while still using this component's
     * term list and selection wiring. The callback receives an opener and the
     * current term label; the spotlight wrapper is applied around whatever it
     * returns.
     */
    renderTrigger?: (open: () => void, label: string) => React.ReactNode;
}

export default function Tabs({ 
    years = [], 
    activeYearId = null, 
    activeSemId = null, 
    onSelectYear, 
    onSelectSem,
    activeTab,
    setActiveTab,
    spotlightId,
    compact = false,
    renderTrigger,
}: TabsProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const [modalVisible, setModalVisible] = useState(false);
    const { setYearAndSemester } = useSemesterContext();
    const router = useRouter();

    const currentYear = years.find((y: any) => y.id === activeYearId);
    const currentSem = currentYear?.semesters?.find((s: any) => s.id === activeSemId);

    const buttonLabel = currentYear && currentSem 
        ? `${currentYear.name} • ${currentSem.name}`
        : currentYear 
            ? currentYear.name 
            : 'Select Term';

    const termModal = (
        <Modal
            visible={modalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setModalVisible(false)}
        >
            <TermSwitcherSheet
                years={years}
                activeYearId={activeYearId}
                activeSemId={activeSemId}
                isDark={isDark}
                onSelectYear={onSelectYear}
                onSelectSem={onSelectSem}
                setYearAndSemester={setYearAndSemester}
                close={() => setModalVisible(false)}
                router={router}
            />
        </Modal>
    );

    if (renderTrigger) {
        return (
            <View>
                <SpotlightTarget id={spotlightId}>
                    {renderTrigger(() => setModalVisible(true), buttonLabel)}
                </SpotlightTarget>
                {termModal}
            </View>
        );
    }

    if (compact) {
        return (
            <View style={{ alignSelf: 'flex-start' }}>
                <SpotlightTarget id={spotlightId}>
                    <TouchableOpacity
                        onPress={() => setModalVisible(true)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Active term: ${buttonLabel}. Tap to switch term.`}
                        className="flex-row items-center"
                        style={{ paddingVertical: 2, paddingRight: 4 }}
                    >
                        <Text
                            numberOfLines={1}
                            className={`font-nunito-bold text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                            style={{ maxWidth: 190 }}
                        >
                            {buttonLabel}
                        </Text>
                        <Ionicons name="chevron-down" size={13} color={isDark ? '#94a3b8' : '#64748b'} style={{ marginLeft: 3 }} />
                    </TouchableOpacity>
                </SpotlightTarget>
                {termModal}
            </View>
        );
    }

    return (
        <View className="mb-4 mt-2 z-50">
            <View className="flex-row items-center justify-between gap-3">
                {/* Term Selector Button */}
                <SpotlightTarget id={spotlightId} style={{ flex: 1 }}>
                <TouchableOpacity 
                    onPress={() => setModalVisible(true)}
                    activeOpacity={0.7}
                    style={{
                        borderRadius: Radius.full,
                        borderWidth: 1,
                        borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                        backgroundColor: isDark ? theme.surfaceSecondary : theme.surface,
                        ...Shadows.sm,
                    }}
                    className="flex-row items-center justify-between px-4 py-2.5"
                >
                    <View className="flex-row items-center flex-1 mr-2">
                        <View className={`w-8 h-8 rounded-full items-center justify-center mr-2.5 ${isDark ? 'bg-indigo-950/60' : 'bg-indigo-50'}`}>
                            <Ionicons name="calendar" size={15} color={isDark ? '#818cf8' : '#4f46e5'} />
                        </View>
                        <Text 
                            numberOfLines={1} 
                            className={`font-nunito-bold text-sm flex-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
                        >
                            {buttonLabel}
                        </Text>
                    </View>
                    <Ionicons name="chevron-down" size={18} color={isDark ? '#94a3b8' : '#64748b'} />
                </TouchableOpacity>
                </SpotlightTarget>

                {/* View Filter Tabs (All / Tracked) */}
                {setActiveTab && (
                    <View 
                        style={{ borderRadius: Radius.full }}
                        className={`flex-row p-1 border ${isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-slate-100 border-slate-200'}`}
                    >
                        <TouchableOpacity
                            onPress={() => setActiveTab('all')}
                            activeOpacity={0.7}
                            style={{ borderRadius: Radius.full, ...(activeTab === 'all' ? Shadows.sm : {}) }}
                            className={`px-3 py-1.5 flex-row items-center ${
                                activeTab === 'all' 
                                    ? (isDark ? 'bg-indigo-500' : 'bg-indigo-600') 
                                    : 'bg-transparent'
                            }`}
                        >
                            <Ionicons 
                                name="layers-outline" 
                                size={14} 
                                color={activeTab === 'all' ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b')} 
                                style={{ marginRight: 4 }}
                            />
                            <Text className={`font-nunito-bold text-xs ${
                                activeTab === 'all' ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-600')
                            }`}>
                                All
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setActiveTab('tracked')}
                            activeOpacity={0.7}
                            style={{ borderRadius: Radius.full, ...(activeTab === 'tracked' ? Shadows.sm : {}) }}
                            className={`px-3 py-1.5 flex-row items-center ${
                                activeTab === 'tracked' 
                                    ? (isDark ? 'bg-indigo-500' : 'bg-indigo-600') 
                                    : 'bg-transparent'
                            }`}
                        >
                            <Ionicons 
                                name="eye-outline" 
                                size={14} 
                                color={activeTab === 'tracked' ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b')} 
                                style={{ marginRight: 4 }}
                            />
                            <Text className={`font-nunito-bold text-xs ${
                                activeTab === 'tracked' ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-600')
                            }`}>
                                Tracked
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {termModal}
        </View>
    );
}


interface TermSwitcherSheetProps {
    years: any[];
    activeYearId: string | null;
    activeSemId: string | null;
    isDark: boolean;
    onSelectYear?: (id: string) => void;
    onSelectSem?: (id: string) => void;
    setYearAndSemester: (yearId: string, semId: string) => void;
    close: () => void;
    router: any;
}

/**
 * The term picker sheet. Shared by both Tabs variants so the compact chip in a
 * screen header and the full-width selector open the exact same list.
 */
function TermSwitcherSheet({
    years,
    activeYearId,
    activeSemId,
    isDark,
    onSelectYear,
    onSelectSem,
    setYearAndSemester,
    close,
    router,
}: TermSwitcherSheetProps) {
    return (
        <View className="flex-1 justify-end bg-black/60">
            <Pressable className="flex-1" onPress={() => close()} />
            
            <View 
                style={{ borderTopLeftRadius: Radius['4xl'], borderTopRightRadius: Radius['4xl'] }}
                className={`pt-4 pb-10 px-6 max-h-[80%] ${isDark ? 'bg-slate-900' : 'bg-white'}`}
            >
                <View className="items-center mb-5">
                    <View className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
                </View>
                
                <View className="flex-row justify-between items-center mb-6">
                    <View className="flex-row items-center">
                        <View className={`w-8 h-8 rounded-full items-center justify-center mr-2.5 ${isDark ? 'bg-indigo-950/60' : 'bg-indigo-50'}`}>
                            <Ionicons name="calendar-outline" size={18} color={isDark ? '#818cf8' : '#4f46e5'} />
                        </View>
                        <Text className={`font-nunito-black text-2xl ${isDark ? 'text-white' : 'text-slate-800'}`}>Select Term</Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => close()} 
                        activeOpacity={0.7}
                        className={`w-8 h-8 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                    >
                        <Ionicons name="close" size={20} color={isDark ? '#cbd5e1' : '#475569'} />
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                    {years.length === 0 && (
                        <View className="items-center py-8">
                            <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${isDark ? 'bg-indigo-900/30' : 'bg-indigo-50'}`}>
                                <Ionicons name="school-outline" size={32} color={isDark ? '#818cf8' : '#4f46e5'} />
                            </View>
                            <Text className={`font-nunito-bold text-lg mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>No Terms Found</Text>
                            <Text className={`font-nunito text-center px-4 mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                You need to set up your academic years and semesters before you can manage your classes and grades.
                            </Text>
                            <TouchableOpacity
                                onPress={() => {
                                    close();
                                    router.push('/(tabs)/academic-manager');
                                }}
                                activeOpacity={0.8}
                                style={{ borderRadius: Radius.full, ...Shadows.sm }}
                                className={`px-6 py-3 flex-row items-center ${isDark ? 'bg-indigo-500' : 'bg-indigo-600'}`}
                            >
                                <Ionicons name="add" size={20} color="white" />
                                <Text className="font-nunito-bold text-white ml-2 text-sm">Setup Academic Term</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    
                    {years.map((year: any) => (
                        <View key={year.id} className="mb-6">
                            <View className="flex-row items-center mb-3 px-2">
                                <Ionicons name="school-outline" size={18} color={isDark ? '#818cf8' : '#4f46e5'} />
                                <Text className={`font-nunito-bold text-base ml-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {year.name}
                                </Text>
                            </View>
                            
                            <View 
                                style={{ borderRadius: Radius['2xl'] }}
                                className={`overflow-hidden border ${isDark ? 'bg-slate-800/80 border-slate-700/70' : 'bg-slate-50/80 border-slate-200/80'}`}
                            >
                                {(!year.semesters || year.semesters.length === 0) && (
                                    <View className="p-4">
                                        <Text className={`font-nunito text-sm italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No semesters added.</Text>
                                    </View>
                                )}
                                {year.semesters?.map((sem: any, index: number) => {
                                    const isSelected = year.id === activeYearId && sem.id === activeSemId;
                                    return (
                                        <TouchableOpacity
                                            key={sem.id}
                                            activeOpacity={0.7}
                                            onPress={() => {
                                                if (onSelectYear) onSelectYear(year.id);
                                                if (onSelectSem) onSelectSem(sem.id);
                                                setYearAndSemester(year.id, sem.id);
                                                close();
                                            }}
                                            className={`flex-row items-center justify-between p-4 ${
                                                index !== year.semesters.length - 1 
                                                    ? (isDark ? 'border-b border-slate-700/60' : 'border-b border-slate-200/80') 
                                                    : ''
                                            } ${isSelected ? (isDark ? 'bg-indigo-950/40' : 'bg-indigo-50/80') : ''}`}
                                        >
                                            <View className="flex-row items-center">
                                                <Text className={`font-nunito-bold text-base ${
                                                    isSelected 
                                                        ? (isDark ? 'text-indigo-400' : 'text-indigo-600') 
                                                        : (isDark ? 'text-slate-200' : 'text-slate-700')
                                                }`}>
                                                    {sem.name}
                                                </Text>
                                            </View>
                                            {isSelected && (
                                                <Ionicons name="checkmark-circle" size={22} color={isDark ? '#818cf8' : '#4f46e5'} />
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
    );
}
