/**
 * spotlightGeometry.ts
 *
 * Pure layout maths for the guided tour overlay: how far to inflate the
 * highlight around a measured control, and where the coaching card should sit
 * so it never runs off-screen or under a notch. Kept free of React so it can
 * be tested directly.
 */

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface EdgeInsets {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

export interface Size {
    width: number;
    height: number;
}

export type TooltipPlacement = 'above' | 'below' | 'center';

/** Breathing room drawn around the highlighted control. */
export const SPOTLIGHT_PADDING = 8;
/** Gap between the highlight and the coaching card. */
export const TOOLTIP_GAP = 14;
/** Minimum distance the card keeps from the screen edges. */
export const SCREEN_MARGIN = 16;
/** Width of the little triangle pointing at the highlighted control. */
export const ARROW_SIZE = 14;

function clamp(value: number, min: number, max: number): number {
    if (max < min) return min;
    return Math.min(Math.max(value, min), max);
}

/**
 * Grows a measured rect by `padding` on every side, then clamps it back inside
 * the screen so the highlight never bleeds off the edge.
 */
export function inflateRect(rect: Rect, padding: number, bounds: Size): Rect {
    const x = Math.max(0, rect.x - padding);
    const y = Math.max(0, rect.y - padding);
    const right = Math.min(bounds.width, rect.x + rect.width + padding);
    const bottom = Math.min(bounds.height, rect.y + rect.height + padding);
    return {
        x,
        y,
        width: Math.max(0, right - x),
        height: Math.max(0, bottom - y),
    };
}

/** A measurement is only usable once the view has actually been laid out. */
export function isMeasurableRect(rect: Rect | null | undefined): rect is Rect {
    if (!rect) return false;
    const { x, y, width, height } = rect;
    if (![x, y, width, height].every((n) => typeof n === 'number' && Number.isFinite(n))) return false;
    return width > 0 && height > 0;
}

export interface TooltipLayoutParams {
    /** The already-inflated highlight, or null for an unanchored step. */
    target: Rect | null;
    screen: Size;
    insets: EdgeInsets;
    tooltipHeight: number;
}

export interface TooltipLayout {
    placement: TooltipPlacement;
    top: number;
    left: number;
    width: number;
    /** Offset of the arrow within the card, or null when there is nothing to point at. */
    arrowLeft: number | null;
}

/**
 * Places the coaching card above or below the highlight — whichever side has
 * room — falling back to the roomier side when neither fits outright, and to
 * the centre of the screen when the step has no anchor at all.
 */
export function resolveTooltipLayout({
    target,
    screen,
    insets,
    tooltipHeight,
}: TooltipLayoutParams): TooltipLayout {
    const left = SCREEN_MARGIN + insets.left;
    const width = Math.max(0, screen.width - left - SCREEN_MARGIN - insets.right);

    const minTop = insets.top + SCREEN_MARGIN;
    const maxTop = Math.max(minTop, screen.height - insets.bottom - SCREEN_MARGIN - tooltipHeight);

    if (!isMeasurableRect(target)) {
        return {
            placement: 'center',
            top: clamp((screen.height - tooltipHeight) / 2, minTop, maxTop),
            left,
            width,
            arrowLeft: null,
        };
    }

    const targetBottom = target.y + target.height;
    const spaceBelow = screen.height - insets.bottom - SCREEN_MARGIN - targetBottom - TOOLTIP_GAP;
    const spaceAbove = target.y - insets.top - SCREEN_MARGIN - TOOLTIP_GAP;

    let placement: TooltipPlacement;
    if (spaceBelow >= tooltipHeight) placement = 'below';
    else if (spaceAbove >= tooltipHeight) placement = 'above';
    else placement = spaceBelow >= spaceAbove ? 'below' : 'above';

    const rawTop =
        placement === 'below'
            ? targetBottom + TOOLTIP_GAP
            : target.y - TOOLTIP_GAP - tooltipHeight;
    const top = clamp(rawTop, minTop, maxTop);

    // Point the arrow at the middle of the control, but keep it inside the card.
    const targetCentre = target.x + target.width / 2;
    const arrowLeft = clamp(
        targetCentre - left - ARROW_SIZE / 2,
        SCREEN_MARGIN,
        Math.max(SCREEN_MARGIN, width - SCREEN_MARGIN - ARROW_SIZE)
    );

    // Hide the arrow when the card had to slide away from the control.
    const settledOnRequestedSide = Math.abs(top - rawTop) < 1;

    return {
        placement,
        top,
        left,
        width,
        arrowLeft: settledOnRequestedSide ? arrowLeft : null,
    };
}

/** Corner radius for the highlight ring, matching the shape of the control. */
export function highlightRadius(rect: Rect, shape: 'rect' | 'circle' | 'pill'): number {
    if (shape === 'circle') return Math.max(rect.width, rect.height) / 2;
    if (shape === 'pill') return rect.height / 2;
    return 18;
}
