import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ImageBackground, Dimensions, ActivityIndicator, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import Constants from 'expo-constants';
import { supabase } from '../services/supabaseClient';
import { SyncService } from '../services/SyncService';
import * as WebBrowser from 'expo-web-browser';

import { useRouter } from 'expo-router';

const SCREEN_HEIGHT = Dimensions.get('window').height;

type EntryPoint = 'grades' | 'schedule' | 'calendar' | 'generic';

export default function PremiumPaywallModal({ 
    visible, 
    onClose, 
    entryPoint = 'generic' 
}: { 
    visible: boolean; 
    onClose: () => void;
    entryPoint?: EntryPoint;
}) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const [loading, setLoading] = useState(false);
    const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
    const [annualPackage, setAnnualPackage] = useState<PurchasesPackage | null>(null);
    const [isEarlyBird, setIsEarlyBird] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
    const router = useRouter();

    const getContextualCopy = () => {
        switch(entryPoint) {
            case 'grades': return { title: "Scan your syllabus, get your grade tracker built instantly", sub: "Let AI extract all your grading criteria and assignments so you can start tracking immediately." };
            case 'schedule': return { title: "Snap a photo, get your schedule built instantly", sub: "Let AI read your timetable image and populate all your classes for the term in seconds." };
            case 'calendar': return { title: "Sync your calendar and never miss a deadline", sub: "Automatically import all events, classes, and tasks to keep everything perfectly organized." };
            default: return { title: "Unlock Fin Premium", sub: "Get exclusive access to AI scanning and let Fin do the heavy lifting for you in seconds." };
        }
    };

    const { title, sub } = getContextualCopy();

    useEffect(() => {
        if (visible) {
            setCheckingStatus(true);
            const checkEarlyBird = async () => {
                try {

                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;
                    
                    // Get the 50 oldest profiles
                    const { data } = await supabase.from('profiles').select('id').order('created_at', { ascending: true }).limit(50);
                    if (data && data.some(p => p.id === user.id)) {
                        setIsEarlyBird(true);
                    }
                } catch (e) {
                    console.error("Early bird check failed", e);
                } finally {
                    setCheckingStatus(false);
                }
            };

            const fetchOfferings = async () => {
                if (Constants.appOwnership === 'expo') return;
                try {
                    const offerings = await Purchases.getOfferings();
                    if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
                        const allPackages = offerings.current.availablePackages;
                        const monthly = allPackages.find(p => p.packageType === Purchases.PACKAGE_TYPE.MONTHLY);
                        const annual = allPackages.find(p => p.packageType === Purchases.PACKAGE_TYPE.ANNUAL);
                        
                        setMonthlyPackage(monthly || allPackages[0]);
                        setAnnualPackage(annual || null);
                    }
                } catch (e) {
                    console.error("Error fetching offerings", e);
                }
            };
            
            checkEarlyBird();
            fetchOfferings();
        }
    }, [visible]);

    const handleClaimEarlyBird = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data, error } = await supabase.rpc('claim_early_bird');
                if (error || data === false) {
                    alert('Sorry, the Early Bird offer has already reached its limit!');
                    return;
                }
                await SyncService.setPremiumUser(true);
                alert('Congratulations! You claimed your Early Bird Lifetime Premium!');
                onClose();
            }
        } catch (e) {
            alert('Failed to claim offer. Try again later.');
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async () => {
        const packageToBuy = selectedPlan === 'annual' ? annualPackage : monthlyPackage;

        if (!packageToBuy) {
            alert('Error: This plan is not configured in RevenueCat yet. Please set it up in your dashboard.');
            return;
        }
        setLoading(true);
        try {
            const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
            if (typeof customerInfo.entitlements.active['Premium'] !== "undefined") {
                await SyncService.setPremiumUser(true);
                alert('Welcome to Fin Premium!');
                onClose();
            }
        } catch (e: any) {
            if (!e.userCancelled) {
                alert(`Purchase failed: ${e.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async () => {
        setLoading(true);
        try {
            const customerInfo = await Purchases.restorePurchases();
            if (typeof customerInfo.entitlements.active['Premium'] !== "undefined") {
                await SyncService.setPremiumUser(true);
                alert('Your purchase has been restored successfully!');
                onClose();
            } else {
                alert('No active premium subscription found to restore.');
            }
        } catch (e: any) {
            alert(`Restore failed: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const monthlyPriceStr = monthlyPackage ? monthlyPackage.product.priceString : '₱60';
    const annualPriceStr = annualPackage ? annualPackage.product.priceString : '₱250';

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-end bg-black/60">
                <TouchableOpacity className="absolute inset-0" onPress={onClose} activeOpacity={1} />
                
                <View className="w-full rounded-t-3xl overflow-hidden border-t border-white/20" style={{ height: SCREEN_HEIGHT * 0.9 }}>
                    <ImageBackground 
                        source={require('../assets/images/GlassBg.png')} 
                        style={{ flex: 1 }}
                        resizeMode="cover"
                    >
                        <BlurView intensity={90} tint="dark" style={{ flex: 1 }}>
                            <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'stretch', padding: 24, paddingTop: 40, paddingBottom: 40 }}>
                                {/* Close Button */}
                                <TouchableOpacity 
                                    className="absolute top-4 right-4 w-10 h-10 rounded-full items-center justify-center bg-white/10 border border-white/20 z-10"
                                    onPress={onClose}
                                    disabled={loading}
                                >
                                    <Ionicons name="close" size={24} color="#ffffff" />
                                </TouchableOpacity>

                                <Text className="text-3xl font-extrabold text-white text-center mb-3 mt-6" style={styles.textShadow}>
                                    {title}
                                </Text>
                                
                                <Text className="text-base text-center text-slate-200 font-semibold mb-6 px-2" style={styles.textShadow}>
                                    {sub}
                                </Text>

                                {checkingStatus ? (
                                    <ActivityIndicator color="white" style={{ marginTop: 40, alignSelf: 'center' }} />
                                ) : isEarlyBird ? (
                                    <>
                                        <View className="bg-emerald-500/20 rounded-3xl p-6 mb-8 border border-emerald-400/50">
                                            <View className="flex-row items-center justify-center mb-2">
                                                <Ionicons name="gift" size={32} color="#34d399" />
                                            </View>
                                            <Text className="text-emerald-300 font-extrabold text-center text-lg mb-2">EARLY BIRD OFFER</Text>
                                            <Text className="text-white text-center font-medium">
                                                You are one of our first 50 users! You have been granted a FREE lifetime Fin Premium upgrade.
                                            </Text>
                                        </View>
                                        
                                        <TouchableOpacity 
                                            className={`py-4 rounded-full items-center justify-center shadow-lg ${loading ? 'bg-emerald-400' : 'bg-emerald-500 shadow-emerald-500/50'}`}
                                            onPress={handleClaimEarlyBird}
                                            disabled={loading}
                                        >
                                            {loading ? <ActivityIndicator color="white" /> : (
                                                <Text className="text-white font-extrabold text-lg tracking-wider">
                                                    CLAIM FREE UPGRADE
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <>
                                        {/* Social Proof */}
                                        <View className="items-center mb-6 mt-2">
                                            <View className="flex-row mb-1">
                                                {[...Array(5)].map((_, i) => <Ionicons key={i} name="star" size={16} color="#fbbf24" />)}
                                            </View>
                                            <Text className="text-slate-300 text-sm font-semibold text-center">Thousands of students save hours every week</Text>
                                        </View>

                                        {/* Outcomes Checklist */}
                                        <View className="bg-black/40 rounded-3xl p-6 mb-8 border border-white/10">
                                            <View className="flex-row items-center mb-5">
                                                <Ionicons name="flash" size={24} color="#4ade80" />
                                                <Text className="text-white font-bold ml-3 text-base flex-1">Build your entire term in seconds, not hours</Text>
                                            </View>
                                            <View className="flex-row items-center mb-5">
                                                <Ionicons name="calendar-outline" size={24} color="#4ade80" />
                                                <Text className="text-white font-bold ml-3 text-base flex-1">Never miss an assignment or class again</Text>
                                            </View>
                                            <View className="flex-row items-center">
                                                <Ionicons name="shield-checkmark" size={24} color="#4ade80" />
                                                <Text className="text-white font-bold ml-3 text-base flex-1">100% ad-free, uninterrupted focus</Text>
                                            </View>
                                        </View>

                                        {/* Pricing Selector */}
                                        <View className="flex-row justify-between mb-4">
                                            {/* Annual */}
                                            <TouchableOpacity 
                                                onPress={() => setSelectedPlan('annual')}
                                                className={`flex-1 rounded-2xl p-4 mr-2 border-2 ${selectedPlan === 'annual' ? 'border-indigo-400 bg-indigo-500/20' : 'border-white/10 bg-black/40'}`}
                                            >
                                                <Text className="text-white font-bold text-lg">Annual</Text>
                                                <Text className="text-indigo-300 font-extrabold text-xl my-1">{annualPriceStr}<Text className="text-sm font-normal text-slate-300">/yr</Text></Text>
                                                <Text className="text-emerald-400 text-xs font-bold">Only ₱20.83/mo</Text>
                                            </TouchableOpacity>

                                            {/* Monthly */}
                                            <TouchableOpacity 
                                                onPress={() => setSelectedPlan('monthly')}
                                                className={`flex-1 rounded-2xl p-4 ml-2 border-2 ${selectedPlan === 'monthly' ? 'border-indigo-400 bg-indigo-500/20' : 'border-white/10 bg-black/40'}`}
                                            >
                                                <Text className="text-white font-bold text-lg">Monthly</Text>
                                                <Text className="text-indigo-300 font-extrabold text-xl my-1">{monthlyPriceStr}<Text className="text-sm font-normal text-slate-300">/mo</Text></Text>
                                                <Text className="text-slate-400 text-xs font-semibold">Billed monthly</Text>
                                            </TouchableOpacity>
                                        </View>

                                        <Text className="text-slate-300 text-center text-xs mb-6 px-4">
                                            {selectedPlan === 'annual' ? `${annualPriceStr}/year` : `${monthlyPriceStr}/month`}. Cancel anytime, no commitment.
                                        </Text>

                                        <TouchableOpacity 
                                            className={`py-4 rounded-full flex-row items-center justify-center shadow-lg mb-4 ${loading ? 'bg-indigo-400' : 'bg-indigo-500 shadow-indigo-500/50'}`}
                                            onPress={handlePurchase}
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <ActivityIndicator color="white" />
                                            ) : (
                                                <>
                                                    <Text className="text-white font-extrabold text-lg tracking-wider mr-2">
                                                        {selectedPlan === 'annual' ? `Upgrade for ${annualPriceStr}` : `Upgrade for ${monthlyPriceStr}`}
                                                    </Text>
                                                    <Ionicons name="chevron-forward" size={20} color="white" />
                                                </>
                                            )}
                                        </TouchableOpacity>

                                        <TouchableOpacity 
                                            className="py-2 items-center justify-center"
                                            onPress={handleRestore}
                                            disabled={loading}
                                        >
                                            <Text className="text-indigo-300 font-bold text-sm">
                                                Restore Purchases
                                            </Text>
                                        </TouchableOpacity>

                                        <Text className="text-[10px] text-slate-400 text-center mt-4 px-4 leading-4">
                                            By upgrading, you agree to our{' '}
                                            <Text 
                                                className="text-indigo-400 underline" 
                                                onPress={() => {
                                                    onClose();
                                                    router.push('/terms');
                                                }}
                                            >
                                                Terms of Service
                                            </Text>{' '}
                                            and{' '}
                                            <Text 
                                                className="text-indigo-400 underline" 
                                                onPress={() => WebBrowser.openBrowserAsync('https://www.freeprivacypolicy.com/live/19538461-5bec-44dd-b1fc-a7eda546e0fd')}
                                            >
                                                Privacy Policy
                                            </Text>. Subscriptions automatically renew unless canceled.
                                        </Text>
                                    </>
                                )}
                            </ScrollView>
                        </BlurView>
                    </ImageBackground>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    textShadow: {
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    }
});
