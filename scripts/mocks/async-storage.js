const store = new Map();

export const AsyncStorage = {
  getItem: async (key) => store.get(key) ?? null,
  setItem: async (key, value) => { store.set(key, String(value)); },
  removeItem: async (key) => { store.delete(key); },
  clear: async () => { store.clear(); },
  _reset: () => { store.clear(); },
};

export default AsyncStorage;
