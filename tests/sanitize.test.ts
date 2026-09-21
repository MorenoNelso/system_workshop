import { describe, expect, it } from "vitest";

import {
  sanitizeText,
  sanitizeParagraph,
  sanitizeEmail,
  sanitizePhone,
  optionalText,
} from "@/lib/sanitize";

describe("sanitizeText", () => {
  it("colapsa espacios en blanco", () => expect(sanitizeText("  hola   mundo  ")).toBe("hola mundo"));
  it("elimina caracteres de control", () =>
    expect(sanitizeText("hola\x00mundo\x1f")).toBe("holamundo"));
  it("trunca al máximo", () => expect(sanitizeText("abcdefghij", 5)).toBe("abcde"));
  it("retorna vacío para non-string", () => expect(sanitizeText(123)).toBe(""));
  it("retorna vacío para string vacío", () => expect(sanitizeText("")).toBe(""));
  it("maneja null", () => expect(sanitizeText(null)).toBe(""));
});

describe("sanitizeParagraph", () => {
  it("preserva saltos de línea", () =>
    expect(sanitizeParagraph("linea1\nlinea2")).toBe("linea1\nlinea2"));
  it("normaliza CRLF a LF", () =>
    expect(sanitizeParagraph("linea1\r\nlinea2")).toBe("linea1\nlinea2"));
  it("elimina caracteres de control pero conserva newlines", () =>
    expect(sanitizeParagraph("hola\x00\nmundo\x1f")).toBe("hola\nmundo"));
  it("recorta cada línea", () => expect(sanitizeParagraph("  hola  \n  mundo  ")).toBe("hola\nmundo"));
  it("trunca al máximo", () => expect(sanitizeParagraph("abcdefghij", 5)).toBe("abcde"));
  it("retorna vacío para non-string", () => expect(sanitizeParagraph(42)).toBe(""));
});

describe("sanitizeEmail", () => {
  it("convierte a minúsculas", () => expect(sanitizeEmail("USER@EMAIL.COM")).toBe("user@email.com"));
  it("recorta espacios", () => expect(sanitizeEmail("  user@email.com  ")).toBe("user@email.com"));
  it("retorna vacío para non-string", () => expect(sanitizeEmail(null)).toBe(""));
});

describe("sanitizePhone", () => {
  it("conserva dígitos y símbolos comunes", () =>
    expect(sanitizePhone("+57 300 123 4567")).toBe("+57 300 123 4567"));
  it("elimina letras", () => expect(sanitizePhone("abc123")).toBe("123"));
  it("trunca a 20", () =>
    expect(sanitizePhone("123456789012345678901234")).toBe("12345678901234567890"));
  it("retorna vacío para non-string", () => expect(sanitizePhone(undefined)).toBe(""));
});

describe("optionalText", () => {
  it("retorna null para vacío", () => expect(optionalText("")).toBe(null));
  it("retorna null solo para espacios", () => expect(optionalText("   ")).toBe(null));
  it("retorna texto recortado", () => expect(optionalText("  hola  ")).toBe("hola"));
  it("retorna null para non-string vacío", () => expect(optionalText(null)).toBe(null));
});
