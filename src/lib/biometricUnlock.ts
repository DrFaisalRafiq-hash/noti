/**
 * Biometric / passkey "quick unlock" for the lock screen.
 *
 * Strategy (device-local, no server changes):
 *  1. After a successful password login, the user can opt in to enable quick
 *     unlock on this device. We create a platform-bound WebAuthn credential
 *     (Touch ID / Face ID / Android biometric / Windows Hello) and store its
 *     id alongside an encrypted copy of the current Supabase refresh token in
 *     localStorage.
 *  2. On the lock screen, if a credential exists for this device, we show a
 *     biometric button. Tapping it triggers `navigator.credentials.get` with
 *     `userVerification: "required"`, which forces the platform to perform the
 *     biometric / device-PIN check before returning. On success we decrypt the
 *     refresh token and restore the Supabase session.
 *
 * Notes:
 *  - The encryption key is derived from the credential id + a per-install
 *     random salt. This is *device-local obfuscation*, not server-grade
 *     security; the real gate is the platform's user-verification step which
 *     refuses to return an assertion without biometrics / device PIN.
 *  - We refresh and rotate the stored refresh token after each successful
 *     biometric unlock so a leaked snapshot becomes useless quickly.
 */

import { supabase } from "@/integrations/supabase/client";

const STORE_KEY = "noti-bio-unlock-v1";
const RP_NAME = "Noti";

type Stored = {
  credentialId: string; // base64url
  salt: string; // base64url
  iv: string; // base64url
  ciphertext: string; // base64url (encrypted refresh token)
  userHandle: string; // base64url, the Supabase user id bytes
  createdAt: number;
};

// ---------- base64url helpers ----------
function b64uEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64uDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Copy bytes into a fresh ArrayBuffer (satisfies strict BufferSource typing). */
function toBuf(u: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u.byteLength);
  new Uint8Array(ab).set(u);
  return ab;
}

function load(): Stored | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}
function save(s: Stored) {
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
}

export function hasQuickUnlock(): boolean {
  return !!load();
}

export function clearQuickUnlock() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {}
}

/** Whether this browser/device can do platform-authenticator WebAuthn. */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    if (typeof window === "undefined") return false;
    if (!window.PublicKeyCredential) return false;
    if (!window.isSecureContext) return false;
    const fn = (window.PublicKeyCredential as any)
      .isUserVerifyingPlatformAuthenticatorAvailable;
    if (typeof fn !== "function") return false;
    return await fn.call(window.PublicKeyCredential);
  } catch {
    return false;
  }
}

// ---------- crypto: derive AES-GCM key from credential id + salt ----------
async function deriveKey(
  credentialId: Uint8Array,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    toBuf(credentialId),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: toBuf(salt), iterations: 120_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptToken(
  credentialId: Uint8Array,
  refreshToken: string,
): Promise<{ salt: Uint8Array; iv: Uint8Array; ciphertext: Uint8Array }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(credentialId, salt);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: toBuf(iv) },
      key,
      new TextEncoder().encode(refreshToken),
    ),
  );
  return { salt, iv, ciphertext: ct };
}

async function decryptToken(
  credentialId: Uint8Array,
  salt: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
): Promise<string> {
  const key = await deriveKey(credentialId, salt);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toBuf(iv) },
    key,
    toBuf(ciphertext),
  );
  return new TextDecoder().decode(pt);
}

/**
 * Enroll the current device for quick unlock. Must be called while the user
 * is already signed in (we need a refresh token to encrypt).
 */
export async function enrollQuickUnlock(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error("Sign in first to enable quick unlock.");

  const userIdBytes = new TextEncoder().encode(session.user.id);
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: RP_NAME, id: window.location.hostname },
      user: {
        id: userIdBytes,
        name: session.user.email ?? "noti-user",
        displayName: session.user.email ?? "Noti user",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("Biometric enrollment was cancelled.");

  const credentialIdBytes = new Uint8Array(cred.rawId);
  const { salt, iv, ciphertext } = await encryptToken(
    credentialIdBytes,
    session.refresh_token!,
  );

  save({
    credentialId: b64uEncode(credentialIdBytes),
    salt: b64uEncode(salt),
    iv: b64uEncode(iv),
    ciphertext: b64uEncode(ciphertext),
    userHandle: b64uEncode(userIdBytes),
    createdAt: Date.now(),
  });
}

/**
 * Re-encrypt the current session's refresh token against the existing
 * biometric credential. Call this after a fresh password sign-in so that the
 * already-enrolled credential keeps working without forcing the user to
 * re-enroll. No-op if quick unlock isn't enrolled or there's no session.
 */
export async function refreshQuickUnlockToken(): Promise<void> {
  const stored = load();
  if (!stored) return;
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.refresh_token) return;
  try {
    const credentialIdBytes = b64uDecode(stored.credentialId);
    const { salt, iv, ciphertext } = await encryptToken(
      credentialIdBytes,
      session.refresh_token,
    );
    save({
      ...stored,
      salt: b64uEncode(salt),
      iv: b64uEncode(iv),
      ciphertext: b64uEncode(ciphertext),
    });
  } catch {
    // Non-fatal — biometric unlock will fall back to password if decrypt fails.
  }
}

/**
 * Trigger biometric prompt and, on success, restore the Supabase session.
 * Returns true if the user is now signed in.
 */
export async function unlockWithBiometric(): Promise<boolean> {
  const stored = load();
  if (!stored) return false;

  const credentialIdBytes = b64uDecode(stored.credentialId);
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [
        { type: "public-key", id: toBuf(credentialIdBytes), transports: ["internal"] },
      ],
      userVerification: "required",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) return false;

  // Decrypt the stored refresh token using the credential id we just verified.
  let refreshToken: string;
  try {
    refreshToken = await decryptToken(
      credentialIdBytes,
      b64uDecode(stored.salt),
      b64uDecode(stored.iv),
      b64uDecode(stored.ciphertext),
    );
  } catch {
    // Token is no longer decryptable (corrupted) — drop the enrollment.
    clearQuickUnlock();
    throw new Error("Quick unlock data is corrupted. Please re-enroll.");
  }

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    // Refresh token is no longer valid (expired/rotated elsewhere). Clear.
    clearQuickUnlock();
    throw new Error("Your session expired. Please sign in with your password.");
  }

  // Rotate: re-encrypt the new refresh token so a stale snapshot can't be replayed.
  try {
    const { salt, iv, ciphertext } = await encryptToken(
      credentialIdBytes,
      data.session.refresh_token!,
    );
    save({
      ...stored,
      salt: b64uEncode(salt),
      iv: b64uEncode(iv),
      ciphertext: b64uEncode(ciphertext),
    });
  } catch {
    // Non-fatal: next unlock will still work with the previous token until rotated.
  }

  return true;
}
