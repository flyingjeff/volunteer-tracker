"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, LogIn, LogOut, Plus, Search, ShieldCheck, UsersRound } from "lucide-react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { Button, Field, TextArea } from "@/components/ui";
import { KanbanBoard } from "@/components/KanbanBoard";
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase";
import {
  deleteTask,
  saveTask,
  seedDemoEvent,
  watchAttendanceHistory,
  watchLiveAttendance,
  watchTasks,
  watchVolunteers
} from "@/lib/firebaseService";
import { demoAttendance, demoTasks, demoVolunteers } from "@/lib/mockData";
import type { AttendanceSession, TaskStatus, VolunteerProfile, VolunteerTask } from "@/lib/types";

const eventId = "demo-sunday";
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

export default function SupervisorPage() {
  const configured = isFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSession[]>(configured ? [] : demoAttendance);
  const [history, setHistory] = useState<AttendanceSession[]>(configured ? [] : demoAttendance);
  const [tasks, setTasks] = useState<VolunteerTask[]>(configured ? [] : demoTasks);
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>(configured ? [] : demoVolunteers);
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTask);
  const [skillQuery, setSkillQuery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!configured) return;
    return onAuthStateChanged(auth, setUser);
  }, [configured]);

  useEffect(() => {
    if (!configured || !user) return;
    seedDemoEvent();
    const unsubAttendance = watchLiveAttendance(eventId, setAttendance);
    const unsubHistory = watchAttendanceHistory(eventId, setHistory);
    const unsubTasks = watchTasks(eventId, setTasks);
    const unsubVolunteers = watchVolunteers(setVolunteers);

    return () => {
      unsubAttendance();
      unsubHistory();
      unsubTasks();
      unsubVolunteers();
    };
  }, [configured, user]);

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
    await signInWithPopup(auth, googleProvider);
  }

  async function handleSaveTask() {
    if (!taskForm.title.trim()) return;
    setSaving(true);
    const payload = {
      id: taskForm.id,
      eventId,
      siteId,
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      skillTags: taskForm.skillTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    };

    if (configured) {
      await saveTask(payload);
    } else if (taskForm.id) {
      setTasks((items) =>
        items.map((task) => (task.id === taskForm.id ? { ...task, ...payload, id: task.id, updatedAt: new Date() } : task))
      );
    } else {
      setTasks((items) => [
        {
          ...payload,
          id: crypto.randomUUID(),
          status: "todo",
          assignedVolunteerIds: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        ...items
      ]);
    }

    setTaskForm(emptyTask);
    setSaving(false);
  }

  async function updateTask(task: VolunteerTask, changes: Partial<VolunteerTask>) {
    const next = { ...task, ...changes };
    if (configured) await saveTask(next);
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
    link.download = `${eventId}-attendance.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const hasSupervisorAccess = !configured || user;

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 rounded-lg bg-ink p-5 text-white shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Su Presencia Church</p>
            <h1 className="mt-2 text-3xl font-black">Supervisor Dashboard</h1>
            <p className="mt-2 text-sm font-medium text-white/70">Live attendance, task board, skills, and hour reports.</p>
          </div>
          {configured ? (
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
            <span className="rounded-md bg-gold px-3 py-2 text-sm font-black text-ink">Demo mode</span>
          )}
        </header>

        {!hasSupervisorAccess ? (
          <section className="mt-6 rounded-lg border border-ink/10 bg-white p-6 text-center shadow-soft">
            <ShieldCheck className="mx-auto text-moss" size={42} />
            <h2 className="mt-3 text-2xl font-black">Supervisor access required</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/70">
              Sign in with the church Google Workspace account to view attendance and manage volunteer tasks.
            </p>
          </section>
        ) : (
          <div className="mt-5 grid gap-5">
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
                  <Button className="bg-paper text-ink" onClick={exportCsv}>
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
                  <Button className="bg-moss text-white" disabled={saving} onClick={handleSaveTask}>
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
                  if (configured) await deleteTask(taskId);
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
