"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, CheckCircle2, Clock, MonitorUp, ShieldCheck, UsersRound } from "lucide-react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { demoAttendance, demoTasks } from "@/lib/mockData";
import { watchEvents, watchLiveAttendance, watchTasks } from "@/lib/firebaseService";
import type { AttendanceSession, EventSite, TaskStatus, VolunteerTask } from "@/lib/types";

const statusLabels: Record<TaskStatus, string> = {
  todo: "Ready",
  "in-progress": "Active",
  complete: "Done"
};

function checkedInMinutes(session: AttendanceSession) {
  return Math.max(0, Math.floor((Date.now() - session.checkedInAt.getTime()) / 60000));
}

export default function StatusBoardPage() {
  const configured = isFirebaseConfigured();
  const [events, setEvents] = useState<EventSite[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [attendance, setAttendance] = useState<AttendanceSession[]>(configured ? [] : demoAttendance);
  const [tasks, setTasks] = useState<VolunteerTask[]>(configured ? [] : demoTasks);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!configured) return;
    const unsubEvents = watchEvents(setEvents);
    return () => unsubEvents();
  }, [configured]);

  useEffect(() => {
    if (!configured || events.length === 0) return;
    const savedEventId = window.localStorage.getItem("statusBoardEventId") ?? "";
    const savedEvent = events.find((event) => event.id === savedEventId);

    setSelectedEventId((current) => {
      if (current && events.some((event) => event.id === current)) return current;
      return savedEvent?.id ?? events.find((event) => event.active)?.id ?? events[0].id;
    });
  }, [configured, events]);

  useEffect(() => {
    if (!configured || !selectedEventId) return;
    window.localStorage.setItem("statusBoardEventId", selectedEventId);

    const unsubAttendance = watchLiveAttendance(selectedEventId, setAttendance);
    const unsubTasks = watchTasks(selectedEventId, setTasks);

    return () => {
      unsubAttendance();
      unsubTasks();
    };
  }, [configured, selectedEventId]);

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const activeTasks = useMemo(() => tasks.filter((task) => task.status !== "complete"), [tasks]);
  const inProgressTasks = activeTasks.filter((task) => task.status === "in-progress");
  const supervisorsHere = attendance.filter((session) => session.isSupervisor);

  return (
    <main className="min-h-screen overflow-hidden bg-ink text-white">
      <div className="mx-auto grid min-h-screen max-w-[1920px] grid-rows-[auto_1fr] gap-4 p-5">
        <header className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/8 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 text-white/65">
              <MonitorUp size={22} />
              <p className="text-sm font-bold uppercase tracking-[0.16em]">Live Status Board</p>
            </div>
            <h1 className="mt-2 truncate text-4xl font-black leading-tight">
              {selectedEvent?.name ?? "Volunteer Status"}
            </h1>
            <p className="mt-1 text-lg font-semibold text-white/65">{selectedEvent?.location ?? "Demo event"}</p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {events.length > 1 && (
              <select
                className="focus-ring min-h-11 rounded-md border border-white/20 bg-ink px-3 text-sm font-bold text-white"
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
                title="Select event"
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            )}
            <div className="rounded-md border border-white/10 bg-white px-4 py-2 text-right text-ink">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink/50">Updated</p>
              <p className="text-xl font-black">{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 gap-4 xl:grid-cols-[1.45fr_0.9fr]">
          <section className="grid min-h-0 grid-rows-[auto_1fr] gap-4">
            <div className="grid gap-4 md:grid-cols-4">
              <BoardMetric icon={UsersRound} label="Here Now" value={attendance.length.toString()} />
              <BoardMetric icon={ShieldCheck} label="Supervisors" value={supervisorsHere.length.toString()} highlight />
              <BoardMetric icon={Activity} label="Active Tasks" value={activeTasks.length.toString()} />
              <BoardMetric icon={CheckCircle2} label="In Progress" value={inProgressTasks.length.toString()} />
            </div>

            <div className="grid min-h-0 gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <section className="min-h-0 rounded-lg border border-white/10 bg-white p-4 text-ink">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black">Who Is Here</h2>
                  <span className="rounded bg-moss px-3 py-1 text-sm font-black text-white">{attendance.length}</span>
                </div>
                <div className="mt-4 grid max-h-[calc(100vh-19rem)] gap-3 overflow-hidden">
                  {attendance.length === 0 ? (
                    <EmptyBoardMessage message="No one is checked in yet." />
                  ) : (
                    attendance.slice(0, 12).map((session) => {
                      const supervisor = Boolean(session.isSupervisor);
                      return (
                        <article
                          key={session.id}
                          className={`rounded-md border p-3 ${
                            supervisor ? "border-gold bg-gold/15 ring-2 ring-gold/30" : "border-ink/10 bg-paper"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="truncate text-xl font-black">{session.volunteerName}</h3>
                                {supervisor && <span className="rounded bg-gold px-2 py-1 text-xs font-black text-ink">Supervisor</span>}
                              </div>
                              <p className="mt-1 flex items-center gap-2 text-sm font-bold text-ink/55">
                                <Clock size={15} />
                                {checkedInMinutes(session)} min here
                              </p>
                            </div>
                            <span className="h-3 w-3 shrink-0 rounded-full bg-moss" />
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="min-h-0 rounded-lg border border-white/10 bg-white p-4 text-ink">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black">Supervisors In</h2>
                  <ShieldCheck className="text-gold" size={30} />
                </div>
                <div className="mt-4 grid gap-3">
                  {supervisorsHere.length === 0 ? (
                    <EmptyBoardMessage message="No checked-in supervisors tagged yet." />
                  ) : (
                    supervisorsHere.map((session) => (
                      <article key={session.id} className="rounded-md border border-gold bg-gold/15 p-4">
                        <h3 className="text-2xl font-black">{session.volunteerName}</h3>
                        <p className="mt-1 text-sm font-bold text-ink/60">{checkedInMinutes(session)} min on site</p>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          </section>

          <section className="grid min-h-0 grid-rows-[auto_1fr] rounded-lg border border-white/10 bg-white p-4 text-ink">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">What We Are Working On</h2>
              <span className="rounded bg-ink px-3 py-1 text-sm font-black text-white">{activeTasks.length}</span>
            </div>
            <div className="mt-4 grid max-h-[calc(100vh-10rem)] content-start gap-3 overflow-hidden">
              {activeTasks.length === 0 ? (
                <EmptyBoardMessage message="No active tasks right now." />
              ) : (
                activeTasks.slice(0, 10).map((task) => (
                  <article key={task.id} className="rounded-md border border-ink/10 bg-paper p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-2xl font-black">{task.title}</h3>
                        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-ink/65">{task.description || "No description"}</p>
                      </div>
                      <span className={`shrink-0 rounded px-3 py-1 text-sm font-black ${task.status === "in-progress" ? "bg-moss text-white" : "bg-gold text-ink"}`}>
                        {statusLabels[task.status]}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {task.assignedVolunteerIds.length === 0 ? (
                        <span className="rounded bg-white px-2 py-1 text-sm font-bold text-ink/50">Unassigned</span>
                      ) : (
                        <span className="rounded bg-white px-2 py-1 text-sm font-bold text-ink/70">
                          {task.assignedVolunteerIds.length} assigned
                        </span>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <Link className="sr-only" href="/supervisor">
          Supervisor dashboard
        </Link>
      </div>
    </main>
  );
}

function BoardMetric({
  icon: Icon,
  label,
  value,
  highlight = false
}: {
  icon: typeof UsersRound;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-gold bg-gold text-ink" : "border-white/10 bg-white text-ink"}`}>
      <Icon size={25} className={highlight ? "text-ink" : "text-moss"} />
      <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] opacity-65">{label}</p>
      <p className="mt-1 text-5xl font-black leading-none">{value}</p>
    </div>
  );
}

function EmptyBoardMessage({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-ink/10 bg-paper p-4 text-sm font-bold text-ink/55">
      {message}
    </div>
  );
}
