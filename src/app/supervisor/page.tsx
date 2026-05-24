"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, Copy, Download, LogIn, LogOut, Pencil, Plus, Search, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { Button, Field, TextArea } from "@/components/ui";
import { KanbanBoard } from "@/components/KanbanBoard";
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase";
import {
  deleteEvent,
  deleteTask,
  saveEvent,
  saveTask,
  watchAttendanceHistory,
  watchEvents,
  watchLiveAttendance,
  watchTaskFeedback,
  watchTasks,
  watchVolunteers
} from "@/lib/firebaseService";
import type { AttendanceSession, EventSite, TaskFeedback, TaskStatus, VolunteerProfile, VolunteerTask } from "@/lib/types";

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

const emptyEvent: EventForm = {
  name: "",
  location: "",
  startsAt: "",
  active: true
};

function toDateTimeInputValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
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
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>([]);
  const [events, setEvents] = useState<EventSite[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [eventForm, setEventForm] = useState<EventForm>(emptyEvent);
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTask);
  const [skillQuery, setSkillQuery] = useState("");
  const [copiedEventId, setCopiedEventId] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const setupComplete = configured && Boolean(supervisorDomain);
  const userEmail = user?.email?.toLowerCase() ?? "";
  const isAuthorizedSupervisor = Boolean(user && supervisorDomain && userEmail.endsWith(`@${supervisorDomain}`));
  const hasSupervisorAccess = setupComplete && isAuthorizedSupervisor;
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;

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
    if (!selectedEventId && events.length > 0) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  useEffect(() => {
    if (!hasSupervisorAccess || !selectedEventId) {
      setAttendance([]);
      setHistory([]);
      setTasks([]);
      setFeedback([]);
      return;
    }

    const unsubAttendance = watchLiveAttendance(selectedEventId, setAttendance);
    const unsubHistory = watchAttendanceHistory(selectedEventId, setHistory);
    const unsubTasks = watchTasks(selectedEventId, setTasks);
    const unsubFeedback = watchTaskFeedback(selectedEventId, setFeedback);

    return () => {
      unsubAttendance();
      unsubHistory();
      unsubTasks();
      unsubFeedback();
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
    await signInWithPopup(auth, googleProvider);
  }

  async function handleSaveTask() {
    if (!taskForm.title.trim() || !selectedEventId) return;
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

    if (hasSupervisorAccess) await saveTask(payload);

    setTaskForm(emptyTask);
    setSaving(false);
  }

  async function handleSaveEvent() {
    if (!eventForm.name.trim() || !eventForm.location.trim() || !eventForm.startsAt) return;
    setSavingEvent(true);
    const eventId = await saveEvent({
      id: eventForm.id,
      name: eventForm.name.trim(),
      location: eventForm.location.trim(),
      startsAt: new Date(eventForm.startsAt),
      active: eventForm.active
    });
    setSelectedEventId(eventId);
    setEventForm(emptyEvent);
    setSavingEvent(false);
  }

  async function updateTask(task: VolunteerTask, changes: Partial<VolunteerTask>) {
    const next = { ...task, ...changes };
    if (hasSupervisorAccess) await saveTask(next);
    setTasks((items) => items.map((item) => (item.id === task.id ? next : item)));
  }

  function exportCsv() {
    const rows = [
      ["Volunteer", "Event", "Status", "Checked in", "Checked out", "Minutes"],
      ...history.map((item) => [
        item.volunteerName,
        item.eventId,
        item.status,
        item.checkedInAt.toISOString(),
        item.checkedOutAt?.toISOString() ?? "",
        String(item.totalMinutes ?? "")
      ])
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedEventId || "event"}-attendance.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
            <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
                <div className="flex items-center gap-2">
                  <CalendarPlus className="text-moss" />
                  <h2 className="text-xl font-black">{eventForm.id ? "Edit event" : "Create event"}</h2>
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
                  <label className="flex items-center gap-3 rounded-md border border-ink/10 bg-paper p-3 text-sm font-semibold text-ink">
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
                    {eventForm.id && (
                      <Button className="bg-paper text-ink" onClick={() => setEventForm(emptyEvent)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-black">Events and QR links</h2>
                    <p className="mt-1 text-sm font-semibold text-ink/55">Select an event to manage attendance and tasks.</p>
                  </div>
                  {events.length > 0 && (
                    <select
                      className="focus-ring min-h-11 rounded-md border border-ink/15 bg-paper px-3 text-sm font-bold text-ink"
                      value={selectedEventId}
                      onChange={(event) => setSelectedEventId(event.target.value)}
                    >
                      {events.map((eventItem) => (
                        <option key={eventItem.id} value={eventItem.id}>
                          {eventItem.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="mt-4 grid gap-3">
                  {events.length === 0 ? (
                    <div className="rounded-md border border-ink/10 bg-paper p-3 text-sm font-semibold text-ink/65">
                      Create your first event to unlock event-specific tasks, attendance, and QR links.
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
                          <button className="text-left" onClick={() => setSelectedEventId(eventItem.id)}>
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
                            <p className="mt-2 break-all text-xs font-semibold text-moss">{getQrLink(eventItem.id)}</p>
                          </button>
                          <div className="flex shrink-0 gap-2">
                            <Button className="min-h-9 bg-white px-2 text-ink" title="Copy QR link" onClick={() => copyQrLink(eventItem.id)}>
                              <Copy size={16} />
                              {copiedEventId === eventItem.id ? "Copied" : ""}
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

            {selectedEvent && (
              <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
                <p className="text-sm font-bold text-ink/55">Managing event</p>
                <h2 className="mt-1 text-2xl font-black">{selectedEvent.name}</h2>
                <p className="mt-1 text-sm font-semibold text-ink/65">{selectedEvent.location}</p>
              </section>
            )}

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
                  <Button className="bg-paper text-ink" disabled={!selectedEventId} onClick={exportCsv}>
                    <Download size={17} />
                    CSV
                  </Button>
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
                <h2 className="text-xl font-black">Create task</h2>
                <div className="mt-4 grid gap-3">
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
                onAssign={(task, volunteerId) =>
                  updateTask(task, {
                    assignedVolunteerIds: Array.from(new Set([...task.assignedVolunteerIds, volunteerId]))
                  })
                }
              />
            </section>

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

            <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
              <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-xl font-black">Volunteer skills and notes</h2>
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/45" size={17} />
                    <input
                      className="focus-ring min-h-11 rounded-md border border-ink/15 bg-paper pl-9 pr-3 text-sm font-semibold"
                      placeholder="Search skills"
                      value={skillQuery}
                      onChange={(event) => setSkillQuery(event.target.value)}
                    />
                  </label>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {filteredVolunteers.map((volunteer) => (
                    <article key={volunteer.id} className="rounded-md border border-ink/10 bg-paper p-3">
                      <h3 className="font-black">
                        {volunteer.firstName} {volunteer.lastName}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-ink/60">{volunteer.phone || volunteer.email}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {volunteer.skills.map((skill) => (
                          <span key={skill} className="rounded bg-white px-2 py-1 text-xs font-bold text-moss">
                            {skill}
                          </span>
                        ))}
                      </div>
                      {volunteer.notes && <p className="mt-3 text-sm leading-6 text-ink/70">{volunteer.notes}</p>}
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
