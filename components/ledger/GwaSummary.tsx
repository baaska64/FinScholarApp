import React from 'react';
import { View, Image, Text } from 'react-native';
import DonutChart from './DonutChart';
import { useColorScheme } from 'nativewind';

interface GwaSummaryProps {
    semGwa: number;
    yearGwa: number;
    cumGwa: number;
    semPercent: number;
    yearPercent: number;
    cumPercent: number;
    system: string;
}

export default function GwaSummary({ semGwa, yearGwa, cumGwa, semPercent, yearPercent, cumPercent, system }: GwaSummaryProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    const isHighGrade = system === 'PERCENT' 
        ? (semPercent >= 90 || yearPercent >= 90 || cumPercent >= 90)
        : (
            (semGwa > 0 && semGwa <= 1.5) || 
            (yearGwa > 0 && yearGwa <= 1.5) || 
            (cumGwa > 0 && cumGwa <= 1.5)
        );

    return (
        <View className="w-full">
            <View className="flex-row justify-between w-full mb-4">
                <DonutChart 
                    label="SEMESTER" 
                    value={semGwa} 
                    percent={semPercent}
                    system={system} 
                    indicatorText="On Track" 
                />
                <DonutChart 
                    label="YEAR" 
                    value={yearGwa} 
                    percent={yearPercent}
                    system={system} 
                    indicatorText="Passing" 
                />
                <DonutChart 
                    label="CUMULATIVE" 
                    value={cumGwa} 
                    percent={cumPercent}
                    system={system} 
                    indicatorText="Passing" 
                />
            </View>

            {isHighGrade && (
                <View className={`p-4 rounded-3xl flex-row items-center mb-6 border ${isDark ? 'bg-indigo-950/40 border-indigo-900/50' : 'bg-indigo-50 border-indigo-100 shadow-sm'}`}>
                    <Image 
                        source={require('../../assets/images/happy.png')} 
                        className="w-16 h-16 mr-4"
                        resizeMode="contain"
                    />
                    <View className="flex-1">
                        <Text className={`font-nunito-bold text-base ${isDark ? 'text-indigo-200' : 'text-indigo-800'}`}>Fin is super happy! 🌟</Text>
                        <Text className={`font-nunito text-xs mt-1 ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
                            Your GWA is outstanding! Keep shining and maintaining these excellent grades!
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
}
