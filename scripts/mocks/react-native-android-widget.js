export let lastWidgetUpdateConfig = null;

export const requestWidgetUpdate = (config) => {
  lastWidgetUpdateConfig = config;
  return Promise.resolve(config);
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
  FlexWidget,
  TextWidget,
  ImageWidget,
  SvgWidget,
  OverlapWidget,
  IconWidget,
  ListWidget,
};
