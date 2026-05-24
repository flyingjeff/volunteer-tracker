import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  deleteDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AttendanceSession, EventSite, TaskFeedback, VolunteerProfile, VolunteerTask } from "@/lib/types";

function toDate(value: unknown) {
  return value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : new Date();
}

function mapAttendance(id: string, data: Record<string, unknown>): AttendanceSession {
  return {
    id,
    eventId: String(data.eventId ?? ""),
    siteId: String(data.siteId ?? ""),
    volunteerId: String(data.volunteerId ?? ""),
    volunteerName: String(data.volunteerName ?? ""),
    status: data.status === "checked-out" ? "checked-out" : "checked-in",
    checkedInAt: toDate(data.checkedInAt),
    checkedOutAt: data.checkedOutAt ? toDate(data.checkedOutAt) : undefined,
    totalMinutes: typeof data.totalMinutes === "number" ? data.totalMinutes : undefined
  };
}

function mapTask(id: string, data: Record<string, unknown>): VolunteerTask {
  return {
    id,
    eventId: String(data.eventId ?? ""),
    siteId: String(data.siteId ?? ""),
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    status: data.status === "complete" ? "complete" : data.status === "in-progress" ? "in-progress" : "todo",
    assignedVolunteerIds: Array.isArray(data.assignedVolunteerIds) ? data.assignedVolunteerIds.map(String) : [],
    skillTags: Array.isArray(data.skillTags) ? data.skillTags.map(String) : [],
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt)
  };
}

function mapVolunteer(id: string, data: Record<string, unknown>): VolunteerProfile {
  return {
    id,
    firstName: String(data.firstName ?? ""),
    lastName: String(data.lastName ?? ""),
    phone: String(data.phone ?? ""),
    email: String(data.email ?? ""),
    skills: Array.isArray(data.skills) ? data.skills.map(String) : [],
    emergencyContact: String(data.emergencyContact ?? ""),
    notes: String(data.notes ?? ""),
    consentAcknowledged: Boolean(data.consentAcknowledged),
    browserTokenHash: String(data.browserTokenHash ?? ""),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt)
  };
}

function mapEvent(id: string, data: Record<string, unknown>): EventSite {
  return {
    id,
    name: String(data.name ?? ""),
    location: String(data.location ?? ""),
    startsAt: toDate(data.startsAt),
    endsAt: data.endsAt ? toDate(data.endsAt) : undefined,
    active: data.active !== false,
    createdAt: data.createdAt ? toDate(data.createdAt) : undefined,
    updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined
  };
}

function mapTaskFeedback(id: string, data: Record<string, unknown>): TaskFeedback {
  return {
    id,
    eventId: String(data.eventId ?? ""),
    siteId: String(data.siteId ?? ""),
    volunteerId: String(data.volunteerId ?? ""),
    volunteerName: String(data.volunteerName ?? ""),
    taskId: data.taskId ? String(data.taskId) : undefined,
    taskTitle: data.taskTitle ? String(data.taskTitle) : undefined,
    kind: data.kind === "more-tasks-request" ? "more-tasks-request" : "task-note",
    message: String(data.message ?? ""),
    createdAt: toDate(data.createdAt)
  };
}

export async function findVolunteerByTokenHash(tokenHash: string) {
  const match = await getDoc(doc(db, "volunteers", tokenHash));
  return match.exists() ? mapVolunteer(match.id, match.data()) : null;
}

export async function upsertVolunteer(
  tokenHash: string,
  profile: Omit<VolunteerProfile, "id" | "browserTokenHash" | "createdAt" | "updatedAt">
) {
  const payload = {
    ...profile,
    browserTokenHash: tokenHash,
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db, "volunteers", tokenHash), {
    ...payload,
    createdAt: serverTimestamp()
  }, { merge: true });
  return tokenHash;
}

function activeSessionId(eventId: string, siteId: string, tokenHash: string) {
  return `${eventId}_${siteId}_${tokenHash}`;
}

export async function checkIn(eventId: string, siteId: string, volunteer: VolunteerProfile, tokenHash: string) {
  const sessionRef = doc(db, "attendanceSessions", activeSessionId(eventId, siteId, tokenHash));

  await setDoc(sessionRef, {
    eventId,
    siteId,
    volunteerId: volunteer.id,
    volunteerTokenHash: tokenHash,
    volunteerName: `${volunteer.firstName} ${volunteer.lastName}`.trim(),
    status: "checked-in",
    checkedInAt: serverTimestamp()
  }, { merge: true });

  return sessionRef.id;
}

export async function checkOut(session: AttendanceSession) {
  const checkedOutAt = new Date();
  const totalMinutes = Math.max(0, Math.round((checkedOutAt.getTime() - session.checkedInAt.getTime()) / 60000));
  await updateDoc(doc(db, "attendanceSessions", session.id), {
    status: "checked-out",
    checkedOutAt,
    totalMinutes
  });
}

function byNewestDate<T extends { createdAt?: Date; checkedInAt?: Date }>(a: T, b: T) {
  const aDate = a.createdAt ?? a.checkedInAt ?? new Date(0);
  const bDate = b.createdAt ?? b.checkedInAt ?? new Date(0);
  return bDate.getTime() - aDate.getTime();
}

export function watchEvent(eventId: string, callback: (event: EventSite | null) => void) {
  return onSnapshot(doc(db, "events", eventId), (snapshot) =>
    callback(snapshot.exists() ? mapEvent(snapshot.id, snapshot.data()) : null)
  );
}

export function watchVolunteerAttendanceSession(
  eventId: string,
  siteId: string,
  tokenHash: string,
  callback: (session: AttendanceSession | null) => void
) {
  return onSnapshot(doc(db, "attendanceSessions", activeSessionId(eventId, siteId, tokenHash)), (snapshot) => {
    if (!snapshot.exists() || snapshot.data().status !== "checked-in") {
      callback(null);
      return;
    }

    callback(mapAttendance(snapshot.id, snapshot.data()));
  });
}

export function watchLiveAttendance(eventId: string, callback: (sessions: AttendanceSession[]) => void) {
  return onSnapshot(
    query(collection(db, "attendanceSessions"), where("eventId", "==", eventId)),
    (snapshot) =>
      callback(
        snapshot.docs
          .map((item) => mapAttendance(item.id, item.data()))
          .filter((item) => item.status === "checked-in")
          .sort(byNewestDate)
      )
  );
}

export function watchAttendanceHistory(eventId: string, callback: (sessions: AttendanceSession[]) => void) {
  return onSnapshot(
    query(collection(db, "attendanceSessions"), where("eventId", "==", eventId), limit(75)),
    (snapshot) => callback(snapshot.docs.map((item) => mapAttendance(item.id, item.data())).sort(byNewestDate))
  );
}

export function watchTasks(eventId: string, callback: (tasks: VolunteerTask[]) => void) {
  return onSnapshot(
    query(collection(db, "tasks"), where("eventId", "==", eventId)),
    (snapshot) => callback(snapshot.docs.map((item) => mapTask(item.id, item.data())).sort(byNewestDate))
  );
}

export function watchVolunteers(callback: (volunteers: VolunteerProfile[]) => void) {
  return onSnapshot(query(collection(db, "volunteers"), orderBy("lastName", "asc")), (snapshot) =>
    callback(snapshot.docs.map((item) => mapVolunteer(item.id, item.data())))
  );
}

export async function saveTask(task: Partial<VolunteerTask> & Pick<VolunteerTask, "eventId" | "siteId" | "title">) {
  const payload = {
    eventId: task.eventId,
    siteId: task.siteId,
    title: task.title,
    description: task.description ?? "",
    status: task.status ?? "todo",
    assignedVolunteerIds: task.assignedVolunteerIds ?? [],
    skillTags: task.skillTags ?? [],
    updatedAt: serverTimestamp()
  };

  if (task.id) {
    await setDoc(doc(db, "tasks", task.id), payload, { merge: true });
    return task.id;
  }

  const ref = await addDoc(collection(db, "tasks"), {
    ...payload,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function deleteTask(taskId: string) {
  await deleteDoc(doc(db, "tasks", taskId));
}

export function watchEvents(callback: (events: EventSite[]) => void) {
  return onSnapshot(query(collection(db, "events"), orderBy("startsAt", "desc")), (snapshot) =>
    callback(snapshot.docs.map((item) => mapEvent(item.id, item.data())))
  );
}

export async function saveEvent(event: Partial<EventSite> & Pick<EventSite, "name" | "location" | "startsAt" | "active">) {
  const payload = {
    name: event.name,
    location: event.location,
    startsAt: event.startsAt,
    endsAt: event.endsAt ?? null,
    active: event.active,
    updatedAt: serverTimestamp()
  };

  if (event.id) {
    await setDoc(doc(db, "events", event.id), payload, { merge: true });
    return event.id;
  }

  const ref = await addDoc(collection(db, "events"), {
    ...payload,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function deleteEvent(eventId: string) {
  await deleteDoc(doc(db, "events", eventId));
}

export async function addTaskFeedback(
  feedback: Omit<TaskFeedback, "id" | "createdAt">
) {
  const ref = await addDoc(collection(db, "taskFeedback"), {
    ...feedback,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export function watchTaskFeedback(eventId: string, callback: (feedback: TaskFeedback[]) => void) {
  return onSnapshot(
    query(collection(db, "taskFeedback"), where("eventId", "==", eventId), limit(75)),
    (snapshot) => callback(snapshot.docs.map((item) => mapTaskFeedback(item.id, item.data())).sort(byNewestDate))
  );
}
