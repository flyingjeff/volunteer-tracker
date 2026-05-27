import type { AttendanceSession, VolunteerProfile, VolunteerTask } from "@/lib/types";

export const demoVolunteers: VolunteerProfile[] = [
  {
    id: "v1",
    firstName: "Ana",
    lastName: "Rivera",
    phone: "555-0142",
    email: "ana@example.com",
    dateOfBirth: "1994-06-12",
    skills: ["supervisor", "kids", "hospitality", "bilingual"],
    emergencyContact: "Luis Rivera, 555-0111",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    waiverSignerName: "Ana Rivera",
    waiverSignedBy: "volunteer",
    waiverAcknowledgedAt: new Date(),
    waiverTextVersion: "renovation-safety-2026-05",
    notes: "Prefers front-door greeting.",
    consentAcknowledged: true,
    browserTokenHash: "demo",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "v2",
    firstName: "Mateo",
    lastName: "Garcia",
    phone: "555-0198",
    email: "mateo@example.com",
    dateOfBirth: "2006-11-03",
    skills: ["setup", "audio", "transport"],
    emergencyContact: "Camila Garcia, 555-0199",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    waiverSignerName: "Mateo Garcia",
    waiverSignedBy: "volunteer",
    waiverAcknowledgedAt: new Date(),
    waiverTextVersion: "renovation-safety-2026-05",
    notes: "Available until noon.",
    consentAcknowledged: true,
    browserTokenHash: "demo2",
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const demoAttendance: AttendanceSession[] = [
  {
    id: "a1",
    eventId: "demo-sunday",
    siteId: "main",
    volunteerId: "v1",
    volunteerName: "Ana Rivera",
    status: "checked-in",
    checkedInAt: new Date(Date.now() - 55 * 60000)
  },
  {
    id: "a2",
    eventId: "demo-sunday",
    siteId: "main",
    volunteerId: "v2",
    volunteerName: "Mateo Garcia",
    status: "checked-in",
    checkedInAt: new Date(Date.now() - 24 * 60000)
  }
];

export const demoTasks: VolunteerTask[] = [
  {
    id: "t1",
    eventId: "demo-sunday",
    siteId: "main",
    title: "Welcome table",
    description: "Greet arrivals and help new volunteers register.",
    status: "in-progress",
    assignedVolunteerIds: ["v1"],
    skillTags: ["hospitality", "bilingual"],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "t2",
    eventId: "demo-sunday",
    siteId: "main",
    title: "Room setup",
    description: "Arrange chairs, signs, and supplies before service.",
    status: "todo",
    assignedVolunteerIds: ["v2"],
    skillTags: ["setup"],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];
