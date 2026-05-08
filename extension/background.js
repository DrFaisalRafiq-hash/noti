// Background service worker.
// Registers context menus and saves selections directly to the user's Noti
// account using the session token persisted by the popup. If the user is
// signed out, the popup is opened with the captured text pre-filled instead.

const SUPABASE_URL = "https://nleciukeiaasjfdxgtmq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZWNpdWtlaWFhc2pmZHhndG1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzQ0MjksImV4cCI6MjA5MjkxMDQyOX0.cMvpiH1TBwVlCzNBSDfCdAN2NQtyclF1bX1hf7wzXOU";

const SESSION_KEY = "sb-nleciukeiaasjfdxgtmq-auth-token";
const DEVICE_KEY = "noti-ext-device-id";
const PENDING_KEY = "noti-pending-capture";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "noti-save-selection",
    title: 'Save "%s" to Noti',
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: "noti-save-page",
    title: "Save this page to Noti",
    contexts: ["page", "link"],
  });
});

async function getSession() {
  const stored = await chrome.storage.local.get([SESSION_KEY]);
  const raw = stored[SESSION_KEY];
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed?.access_token ? parsed : null;
  } catch {
    return null;
  }
}

async function getDeviceId() {
  const r = await chrome.storage.local.get([DEVICE_KEY]);
  if (r[DEVICE_KEY]) return r[DEVICE_KEY];
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [DEVICE_KEY]: id });
  return id;
}

async function refreshAccessToken(refresh_token) {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token }),
    },
  );
  if (!res.ok) return null;
  const next = await res.json();
  await chrome.storage.local.set({
    [SESSION_KEY]: JSON.stringify(next),
  });
  return next;
}

async function saveNote({ title, text, sourceUrl, sourceTitle }) {
  let session = await getSession();
  if (!session) return { ok: false, reason: "unauthenticated" };

  // If the access token is close to expiry, refresh it first.
  const expEpoch = session.expires_at ? session.expires_at * 1000 : 0;
  if (expEpoch && expEpoch - Date.now() < 60_000 && session.refresh_token) {
    const refreshed = await refreshAccessToken(session.refresh_token);
    if (refreshed) session = refreshed;
  }

  const dev = await getDeviceId();
  const payload = {
    device_id: dev,
    title: (title || "Untitled").slice(0, 200),
    text: text || "",
    mode: "note",
    tags: ["web-clip"],
  };

  const doInsert = async (token) =>
    fetch(`${SUPABASE_URL}/rest/v1/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

  let res = await doInsert(session.access_token);
  if (res.status === 401 && session.refresh_token) {
    const refreshed = await refreshAccessToken(session.refresh_token);
    if (refreshed) {
      session = refreshed;
      res = await doInsert(session.access_token);
    }
  }
  if (!res.ok) {
    const body = await res.text();
    console.error("Noti save failed", res.status, body);
    return { ok: false, reason: "request_failed", status: res.status };
  }
  const [row] = await res.json();
  // Best-effort: attach the source URL as a note_link
  if (sourceUrl && row?.id) {
    fetch(`${SUPABASE_URL}/rest/v1/note_links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        note_id: row.id,
        url: sourceUrl,
        title: sourceTitle || null,
      }),
    }).catch(() => {});
  }
  return { ok: true, note: row };
}

async function flashSuccessBadge() {
  await chrome.action.setBadgeText({ text: "✓" });
  await chrome.action.setBadgeBackgroundColor({ color: "#3a7a3a" });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000);
}

async function notify(title, message) {
  try {
    await chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
      title,
      message,
      priority: 0,
    });
  } catch (_) {
    /* notifications permission may not be granted */
  }
}

async function openPopupWithCapture(text) {
  await chrome.storage.local.set({ [PENDING_KEY]: text });
  if (chrome.action?.openPopup) {
    try {
      await chrome.action.openPopup();
      return;
    } catch (_) {}
  }
  await chrome.action.setBadgeText({ text: "1" });
  await chrome.action.setBadgeBackgroundColor({ color: "#3a3a32" });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const sourceUrl = tab?.url ?? "";
  const sourceTitle = tab?.title ?? "";
  let title = "";
  let text = "";

  if (info.menuItemId === "noti-save-selection" && info.selectionText) {
    const sel = info.selectionText.trim();
    title = sel.split(/[.\n]/)[0]?.trim().slice(0, 120) || sel.slice(0, 120);
    const remainder =
      sel.length > title.length ? sel.slice(title.length).trim() : "";
    text = remainder ? `${remainder}\n\n${sourceUrl}` : sourceUrl;
  } else if (info.menuItemId === "noti-save-page") {
    title = sourceTitle.slice(0, 200) || "Untitled page";
    text = sourceUrl;
  } else {
    return;
  }

  const result = await saveNote({ title, text, sourceUrl, sourceTitle });

  if (result.ok) {
    await flashSuccessBadge();
    await notify(
      "Saved to Noti",
      title.length > 80 ? title.slice(0, 80) + "…" : title,
    );
  } else if (result.reason === "unauthenticated") {
    const fallback = `${title}${text ? "\n\n" + text : ""}`.trim();
    await openPopupWithCapture(fallback);
    await notify("Sign in to Noti", "Open the Noti popup to finish saving.");
  } else {
    await notify("Couldn't save to Noti", "Please try again from the popup.");
    const fallback = `${title}${text ? "\n\n" + text : ""}`.trim();
    await chrome.storage.local.set({ [PENDING_KEY]: fallback });
  }
});

// Clear the badge whenever the popup connects.
chrome.runtime.onConnect.addListener(() => {
  chrome.action.setBadgeText({ text: "" });
});
