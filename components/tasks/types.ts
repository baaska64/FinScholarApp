export type TaskStatus = 'pending' | 'submitted' | 'graded';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  subjectId: string;
  subjectName?: string;
  linkedComponentId?: string | null;
  earnedScore?: number;
  maxScore?: number;
  gradeItemId?: string;
  checklist?: ChecklistItem[];
}

export type SortOption = 'dueDate' | 'priority' | 'title' | 'status';
export type StatusFilterOption = 'all' | 'pending' | 'submitted' | 'graded' | 'overdue';

export interface SubjectOption {
  id: string;
  name: string;
  units?: number;
}

export interface GradeComponentOption {
  id: string;
  label: string;
}
