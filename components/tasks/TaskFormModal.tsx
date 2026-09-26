import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getTheme, Typography, Radius, Shadows } from '@/constants/Theme';
import { TaskItem, TaskPriority, TaskStatus, SubjectOption, GradeComponentOption, ChecklistItem } from './types';
import { parseDueDate, formatAMPM, triggerHaptic, sanitizeScore } from './utils';

export interface TaskFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (taskData: {
    title: string;
    description: string;
    dueDate: Date;
    priority: TaskPriority;
    status: TaskStatus;
    subjectId: string;
    linkedComponentId: string;
    earnedScore: string;
    maxScore: string;
    checklist?: ChecklistItem[];
  }) => void;
  editingTask: TaskItem | null;
  subjects: SubjectOption[];
  getComponentsForSubject: (subjectId: string) => GradeComponentOption[];
  initialSubjectId?: string;
}

export default function TaskFormModal({
  visible,
  onClose,
  onSave,
  editingTask,
  subjects,
  getComponentsForSubject,
  initialSubjectId,
}: TaskFormModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [subjectId, setSubjectId] = useState('');
  const [linkedComponentId, setLinkedComponentId] = useState('');
  const [earnedScore, setEarnedScore] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (editingTask) {
      const parsedDate = parseDueDate(editingTask.dueDate) || new Date();

      setTitle(editingTask.title);
      setDescription(editingTask.description || '');
      setDueDate(parsedDate);
      setPriority(editingTask.priority);
      setStatus(editingTask.status);
      setSubjectId(editingTask.subjectId);
      setLinkedComponentId(editingTask.linkedComponentId || '');
      setEarnedScore(editingTask.earnedScore !== undefined ? String(editingTask.earnedScore) : '');
      setMaxScore(editingTask.maxScore !== undefined ? String(editingTask.maxScore) : '100');
      setChecklist(editingTask.checklist ? [...editingTask.checklist] : []);
    } else {
      const defaultDate = new Date();
      defaultDate.setHours(23, 59, 59, 0);

      const targetSubjId =
        initialSubjectId && subjects.some((s) => s.id === initialSubjectId)
          ? initialSubjectId
          : (subjects[0]?.id || '');

      setTitle('');
      setDescription('');
      setDueDate(defaultDate);
      setPriority('medium');
      setStatus('pending');
      setSubjectId(targetSubjId);
      setLinkedComponentId('');
      setEarnedScore('');
      setMaxScore('100');
      setChecklist([]);
    }
  }, [editingTask, visible, subjects, initialSubjectId]);

  const activeComponentsList = subjectId ? getComponentsForSubject(subjectId) : [];

  const handleSave = () => {
    if (!title.trim() || !subjectId) return;
    triggerHaptic('success');
    onSave({
      title: title.trim(),
      description: description.trim(),
      dueDate,
      priority,
      status,
      subjectId,
      linkedComponentId,
      earnedScore,
      maxScore,
      checklist,
    });
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    triggerHaptic('light');
    setChecklist([
      ...checklist,
      {
        id: Math.random().toString(36).substring(2, 9),
        text: newChecklistText.trim(),
        completed: false,
      },
    ]);
    setNewChecklistText('');
  };

  const handleRemoveChecklistItem = (index: number) => {
    triggerHaptic('light');
    setChecklist(checklist.filter((_, idx) => idx !== index));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <View
          style={{
            height: '84%',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 20,
            paddingBottom: Platform.OS === 'ios' ? 40 : 24,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: isDark ? theme.cardBorder : '#e2e8f0',
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#e0e7ff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                }}
              >
                <Ionicons
                  name={editingTask ? 'create-outline' : 'add-circle-outline'}
                  size={20}
                  color={theme.primary}
                />
              </View>
              <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 18, color: theme.text }}>
                {editingTask ? 'Edit Task' : 'Create New Task'}
              </Text>
            </View>
            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Close task form"
              onPress={() => {
                triggerHaptic('light');
                onClose();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={24} color={theme.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* Form Scroll Container */}
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {/* Title */}
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textTertiary, marginBottom: 6 }}>
              Task Title *
            </Text>
            <TextInput
              placeholder="e.g. Research Proposal Draft"
              placeholderTextColor={theme.textTertiary}
              value={title}
              onChangeText={setTitle}
              accessibilityLabel="Task title (required)"
              style={{
                fontFamily: 'Nunito_600SemiBold',
                fontSize: 14,
                color: theme.text,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                backgroundColor: isDark ? theme.surfaceSecondary : '#f8fafc',
                marginBottom: 14,
              }}
            />

            {/* Description */}
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textTertiary, marginBottom: 6 }}>
              Description & Notes
            </Text>
            <TextInput
              placeholder="Add key notes, guidelines, or instructions..."
              placeholderTextColor={theme.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              accessibilityLabel="Task description and notes"
              style={{
                fontFamily: 'Nunito_400Regular',
                fontSize: 13,
                color: theme.text,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                backgroundColor: isDark ? theme.surfaceSecondary : '#f8fafc',
                minHeight: 70,
                textAlignVertical: 'top',
                marginBottom: 14,
              }}
            />

            {/* Subject Selector */}
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textTertiary, marginBottom: 6 }}>
              Subject *
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {subjects.map((sub) => {
                const isSelected = subjectId === sub.id;
                return (
                  <TouchableOpacity
                    key={sub.id}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Subject ${sub.name}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      triggerHaptic('light');
                      setSubjectId(sub.id);
                      setLinkedComponentId('');
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 10,
                      borderWidth: 1,
                      backgroundColor: isSelected ? theme.primary : (isDark ? theme.surfaceSecondary : '#f8fafc'),
                      borderColor: isSelected ? theme.primary : (isDark ? theme.cardBorder : '#e2e8f0'),
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Nunito_700Bold',
                        fontSize: 11,
                        color: isSelected ? '#ffffff' : theme.textSecondary,
                      }}
                    >
                      {sub.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Link to Grade Component */}
            {subjectId ? (
              <>
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textTertiary, marginBottom: 6 }}>
                  Link to Grade Component (Optional)
                </Text>
                {activeComponentsList.length === 0 ? (
                  <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11, fontStyle: 'italic', color: theme.textTertiary, marginBottom: 14 }}>
                    No grade components found for this subject.
                  </Text>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                    <TouchableOpacity
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel="No grade component link"
                      accessibilityState={{ selected: !linkedComponentId }}
                      onPress={() => {
                        triggerHaptic('light');
                        setLinkedComponentId('');
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 10,
                        borderWidth: 1,
                        backgroundColor: !linkedComponentId ? theme.primary : (isDark ? theme.surfaceSecondary : '#f8fafc'),
                        borderColor: !linkedComponentId ? theme.primary : (isDark ? theme.cardBorder : '#e2e8f0'),
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'Nunito_700Bold',
                          fontSize: 11,
                          color: !linkedComponentId ? '#ffffff' : theme.textSecondary,
                        }}
                      >
                        None
                      </Text>
                    </TouchableOpacity>
                    {activeComponentsList.map((comp) => {
                      const isSelected = linkedComponentId === comp.id;
                      return (
                        <TouchableOpacity
                          key={comp.id}
                          accessible={true}
                          accessibilityRole="button"
                          accessibilityLabel={`Grade component ${comp.label}`}
                          accessibilityState={{ selected: isSelected }}
                          onPress={() => {
                            triggerHaptic('light');
                            setLinkedComponentId(comp.id);
                          }}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 10,
                            borderWidth: 1,
                            backgroundColor: isSelected ? theme.primary : (isDark ? theme.surfaceSecondary : '#f8fafc'),
                            borderColor: isSelected ? theme.primary : (isDark ? theme.cardBorder : '#e2e8f0'),
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: 'Nunito_700Bold',
                              fontSize: 11,
                              color: isSelected ? '#ffffff' : theme.textSecondary,
                            }}
                          >
                            {comp.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            ) : null}

            {/* Priority & Status Row */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
              {/* Priority */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textTertiary, marginBottom: 6 }}>
                  Priority
                </Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {(['low', 'medium', 'high'] as TaskPriority[]).map((p) => {
                    const isSelected = priority === p;
                    const pColor = p === 'high' ? '#ef4444' : p === 'medium' ? '#f59e0b' : '#10b981';
                    return (
                      <TouchableOpacity
                        key={p}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={`Priority ${p}`}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => {
                          triggerHaptic('light');
                          setPriority(p);
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 7,
                          alignItems: 'center',
                          borderRadius: 10,
                          borderWidth: 1,
                          backgroundColor: isSelected ? pColor : (isDark ? theme.surfaceSecondary : '#f8fafc'),
                          borderColor: isSelected ? pColor : (isDark ? theme.cardBorder : '#e2e8f0'),
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: 'Nunito_700Bold',
                            fontSize: 10,
                            textTransform: 'capitalize',
                            color: isSelected ? '#ffffff' : theme.textSecondary,
                          }}
                        >
                          {p}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Status */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textTertiary, marginBottom: 6 }}>
                  Status
                </Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {(['pending', 'submitted', 'graded'] as TaskStatus[]).map((s) => {
                    const isSelected = status === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={`Status ${s}`}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => {
                          triggerHaptic('light');
                          setStatus(s);
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 7,
                          alignItems: 'center',
                          borderRadius: 10,
                          borderWidth: 1,
                          backgroundColor: isSelected ? theme.primary : (isDark ? theme.surfaceSecondary : '#f8fafc'),
                          borderColor: isSelected ? theme.primary : (isDark ? theme.cardBorder : '#e2e8f0'),
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          style={{
                            fontFamily: 'Nunito_700Bold',
                            fontSize: 10,
                            textTransform: 'capitalize',
                            color: isSelected ? '#ffffff' : theme.textSecondary,
                          }}
                        >
                          {s}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Score Inputs (if graded) */}
            {status === 'graded' ? (
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textTertiary, marginBottom: 6 }}>
                    Earned Score
                  </Text>
                  <TextInput
                    keyboardType="numeric"
                    placeholder="e.g. 95"
                    placeholderTextColor={theme.textTertiary}
                    value={earnedScore}
                    onChangeText={setEarnedScore}
                    accessibilityLabel="Earned score input"
                    style={{
                      fontFamily: 'Nunito_600SemiBold',
                      fontSize: 14,
                      color: theme.text,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                      backgroundColor: isDark ? theme.surfaceSecondary : '#f8fafc',
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textTertiary, marginBottom: 6 }}>
                    Max Score
                  </Text>
                  <TextInput
                    keyboardType="numeric"
                    placeholder="100"
                    placeholderTextColor={theme.textTertiary}
                    value={maxScore}
                    onChangeText={setMaxScore}
                    accessibilityLabel="Max score input"
                    style={{
                      fontFamily: 'Nunito_600SemiBold',
                      fontSize: 14,
                      color: theme.text,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                      backgroundColor: isDark ? theme.surfaceSecondary : '#f8fafc',
                    }}
                  />
                </View>
              </View>
            ) : null}

            {/* Due Date & Time */}
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textTertiary, marginBottom: 6 }}>
              Deadline & Time
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Select due date, currently ${dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
                onPress={() => {
                  triggerHaptic('light');
                  setShowDatePicker(true);
                }}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                  backgroundColor: isDark ? theme.surfaceSecondary : '#f8fafc',
                }}
              >
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: theme.text }}>
                  {dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <Ionicons name="calendar-outline" size={16} color={theme.textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Select due time, currently ${formatAMPM(dueDate)}`}
                onPress={() => {
                  triggerHaptic('light');
                  setShowTimePicker(true);
                }}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                  backgroundColor: isDark ? theme.surfaceSecondary : '#f8fafc',
                }}
              >
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: theme.text }}>
                  {formatAMPM(dueDate)}
                </Text>
                <Ionicons name="time-outline" size={16} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Subtasks Builder */}
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textTertiary, marginBottom: 6 }}>
              Subtasks / Steps (Optional)
            </Text>
            {checklist.map((item, idx) => (
              <View
                key={item.id || idx}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: isDark ? theme.surfaceSecondary : '#f8fafc',
                  marginBottom: 4,
                }}
              >
                <Ionicons name="checkbox-outline" size={14} color={theme.primary} style={{ marginRight: 6 }} />
                <Text style={{ flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: theme.text }}>
                  {item.text}
                </Text>
                <TouchableOpacity
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove step ${item.text}`}
                  onPress={() => handleRemoveChecklistItem(idx)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="close" size={14} color={theme.textTertiary} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 20 }}>
              <TextInput
                placeholder="Add a step (e.g. Outline chapter 1)..."
                placeholderTextColor={theme.textTertiary}
                value={newChecklistText}
                onChangeText={setNewChecklistText}
                onSubmitEditing={handleAddChecklistItem}
                accessibilityLabel="New subtask step input"
                style={{
                  flex: 1,
                  fontFamily: 'Nunito_600SemiBold',
                  fontSize: 12,
                  color: theme.text,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                  backgroundColor: isDark ? theme.surfaceSecondary : '#f8fafc',
                }}
              />
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Add checklist step"
                onPress={handleAddChecklistItem}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: theme.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#ffffff' }}>Add</Text>
              </TouchableOpacity>
            </View>

            {/* Date Picker Modal/Component */}
            {showDatePicker && (
              <DateTimePicker
                value={dueDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    const newD = new Date(dueDate);
                    newD.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                    setDueDate(newD);
                  }
                }}
              />
            )}

            {/* Time Picker Modal/Component */}
            {showTimePicker && (
              <DateTimePicker
                value={dueDate}
                mode="time"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowTimePicker(false);
                  if (selectedDate) {
                    const newD = new Date(dueDate);
                    newD.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
                    setDueDate(newD);
                  }
                }}
              />
            )}
          </ScrollView>

          {/* Submit Button */}
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={editingTask ? 'Update Task' : 'Save Task'}
            onPress={handleSave}
            disabled={!title.trim() || !subjectId}
            style={{
              paddingVertical: 14,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: !title.trim() || !subjectId ? (isDark ? '#2a3140' : '#c7d2fe') : theme.primary,
              marginTop: 10,
              ...Shadows.md,
            }}
          >
            <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 15, color: '#ffffff' }}>
              {editingTask ? 'Update Task' : 'Save Task'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
