"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Activity, CheckCircle2, Clock, MonitorUp, ShieldCheck, UsersRound } from "lucide-react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { demoAttendance, demoTasks } from "@/lib/mockData";
import { watchEvents, watchLiveAttendance, watchTaskLocations, watchTasks } from "@/lib/firebaseService";
import type { AttendanceSession, EventSite, TaskLocation, TaskStatus, VolunteerTask } from "@/lib/types";

const statusLabels: Record<TaskStatus, string> = {
  todo: "Ready",
  "in-progress": "Active",
  complete: "Done"
};

function checkedInMinutes(session: AttendanceSession) {
  return Math.max(0, Math.floor((Date.now() - session.checkedInAt.getTime()) / 60000));
}

function taskLocationLabel(task: VolunteerTask, locations: TaskLocation[]) {
  const hasMultipleFloors = new Set(locations.map((location) => location.floor).filter(Boolean)).size > 1;
  const parts = [
    hasMultipleFloors ? task.locationFloor : "",
    task.locationZone,
    task.locationName
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" - ") : "";
}

export default function StatusBoardPage() {
  const configured = isFirebaseConfigured();
  const [events, setEvents] = useState<EventSite[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [attendance, setAttendance] = useState<AttendanceSession[]>(configured ? [] : demoAttendance);
  const [tasks, setTasks] = useState<VolunteerTask[]>(configured ? [] : demoTasks);
  const [locations, setLocations] = useState<TaskLocation[]>([]);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
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
    const unsubLocations = watchTaskLocations(selectedEventId, setLocations);

    return () => {
      unsubAttendance();
      unsubTasks();
      unsubLocations();
    };
  }, [configured, selectedEventId]);

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const activeTasks = useMemo(() => tasks.filter((task) => task.status !== "complete"), [tasks]);
  const inProgressTasks = activeTasks.filter((task) => task.status === "in-progress");
  const supervisorsHere = attendance.filter((session) => session.isSupervisor);
  const boardEventId = selectedEvent?.id ?? selectedEventId;
  const qrLink = useMemo(() => {
    if (!boardEventId) return "";
    if (typeof window === "undefined") return `/e/${boardEventId}`;
    return `${window.location.origin}/e/${boardEventId}`;
  }, [boardEventId]);
  const sortedAttendance = useMemo(
    () =>
      [...attendance].sort((a, b) => {
        const supervisorSort = Number(Boolean(b.isSupervisor)) - Number(Boolean(a.isSupervisor));
        if (supervisorSort !== 0) return supervisorSort;
        return b.checkedInAt.getTime() - a.checkedInAt.getTime();
      }),
    [attendance]
  );

  return (
    <main className="h-screen max-h-screen overflow-hidden bg-ink text-white">
      <div className="mx-auto grid h-screen max-h-screen max-w-[1920px] grid-rows-[auto_auto_minmax(0,1fr)] gap-[min(1.5vh,1rem)] p-[min(1.6vh,1.25rem)]">
        <header className="flex min-h-0 items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/8 px-[min(1.6vw,1.25rem)] py-[min(1.2vh,1rem)]">
          <div className="min-w-0">
            <div className="flex items-center gap-3 text-white/65">
              <MonitorUp size={20} />
              <p className="text-sm font-bold uppercase tracking-[0.16em]">Live Status Board</p>
            </div>
            <h1 className="mt-1 truncate text-[clamp(1.7rem,3.2vw,3rem)] font-black leading-tight">
              {selectedEvent?.name ?? "Volunteer Status"}
            </h1>
            <p className="text-[clamp(0.9rem,1.35vw,1.1rem)] font-semibold text-white/65">{selectedEvent?.location ?? "Demo event"}</p>
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
              <p className="text-[clamp(1rem,1.5vw,1.35rem)] font-black">
                {now ? now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "--:--"}
              </p>
            </div>
            {qrLink && (
              <div className="rounded-md border border-white/10 bg-white p-2 text-ink">
                <p className="px-1 text-xs font-bold uppercase tracking-[0.12em] text-ink/50">Event Check-In QR</p>
                <EventQrImage
                  value={qrLink}
                  alt={`${selectedEvent?.name ?? "Event"} check-in QR code`}
                  className="mt-1 aspect-square w-[clamp(8rem,13vw,11rem)] rounded bg-white object-contain"
                />
              </div>
            )}
          </div>
        </header>

        <div className="grid min-h-0 gap-[min(1.5vh,1rem)] md:grid-cols-4">
          <BoardMetric icon={Activity} label="Active Tasks" value={activeTasks.length.toString()} />
          <BoardMetric icon={CheckCircle2} label="In Progress" value={inProgressTasks.length.toString()} />
          <BoardMetric icon={UsersRound} label="Here Now" value={attendance.length.toString()} />
          <BoardMetric icon={ShieldCheck} label="Supervisors" value={supervisorsHere.length.toString()} highlight />
        </div>

        <div className="grid min-h-0 gap-[min(1.5vh,1rem)] xl:grid-cols-[1.25fr_0.95fr]">
          <StatusPanel title="What We Are Working On" count={inProgressTasks.length} countClassName="bg-ink text-white">
            <AutoScrollArea watchKey={`tasks-${inProgressTasks.length}-${inProgressTasks.map((task) => task.id).join("-")}`}>
              {inProgressTasks.length === 0 ? (
                <EmptyBoardMessage message="No in-progress tasks right now." />
              ) : (
                inProgressTasks.map((task) => <TaskCard key={task.id} task={task} locationLabel={taskLocationLabel(task, locations)} />)
              )}
            </AutoScrollArea>
          </StatusPanel>

          <StatusPanel title="Who Is Here" count={attendance.length} countClassName="bg-moss text-white">
            <AutoScrollArea watchKey={`attendance-${attendance.length}-${attendance.map((session) => session.id).join("-")}`}>
              {attendance.length === 0 ? (
                <EmptyBoardMessage message="No one is checked in yet." />
              ) : (
                sortedAttendance.map((session) => <AttendanceCard key={session.id} session={session} />)
              )}
            </AutoScrollArea>
          </StatusPanel>
        </div>

        <Link className="sr-only" href="/supervisor">
          Supervisor dashboard
        </Link>
      </div>
    </main>
  );
}

function StatusPanel({
  title,
  count,
  countClassName,
  icon,
  children
}: {
  title: string;
  count: number;
  countClassName: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-lg border border-white/10 bg-white p-[min(1.4vh,1rem)] text-ink">
      <div className="flex min-h-0 items-center justify-between gap-3">
        <h2 className="truncate text-[clamp(1.15rem,1.8vw,1.75rem)] font-black">{title}</h2>
        {icon ?? <span className={`rounded px-3 py-1 text-sm font-black ${countClassName}`}>{count}</span>}
      </div>
      {children}
    </section>
  );
}

function AutoScrollArea({ children, watchKey }: { children: ReactNode; watchKey: string }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const container = scrollRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    function updateScrollState() {
      const target = scrollRef.current;
      const primaryContent = contentRef.current;
      if (!target || !primaryContent) return;
      const contentHeight = primaryContent.getBoundingClientRect().height;
      setCanScroll(contentHeight > target.clientHeight + 2);
    }

    updateScrollState();
    window.requestAnimationFrame(updateScrollState);
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(container);
    observer.observe(content);
    const mutationObserver = new MutationObserver(updateScrollState);
    mutationObserver.observe(content, { childList: true, subtree: true });
    const intervalId = window.setInterval(updateScrollState, 1500);

    window.addEventListener("resize", updateScrollState);
    const timeoutId = window.setTimeout(updateScrollState, 250);

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      window.clearInterval(intervalId);
      window.removeEventListener("resize", updateScrollState);
      window.clearTimeout(timeoutId);
    };
  }, [watchKey]);

  useEffect(() => {
    const element = scrollRef.current;
    const content = contentRef.current;
    if (!element || !content || !canScroll) {
      if (element) element.scrollTop = 0;
      return;
    }

    element.scrollTop = 0;
    const pixelsPerSecond = 22;
    let lastTime = Date.now();
    const intervalId = window.setInterval(() => {
      const target = scrollRef.current;
      const primaryContent = contentRef.current;
      if (!target || !primaryContent) return;

      const nowTime = Date.now();
      const elapsed = Math.min(nowTime - lastTime, 120);
      lastTime = nowTime;

      const contentHeight = primaryContent.scrollHeight;
      if (contentHeight <= target.clientHeight + 4) {
        target.scrollTop = 0;
        return;
      }

      target.scrollTop += (elapsed / 1000) * pixelsPerSecond;
      if (target.scrollTop >= contentHeight) {
        target.scrollTop -= contentHeight;
      }
    }, 40);

    return () => window.clearInterval(intervalId);
  }, [canScroll, watchKey]);

  return (
    <div
      ref={scrollRef}
      className="mt-3 min-h-0 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      <div ref={contentRef} className="grid grid-cols-1 content-start gap-[min(1.1vh,0.75rem)]">
        {children}
      </div>
      {canScroll && (
        <div aria-hidden className="mt-[min(1.1vh,0.75rem)] grid grid-cols-1 content-start gap-[min(1.1vh,0.75rem)]">
          {children}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, locationLabel }: { task: VolunteerTask; locationLabel: string }) {
  return (
    <article className="w-full rounded-md border border-ink/10 bg-paper p-[min(1.4vh,1rem)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[clamp(1.1rem,1.7vw,1.65rem)] font-black">{task.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-ink/65">{task.description || "No description"}</p>
        </div>
        <span className={`shrink-0 rounded px-3 py-1 text-sm font-black ${task.status === "in-progress" ? "bg-moss text-white" : "bg-gold text-ink"}`}>
          {statusLabels[task.status]}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {task.taskLeaderName && (
          <span className="rounded bg-gold px-2 py-1 text-sm font-black text-ink">
            Lead: {task.taskLeaderName}
          </span>
        )}
        {locationLabel && <span className="rounded bg-white px-2 py-1 text-sm font-bold text-ink/70">{locationLabel}</span>}
        {task.assignedVolunteerIds.length === 0 ? (
          <span className="rounded bg-white px-2 py-1 text-sm font-bold text-ink/50">Unassigned</span>
        ) : (
          <span className="rounded bg-white px-2 py-1 text-sm font-bold text-ink/70">
            {task.assignedVolunteerIds.length} assigned
          </span>
        )}
      </div>
    </article>
  );
}

function AttendanceCard({ session }: { session: AttendanceSession }) {
  return (
      <article
        className={`rounded-md border p-[min(1.3vh,0.9rem)] ${
          session.isSupervisor ? "border-gold bg-gold/15 ring-2 ring-gold/30" : "border-ink/10 bg-paper"
        } w-full`}
      >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[clamp(1rem,1.45vw,1.35rem)] font-black">{session.volunteerName}</h3>
            {session.isSupervisor && <span className="rounded bg-gold px-2 py-1 text-xs font-black text-ink">Supervisor</span>}
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
    <div className={`rounded-lg border p-[min(1.3vh,1rem)] ${highlight ? "border-gold bg-gold text-ink" : "border-white/10 bg-white text-ink"}`}>
      <Icon size={22} className={highlight ? "text-ink" : "text-moss"} />
      <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] opacity-65">{label}</p>
      <p className="mt-1 text-[clamp(2rem,4vw,3.5rem)] font-black leading-none">{value}</p>
    </div>
  );
}

function EventQrImage({ value, alt, className }: { value: string; alt: string; className: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let mounted = true;

    QRCode.toDataURL(value, {
      width: 360,
      margin: 2,
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

function EmptyBoardMessage({ message }: { message: string }) {
  return (
    <div className="w-full rounded-md border border-ink/10 bg-paper p-4 text-sm font-bold text-ink/55">
      {message}
    </div>
  );
}
