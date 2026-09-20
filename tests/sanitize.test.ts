import { describe, expect, it } from "vitest";

import {
  sanitizeText,
  sanitizeParagraph,
  sanitizeEmail,
  sanitizePhone,
  optionalText,
} from "@/lib/sanitize";

describe("sanitizeText", () => {
  it("collapses whitespace", () => expect(sanitizeText("  hola   mundo  ")).toBe("hola mundo"));
  it("removes control characters", () =>
    expect(sanitizeText("hola\x00mundo\x1f")).toBe("holamundo"));
  it("truncates to max", () => expect(sanitizeText("abcdefghij", 5)).toBe("abcde"));
  it("returns empty for non-string", () => expect(sanitizeText(123)).toBe(""));
  it("returns empty for empty string", () => expect(sanitizeText("")).toBe(""));
  it("handles null", () => expect(sanitizeText(null)).toBe(""));
});

describe("sanitizeParagraph", () => {
  it("preserves line breaks", () =>
    expect(sanitizeParagraph("linea1\nlinea2")).toBe("linea1\nlinea2"));
  it("normalizes CRLF to LF", () =>
    expect(sanitizeParagraph("linea1\r\nlinea2")).toBe("linea1\nlinea2"));
  it("removes control characters but keeps newlines", () =>
    expect(sanitizeParagraph("hola\x00\nmundo\x1f")).toBe("hola\nmundo"));
  it("trims each line", () => expect(sanitizeParagraph("  hola  \n  mundo  ")).toBe("hola\nmundo"));
  it("truncates to max", () => expect(sanitizeParagraph("abcdefghij", 5)).toBe("abcde"));
  it("returns empty for non-string", () => expect(sanitizeParagraph(42)).toBe(""));
});

describe("sanitizeEmail", () => {
  it("lowercases", () => expect(sanitizeEmail("USER@EMAIL.COM")).toBe("user@email.com"));
  it("trims spaces", () => expect(sanitizeEmail("  user@email.com  ")).toBe("user@email.com"));
  it("returns empty for non-string", () => expect(sanitizeEmail(null)).toBe(""));
});

describe("sanitizePhone", () => {
  it("keeps digits and common symbols", () =>
    expect(sanitizePhone("+57 300 123 4567")).toBe("+57 300 123 4567"));
  it("removes letters", () => expect(sanitizePhone("abc123")).toBe("123"));
  it("truncates to 20", () =>
    expect(sanitizePhone("123456789012345678901234")).toBe("12345678901234567890"));
  it("returns empty for non-string", () => expect(sanitizePhone(undefined)).toBe(""));
});

describe("optionalText", () => {
  it("returns null for empty", () => expect(optionalText("")).toBe(null));
  it("returns null for whitespace only", () => expect(optionalText("   ")).toBe(null));
  it("returns trimmed text", () => expect(optionalText("  hola  ")).toBe("hola"));
  it("returns null for non-string empty", () => expect(optionalText(null)).toBe(null));
});
