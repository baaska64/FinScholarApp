import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { getTheme, Typography, Radius, Shadows } from '@/constants/Theme';
import Badge from '@/components/ui/Badge';
import { TaskItem, ChecklistItem } from './types';
import { formatAMPM, getTimeLeftText, getUrgencyColor, parseDueDate, triggerHaptic } from './utils';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface TaskIslandCardProps {
  task: TaskItem;
  nowMs: number;
  onEdit: (task: TaskItem) => void;
  onDelete: (task: TaskItem) => void;
  onStatusChange: (task: TaskItem, nextStatus: 'pending' | 'submitted' | 'graded') => void;
  onUpdateChecklist?: (task: TaskItem, newChecklist: ChecklistItem[]) => void;
}

const PRIORITY_STRIPE_COLOR: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981',
};

export default function TaskIslandCard({
  task,
  nowMs,
  onEdit,
  onDelete,
  onStatusChange,
  onUpdateChecklist,
}: TaskIslandCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);

  const [expanded, setExpanded] = useState(false);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [showAddChecklist, setShowAddChecklist] = useState(false);

  // Swipe animation state
  const translateX = useRef(new Animated.Value(0)).current;

  // PanResponder with strict horizontal direction lock to preserve smooth vertical list scrolling
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 18 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.8;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderMove: (_, gestureState) => {
        // Cap swipe distance
        const dx = Math.max(-120, Math.min(120, gestureState.dx));
        translateX.setValue(dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -80) {
          // Swipe Left -> Delete Trigger
          triggerHaptic('warning');
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          onDelete(task);
        } else if (gestureState.dx > 80) {
          // Swipe Right -> Quick advance
          triggerHaptic('medium');
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          if (task.status === 'pending') {
            onStatusChange(task, 'submitted');
          } else if (task.status === 'submitted') {
            onStatusChange(task, 'graded');
          } else {
            onStatusChange(task, 'pending');
          }
        } else {
          // Reset
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  // Parse Date
  const d = parseDueDate(task.dueDate);
  const isValidDate = d !== null;
  const displayDate = d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date';
  const displayTime = d ? formatAMPM(d) : '';
  const timeLeft = getTimeLeftText(task.dueDate, nowMs);
  const urgency = getUrgencyColor(timeLeft, isDark);
  const priorityVariant = task.priority === 'high' ? 'high' : task.priority === 'low' ? 'low' : 'medium';
  const priorityStripe = PRIORITY_STRIPE_COLOR[task.priority] || PRIORITY_STRIPE_COLOR.medium;

  const toggleExpand = () => {
    triggerHaptic('light');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  // Checklist Helpers
  const checklist: ChecklistItem[] = task.checklist || [];
  const completedChecklistCount = checklist.filter((c: ChecklistItem) => c.completed).length;

  const handleToggleChecklistItem = (itemIndex: number) => {
    triggerHaptic('light');
    const updated = checklist.map((item: ChecklistItem, idx: number) =>
      idx === itemIndex ? { ...item, completed: !item.completed } : item
    );
    onUpdateChecklist?.(task, updated);
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    triggerHaptic('light');
    const newItem: ChecklistItem = {
      id: Math.random().toString(36).substring(2, 9),
      text: newChecklistText.trim(),
      completed: false,
    };
    onUpdateChecklist?.(task, [...checklist, newItem]);
    setNewChecklistText('');
    setShowAddChecklist(false);
  };

  const handleDeleteChecklistItem = (itemIndex: number) => {
    triggerHaptic('light');
    const updated = checklist.filter((_: ChecklistItem, idx: number) => idx !== itemIndex);
    onUpdateChecklist?.(task, updated);
  };

  // Score percent calculation for graded tasks
  const scorePercent =
    task.status === 'graded' && task.maxScore && task.maxScore > 0
      ? Math.round(((task.earnedScore || 0) / task.maxScore) * 100)
      : null;

  return (
    <View style={{ marginBottom: 12, position: 'relative' }}>
      {/* Background Swipe Action Reveal Layer */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 20,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 20,
          backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
        }}
      >
        {/* Right swipe action (Submit/Advance) */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons
            name={task.status === 'pending' ? 'checkmark-circle' : 'refresh-circle'}
            size={24}
            color={theme.success}
          />
          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.success, marginLeft: 6 }}>
            {task.status === 'pending' ? 'Submit' : (task.status === 'submitted' ? 'Grade' : 'Reset')}
          </Text>
        </View>

        {/* Left swipe action (Delete) */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.error, marginRight: 6 }}>
            Delete
          </Text>
          <Ionicons name="trash" size={22} color={theme.error} />
        </View>
      </View>

      {/* Main Elevated Card Island */}
      <Animated.View
        {...panResponder.panHandlers}
        style={{
          transform: [{ translateX }],
          borderRadius: 20,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: isDark ? theme.cardBorder : '#e2e8f0',
          overflow: 'hidden',
          ...Shadows.sm,
        }}
      >
        {/* Top / Left Priority Accent Strip */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 5,
            backgroundColor: priorityStripe,
          }}
        />

        <View style={{ padding: 16, paddingLeft: 18 }}>
          {/* Top Row: Quick Status Toggle, Title, & Actions */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            {/* Quick Status Button & Title */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1, marginRight: 8 }}>
              <TouchableOpacity
                accessible={true}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: task.status !== 'pending' }}
                accessibilityLabel={`Task status: ${task.status}. Tap to advance status.`}
                accessibilityHint="Cycles status through pending, submitted, and graded"
                onPress={() => {
                  triggerHaptic('light');
                  if (task.status === 'pending') onStatusChange(task, 'submitted');
                  else if (task.status === 'submitted') onStatusChange(task, 'graded');
                  else onStatusChange(task, 'pending');
                }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: task.status === 'pending' ? (isDark ? '#64748b' : '#94a3b8') : (task.status === 'submitted' ? theme.primary : theme.success),
                  backgroundColor: task.status === 'pending' ? 'transparent' : (task.status === 'submitted' ? theme.primary : theme.success),
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                  marginTop: 1,
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {task.status !== 'pending' && (
                  <Ionicons name="checkmark" size={14} color="#ffffff" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Task ${task.title}${task.description ? `, ${task.description}` : ''}`}
                accessibilityHint="Tap to toggle full task details"
                onPress={toggleExpand}
                activeOpacity={0.7}
                style={{ flex: 1 }}
              >
                <Text
                  style={{
                    fontFamily: 'Nunito_900Black',
                    fontSize: 15,
                    color: task.status === 'submitted' || task.status === 'graded' ? theme.textSecondary : theme.text,
                    textDecorationLine: task.status === 'graded' ? 'line-through' : 'none',
                  }}
                >
                  {task.title}
                </Text>

                {task.description && !expanded ? (
                  <Text
                    numberOfLines={2}
                    style={{
                      fontFamily: 'Nunito_400Regular',
                      fontSize: 12,
                      color: theme.textSecondary,
                      marginTop: 3,
                    }}
                  >
                    {task.description}
                  </Text>
                ) : null}
              </TouchableOpacity>
            </View>

            {/* Quick Action Icons */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Edit task ${task.title}`}
                onPress={() => {
                  triggerHaptic('light');
                  onEdit(task);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="pencil-outline" size={18} color={theme.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Delete task ${task.title}`}
                onPress={() => {
                  triggerHaptic('warning');
                  onDelete(task);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color={theme.error} />
              </TouchableOpacity>
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={expanded ? `Collapse details for ${task.title}` : `Expand details for ${task.title}`}
                onPress={toggleExpand}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.textTertiary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Badges Row */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 }}>
            {task.subjectName ? (
              <Badge label={task.subjectName} variant="info" />
            ) : null}
            <Badge label={`${task.priority} priority`} variant={priorityVariant as any} />
            {task.linkedComponentId ? (
              <Badge label="Linked" variant="success" />
            ) : null}
            {checklist.length > 0 && (
              <View
                accessible={true}
                accessibilityRole="text"
                accessibilityLabel={`${completedChecklistCount} of ${checklist.length} subtasks completed`}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                  backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
                  borderWidth: 1,
                  borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="checkbox-outline" size={10} color={theme.textSecondary} style={{ marginRight: 3 }} />
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 10, color: theme.textSecondary }}>
                  {completedChecklistCount}/{checklist.length} subtasks
                </Text>
              </View>
            )}
          </View>

          {/* Due Date & Countdown Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <View
              accessible={true}
              accessibilityRole="text"
              accessibilityLabel={`Due date: ${displayDate} at ${displayTime}`}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <Ionicons name="calendar-outline" size={13} color={theme.textTertiary} />
              <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textSecondary, marginLeft: 4 }}>
                {displayDate} at {displayTime}
              </Text>
            </View>

            {task.status === 'pending' && (
              <View
                accessible={true}
                accessibilityRole="text"
                accessibilityLabel={`Time remaining: ${timeLeft}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 8,
                  backgroundColor: urgency.bg,
                  borderWidth: 1,
                  borderColor: urgency.border,
                }}
              >
                <Ionicons name="time-outline" size={11} color={urgency.icon} />
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 10, color: urgency.text, marginLeft: 4 }}>
                  {timeLeft}
                </Text>
              </View>
            )}

            {task.status === 'graded' && task.earnedScore !== undefined && (
              <View
                accessible={true}
                accessibilityRole="text"
                accessibilityLabel={`Score: ${task.earnedScore} out of ${task.maxScore}, ${scorePercent} percent`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 8,
                  backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(16,185,129,0.4)' : '#a7f3d0',
                }}
              >
                <Ionicons name="ribbon" size={11} color={theme.success} />
                <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 10, color: theme.success, marginLeft: 4 }}>
                  {task.earnedScore} / {task.maxScore} ({scorePercent}%)
                </Text>
              </View>
            )}
          </View>

          {/* Expandable Details Section */}
          {expanded && (
            <View
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTopWidth: 1,
                borderTopColor: isDark ? theme.cardBorder : '#f1f5f9',
              }}
            >
              {/* Full Description */}
              {task.description ? (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textTertiary, marginBottom: 2 }}>
                    Notes & Description
                  </Text>
                  <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 13, color: theme.textSecondary, lineHeight: 18 }}>
                    {task.description}
                  </Text>
                </View>
              ) : null}

              {/* Subtasks / Checklist Section */}
              <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textTertiary }}>
                    Checklist & Steps ({completedChecklistCount}/{checklist.length})
                  </Text>
                  <TouchableOpacity
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Add checklist step"
                    onPress={() => {
                      triggerHaptic('light');
                      setShowAddChecklist(!showAddChecklist);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                  >
                    <Ionicons name="add-circle-outline" size={14} color={theme.primary} />
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.primary, marginLeft: 2 }}>
                      Add Step
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Subtask Items */}
                {checklist.map((item: ChecklistItem, idx: number) => (
                  <View
                    key={item.id || idx}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 5,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      backgroundColor: isDark ? theme.surfaceSecondary : '#f8fafc',
                      marginBottom: 4,
                    }}
                  >
                    <TouchableOpacity
                      accessible={true}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: item.completed }}
                      accessibilityLabel={`Step: ${item.text}, ${item.completed ? 'completed' : 'incomplete'}`}
                      onPress={() => handleToggleChecklistItem(idx)}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 5,
                        borderWidth: 1.5,
                        borderColor: item.completed ? theme.success : (isDark ? '#64748b' : '#94a3b8'),
                        backgroundColor: item.completed ? theme.success : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 8,
                      }}
                    >
                      {item.completed && <Ionicons name="checkmark" size={12} color="#ffffff" />}
                    </TouchableOpacity>
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: 'Nunito_600SemiBold',
                        fontSize: 12,
                        color: item.completed ? theme.textTertiary : theme.text,
                        textDecorationLine: item.completed ? 'line-through' : 'none',
                      }}
                    >
                      {item.text}
                    </Text>
                    <TouchableOpacity
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete step ${item.text}`}
                      onPress={() => handleDeleteChecklistItem(idx)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close" size={14} color={theme.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add Checklist Input Box */}
                {showAddChecklist && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
                    <TextInput
                      placeholder="Add a step / checklist item..."
                      placeholderTextColor={theme.textTertiary}
                      value={newChecklistText}
                      onChangeText={setNewChecklistText}
                      onSubmitEditing={handleAddChecklistItem}
                      accessibilityLabel="New checklist step input"
                      style={{
                        flex: 1,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
                        borderWidth: 1,
                        borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                        fontFamily: 'Nunito_600SemiBold',
                        fontSize: 12,
                        color: theme.text,
                      }}
                    />
                    <TouchableOpacity
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel="Add step"
                      onPress={handleAddChecklistItem}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 8,
                        backgroundColor: theme.primary,
                      }}
                    >
                      <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#ffffff' }}>Add</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Status Transition Action Buttons */}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                {task.status === 'pending' && (
                  <TouchableOpacity
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Submit Task"
                    onPress={() => {
                      triggerHaptic('medium');
                      onStatusChange(task, 'submitted');
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 10,
                      backgroundColor: theme.primary,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons name="checkmark-circle-outline" size={14} color="#ffffff" />
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#ffffff', marginLeft: 4 }}>
                      Submit Task
                    </Text>
                  </TouchableOpacity>
                )}

                {task.status === 'submitted' && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel="Unsubmit task"
                      onPress={() => {
                        triggerHaptic('light');
                        onStatusChange(task, 'pending');
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                      }}
                    >
                      <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textSecondary }}>
                        Unsubmit
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel="Grade task"
                      onPress={() => {
                        triggerHaptic('medium');
                        onStatusChange(task, 'graded');
                      }}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        borderRadius: 10,
                        backgroundColor: theme.success,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons name="ribbon-outline" size={14} color="#ffffff" />
                      <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#ffffff', marginLeft: 4 }}>
                        Grade Task
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {task.status === 'graded' && (
                  <TouchableOpacity
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Move to Submitted"
                    onPress={() => {
                      triggerHaptic('light');
                      onStatusChange(task, 'submitted');
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                    }}
                  >
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textSecondary }}>
                      Move to Submitted
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}
