export type VolunteerProfile = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  skills: string[];
  emergencyContact: string;
  notes: string;
  consentAcknowledged: boolean;
  browserTokenHash: string;
  createdAt: Date;
  updatedAt: Date;
};

export type VolunteerLookup = {
  id: string;
  volunteerId: string;
  updatedAt?: Date;
};

export type AttendanceStatus = "checked-in" | "checked-out";

export type AttendanceSession = {
  id: string;
  eventId: string;
  siteId: string;
  volunteerId: string;
  volunteerName: string;
  status: AttendanceStatus;
  checkedInAt: Date;
  checkedOutAt?: Date;
  totalMinutes?: number;
};

export type TaskStatus = "todo" | "in-progress" | "complete";

export type VolunteerTask = {
  id: string;
  eventId: string;
  siteId: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignedVolunteerIds: string[];
  skillTags: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type EventSite = {
  id: string;
  name: string;
  location: string;
  startsAt: Date;
  endsAt?: Date;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TaskFeedbackKind = "task-note" | "more-tasks-request";

export type TaskFeedback = {
  id: string;
  eventId: string;
  siteId: string;
  volunteerId: string;
  volunteerName: string;
  taskId?: string;
  taskTitle?: string;
  kind: TaskFeedbackKind;
  message: string;
  createdAt: Date;
};
