export const Platform = {
  OS: 'android',
  select: (objs) => objs ? (objs.android !== undefined ? objs.android : (objs.default !== undefined ? objs.default : {})) : {},
};

export const Appearance = {
  getColorScheme: () => 'light',
};

export default {
  Platform,
  Appearance,
};
