import Link from "next/link";
import { ClipboardList, FileDown, MonitorUp, ShieldCheck, UsersRound } from "lucide-react";

export default function HomePage() {
  const readinessItems = [
    "Create or select an active event",
    "Copy the event check-in link for printed QR signage",
    "Monitor attendance, assignments, notes, and exports from one dashboard"
  ];

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col gap-8">
        <nav className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-leaf">Su Presencia Church</p>
            <h1 className="mt-1 text-2xl font-bold text-ink">Volunteer Check-In</h1>
          </div>
          <Link
            href="/supervisor"
            className="focus-ring rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white shadow-soft"
          >
            Supervisor
          </Link>
        </nav>

        <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-clay">Operations workspace</p>
            <h2 className="mt-3 text-4xl font-black leading-tight text-ink sm:text-6xl">
              Run volunteer check-in with live event control.
            </h2>
            <p className="mt-5 text-base leading-7 text-ink/75 sm:text-lg">
              Supervisors manage active events, publish check-in links, track volunteer attendance, assign tasks, and
              export operational records after the service or event wraps.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/supervisor"
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-moss px-5 py-3 font-bold text-white shadow-soft"
              >
                <ShieldCheck size={19} />
                Open Supervisor Dashboard
              </Link>
              <Link
                href="/status"
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-5 py-3 font-bold text-ink"
              >
                <MonitorUp size={19} />
                Open Status Board
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <OperationalMetric icon={UsersRound} label="Live" value="Attendance" />
              <OperationalMetric icon={ClipboardList} label="Task" value="Assignments" />
              <OperationalMetric icon={FileDown} label="CSV" value="Exports" />
            </div>
          </div>

          <div className="grid gap-4">
            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink/45">Event readiness</p>
                  <h2 className="mt-2 text-2xl font-black text-ink">Before doors open</h2>
                </div>
                <ShieldCheck className="text-moss" size={34} />
              </div>
              <div className="mt-5 grid gap-3">
                {readinessItems.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-md border border-ink/10 bg-paper p-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-moss" />
                    <p className="text-sm font-semibold leading-6 text-ink/75">{item}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-ink/10 bg-ink p-5 text-white shadow-soft">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">Shift flow</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <FlowStep number="01" title="Publish" body="Copy the active event link and attach it to QR signage." />
                <FlowStep number="02" title="Coordinate" body="Watch arrivals, skills, task status, and volunteer notes." />
                <FlowStep number="03" title="Close" body="Export attendance, assignments, and activity records." />
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}

function OperationalMetric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof UsersRound;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
      <Icon className="text-moss" size={22} />
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-ink/45">{label}</p>
      <p className="mt-1 text-lg font-black text-ink">{value}</p>
    </div>
  );
}

function FlowStep({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/10 p-3">
      <p className="text-xs font-black text-gold">{number}</p>
      <h3 className="mt-2 text-lg font-black">{title}</h3>
      <p className="mt-2 text-sm font-medium leading-6 text-white/70">{body}</p>
    </div>
  );
}
