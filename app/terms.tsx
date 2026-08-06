import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';

export default function TermsOfServiceScreen() {
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
        <SafeAreaView className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
            <View className="flex-row items-center p-4 border-b border-slate-200 dark:border-slate-800">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <Ionicons name="arrow-back" size={24} color={isDark ? 'white' : 'black'} />
                </TouchableOpacity>
                <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Terms of Service</Text>
            </View>
            <ScrollView className="p-4 mb-8">
                <Text className={`text-sm mb-4 font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Last Updated: August 2026
                </Text>
                
                <Text className={`text-base mb-4 leading-6 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Welcome to FinScholar! By using our application, you agree to comply with and be bound by the following terms and conditions. Please review them carefully.
                </Text>

                <Text className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>1. Acceptance of Terms</Text>
                <Text className={`text-base mb-6 leading-6 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    By accessing or using FinScholar, you agree to these Terms of Service. If you do not agree to all of these terms, do not use the service.
                </Text>

                <Text className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>2. Subscriptions and Payments (Fin Premium)</Text>
                <Text className={`text-base mb-6 leading-6 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Certain features of the app, such as AI Image Scanning and auto-populating timetables, require a "Fin Premium" subscription. 
                    Payment will be charged to your Apple ID or Google Play account at the confirmation of purchase. Subscriptions automatically renew unless canceled at least 24 hours before the end of the current period.
                    You can manage and cancel your subscriptions by going to your account settings on the App Store or Google Play Store after purchase.
                </Text>

                <Text className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>3. AI Scanning Accuracy</Text>
                <Text className={`text-base mb-6 leading-6 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    FinScholar provides AI-powered syllabus and schedule scanning. While we strive for high accuracy, we do not guarantee that the AI will perfectly extract all details from every image. Users are expected to verify their schedules and academic data manually after scanning.
                </Text>

                <Text className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>4. User Data and Privacy</Text>
                <Text className={`text-base mb-6 leading-6 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Your privacy is important to us. FinScholar processes your data, including schedules and grades, strictly to provide the app's functionality. For more details, please review our Privacy Policy. You remain the owner of any data you input into the app.
                </Text>

                <Text className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>5. Termination</Text>
                <Text className={`text-base mb-12 leading-6 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    We reserve the right to suspend or terminate your access to the app at our sole discretion, without notice or liability, for any reason, including if you breach these Terms.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}
