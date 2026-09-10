import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, useWindowDimensions, Animated, Easing, PanResponder } from 'react-native';
import { getClassColor, getTheme } from '@/constants/Theme';
import { SNAP_MINUTES, resolveBlockMove, resolveBlockResize } from '@/utils/quickEdit';
import { Ionicons } from '@expo/vector-icons';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const getHourHeight = (isExport: boolean) => isExport ? 160 : 90;
const getTimeColWidth = (isExport: boolean) => isExport ? 70 : 44;
// Responsive day column width: fit all visible days within screen
const getDayWidth = (numDays: number, isExport: boolean, screenWidth: number) => {
    if (isExport) return 420;
    const available = screenWidth - getTimeColWidth(false) - 32;
    const fitWidth = Math.floor(available / numDays);
    return Math.max(200, Math.min(fitWidth, 260)); // Extra wide cells for landscape feel
};

const TYPOGRAPHY = {
  subjectTitle: { fontSize: 13, fontWeight: '700', lineHeight: 16 },
  time: { fontSize: 10, fontWeight: '500' }
};

const getThemeStyles = (isDark: boolean, isExportMode: boolean) => ({
  gridBg: isDark ? '#0F172A' : '#FCFCFD',
  headerBg: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF',
  hourBg: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF', 
  gridLine: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
  textColor: isDark ? '#F8FAFC' : '#1E293B',
  timeTextColor: isDark ? '#94A3B8' : '#64748B',
  outerBorderColor: isDark ? '#3B82F6' : '#60A5FA',
  borderWidth: 1, 
  outerBorderWidth: isExportMode ? 0 : 3,
  borderRadius: isExportMode ? 0 : 20,
});

const getRoomForClass = (cls: any, allClasses: any[]) => {
  if (!cls.room) return null;
  const rooms = cls.room.split(',').map((r: string) => r.trim()).filter(Boolean);
  if (rooms.length <= 1) return cls.room;
  
  if (!allClasses) return rooms[0];

  const siblings = allClasses
    .filter((c: any) => c.name === cls.name)
    .sort((a: any, b: any) => {
      const wa = a.day === 6 ? -1 : a.day;
      const wb = b.day === 6 ? -1 : b.day;
      if (wa !== wb) return wa - wb;
      return a.startHour - b.startHour;
    });
    
  const idx = siblings.findIndex((c: any) => c.id === cls.id);
  if (idx === -1) return rooms[0];
  return rooms[idx % rooms.length];
};

const ClassBlock = memo(({
  cls, isDark, isQuickEditMode, isSelected, onToggleSelect,
  onPressClass, START_HOUR, END_HOUR, displayDayIndices, dayWidth, isExportMode = false, zoomScale = 1,
  appearIndex = 0, appearToken = 0,
  onDragStateChange, onDragPreview, onCommitDrag, dragScroll
}: any) => {
  // Solid fill in both themes: a wash over grid lines reads as a smudge.
  const color = getClassColor(cls.colorIdx, isExportMode ? isDark : isDark);
  const z = isExportMode ? 1 : zoomScale;

  // Blocks drop in one after another when a scan fills the timetable, so the
  // result reads as "these were just added" rather than appearing all at once.
  const reveal = useRef(new Animated.Value(appearToken ? 0 : 1)).current;
  useEffect(() => {
    if (isExportMode || !appearToken) {
      reveal.setValue(1);
      return;
    }
    reveal.setValue(0);
    const anim = Animated.timing(reveal, {
      toValue: 1,
      duration: 320,
      delay: Math.min(appearIndex * 55, 1600),
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [appearToken, appearIndex, isExportMode]);

  const hourHeight = getHourHeight(isExportMode) * z;

  // ── Direct manipulation ───────────────────────────────────────────────────
  // Moving a block used to mean tapping the nudge buttons: shifting a class by
  // two and a half hours was thirty taps at five minutes each. Press and hold
  // to pick a block up, then drag it to any day and time; drag the bottom edge
  // to change how long it runs. Both snap to the same five-minute grid.
  //
  // RN's own PanResponder, not a gesture library: the project has no
  // react-native-gesture-handler and adding one means a dev-client rebuild.
  const [mode, setMode] = useState<null | 'lifted' | 'move' | 'resize'>(null);
  /**
   * The slot the block is drawn in while a drag is in flight *and* while the
   * commit is settling.
   *
   * The first version animated the block with a translate and zeroed it on
   * release. That zeroed the offset a frame or two before the parent's state
   * update came back with the new day and hour, so every drop visibly snapped
   * back to where it started and then jumped to its destination. Holding the
   * dropped slot here until the props agree removes the in-between frame
   * entirely — and because the drag snaps, this re-renders only when the block
   * crosses into a new slot, not on every touch event.
   */
  const [ghost, setGhost] = useState<null | { day: number; startHour: number; duration: number }>(null);
  const lift = useRef(new Animated.Value(1)).current;

  const shown = ghost || cls;
  const top = (shown.startHour - START_HOUR) * hourHeight + (10 * z);
  const height = shown.duration * hourHeight;
  const blockWidth = (dayWidth - (4 * z)) / (cls.maxCol || 1);
  const shownDayIdx = displayDayIndices.indexOf(shown.day);
  const left = (shownDayIdx < 0 ? 0 : shownDayIdx) * dayWidth + ((ghost ? 0 : (cls.col || 0)) * blockWidth);

  // Once the ledger agrees with the dropped slot, stop overriding.
  useEffect(() => {
    if (!ghost) return;
    const settled =
      cls.day === ghost.day &&
      Math.abs(cls.startHour - ghost.startHour) < 1e-6 &&
      Math.abs(cls.duration - ghost.duration) < 1e-6;
    if (settled) {
      setGhost(null);
      return;
    }
    // If the update never arrives — a rejected edit, a reload — do not leave
    // the block stranded in a slot the data does not have.
    const bail = setTimeout(() => setGhost(null), 800);
    return () => clearTimeout(bail);
  }, [cls.day, cls.startHour, cls.duration, ghost]);

  // PanResponder is created once, so its handlers would close over the first
  // render's props. Everything they read lives here instead.
  const latest = useRef<any>({});
  latest.current = {
    cls, dayWidth, hourHeight, START_HOUR, END_HOUR, displayDayIndices, z,
    isQuickEditMode, onDragStateChange, onDragPreview, onCommitDrag, dragScroll,
  };
  const modeRef = useRef<null | 'lifted' | 'move' | 'resize'>(null);
  const gestureRef = useRef({ dx: 0, dy: 0 });

  const setDragMode = (next: null | 'lifted' | 'move' | 'resize') => {
    modeRef.current = next;
    setMode(next);
    Animated.spring(lift, {
      toValue: next === 'move' || next === 'resize' ? 1.04 : 1,
      friction: 7,
      useNativeDriver: true,
    }).start();
    latest.current.onDragStateChange?.(latest.current.cls.id, next === 'move' || next === 'resize');
  };

  const gridOf = (L: any) => ({
    dayWidth: L.dayWidth,
    hourHeight: L.hourHeight,
    dayCount: L.displayDayIndices.length,
    startHour: L.START_HOUR,
    endHour: L.END_HOUR,
  });

  /** Re-resolve the target slot. Also called by the auto-scroll ticker. */
  const applyMove = () => {
    const L = latest.current;
    const fromIdx = L.displayDayIndices.indexOf(L.cls.day);
    const { dayIndex, startHour } = resolveBlockMove(
      { dayIndex: fromIdx < 0 ? 0 : fromIdx, startHour: L.cls.startHour, duration: L.cls.duration },
      gestureRef.current.dx,
      // The grid may have auto-scrolled under the finger; that counts as
      // dragging further, or the block would slide out from under the touch.
      gestureRef.current.dy + (L.dragScroll?.delta() || 0),
      gridOf(L),
    );
    const day = L.displayDayIndices[dayIndex];
    const next = { day, startHour, duration: L.cls.duration };
    setGhost((prev) =>
      prev && prev.day === next.day && prev.startHour === next.startHour && prev.duration === next.duration
        ? prev
        : next,
    );
    L.onDragPreview?.({ id: L.cls.id, ...next });
    return next;
  };

  const applyResize = () => {
    const L = latest.current;
    const duration = resolveBlockResize(
      { startHour: L.cls.startHour, duration: L.cls.duration },
      gestureRef.current.dy + (L.dragScroll?.delta() || 0),
      { hourHeight: L.hourHeight, endHour: L.END_HOUR },
    );
    const next = { day: L.cls.day, startHour: L.cls.startHour, duration };
    setGhost((prev) => (prev && prev.duration === duration ? prev : next));
    L.onDragPreview?.({ id: L.cls.id, ...next });
    return next;
  };

  const endGesture = (committed: boolean) => {
    const L = latest.current;
    L.dragScroll?.end();
    L.onDragPreview?.(null);
    if (!committed) setGhost(null);
    setDragMode(null);
  };

  const movePan = useRef(
    PanResponder.create({
      // Never claim on touch-down — the grid's two ScrollViews have to keep
      // working. The block only takes the gesture once it has been picked up.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: () => modeRef.current === 'lifted' || modeRef.current === 'move',
      onPanResponderGrant: () => {
        gestureRef.current = { dx: 0, dy: 0 };
        latest.current.dragScroll?.begin(applyMove);
        setDragMode('move');
      },
      onPanResponderMove: (_e, g) => {
        gestureRef.current = { dx: g.dx, dy: g.dy };
        latest.current.dragScroll?.track(g.moveY);
        applyMove();
      },
      onPanResponderRelease: (_e, g) => {
        const L = latest.current;
        gestureRef.current = { dx: g.dx, dy: g.dy };
        const next = applyMove();
        const changed = next.day !== L.cls.day || Math.abs(next.startHour - L.cls.startHour) > 1e-6;
        if (changed) L.onCommitDrag?.(L.cls.id, { day: next.day, startHour: next.startHour });
        endGesture(changed);
      },
      onPanResponderTerminate: () => endGesture(false),
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const resizePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // Only a deliberate vertical drag on the handle counts, so a finger that
      // lands here on its way to scrolling still scrolls.
      onMoveShouldSetPanResponder: (_e, g) =>
        latest.current.isQuickEditMode && Math.abs(g.dy) > 3 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        gestureRef.current = { dx: 0, dy: 0 };
        latest.current.dragScroll?.begin(applyResize);
        setDragMode('resize');
      },
      onPanResponderMove: (_e, g) => {
        gestureRef.current = { dx: g.dx, dy: g.dy };
        latest.current.dragScroll?.track(g.moveY);
        applyResize();
      },
      onPanResponderRelease: (_e, g) => {
        const L = latest.current;
        gestureRef.current = { dx: g.dx, dy: g.dy };
        const next = applyResize();
        const changed = Math.abs(next.duration - L.cls.duration) > 1e-6;
        if (changed) L.onCommitDrag?.(L.cls.id, { duration: next.duration });
        endGesture(changed);
      },
      onPanResponderTerminate: () => endGesture(false),
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const isDragging = mode === 'move' || mode === 'resize';
  const canDrag = isQuickEditMode && !isExportMode;

    const formatH = (h: number) => {
      const totalMins = Math.round(h * 60);
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      const ampm = hrs >= 12 && hrs < 24 ? 'PM' : 'AM';
      const displayH = hrs > 12 ? hrs - 12 : (hrs === 0 ? 12 : hrs);
      return `${displayH}:${mins.toString().padStart(2, '0')} ${ampm}`;
    };

    const formatDuration = (dur: number) => {
      const totalMins = Math.round(dur * 60);
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      let str = '';
      if (hrs > 0) str += `${hrs}h`;
      if (mins > 0) str += `${hrs > 0 ? ' ' : ''}${mins}m`;
      return str || '0m';
    };

    const showTime = shown.duration >= 0.5;
    const showRoom = shown.duration >= 0.75;
    const showTeacher = shown.duration >= 1.0 && !!cls.instructor;
    const showDuration = shown.duration >= 1.25;

    return (
      <>
        {/* Where the block came from, while it is in the air. */}
        {isDragging && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: (cls.startHour - START_HOUR) * hourHeight + (10 * z),
              left: displayDayIndices.indexOf(cls.day) * dayWidth + ((cls.col || 0) * blockWidth),
              width: blockWidth,
              height: cls.duration * hourHeight,
              marginLeft: 2 * z,
              borderRadius: Math.max(6, 10 * z),
              borderWidth: 2, borderStyle: 'dashed',
              borderColor: color.solid,
              opacity: 0.5,
              zIndex: 5,
            }}
          />
        )}

        <Animated.View
          style={{
            position: 'absolute',
            top,
            left,
            width: blockWidth,
            height,
            zIndex: isDragging ? 999 : isSelected ? 100 : 10,
            opacity: reveal,
            transform: [
              { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
              { scale: lift },
              { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            ],
          }}
          {...(canDrag ? movePan.panHandlers : {})}
        >
        <TouchableOpacity
          activeOpacity={0.8}
          delayLongPress={180}
          onLongPress={() => {
            // Picking the block up is what arms the drag; until then the
            // gesture belongs to the ScrollViews.
            if (canDrag) setDragMode('lifted');
          }}
          onPressOut={() => {
            if (modeRef.current === 'lifted') setDragMode(null);
          }}
          onPress={() => {
            if (isQuickEditMode) {
              onToggleSelect(cls.id);
            } else {
              onPressClass(cls);
            }
          }}
          style={{
            flex: 1,
            backgroundColor: color.solid,
            // The app's tactile lip, not a cast shadow. Selection swaps it for
            // a full ring so the state is obvious at any zoom.
            borderWidth: isSelected || mode ? (isExportMode ? 3 : Math.max(2, 2 * z)) : 0,
            borderColor: mode ? '#ffffff' : isSelected ? (isDark ? '#ffffff' : '#0f172a') : 'transparent',
            borderBottomWidth: isSelected || mode ? (isExportMode ? 3 : Math.max(2, 2 * z)) : (isExportMode ? 4 : Math.max(2, 3 * z)),
            borderBottomColor: mode ? '#ffffff' : isSelected ? (isDark ? '#ffffff' : '#0f172a') : color.edge,
            borderRadius: isExportMode ? 14 : Math.max(6, 10 * z),
            marginLeft: 2 * z,
            marginRight: isExportMode ? 2 : 0,
            padding: isExportMode ? 12 : 8 * z,
            overflow: 'hidden',
          }}
        >
            {isSelected && !mode && (
                <View style={{ position: 'absolute', right: 4 * z, top: 4 * z, width: 16 * z, height: 16 * z, borderRadius: 8 * z, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                    <Ionicons name="checkmark" size={12 * z} color={color.solid} />
                </View>
            )}

            {/* Grip, shown once the block is held or being moved. */}
            {mode && (
                <View style={{ position: 'absolute', right: 4 * z, top: 4 * z, width: 16 * z, height: 16 * z, borderRadius: 8 * z, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                    <Ionicons name="move" size={11 * z} color={color.solid} />
                </View>
            )}

            <Text style={{ color: '#ffffff', fontSize: isExportMode ? 18 : Math.max(8, 13 * z), fontFamily: 'Nunito_800ExtraBold', lineHeight: isExportMode ? 22 : Math.max(10, 16 * z), marginBottom: isExportMode ? 4 : 2 * z }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
              {cls.name}
            </Text>

            {showTime && (
              <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: isExportMode ? 13 : Math.max(7, 9 * z), fontFamily: 'Nunito_700Bold', marginBottom: isExportMode ? 4 : 2 * z }} numberOfLines={1}>
                 {formatH(shown.startHour)} - {formatH(shown.startHour + shown.duration)}
              </Text>
            )}

            {showRoom && cls.displayRoom && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: isExportMode ? 2 : 1 * z, marginBottom: isExportMode ? 4 : 2 * z }}>
                <Ionicons name="location" size={isExportMode ? 12 : 9 * z} color="rgba(255,255,255,0.8)" />
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: isExportMode ? 12 : Math.max(7, 9 * z), fontFamily: 'Nunito_600SemiBold', marginLeft: 2 * z }} numberOfLines={1}>
                  {cls.displayRoom}
                </Text>
              </View>
            )}

            {showTeacher && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: isExportMode ? 2 : 1 * z, marginBottom: isExportMode ? 4 : 2 * z }}>
                <Ionicons name="person" size={isExportMode ? 12 : 9 * z} color="rgba(255,255,255,0.8)" />
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: isExportMode ? 12 : Math.max(7, 9 * z), fontFamily: 'Nunito_400Regular', marginLeft: 2 * z }} numberOfLines={1}>
                  {cls.instructor}
                </Text>
              </View>
            )}

            {showDuration && (
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: isExportMode ? 11 : Math.max(6, 8 * z), fontFamily: 'Nunito_600SemiBold', position: 'absolute', bottom: isExportMode ? 8 : 4 * z, left: isExportMode ? 12 : 8 * z }}>
                {formatDuration(shown.duration)}
              </Text>
            )}
      </TouchableOpacity>

          {/* Resize handle — a grab bar on the bottom edge, quick edit only. */}
          {canDrag && (
            <View
              {...resizePan.panHandlers}
              accessibilityLabel={`Resize ${cls.name}`}
              style={{
                position: 'absolute', left: 2 * z, right: 0, bottom: 0,
                height: Math.max(16, 20 * z),
                alignItems: 'center', justifyContent: 'flex-end',
                paddingBottom: 3 * z,
              }}
            >
              <View style={{
                width: Math.max(20, 26 * z), height: Math.max(3, 4 * z),
                borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.85)',
              }} />
            </View>
          )}
        </Animated.View>
      </>
    );
});

export default function TimetableGrid({ classes, isDark, isQuickEditMode = false, isExportMode = false, zoomScale = 1, fillHeight = false, revealToken = 0, onUpdateClass, onUpdateClasses, onDeleteClasses, onPressClass }: any) {
  const minClassHour = classes?.length > 0 ? Math.min(...classes.map((c:any) => c.startHour)) : 7;
  const maxClassHour = classes?.length > 0 ? Math.max(...classes.map((c:any) => c.startHour + c.duration)) : 20;
  
  const START_HOUR = isExportMode 
      ? (classes?.length > 0 ? Math.max(0, Math.floor(minClassHour) - 1) : 7)
      : Math.max(0, Math.min(7, Math.floor(minClassHour)));
  const END_HOUR = isExportMode 
      ? (classes?.length > 0 ? Math.min(24, Math.ceil(maxClassHour) + 1) : 20)
      : Math.min(24, Math.max(20, Math.ceil(maxClassHour)));
  const HOURS_COUNT = END_HOUR - START_HOUR;
  const HOURS = Array.from({ length: HOURS_COUNT }, (_, i) => START_HOUR + i);

  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const styles = getThemeStyles(isDark, isExportMode);
  const headerScrollRef = useRef<ScrollView>(null);
  const hasSundayClass = classes?.some((c: any) => c.day === 6);
  const displayDayIndices = useMemo(
    () => (isExportMode ? [6, 0, 1, 2, 3, 4, 5] : (hasSundayClass ? [6, 0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5])),
    [isExportMode, hasSundayClass],
  );
  const DAY_WIDTH = getDayWidth(displayDayIndices.length, isExportMode, SCREEN_WIDTH) * (isExportMode ? 1 : zoomScale);
  const hourHeight = getHourHeight(isExportMode) * (isExportMode ? 1 : zoomScale);
  const timeColWidth = getTimeColWidth(isExportMode) * (isExportMode ? 1 : zoomScale);

  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());
  const t = getTheme(isDark);

  // Direct manipulation state. `draggingId` exists to switch the two ScrollViews
  // off for the duration of a drag — without that the grid scrolls under the
  // block being moved and the gesture fights itself.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<any>(null);
  const [lastEdit, setLastEdit] = useState<null | { label: string; entries: { id: string; before: any }[] }>(null);
  // The gesture hint is a teaching aid, not a permanent control — it can be
  // dismissed, and it never competes with a live drag.
  const [hintDismissed, setHintDismissed] = useState(false);

  useEffect(() => {
    if (!isQuickEditMode) {
      setSelectedClassIds(new Set());
      setDraggingId(null);
      setDragPreview(null);
      setLastEdit(null);
      setHintDismissed(false);
    }
  }, [isQuickEditMode]);

  /**
   * Edge auto-scroll.
   *
   * Manual scrolling is off while a block is in the air (otherwise the grid
   * slides under the finger), so dragging toward the top or bottom of the
   * viewport scrolls the grid instead. Each tick re-runs the block's own
   * resolver through `tick`, and `delta()` tells it how far the content moved
   * so the block stays under the finger rather than riding the content away.
   */
  const vScrollRef = useRef<ScrollView>(null);
  const dragScroll = useRef({
    y: 0,
    startY: 0,
    maxY: 0,
    contentHeight: 0,
    viewportTop: 0,
    viewportHeight: 0,
    timer: null as any,
    tick: null as null | (() => void),
    measure() {
      // Re-read on every pick-up: the grid shifts when the chrome above it
      // changes, and a stale origin makes the edge zones fire in the wrong place.
      (vScrollRef.current as any)?.measureInWindow?.((_x: number, y: number, _w: number, h: number) => {
        if (Number.isFinite(y)) this.viewportTop = y;
        if (Number.isFinite(h) && h > 0) this.viewportHeight = h;
      });
    },
    begin(onTick: () => void) {
      this.startY = this.y;
      this.tick = onTick;
      this.measure();
    },
    delta() {
      return this.y - this.startY;
    },
    track(moveY: number) {
      const EDGE = 76;
      const bottom = this.viewportTop + this.viewportHeight;
      let dir = 0;
      if (this.viewportHeight > 0) {
        if (moveY > bottom - EDGE) dir = 1;
        else if (moveY < this.viewportTop + EDGE) dir = -1;
      }
      if (dir === 0) {
        this.stop();
        return;
      }
      if (this.timer) return;
      this.timer = setInterval(() => {
        const next = Math.max(0, Math.min(this.maxY, this.y + dir * 14));
        if (next === this.y) return;
        this.y = next;
        vScrollRef.current?.scrollTo({ y: next, animated: false });
        this.tick?.();
      }, 16);
    },
    stop() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    },
    end() {
      this.stop();
      this.tick = null;
    },
  }).current;

  useEffect(() => () => dragScroll.end(), []);

  // Quick Edit's panel floats over the grid, so the scrollable content grows by
  // its height while the mode is on — otherwise the last hour of the day sits
  // permanently underneath it with no way to scroll it clear.
  const QUICK_EDIT_PANEL_SPACE = 124;

  const formatClock = (h: number) => {
    const totalMins = Math.round(h * 60);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const ampm = hrs >= 12 && hrs < 24 ? 'PM' : 'AM';
    const displayH = hrs > 12 ? hrs - 12 : (hrs === 0 ? 12 : hrs);
    return `${displayH}:${mins.toString().padStart(2, '0')} ${ampm}`;
  };

  // The callbacks below must not be rebuilt per render, so what they need lives
  // in refs instead of their closure.
  const classesRef = useRef<any[]>(classes);
  classesRef.current = classes;
  const onUpdateClassRef = useRef<any>(onUpdateClass);
  onUpdateClassRef.current = onUpdateClass;

  // ClassBlock is memoised on stable props — an inline arrow here would undo
  // the whole optimisation (see APP_CONTEXT, Schedule Performance).
  const handleDragStateChange = useCallback((clsId: string, dragging: boolean) => {
    setDraggingId(dragging ? clsId : null);
    if (!dragging) setDragPreview(null);
  }, []);

  const handleDragPreview = useCallback((preview: any) => {
    setDragPreview(preview);
  }, []);

  const handleCommitDrag = useCallback((clsId: string, updates: any) => {
    const before = classesRef.current?.find((c: any) => c.id === clsId);
    if (!before) return;
    setLastEdit({
      label: updates.duration !== undefined ? 'resize' : 'move',
      entries: [{ id: clsId, before: { day: before.day, startHour: before.startHour, duration: before.duration } }],
    });
    onUpdateClassRef.current?.(clsId, updates);
  }, []);

  const undoLastEdit = () => {
    if (!lastEdit) return;
    if (onUpdateClasses) {
      onUpdateClasses(lastEdit.entries.map((e) => ({ id: e.id, updates: e.before })));
    } else if (onUpdateClass) {
      lastEdit.entries.forEach((e) => onUpdateClass(e.id, e.before));
    }
    setLastEdit(null);
  };

  // Stable identity, so every block does not get a fresh callback each render.
  const handleToggleSelect = useCallback((clsId: string) => {
    setSelectedClassIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(clsId)) newSet.delete(clsId);
      else newSet.add(clsId);
      return newSet;
    });
  }, []);

  const handleSelectAll = () => {
    if (selectedClassIds.size === classes.length) {
      setSelectedClassIds(new Set());
    } else {
      setSelectedClassIds(new Set(classes.map((c: any) => c.id)));
    }
  };

  const applyBulkUpdate = (updateFn: (cls: any) => any) => {
    if (!onUpdateClasses) return;
    const updatesList: any[] = [];
    classes.forEach((cls: any) => {
      if (selectedClassIds.has(cls.id)) {
        updatesList.push({ id: cls.id, updates: updateFn(cls) });
      }
    });
    if (updatesList.length > 0) {
      setLastEdit({
        label: 'change',
        entries: classes
          .filter((c: any) => selectedClassIds.has(c.id))
          .map((c: any) => ({ id: c.id, before: { day: c.day, startHour: c.startHour, duration: c.duration } })),
      });
      onUpdateClasses(updatesList);
    }
  };

  const moveTimeBulk = (hourDelta: number) => {
    applyBulkUpdate(cls => {
      let newHour = cls.startHour + hourDelta;
      if (newHour < START_HOUR) newHour = START_HOUR;
      if (newHour + cls.duration > END_HOUR) newHour = END_HOUR - cls.duration;
      return { startHour: newHour };
    });
  };

  const moveDayBulk = (direction: number) => {
    applyBulkUpdate(cls => {
      const currentColIdx = displayDayIndices.indexOf(cls.day);
      const newColIdx = Math.max(0, Math.min(displayDayIndices.length - 1, currentColIdx + direction));
      return { day: displayDayIndices[newColIdx] };
    });
  };

  const changeDurationBulk = (durDelta: number) => {
    applyBulkUpdate(cls => {
      let newDur = Math.max(5/60, cls.duration + durDelta);
      if (cls.startHour + newDur > END_HOUR) newDur = END_HOUR - cls.startHour;
      return { duration: newDur };
    });
  };

  const formatTime = (h: number) => {
    const ampm = h >= 12 && h < 24 ? 'PM' : 'AM';
    const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return `${displayH} ${ampm}`;
  };

  // The overlap layout used to run on every render and rebuild every class
  // object, so the memo on ClassBlock could never hit. It now recomputes only
  // when the classes actually change, and carries each block's resolved room
  // so ClassBlock no longer depends on the whole array.
  const processedClasses = useMemo(() => {
  const processed = classes?.map((c: any) => ({ ...c, col: 0, maxCol: 1, displayRoom: getRoomForClass(c, classes) })) || [];
  displayDayIndices.forEach(dayIdx => {
    const dayClasses = processed.filter((c: any) => c.day === dayIdx).sort((a: any, b: any) => a.startHour - b.startHour);
    
    // Group overlapping classes into contiguous blocks
    const groups: any[][] = [];
    let currentGroup: any[] = [];
    let groupEnd = -1;

    dayClasses.forEach((cls: any) => {
      if (currentGroup.length === 0) {
        currentGroup.push(cls);
        groupEnd = cls.startHour + cls.duration;
      } else if (cls.startHour >= groupEnd) {
        // No overlap with current group, push and start new group
        groups.push(currentGroup);
        currentGroup = [cls];
        groupEnd = cls.startHour + cls.duration;
      } else {
        // Overlaps with current group
        currentGroup.push(cls);
        groupEnd = Math.max(groupEnd, cls.startHour + cls.duration);
      }
    });
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    // Now layout each group independently
    groups.forEach(group => {
      const columns: any[][] = [];
      group.forEach((cls: any) => {
        let placed = false;
        for (let i = 0; i < columns.length; i++) {
          const lastClassInCol = columns[i][columns[i].length - 1];
          // We can place it in this column if it starts after the last class ends
          if (lastClassInCol.startHour + lastClassInCol.duration <= cls.startHour) {
            columns[i].push(cls);
            cls.col = i;
            placed = true;
            break;
          }
        }
        if (!placed) {
          cls.col = columns.length;
          columns.push([cls]);
        }
      });
      // All classes in this connected group get the same maxCol
      group.forEach((cls: any) => {
        cls.maxCol = columns.length;
      });
    });
  });
  const order = [...processed].sort((a: any, b: any) => {
    const da = displayDayIndices.indexOf(a.day);
    const db = displayDayIndices.indexOf(b.day);
    if (da !== db) return da - db;
    return (a.startHour || 0) - (b.startHour || 0);
  });
  order.forEach((c: any, i: number) => { c.appearIndex = i; });

  return processed;
  }, [classes, displayDayIndices]);

  return (
    <View style={{ ...(isExportMode ? {} : (fillHeight ? { flex: 1 } : { height: 600 })), backgroundColor: styles.gridBg, borderRadius: styles.borderRadius, overflow: 'hidden', borderWidth: styles.outerBorderWidth, borderColor: styles.outerBorderColor }}>
      <View style={{ flexDirection: 'row', backgroundColor: styles.headerBg }}>
        <View style={{ width: timeColWidth, borderRightWidth: isExportMode ? 2 : 1, borderColor: styles.gridLine }} />
        {isExportMode ? (
          <View style={{ flexDirection: 'row' }}>
            {displayDayIndices.map((dayIdx, idx) => (
              <View key={idx} style={{ width: DAY_WIDTH, alignItems: 'center', borderRightWidth: 2, borderColor: styles.gridLine }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: styles.textColor, paddingVertical: 18, letterSpacing: 0.5 }}>{FULL_DAYS[dayIdx]}</Text>
              </View>
            ))}
          </View>
        ) : (
          <ScrollView ref={headerScrollRef} horizontal showsHorizontalScrollIndicator={false} bounces={false} scrollEnabled={false}>
            <View style={{ flexDirection: 'row', width: displayDayIndices.length * DAY_WIDTH }}>
              {displayDayIndices.map((dayIdx, idx) => (
                <View key={idx} style={{ width: DAY_WIDTH, alignItems: 'center', borderRightWidth: 1, borderColor: isDark ? '#1e293b' : '#e2e8f0' }}>
                  <Text style={{ fontSize: Math.max(9, 12 * zoomScale), fontWeight: 'bold', color: isDark ? '#94a3b8' : '#64748b', paddingVertical: 8 * zoomScale }}>{DAYS[dayIdx]}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Grid */}
      {isExportMode ? (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row' }}>
            {/* Time Column */}
            <View style={{ width: timeColWidth, borderRightWidth: 2, borderColor: isDark ? '#334155' : '#e2e8f0', paddingTop: 10 }}>
              {HOURS.map((h, i) => (
                <View key={i} style={{ height: hourHeight, justifyContent: 'flex-start', alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: isDark ? '#64748b' : '#94a3b8', marginTop: i === 0 ? 0 : -9, backgroundColor: isDark ? '#1e293b' : '#ffffff', paddingHorizontal: 6 }}>
                    {formatTime(h)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Grid Area */}
            <View>
              <View style={{ width: displayDayIndices.length * DAY_WIDTH, height: HOURS_COUNT * hourHeight, paddingTop: 10 }}>
                {/* Weekend shading */}
                {isExportMode && displayDayIndices.map((dayIdx, i) => (
                  (dayIdx === 5 || dayIdx === 6) ? (
                    <View key={`wk-${i}`} style={{ position: 'absolute', left: i * DAY_WIDTH, top: 0, width: DAY_WIDTH, height: '100%', backgroundColor: isDark ? 'rgba(99,102,241,0.04)' : 'rgba(99,102,241,0.03)' }} />
                  ) : null
                ))}
                {/* Grid Lines */}
                {HOURS.map((_, i) => (
                  <View key={i} style={{ position: 'absolute', top: i * hourHeight + 10, width: '100%', height: 2, backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }} />
                ))}
                <View style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', flexDirection: 'row', pointerEvents: 'none' }}>
                  {displayDayIndices.map((_, i) => (
                    <View key={i} style={{ width: DAY_WIDTH, borderRightWidth: 2, borderColor: isDark ? '#1e293b' : '#f1f5f9' }} />
                  ))}
                </View>

                {/* Classes */}
                {processedClasses.map((cls: any) => (
                  <ClassBlock 
                    key={cls.id} 
                    cls={cls} 
                    isDark={isDark}
                    isQuickEditMode={isQuickEditMode}
                    isSelected={selectedClassIds.has(cls.id)}
                    onToggleSelect={handleToggleSelect}
                    onPressClass={onPressClass}
                    START_HOUR={START_HOUR}
                    END_HOUR={END_HOUR}
                    displayDayIndices={displayDayIndices}
                    dayWidth={DAY_WIDTH}
                    isExportMode={true}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>
      ) : (
    <ScrollView
      ref={vScrollRef}
      style={{ flex: 1 }}
      nestedScrollEnabled={true}
      scrollEnabled={!draggingId}
      scrollEventThrottle={16}
      onScroll={(e) => { dragScroll.y = e.nativeEvent.contentOffset.y; }}
      onLayout={(e) => {
        dragScroll.viewportHeight = e.nativeEvent.layout.height;
        dragScroll.maxY = Math.max(0, dragScroll.contentHeight - dragScroll.viewportHeight);
        // Where the grid sits on screen, so a finger position (which PanResponder
        // reports in window coordinates) can be compared against its edges.
        (vScrollRef.current as any)?.measureInWindow?.((_x: number, y: number) => {
          if (Number.isFinite(y)) dragScroll.viewportTop = y;
        });
      }}
      onContentSizeChange={(_w, h) => {
        dragScroll.contentHeight = h;
        dragScroll.maxY = Math.max(0, h - dragScroll.viewportHeight);
      }}
    >
          <View style={{ flexDirection: 'row' }}>
            {/* Time Column */}
            <View style={{ width: timeColWidth, borderRightWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0', paddingTop: 10 * zoomScale }}>
              {HOURS.map((h, i) => (
                <View key={i} style={{ height: hourHeight, justifyContent: 'flex-start', alignItems: 'center' }}>
                  <Text style={{ fontSize: Math.max(7, 10 * zoomScale), fontWeight: '700', color: isDark ? '#64748b' : '#94a3b8', marginTop: i === 0 ? 0 : -6 * zoomScale, backgroundColor: styles.gridBg, paddingHorizontal: 3 * zoomScale }}>
                    {formatTime(h)}
                  </Text>
                </View>
              ))}
            </View>

            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              bounces={false}
              nestedScrollEnabled={true}
              scrollEnabled={!draggingId}
              onScroll={(e) => {
                if (headerScrollRef.current) {
                  headerScrollRef.current.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });
                }
              }}
              scrollEventThrottle={16}
            >
              <View style={{
                width: displayDayIndices.length * DAY_WIDTH,
                height: HOURS_COUNT * hourHeight + (isQuickEditMode ? QUICK_EDIT_PANEL_SPACE : 0),
                paddingTop: 10 * zoomScale,
              }}>
                {/* Grid Lines */}
                {HOURS.map((_, i) => (
                  <View key={i} style={{ position: 'absolute', top: i * hourHeight + (10 * zoomScale), width: '100%', height: 1, backgroundColor: styles.gridLine }} />
                ))}
                <View style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', flexDirection: 'row', pointerEvents: 'none' }}>
                  {displayDayIndices.map((_, i) => (
                    <View key={i} style={{ width: DAY_WIDTH, borderRightWidth: 1, borderColor: isDark ? '#1e293b' : '#e2e8f0' }} />
                  ))}
                </View>

                {/* Classes */}
                {processedClasses.map((cls: any) => (
                  <ClassBlock 
                    key={cls.id}
                    cls={cls} 
                    isDark={isDark}
                    isQuickEditMode={isQuickEditMode}
                    isSelected={selectedClassIds.has(cls.id)}
                    onToggleSelect={handleToggleSelect}
                    onPressClass={onPressClass}
                    START_HOUR={START_HOUR}
                    END_HOUR={END_HOUR}
                    displayDayIndices={displayDayIndices}
                    dayWidth={DAY_WIDTH}
                    zoomScale={zoomScale}
                    appearIndex={cls.appearIndex}
                    appearToken={revealToken}
                    onDragStateChange={handleDragStateChange}
                    onDragPreview={handleDragPreview}
                    onCommitDrag={handleCommitDrag}
                    dragScroll={dragScroll}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}

      {/* Live readout while a block is in the air, so the student can see the
          slot they are dropping into without reading the block itself. */}
      {isQuickEditMode && dragPreview && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center', zIndex: 1000 }}
        >
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 7,
            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
            backgroundColor: t.text,
          }}>
            <Ionicons name="move" size={13} color={t.background} />
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: t.background }}>
              {FULL_DAYS[dragPreview.day]} · {formatClock(dragPreview.startHour)} – {formatClock(dragPreview.startHour + dragPreview.duration)}
            </Text>
          </View>
        </View>
      )}

      {/* Quick Edit chrome. Nothing is shown while a block is actually being
          dragged — the panel sits exactly where a downward drag ends up. */}
      {isQuickEditMode && !draggingId && (
        <View style={{ position: 'absolute', bottom: 10, left: getTimeColWidth(isExportMode) + 10, right: 10 }}>
          {/* One-line gesture hint, dismissible. It used to be a two-line card
              with a button, permanently covering the last hours of the day. */}
          {selectedClassIds.size === 0 && !hintDismissed && (
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              paddingLeft: 10, paddingRight: 6, height: 38, borderRadius: 12,
              backgroundColor: t.surface,
              borderWidth: 1, borderColor: t.cardBorder,
              borderBottomWidth: 2, borderBottomColor: t.lip,
            }}>
              <Ionicons name="move" size={14} color={isDark ? '#a9b2fb' : '#3b41c4'} style={{ marginRight: 7 }} />
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: t.textSecondary }}>
                Hold to drag · bottom edge resizes · tap to select
              </Text>
              {lastEdit && (
                <TouchableOpacity
                  onPress={undoLastEdit}
                  accessibilityRole="button"
                  accessibilityLabel={`Undo ${lastEdit.label}`}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 4 }}
                >
                  <Ionicons name="arrow-undo-outline" size={13} color={t.primary} />
                  <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: t.primary }}>Undo</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setHintDismissed(true)}
                accessibilityRole="button"
                accessibilityLabel="Hide the gesture hint"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={14} color={t.textTertiary} />
              </TouchableOpacity>
            </View>
          )}

          {/* With the hint gone and nothing selected, only Undo remains. */}
          {selectedClassIds.size === 0 && hintDismissed && lastEdit && (
            <View style={{ alignItems: 'flex-end' }}>
              <TouchableOpacity
                onPress={undoLastEdit}
                accessibilityRole="button"
                accessibilityLabel={`Undo ${lastEdit.label}`}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 12, height: 34, borderRadius: 999,
                  backgroundColor: t.surface,
                  borderWidth: 1, borderColor: t.cardBorder,
                  borderBottomWidth: 2, borderBottomColor: t.lip,
                }}
              >
                <Ionicons name="arrow-undo-outline" size={14} color={t.primary} />
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: t.primary }}>Undo</Text>
              </TouchableOpacity>
            </View>
          )}

          {selectedClassIds.size > 0 && (
            <View style={{
              borderRadius: 16, overflow: 'hidden',
              backgroundColor: t.surface,
              borderWidth: 1, borderColor: t.cardBorder,
              borderBottomWidth: 2, borderBottomColor: t.lip,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: t.text, flex: 1 }}>
                  {selectedClassIds.size} block{selectedClassIds.size > 1 ? 's' : ''} selected
                </Text>
                {lastEdit && (
                  <TouchableOpacity
                    onPress={undoLastEdit}
                    accessibilityRole="button"
                    accessibilityLabel={`Undo ${lastEdit.label}`}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 14 }}
                  >
                    <Ionicons name="arrow-undo-outline" size={13} color={t.textSecondary} />
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: t.textSecondary }}>Undo</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleSelectAll}
                  accessibilityRole="button"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: t.primary }}>
                    {selectedClassIds.size === classes.length && classes.length > 0 ? 'Deselect all' : 'Select all'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 8, paddingVertical: 7,
                borderTopWidth: 1, borderTopColor: t.cardBorder,
                backgroundColor: isDark ? 'rgba(0,0,0,0.16)' : t.surfaceSecondary,
              }}>
                {[
                  { key: 'day', label: 'Day', minus: 'chevron-back' as const, plus: 'chevron-forward' as const, onMinus: () => moveDayBulk(-1), onPlus: () => moveDayBulk(1) },
                  { key: 'time', label: 'Time', minus: 'chevron-up' as const, plus: 'chevron-down' as const, onMinus: () => moveTimeBulk(-5 / 60), onPlus: () => moveTimeBulk(5 / 60) },
                  { key: 'dur', label: 'Length', minus: 'remove' as const, plus: 'add' as const, onMinus: () => changeDurationBulk(-5 / 60), onPlus: () => changeDurationBulk(5 / 60) },
                ].map((group, i) => (
                  <React.Fragment key={group.key}>
                    {i > 0 && <View style={{ width: 1, height: 22, backgroundColor: t.cardBorder }} />}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity
                        onPress={group.onMinus}
                        accessibilityRole="button"
                        accessibilityLabel={`Decrease ${group.label}`}
                        style={{ width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface }}
                      >
                        <Ionicons name={group.minus} size={16} color={t.textSecondary} />
                      </TouchableOpacity>
                      <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: t.textTertiary, marginHorizontal: 6 }}>
                        {group.label}
                      </Text>
                      <TouchableOpacity
                        onPress={group.onPlus}
                        accessibilityRole="button"
                        accessibilityLabel={`Increase ${group.label}`}
                        style={{ width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface }}
                      >
                        <Ionicons name={group.plus} size={16} color={t.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </React.Fragment>
                ))}

                {onDeleteClasses && (
                  <>
                    <View style={{ width: 1, height: 22, backgroundColor: t.cardBorder }} />
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert("Delete Selected", `Are you sure you want to delete ${selectedClassIds.size} class block(s)?`, [
                          { text: "Cancel", style: "cancel" },
                          { text: "Delete", style: "destructive", onPress: () => {
                              onDeleteClasses(Array.from(selectedClassIds));
                              setSelectedClassIds(new Set());
                          }}
                        ]);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${selectedClassIds.size} selected blocks`}
                      style={{ width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(248,113,113,0.16)' : '#fdeae7' }}
                    >
                      <Ionicons name="trash" size={15} color={isDark ? '#f7a099' : '#b23227'} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
