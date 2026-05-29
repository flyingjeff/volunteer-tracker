const STORAGE_KEY = "spc_volunteer_token";
const VOLUNTEER_ID_KEY = "spc_volunteer_id";

export function getOrCreateBrowserToken() {
  if (typeof window === "undefined") return "";

  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  window.localStorage.setItem(STORAGE_KEY, token);
  return token;
}

export function clearBrowserToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(VOLUNTEER_ID_KEY);
}

export function getSavedVolunteerId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(VOLUNTEER_ID_KEY) ?? "";
}

export function saveVolunteerSession(volunteerId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VOLUNTEER_ID_KEY, volunteerId);
}

export async function sha256(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
