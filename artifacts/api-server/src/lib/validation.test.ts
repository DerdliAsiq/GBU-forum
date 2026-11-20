import { describe, expect, it } from "vitest";
import { isReservedAuthorName } from "./authorName";
import { validateDisplayName, validatePassword, validateUsername } from "./userValidation";

describe("isReservedAuthorName", () => {
  it.each(["Admin", "ADMİN", "Admın", "adm1n", "M0derator", "İdarəçi", "Rəhbərlik", "system"])(
    "blocks staff-like name %s",
    (name) => expect(isReservedAuthorName(name)).toBe(true),
  );

  it.each(["Əli Həsənov", "Ayşə", "Kamran", "Modern Tələbə", "Anonim"])("allows ordinary name %s", (name) =>
    expect(isReservedAuthorName(name)).toBe(false),
  );
});

describe("validateUsername", () => {
  it("accepts normal usernames", () => {
    expect(validateUsername("camila2005_")).toBeNull();
    expect(validateUsername("nərmin.k")).toBeNull();
  });

  it("rejects bad length, characters and reserved names", () => {
    expect(validateUsername("a")).not.toBeNull();
    expect(validateUsername("x".repeat(51))).not.toBeNull();
    expect(validateUsername("ali veli")).not.toBeNull();
    expect(validateUsername("<script>")).not.toBeNull();
    expect(validateUsername("admin_2")).not.toBeNull();
  });

  it("lets admins keep reserved names", () => {
    expect(validateUsername("admin", { allowReserved: true })).toBeNull();
  });
});

describe("validatePassword / validateDisplayName", () => {
  it("requires 8+ character passwords", () => {
    expect(validatePassword("short")).not.toBeNull();
    expect(validatePassword("long-enough")).toBeNull();
  });

  it("rejects empty or staff-like display names", () => {
    expect(validateDisplayName("   ")).not.toBeNull();
    expect(validateDisplayName("Moderator")).not.toBeNull();
    expect(validateDisplayName("Tələbə")).toBeNull();
  });
});
