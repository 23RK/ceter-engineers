import type {
  Lead,
  LeadTask,
  Milestone,
  Project,
  Task,
  User,
} from "@prisma/client";

export type TaskWithRelations = Task & {
  assignee: User | null;
  project: Project | null;
};

export type UserOption = Pick<User, "id" | "name" | "color">;
export type ProjectOption = Pick<Project, "id" | "name" | "status">;

export type ProjectWithRelations = Project & {
  milestones: Milestone[];
  tasks: TaskWithRelations[];
};

export type LeadWithTasks = Lead & {
  tasks: LeadTask[];
};
