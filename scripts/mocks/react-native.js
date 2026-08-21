export const Platform = {
  OS: 'android',
  select: (objs) => objs ? (objs.android !== undefined ? objs.android : (objs.default !== undefined ? objs.default : {})) : {},
};

export const Appearance = {
  getColorScheme: () => 'light',
};

export const AppState = {
  addEventListener: () => ({ remove: () => {} }),
  currentState: 'active',
};

export const Vibration = {
  vibrate: () => {},
  cancel: () => {},
};

export const UIManager = {
  setLayoutAnimationEnabledExperimental: () => {},
};

export const LayoutAnimation = {
  configureNext: () => {},
  Presets: {
    easeInEaseOut: {},
    linear: {},
    spring: {},
  },
};

export default {
  Platform,
  Appearance,
  AppState,
  Vibration,
  UIManager,
  LayoutAnimation,
};


