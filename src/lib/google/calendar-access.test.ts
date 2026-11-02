import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CALENDAR_SCOPE,
  checkCalendarAccount,
  completeCalendarConnection,
  ConnectStepError,
  type ConnectDeps,
  type OAuthResult,
} from "./calendar-access";
import { cleanEnvValue, encryptionKeyFrom, googleConfigIssues, googleErrorCode, safeErrorDetail } from "./env";

const RON = { id: "partner-ron", email: "ronketerltd@gmail.com" };
const GUY = { id: "partner-guy", email: "guyketerltd@gmail.com" };
const ALL_SCOPES = ["openid", "https://www.googleapis.com/auth/userinfo.email", CALENDAR_SCOPE];

function oauthResult(overrides: Partial<OAuthResult> = {}): OAuthResult {
  return {
    googleEmail: RON.email,
    googleEmailVerified: true,
    grantedScopes: ALL_SCOPES,
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiryDate: Date.now() + 3600_000,
    ...overrides,
  };
}

function fakeDeps(result: OAuthResult) {
  const saved: unknown[] = [];
  const revoked: string[] = [];
  const deps: ConnectDeps = {
    exchangeCode: async () => result,
    saveTokens: async (...args) => {
      saved.push(args);
    },
    revokeToken: async (token) => {
      revoked.push(token);
    },
  };
  return { deps, saved, revoked };
}

test("an unrelated Google account is rejected, nothing is saved, and its grant is revoked", async () => {
  const { deps, saved, revoked } = fakeDeps(
    oauthResult({ googleEmail: "someone.else@gmail.com" })
  );
  const outcome = await completeCalendarConnection({ code: "c", appUser: RON }, deps);

  assert.deepEqual(outcome, {
    ok: false,
    error: "wrong_account",
    googleEmail: "someone.else@gmail.com",
  });
  assert.equal(saved.length, 0);
  assert.deepEqual(revoked, ["refresh-token"]);
});

test("Ron cannot connect Guy's account (and vice versa)", async () => {
  for (const [appUser, googleEmail] of [
    [RON, GUY.email],
    [GUY, RON.email],
  ] as const) {
    const { deps, saved } = fakeDeps(oauthResult({ googleEmail }));
    const outcome = await completeCalendarConnection({ code: "c", appUser }, deps);
    assert.equal(outcome.ok, false);
    assert.equal(!outcome.ok && outcome.error, "wrong_account");
    assert.equal(saved.length, 0);
  }
});

test("an app user whose email isn't one of the two partner accounts can't connect anything", async () => {
  const intruder = { id: "x", email: "intruder@gmail.com" };
  const { deps, saved } = fakeDeps(oauthResult({ googleEmail: intruder.email }));
  const outcome = await completeCalendarConnection({ code: "c", appUser: intruder }, deps);
  assert.equal(!outcome.ok && outcome.error, "not_syncable");
  assert.equal(saved.length, 0);
});

test("a look-alike email (different dots / plus-alias) is rejected", () => {
  for (const googleEmail of [
    "ron.keterltd@gmail.com",
    "ronketerltd+x@gmail.com",
    "ronketerltd@googlemail.com",
  ]) {
    const result = checkCalendarAccount({
      appUserEmail: RON.email,
      googleEmail,
      googleEmailVerified: true,
      grantedScopes: ALL_SCOPES,
    });
    assert.deepEqual(result, { ok: false, error: "wrong_account" }, googleEmail);
  }
});

test("missing / unverified email and missing calendar scope are rejected", () => {
  const base = {
    appUserEmail: RON.email,
    googleEmail: RON.email,
    googleEmailVerified: true,
    grantedScopes: ALL_SCOPES,
  };
  assert.deepEqual(checkCalendarAccount({ ...base, googleEmail: null }), {
    ok: false,
    error: "wrong_account",
  });
  assert.deepEqual(checkCalendarAccount({ ...base, googleEmailVerified: false }), {
    ok: false,
    error: "unverified",
  });
  assert.deepEqual(
    checkCalendarAccount({ ...base, grantedScopes: ["openid", "email"] }),
    { ok: false, error: "scope" }
  );
});

test("the partner's own account (any letter case) is accepted and saved", async () => {
  const { deps, saved, revoked } = fakeDeps(
    oauthResult({ googleEmail: "RonKeterLtd@Gmail.com" })
  );
  const outcome = await completeCalendarConnection({ code: "c", appUser: RON }, deps);
  assert.deepEqual(outcome, { ok: true });
  assert.equal(saved.length, 1);
  assert.equal((saved[0] as unknown[])[1], RON.email);
  assert.equal(revoked.length, 0);
});

test("a failed code exchange saves nothing", async () => {
  const { deps, saved } = fakeDeps(oauthResult());
  deps.exchangeCode = async () => {
    throw new Error("invalid_grant");
  };
  const outcome = await completeCalendarConnection({ code: "c", appUser: RON }, deps);
  assert.equal(outcome.ok, false);
  assert.equal(!outcome.ok && outcome.error, "google");
  assert.equal(!outcome.ok && "step" in outcome && outcome.step, "token_exchange");
  assert.equal(saved.length, 0);
});

test("a technical failure says where it happened: Google vs saving", async () => {
  const googleDown: ConnectDeps = {
    ...fakeDeps(oauthResult()).deps,
    exchangeCode: async () => {
      throw new ConnectStepError("token_exchange", { response: { status: 401, data: { error: "invalid_client" } } });
    },
  };
  const g = await completeCalendarConnection({ code: "c", appUser: RON }, googleDown);
  assert.equal(g.ok, false);
  assert.equal(!g.ok && g.error, "google");
  assert.equal(!g.ok && "step" in g && g.step, "token_exchange");

  const saveFails: ConnectDeps = {
    ...fakeDeps(oauthResult()).deps,
    saveTokens: async () => {
      throw new ConnectStepError("encrypt", new Error("bad key"));
    },
  };
  const s = await completeCalendarConnection({ code: "c", appUser: RON }, saveFails);
  assert.equal(!s.ok && s.error, "save");
  assert.equal(!s.ok && "step" in s && s.step, "encrypt");

  const noRefresh = await completeCalendarConnection(
    { code: "c", appUser: RON },
    fakeDeps(oauthResult({ refreshToken: null })).deps
  );
  assert.equal(!noRefresh.ok && "step" in noRefresh && noRefresh.step, "no_refresh_token");
});

test("environment values: quotes and spaces are ignored; the key format is checked", () => {
  assert.equal(cleanEnvValue('  "abc"\n'), "abc");
  assert.equal(cleanEnvValue("'x'"), "x");
  const hex = "a".repeat(64);
  assert.equal(encryptionKeyFrom(hex).derived, false);
  assert.equal(encryptionKeyFrom(hex).key.length, 32);
  const pw = encryptionKeyFrom("a-long-password-style-secret-value-40ch!");
  assert.equal(pw.derived, true);
  assert.equal(pw.key.length, 32);
  assert.throws(() => encryptionKeyFrom("short"));

  const good = {
    GOOGLE_CLIENT_ID: "1-abc.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "secret",
    APP_URL: "https://ceter-engineers.vercel.app",
    TOKEN_ENCRYPTION_KEY: hex,
  } as Record<string, string>;
  assert.deepEqual(googleConfigIssues((n) => good[n]), []);
  const bad: Record<string, string> = { ...good, APP_URL: "ceter-engineers.vercel.app", TOKEN_ENCRYPTION_KEY: `"${hex}"` };
  const issues = googleConfigIssues((n) => bad[n]);
  assert.deepEqual(issues.map((i) => [i.name, i.blocking]), [
    ["TOKEN_ENCRYPTION_KEY", false],
    ["APP_URL", true],
  ]);
});

test("error details never carry token-like strings", () => {
  const e = { response: { status: 400, data: { error: "invalid_grant", error_description: "Bad Request" } } };
  assert.equal(safeErrorDetail(e), "400 invalid_grant Bad Request");
  assert.equal(googleErrorCode(e), "invalid_grant");
  assert.equal(safeErrorDetail(new Error("failed for ya29.a0AfB_byC1234567890abcdefghijklmnop")), "failed for […]");
});
