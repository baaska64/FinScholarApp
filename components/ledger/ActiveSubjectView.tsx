import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal, Image, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calculator } from '../../utils/calculator';
import { useColorScheme } from 'nativewind';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../services/supabaseClient';
import { ActivityIndicator } from 'react-native';
import { AlertService } from '@/components/CustomAlert';

// Removed LayoutAnimation config as it causes warnings in the New Architecture

const generateId = () => Math.random().toString(36).substr(2, 9);

function pctTier(pct: number) {
    if (pct >= 90) return 'text-green-500';
    if (pct >= 75) return 'text-blue-500';
    if (pct >= 60) return 'text-yellow-500';
    return 'text-red-500';
}

function pctTierBg(pct: number) {
    if (pct >= 90) return 'bg-green-500';
    if (pct >= 75) return 'bg-blue-500';
    if (pct >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
}

const getWeightWarning = (explicitSum: number, blankCount: number, arrValues: any[]) => {
    let msgs = [];
    if (blankCount === 0 && Math.abs(explicitSum - 100) > 0.1) msgs.push(`Total ${explicitSum}% (should be 100%)`);
    if (explicitSum > 100) msgs.push(`Exceeds 100%`);
    if (arrValues.some(w => w !== '' && w !== null && w !== undefined && Number(w) === 0)) msgs.push(`A weight is 0%`);
    return msgs.length ? msgs.join(' | ') : null;
};

export default function ActiveSubjectView({ subject, system, onChange, onBack }: any) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    
    const [finOpen, setFinOpen] = useState(false);
    const [autoConfigOpen, setAutoConfigOpen] = useState(false);
    const [syllabusText, setSyllabusText] = useState('');
    const [autoConfigImage, setAutoConfigImage] = useState<string | null>(null);
    const [autoConfigBase64, setAutoConfigBase64] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [expandedPeriods, setExpandedPeriods] = useState<Record<string, boolean>>({});
    const [expandedComponents, setExpandedComponents] = useState<Record<string, boolean>>({});

    const togglePeriod = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedPeriods(prev => ({...prev, [id]: !prev[id]}));
    };

    const toggleComponent = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedComponents(prev => ({...prev, [id]: !prev[id]}));
    };

    const updateSubject = (updater: (s: any) => void) => {
        const newSubject = JSON.parse(JSON.stringify(subject));
        updater(newSubject);
        onChange(newSubject);
    };

    const res = Calculator.calculateSubject(subject, system);
    const passPct = Number(subject.passingPercent) || 60;
    const barW = res.hasData ? Math.max(0, Math.min(100, res.percent)) : 0;
    
    let pExplicit = 0, pBlank = 0;
    subject.periods.forEach((p: any) => { if (p.weight !== '' && p.weight !== null && p.weight !== undefined) pExplicit += Number(p.weight) || 0; else pBlank++; });
    const pAutoW = pBlank > 0 ? (Math.max(0, 100 - pExplicit) / pBlank) : 0;
    const pWarning = getWeightWarning(pExplicit, pBlank, subject.periods.map((p:any) => p.weight));

    // Target GPA Logic
    const targetValue = subject.targetValue || passPct;
    const targetPercent = Number(targetValue); // Simplifying to percent for now
    const needed = targetPercent - res.absoluteEarned;
    const remainingWeight = res.absoluteAvailable;
    
    let targetMsg = "";
    let targetIcon = "";
    let distributionHtml: any = null;
    
    if (needed <= 0) {
        targetMsg = "You have reached your desired grade!";
        targetIcon = "checkmark-circle";
    } else if (remainingWeight <= 0 && needed > 0) {
        targetMsg = "All components are filled. Target cannot be reached.";
        targetIcon = "warning";
    } else if (needed > remainingWeight) {
        const passNeeded = passPct - res.absoluteEarned;
        if (passNeeded <= 0) {
            targetMsg = "Target is impossible, but you've already passed!";
            targetIcon = "alert-circle";
        } else if (passNeeded > remainingWeight) {
            targetMsg = "Target is impossible, and you cannot pass anymore.";
            targetIcon = "close-circle";
        } else {
            targetMsg = "Target is impossible, but you can still pass!";
            targetIcon = "warning";
            const reqPct = passNeeded / remainingWeight;
            distributionHtml = { emptyComps: res.emptyComponents, reqPct, label: 'to pass the subject' };
        }
    } else {
        targetMsg = `You need ${needed.toFixed(1)} more points (out of remaining ${remainingWeight.toFixed(1)}%) to reach ${targetPercent.toFixed(1)}%.`;
        targetIcon = "locate";
        const reqPct = needed / remainingWeight;
        distributionHtml = { emptyComps: res.emptyComponents, reqPct, label: 'for your desired grade' };
    }

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            base64: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            setAutoConfigImage(result.assets[0].uri);
            if (result.assets[0].base64) {
                setAutoConfigBase64(result.assets[0].base64);
            }
        }
    };

    const handleAutoConfig = async () => {
        if (!syllabusText && !autoConfigImage) {
            AlertService.alert("Missing Input", "Please provide a text prompt or upload an image of your syllabus.");
            return;
        }

        setIsProcessing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                AlertService.alert("Authentication Required", "You must be logged in to use the AI AutoConfig feature.");
                setIsProcessing(false);
                return;
            }

            let base64Data = null;
            if (autoConfigImage && autoConfigBase64) {
                let mimeType = 'image/jpeg';
                if (autoConfigImage.toLowerCase().endsWith('.png')) mimeType = 'image/png';
                base64Data = `data:${mimeType};base64,${autoConfigBase64}`;
            }

            const { data, error: funcError } = await supabase.functions.invoke('parse-syllabus', {
                body: { textPrompt: syllabusText, base64Data }
            });

            if (funcError) {
                let errMsg = funcError.message;
                try {
                    if (funcError.context) {
                        const ctx = await funcError.context.json();
                        if (ctx && ctx.error) errMsg = ctx.error;
                    }
                } catch (e) {}
                throw new Error(errMsg);
            }
            
            if (Array.isArray(data)) {
                updateSubject(s => {
                    // Make sure ids are generated
                    const addIds = (items: any[]): any[] => items.map(i => ({
                        ...i, id: generateId(), 
                        components: i.components ? addIds(i.components) : [],
                        items: i.items ? addIds(i.items) : [],
                        subItems: i.subItems ? addIds(i.subItems) : []
                    }));
                    s.periods = addIds(data);
                });
                AlertService.alert("Success", "Grading system successfully configured!");
                setAutoConfigOpen(false);
                setSyllabusText('');
                setAutoConfigImage(null);
                setAutoConfigBase64(null);
            } else {
                throw new Error("Invalid response format from AI.");
            }
            
        } catch (error: any) {
            AlertService.alert("AutoConfig Error", error.message || "An unexpected error occurred.");
        } finally {
            setIsProcessing(false);
        }
    };

    const renderItemRecursive = (item: any, pIndex: number, cIndex: number, idx: number, depth: number, itemPath: number[], weightContext: any) => {
        let { iExplicit, iBlank } = weightContext;
        let iAutoW = iBlank > 0 ? (Math.max(0, 100 - iExplicit) / iBlank) : 0;
        const hasSub = !!(item.subItems && item.subItems.length > 0);

        let subWarning = null;
        let siExplicit = 0, siBlank = 0;
        if (hasSub) {
            item.subItems.forEach((si:any) => { if (si.weight !== '' && si.weight !== null && si.weight !== undefined) siExplicit += Number(si.weight) || 0; else siBlank++; });
            subWarning = getWeightWarning(siExplicit, siBlank, item.subItems.map((si:any) => si.weight));
        }

        const ip = Calculator.computeItemPercent(item);
        
        const updateThisItem = (updater: (it:any)=>void) => {
            updateSubject(s => {
                let targetList = s.periods[pIndex].components[cIndex].items;
                for(let i=0; i<itemPath.length - 1; i++) {
                    targetList = targetList[itemPath[i]].subItems;
                }
                updater(targetList[itemPath[itemPath.length-1]]);
            });
        };

        const deleteThisItem = () => {
            AlertService.alert("Delete", "Delete this item?", [
                {text: "Cancel", style: "cancel"},
                {text: "Delete", style: "destructive", onPress: () => {
                    updateSubject(s => {
                        let targetList = s.periods[pIndex].components[cIndex].items;
                        for(let i=0; i<itemPath.length - 1; i++) {
                            targetList = targetList[itemPath[i]].subItems;
                        }
                        targetList.splice(itemPath[itemPath.length-1], 1);
                    });
                }}
            ]);
        };

        const addSubItemToThis = () => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            updateSubject(s => {
                let targetList = s.periods[pIndex].components[cIndex].items;
                for(let i=0; i<itemPath.length - 1; i++) {
                    targetList = targetList[itemPath[i]].subItems;
                }
                const node = targetList[itemPath[itemPath.length-1]];
                if (!node.subItems) node.subItems = [];
                node.subItems.push({ id: generateId(), name: '', max: 100, isCollapsed: false });
                node.isCollapsed = false;
            });
        };

        return (
            <View key={item.id || idx} className={`mb-2 pb-2 ${depth > 0 ? 'ml-2 border-l-2 pl-2' : 'border-b'} ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <View className="flex-row items-center justify-between">
                    {hasSub && (
                        <TouchableOpacity onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            updateThisItem(it => it.isCollapsed = !it.isCollapsed);
                        }} className="mr-2">
                            <Ionicons name={item.isCollapsed ? "chevron-forward" : "chevron-down"} size={14} color={isDark ? "#94a3b8" : "#3b82f6"} />
                        </TouchableOpacity>
                    )}

                    <TextInput 
                        selectTextOnFocus
                        value={item.name}
                        onChangeText={txt => updateThisItem(it => it.name = txt)}
                        placeholder={depth === 0 ? `Item ${idx + 1}` : `Sub-Item ${idx + 1}`}
                        placeholderTextColor={isDark ? "#475569" : "#cbd5e1"}
                        className={`font-medium flex-1 py-1 ${depth > 0 ? 'text-[11px]' : 'text-xs'} ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                    />
                    
                    {hasSub ? (
                        <View className="mx-2 flex-row items-center justify-center min-w-[80px]">
                             <Text className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {ip.isEmpty ? '-' : `${(ip.percent * 100).toFixed(1)}%`}
                            </Text>
                        </View>
                    ) : (
                        <View className={`flex-row items-center mx-1 rounded-xl px-1.5 py-1 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-sm shadow-slate-100'}`}>
                            <TextInput 
                                keyboardType="numeric"
                                value={item.score?.toString()}
                                onChangeText={txt => updateThisItem(it => it.score = txt)}
                                placeholder="-"
                                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                                className={`text-xs font-bold text-center py-0 min-w-[28px] ${isDark ? 'text-white' : 'text-slate-800'}`}
                            />
                            <Text className={`text-[10px] font-bold mx-0.5 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>/</Text>
                            <TextInput 
                                keyboardType="numeric"
                                value={item.max?.toString()}
                                onChangeText={txt => updateThisItem(it => it.max = txt)}
                                placeholder="100"
                                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                                className={`text-[10px] font-bold text-center py-0 min-w-[28px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                            />
                        </View>
                    )}

                    <View className="flex-row items-center">
                        <TextInput 
                            keyboardType="numeric"
                            value={item.weight?.toString()}
                            onChangeText={txt => updateThisItem(it => it.weight = txt)}
                            placeholder={iAutoW.toFixed(1)}
                            placeholderTextColor={isDark ? "#64748b" : "#cbd5e1"}
                            className={`text-[10px] font-bold text-right py-1 min-w-[28px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                        />
                        <Text className={`text-[10px] font-bold ml-0.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>%</Text>
                        
                        {(!hasSub && depth < 3) && (
                            <TouchableOpacity onPress={addSubItemToThis} className={`ml-1 px-1.5 py-1 rounded-md ${isDark ? 'bg-indigo-900' : 'bg-indigo-50'}`}>
                                <Text className={`text-[9px] font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`}>+ Sub</Text>
                            </TouchableOpacity>
                        )}
                        
                        <TouchableOpacity onPress={deleteThisItem} className={`ml-1 p-1.5 rounded-full ${isDark ? 'bg-red-950' : 'bg-red-50'}`}>
                            <Ionicons name="close" size={10} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                </View>
                
                {hasSub && !item.isCollapsed && (
                    <View className="mt-2">
                        {subWarning && (
                            <View className="bg-red-100 px-3 py-1 rounded-md mb-2 self-start flex-row items-center">
                                <Ionicons name="warning" size={10} color="#dc2626" />
                                <Text className="text-[10px] font-bold text-red-600 ml-1">{subWarning}</Text>
                            </View>
                        )}
                        {item.subItems.map((si:any, sidx:number) => 
                            renderItemRecursive(si, pIndex, cIndex, sidx, depth + 1, [...itemPath, sidx], { iExplicit: siExplicit, iBlank: siBlank })
                        )}
                        {depth < 3 && (
                            <TouchableOpacity onPress={addSubItemToThis} className={`mt-1 py-1.5 px-3 self-start rounded-lg border border-dashed ${isDark ? 'border-indigo-900 bg-indigo-950' : 'border-indigo-200 bg-indigo-50'}`}>
                                <Text className={`text-[10px] font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`}>+ Add Sub-item</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}>
            <View className="flex-row justify-between items-center mb-6 px-4 pt-4">
                <TouchableOpacity onPress={onBack} className={`flex-row items-center px-4 py-2 rounded-full ${isDark ? 'bg-slate-800' : 'bg-blue-100'}`}>
                    <Ionicons name="chevron-back" size={14} color={isDark ? "#94a3b8" : "#3b82f6"} />
                    <Text className={`font-bold ml-2 ${isDark ? 'text-slate-300' : 'text-blue-600'}`}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAutoConfigOpen(true)} className="flex-row items-center px-4 py-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500">
                    <Ionicons name="color-wand" size={14} color="#ffffff" />
                    <Text className="font-bold text-white ml-2">AutoConfig</Text>
                </TouchableOpacity>
            </View>

            {/* Subject Header Card */}
            <View className={`rounded-[32px] p-6 shadow-sm border mx-4 mb-6 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-blue-50 shadow-slate-200'}`}>
                <View className="flex-row justify-between items-start mb-6">
                    <View className="flex-1">
                        <View className={`self-start px-3 py-1.5 rounded-lg mb-3 ${isDark ? 'bg-slate-700' : 'bg-blue-50'}`}>
                            <Text className={`text-[10px] font-bold tracking-widest ${isDark ? 'text-slate-400' : 'text-blue-500'}`}>SUBJECT</Text>
                        </View>
                        <TextInput 
                            selectTextOnFocus
                            value={subject.name}
                            onChangeText={txt => updateSubject(s => s.name = txt)}
                            placeholder="Subject Name"
                            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                            autoCapitalize="characters"
                            className={`text-3xl font-extrabold p-0 m-0 uppercase ${isDark ? 'text-white' : 'text-slate-800'}`}
                        />
                    </View>
                    <TouchableOpacity onPress={() => setFinOpen(true)} className={`w-12 h-12 rounded-full items-center justify-center border-2 overflow-hidden shadow-sm ${isDark ? 'bg-slate-900 border-indigo-900' : 'bg-white border-indigo-200'}`}>
                        <Image source={require('../../assets/images/FinSights.png')} className="w-14 h-14" style={{ transform: [{translateY: 4}] }} resizeMode="cover" />
                    </TouchableOpacity>
                </View>

                {/* Progress Bar */}
                <View className="mb-6">
                    <View className="flex-row justify-between items-end mb-2">
                        <Text className={`text-4xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{res.hasData ? res.percent.toFixed(1) + '%' : '-'}</Text>
                        <View className={`rounded-xl px-4 py-2 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                            <Text className={`font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                {system === 'PERCENT' ? (res.hasData ? res.equivalent.toFixed(1) + '%' : 'No Data') : (res.hasData ? 'GWA: ' + res.equivalent.toFixed(2) : 'No Data')}
                            </Text>
                        </View>
                    </View>
                    <View className={`h-4 rounded-full overflow-hidden relative shadow-inner ${isDark ? 'bg-slate-900' : 'bg-slate-200'}`}>
                        <View className={`h-full rounded-full ${res.hasData ? pctTierBg(res.percent) : 'bg-slate-400'}`} style={{ width: `${barW}%` }} />
                        <View className="absolute h-full w-1 bg-white shadow-sm" style={{ left: `${passPct}%` }} />
                    </View>
                </View>

                {pWarning && (
                    <View className="bg-red-100 px-4 py-2 rounded-xl mb-4 flex-row items-center border border-red-200">
                        <Ionicons name="warning" size={14} color="#dc2626" />
                        <Text className="text-xs font-bold text-red-600 ml-2 flex-1">{pWarning}</Text>
                    </View>
                )}

                {/* Settings Row */}
                <View className="flex-row gap-4">
                    <View className="flex-1">
                        <Text className={`text-[10px] font-bold tracking-widest mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>UNITS</Text>
                        <TextInput 
                            keyboardType="numeric"
                            value={subject.units?.toString()}
                            onChangeText={txt => updateSubject(s => s.units = txt)}
                            className={`p-3 rounded-2xl font-bold border ${isDark ? 'bg-slate-900 text-white border-slate-700' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                        />
                    </View>
                    <View className="flex-1">
                        <Text className={`text-[10px] font-bold tracking-widest mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>PASS %</Text>
                        <TextInput 
                            keyboardType="numeric"
                            value={subject.passingPercent?.toString()}
                            onChangeText={txt => updateSubject(s => s.passingPercent = txt)}
                            className={`p-3 rounded-2xl font-bold border ${isDark ? 'bg-slate-900 text-white border-slate-700' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                        />
                    </View>
                </View>
            </View>

            {/* Periods */}
            <View className="px-4">
                {subject.periods.map((per: any, pIndex: number) => {
                    const pd = Calculator.calculatePeriod(per, passPct);
                    const pdGradeEq = Calculator.interpolateGrade(pd.percent, passPct, system);
                    const pdDisplayGrade = system === 'PERCENT' ? pd.percent.toFixed(2) + '%' : pdGradeEq.toFixed(2);
                    
                    let cExplicit = 0, cBlank = 0;
                    const safeComps = per.components || [];
                    safeComps.forEach((c: any) => { if (c.weight !== '' && c.weight !== null && c.weight !== undefined) cExplicit += Number(c.weight) || 0; else cBlank++; });
                    const cAutoW = cBlank > 0 ? (Math.max(0, 100 - cExplicit) / cBlank) : 0;
                    const cWarning = getWeightWarning(cExplicit, cBlank, safeComps.map((c:any) => c.weight));
                    
                    const isExpanded = expandedPeriods[per.id];

                    return (
                        <View key={per.id} className={`rounded-[28px] mb-6 shadow-sm border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                            {/* Period Header */}
                            <TouchableOpacity onPress={() => togglePeriod(per.id)} className={`p-5 rounded-[28px] ${isExpanded ? 'rounded-b-none border-b' : ''} flex-row justify-between items-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                <View className="flex-1 pr-2">
                                    <Text className={`text-[10px] font-extrabold tracking-widest uppercase mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>PERIOD</Text>
                                    <View className="flex-row items-center">
                                        <Ionicons name={isExpanded ? "chevron-down" : "chevron-forward"} size={16} color={isDark ? "#94a3b8" : "#3b82f6"} style={{marginRight: 8}} />
                                        <TextInput 
                                            selectTextOnFocus
                                            value={per.name}
                                            onChangeText={txt => updateSubject(s => s.periods[pIndex].name = txt)}
                                            placeholder="Period Name"
                                            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                                            autoCapitalize="characters"
                                            className={`text-xl font-bold p-0 m-0 uppercase flex-1 ${isDark ? 'text-white' : 'text-slate-800'}`}
                                        />
                                    </View>
                                </View>
                                <View className="items-end">
                                    <View className={`flex-row items-center rounded-xl px-2 py-1 mb-2 border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-sm shadow-slate-100'}`}>
                                        <Text className={`text-[10px] font-bold mr-1 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>Wt:</Text>
                                        <TextInput 
                                            keyboardType="numeric"
                                            placeholder={pAutoW.toFixed(1)}
                                            placeholderTextColor={isDark ? "#64748b" : "#cbd5e1"}
                                            value={per.weight?.toString()}
                                            onChangeText={txt => updateSubject(s => s.periods[pIndex].weight = txt)}
                                            className={`text-xs min-w-[30px] text-right p-0 font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}
                                        />
                                        <Text className={`text-[10px] font-bold ml-1 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>%</Text>
                                        <TouchableOpacity onPress={() => {
                                            AlertService.alert("Delete", "Delete Period?", [{text:"Cancel"},{text:"Delete", style:"destructive", onPress:()=>updateSubject(s => s.periods.splice(pIndex, 1))}]);
                                        }} className={`ml-2 p-1 rounded-full ${isDark ? 'bg-red-950' : 'bg-red-50'}`}>
                                            <Ionicons name="close" size={14} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                    {pd.hasData ? (
                                        <Text className={`text-lg font-extrabold ${pctTier(pd.percent)}`}>{pdDisplayGrade}</Text>
                                    ) : (
                                        <Text className="text-slate-400 font-bold text-lg">-</Text>
                                    )}
                                </View>
                            </TouchableOpacity>

                            {/* Components */}
                            {isExpanded && (
                            <View className="p-4">
                                {cWarning && (
                                    <View className="bg-red-100 px-4 py-2 rounded-xl mb-4 flex-row items-center border border-red-200">
                                        <Ionicons name="warning" size={14} color="#dc2626" />
                                        <Text className="text-xs font-bold text-red-600 ml-2 flex-1">{cWarning}</Text>
                                    </View>
                                )}
                                {safeComps.map((comp: any, cIndex: number) => {
                                    let iExplicit = 0, iBlank = 0;
                                    const safeItems = comp.items || [];
                                    safeItems.forEach((i: any) => { if (i.weight !== '' && i.weight !== null && i.weight !== undefined) iExplicit += Number(i.weight) || 0; else iBlank++; });
                                    const iAutoW = iBlank > 0 ? (Math.max(0, 100 - iExplicit) / iBlank) : 0;
                                    const iWarning = getWeightWarning(iExplicit, iBlank, safeItems.map((i:any) => i.weight));
                                    
                                    const isCompExpanded = expandedComponents[comp.id];

                                    return (
                                        <View key={comp.id} className={`mb-4 rounded-3xl p-4 border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200 shadow-sm shadow-slate-200'}`}>
                                            <View className="flex-row justify-between items-center mb-4">
                                                <TouchableOpacity onPress={() => toggleComponent(comp.id)} className="flex-row items-center flex-1 pr-2">
                                                    <Ionicons name={isCompExpanded ? "chevron-down" : "chevron-forward"} size={16} color={isDark ? "#94a3b8" : "#3b82f6"} style={{marginRight: 8}} />
                                                    <TextInput 
                                                        selectTextOnFocus
                                                        value={comp.name}
                                                        onChangeText={txt => updateSubject(s => s.periods[pIndex].components[cIndex].name = txt)}
                                                        placeholder="Component Name"
                                                        placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                                                        autoCapitalize="characters"
                                                        className={`text-base font-bold flex-1 p-0 uppercase ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
                                                    />
                                                </TouchableOpacity>
                                                <View className={`flex-row items-center rounded-lg px-2 py-1 ml-2 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                                                    <Text className={`text-[10px] font-bold mr-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Wt:</Text>
                                                    <TextInput 
                                                        keyboardType="numeric"
                                                        placeholder={cAutoW.toFixed(1)}
                                                        placeholderTextColor={isDark ? "#64748b" : "#cbd5e1"}
                                                        value={comp.weight?.toString()}
                                                        onChangeText={txt => updateSubject(s => s.periods[pIndex].components[cIndex].weight = txt)}
                                                        className={`text-[10px] font-bold min-w-[20px] text-right p-0 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
                                                    />
                                                    <Text className={`text-[10px] font-bold ml-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>%</Text>
                                                    <TouchableOpacity onPress={() => {
                                                        AlertService.alert("Delete", "Delete Component?", [{text:"Cancel"},{text:"Delete", style:"destructive", onPress:()=>updateSubject(s => s.periods[pIndex].components.splice(cIndex, 1))}]);
                                                    }} className={`ml-2 p-1.5 rounded-full ${isDark ? 'bg-red-950' : 'bg-red-50'}`}>
                                                        <Ionicons name="close" size={12} color="#ef4444" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {isCompExpanded && (
                                            <View>
                                                {iWarning && (
                                                    <View className="bg-red-100 px-3 py-1.5 rounded-lg mb-3 flex-row items-center border border-red-200">
                                                        <Ionicons name="warning" size={12} color="#dc2626" />
                                                        <Text className="text-[10px] font-bold text-red-600 ml-2 flex-1">{iWarning}</Text>
                                                    </View>
                                                )}
                                                {safeItems.map((item: any, iIndex: number) => 
                                                    renderItemRecursive(item, pIndex, cIndex, iIndex, 0, [iIndex], { iExplicit, iBlank })
                                                )}
                                                <TouchableOpacity onPress={() => updateSubject(s => { if (!s.periods[pIndex].components[cIndex].items) s.periods[pIndex].components[cIndex].items = []; s.periods[pIndex].components[cIndex].items.push({ id: generateId(), max: 100, subItems: [] }) })} className={`mt-2 py-3 items-center rounded-xl border border-dashed ${isDark ? 'border-slate-700 bg-slate-800' : 'border-blue-200 bg-blue-50'}`}>
                                                    <Text className={`text-xs font-bold ${isDark ? 'text-blue-400' : 'text-blue-500'}`}>+ Add Item</Text>
                                                </TouchableOpacity>
                                            </View>
                                            )}
                                        </View>
                                    );
                                })}
                                {safeComps.length === 0 && (
                                    <View className="mb-4 bg-yellow-100 p-4 rounded-xl">
                                        <Text className="text-yellow-800 text-xs">No components found. Add one manually.</Text>
                                    </View>
                                )}
                                <TouchableOpacity onPress={() => updateSubject(s => { if (!s.periods[pIndex].components) s.periods[pIndex].components = []; s.periods[pIndex].components.push({ id: generateId(), name: 'New Component', items: [] }) })} className={`py-4 items-center rounded-2xl mt-2 border-2 border-dashed ${isDark ? 'border-slate-700 bg-slate-800' : 'border-blue-200 bg-white'}`}>
                                    <Text className={`text-sm font-bold ${isDark ? 'text-blue-400' : 'text-blue-500'}`}>+ Add Component</Text>
                                </TouchableOpacity>

                                {/* Period Breakdown */}
                                <View className={`mt-6 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                    <View className="flex-row justify-between items-center mb-3">
                                        <Text className={`text-[10px] font-extrabold tracking-widest uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{per.name} BREAKDOWN</Text>
                                        {pd.hasData && (
                                            <TouchableOpacity onPress={() => setFinOpen(true)} className={`flex-row items-center rounded-full px-2 py-1 shadow-sm ${isDark ? 'bg-indigo-900 border border-indigo-900' : 'bg-white border border-indigo-100'}`}>
                                                <View className="w-5 h-5 rounded-full overflow-hidden mr-1.5 border border-indigo-200 bg-white items-center justify-center">
                                                    <Image source={require('../../assets/images/FinSights.png')} className="w-6 h-6" style={{ transform: [{translateY: 2}] }} resizeMode="cover" />
                                                </View>
                                                <Text className={`text-[10px] font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>FinSights</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    
                                    {pd.hasData ? (
                                        <View className="gap-2">
                                            {pd.comps.map((c: any) => {
                                                const cTier = c.hasData ? pctTier(c.percent) : 'text-slate-400';
                                                const cDisplay = system === 'PERCENT' ? `${c.percent.toFixed(2)}%` : Calculator.interpolateGrade(c.percent, passPct, system).toFixed(2);
                                                return (
                                                    <View key={c.id} className="flex-row justify-between items-center px-1">
                                                        <Text className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{c.name}</Text>
                                                        <Text className={`text-xs font-extrabold ${cTier}`}>{c.hasData ? cDisplay : '-'}</Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    ) : (
                                        <Text className={`text-xs italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Add scores to see the breakdown.</Text>
                                    )}
                                </View>
                            </View>
                            )}
                        </View>
                    );
                })}
                
                <TouchableOpacity onPress={() => {
                    const newId = generateId();
                    setExpandedPeriods(prev => ({...prev, [newId]: true}));
                    updateSubject(s => s.periods.push({ id: newId, name: 'New Period', components: [] }));
                }} className={`py-5 items-center rounded-3xl mb-8 border-2 border-dashed ${isDark ? 'border-slate-700 bg-slate-800' : 'border-blue-200 bg-white'}`}>
                    <Text className={`text-base font-extrabold ${isDark ? 'text-blue-400' : 'text-blue-500'}`}>+ Add Period</Text>
                </TouchableOpacity>

                {/* TARGET TRACKER - BOTTOM DEDICATED SECTION */}
                <View className={`rounded-[32px] p-6 shadow-sm border mb-12 ${isDark ? 'bg-indigo-950 border-indigo-900' : 'bg-indigo-50 border-indigo-100'}`}>
                    <View className="flex-row items-center mb-6">
                        <View className="w-10 h-10 rounded-full bg-indigo-500 items-center justify-center shadow-sm mr-3">
                            <Ionicons name="locate" size={20} color="white" />
                        </View>
                        <View className="flex-1">
                            <Text className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Target Goal</Text>
                            <Text className={`text-xs ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>Track what you need</Text>
                        </View>
                        <View className={`flex-row items-center rounded-xl px-3 py-1.5 border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                            <TextInput 
                                keyboardType="numeric"
                                value={subject.targetValue?.toString()}
                                onChangeText={txt => updateSubject(s => s.targetValue = txt)}
                                placeholder="90"
                                placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                                className={`text-sm font-bold text-center py-0 min-w-[30px] ${isDark ? 'text-white' : 'text-slate-800'}`}
                            />
                            <Text className={`text-xs font-bold ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>%</Text>
                        </View>
                    </View>

                    <View className="flex-row items-start mb-2">
                        <Ionicons name={targetIcon as any} size={20} color={isDark ? "#818cf8" : "#6366f1"} style={{marginTop: 2, marginRight: 10}} />
                        <Text className={`flex-1 text-sm font-medium leading-5 ${isDark ? 'text-indigo-200' : 'text-indigo-800'}`}>{targetMsg}</Text>
                    </View>

                    {distributionHtml && distributionHtml.emptyComps.length > 0 && (
                        <View className={`mt-6 pt-6 border-t ${isDark ? 'border-indigo-900' : 'border-indigo-200'}`}>
                            <Text className={`text-[10px] font-extrabold tracking-widest uppercase mb-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                                Required scores {distributionHtml.label}:
                            </Text>
                            
                            <View className="gap-2">
                                {distributionHtml.emptyComps.map((c:any) => {
                                    const scoreNeeded = distributionHtml.reqPct * c.sumMax;
                                    return (
                                        <View key={c.id} className={`flex-row justify-between items-center px-4 py-3 rounded-xl border border-dashed ${isDark ? 'bg-slate-900 border-indigo-900' : 'bg-white border-indigo-200'}`}>
                                            <Text className={`text-xs font-medium flex-1 mr-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                                {c.periodName} &mdash; {c.name}
                                            </Text>
                                            <View className="flex-row items-center">
                                                <Text className={`text-sm font-extrabold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                                                    {scoreNeeded.toFixed(1)} 
                                                    <Text className={`text-[10px] font-normal ${isDark ? 'text-slate-500' : 'text-slate-400'}`}> / {c.sumMax}</Text>
                                                </Text>
                                                <View className={`ml-2 px-1.5 py-0.5 rounded ${isDark ? 'bg-indigo-900' : 'bg-indigo-100'}`}>
                                                    <Text className={`text-[9px] font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
                                                        {(distributionHtml.reqPct * 100).toFixed(1)}%
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}
                </View>
            </View>

            {/* FinSights Modal (Transparent Popup) */}
            <Modal visible={finOpen} animationType="fade" transparent={true} onRequestClose={() => setFinOpen(false)}>
                <View className="flex-1 bg-black/50 justify-center items-center px-4">
                    <View className={`w-full rounded-[32px] p-6 shadow-xl ${isDark ? 'bg-slate-900' : 'bg-blue-50'}`}>
                        <View className="flex-row justify-between items-center mb-8">
                            <View className="flex-row items-center">
                                <View className="w-12 h-12 rounded-full bg-white items-center justify-center shadow-sm mr-3 overflow-hidden border border-indigo-100">
                                    <Image source={require('../../assets/images/FinSights.png')} className="w-14 h-14" style={{ transform: [{translateY: 4}] }} resizeMode="cover" />
                                </View>
                                <View>
                                    <Text className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>FinSights</Text>
                                    <Text className={isDark ? 'text-slate-400' : 'text-slate-500'}>Here's what I noticed...</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setFinOpen(false)} className={`p-3 rounded-full ${isDark ? 'bg-slate-800' : 'bg-white shadow-sm'}`}>
                                <Ionicons name="close" size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                            </TouchableOpacity>
                        </View>
                        
                        <View className={`p-6 rounded-[32px] shadow-sm ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                            {res.hasData ? (
                                <View>
                                    <View className="flex-row items-start mb-6">
                                        <Text className="text-2xl mr-3">{targetIcon === 'checkmark-circle' ? '🎉' : '🎯'}</Text>
                                        <Text className={`text-base font-medium flex-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{targetMsg}</Text>
                                    </View>
                                    <View className="flex-row items-start">
                                        <Text className="text-2xl mr-3">💡</Text>
                                        <Text className={`text-base font-medium flex-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                                            Focus on upcoming heavily weighted items. Keep your momentum up!
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                <View className="flex-row items-start">
                                    <Text className="text-2xl mr-3">👋</Text>
                                    <Text className={`text-base font-medium flex-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                                        Add some scores and I'll analyze your subject for you!
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>

            {/* AutoConfig Modal (Transparent Popup) */}
            <Modal visible={autoConfigOpen} animationType="fade" transparent={true} onRequestClose={() => setAutoConfigOpen(false)}>
                <View className="flex-1 bg-black/50 justify-center px-4">
                    <View className={`w-full rounded-[32px] p-6 shadow-xl ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                        <View className="flex-row justify-between items-start mb-8">
                            <View className="flex-row items-center flex-1 mr-4">
                                <View className="w-12 h-12 rounded-full bg-indigo-100 items-center justify-center mr-3 shrink-0">
                                    <Ionicons name="color-wand" size={24} color="#6366f1" />
                                </View>
                                <View className="flex-1">
                                    <Text className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>AutoConfig</Text>
                                    <Text className={`${isDark ? 'text-slate-400' : 'text-slate-500'} flex-wrap`} numberOfLines={2}>Paste your syllabus below or let Fin scan it</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setAutoConfigOpen(false)} className={`p-3 rounded-full shrink-0 ${isDark ? 'bg-slate-800' : 'bg-white shadow-sm'}`}>
                                <Ionicons name="close" size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row gap-4 mb-6">
                            <TouchableOpacity 
                                onPress={pickImage}
                                className={`flex-1 border-2 border-dashed rounded-[24px] p-4 items-center justify-center ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}
                                style={{ height: 100 }}
                            >
                                {autoConfigImage ? (
                                    <View className="w-full h-full relative rounded-[16px] overflow-hidden">
                                        <Image source={{ uri: autoConfigImage }} className="w-full h-full" resizeMode="cover" />
                                        <TouchableOpacity 
                                            onPress={() => setAutoConfigImage(null)}
                                            className="absolute top-2 right-2 bg-red-500 rounded-full p-1 shadow-md"
                                        >
                                            <Ionicons name="close" size={16} color="white" />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <>
                                        <Ionicons name="image-outline" size={28} color={isDark ? "#6366f1" : "#818cf8"} />
                                        <Text className={`text-sm font-bold mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} numberOfLines={1}>Add Image</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            
                            <TextInput 
                                multiline 
                                value={syllabusText}
                                onChangeText={setSyllabusText}
                                placeholder="Or type instructions..."
                                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                                className={`flex-1 p-4 rounded-[24px] text-sm shadow-sm border ${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-800 border-slate-100'}`}
                                style={{ textAlignVertical: 'top', height: 100 }}
                            />
                        </View>

                        <TouchableOpacity 
                            onPress={handleAutoConfig}
                            disabled={isProcessing}
                            className={`py-4 w-full rounded-[32px] items-center flex-row justify-center shadow-lg ${isProcessing ? (isDark ? 'bg-slate-700' : 'bg-slate-300') : 'bg-indigo-500 shadow-indigo-500'}`}
                        >
                            {isProcessing ? (
                                <ActivityIndicator color="#ffffff" className="mr-2" />
                            ) : (
                                <Ionicons name="sparkles" size={18} color="white" className="mr-2" />
                            )}
                            <Text className="text-white font-bold text-lg ml-2">{isProcessing ? "Analyzing..." : "Auto-Configure"}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}


