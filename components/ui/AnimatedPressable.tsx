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

  // Extract flex from style so the outer Animated.View participates in flex layout
  const flatStyle = style ? (Array.isArray(style) ? Object.assign({}, ...style) : style) as any : {};
  const { flex, flexGrow, flexShrink, flexBasis, alignSelf, width, minWidth, maxWidth } = flatStyle;
  const outerLayoutStyle: any = { transform: [{ scale }] };
  if (flex !== undefined) outerLayoutStyle.flex = flex;
  if (flexGrow !== undefined) outerLayoutStyle.flexGrow = flexGrow;
  if (flexShrink !== undefined) outerLayoutStyle.flexShrink = flexShrink;
  if (flexBasis !== undefined) outerLayoutStyle.flexBasis = flexBasis;
  if (alignSelf !== undefined) outerLayoutStyle.alignSelf = alignSelf;
  if (width !== undefined) outerLayoutStyle.width = width;
  if (minWidth !== undefined) outerLayoutStyle.minWidth = minWidth;
  if (maxWidth !== undefined) outerLayoutStyle.maxWidth = maxWidth;

  // The outer view now carries the flex, so the inner one must not also shrink
  // its own content box. RN's `flex: N` shorthand means `flexBasis: 0`, and a
  // nested view with it measures its children as zero height — the padding and
  // border still paint, so the control looks right but its text is clipped away
  // entirely. Growing with an `auto` basis gives the same layout and keeps the
  // children measurable.
  const innerFlexReset =
    flex !== undefined || flexBasis !== undefined
      ? { flex: undefined, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' as const }
      : null;

  return (
    <Animated.View style={outerLayoutStyle}>
      <TouchableOpacity
        activeOpacity={1}
        {...props}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[style, innerFlexReset]}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}
