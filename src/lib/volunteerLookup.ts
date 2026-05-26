import { sha256 } from "@/lib/token";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export async function getVolunteerLookupIds(email: string, phone: string) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);
  const lookupInputs = [
    normalizedEmail ? `email:${normalizedEmail}` : "",
    normalizedPhone ? `phone:${normalizedPhone}` : "",
    normalizedEmail && normalizedPhone ? `${normalizedEmail}|${normalizedPhone}` : ""
  ].filter(Boolean);

  return Promise.all(lookupInputs.map((input) => sha256(input)));
}
