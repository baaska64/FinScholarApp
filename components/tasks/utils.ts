import { Vibration, Platform } from 'react-native';
import { TaskItem, TaskPriority, TaskStatus, ChecklistItem } from './types';

/**
 * Safely parses any date representation (ISO string, legacy YYYY-MM-DD, or Date object)
 * into a valid JavaScript Date object, returning null if empty or invalid.
 */
export function parseDueDate(dueDateStr?: string | null): Date | null {
  if (!dueDateStr || typeof dueDateStr !== 'string') return null;
  const trimmed = dueDateStr.trim();
  if (!trimmed) return null;

  if (!trimmed.includes('T')) {
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m, d, 23, 59, 59);
      }
    }
  }

  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats a Date object to 12-hour AM/PM string (e.g. "11:59 PM")
 */
export function formatAMPM(date: Date): string {
  if (!date || isNaN(date.getTime())) return '';
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutesStr} ${ampm}`;
}

/**
 * Calculates human-readable urgency time-left string
 */
export function getTimeLeftText(dueDateStr?: string | null, nowMs: number = Date.now()): string {
  const due = parseDueDate(dueDateStr);
  if (!due) return 'No Due Date';

  const diff = due.getTime() - nowMs;
  if (diff <= 0) return 'Overdue';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) return `${days} day${days > 1 ? 's' : ''} left`;
  if (hours >= 1) return `${hours} hr${hours > 1 ? 's' : ''} ${minutes % 60} min${minutes % 60 !== 1 ? 's' : ''} left`;
  if (minutes >= 1) return `${minutes}m ${seconds % 60}s left`;
  return `${seconds}s left`;
}

/**
 * Returns color tokens for urgency badge based on remaining time and dark mode
 */
export function getUrgencyColor(timeLeftText: string, isDark: boolean) {
  if (timeLeftText === 'Overdue') {
    return {
      bg: isDark ? 'rgba(239,68,68,0.18)' : '#fef2f2',
      text: '#ef4444',
      icon: '#ef4444',
      border: isDark ? 'rgba(239,68,68,0.4)' : '#fecaca',
    };
  }
  if (timeLeftText.includes('day') || timeLeftText === 'No Due Date') {
    return {
      bg: isDark ? 'rgba(34,197,94,0.15)' : '#f0fdf4',
      text: isDark ? '#4ade80' : '#16a34a',
      icon: isDark ? '#4ade80' : '#16a34a',
      border: isDark ? 'rgba(34,197,94,0.35)' : '#bbf7d0',
    };
  }
  if (timeLeftText.includes('hr')) {
    return {
      bg: isDark ? 'rgba(245,158,11,0.18)' : '#fffbeb',
      text: '#f59e0b',
      icon: '#f59e0b',
      border: isDark ? 'rgba(245,158,11,0.4)' : '#fde68a',
    };
  }
  return {
    bg: isDark ? 'rgba(249,115,22,0.18)' : '#fff7ed',
    text: '#f97316',
    icon: '#f97316',
    border: isDark ? 'rgba(249,115,22,0.4)' : '#fed7aa',
  };
}

/**
 * Formats seconds into MM:SS
 */
export function formatTimer(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Universal safe haptic feedback trigger for physical devices with silent fallback
 */
export function triggerHaptic(type: 'light' | 'medium' | 'success' | 'warning' = 'light'): void {
  try {
    if (Platform.OS === 'android') {
      switch (type) {
        case 'light':
          Vibration.vibrate(12);
          break;
        case 'medium':
          Vibration.vibrate(28);
          break;
        case 'success':
          Vibration.vibrate([0, 15, 60, 20]);
          break;
        case 'warning':
          Vibration.vibrate([0, 30, 80, 40]);
          break;
      }
    } else if (Platform.OS === 'ios') {
      switch (type) {
        case 'light':
          Vibration.vibrate(10);
          break;
        case 'medium':
          Vibration.vibrate(20);
          break;
        case 'success':
          Vibration.vibrate([0, 10, 50, 15]);
          break;
        case 'warning':
          Vibration.vibrate([0, 20, 60, 25]);
          break;
      }
    } else {
      Vibration.vibrate(15);
    }
  } catch {
    // Graceful fallback for non-vibration or unsupported platforms
  }
}

/**
 * Robustly sanitizes numeric scores and max scores preventing NaN or negative values
 */
export function sanitizeScore(val: string | number | undefined | null, defaultVal: number = 0, isMax: boolean = false): number {
  if (val === undefined || val === null || val === '') return defaultVal;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num) || !isFinite(num)) return defaultVal;
  if (isMax) {
    return num > 0 ? num : defaultVal;
  }
  return num >= 0 ? num : 0;
}
