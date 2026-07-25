import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ImageBackground, Dimensions, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import Purchases, { PurchasesPackage } from 'react-native-purchases';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function PremiumPaywallModal({ visible, onClose }: { visible: boolean, onClose: () => void }) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const [loading, setLoading] = useState(false);
    const [currentPackage, setCurrentPackage] = useState<PurchasesPackage | null>(null);

    useEffect(() => {
        if (visible) {
            const fetchOfferings = async () => {
                try {
                    const offerings = await Purchases.getOfferings();
                    if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
                        setCurrentPackage(offerings.current.availablePackages[0]);
                    }
                } catch (e) {
                    console.error("Error fetching offerings", e);
                }
            };
            fetchOfferings();
        }
    }, [visible]);

    const handlePurchase = async () => {
        if (!currentPackage) {
            alert('Error: Purchases are not configured yet. Add your API key and setup RevenueCat offerings.');
            return;
        }
        setLoading(true);
        try {
            const { customerInfo } = await Purchases.purchasePackage(currentPackage);
            if (typeof customerInfo.entitlements.active['Premium'] !== "undefined") {
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

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-end bg-black/60">
                <TouchableOpacity className="absolute inset-0" onPress={onClose} activeOpacity={1} />
                
                <View className="w-full rounded-t-3xl overflow-hidden border-t border-white/20" style={{ height: SCREEN_HEIGHT * 0.75 }}>
                    <ImageBackground 
                        source={require('../assets/images/GlassBg.png')} 
                        style={{ flex: 1 }}
                        resizeMode="cover"
                    >
                        <BlurView intensity={90} tint="dark" style={{ flex: 1 }}>
                            <View className="flex-1 p-6 items-center pt-10">
                                {/* Close Button */}
                                <TouchableOpacity 
                                    className="absolute top-4 right-4 w-10 h-10 rounded-full items-center justify-center bg-white/10 border border-white/20"
                                    onPress={onClose}
                                    disabled={loading}
                                >
                                    <Ionicons name="close" size={24} color="#ffffff" />
                                </TouchableOpacity>

                                {/* Premium Icon */}
                                <View className="w-24 h-24 rounded-full bg-indigo-500/20 items-center justify-center mb-6 border-2 border-indigo-400/50">
                                    <Ionicons name="diamond" size={48} color="#a5b4fc" />
                                </View>

                                <Text className="text-3xl font-extrabold text-white text-center mb-4" style={styles.textShadow}>
                                    Unlock Fin Premium
                                </Text>
                                
                                <Text className="text-base text-center text-slate-200 font-semibold mb-8 px-4" style={styles.textShadow}>
                                    Get exclusive access to the AI Schedule Scanner and let Fin build your timetable for you in seconds.
                                </Text>

                                <View className="w-full bg-black/40 rounded-3xl p-6 mb-8 border border-white/10">
                                    <View className="flex-row items-center mb-5">
                                        <Ionicons name="checkmark-circle" size={24} color="#4ade80" />
                                        <Text className="text-white font-bold ml-3 text-base">Unlimited AI Image Scanning</Text>
                                    </View>
                                    <View className="flex-row items-center mb-5">
                                        <Ionicons name="checkmark-circle" size={24} color="#4ade80" />
                                        <Text className="text-white font-bold ml-3 text-base">Auto-Populate Timetables</Text>
                                    </View>
                                    <View className="flex-row items-center">
                                        <Ionicons name="checkmark-circle" size={24} color="#4ade80" />
                                        <Text className="text-white font-bold ml-3 text-base">Ad-Free Experience</Text>
                                    </View>
                                </View>

                                <TouchableOpacity 
                                    className={`w-full py-4 rounded-full items-center justify-center shadow-lg ${loading ? 'bg-indigo-400' : 'bg-indigo-500 shadow-indigo-500/50'}`}
                                    onPress={handlePurchase}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text className="text-white font-extrabold text-lg tracking-wider">
                                            {currentPackage ? `UPGRADE FOR ${currentPackage.product.priceString}` : 'UPGRADE TO PREMIUM'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
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
