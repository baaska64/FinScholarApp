import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated } from 'react-native';
import { useColorScheme } from 'nativewind';
import { BlurView } from 'expo-blur';

type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type AlertOptions = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
};

class AlertManager {
  private listener: ((options: AlertOptions | null) => void) | null = null;

  setListener(listener: (options: AlertOptions | null) => void) {
    this.listener = listener;
  }

  alert(title: string, message?: string, buttons?: AlertButton[]) {
    if (this.listener) {
      this.listener({ title, message, buttons: buttons || [{ text: 'OK' }] });
    } else {
      // Fallback if not mounted
      console.warn("CustomAlert not mounted. Alert:", title, message);
    }
  }
  
  close() {
    if (this.listener) {
      this.listener(null);
    }
  }
}

export const AlertService = new AlertManager();

export const CustomAlertProvider = () => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [config, setConfig] = useState<AlertOptions | null>(null);
  const [visible, setVisible] = useState(false);
  
  const [scaleValue] = useState(new Animated.Value(0.9));
  const [opacityValue] = useState(new Animated.Value(0));

  useEffect(() => {
    AlertService.setListener((options) => {
      if (options) {
        setConfig(options);
        setVisible(true);
        Animated.parallel([
          Animated.spring(scaleValue, {
            toValue: 1,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.timing(opacityValue, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        closeModal();
      }
    });
    return () => AlertService.setListener(() => {});
  }, []);

  const closeModal = (onCloseCompleted?: () => void) => {
    Animated.parallel([
      Animated.timing(scaleValue, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityValue, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setConfig(null);
      if (onCloseCompleted) {
        // use a small timeout to allow modal to unmount before heavy tasks
        setTimeout(onCloseCompleted, 10);
      }
    });
  };

  if (!visible || !config) return null;

  const buttons = config.buttons || [{ text: 'OK' }];

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={() => closeModal()}>
      <View className="flex-1 justify-center items-center px-6">
        <Animated.View 
            className="absolute inset-0"
            style={{ opacity: opacityValue, backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)' }}
        >
            <BlurView intensity={isDark ? 80 : 50} tint={isDark ? 'dark' : 'light'} style={{ flex: 1 }} />
        </Animated.View>

        <Animated.View 
          style={{
            opacity: opacityValue,
            transform: [{ scale: scaleValue }],
          }}
          className={`w-full max-w-sm rounded-[28px] overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-white shadow-2xl shadow-indigo-900/20'}`}
        >
          <View className="p-6 items-center">
            <Text className={`font-nunito-black text-xl text-center mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {config.title}
            </Text>
            {!!config.message && (
              <Text className={`font-nunito text-base text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {config.message}
              </Text>
            )}
          </View>

          <View className={`${buttons.length > 2 ? 'flex-col' : 'flex-row'} border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
            {buttons.map((btn, index) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              
              let textColorClass = isDark ? 'text-indigo-400' : 'text-indigo-600';
              if (isDestructive) textColorClass = 'text-red-500';
              if (isCancel) textColorClass = isDark ? 'text-slate-400' : 'text-slate-500';
              
              const isLast = index === buttons.length - 1;
              const isStacked = buttons.length > 2;
              
              let borderClass = '';
              if (isStacked) {
                  borderClass = !isLast ? (isDark ? 'border-b border-slate-700' : 'border-b border-slate-100') : '';
              } else {
                  borderClass = !isLast ? (isDark ? 'border-r border-slate-700' : 'border-r border-slate-100') : '';
              }

              return (
                <TouchableOpacity
                  key={index}
                  className={`${isStacked ? 'w-full' : 'flex-1'} py-4 items-center justify-center ${borderClass}`}
                  onPress={() => {
                    closeModal(() => {
                      if (btn.onPress) btn.onPress();
                    });
                  }}
                >
                  <Text className={`font-nunito-bold text-base ${textColorClass}`}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};
