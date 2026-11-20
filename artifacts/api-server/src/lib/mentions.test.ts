import { describe, expect, it } from "vitest";
import { extractMentions } from "./mentions";

describe("extractMentions", () => {
  it("finds @usernames, unique and in order", () => {
    expect(extractMentions("salam @ali və @leyla, @ali yenə")).toEqual(["ali", "leyla"]);
  });

  it("supports Azerbaijani letters and trims trailing punctuation", () => {
    expect(extractMentions("@Gülşən. @camila2005_ @nərmin-")).toEqual(["Gülşən", "camila2005_", "nərmin"]);
  });

  it("ignores emails and too-short names", () => {
    expect(extractMentions("mail: test@example.com @a")).toEqual([]);
  });

  it("caps the number of mentions", () => {
    const text = Array.from({ length: 20 }, (_, i) => `@user${i}`).join(" ");
    expect(extractMentions(text, 5)).toHaveLength(5);
  });
});
