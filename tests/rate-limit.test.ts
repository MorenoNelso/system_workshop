import { describe, expect, it, beforeEach, vi } from "vitest";

const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

let rateLimitLogin: (email: string) => Promise<boolean>;
let rateLimitRecuperacion: (email: string) => Promise<boolean>;
let rateLimitMfa: (userId: string) => Promise<boolean>;
let rateLimitFactura: (userId: string) => Promise<boolean>;

beforeEach(async () => {
  vi.resetModules();
  mockRpc.mockReset();
  const mod = await import("@/lib/rate-limit");
  rateLimitLogin = mod.rateLimitLogin;
  rateLimitRecuperacion = mod.rateLimitRecuperacion;
  rateLimitMfa = mod.rateLimitMfa;
  rateLimitFactura = mod.rateLimitFactura;
});

describe("rateLimitLogin", () => {
  it("permite intentos dentro del límite", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    expect(await rateLimitLogin("x@correo.com")).toBe(true);
  });

  it("bloquea cuando se supera el límite", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    expect(await rateLimitLogin("x@correo.com")).toBe(false);
  });
});

describe("rateLimitRecuperacion", () => {
  it("permite solicitudes dentro del límite", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    expect(await rateLimitRecuperacion("x@correo.com")).toBe(true);
  });

  it("bloquea cuando se supera el límite", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    expect(await rateLimitRecuperacion("x@correo.com")).toBe(false);
  });
});

describe("rateLimitMfa", () => {
  it("permite intentos dentro del límite", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    expect(await rateLimitMfa("user-123")).toBe(true);
  });

  it("bloquea cuando se supera el límite", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    expect(await rateLimitMfa("user-123")).toBe(false);
  });
});

describe("rateLimitFactura", () => {
  it("permite facturas dentro del límite", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    expect(await rateLimitFactura("user-123")).toBe(true);
  });

  it("bloquea cuando se supera el límite", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    expect(await rateLimitFactura("user-123")).toBe(false);
  });
});

describe("rateLimit fallback", () => {
  it("si la BD falla, permite la acción (degrada)", async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error("db down") });
    expect(await rateLimitLogin("x@correo.com")).toBe(true);
  });
});
