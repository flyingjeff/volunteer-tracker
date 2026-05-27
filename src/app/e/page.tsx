"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, ClipboardList, LogOut, Send, UserRoundPlus } from "lucide-react";
import { Button, Field, TextArea } from "@/components/ui";
import {
  addTaskFeedback,
  checkIn,
  checkOut,
  findVolunteerByLookup,
  findVolunteerByTokenHash,
  joinTask,
  saveVolunteerLookup,
  upsertVolunteer,
  watchEvent,
  watchVolunteerAttendanceSession,
  watchTasks
} from "@/lib/firebaseService";
import { isFirebaseConfigured } from "@/lib/firebase";
import { clearBrowserToken, getOrCreateBrowserToken, sha256 } from "@/lib/token";
import { getVolunteerLookupIds } from "@/lib/volunteerLookup";
import { demoAttendance, demoTasks } from "@/lib/mockData";
import type { AttendanceSession, EventSite, VolunteerProfile, VolunteerTask } from "@/lib/types";

type FormState = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  skills: string;
  emergencyContact: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  waiverSignerName: string;
  waiverConfirmed: boolean;
  notes: string;
  consentAcknowledged: boolean;
};

type FindProfileState = {
  email: string;
  phone: string;
};

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  dateOfBirth: "",
  skills: "",
  emergencyContact: "",
  guardianName: "",
  guardianPhone: "",
  guardianEmail: "",
  waiverSignerName: "",
  waiverConfirmed: false,
  notes: "",
  consentAcknowledged: false
};

const waiverTextVersion = "renovation-safety-2026-05";

const renovationWaiverRisks = [
  "Slips, trips, and falls",
  "Uneven floors and debris",
  "Power tools and hand tools",
  "Dust, airborne particles, and loud noise",
  "Electrical hazards",
  "Lifting and carrying heavy materials",
  "Sharp objects and pinch points",
  "Working near ladders or elevated surfaces",
  "Exposure to paint, adhesives, cleaning products, or construction materials",
  "Unexpected hazards associated with demolition or renovation work"
];

const renovationWaiverAgreements = [
  "You are voluntarily participating in this activity.",
  "You understand that renovation and construction activities involve inherent risks that may result in property damage, personal injury, serious injury, or death.",
  "You agree to follow all instructions provided by project leaders, supervisors, and safety personnel.",
  "You agree to use required safety equipment and to immediately report unsafe conditions or injuries.",
  "You confirm that you are physically capable of participating in the activities you choose to perform.",
  "To the fullest extent permitted by law, you voluntarily assume all risks associated with your participation in this project.",
  "You release and hold harmless Su Presencia Church, its volunteers, staff, directors, contractors, and property owners from claims, liability, damages, or expenses arising from your participation, except where prohibited by law.",
  "You understand that you may stop participating at any time if you feel unsafe or unable to continue.",
  "In the event of an emergency, you authorize project leaders to seek medical assistance on your behalf if necessary."
];

function getAge(dateOfBirth: string) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

const emptyFindProfile: FindProfileState = {
  email: "",
  phone: ""
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
  const [findProfile, setFindProfile] = useState<FindProfileState>(emptyFindProfile);
  const [waiverOpen, setWaiverOpen] = useState(false);
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
  const openInProgressTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          volunteer &&
          task.status === "in-progress" &&
          !task.assignedVolunteerIds.includes(volunteer.id)
      ),
    [tasks, volunteer]
  );
  const volunteerAge = getAge(form.dateOfBirth);
  const isMinor = volunteerAge !== null && volunteerAge < 18;
  const canOpenWaiver =
    Boolean(form.firstName.trim()) &&
    Boolean(form.lastName.trim()) &&
    Boolean(form.dateOfBirth) &&
    (!isMinor || (Boolean(form.guardianName.trim()) && (Boolean(form.guardianPhone.trim()) || Boolean(form.guardianEmail.trim()))));

  async function saveProfileLookups(email: string, phone: string, volunteerId: string) {
    const lookupIds = await getVolunteerLookupIds(email, phone);
    await Promise.all(lookupIds.map((lookupId) => saveVolunteerLookup(lookupId, volunteerId)));
  }

  async function saveProfile() {
    if (!canOpenWaiver || !form.consentAcknowledged || !form.waiverConfirmed || !form.waiverSignerName.trim()) return false;
    setErrorMessage("");
    setSaving(true);

    const profile = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      dateOfBirth: form.dateOfBirth,
      skills: form.skills
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean),
      emergencyContact: form.emergencyContact.trim(),
      guardianName: isMinor ? form.guardianName.trim() : "",
      guardianPhone: isMinor ? form.guardianPhone.trim() : "",
      guardianEmail: isMinor ? form.guardianEmail.trim() : "",
      waiverSignerName: form.waiverSignerName.trim(),
      waiverSignedBy: isMinor ? "guardian" as const : "volunteer" as const,
      waiverAcknowledgedAt: new Date(),
      waiverTextVersion,
      notes: form.notes.trim(),
      consentAcknowledged: form.consentAcknowledged
    };

    try {
      if (configured) {
        const id = await upsertVolunteer(tokenHash, profile);
        setVolunteer({ ...profile, id, browserTokenHash: tokenHash, createdAt: new Date(), updatedAt: new Date() });
        if (profile.email || profile.phone) {
          try {
            await saveProfileLookups(profile.email, profile.phone, id);
          } catch {
            setSentMessage("Profile saved. Profile lookup recovery could not be updated.");
          }
        }
      } else {
        setVolunteer({ ...profile, id: "demo-local", browserTokenHash: tokenHash, createdAt: new Date(), updatedAt: new Date() });
      }
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save profile.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openWaiverForProfile() {
    if (!canOpenWaiver) {
      setErrorMessage(isMinor ? "Enter the parent or guardian information before continuing." : "Enter your name and date of birth before continuing.");
      return;
    }

    setErrorMessage("");
    setWaiverOpen(true);
  }

  async function agreeAndSaveProfile() {
    const saved = await saveProfile();
    if (saved) setWaiverOpen(false);
  }

  async function findExistingProfile() {
    if (!findProfile.email && !findProfile.phone) return;
    setErrorMessage("");
    setSaving(true);

    try {
      if (!configured) {
        setErrorMessage("Profile lookup is available after Firebase is configured.");
        return;
      }

      const lookupIds = await getVolunteerLookupIds(findProfile.email, findProfile.phone);
      let existing: VolunteerProfile | null = null;
      for (const lookupId of lookupIds) {
        existing = await findVolunteerByLookup(lookupId);
        if (existing) break;
      }
      if (!existing) {
        setErrorMessage("No profile found for that email or phone.");
        return;
      }

      const profile = {
        firstName: existing.firstName,
        lastName: existing.lastName,
        phone: existing.phone,
        email: existing.email,
        dateOfBirth: existing.dateOfBirth,
        skills: existing.skills,
        emergencyContact: existing.emergencyContact,
        guardianName: existing.guardianName,
        guardianPhone: existing.guardianPhone,
        guardianEmail: existing.guardianEmail,
        waiverSignerName: existing.waiverSignerName,
        waiverSignedBy: existing.waiverSignedBy,
        waiverAcknowledgedAt: existing.waiverAcknowledgedAt,
        waiverTextVersion: existing.waiverTextVersion,
        notes: existing.notes,
        consentAcknowledged: existing.consentAcknowledged
      };
      const id = await upsertVolunteer(tokenHash, profile);
      if (profile.email || profile.phone) {
        try {
          await saveProfileLookups(profile.email, profile.phone, id);
        } catch {
          setSentMessage("Profile found. Profile lookup recovery could not be updated.");
        }
      }

      setVolunteer({ ...profile, id, browserTokenHash: tokenHash, createdAt: existing.createdAt, updatedAt: new Date() });
      setFindProfile(emptyFindProfile);
      setSentMessage((message) => message || "Profile found. Welcome back.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to find profile.");
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

  async function endVolunteerSession() {
    setErrorMessage("");
    setSaving(true);

    try {
      if (configured && session) {
        await checkOut(session);
      }
      clearBrowserToken();
      setVolunteer(null);
      setSession(null);
      setTokenHash("");
      setTaskNotes({});
      setMoreTaskRequest("");
      setSentMessage("");
      setForm(emptyForm);
      setWaiverOpen(false);
      const hash = await sha256(getOrCreateBrowserToken());
      setTokenHash(hash);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to end session.");
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

  async function addMeToTask(task: VolunteerTask) {
    if (!volunteer) return;
    setErrorMessage("");
    setSaving(true);

    try {
      if (configured) {
        await joinTask(task, volunteer);
      }
      setSentMessage(`You were added to ${task.title}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to join task.");
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

        {waiverOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/60 px-4 py-5">
            <section className="mx-auto w-full max-w-xl rounded-lg bg-white p-4 shadow-soft">
              <div className="rounded-md border border-clay/25 bg-clay/10 p-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-clay">Warning - Construction / Renovation Area</p>
                <h2 className="mt-2 text-2xl font-black text-ink">Volunteer Renovation Project Safety Acknowledgment</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-ink/70">
                  You are entering an active renovation and construction work area. Participation may involve exposure to these risks:
                </p>
              </div>

              <div className="mt-4 max-h-[48vh] overflow-auto rounded-md border border-ink/10 bg-paper p-3 text-sm leading-6 text-ink/75">
                <ul className="list-disc space-y-1 pl-5">
                  {renovationWaiverRisks.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="mt-4 font-bold text-ink">By continuing, you acknowledge and agree that:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {renovationWaiverAgreements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="mt-4 font-bold text-ink">Acknowledgment</p>
                <p className="mt-1">
                  By selecting I Agree below, you confirm that you have read and understood this warning and acknowledgment,
                  understand the risks involved, and voluntarily choose to participate.
                </p>
              </div>

              <div className="mt-4 grid gap-3">
                <Field
                  label={isMinor ? "Parent/guardian signature" : "Volunteer signature"}
                  placeholder={isMinor ? "Parent or guardian full name" : "Your full name"}
                  value={form.waiverSignerName}
                  onChange={(event) => setForm({ ...form, waiverSignerName: event.target.value })}
                />
                <label className="flex gap-3 rounded-md border border-ink/10 bg-paper p-3 text-sm font-semibold text-ink">
                  <input
                    className="mt-1 h-5 w-5 accent-moss"
                    type="checkbox"
                    checked={form.waiverConfirmed}
                    onChange={(event) => setForm({ ...form, waiverConfirmed: event.target.checked, consentAcknowledged: event.target.checked })}
                  />
                  I Agree
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button className="bg-moss text-white" disabled={saving || !form.waiverConfirmed || !form.waiverSignerName.trim()} onClick={agreeAndSaveProfile}>
                    Save Profile
                  </Button>
                  <Button className="bg-paper text-ink" disabled={saving} onClick={() => setWaiverOpen(false)}>
                    Back
                  </Button>
                </div>
              </div>
            </section>
          </div>
        )}

        {!volunteer ? (
          <div className="mt-4 grid gap-4">
            <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
              <div className="flex items-center gap-2">
                <UserRoundPlus className="text-moss" />
                <h2 className="text-xl font-black">Find my profile</h2>
              </div>
              <div className="mt-4 grid gap-3">
                <Field
                  label="Email"
                  type="email"
                  value={findProfile.email}
                  onChange={(event) => setFindProfile({ ...findProfile, email: event.target.value })}
                />
                <Field
                  label="Phone"
                  type="tel"
                  value={findProfile.phone}
                  onChange={(event) => setFindProfile({ ...findProfile, phone: event.target.value })}
                />
                <Button className="bg-gold text-ink" disabled={saving || (!findProfile.email && !findProfile.phone)} onClick={findExistingProfile}>
                  Find Profile
                </Button>
              </div>
            </section>

            <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
              <div className="flex items-center gap-2">
                <UserRoundPlus className="text-moss" />
                <h2 className="text-xl font-black">Create your profile</h2>
              </div>
              <div className="mt-4 grid gap-3">
                <Field label="First name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
                <Field label="Last name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
                <Field label="Phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                <Field label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                <Field label="Date of birth" type="date" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} />
                {isMinor && (
                  <div className="grid gap-3 rounded-md border border-gold/40 bg-gold/10 p-3">
                    <p className="text-sm font-bold text-ink">Parent or guardian required</p>
                    <Field
                      label="Parent/guardian name"
                      value={form.guardianName}
                      onChange={(event) => setForm({ ...form, guardianName: event.target.value })}
                    />
                    <Field
                      label="Parent/guardian phone"
                      type="tel"
                      value={form.guardianPhone}
                      onChange={(event) => setForm({ ...form, guardianPhone: event.target.value })}
                    />
                    <Field
                      label="Parent/guardian email"
                      type="email"
                      value={form.guardianEmail}
                      onChange={(event) => setForm({ ...form, guardianEmail: event.target.value })}
                    />
                  </div>
                )}
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
                <Button className="bg-moss text-white" disabled={saving || !canOpenWaiver} onClick={openWaiverForProfile}>
                  Review Waiver
                </Button>
              </div>
            </section>
          </div>
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
                <Button className="col-span-2 bg-paper text-ink" disabled={saving} onClick={endVolunteerSession}>
                  <LogOut size={18} />
                  End Session
                </Button>
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

            <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
              <h2 className="text-xl font-black">Open in-progress tasks</h2>
              <div className="mt-3 grid gap-3">
                {openInProgressTasks.length > 0 ? (
                  openInProgressTasks.map((task) => (
                    <article key={task.id} className="rounded-md border border-ink/10 bg-paper p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black">{task.title}</h3>
                          <p className="mt-1 text-sm leading-6 text-ink/70">{task.description || "No description"}</p>
                        </div>
                        <span className="rounded bg-white px-2 py-1 text-xs font-bold text-moss">{task.assignedVolunteerIds.length} assigned</span>
                      </div>
                      <Button className="mt-3 w-full bg-moss text-white" disabled={saving} onClick={() => addMeToTask(task)}>
                        Add Me
                      </Button>
                    </article>
                  ))
                ) : (
                  <div className="rounded-md border border-ink/10 bg-paper p-3 text-sm font-semibold text-ink/65">
                    No open in-progress tasks right now.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
