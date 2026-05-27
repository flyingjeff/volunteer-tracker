"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, ClipboardList, Copy, Download, LogIn, LogOut, Pencil, Plus, QrCode, Search, ShieldCheck, Trash2, UsersRound, X } from "lucide-react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import QRCode from "qrcode";
import { Button, Field, TextArea } from "@/components/ui";
import { KanbanBoard } from "@/components/KanbanBoard";
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase";
import {
  addActivityLog,
  deleteEvent,
  deleteTask,
  deleteVolunteer,
  saveEvent,
  saveManagedVolunteer,
  saveTask,
  saveVolunteerLookup,
  watchActivityLogs,
  watchAttendanceHistory,
  watchEvents,
  watchLiveAttendance,
  watchTaskFeedback,
  watchTasks,
  watchVolunteers
} from "@/lib/firebaseService";
import { getVolunteerLookupIds } from "@/lib/volunteerLookup";
import type { ActivityLog, AttendanceSession, EventSite, TaskFeedback, TaskStatus, VolunteerProfile, VolunteerTask } from "@/lib/types";

const siteId = "main";

type TaskForm = {
  id?: string;
  title: string;
  description: string;
  skillTags: string;
};

const emptyTask: TaskForm = {
  title: "",
  description: "",
  skillTags: ""
};

type EventForm = {
  id?: string;
  name: string;
  location: string;
  startsAt: string;
  active: boolean;
};

type SupervisorView = "tasks" | "attendance" | "volunteers";

type VolunteerForm = {
  id?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  skills: string;
  emergencyContact: string;
  notes: string;
  consentAcknowledged: boolean;
};

const emptyEvent: EventForm = {
  name: "",
  location: "",
  startsAt: "",
  active: true
};

const emptyVolunteer: VolunteerForm = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  skills: "",
  emergencyContact: "",
  notes: "",
  consentAcknowledged: true
};

function toDateTimeInputValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function createVolunteerId() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function SupervisorPage() {
  const configured = isFirebaseConfigured();
  const supervisorDomain = process.env.NEXT_PUBLIC_SUPERVISOR_EMAIL_DOMAIN?.trim().toLowerCase() ?? "";
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceSession[]>([]);
  const [history, setHistory] = useState<AttendanceSession[]>([]);
  const [tasks, setTasks] = useState<VolunteerTask[]>([]);
  const [feedback, setFeedback] = useState<TaskFeedback[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>([]);
  const [events, setEvents] = useState<EventSite[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [pendingEventId, setPendingEventId] = useState("");
  const [eventForm, setEventForm] = useState<EventForm>(emptyEvent);
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTask);
  const [volunteerForm, setVolunteerForm] = useState<VolunteerForm>(emptyVolunteer);
  const [selectedVolunteerId, setSelectedVolunteerId] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const [copiedEventId, setCopiedEventId] = useState("");
  const [activeView, setActiveView] = useState<SupervisorView>("tasks");
  const [eventMenuOpen, setEventMenuOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const setupComplete = configured && Boolean(supervisorDomain);
  const userEmail = user?.email?.toLowerCase() ?? "";
  const isAuthorizedSupervisor = Boolean(user && supervisorDomain && userEmail.endsWith(`@${supervisorDomain}`));
  const hasSupervisorAccess = setupComplete && isAuthorizedSupervisor;
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const pendingEvent = events.find((event) => event.id === pendingEventId) ?? null;

  useEffect(() => {
    if (!setupComplete) {
      setAuthReady(true);
      return;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
  }, [setupComplete]);

  useEffect(() => {
    if (!hasSupervisorAccess) return;
    const unsubEvents = watchEvents(setEvents);
    const unsubVolunteers = watchVolunteers(setVolunteers);

    return () => {
      unsubEvents();
      unsubVolunteers();
    };
  }, [hasSupervisorAccess]);

  useEffect(() => {
    if (!hasSupervisorAccess || events.length === 0) return;

    const savedEventId = typeof window === "undefined" ? "" : window.localStorage.getItem("selectedEventId") ?? "";
    const savedEvent = events.find((event) => event.id === savedEventId);
    const selectedStillExists = selectedEventId && events.some((event) => event.id === selectedEventId);

    if (!selectedEventId) {
      setSelectedEventId(savedEvent?.id ?? events.find((event) => event.active)?.id ?? events[0].id);
      return;
    }

    if (!selectedStillExists) {
      setSelectedEventId(savedEvent?.id ?? events.find((event) => event.active)?.id ?? events[0].id);
    }
  }, [events, hasSupervisorAccess, selectedEventId]);

  useEffect(() => {
    if (!selectedEventId || typeof window === "undefined") return;
    window.localStorage.setItem("selectedEventId", selectedEventId);
  }, [selectedEventId]);

  useEffect(() => {
    if (!hasSupervisorAccess || !selectedEventId) {
      setAttendance([]);
      setHistory([]);
      setTasks([]);
      setFeedback([]);
      setActivityLogs([]);
      return;
    }

    const unsubAttendance = watchLiveAttendance(selectedEventId, setAttendance);
    const unsubHistory = watchAttendanceHistory(selectedEventId, setHistory);
    const unsubTasks = watchTasks(selectedEventId, setTasks);
    const unsubFeedback = watchTaskFeedback(selectedEventId, setFeedback);
    const unsubActivityLogs = watchActivityLogs(selectedEventId, setActivityLogs);

    return () => {
      unsubAttendance();
      unsubHistory();
      unsubTasks();
      unsubFeedback();
      unsubActivityLogs();
    };
  }, [hasSupervisorAccess, selectedEventId]);

  const filteredVolunteers = useMemo(() => {
    const query = skillQuery.trim().toLowerCase();
    if (!query) return volunteers;
    return volunteers.filter((volunteer) =>
      [volunteer.firstName, volunteer.lastName, volunteer.email, volunteer.phone, volunteer.notes, ...volunteer.skills]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [skillQuery, volunteers]);

  const totalMinutes = history.reduce((sum, item) => sum + (item.totalMinutes ?? 0), 0);

  async function handleSignIn() {
    if (!setupComplete) return;
    setErrorMessage("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in with Google.");
    }
  }

  async function handleSaveTask() {
    if (!taskForm.title.trim() || !selectedEventId) return;
    setErrorMessage("");
    setSaving(true);
    const payload = {
      id: taskForm.id,
      eventId: selectedEventId,
      siteId,
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      skillTags: taskForm.skillTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    };

    try {
      if (hasSupervisorAccess) await saveTask(payload);
      setTaskForm(emptyTask);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save task.");
    } finally {
      setSaving(false);
    }
  }

  function editVolunteer(volunteer: VolunteerProfile) {
    setSelectedVolunteerId(volunteer.id);
    setVolunteerForm({
      id: volunteer.id,
      firstName: volunteer.firstName,
      lastName: volunteer.lastName,
      phone: volunteer.phone,
      email: volunteer.email,
      skills: volunteer.skills.join(", "),
      emergencyContact: volunteer.emergencyContact,
      notes: volunteer.notes,
      consentAcknowledged: volunteer.consentAcknowledged
    });
  }

  async function saveVolunteerLookups(email: string, phone: string, volunteerId: string) {
    const lookupIds = await getVolunteerLookupIds(email, phone);
    await Promise.all(lookupIds.map((lookupId) => saveVolunteerLookup(lookupId, volunteerId)));
  }

  async function handleUpdateVolunteerLookupIndex() {
    setErrorMessage("");
    setSaving(true);

    try {
      await Promise.all(
        volunteers
          .filter((volunteer) => volunteer.email || volunteer.phone)
          .map((volunteer) => saveVolunteerLookups(volunteer.email, volunteer.phone, volunteer.id))
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update volunteer lookup index.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveVolunteer() {
    if (!volunteerForm.firstName.trim() || !volunteerForm.lastName.trim()) return;
    setErrorMessage("");
    setSaving(true);

    const volunteerId = volunteerForm.id ?? createVolunteerId();
    const profile = {
      firstName: volunteerForm.firstName.trim(),
      lastName: volunteerForm.lastName.trim(),
      phone: volunteerForm.phone.trim(),
      email: volunteerForm.email.trim(),
      skills: volunteerForm.skills
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean),
      emergencyContact: volunteerForm.emergencyContact.trim(),
      notes: volunteerForm.notes.trim(),
      consentAcknowledged: volunteerForm.consentAcknowledged
    };

    try {
      if (hasSupervisorAccess) {
        await saveManagedVolunteer(volunteerId, profile);
        if (profile.email || profile.phone) await saveVolunteerLookups(profile.email, profile.phone, volunteerId);
      }
      setVolunteerForm(emptyVolunteer);
      setSelectedVolunteerId("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save volunteer.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteVolunteer(volunteerId: string) {
    setErrorMessage("");
    setSaving(true);

    try {
      if (hasSupervisorAccess) await deleteVolunteer(volunteerId);
      if (selectedVolunteerId === volunteerId) {
        setVolunteerForm(emptyVolunteer);
        setSelectedVolunteerId("");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete volunteer.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEvent() {
    if (!eventForm.name.trim() || !eventForm.location.trim() || !eventForm.startsAt) return;
    setErrorMessage("");
    setSavingEvent(true);
    try {
      const eventId = await saveEvent({
        id: eventForm.id,
        name: eventForm.name.trim(),
        location: eventForm.location.trim(),
        startsAt: new Date(eventForm.startsAt),
        active: eventForm.active
      });
      setSelectedEventId(eventId);
      setPendingEventId("");
      setActiveView("tasks");
      setEventForm(emptyEvent);
      setEventMenuOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save event.");
    } finally {
      setSavingEvent(false);
    }
  }

  async function updateTask(task: VolunteerTask, changes: Partial<VolunteerTask>) {
    const next = { ...task, ...changes };
    setErrorMessage("");
    try {
      if (hasSupervisorAccess) {
        await saveTask(next);

        if (changes.assignedVolunteerIds) {
          await logAssignmentChanges(task, changes.assignedVolunteerIds);
        }
      }
      setTasks((items) => items.map((item) => (item.id === task.id ? next : item)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update task.");
    }
  }

  async function logAssignmentChanges(task: VolunteerTask, nextVolunteerIds: string[]) {
    const previous = new Set(task.assignedVolunteerIds);
    const next = new Set(nextVolunteerIds);
    const added = nextVolunteerIds.filter((id) => !previous.has(id));
    const removed = task.assignedVolunteerIds.filter((id) => !next.has(id));
    const changes = [
      ...added.map((volunteerId) => ({ volunteerId, kind: "task-assigned" as const })),
      ...removed.map((volunteerId) => ({ volunteerId, kind: "task-unassigned" as const }))
    ];

    await Promise.all(
      changes.map(({ volunteerId, kind }) => {
        const volunteer = volunteers.find((item) => item.id === volunteerId);
        const name = volunteer ? `${volunteer.firstName} ${volunteer.lastName}`.trim() : volunteerId;
        return addActivityLog({
          eventId: task.eventId,
          siteId: task.siteId,
          kind,
          volunteerId,
          volunteerName: name,
          taskId: task.id,
          taskTitle: task.title,
          message: `${name} was ${kind === "task-assigned" ? "assigned to" : "removed from"} ${task.title}.`
        });
      })
    );
  }

  function downloadCsv(filename: string, rows: string[][]) {
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportAttendanceCsv() {
    downloadCsv(`${selectedEventId || "event"}-attendance.csv`, [
      ["Volunteer", "Event", "Status", "Checked in", "Checked out", "Minutes"],
      ...history.map((item) => [
        item.volunteerName,
        item.eventId,
        item.status,
        item.checkedInAt.toISOString(),
        item.checkedOutAt?.toISOString() ?? "",
        String(item.totalMinutes ?? "")
      ])
    ]);
  }

  function exportAssignmentsCsv() {
    const volunteerById = new Map(volunteers.map((volunteer) => [volunteer.id, volunteer]));
    downloadCsv(`${selectedEventId || "event"}-task-assignments.csv`, [
      ["Event", "Task", "Status", "Volunteer", "Volunteer email", "Volunteer phone", "Skill tags"],
      ...tasks.flatMap((task) =>
        task.assignedVolunteerIds.map((volunteerId) => {
          const volunteer = volunteerById.get(volunteerId);
          return [
            selectedEvent?.name ?? task.eventId,
            task.title,
            task.status,
            volunteer ? `${volunteer.firstName} ${volunteer.lastName}`.trim() : volunteerId,
            volunteer?.email ?? "",
            volunteer?.phone ?? "",
            task.skillTags.join("; ")
          ];
        })
      )
    ]);
  }

  function exportVolunteersCsv() {
    downloadCsv("volunteer-database.csv", [
      ["First name", "Last name", "Email", "Phone", "Skills", "Emergency contact", "Notes", "Consent acknowledged"],
      ...volunteers.map((volunteer) => [
        volunteer.firstName,
        volunteer.lastName,
        volunteer.email,
        volunteer.phone,
        volunteer.skills.join("; "),
        volunteer.emergencyContact,
        volunteer.notes,
        volunteer.consentAcknowledged ? "Yes" : "No"
      ])
    ]);
  }

  function exportActivityCsv() {
    downloadCsv(`${selectedEventId || "event"}-activity.csv`, [
      ["Timestamp", "Event", "Activity", "Volunteer", "Task", "Message"],
      ...activityLogs.map((item) => [
        item.createdAt.toISOString(),
        selectedEvent?.name ?? item.eventId,
        item.kind,
        item.volunteerName ?? "",
        item.taskTitle ?? "",
        item.message
      ])
    ]);
  }

  function getQrLink(eventId: string) {
    if (typeof window === "undefined") return `/e/${eventId}`;
    return `${window.location.origin}/e/${eventId}`;
  }

  async function copyQrLink(eventId: string) {
    await navigator.clipboard.writeText(getQrLink(eventId));
    setCopiedEventId(eventId);
    window.setTimeout(() => setCopiedEventId(""), 1800);
  }

  async function downloadQrCode(eventItem: EventSite) {
    const svg = await QRCode.toString(getQrLink(eventItem.id), {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 4,
      color: {
        dark: "#17211c",
        light: "#ffffff"
      }
    });
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${eventItem.id}-qr-code.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function requestEventChange(eventId: string) {
    if (!selectedEventId || selectedEventId === eventId) {
      setSelectedEventId(eventId);
      setEventMenuOpen(false);
      setEventForm(emptyEvent);
      return;
    }

    setPendingEventId(eventId);
  }

  function confirmEventChange() {
    setSelectedEventId(pendingEventId);
    setPendingEventId("");
    setTaskForm(emptyTask);
    setActiveView("tasks");
    setEventMenuOpen(false);
    setEventForm(emptyEvent);
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 rounded-lg bg-ink p-5 text-white shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Su Presencia Church</p>
            <h1 className="mt-2 text-3xl font-black">Supervisor Dashboard</h1>
            <p className="mt-2 text-sm font-medium text-white/70">Live attendance, task board, skills, and hour reports.</p>
          </div>
          {setupComplete ? (
            user ? (
              <Button className="bg-white text-ink" onClick={() => signOut(auth)}>
                <LogOut size={18} />
                Sign out
              </Button>
            ) : (
              <Button className="bg-gold text-ink" onClick={handleSignIn}>
                <LogIn size={18} />
                Google Sign-In
              </Button>
            )
          ) : (
            <span className="rounded-md bg-gold px-3 py-2 text-sm font-black text-ink">Setup required</span>
          )}
        </header>

        {errorMessage && (
          <div className="mt-4 rounded-md border border-clay/30 bg-clay/10 p-3 text-sm font-semibold text-clay">
            {errorMessage}
          </div>
        )}

        {!setupComplete ? (
          <section className="mt-6 rounded-lg border border-ink/10 bg-white p-6 text-center shadow-soft">
            <ShieldCheck className="mx-auto text-clay" size={42} />
            <h2 className="mt-3 text-2xl font-black">Firebase setup required</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/70">
              Add the Firebase web app environment variables and supervisor email domain before building and deploying this static site.
            </p>
          </section>
        ) : !authReady ? (
          <section className="mt-6 rounded-lg border border-ink/10 bg-white p-6 text-center shadow-soft">
            <ShieldCheck className="mx-auto text-moss" size={42} />
            <h2 className="mt-3 text-2xl font-black">Checking access...</h2>
          </section>
        ) : !user ? (
          <section className="mt-6 rounded-lg border border-ink/10 bg-white p-6 text-center shadow-soft">
            <ShieldCheck className="mx-auto text-moss" size={42} />
            <h2 className="mt-3 text-2xl font-black">Supervisor access required</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/70">
              Sign in with the church Google Workspace account to view attendance and manage volunteer tasks.
            </p>
          </section>
        ) : !isAuthorizedSupervisor ? (
          <section className="mt-6 rounded-lg border border-ink/10 bg-white p-6 text-center shadow-soft">
            <ShieldCheck className="mx-auto text-clay" size={42} />
            <h2 className="mt-3 text-2xl font-black">Not authorized</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/70">
              This dashboard is limited to accounts ending in @{supervisorDomain}.
            </p>
            <Button className="mt-5 bg-ink text-white" onClick={() => signOut(auth)}>
              <LogOut size={18} />
              Sign out
            </Button>
          </section>
        ) : (
          <div className="mt-5 grid gap-5">
            {pendingEvent && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 px-4">
                <section className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
                  <h2 className="text-2xl font-black">Change event?</h2>
                  <p className="mt-2 text-sm leading-6 text-ink/70">
                    You are currently managing {selectedEvent?.name}. Switch to {pendingEvent.name}?
                  </p>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    <Button className="bg-moss text-white" onClick={confirmEventChange}>
                      Switch Event
                    </Button>
                    <Button className="bg-paper text-ink" onClick={() => setPendingEventId("")}>
                      Stay Here
                    </Button>
                  </div>
                </section>
              </div>
            )}

            {eventMenuOpen && (
              <div className="fixed inset-0 z-40 overflow-y-auto bg-ink/55 px-4 py-6">
                <section className="mx-auto grid w-full max-w-5xl gap-4 rounded-lg bg-white p-4 shadow-soft lg:grid-cols-[0.8fr_1.2fr]">
                  <div className="rounded-md border border-ink/10 bg-paper p-4">
                    <div className="flex items-center gap-2">
                      <CalendarPlus className="text-moss" />
                      <h2 className="text-xl font-black">{eventForm.id ? "Edit event" : "Add event"}</h2>
                    </div>
                    <div className="mt-4 grid gap-3">
                      <Field label="Event name" value={eventForm.name} onChange={(event) => setEventForm({ ...eventForm, name: event.target.value })} />
                      <Field
                        label="Location"
                        value={eventForm.location}
                        onChange={(event) => setEventForm({ ...eventForm, location: event.target.value })}
                      />
                      <Field
                        label="Start date and time"
                        type="datetime-local"
                        value={eventForm.startsAt}
                        onChange={(event) => setEventForm({ ...eventForm, startsAt: event.target.value })}
                      />
                      <label className="flex items-center gap-3 rounded-md border border-ink/10 bg-white p-3 text-sm font-semibold text-ink">
                        <input
                          className="h-5 w-5 accent-moss"
                          type="checkbox"
                          checked={eventForm.active}
                          onChange={(event) => setEventForm({ ...eventForm, active: event.target.checked })}
                        />
                        Active event
                      </label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button className="bg-moss text-white" disabled={savingEvent} onClick={handleSaveEvent}>
                          <Plus size={18} />
                          {eventForm.id ? "Update Event" : "Add Event"}
                        </Button>
                        <Button
                          className="bg-white text-ink"
                          onClick={() => {
                            setEventForm(emptyEvent);
                            setEventMenuOpen(false);
                          }}
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 rounded-md border border-ink/10 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-xl font-black">Event menu</h2>
                        <p className="mt-1 text-sm font-semibold text-ink/55">Switch events, copy QR links, or edit event details.</p>
                      </div>
                      {events.length > 0 && (
                        <select
                          className="focus-ring min-h-11 rounded-md border border-ink/15 bg-paper px-3 text-sm font-bold text-ink"
                          value={selectedEventId}
                          onChange={(event) => requestEventChange(event.target.value)}
                        >
                          <option value="" disabled>
                            Select event
                          </option>
                          {events.map((eventItem) => (
                            <option key={eventItem.id} value={eventItem.id}>
                              {eventItem.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="mt-4 grid max-h-[32rem] gap-3 overflow-y-auto pr-1">
                      {events.length === 0 ? (
                        <div className="rounded-md border border-ink/10 bg-paper p-3 text-sm font-semibold text-ink/65">
                          Add your first event to unlock event-specific tasks, attendance, and QR links.
                        </div>
                      ) : (
                        events.map((eventItem) => (
                          <article
                            key={eventItem.id}
                            className={`rounded-md border p-3 ${
                              selectedEventId === eventItem.id ? "border-moss bg-moss/10" : "border-ink/10 bg-paper"
                            }`}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[6rem_1fr]">
                                <EventQrImage
                                  className="h-24 w-24 rounded-md border border-ink/10 bg-white p-2"
                                  value={getQrLink(eventItem.id)}
                                  alt={`${eventItem.name} check-in QR code`}
                                />
                                <div className="min-w-0">
                                  <button className="text-left" onClick={() => requestEventChange(eventItem.id)}>
                                    <h3 className="font-black">{eventItem.name}</h3>
                                    <p className="mt-1 text-sm font-semibold text-ink/60">{eventItem.location}</p>
                                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-ink/45">
                                      {eventItem.startsAt.toLocaleString([], {
                                        month: "short",
                                        day: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit"
                                      })}
                                      {eventItem.active ? " | Active" : " | Inactive"}
                                    </p>
                                  </button>
                                  <a
                                    className="focus-ring mt-2 block break-all rounded-sm text-xs font-semibold text-moss underline-offset-2 hover:underline"
                                    href={getQrLink(eventItem.id)}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {getQrLink(eventItem.id)}
                                  </a>
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-wrap gap-2">
                                <Button className="min-h-9 bg-white px-2 text-ink" title="Copy QR link" onClick={() => copyQrLink(eventItem.id)}>
                                  <Copy size={16} />
                                  {copiedEventId === eventItem.id ? "Copied" : ""}
                                </Button>
                                <Button className="min-h-9 bg-white px-2 text-ink" title="Download QR code" onClick={() => downloadQrCode(eventItem)}>
                                  <Download size={16} />
                                </Button>
                                <Button
                                  className="min-h-9 bg-white px-2 text-ink"
                                  title="Edit event"
                                  onClick={() =>
                                    setEventForm({
                                      id: eventItem.id,
                                      name: eventItem.name,
                                      location: eventItem.location,
                                      startsAt: toDateTimeInputValue(eventItem.startsAt),
                                      active: eventItem.active
                                    })
                                  }
                                >
                                  <Pencil size={16} />
                                </Button>
                                <Button
                                  className="min-h-9 bg-white px-2 text-clay"
                                  title="Delete event"
                                  onClick={async () => {
                                    await deleteEvent(eventItem.id);
                                    if (selectedEventId === eventItem.id) setSelectedEventId("");
                                  }}
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              </div>
            )}

            {!selectedEvent ? (
              <section className="rounded-lg border border-ink/10 bg-white p-6 text-center shadow-soft">
                <ShieldCheck className="mx-auto text-moss" size={42} />
                <h2 className="mt-3 text-2xl font-black">Select an event</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/70">
                  Open the event menu to choose an existing event or add a new one before managing attendance, tasks, and volunteer assignments.
                </p>
                <Button className="mx-auto mt-5 bg-moss text-white" onClick={() => setEventMenuOpen(true)}>
                  <CalendarPlus size={18} />
                  Manage Events
                </Button>
              </section>
            ) : (
              <>
                <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <EventQrImage
                        className="h-36 w-36 rounded-md border border-ink/10 bg-white p-3"
                        value={getQrLink(selectedEvent.id)}
                        alt={`${selectedEvent.name} check-in QR code`}
                      />
                      <div>
                        <p className="flex items-center gap-2 text-sm font-bold text-ink/55">
                          <QrCode size={17} />
                          Current event
                        </p>
                        <h2 className="mt-1 text-2xl font-black">{selectedEvent.name}</h2>
                        <p className="mt-1 text-sm font-semibold text-ink/65">{selectedEvent.location}</p>
                        <a
                          className="focus-ring mt-2 block break-all rounded-sm text-xs font-semibold text-moss underline-offset-2 hover:underline"
                          href={getQrLink(selectedEvent.id)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {getQrLink(selectedEvent.id)}
                        </a>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button className="bg-paper text-ink" onClick={() => copyQrLink(selectedEvent.id)}>
                        <Copy size={17} />
                        {copiedEventId === selectedEvent.id ? "Copied" : "Copy QR Link"}
                      </Button>
                      <Button className="bg-paper text-ink" onClick={() => downloadQrCode(selectedEvent)}>
                        <Download size={17} />
                        Download QR
                      </Button>
                      <Button className="bg-ink text-white" onClick={() => setEventMenuOpen(true)}>
                        <CalendarPlus size={17} />
                        Manage Events
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {[
                      { id: "tasks" as SupervisorView, label: "Tasks", icon: ClipboardList },
                      { id: "attendance" as SupervisorView, label: "Attendance", icon: UsersRound },
                      { id: "volunteers" as SupervisorView, label: "Volunteers", icon: Search }
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <Button
                          key={item.id}
                          className={activeView === item.id ? "bg-moss text-white" : "bg-paper text-ink"}
                          onClick={() => setActiveView(item.id)}
                        >
                          <Icon size={17} />
                          {item.label}
                        </Button>
                      );
                    })}
                  </div>
                </section>

                {activeView === "tasks" && (
                  <>
                    <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h2 className="text-xl font-black">Task management</h2>
                        <Button className="bg-paper text-ink" disabled={!selectedEventId || tasks.length === 0} onClick={exportAssignmentsCsv}>
                          <Download size={17} />
                          Assignments CSV
                        </Button>
                      </div>
                      <div className="mt-4 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
                        <div className="grid gap-3 rounded-md border border-ink/10 bg-paper p-3">
                          <Field label="Task title" value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} />
                          <TextArea
                            label="Description"
                            value={taskForm.description}
                            onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })}
                          />
                          <Field
                            label="Skill tags"
                            placeholder="setup, kids, hospitality"
                            value={taskForm.skillTags}
                            onChange={(event) => setTaskForm({ ...taskForm, skillTags: event.target.value })}
                          />
                          <Button className="bg-moss text-white" disabled={saving || !selectedEventId} onClick={handleSaveTask}>
                            <Plus size={18} />
                            {taskForm.id ? "Update Task" : "Add Task"}
                          </Button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Metric title="Tasks" value={tasks.length.toString()} />
                          <Metric title="In progress" value={tasks.filter((task) => task.status === "in-progress").length.toString()} />
                          <Metric title="Complete" value={tasks.filter((task) => task.status === "complete").length.toString()} />
                        </div>
                      </div>
                    </section>

                    <section>
                      <h2 className="mb-3 text-xl font-black">Task board</h2>
                      <KanbanBoard
                        tasks={tasks}
                        volunteers={volunteers}
                        onStatusChange={(task, status: TaskStatus) => updateTask(task, { status })}
                        onDelete={async (taskId) => {
                          if (hasSupervisorAccess) await deleteTask(taskId);
                          setTasks((items) => items.filter((item) => item.id !== taskId));
                        }}
                        onEdit={(task) =>
                          setTaskForm({
                            id: task.id,
                            title: task.title,
                            description: task.description,
                            skillTags: task.skillTags.join(", ")
                          })
                        }
                        onAssigneesChange={(task, volunteerIds) =>
                          updateTask(task, {
                            assignedVolunteerIds: volunteerIds
                          })
                        }
                      />
                    </section>
                  </>
                )}

                {activeView === "attendance" && (
                  <>
                    <section className="grid gap-3 sm:grid-cols-3">
                      <Metric title="Checked in now" value={attendance.length.toString()} />
                      <Metric title="Known volunteers" value={volunteers.length.toString()} />
                      <Metric title="Reported hours" value={(totalMinutes / 60).toFixed(1)} />
                    </section>

                    <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                      <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <UsersRound className="text-moss" />
                            <h2 className="text-xl font-black">Live attendance</h2>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button className="bg-paper text-ink" disabled={!selectedEventId} onClick={exportAttendanceCsv}>
                              <Download size={17} />
                              Attendance CSV
                            </Button>
                            <Button className="bg-paper text-ink" disabled={!selectedEventId || activityLogs.length === 0} onClick={exportActivityCsv}>
                              <Download size={17} />
                              Activity CSV
                            </Button>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3">
                          {attendance.map((item) => (
                            <article key={item.id} className="rounded-md border border-ink/10 bg-paper p-3">
                              <div className="flex items-center justify-between gap-3">
                                <h3 className="font-black">{item.volunteerName}</h3>
                                <span className="text-xs font-bold text-moss">
                                  {item.checkedInAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                </span>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
                        <h2 className="text-xl font-black">Attendance history</h2>
                        <div className="mt-4 max-h-[32rem] overflow-auto">
                          <table className="w-full min-w-[28rem] border-separate border-spacing-y-2 text-left text-sm">
                            <thead className="text-xs uppercase tracking-[0.12em] text-ink/45">
                              <tr>
                                <th>Volunteer</th>
                                <th>Status</th>
                                <th>Minutes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {history.map((item) => (
                                <tr key={item.id} className="bg-paper">
                                  <td className="rounded-l-md p-3 font-bold">{item.volunteerName}</td>
                                  <td className="p-3 font-semibold text-moss">{item.status}</td>
                                  <td className="rounded-r-md p-3 font-semibold">{item.totalMinutes ?? ""}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
                      <h2 className="text-xl font-black">Activity log</h2>
                      <div className="mt-4 grid gap-3">
                        {activityLogs.length === 0 ? (
                          <div className="rounded-md border border-ink/10 bg-paper p-3 text-sm font-semibold text-ink/65">
                            No check-in, check-out, or assignment activity yet.
                          </div>
                        ) : (
                          activityLogs.slice(0, 12).map((item) => (
                            <article key={item.id} className="rounded-md border border-ink/10 bg-paper p-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <h3 className="font-black">{item.volunteerName ?? item.kind}</h3>
                                  <p className="mt-1 text-sm font-semibold text-ink/65">{item.message}</p>
                                </div>
                                <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink/45">
                                  {item.createdAt.toLocaleString([], {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit"
                                  })}
                                </span>
                              </div>
                            </article>
                          ))
                        )}
                      </div>
                    </section>
                  </>
                )}

                {activeView === "volunteers" && (
                  <>
                    <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
                      <h2 className="text-xl font-black">Volunteer notes and requests</h2>
                      <div className="mt-4 grid gap-3">
                        {feedback.length === 0 ? (
                          <div className="rounded-md border border-ink/10 bg-paper p-3 text-sm font-semibold text-ink/65">
                            No notes or task requests yet.
                          </div>
                        ) : (
                          feedback.map((item) => (
                            <article key={item.id} className="rounded-md border border-ink/10 bg-paper p-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <h3 className="font-black">{item.volunteerName}</h3>
                                  <p className="mt-1 text-sm font-semibold text-ink/60">
                                    {item.kind === "more-tasks-request" ? "Requested another task" : item.taskTitle ?? "Task note"}
                                  </p>
                                </div>
                                <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink/45">
                                  {item.createdAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                </span>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-ink/75">{item.message}</p>
                            </article>
                          ))
                        )}
                      </div>
                    </section>

                    <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h2 className="text-xl font-black">Volunteer database</h2>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <label className="relative block">
                            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/45" size={17} />
                            <input
                              className="focus-ring min-h-11 rounded-md border border-ink/15 bg-paper pl-9 pr-3 text-sm font-semibold"
                              placeholder="Search name, email, phone, skill"
                              value={skillQuery}
                              onChange={(event) => setSkillQuery(event.target.value)}
                            />
                          </label>
                          <Button className="bg-paper text-ink" disabled={volunteers.length === 0} onClick={exportVolunteersCsv}>
                            <Download size={17} />
                            Volunteers CSV
                          </Button>
                          <Button className="bg-paper text-ink" disabled={saving || volunteers.length === 0} onClick={handleUpdateVolunteerLookupIndex}>
                            <Search size={17} />
                            Update Lookup Index
                          </Button>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                        <div className="grid gap-3 rounded-md border border-ink/10 bg-paper p-3">
                          <h3 className="font-black">{selectedVolunteerId ? "Edit volunteer" : "Add volunteer"}</h3>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="First name" value={volunteerForm.firstName} onChange={(event) => setVolunteerForm({ ...volunteerForm, firstName: event.target.value })} />
                            <Field label="Last name" value={volunteerForm.lastName} onChange={(event) => setVolunteerForm({ ...volunteerForm, lastName: event.target.value })} />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Email" type="email" value={volunteerForm.email} onChange={(event) => setVolunteerForm({ ...volunteerForm, email: event.target.value })} />
                            <Field label="Phone" type="tel" value={volunteerForm.phone} onChange={(event) => setVolunteerForm({ ...volunteerForm, phone: event.target.value })} />
                          </div>
                          <Field
                            label="Skills/interests"
                            placeholder="kids, setup, greeting"
                            value={volunteerForm.skills}
                            onChange={(event) => setVolunteerForm({ ...volunteerForm, skills: event.target.value })}
                          />
                          <Field
                            label="Emergency contact"
                            value={volunteerForm.emergencyContact}
                            onChange={(event) => setVolunteerForm({ ...volunteerForm, emergencyContact: event.target.value })}
                          />
                          <TextArea label="Notes" value={volunteerForm.notes} onChange={(event) => setVolunteerForm({ ...volunteerForm, notes: event.target.value })} />
                          <label className="flex items-center gap-3 rounded-md border border-ink/10 bg-white p-3 text-sm font-semibold text-ink">
                            <input
                              className="h-5 w-5 accent-moss"
                              type="checkbox"
                              checked={volunteerForm.consentAcknowledged}
                              onChange={(event) => setVolunteerForm({ ...volunteerForm, consentAcknowledged: event.target.checked })}
                            />
                            Consent acknowledged
                          </label>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Button className="bg-moss text-white" disabled={saving || !volunteerForm.firstName || !volunteerForm.lastName} onClick={handleSaveVolunteer}>
                              <Plus size={18} />
                              {selectedVolunteerId ? "Update Volunteer" : "Add Volunteer"}
                            </Button>
                            <Button
                              className="bg-white text-ink"
                              onClick={() => {
                                setVolunteerForm(emptyVolunteer);
                                setSelectedVolunteerId("");
                              }}
                            >
                              <X size={18} />
                              Clear
                            </Button>
                          </div>
                        </div>

                        <div className="max-h-[42rem] overflow-auto">
                          <table className="w-full min-w-[48rem] border-separate border-spacing-y-2 text-left text-sm">
                            <thead className="text-xs uppercase tracking-[0.12em] text-ink/45">
                              <tr>
                                <th>Name</th>
                                <th>Contact</th>
                                <th>Skills</th>
                                <th>Notes</th>
                                <th className="text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredVolunteers.map((volunteer) => (
                                <tr key={volunteer.id} className="bg-paper align-top">
                                  <td className="rounded-l-md p-3">
                                    <p className="font-black">
                                      {volunteer.firstName} {volunteer.lastName}
                                    </p>
                                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-ink/45">
                                      {volunteer.consentAcknowledged ? "Consent on file" : "Consent missing"}
                                    </p>
                                  </td>
                                  <td className="p-3 font-semibold text-ink/70">
                                    <p>{volunteer.email || "No email"}</p>
                                    <p className="mt-1">{volunteer.phone || "No phone"}</p>
                                    {volunteer.emergencyContact && <p className="mt-2 text-xs text-ink/55">Emergency: {volunteer.emergencyContact}</p>}
                                  </td>
                                  <td className="p-3">
                                    <div className="flex flex-wrap gap-1.5">
                                      {volunteer.skills.length === 0 ? (
                                        <span className="text-sm font-semibold text-ink/50">No skills listed</span>
                                      ) : (
                                        volunteer.skills.map((skill) => (
                                          <span key={skill} className="rounded bg-white px-2 py-1 text-xs font-bold text-moss">
                                            {skill}
                                          </span>
                                        ))
                                      )}
                                    </div>
                                  </td>
                                  <td className="max-w-xs p-3 text-sm font-semibold leading-6 text-ink/65">{volunteer.notes || "No notes"}</td>
                                  <td className="rounded-r-md p-3">
                                    <div className="flex justify-end gap-2">
                                      <Button className="min-h-9 bg-white px-2 text-ink" title="Edit volunteer" onClick={() => editVolunteer(volunteer)}>
                                        <Pencil size={16} />
                                      </Button>
                                      <Button className="min-h-9 bg-white px-2 text-clay" title="Delete volunteer" disabled={saving} onClick={() => handleDeleteVolunteer(volunteer.id)}>
                                        <Trash2 size={16} />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </section>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
      <p className="text-sm font-bold text-ink/55">{title}</p>
      <p className="mt-2 text-4xl font-black text-ink">{value}</p>
    </div>
  );
}


function EventQrImage({ value, alt, className }: { value: string; alt: string; className: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let mounted = true;

    QRCode.toDataURL(value, {
      width: 320,
      margin: 4,
      errorCorrectionLevel: "M",
      color: {
        dark: "#17211c",
        light: "#ffffff"
      }
    })
      .then((dataUrl) => {
        if (mounted) setSrc(dataUrl);
      })
      .catch(() => {
        if (mounted) setSrc("");
      });

    return () => {
      mounted = false;
    };
  }, [value]);

  if (!src) {
    return <div className={`${className} grid place-items-center text-xs font-bold text-ink/45`}>QR</div>;
  }

  return <img className={className} src={src} alt={alt} />;
}
