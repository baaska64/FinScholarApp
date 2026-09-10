export let lastWidgetUpdateConfig = null;
/** Every config from the current handler run — the app draws five widgets per update. */
export const widgetUpdateConfigs = [];

export const requestWidgetUpdate = (config) => {
  lastWidgetUpdateConfig = config;
  widgetUpdateConfigs.push(config);
  return Promise.resolve(config);
};

export const resetWidgetUpdates = () => {
  lastWidgetUpdateConfig = null;
  widgetUpdateConfigs.length = 0;
};

export const FlexWidget = (props) => ({ type: 'FlexWidget', props, children: props.children });
export const TextWidget = (props) => ({ type: 'TextWidget', props });
export const ImageWidget = (props) => ({ type: 'ImageWidget', props });
export const SvgWidget = (props) => ({ type: 'SvgWidget', props });
export const OverlapWidget = (props) => ({ type: 'OverlapWidget', props, children: props.children });
export const IconWidget = (props) => ({ type: 'IconWidget', props });
export const ListWidget = (props) => ({ type: 'ListWidget', props, children: props.children });

export default {
  requestWidgetUpdate,
  resetWidgetUpdates,
  FlexWidget,
  TextWidget,
  ImageWidget,
  SvgWidget,
  OverlapWidget,
  IconWidget,
  ListWidget,
};
