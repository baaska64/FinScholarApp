let lastReplacedRoute = null;
let lastPushedRoute = null;

export const router = {
  replace: (route) => {
    lastReplacedRoute = route;
  },
  push: (route) => {
    lastPushedRoute = route;
  },
  back: () => {},
  _getLastReplaced: () => lastReplacedRoute,
  _getLastPushed: () => lastPushedRoute,
  _reset: () => {
    lastReplacedRoute = null;
    lastPushedRoute = null;
  },
};

export const useLocalSearchParams = () => ({});
export const useRouter = () => router;

export default {
  router,
  useLocalSearchParams,
  useRouter,
};
