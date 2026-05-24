# Su Presencia Volunteer Check-In

Mobile-first volunteer check-in MVP for Su Presencia Church using Next.js, TypeScript, Tailwind CSS, Firebase Auth, and Firestore.

## Project Structure

```txt
src/app/page.tsx                 Landing and quick test links
src/app/e/[eventId]/page.tsx     Volunteer QR check-in flow
src/app/supervisor/page.tsx      Supervisor dashboard
src/components/                  Shared UI, PWA registration, Kanban board
src/lib/firebase.ts              Firebase app/auth/firestore setup
src/lib/firebaseService.ts       Firestore reads, writes, realtime listeners
src/lib/token.ts                 Secure browser token creation and hashing
docs/firestore-schema.md         Data model and index notes
firestore.rules                  Starter Firestore security rules
public/manifest.webmanifest      PWA manifest
public/sw.js                     Basic service worker
firebase.json                    Spark-compatible static Firebase Hosting config
```

## MVP Pages

- `/e?eventId=demo-sunday`: volunteer profile, check-in, check-out, assigned tasks.
- `/e/demo-sunday`: production QR-friendly URL supported by Firebase Hosting rewrite.
- `/supervisor`: Google Sign-In, live attendance, task creation, Kanban board, assignments, skills search, attendance history, CSV export.

## Firebase Spark Plan Compatibility

This MVP is designed to run on the Firebase Spark plan.

Use on Spark:

- Firebase Authentication with Google Sign-In for supervisors.
- Firestore for volunteers, attendance sessions, events, and tasks.
- Firebase Hosting as a static site from the `out` folder.
- Client-side realtime Firestore listeners.
- CSV export for Google Sheets import.

Avoid on Spark:

- Cloud Functions.
- Next.js server rendering on Firebase.
- Automatic Google Sheets API sync from a server.
- Automatic Gmail sending.
- Automatic Google Calendar sync.
- Phone/SMS authentication.

Google Workspace automation can be added later, but the Spark-safe version is CSV export plus manual import into Google Sheets.

## Firebase Setup

1. Create a Firebase project.
2. Add a Web App in Firebase settings.
3. Enable Authentication with Google provider.
4. Enable Firestore in production mode.
5. Copy `.env.local.example` to `.env.local` and fill in the Firebase web app values.
6. Set `NEXT_PUBLIC_SUPERVISOR_EMAIL_DOMAIN` to the Google Workspace domain for supervisors.
7. Deploy `firestore.rules` from Firebase CLI or paste them into the Firebase console.
8. Create Firestore indexes from [docs/firestore-schema.md](docs/firestore-schema.md) when prompted.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deployment

### Firebase Hosting on Spark

```bash
npm install -g firebase-tools
firebase login
npm run build
firebase deploy
```

Before deploy:

1. Copy `.firebaserc.example` to `.firebaserc`.
2. Replace `your-firebase-project-id` with the Firebase project ID.
3. Add the Firebase web app environment variables locally in `.env.local` before building.
4. Run `npm run build`, which writes the static site to `out`.
5. Run `firebase deploy`.

Do not enable Firebase web frameworks or Next.js server rendering for the Spark deployment. The included `firebase.json` deploys static files only.

In Cloud Shell, create `.env.local` inside the cloned repo before `npm run build`:

```bash
cd ~/volunteer-tracker
nano .env.local
```

Use this shape:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_SUPERVISOR_EMAIL_DOMAIN=your-google-workspace-domain.org
```

If these variables are missing during `npm run build`, the supervisor dashboard will show a Firebase setup required screen instead of allowing access.

## Google Workspace Integration Path

- Supervisors use Google Sign-In now.
- CSV attendance export is included for Google Sheets import.
- A future automatic Sheets integration would likely require Cloud Functions or another backend.
- Gmail notifications should stay manual or use an external tool while staying on Spark.
- Google Calendar scheduling can be tracked manually in Firestore now; automatic sync is a future backend integration.
