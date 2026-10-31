import { describe, expect, it } from "vitest";
import {
  buildGoogleAuthUrl,
  decodeJwtClaims,
  safeCustomerNext,
  validateGoogleClaims,
} from "./google-oidc";

const now = new Date("2026-11-01T12:00:00Z");
const expected = { clientId: "cliente-123", nonce: "n-1", now };
const valid = {
  iss: "https://accounts.google.com",
  aud: "cliente-123",
  exp: Math.floor(now.getTime() / 1000) + 3600,
  nonce: "n-1",
  sub: "1122",
  email: " Sofia@Gmail.com ",
  email_verified: true,
  name: "Sofía Díaz",
};

describe("validateGoogleClaims", () => {
  it("acepta un token correcto y normaliza el email", () => {
    expect(validateGoogleClaims(valid, expected)).toEqual({
      ok: true,
      identity: { sub: "1122", email: "sofia@gmail.com", name: "Sofía Díaz" },
    });
  });

  it("rechaza otro emisor, otro destinatario o un nonce distinto", () => {
    expect(validateGoogleClaims({ ...valid, iss: "https://evil.com" }, expected)).toMatchObject({
      code: "INVALID",
    });
    expect(validateGoogleClaims({ ...valid, aud: "otro" }, expected)).toMatchObject({
      code: "INVALID",
    });
    expect(validateGoogleClaims({ ...valid, nonce: "x" }, expected)).toMatchObject({
      code: "INVALID",
    });
  });

  it("acepta el destinatario dentro de una lista", () => {
    expect(validateGoogleClaims({ ...valid, aud: ["x", "cliente-123"] }, expected).ok).toBe(true);
  });

  it("rechaza un token vencido", () => {
    expect(validateGoogleClaims({ ...valid, exp: valid.exp - 7200 }, expected)).toMatchObject({
      code: "EXPIRED",
    });
  });

  it("exige email verificado", () => {
    expect(validateGoogleClaims({ ...valid, email_verified: false }, expected)).toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
    });
    expect(validateGoogleClaims({ ...valid, email_verified: "true" }, expected).ok).toBe(true);
    expect(validateGoogleClaims({ ...valid, email_verified: undefined }, expected).ok).toBe(false);
  });

  it("rechaza si falta el identificador o el email", () => {
    expect(validateGoogleClaims({ ...valid, sub: undefined }, expected).ok).toBe(false);
    expect(validateGoogleClaims({ ...valid, email: undefined }, expected).ok).toBe(false);
  });
});

describe("otros", () => {
  it("arma la URL de Google con PKCE", () => {
    const url = new URL(
      buildGoogleAuthUrl({
        clientId: "c",
        redirectUri: "http://localhost:3000/api/cuenta/google/callback",
        state: "s",
        nonce: "n",
        codeChallenge: "ch",
      }),
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe("s");
  });

  it("decodifica las claims de un JWT y tolera basura", () => {
    const body = Buffer.from(JSON.stringify({ a: 1 })).toString("base64url");
    expect(decodeJwtClaims(`x.${body}.y`)).toEqual({ a: 1 });
    expect(decodeJwtClaims("nada")).toBeNull();
    expect(decodeJwtClaims("x.%%%.y")).toBeNull();
  });
});

describe("safeCustomerNext", () => {
  it("solo deja rutas internas", () => {
    expect(safeCustomerNext("/checkout")).toBe("/checkout");
    for (const bad of ["https://evil.com", "//evil.com", "evil", "/a\\b", null, undefined]) {
      expect(safeCustomerNext(bad)).toBe("/mi-cuenta");
    }
  });
});
