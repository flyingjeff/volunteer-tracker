import Link from "next/link";
import { CalendarDays, QrCode, ShieldCheck } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen px-5 py-6 sm:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col justify-between gap-8">
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

        <div className="grid gap-5 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-clay">Mobile-first MVP</p>
            <h2 className="mt-3 text-4xl font-black leading-tight text-ink sm:text-6xl">
              Scan once. Serve clearly. Report hours cleanly.
            </h2>
            <p className="mt-5 text-base leading-7 text-ink/75 sm:text-lg">
              Volunteers use one public QR code per site or event. Supervisors sign in with Google, see live
              attendance, manage tasks, and export hours to Google Sheets.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/e/demo-sunday"
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-moss px-5 py-3 font-bold text-white shadow-soft"
              >
                <QrCode size={19} />
                Try Volunteer Flow
              </Link>
              <Link
                href="/supervisor"
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-5 py-3 font-bold text-ink"
              >
                <ShieldCheck size={19} />
                Open Dashboard
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-ink/10 bg-white/86 p-4 shadow-soft">
            <div className="aspect-[4/5] rounded-md bg-[linear-gradient(145deg,#315542,#4f7a5d_55%,#c99b35)] p-5 text-white">
              <QrCode size={72} strokeWidth={1.5} />
              <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em]">Public QR route</p>
              <p className="mt-2 break-all text-2xl font-black">/e/demo-sunday</p>
              <div className="mt-8 flex items-center gap-3 rounded-md bg-white/15 p-3 backdrop-blur">
                <CalendarDays />
                <p className="text-sm font-medium">Multiple events and sites are supported by event ID.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
