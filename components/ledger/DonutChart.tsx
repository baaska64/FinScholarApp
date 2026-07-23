import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function DonutChart({ label, value, percent, system, indicatorText }: any) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const R = 38;
    const C = 2 * Math.PI * R;
    
    let p = percent ?? 0;
    if (isNaN(p)) p = 0;
    p = Math.max(0, Math.min(100, p));
    
    const defaultColor = isDark ? '#94a3b8' : '#cbd5e1';
    let color = defaultColor;
    
    if (p >= 90) { color = '#22c55e'; } 
    else if (p >= 75) { color = '#3b82f6'; } 
    else if (p >= 60) { color = '#eab308'; } 
    else if (p > 0) { color = '#ef4444'; } 

    const displayVal = (system === 'PERCENT') ? p.toFixed(1) + '%' : Number(value || 0).toFixed(3);
    const targetOffset = C - (p / 100) * C;

    const animatedOffset = useSharedValue(C);

    useEffect(() => {
        animatedOffset.value = withTiming(targetOffset, {
            duration: 1000,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
        });
    }, [targetOffset]);

    const animatedProps = useAnimatedProps(() => {
        return {
            strokeDashoffset: animatedOffset.value,
        };
    });

    const trackColor = isDark ? "#334155" : "#e2e8f0";

    return (
        <View className={`p-4 rounded-[28px] flex-1 mx-1.5 items-center border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-blue-50 shadow-slate-200'}`}>
            <Text className={`text-[10px] font-extrabold uppercase tracking-widest mb-3 ${isDark ? 'text-slate-400' : 'text-blue-500'}`}>
                {label}
            </Text>
            <View className="items-center justify-center relative w-[80px] h-[80px] mb-4">
                <Svg width="80" height="80" viewBox="0 0 100 100" className="absolute">
                    <Circle 
                        cx="50" cy="50" r={R} 
                        stroke={trackColor}
                        strokeWidth="8" 
                        fill="transparent" 
                    />
                    <AnimatedCircle 
                        cx="50" cy="50" r={R} 
                        stroke={color} 
                        strokeWidth="8" 
                        fill="transparent"
                        strokeDasharray={C}
                        animatedProps={animatedProps}
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                    />
                </Svg>
                <View className="absolute items-center justify-center">
                    <Text className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {displayVal}
                    </Text>
                    <Text className={`text-[9px] font-extrabold tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        GWA
                    </Text>
                </View>
            </View>
            {indicatorText && (
                <View className={`flex-row items-center px-3 py-1.5 rounded-full ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                    <View className="w-1.5 h-1.5 rounded-full mr-2 shadow-sm" style={{ backgroundColor: color, shadowColor: color }} />
                    <Text className={`text-[11px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{indicatorText}</Text>
                </View>
            )}
        </View>
    );
}
