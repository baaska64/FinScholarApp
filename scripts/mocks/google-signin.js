export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
};

export const isErrorWithCode = (err) => {
  return typeof err === 'object' && err !== null && 'code' in err;
};

export const isSuccessResponse = (response) => {
  return typeof response === 'object' && response !== null && response.type === 'success' && 'data' in response;
};

let mockConfig = {};
let mockHasPlayServicesHandler = async () => true;
let mockSignInHandler = async () => ({
  type: 'success',
  data: {
    idToken: 'mock-google-id-token',
    user: {
      id: 'mock-user-id',
      name: 'Test Student',
      email: 'student@university.edu',
    },
  },
});

export const GoogleSignin = {
  configure: (config) => {
    mockConfig = config;
  },
  hasPlayServices: async (options) => {
    return mockHasPlayServicesHandler(options);
  },
  signIn: async () => {
    return mockSignInHandler();
  },
  signOut: async () => {},
  revokeAccess: async () => {},
  _getLastConfig: () => mockConfig,
  _setHasPlayServicesHandler: (fn) => {
    mockHasPlayServicesHandler = fn;
  },
  _setSignInHandler: (fn) => {
    mockSignInHandler = fn;
  },
  _reset: () => {
    mockConfig = {};
    mockHasPlayServicesHandler = async () => true;
    mockSignInHandler = async () => ({
      type: 'success',
      data: {
        idToken: 'mock-google-id-token',
        user: {
          id: 'mock-user-id',
          name: 'Test Student',
          email: 'student@university.edu',
        },
      },
    });
  },
};

export default {
  statusCodes,
  isErrorWithCode,
  isSuccessResponse,
  GoogleSignin,
};
