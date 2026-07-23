import React, { useEffect, useRef } from 'react';
import { Animated, Image, ImageSourcePropType, ViewStyle, StyleProp } from 'react-native';

interface FinAvatarProps {
  source?: ImageSourcePropType;
  size?: number;
  floating?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function FinAvatar({
  source = require('../../assets/images/FinLogo.png'),
  size = 100,
  floating = true,
  style,
}: FinAvatarProps) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!floating) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -6,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [floating]);

  return (
    <Animated.View style={[{ transform: [{ translateY }] }, style]}>
      <Image
        source={source}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}
