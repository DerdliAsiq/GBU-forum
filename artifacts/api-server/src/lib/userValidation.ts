import { isReservedAuthorName } from "./authorName";

/** Shared by registration and profile updates so the two rules can't drift. */
export const USERNAME_PATTERN = /^[a-zA-Z0-9_\-.ğüşıöçəĞÜŞİÖÇƏ]+$/;
export const USERNAME_MIN = 2;
export const USERNAME_MAX = 50;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const DISPLAY_NAME_MAX = 100;

/** Returns an error message, or null when the username is acceptable. */
export function validateUsername(username: string, { allowReserved = false } = {}): string | null {
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return `İstifadəçi adı ${USERNAME_MIN}-${USERNAME_MAX} simvol olmalıdır`;
  }
  if (!USERNAME_PATTERN.test(username)) {
    return "İstifadəçi adında yalnız hərf, rəqəm, _ - . ola bilər";
  }
  if (!allowReserved && isReservedAuthorName(username)) {
    return "Bu istifadəçi adından istifadə etmək olmaz";
  }
  return null;
}

export function validateDisplayName(name: string, { allowReserved = false } = {}): string | null {
  if (!name.trim() || name.length > DISPLAY_NAME_MAX) {
    return `Ad 1-${DISPLAY_NAME_MAX} simvol olmalıdır`;
  }
  if (!allowReserved && isReservedAuthorName(name)) {
    return "Bu addan istifadə etmək olmaz";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return `Şifrə ən azı ${PASSWORD_MIN} simvol olmalıdır`;
  }
  return null;
}
