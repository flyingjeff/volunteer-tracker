# Firestore Schema

This MVP uses top-level collections so supervisors can query across events for reports.

## `events/{eventId}`

```ts
{
  name: string;
  location: string;
  startsAt: Timestamp;
  endsAt?: Timestamp;
  active: boolean;
  createdBy?: string;
}
```

QR codes can point to `/e/{eventId}` in production. Firebase Hosting rewrites that URL to the static `/e` page, and the browser reads the event ID from the path. During local development, `/e?eventId={eventId}` also works.

## `volunteers/{volunteerTokenHash}`

```ts
{
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  skills: string[];
  emergencyContact: string;
  notes: string;
  consentAcknowledged: boolean;
  browserTokenHash: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Volunteers do not use passwords. The app stores a random token in browser local storage and uses its SHA-256 hash as the volunteer document ID. That lets returning volunteers load their own profile without exposing the full volunteer collection.

## `attendanceSessions/{sessionId}`

```ts
{
  eventId: string;
  siteId: string;
  volunteerId: string;
  volunteerTokenHash: string;
  volunteerName: string;
  status: "checked-in" | "checked-out";
  checkedInAt: Timestamp;
  checkedOutAt?: Timestamp;
  totalMinutes?: number;
}
```

## `tasks/{taskId}`

```ts
{
  eventId: string;
  siteId: string;
  title: string;
  description: string;
  status: "todo" | "in-progress" | "complete";
  assignedVolunteerIds: string[];
  skillTags: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## `taskFeedback/{feedbackId}`

```ts
{
  eventId: string;
  siteId: string;
  volunteerId: string;
  volunteerName: string;
  taskId?: string;
  taskTitle?: string;
  kind: "task-note" | "more-tasks-request";
  message: string;
  createdAt: Timestamp;
}
```

Volunteers can create task feedback without signing in. Supervisors can read the feedback stream for the selected event.

Volunteers can also add themselves to an in-progress task. Firestore rules restrict anonymous task updates to `assignedVolunteerIds` and `updatedAt`, so task details and status stay supervisor-controlled.

## Index Notes

The MVP avoids composite-index requirements for the event task board by querying each event and sorting the small result sets in the browser. If the app later needs larger reports or cross-event filtering, add composite indexes when Firebase prompts.

## Spark-Safe Google Workspace Path

- Google Sheets export: use the dashboard CSV export and import the file into Google Sheets.
- Gmail notifications: keep manual for Spark, or use a separate no-code automation tool later.
- Google Calendar: store event details in Firestore now; automatic sync should wait for a backend integration.

Avoid Cloud Functions if the project must stay on Firebase Spark.
