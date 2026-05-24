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
```

## MVP Pages

- `/e/demo-sunday`: volunteer profile, check-in, check-out, assigned tasks.
- `/supervisor`: Google Sign-In, live attendance, task creation, Kanban board, assignments, skills search, attendance history, CSV export.

The app runs in demo mode until Firebase environment variables are present.

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

### Vercel

1. Push this repository to GitHub.
2. Import it into Vercel.
3. Add the same environment variables from `.env.local`.
4. Deploy.

### Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

For Firebase Hosting with Next.js server rendering, enable the Firebase web frameworks option during `firebase init hosting`.

## Google Workspace Integration Path

- Supervisors use Google Sign-In now.
- CSV attendance export is included for Google Sheets import.
- A production Sheets integration should use a Firebase Cloud Function with a Google service account.
- Gmail notifications can be sent from Cloud Functions when a task is assigned or completed.
- Google Calendar scheduling can be added by storing Calendar event IDs on Firestore `events`.
