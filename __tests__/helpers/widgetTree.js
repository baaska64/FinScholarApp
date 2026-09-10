/**
 * Tree helpers for the widget suites.
 *
 * Widgets are pure functions returning the library's element tree, so a suite
 * can measure a layout without rendering anything. `requiredHeight` reproduces
 * how Android lays a LinearLayout out — fixed heights, padding and margins add
 * up in a column and take the max in a row — which is what lets the suites
 * assert a widget never composes taller than the box it was given.
 */

export function childrenOf(node) {
  if (!node || !node.props) return [];
  const kids = node.props.children;
  if (Array.isArray(kids)) return kids.flat(Infinity).filter(Boolean);
  return kids ? [kids] : [];
}

export function typeOf(node) {
  if (!node) return '';
  return typeof node.type === 'string' ? node.type : node.type?.name ?? '';
}

/**
 * Unwraps component elements until a library widget is reached — the same walk
 * `buildWidgetTree` does before it converts props, so a suite sees the layout
 * the renderer sees rather than an unresolved `<FinScholarWidget />`.
 */
export function resolve(element) {
  let node = element;
  let guard = 0;
  while (node && typeof node.type === 'function' && !node.type.__name__ && guard < 20) {
    node = node.type(node.props);
    guard++;
  }
  return node;
}

export function walk(node, visit) {
  if (!node) return;
  visit(node);
  childrenOf(node).forEach((child) => walk(child, visit));
}

export function collect(node, predicate) {
  const found = [];
  walk(node, (n) => {
    if (predicate(n)) found.push(n);
  });
  return found;
}

export function textNodes(node) {
  return collect(node, (n) => typeOf(n) === 'TextWidget');
}

export function texts(node) {
  return textNodes(node).map((n) => n.props.text);
}

function verticalPadding(style) {
  let top = 0;
  let bottom = 0;
  if (style.padding != null) {
    top = style.padding;
    bottom = style.padding;
  }
  if (style.paddingVertical != null) {
    top = style.paddingVertical;
    bottom = style.paddingVertical;
  }
  if (style.paddingTop != null) top = style.paddingTop;
  if (style.paddingBottom != null) bottom = style.paddingBottom;
  return top + bottom;
}

export function verticalMargin(style) {
  let top = 0;
  let bottom = 0;
  if (style.margin != null) {
    top = style.margin;
    bottom = style.margin;
  }
  if (style.marginVertical != null) {
    top = style.marginVertical;
    bottom = style.marginVertical;
  }
  if (style.marginTop != null) top = style.marginTop;
  if (style.marginBottom != null) bottom = style.marginBottom;
  return top + bottom;
}

/**
 * Height the node needs, in dp. Text without an explicit height is estimated at
 * 1.45x its font size — comfortably above Nunito's ~1.36 line box, so the bound
 * errs towards catching an overflow rather than missing one.
 */
export function requiredHeight(node) {
  if (!node) return 0;
  const style = node.props?.style ?? {};
  const margin = verticalMargin(style);

  if (typeof style.height === 'number') return style.height + margin;

  const kids = childrenOf(node);
  if (kids.length === 0) {
    if (typeOf(node) === 'TextWidget') {
      return Math.ceil((style.fontSize ?? 12) * 1.45) + margin;
    }
    return margin;
  }

  const isRow = style.flexDirection === 'row';
  const inner = isRow
    ? Math.max(...kids.map(requiredHeight))
    : kids.reduce((sum, kid) => sum + requiredHeight(kid), 0);

  return inner + verticalPadding(style) + margin;
}

/** Every numeric style value in the tree, for NaN/negative sweeps. */
export function styleNumbers(node) {
  const values = [];
  walk(node, (n) => {
    const style = n.props?.style ?? {};
    Object.entries(style).forEach(([key, value]) => {
      if (typeof value === 'number') values.push([key, value]);
    });
  });
  return values;
}
