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

QR codes should point to `/e/{eventId}`. For multiple worksites under one event, add `siteId` query or route support later.

## `volunteers/{volunteerId}`

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

Volunteers do not use passwords. The app stores a random token in browser local storage and only saves its SHA-256 hash in Firestore.

## `attendanceSessions/{sessionId}`

```ts
{
  eventId: string;
  siteId: string;
  volunteerId: string;
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

## Recommended Indexes

Create composite indexes when Firebase prompts:

- `attendanceSessions`: `eventId ASC`, `status ASC`, `checkedInAt DESC`
- `attendanceSessions`: `eventId ASC`, `checkedInAt DESC`
- `tasks`: `eventId ASC`, `createdAt DESC`

## Google Workspace Extensions

- Google Sheets export: use the dashboard CSV export now, or add a Firebase Cloud Function with the Google Sheets API for one-click sync.
- Gmail notifications: trigger Cloud Functions on task assignment or event creation.
- Google Calendar: store `googleCalendarEventId` on `events/{eventId}` and sync schedules through a Cloud Function.
