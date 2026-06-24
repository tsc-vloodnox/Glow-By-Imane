export const ADMIN_COOKIE_NAME = "glow-admin-auth";

export const DEFAULT_ADMIN_PHONE = process.env.ADMIN_PHONE ?? "620000000";
export const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";

export function buildAdminCookieValue(phone: string, password: string) {
  return `${encodeURIComponent(phone)}:${encodeURIComponent(password)}`;
}

export function isAdminCredentialsValid(phone: string, password: string) {
  return phone === DEFAULT_ADMIN_PHONE && password === DEFAULT_ADMIN_PASSWORD;
}

export function isAdminCookieValid(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const [rawPhone, rawPassword] = value.split(":");
  if (!rawPhone || !rawPassword) {
    return false;
  }

  const phone = decodeURIComponent(rawPhone);
  const password = decodeURIComponent(rawPassword);

  return isAdminCredentialsValid(phone, password);
}
