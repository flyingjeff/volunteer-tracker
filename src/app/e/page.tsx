"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, ClipboardList, LogOut, Send, UserRoundPlus } from "lucide-react";
import { Button, Field, TextArea } from "@/components/ui";
import {
  addTaskFeedback,
  checkIn,
  checkOut,
  findVolunteerByTokenHash,
  upsertVolunteer,
  watchEvent,
  watchVolunteerAttendanceSession,
  watchTasks
} from "@/lib/firebaseService";
import { isFirebaseConfigured } from "@/lib/firebase";
import { getOrCreateBrowserToken, sha256 } from "@/lib/token";
import { demoAttendance, demoTasks } from "@/lib/mockData";
import type { AttendanceSession, EventSite, VolunteerProfile, VolunteerTask } from "@/lib/types";

type FormState = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  skills: string;
  emergencyContact: string;
  notes: string;
  consentAcknowledged: boolean;
};

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  skills: "",
  emergencyContact: "",
  notes: "",
  consentAcknowledged: false
};

function getEventIdFromUrl() {
  if (typeof window === "undefined") return "demo-sunday";
  const params = new URLSearchParams(window.location.search);
  const queryEvent = params.get("eventId") || params.get("event");
  if (queryEvent) return queryEvent;
  const [, route, eventId] = window.location.pathname.split("/");
  return route === "e" && eventId ? decodeURIComponent(eventId) : "demo-sunday";
}

export default function VolunteerEventPage() {
  const [eventId, setEventId] = useState("demo-sunday");
  const siteId = "main";
  const configured = isFirebaseConfigured();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tokenHash, setTokenHash] = useState("");
  const [eventDetails, setEventDetails] = useState<EventSite | null>(null);
  const [volunteer, setVolunteer] = useState<VolunteerProfile | null>(null);
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [tasks, setTasks] = useState<VolunteerTask[]>(configured ? [] : demoTasks);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});
  const [moreTaskRequest, setMoreTaskRequest] = useState("");
  const [sentMessage, setSentMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setEventId(getEventIdFromUrl());
  }, []);

  useEffect(() => {
    async function boot() {
      const hash = await sha256(getOrCreateBrowserToken());
      setTokenHash(hash);

      if (configured) {
        const existing = await findVolunteerByTokenHash(hash);
        if (existing) setVolunteer(existing);
      }

      setLoading(false);
    }

    boot().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load volunteer profile.");
      setLoading(false);
    });
  }, [configured]);

  useEffect(() => {
    if (!configured) {
      setSession(demoAttendance[0]);
      return;
    }

    const unwatchEvent = watchEvent(eventId, setEventDetails);
    const unwatchTasks = watchTasks(eventId, setTasks);
    const unwatchAttendance =
      tokenHash && volunteer
        ? watchVolunteerAttendanceSession(eventId, siteId, tokenHash, setSession)
        : () => undefined;

    return () => {
      unwatchEvent();
      unwatchAttendance();
      unwatchTasks();
    };
  }, [configured, eventId, tokenHash, volunteer]);

  const assignedTasks = useMemo(
    () => tasks.filter((task) => volunteer && task.assignedVolunteerIds.includes(volunteer.id)),
    [tasks, volunteer]
  );

  async function saveProfile() {
    if (!form.firstName || !form.lastName || !form.consentAcknowledged) return;
    setErrorMessage("");
    setSaving(true);

    const profile = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      skills: form.skills
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean),
      emergencyContact: form.emergencyContact.trim(),
      notes: form.notes.trim(),
      consentAcknowledged: form.consentAcknowledged
    };

    try {
      if (configured) {
        const id = await upsertVolunteer(tokenHash, profile);
        setVolunteer({ ...profile, id, browserTokenHash: tokenHash, createdAt: new Date(), updatedAt: new Date() });
      } else {
        setVolunteer({ ...profile, id: "demo-local", browserTokenHash: tokenHash, createdAt: new Date(), updatedAt: new Date() });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckIn() {
    if (!volunteer) return;
    setErrorMessage("");
    setSaving(true);

    try {
      if (configured) {
        await checkIn(eventId, siteId, volunteer, tokenHash);
      } else {
        setSession({
          id: "local-session",
          eventId,
          siteId,
          volunteerId: volunteer.id,
          volunteerName: `${volunteer.firstName} ${volunteer.lastName}`,
          status: "checked-in",
          checkedInAt: new Date()
        });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to check in.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckOut() {
    if (!session) return;
    setErrorMessage("");
    setSaving(true);
    try {
      if (configured) await checkOut(session);
      setSession(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to check out.");
    } finally {
      setSaving(false);
    }
  }

  async function submitTaskNote(task: VolunteerTask) {
    if (!volunteer || !taskNotes[task.id]?.trim()) return;
    setErrorMessage("");
    setSaving(true);

    try {
      if (configured) {
        await addTaskFeedback({
          eventId,
          siteId,
          volunteerId: volunteer.id,
          volunteerName: `${volunteer.firstName} ${volunteer.lastName}`.trim(),
          taskId: task.id,
          taskTitle: task.title,
          kind: "task-note",
          message: taskNotes[task.id].trim()
        });
      }

      setTaskNotes((notes) => ({ ...notes, [task.id]: "" }));
      setSentMessage("Note sent to supervisors.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send note.");
    } finally {
      setSaving(false);
    }
  }

  async function requestMoreTasks() {
    if (!volunteer) return;
    setErrorMessage("");
    setSaving(true);

    try {
      if (configured) {
        await addTaskFeedback({
          eventId,
          siteId,
          volunteerId: volunteer.id,
          volunteerName: `${volunteer.firstName} ${volunteer.lastName}`.trim(),
          kind: "more-tasks-request",
          message: moreTaskRequest.trim() || "I am available for another task."
        });
      }

      setMoreTaskRequest("");
      setSentMessage("Task request sent to supervisors.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to request more tasks.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center px-5 text-sm font-semibold text-ink">Loading check-in...</main>;
  }

  return (
    <main className="min-h-screen px-4 py-5">
      <div className="mx-auto max-w-md">
        <header className="rounded-lg bg-moss p-5 text-white shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Su Presencia Church</p>
          <h1 className="mt-2 text-3xl font-black">Volunteer Check-In</h1>
          <p className="mt-2 text-sm font-medium text-white/80">
            {eventDetails?.name ?? eventId}
            {eventDetails?.location ? ` | ${eventDetails.location}` : ""}
          </p>
        </header>

        {errorMessage && (
          <div className="mt-4 rounded-md border border-clay/30 bg-clay/10 p-3 text-sm font-semibold text-clay">
            {errorMessage}
          </div>
        )}

        {!volunteer ? (
          <section className="mt-4 rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
            <div className="flex items-center gap-2">
              <UserRoundPlus className="text-moss" />
              <h2 className="text-xl font-black">Create your profile</h2>
            </div>
            <div className="mt-4 grid gap-3">
              <Field label="First name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
              <Field label="Last name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
              <Field label="Phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              <Field label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              <Field
                label="Skills/interests"
                placeholder="kids, setup, greeting"
                value={form.skills}
                onChange={(event) => setForm({ ...form, skills: event.target.value })}
              />
              <Field
                label="Emergency contact"
                value={form.emergencyContact}
                onChange={(event) => setForm({ ...form, emergencyContact: event.target.value })}
              />
              <TextArea label="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              <label className="flex gap-3 rounded-md border border-ink/10 bg-paper p-3 text-sm font-semibold text-ink">
                <input
                  className="mt-1 h-5 w-5 accent-moss"
                  type="checkbox"
                  checked={form.consentAcknowledged}
                  onChange={(event) => setForm({ ...form, consentAcknowledged: event.target.checked })}
                />
                I acknowledge the volunteer consent and waiver for this event.
              </label>
              <Button className="bg-moss text-white" disabled={saving} onClick={saveProfile}>
                Save Profile
              </Button>
            </div>
          </section>
        ) : (
          <section className="mt-4 grid gap-4">
            <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
              <p className="text-sm font-semibold text-ink/60">Welcome back</p>
              <h2 className="text-2xl font-black">
                {volunteer.firstName} {volunteer.lastName}
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {session ? (
                  <Button className="col-span-2 bg-clay text-white" disabled={saving} onClick={handleCheckOut}>
                    <LogOut size={18} />
                    Check Out
                  </Button>
                ) : (
                  <Button className="col-span-2 bg-moss text-white" disabled={saving} onClick={handleCheckIn}>
                    <CheckCircle2 size={18} />
                    Check In
                  </Button>
                )}
              </div>
              <div className="mt-4 rounded-md bg-paper p-3 text-sm font-semibold text-ink/75">
                <Clock className="mr-2 inline-block" size={16} />
                {session ? `Checked in at ${session.checkedInAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Not checked in"}
              </div>
            </div>

            {sentMessage && (
              <div className="rounded-md border border-moss/20 bg-moss/10 p-3 text-sm font-semibold text-moss">
                {sentMessage}
              </div>
            )}

            <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
              <div className="flex items-center gap-2">
                <ClipboardList className="text-moss" />
                <h2 className="text-xl font-black">Assigned tasks</h2>
              </div>
              <div className="mt-3 grid gap-3">
                {assignedTasks.length > 0 ? (
                  assignedTasks.map((task) => (
                    <article key={task.id} className="rounded-md border border-ink/10 bg-paper p-3">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-black">{task.title}</h3>
                        <span className="rounded bg-white px-2 py-1 text-xs font-bold text-moss">{task.status}</span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-ink/70">{task.description}</p>
                      <div className="mt-3 grid gap-2">
                        <TextArea
                          label="Notes or feedback"
                          placeholder="Share progress, blockers, supplies needed, or handoff notes."
                          value={taskNotes[task.id] ?? ""}
                          onChange={(event) => setTaskNotes((notes) => ({ ...notes, [task.id]: event.target.value }))}
                        />
                        <Button className="bg-moss text-white" disabled={saving || !taskNotes[task.id]?.trim()} onClick={() => submitTaskNote(task)}>
                          <Send size={17} />
                          Send Note
                        </Button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-md border border-ink/10 bg-paper p-3 text-sm font-semibold text-ink/65">
                    No tasks assigned yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
              <h2 className="text-xl font-black">Need another task?</h2>
              <div className="mt-3 grid gap-3">
                <TextArea
                  label="Optional message"
                  placeholder="Tell supervisors what kind of task you can help with next."
                  value={moreTaskRequest}
                  onChange={(event) => setMoreTaskRequest(event.target.value)}
                />
                <Button className="bg-gold text-ink" disabled={saving} onClick={requestMoreTasks}>
                  <Send size={17} />
                  Request More Tasks
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
