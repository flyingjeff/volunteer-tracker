import {
  addDoc,
  arrayUnion,
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
import type { ActivityLog, AttendanceSession, EventSite, TaskFeedback, VolunteerProfile, VolunteerTask } from "@/lib/types";

function toDate(value: unknown) {
  return value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : new Date();
}

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
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
    dateOfBirth: String(data.dateOfBirth ?? ""),
    skills: Array.isArray(data.skills) ? data.skills.map(String) : [],
    emergencyContact: String(data.emergencyContact ?? ""),
    guardianName: String(data.guardianName ?? ""),
    guardianPhone: String(data.guardianPhone ?? ""),
    guardianEmail: String(data.guardianEmail ?? ""),
    waiverSignerName: String(data.waiverSignerName ?? ""),
    waiverSignedBy: data.waiverSignedBy === "guardian" ? "guardian" : data.waiverSignedBy === "volunteer" ? "volunteer" : "",
    waiverAcknowledgedAt: data.waiverAcknowledgedAt ? toDate(data.waiverAcknowledgedAt) : undefined,
    waiverTextVersion: String(data.waiverTextVersion ?? ""),
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

function mapActivityLog(id: string, data: Record<string, unknown>): ActivityLog {
  const kind = String(data.kind ?? "");

  return {
    id,
    eventId: String(data.eventId ?? ""),
    siteId: String(data.siteId ?? ""),
    kind:
      kind === "check-out" ||
      kind === "task-assigned" ||
      kind === "task-unassigned" ||
      kind === "task-joined" ||
      kind === "task-complete" ||
      kind === "volunteer-created"
        ? kind
        : "check-in",
    volunteerId: data.volunteerId ? String(data.volunteerId) : undefined,
    volunteerName: data.volunteerName ? String(data.volunteerName) : undefined,
    taskId: data.taskId ? String(data.taskId) : undefined,
    taskTitle: data.taskTitle ? String(data.taskTitle) : undefined,
    message: String(data.message ?? ""),
    createdAt: toDate(data.createdAt)
  };
}

function volunteerName(volunteer: Pick<VolunteerProfile, "firstName" | "lastName">) {
  return `${volunteer.firstName} ${volunteer.lastName}`.trim();
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dateSlug(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function getAvailableEventId(name: string, startsAt: Date) {
  const baseId = [slugify(name), dateSlug(startsAt)].filter(Boolean).join("-") || `event-${dateSlug(startsAt)}`;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const eventId = attempt === 0 ? baseId : `${baseId}-${attempt + 1}`;
    const existing = await getDoc(doc(db, "events", eventId));
    if (!existing.exists()) return eventId;
  }

  return `${baseId}-${Date.now()}`;
}

export async function findVolunteerByTokenHash(tokenHash: string) {
  const match = await getDoc(doc(db, "volunteers", tokenHash));
  return match.exists() ? mapVolunteer(match.id, match.data()) : null;
}

export async function upsertVolunteer(
  tokenHash: string,
  profile: Omit<VolunteerProfile, "id" | "browserTokenHash" | "createdAt" | "updatedAt">
) {
  const volunteerRef = doc(db, "volunteers", tokenHash);
  const existing = await getDoc(volunteerRef);
  const payload = {
    ...profile,
    browserTokenHash: tokenHash,
    updatedAt: serverTimestamp()
  };

  await setDoc(volunteerRef, withoutUndefined({
    ...payload,
    ...(existing.exists() ? {} : { createdAt: serverTimestamp() })
  }), { merge: true });
  return tokenHash;
}

export async function saveManagedVolunteer(
  volunteerId: string,
  profile: Omit<VolunteerProfile, "id" | "browserTokenHash" | "createdAt" | "updatedAt">
) {
  const volunteerRef = doc(db, "volunteers", volunteerId);
  const existing = await getDoc(volunteerRef);

  await setDoc(volunteerRef, withoutUndefined({
    ...profile,
    browserTokenHash: volunteerId,
    updatedAt: serverTimestamp(),
    ...(existing.exists() ? {} : { createdAt: serverTimestamp() })
  }), { merge: true });

  return volunteerId;
}

export async function saveVolunteerLookup(lookupId: string, volunteerId: string) {
  await setDoc(doc(db, "volunteerLookups", lookupId), {
    volunteerId,
    updatedAt: serverTimestamp()
  });
}

export async function deleteVolunteer(volunteerId: string) {
  await deleteDoc(doc(db, "volunteers", volunteerId));
}

export async function findVolunteerByLookup(lookupId: string) {
  const lookup = await getDoc(doc(db, "volunteerLookups", lookupId));
  if (!lookup.exists()) return null;

  const volunteerId = String(lookup.data().volunteerId ?? "");
  if (!volunteerId) return null;

  const volunteer = await getDoc(doc(db, "volunteers", volunteerId));
  return volunteer.exists() ? mapVolunteer(volunteer.id, volunteer.data()) : null;
}

function activeSessionId(eventId: string, siteId: string, tokenHash: string) {
  return `${eventId}_${siteId}_${tokenHash}`;
}

export async function checkIn(eventId: string, siteId: string, volunteer: VolunteerProfile, tokenHash: string) {
  const sessionRef = doc(db, "attendanceSessions", activeSessionId(eventId, siteId, tokenHash));
  const name = volunteerName(volunteer);

  await setDoc(sessionRef, {
    eventId,
    siteId,
    volunteerId: volunteer.id,
    volunteerTokenHash: tokenHash,
    volunteerName: name,
    status: "checked-in",
    checkedInAt: serverTimestamp()
  }, { merge: true });

  await addActivityLog({
    eventId,
    siteId,
    kind: "check-in",
    volunteerId: volunteer.id,
    volunteerName: name,
    message: `${name} checked in.`
  });

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

  await addActivityLog({
    eventId: session.eventId,
    siteId: session.siteId,
    kind: "check-out",
    volunteerId: session.volunteerId,
    volunteerName: session.volunteerName,
    message: `${session.volunteerName} checked out after ${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}.`
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

export async function joinTask(task: VolunteerTask, volunteer: VolunteerProfile) {
  const name = volunteerName(volunteer);

  await updateDoc(doc(db, "tasks", task.id), {
    assignedVolunteerIds: arrayUnion(volunteer.id),
    updatedAt: serverTimestamp()
  });

  await addActivityLog({
    eventId: task.eventId,
    siteId: task.siteId,
    kind: "task-joined",
    volunteerId: volunteer.id,
    volunteerName: name,
    taskId: task.id,
    taskTitle: task.title,
    message: `${name} added themselves to ${task.title}.`
  });
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

  const eventId = await getAvailableEventId(event.name, event.startsAt);
  await setDoc(doc(db, "events", eventId), {
    ...payload,
    createdAt: serverTimestamp()
  });
  return eventId;
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

export async function addActivityLog(log: Omit<ActivityLog, "id" | "createdAt">) {
  const ref = await addDoc(collection(db, "activityLogs"), {
    ...log,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export function watchActivityLogs(eventId: string, callback: (logs: ActivityLog[]) => void) {
  return onSnapshot(
    query(collection(db, "activityLogs"), where("eventId", "==", eventId), limit(250)),
    (snapshot) => callback(snapshot.docs.map((item) => mapActivityLog(item.id, item.data())).sort(byNewestDate))
  );
}
