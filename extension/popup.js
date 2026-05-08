// Noti Chrome extension popup — talks to Lovable Cloud (Supabase)
// using the same `notes` table as the web app.

const SUPABASE_URL = "https://nleciukeiaasjfdxgtmq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZWNpdWtlaWFhc2pmZHhndG1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzQ0MjksImV4cCI6MjA5MjkxMDQyOX0.cMvpiH1TBwVlCzNBSDfCdAN2NQtyclF1bX1hf7wzXOU";

// chrome.storage-backed adapter so the SDK persists session tokens between
// popup opens (popup state is destroyed every time it closes).
const chromeStorageAdapter = {
  getItem: (key) =>
    new Promise((resolve) =>
      chrome.storage.local.get([key], (r) => resolve(r[key] ?? null))
    ),
  setItem: (key, value) =>
    new Promise((resolve) =>
      chrome.storage.local.set({ [key]: value }, () => resolve())
    ),
  removeItem: (key) =>
    new Promise((resolve) =>
      chrome.storage.local.remove([key], () => resolve())
    ),
};

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: chromeStorageAdapter,
    storageKey: "sb-nleciukeiaasjfdxgtmq-auth-token",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// ── Persistent device id (matches the web app's model) ──
async function getDeviceId() {
  const { "noti-ext-device-id": existing } = await chrome.storage.local.get([
    "noti-ext-device-id",
  ]);
  if (existing) return existing;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ "noti-ext-device-id": id });
  return id;
}

// ── Views ──
const views = {
  loading: document.getElementById("view-loading"),
  auth: document.getElementById("view-auth"),
  app: document.getElementById("view-app"),
};
function show(name) {
  for (const [k, el] of Object.entries(views)) {
    el.classList.toggle("hidden", k !== name);
  }
}

// ── Auth flow ──
let signupMode = false;
const authForm = document.getElementById("auth-form");
const toggleBtn = document.getElementById("toggle-mode");
const authError = document.getElementById("auth-error");

toggleBtn.addEventListener("click", () => {
  signupMode = !signupMode;
  const submit = authForm.querySelector("button.primary");
  submit.textContent = signupMode ? "Create account" : "Sign in";
  toggleBtn.textContent = signupMode ? "I have an account" : "Create account";
  authError.textContent = "";
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  const fd = new FormData(authForm);
  const email = fd.get("email");
  const password = fd.get("password");
  const submit = authForm.querySelector("button.primary");
  submit.disabled = true;
  try {
    const { error } = signupMode
      ? await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: "https://noti-time.com/app" },
        })
      : await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      authError.textContent = error.message;
    } else if (signupMode) {
      authError.textContent = "Check your email to confirm your account.";
    }
  } catch (err) {
    authError.textContent = err?.message || "Something went wrong";
  } finally {
    submit.disabled = false;
  }
});

document.getElementById("signout").addEventListener("click", async () => {
  await supabase.auth.signOut();
});

document.getElementById("open-web").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://noti-time.com/app" });
});

// ── Notes ──
let notes = [];
let activeFilter = "all";
let searchQuery = "";

const listEl = document.getElementById("notes-list");
const emptyEl = document.getElementById("empty");
const searchEl = document.getElementById("search");

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.dataset.filter;
    render();
  });
});

searchEl.addEventListener("input", () => {
  searchQuery = searchEl.value.trim().toLowerCase();
  render();
});

async function loadNotes() {
  const dev = await getDeviceId();
  const { data, error } = await supabase
    .from("notes")
    .select("id, title, text, mode, done, remind_at, created_at, archived, deleted_at")
    .eq("device_id", dev)
    .is("deleted_at", null)
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("load notes failed", error);
    return;
  }
  notes = data ?? [];
  render();
}

function render() {
  const filtered = notes.filter((n) => {
    if (activeFilter !== "all" && n.mode !== activeFilter) return false;
    if (searchQuery) {
      const hay = `${n.title ?? ""} ${n.text ?? ""}`.toLowerCase();
      if (!hay.includes(searchQuery)) return false;
    }
    return true;
  });

  listEl.innerHTML = "";
  if (filtered.length === 0) {
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  for (const n of filtered) {
    const item = document.createElement("div");
    item.className = "note-item";

    const isCheckable = n.mode === "task" || n.mode === "reminder";
    if (isCheckable) {
      const cb = document.createElement("button");
      cb.className = "note-checkbox" + (n.done ? " checked" : "");
      cb.setAttribute("aria-label", n.done ? "Mark not done" : "Mark done");
      cb.innerHTML = n.done
        ? '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        : "";
      cb.addEventListener("click", async () => {
        await supabase.from("notes").update({ done: !n.done }).eq("id", n.id);
        n.done = !n.done;
        render();
      });
      item.appendChild(cb);
    } else {
      const spacer = document.createElement("span");
      spacer.style.width = "0";
      item.appendChild(spacer);
    }

    const body = document.createElement("div");
    body.className = "note-body";
    const titleEl = document.createElement("p");
    titleEl.className = "note-title" + (n.done ? " done" : "");
    titleEl.textContent = n.title || n.text || "Untitled";
    body.appendChild(titleEl);

    const meta = document.createElement("div");
    meta.className = "note-meta";
    const mode = document.createElement("span");
    mode.className = "note-mode";
    mode.textContent = n.mode;
    meta.appendChild(mode);
    if (n.remind_at) {
      const when = document.createElement("span");
      when.textContent = formatWhen(n.remind_at);
      meta.appendChild(when);
    } else {
      const when = document.createElement("span");
      when.textContent = relativeTime(n.created_at);
      meta.appendChild(when);
    }
    body.appendChild(meta);
    item.appendChild(body);

    const del = document.createElement("button");
    del.className = "note-delete";
    del.setAttribute("aria-label", "Delete note");
    del.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
    del.addEventListener("click", async () => {
      await supabase
        .from("notes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", n.id);
      notes = notes.filter((x) => x.id !== n.id);
      render();
    });
    item.appendChild(del);

    listEl.appendChild(item);
  }
}

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function formatWhen(iso) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  );
}

// ── Quick add ──
const quickForm = document.getElementById("quick-add");
quickForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = document.getElementById("quick-text").value.trim();
  if (!text) return;
  const mode = document.getElementById("mode-select").value;
  const remindRaw = document.getElementById("remind-at").value;
  const remind_at = remindRaw ? new Date(remindRaw).toISOString() : null;
  const dev = await getDeviceId();
  const title = text.split("\n")[0].slice(0, 120);
  const body = text.length > title.length ? text.slice(title.length).trimStart() : "";
  const submit = quickForm.querySelector("button.primary");
  submit.disabled = true;
  const { data, error } = await supabase
    .from("notes")
    .insert({
      device_id: dev,
      title,
      text: body,
      mode,
      remind_at,
    })
    .select()
    .single();
  submit.disabled = false;
  if (error) {
    alert(error.message);
    return;
  }
  document.getElementById("quick-text").value = "";
  document.getElementById("remind-at").value = "";
  notes.unshift(data);
  render();
});

// ── Bootstrap ──
async function bootstrap() {
  show("loading");
  // Receive any "captured selection" payload from the background context menu
  const { "noti-pending-capture": pending } = await chrome.storage.local.get([
    "noti-pending-capture",
  ]);
  if (pending) {
    await chrome.storage.local.remove(["noti-pending-capture"]);
  }

  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    show("auth");
    return;
  }
  show("app");
  if (pending) {
    document.getElementById("quick-text").value = pending;
  }
  await loadNotes();
}

supabase.auth.onAuthStateChange(async (_event, session) => {
  if (session) {
    show("app");
    await loadNotes();
  } else {
    notes = [];
    show("auth");
  }
});

bootstrap();
