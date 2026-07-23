import React, { useRef } from 'react';
import { Animated, TouchableOpacity, TouchableOpacityProps, StyleProp, ViewStyle } from 'react-native';

interface AnimatedPressableProps extends TouchableOpacityProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  useSpring?: boolean;
}

export default function AnimatedPressable({
  children,
  style,
  scaleTo = 0.96,
  useSpring = true,
  ...props
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = (e: any) => {
    if (useSpring) {
      Animated.spring(scale, {
        toValue: scaleTo,
        useNativeDriver: true,
        friction: 8,
      }).start();
    } else {
      Animated.timing(scale, {
        toValue: scaleTo,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }
    props.onPressIn?.(e);
  };

  const onPressOut = (e: any) => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
    }).start();
    props.onPressOut?.(e);
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        {...props}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={style}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}
