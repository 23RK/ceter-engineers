import type {
  Lead,
  LeadTask,
  Meeting,
  Milestone,
  Project,
  Task,
  User,
} from "@prisma/client";

export type UserOption = Pick<User, "id" | "name" | "color">;

/** Only safe user fields ever go to the browser (never email / password hash). */
export const USER_OPTION_SELECT = { id: true, name: true, color: true } as const;

export type TaskWithRelations = Task & {
  assignee: UserOption | null;
  project: Project | null;
};
export type ProjectOption = Pick<Project, "id" | "name" | "status">;

export type ProjectWithRelations = Project & {
  milestones: Milestone[];
  tasks: TaskWithRelations[];
};

export type LeadWithTasks = Lead & {
  tasks: LeadTask[];
};

export type MeetingWithCreator = Meeting & {
  createdBy: UserOption;
};
