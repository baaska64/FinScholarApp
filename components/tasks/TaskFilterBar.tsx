import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { getTheme, Typography, Radius, Shadows } from '@/constants/Theme';
import { SubjectOption, StatusFilterOption, SortOption } from './types';
import { triggerHaptic } from './utils';

export interface TaskFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  subjects: SubjectOption[];
  selectedSubjectId: string;
  onSelectSubject: (subjectId: string) => void;
  selectedStatus: StatusFilterOption;
  onSelectStatus: (status: StatusFilterOption) => void;
  selectedSort: SortOption;
  onSelectSort: (sort: SortOption) => void;
  countsBySubject?: Record<string, number>;
  countsByStatus?: Record<StatusFilterOption, number>;
}

const STATUS_OPTIONS: { key: StatusFilterOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'All Tasks', icon: 'layers-outline' },
  { key: 'pending', label: 'Pending', icon: 'hourglass-outline' },
  { key: 'submitted', label: 'Submitted', icon: 'checkmark-circle-outline' },
  { key: 'graded', label: 'Graded', icon: 'ribbon-outline' },
  { key: 'overdue', label: 'Overdue', icon: 'alert-circle-outline' },
];

const SORT_OPTIONS: { key: SortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'dueDate', label: 'Due Date', icon: 'calendar-outline' },
  { key: 'priority', label: 'Priority', icon: 'flag-outline' },
  { key: 'title', label: 'Title', icon: 'text-outline' },
  { key: 'status', label: 'Status', icon: 'list-outline' },
];

export default function TaskFilterBar({
  searchQuery,
  onSearchChange,
  subjects,
  selectedSubjectId,
  onSelectSubject,
  selectedStatus,
  onSelectStatus,
  selectedSort,
  onSelectSort,
  countsBySubject = {},
  countsByStatus,
}: TaskFilterBarProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);

  const [showSortMenu, setShowSortMenu] = useState(false);

  const activeSortLabel = SORT_OPTIONS.find((s) => s.key === selectedSort)?.label || 'Due Date';

  return (
    <View style={{ marginBottom: 16 }}>
      {/* Search Bar & Sort Button Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: isDark ? theme.cardBorder : '#e2e8f0',
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Ionicons name="search" size={16} color={theme.textTertiary} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search tasks..."
            placeholderTextColor={theme.textTertiary}
            value={searchQuery}
            onChangeText={onSearchChange}
            accessibilityLabel="Search tasks"
            accessibilityHint="Filter tasks by title, description, or subject name"
            style={{
              flex: 1,
              fontFamily: 'Nunito_600SemiBold',
              fontSize: 13,
              color: theme.text,
              padding: 0,
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Clear search input"
              onPress={() => {
                triggerHaptic('light');
                onSearchChange('');
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Sort Button */}
        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Sort menu, current sort: ${activeSortLabel}`}
          accessibilityHint="Toggles sort options drawer"
          onPress={() => {
            triggerHaptic('light');
            setShowSortMenu(!showSortMenu);
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: isDark ? theme.cardBorder : '#e2e8f0',
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Ionicons name="swap-vertical" size={14} color={theme.primary} style={{ marginRight: 4 }} />
          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textSecondary }}>
            {activeSortLabel}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sort Menu Dropdown Drawer (if toggled) */}
      {showSortMenu && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
            borderRadius: 14,
            padding: 8,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: isDark ? theme.cardBorder : '#e2e8f0',
          }}
        >
          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textTertiary, width: '100%', marginBottom: 2 }}>
            Sort by:
          </Text>
          {SORT_OPTIONS.map((opt) => {
            const isSelected = selectedSort === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${opt.label}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  triggerHaptic('light');
                  onSelectSort(opt.key);
                  setShowSortMenu(false);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  backgroundColor: isSelected ? theme.primary : (isDark ? theme.surface : '#ffffff'),
                  borderWidth: 1,
                  borderColor: isSelected ? theme.primary : (isDark ? theme.cardBorder : '#e2e8f0'),
                }}
              >
                <Ionicons
                  name={opt.icon}
                  size={12}
                  color={isSelected ? '#ffffff' : theme.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={{
                    fontFamily: 'Nunito_700Bold',
                    fontSize: 11,
                    color: isSelected ? '#ffffff' : theme.textSecondary,
                  }}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Subject Filter Chips */}
      {subjects.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 2 }}>
            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Filter by all subjects"
              accessibilityState={{ selected: selectedSubjectId === 'ALL' }}
              onPress={() => {
                triggerHaptic('light');
                onSelectSubject('ALL');
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 12,
                borderWidth: 1,
                backgroundColor: selectedSubjectId === 'ALL' ? theme.primary : theme.surface,
                borderColor: selectedSubjectId === 'ALL' ? theme.primary : (isDark ? theme.cardBorder : '#e2e8f0'),
                ...(!isDark && selectedSubjectId === 'ALL' ? Shadows.sm : {}),
              }}
            >
              <Text
                style={{
                  fontFamily: 'Nunito_700Bold',
                  fontSize: 11,
                  color: selectedSubjectId === 'ALL' ? '#ffffff' : theme.textSecondary,
                }}
              >
                All Subjects
              </Text>
            </TouchableOpacity>

            {subjects.map((sub) => {
              const isSelected = selectedSubjectId === sub.id;
              const count = countsBySubject[sub.id];
              return (
                <TouchableOpacity
                  key={sub.id}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by subject ${sub.name}${count !== undefined ? `, ${count} tasks` : ''}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    triggerHaptic('light');
                    onSelectSubject(sub.id);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 12,
                    borderWidth: 1,
                    backgroundColor: isSelected ? theme.primary : theme.surface,
                    borderColor: isSelected ? theme.primary : (isDark ? theme.cardBorder : '#e2e8f0'),
                    ...(!isDark && isSelected ? Shadows.sm : {}),
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
                  {count !== undefined && count > 0 && (
                    <View
                      style={{
                        marginLeft: 6,
                        paddingHorizontal: 5,
                        paddingVertical: 1,
                        borderRadius: 6,
                        backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : (isDark ? theme.surfaceSecondary : '#f1f5f9'),
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'Nunito_700Bold',
                          fontSize: 9,
                          color: isSelected ? '#ffffff' : theme.textSecondary,
                        }}
                      >
                        {count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Status Segment Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {STATUS_OPTIONS.map((item) => {
            const isSelected = selectedStatus === item.key;
            const count = countsByStatus ? countsByStatus[item.key] : undefined;
            return (
              <TouchableOpacity
                key={item.key}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${item.label} status${count !== undefined ? `, ${count} tasks` : ''}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  triggerHaptic('light');
                  onSelectStatus(item.key);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 10,
                  borderWidth: 1,
                  backgroundColor: isSelected ? (isDark ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff') : (isDark ? theme.surfaceSecondary : '#f8fafc'),
                  borderColor: isSelected ? theme.primary : (isDark ? theme.cardBorder : '#e2e8f0'),
                }}
              >
                <Ionicons
                  name={item.icon}
                  size={12}
                  color={isSelected ? theme.primary : theme.textTertiary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{
                    fontFamily: 'Nunito_700Bold',
                    fontSize: 11,
                    color: isSelected ? theme.primary : theme.textSecondary,
                  }}
                >
                  {item.label}
                </Text>
                {count !== undefined && count > 0 && (
                  <View
                    style={{
                      marginLeft: 4,
                      paddingHorizontal: 4,
                      paddingVertical: 1,
                      borderRadius: 6,
                      backgroundColor: isSelected ? theme.primary : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Nunito_700Bold',
                        fontSize: 9,
                        color: isSelected ? '#ffffff' : theme.textSecondary,
                      }}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
