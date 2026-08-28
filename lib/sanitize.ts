/**
 * Sanitización de campos de texto libre antes de persistir.
 * Colapsa espacios múltiples y elimina caracteres de control.
 */

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Texto libre normalizado (una línea, sin espacios de más). */
export function sanitizeText(value: unknown, max = 500): string {
  if (typeof value !== "string") return "";
  const cleaned = collapseWhitespace(value)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, max);
  return cleaned;
}

/** Texto largo (textarea) que conserva saltos de línea pero sin control chars. */
export function sanitizeParagraph(value: unknown, max = 2000): string {
  if (typeof value !== "string") return "";
  const cleaned = value
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
  return cleaned.slice(0, max);
}

/** Normaliza un email a minúsculas y sin espacios. */
export function sanitizeEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

/** Teléfono: solo dígitos y símbolos comunes (+ - espacio). */
export function sanitizePhone(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[^\d+ ()-]/g, "").trim().slice(0, 20);
}

/** Devuelve `null` para valores vacíos, texto limpio en caso contrario. */
export function optionalText(value: unknown, max = 500): string | null {
  const cleaned = sanitizeText(value, max);
  return cleaned === "" ? null : cleaned;
}
