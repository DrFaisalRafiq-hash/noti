/**
 * Read-only script sharing.
 *
 * Encodes the entire script payload into the URL hash so anyone with the
 * link can view it without an account, and without a server round-trip.
 * No DB writes — the script lives in the link itself.
 *
 * Format: `#s=v1.<base64url-of-utf8-json>` (plaintext payload)
 *         `#s=v1.<base64url-of-utf8-json>` where payload has `enc` (encrypted body)
 *
 * The hash (rather than the path/query) is used so the payload never hits
 * any server logs and is unaffected by SPA routing.
 *
 * Password protection: when a passphrase is supplied, the serialized
 * script body is encrypted with AES-GCM using a key derived from the
 * passphrase via PBKDF2 (SHA-256, 200k iterations). The salt + IV are
 * embedded in the link so any browser can decrypt given the right
 * passphrase. Title, expiry, and an optional hint stay in the clear so
 * the viewer can show useful context before unlocking.
 */

import { serializeScript, parseScript, type PodcastScript } from "./podcast-script";

const PREFIX_V1 = "v1.";
const PREFIX_V2 = "v2.";
const PBKDF2_ITERATIONS = 200_000;

/** Compress a UTF-8 string with gzip via the Compression Streams API.
 *  Falls back to raw bytes (no compression) when unavailable. */
async function gzipString(input: string): Promise<{ bytes: Uint8Array; compressed: boolean }> {
  const raw = new TextEncoder().encode(input);
  const CS = (globalThis as any).CompressionStream;
  if (typeof CS !== "function") return { bytes: raw, compressed: false };
  try {
    const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new CS("gzip"));
    const buf = new Uint8Array(await new Response(stream).arrayBuffer());
    // Only adopt compression when it actually wins (small payloads can grow).
    return buf.byteLength < raw.byteLength
      ? { bytes: buf, compressed: true }
      : { bytes: raw, compressed: false };
  } catch {
    return { bytes: raw, compressed: false };
  }
}

async function gunzipBytes(bytes: Uint8Array): Promise<string> {
  const DS = (globalThis as any).DecompressionStream;
  if (typeof DS !== "function") throw new Error("DecompressionStream unavailable");
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DS("gzip"));
  return new Response(stream).text();
}

/** UTF-8 safe base64url encoding (no padding, URL-safe alphabet). */
function b64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return b64urlEncodeBytes(bytes);
}

function b64urlEncodeBytes(bytes: Uint8Array): string {
  let bin = "";
  // Chunk to avoid blowing the call stack on big payloads.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  return new TextDecoder().decode(b64urlDecodeBytes(s));
}

function b64urlDecodeBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Encrypted body envelope embedded in `SharePayload.enc`. */
export interface EncryptedBody {
  /** Algorithm identifier — locked to AES-GCM 256 / PBKDF2 SHA-256 for now. */
  alg: "AES-GCM-256/PBKDF2-SHA256";
  /** PBKDF2 iteration count. */
  it: number;
  /** Base64url-encoded random salt (16 bytes). */
  s: string;
  /** Base64url-encoded random IV (12 bytes). */
  iv: string;
  /** Base64url-encoded ciphertext (script body). */
  ct: string;
  /** Optional plaintext hint to display on the unlock screen. */
  hint?: string;
}

export interface SharePayload {
  /** Display title for the share view. */
  title?: string;
  /** Serialized script body (same format used in the notes table). Absent
   *  when the body is encrypted — see `enc` instead. */
  body?: string;
  /** Encrypted body envelope. Present iff the link is password-protected. */
  enc?: EncryptedBody;
  /** Optional epoch ms after which the link should be treated as expired
   *  by the viewer. The viewer always enforces this client-side; older
   *  links without `exp` never expire. */
  exp?: number;
  /** Epoch ms when the link was generated — purely informational, used to
   *  show "shared X ago" / "expired Y ago" copy. */
  iat?: number;
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase) as BufferSource,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptBody(plain: string, passphrase: string, hint?: string): Promise<EncryptedBody> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const ctBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plain) as BufferSource
  );
  return {
    alg: "AES-GCM-256/PBKDF2-SHA256",
    it: PBKDF2_ITERATIONS,
    s: b64urlEncodeBytes(salt),
    iv: b64urlEncodeBytes(iv),
    ct: b64urlEncodeBytes(new Uint8Array(ctBuf)),
    hint: hint?.trim() || undefined,
  };
}

/** Decrypt a previously encrypted body. Returns null when the passphrase
 *  is wrong or the envelope is corrupt. */
export async function decryptBody(enc: EncryptedBody, passphrase: string): Promise<string | null> {
  try {
    const salt = b64urlDecodeBytes(enc.s);
    const iv = b64urlDecodeBytes(enc.iv);
    const ct = b64urlDecodeBytes(enc.ct);
    const key = await deriveKey(passphrase, salt, enc.it || PBKDF2_ITERATIONS);
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ct as BufferSource
    );
    const plainBytes = new Uint8Array(plainBuf);
    // v2 envelopes set `gz=1` to indicate the plaintext was gzipped before
    // encryption. Older v1 envelopes never compress.
    if ((enc as any).gz) {
      try { return await gunzipBytes(plainBytes); } catch { return null; }
    }
    return new TextDecoder().decode(plainBytes);
  } catch {
    return null;
  }
}

export interface BuildShareOptions {
  title?: string;
  /** Optional epoch-ms expiration time. */
  expiresAt?: number | null;
  /** When set, encrypt the body with this passphrase. */
  passphrase?: string;
  /** Optional plaintext hint shown on the unlock screen. */
  hint?: string;
}

/** Build a public read-only URL for the given script.
 *
 *  Backwards-compatible signature: legacy callers can still pass
 *  `(script, title, expiresAt)`. New callers should pass an options object
 *  to opt into password protection. */
export async function buildShareUrl(
  script: PodcastScript,
  titleOrOpts?: string | BuildShareOptions,
  expiresAt?: number | null
): Promise<string> {
  const opts: BuildShareOptions =
    typeof titleOrOpts === "object" && titleOrOpts !== null
      ? titleOrOpts
      : { title: typeof titleOrOpts === "string" ? titleOrOpts : undefined, expiresAt };

  const title = (opts.title || script.brief.topic || "").trim() || undefined;
  const exp = opts.expiresAt && Number.isFinite(opts.expiresAt)
    ? Math.floor(opts.expiresAt as number)
    : undefined;
  const serialized = serializeScript(script);

  // v2 wire format: single-letter keys + gzip-compressed body bytes encoded
  // as base64url. Compressing the *plaintext* before encryption gives the
  // biggest win since ciphertext is incompressible.
  const v2: Record<string, unknown> = {};
  if (title) v2.t = title;
  v2.i = Date.now();
  if (exp) v2.x = exp;

  if (opts.passphrase && opts.passphrase.length > 0) {
    const { bytes: plainBytes } = await gzipString(serialized);
    const enc = await encryptBytes(plainBytes, opts.passphrase, opts.hint);
    v2.e = enc;
  } else {
    const { bytes, compressed } = await gzipString(serialized);
    v2.b = b64urlEncodeBytes(bytes);
    if (compressed) v2.z = 1; // gzip flag
  }

  const encoded = b64urlEncode(JSON.stringify(v2));
  const base = `${window.location.origin}/script/share`;
  return `${base}#s=${PREFIX_V2}${encoded}`;
}

/** AES-GCM encrypt raw bytes (typically gzip-compressed plaintext). */
async function encryptBytes(plain: Uint8Array, passphrase: string, hint?: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const ctBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    plain as BufferSource
  );
  return {
    s: b64urlEncodeBytes(salt),
    v: b64urlEncodeBytes(iv),
    c: b64urlEncodeBytes(new Uint8Array(ctBuf)),
    n: PBKDF2_ITERATIONS,
    z: 1, // payload was gzipped before encryption
    ...(hint?.trim() ? { h: hint.trim() } : {}),
  } as Record<string, unknown>;
}

/** Result of decoding a share link. For encrypted links `script` is null
 *  until the viewer unlocks it; the `payload.enc` envelope can be passed
 *  to {@link decryptBody} along with the user-supplied passphrase. */
export interface DecodedShare {
  payload: SharePayload;
  /** Parsed script — present for plaintext links, null until decrypted. */
  script: PodcastScript | null;
  /** Whether the link is password-protected. */
  encrypted: boolean;
}

/** Normalize a v2 short-key envelope into the canonical `SharePayload` shape. */
function normalizeV2(raw: any): SharePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const out: SharePayload = {};
  if (typeof raw.t === "string") out.title = raw.t;
  if (typeof raw.i === "number") out.iat = raw.i;
  if (typeof raw.x === "number") out.exp = raw.x;
  if (raw.e && typeof raw.e === "object") {
    const e = raw.e;
    out.enc = {
      alg: "AES-GCM-256/PBKDF2-SHA256",
      it: typeof e.n === "number" ? e.n : PBKDF2_ITERATIONS,
      s: String(e.s),
      iv: String(e.v),
      ct: String(e.c),
      hint: typeof e.h === "string" ? e.h : undefined,
      // @ts-expect-error — extra runtime hint that body was gzipped pre-encryption
      gz: e.z === 1,
    };
  } else if (typeof raw.b === "string") {
    if (raw.z === 1) {
      // Decompress gzip body bytes back into the serialized script string.
      try {
        const bytes = b64urlDecodeBytes(raw.b);
        // gunzip is async — we can't here, so stash the bytes for the caller.
        (out as any)._bodyBytes = bytes;
      } catch {
        return null;
      }
    } else {
      out.body = b64urlDecode(raw.b);
    }
  }
  return out;
}

/** Read the share payload from `window.location.hash`, or null if missing/invalid. */
export function readShareFromHash(hash: string): DecodedShare | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const m = raw.match(/(?:^|&)s=([^&]+)/);
  if (!m) return null;
  let token = m[1];
  let version: "v1" | "v2" = "v1";
  if (token.startsWith(PREFIX_V2)) {
    token = token.slice(PREFIX_V2.length);
    version = "v2";
  } else if (token.startsWith(PREFIX_V1)) {
    token = token.slice(PREFIX_V1.length);
    version = "v1";
  }
  try {
    const json = b64urlDecode(token);
    const rawPayload = JSON.parse(json);
    if (!rawPayload) return null;

    const payload: SharePayload | null =
      version === "v2" ? normalizeV2(rawPayload) : (rawPayload as SharePayload);
    if (!payload) return null;

    if (payload.enc && typeof payload.enc === "object") {
      return { payload, script: null, encrypted: true };
    }

    // v2 plaintext + gzip: synchronously inflate using the stashed bytes.
    if (!payload.body && (payload as any)._bodyBytes) {
      // Defer parsing — ScriptShare consumes `payload.body` synchronously, so
      // we need to inflate here. We can't await, so use a sync fallback flag.
      // Most browsers support DecompressionStream; if not, the link won't open.
      // We expose `_pendingBody` so the page can resolve it post-mount.
      (payload as any)._pendingBody = inflateBodyBytes((payload as any)._bodyBytes);
      return { payload, script: null, encrypted: false };
    }

    if (typeof payload.body !== "string") return null;
    const script = parseScript(payload.body);
    if (!script) return null;
    return { payload, script, encrypted: false };
  } catch {
    return null;
  }
}

/** Async-inflate gzip bytes into a serialized script string + parsed script. */
export async function inflateBodyBytes(bytes: Uint8Array): Promise<{ body: string; script: PodcastScript | null }> {
  const body = await gunzipBytes(bytes);
  return { body, script: parseScript(body) };
}

/** Async helper used by the viewer to finalize a v2 gzip-plaintext share. */
export async function resolvePendingBody(decoded: DecodedShare): Promise<DecodedShare> {
  const pending = (decoded.payload as any)._pendingBody as
    | Promise<{ body: string; script: PodcastScript | null }>
    | undefined;
  if (!pending) return decoded;
  const { body, script } = await pending;
  decoded.payload.body = body;
  decoded.script = script;
  delete (decoded.payload as any)._pendingBody;
  delete (decoded.payload as any)._bodyBytes;
  return decoded;
}
