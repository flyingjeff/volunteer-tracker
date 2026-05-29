import type { VolunteerProfile } from "@/lib/types";

const STORAGE_KEY = "spc_volunteer_token";
const VOLUNTEER_ID_KEY = "spc_volunteer_id";
const VOLUNTEER_PROFILE_KEY = "spc_volunteer_profile";

function savedDate(value: unknown) {
  return typeof value === "string" || value instanceof Date ? new Date(value) : new Date();
}

export function getOrCreateBrowserToken() {
  if (typeof window === "undefined") return "";

  let existing = "";
  try {
    existing = window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    existing = "";
  }
  if (existing) return existing;

  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Ignore storage failures; this visit can still use the generated token in memory.
  }
  return token;
}

export function clearBrowserToken() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(VOLUNTEER_ID_KEY);
    window.localStorage.removeItem(VOLUNTEER_PROFILE_KEY);
  } catch {
    // Ignore storage failures so the dashboard can still reset in memory.
  }
}

export function getSavedVolunteerId() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(VOLUNTEER_ID_KEY) ?? "";
  } catch {
    return "";
  }
}

export function getSavedVolunteerProfile() {
  if (typeof window === "undefined") return null;

  let saved = "";
  try {
    saved = window.localStorage.getItem(VOLUNTEER_PROFILE_KEY) ?? "";
  } catch {
    return null;
  }
  if (!saved) return null;

  try {
    const profile = JSON.parse(saved) as VolunteerProfile;
    if (!profile.id) return null;

    return {
      ...profile,
      waiverAcknowledgedAt: profile.waiverAcknowledgedAt ? savedDate(profile.waiverAcknowledgedAt) : undefined,
      createdAt: savedDate(profile.createdAt),
      updatedAt: savedDate(profile.updatedAt)
    };
  } catch {
    try {
      window.localStorage.removeItem(VOLUNTEER_PROFILE_KEY);
    } catch {
      // Ignore cleanup failures.
    }
    return null;
  }
}

export function saveVolunteerSession(volunteer: VolunteerProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VOLUNTEER_ID_KEY, volunteer.id);
    window.localStorage.setItem(VOLUNTEER_PROFILE_KEY, JSON.stringify(volunteer));
  } catch {
    // Ignore storage failures; the current React state remains authoritative.
  }
}

export async function sha256(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
