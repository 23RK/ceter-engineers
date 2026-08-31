import type { ProjectStatus, TaskPriority, TaskStatus } from "@prisma/client";

export const TASK_STATUSES: {
  value: TaskStatus;
  label: string;
  badge: string;
}[] = [
  { value: "TODO", label: "לביצוע", badge: "bg-slate-100 text-slate-700" },
  {
    value: "IN_PROGRESS",
    label: "בתהליך",
    badge: "bg-blue-100 text-blue-700",
  },
  {
    value: "REVIEW",
    label: "לבדיקה",
    badge: "bg-amber-100 text-amber-700",
  },
  { value: "DONE", label: "הושלם", badge: "bg-green-100 text-green-700" },
];

export const TASK_PRIORITIES: {
  value: TaskPriority;
  label: string;
  badge: string;
  dot: string;
}[] = [
  {
    value: "LOW",
    label: "נמוכה",
    badge: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
  },
  {
    value: "MEDIUM",
    label: "בינונית",
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
  },
  {
    value: "HIGH",
    label: "גבוהה",
    badge: "bg-orange-100 text-orange-700",
    dot: "bg-orange-500",
  },
  {
    value: "URGENT",
    label: "דחוף",
    badge: "bg-red-100 text-red-700",
    dot: "bg-red-500",
  },
];

export const PROJECT_STATUSES: {
  value: ProjectStatus;
  label: string;
  badge: string;
}[] = [
  {
    value: "PLANNING",
    label: "בתכנון",
    badge: "bg-purple-100 text-purple-700",
  },
  { value: "ACTIVE", label: "פעיל", badge: "bg-green-100 text-green-700" },
  {
    value: "ON_HOLD",
    label: "מוקפא",
    badge: "bg-amber-100 text-amber-700",
  },
  { value: "DONE", label: "הושלם", badge: "bg-slate-200 text-slate-700" },
  { value: "CANCELED", label: "בוטל", badge: "bg-red-100 text-red-700" },
];

export function taskStatusMeta(status: TaskStatus) {
  return TASK_STATUSES.find((s) => s.value === status)!;
}

export function taskPriorityMeta(priority: TaskPriority) {
  return TASK_PRIORITIES.find((p) => p.value === priority)!;
}

export function projectStatusMeta(status: ProjectStatus) {
  return PROJECT_STATUSES.find((s) => s.value === status)!;
}
