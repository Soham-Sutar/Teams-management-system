/* =============================================
   MentorBoard  —  app.js
   Multi-faculty + All Features Edition

   FEATURES:
   · Multi-faculty signup / login (Firebase Auth)
   · Per-user isolated Firestore data
   · Student contact numbers
   · Phase reports
   · Marks allocation (Final Submission only)
   · Configurable total marks
   · Contact developer modal
   · Mobile bottom nav + responsive UI

   FIREBASE SETUP:
   1. https://console.firebase.google.com
   2. Create project → Add Web App → copy config
   3. Enable Authentication → Email/Password
   4. Enable Firestore Database
   5. Paste config into FIREBASE_CONFIG below

   FIRESTORE SECURITY RULES (paste in console):
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null
           && request.auth.uid == userId;
       }
     }
   }

   DATA MODEL:
     users/{uid}/profile/info      → { name, email }
     users/{uid}/teams/{teamId}    → team object
     users/{uid}/deadlines/{idx}   → { date }
     users/{uid}/settings/marks    → { totalMarks }
   ============================================= */

// ─────────────────────────────────────────────
//  FIREBASE CONFIG  ← replace with yours
// ─────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAS5iAgf-YZS6g5mN6xNPbJoNohYwjDLKI",
  authDomain: "teams-management-system-new.firebaseapp.com",
  projectId: "teams-management-system-new",
  storageBucket: "teams-management-system-new.firebasestorage.app",
  messagingSenderId: "1097203076635",
  appId: "1:1097203076635:web:2153ab1d0b0454971532be",
  measurementId: "G-B2SGJ1F3BD"
};

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────
const PHASES = [
  "Idea Submission",
  "Proposal Approval",
  "Phase 1",
  "Phase 2",
  "Phase 3",
  "Final Submission"
];

const DEMO = { email: "demo@mentorboard.app", password: "demo1234" };

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
let S = {
  loggedIn:        false,
  currentUser:     null,   // { uid, email, name }
  teams:           [],
  deadlines:       {},     // { "0": "YYYY-MM-DD", ... }
  totalMarks:      100,    // configurable per faculty
  useFirebase:     false,
  fb:              null,
  db:              null,
  auth:            null,
  fbUnsubTeams:    null,
  fbUnsubDeadlines:null,
  fbUnsubSettings: null,
  currentPage:     "dashboard",
  pendingDeleteId: null,
};

let calYear, calMonth;

// ─────────────────────────────────────────────
//  FIREBASE INIT
// ─────────────────────────────────────────────
async function initFirebase() {
  if (FIREBASE_CONFIG.apiKey === "YOUR_API_KEY") {
    console.info("MentorBoard: Firebase not configured → demo mode");
    return false;
  }
  try {
    const { initializeApp } =
      await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const {
      getAuth, createUserWithEmailAndPassword,
      signInWithEmailAndPassword, signOut, onAuthStateChanged,
      updateProfile
    } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    const {
      getFirestore, collection, doc,
      getDocs, setDoc, deleteDoc, getDoc, onSnapshot
    } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

    const app  = initializeApp(FIREBASE_CONFIG);
    S.auth = getAuth(app);
    S.db   = getFirestore(app);
    S.fb   = {
      createUserWithEmailAndPassword, signInWithEmailAndPassword,
      signOut, onAuthStateChanged, updateProfile,
      collection, doc, getDocs, setDoc, deleteDoc, getDoc, onSnapshot
    };
    S.useFirebase = true;
    console.info("MentorBoard: Firebase ready");
    return true;
  } catch (e) {
    console.warn("MentorBoard: Firebase init failed →", e.message);
    return false;
  }
}

// ─────────────────────────────────────────────
//  AUTH — TAB SWITCH
// ─────────────────────────────────────────────
function switchTab(tab) {
  id("tab-login").classList.toggle("active",   tab === "login");
  id("tab-signup").classList.toggle("active",  tab === "signup");
  id("form-login").classList.toggle("hidden",  tab !== "login");
  id("form-signup").classList.toggle("hidden", tab !== "signup");
  id("login-error").classList.add("hidden");
  id("signup-error").classList.add("hidden");
}

// ─────────────────────────────────────────────
//  SIGN UP
// ─────────────────────────────────────────────
async function handleSignup() {
  const name     = id("signup-name").value.trim();
  const email    = id("signup-email").value.trim();
  const password = id("signup-password").value;
  const confirm  = id("signup-confirm").value;
  const errEl    = id("signup-error");
  errEl.classList.add("hidden");

  if (!name)               return showErr(errEl, "Please enter your name.");
  if (!email)              return showErr(errEl, "Please enter your email.");
  if (password.length < 6) return showErr(errEl, "Password must be at least 6 characters.");
  if (password !== confirm) return showErr(errEl, "Passwords do not match.");

  setBtnLoading("signup-btn", true);

  if (S.useFirebase) {
    try {
      const cred = await S.fb.createUserWithEmailAndPassword(S.auth, email, password);
      await S.fb.updateProfile(cred.user, { displayName: name });
      await S.fb.setDoc(
        S.fb.doc(S.db, "users", cred.user.uid, "profile", "info"),
        { name, email }
      );
      S.currentUser = { uid: cred.user.uid, email, name };
      S.loggedIn    = true;
      S.teams       = [];
      S.deadlines   = {};
      S.totalMarks  = 100;
      persistLocalSession();
      setBtnLoading("signup-btn", false);
      showToast(`Welcome, ${name}! 🎉`, "success");
      showApp();
    } catch (e) {
      setBtnLoading("signup-btn", false);
      showErr(errEl, firebaseErrMsg(e.code));
    }
    return;
  }

  // Demo/local mode
  const existingAccounts = JSON.parse(localStorage.getItem("mb_accounts") || "{}");
  if (existingAccounts[email]) {
    setBtnLoading("signup-btn", false);
    return showErr(errEl, "An account with this email already exists.");
  }
  existingAccounts[email] = { name, password };
  localStorage.setItem("mb_accounts", JSON.stringify(existingAccounts));

  const newUid = "local_" + Date.now().toString(36);
  S.currentUser = { uid: newUid, email, name };
  S.loggedIn    = true;
  S.teams       = [];
  S.deadlines   = {};
  S.totalMarks  = 100;
  persistLocalSession();
  setBtnLoading("signup-btn", false);
  showToast(`Welcome, ${name}! 🎉`, "success");
  showApp();
}

// ─────────────────────────────────────────────
//  LOGIN
// ─────────────────────────────────────────────
async function handleLogin() {
  const email    = id("login-email").value.trim();
  const password = id("login-password").value;
  const errEl    = id("login-error");
  errEl.classList.add("hidden");

  if (!email || !password) return showErr(errEl, "Please enter email and password.");

  setBtnLoading("login-btn", true);

  if (S.useFirebase) {
    try {
      const cred = await S.fb.signInWithEmailAndPassword(S.auth, email, password);
      const uid  = cred.user.uid;
      let name   = cred.user.displayName || email.split("@")[0];
      try {
        const snap = await S.fb.getDoc(S.fb.doc(S.db, "users", uid, "profile", "info"));
        if (snap.exists()) name = snap.data().name || name;
      } catch (_) {}
      S.currentUser = { uid, email, name };
      S.loggedIn    = true;
      persistLocalSession();
      await loadFirebaseData();
      setBtnLoading("login-btn", false);
      showApp();
    } catch (e) {
      setBtnLoading("login-btn", false);
      showErr(errEl, firebaseErrMsg(e.code));
    }
    return;
  }

  // Demo account
  if (email === DEMO.email && password === DEMO.password) {
    S.currentUser = { uid: "demo_uid", email, name: "Demo Faculty" };
    S.loggedIn    = true;
    persistLocalSession();
    loadLocalData();
    setBtnLoading("login-btn", false);
    showApp();
    return;
  }
  // Local accounts
  const accounts = JSON.parse(localStorage.getItem("mb_accounts") || "{}");
  if (accounts[email] && accounts[email].password === password) {
    const localUid = "local_" + btoa(email).replace(/[^a-z0-9]/gi, "").slice(0, 12);
    S.currentUser  = { uid: localUid, email, name: accounts[email].name };
    S.loggedIn     = true;
    persistLocalSession();
    loadLocalData();
    setBtnLoading("login-btn", false);
    showApp();
    return;
  }
  setBtnLoading("login-btn", false);
  showErr(errEl, "Invalid email or password. Please try again.");
}

// ─────────────────────────────────────────────
//  LOGOUT
// ─────────────────────────────────────────────
async function handleLogout() {
  if (S.useFirebase && S.auth) await S.fb.signOut(S.auth).catch(() => {});
  detachFirebaseListeners();
  S.loggedIn    = false;
  S.currentUser = null;
  S.teams       = [];
  S.deadlines   = {};
  S.totalMarks  = 100;
  localStorage.removeItem("mb_session");
  id("app").classList.remove("active");
  id("auth-page").classList.add("active");
  id("login-email").value    = "";
  id("login-password").value = "";
  switchTab("login");
}

// ─────────────────────────────────────────────
//  FIREBASE DATA — per-user isolated paths
// ─────────────────────────────────────────────
function userPath(sub)       { return ["users", S.currentUser.uid, sub]; }
function userTeamsPath()     { return userPath("teams"); }
function userDeadlinesPath() { return userPath("deadlines"); }
function userSettingsPath()  { return userPath("settings"); }

async function loadFirebaseData() {
  if (!S.useFirebase || !S.db) return;
  showLoading(true);
  try {
    const { collection, getDocs, getDoc, doc } = S.fb;

    // Teams
    const teamsSnap = await getDocs(collection(S.db, ...userTeamsPath()));
    S.teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Deadlines
    const dlSnap = await getDocs(collection(S.db, ...userDeadlinesPath()));
    S.deadlines = {};
    dlSnap.docs.forEach(d => { S.deadlines[d.id] = d.data().date; });

    // Settings (totalMarks)
    try {
      const settSnap = await getDoc(doc(S.db, ...userSettingsPath(), "marks"));
      if (settSnap.exists() && settSnap.data().totalMarks) {
        S.totalMarks = settSnap.data().totalMarks;
      }
    } catch (_) {}

  } catch (e) {
    console.warn("loadFirebaseData error:", e);
  }
  showLoading(false);
}

async function fbSaveTeam(team) {
  if (!S.useFirebase || !S.db) return;
  await S.fb.setDoc(S.fb.doc(S.db, ...userTeamsPath(), team.id), team);
}

async function fbDeleteTeam(teamId) {
  if (!S.useFirebase || !S.db) return;
  await S.fb.deleteDoc(S.fb.doc(S.db, ...userTeamsPath(), teamId));
}

async function fbSaveDeadline(idx, date) {
  if (!S.useFirebase || !S.db) return;
  await S.fb.setDoc(S.fb.doc(S.db, ...userDeadlinesPath(), String(idx)), { date });
}

async function fbDeleteDeadline(idx) {
  if (!S.useFirebase || !S.db) return;
  await S.fb.deleteDoc(S.fb.doc(S.db, ...userDeadlinesPath(), String(idx))).catch(() => {});
}

async function fbSaveTotalMarks(total) {
  if (!S.useFirebase || !S.db) return;
  await S.fb.setDoc(S.fb.doc(S.db, ...userSettingsPath(), "marks"), { totalMarks: total });
}

function detachFirebaseListeners() {
  if (S.fbUnsubTeams)     { S.fbUnsubTeams();     S.fbUnsubTeams     = null; }
  if (S.fbUnsubDeadlines) { S.fbUnsubDeadlines(); S.fbUnsubDeadlines = null; }
  if (S.fbUnsubSettings)  { S.fbUnsubSettings();  S.fbUnsubSettings  = null; }
}

function refreshCurrentPage() {
  switch (S.currentPage) {
    case "dashboard": renderDashboard(); break;
    case "teams":     renderTeams();     break;
    case "deadlines": renderDeadlines(); break;
    case "calendar":  renderCalendar();  break;
  }
}

function attachFirebaseRealtimeListeners() {
  if (!S.useFirebase || !S.db) return;
  detachFirebaseListeners();
  const { collection, doc, onSnapshot } = S.fb;

  S.fbUnsubTeams = onSnapshot(
    collection(S.db, ...userTeamsPath()),
    snap => {
      S.teams = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      refreshCurrentPage();
    },
    e => console.warn("Firebase teams listener error:", e)
  );

  S.fbUnsubDeadlines = onSnapshot(
    collection(S.db, ...userDeadlinesPath()),
    snap => {
      S.deadlines = {};
      snap.docs.forEach(d => { S.deadlines[d.id] = d.data().date; });
      refreshCurrentPage();
    },
    e => console.warn("Firebase deadlines listener error:", e)
  );

  S.fbUnsubSettings = onSnapshot(
    doc(S.db, ...userSettingsPath(), "marks"),
    snap => {
      if (snap.exists() && snap.data()?.totalMarks) {
        S.totalMarks = snap.data().totalMarks;
      } else {
        S.totalMarks = 100;
      }
      refreshCurrentPage();
    },
    e => console.warn("Firebase settings listener error:", e)
  );
}

// ─────────────────────────────────────────────
//  LOCAL DATA  (keyed by uid for isolation)
// ─────────────────────────────────────────────
function localKey(suffix) { return `mb_${S.currentUser?.uid || "anon"}_${suffix}`; }

function loadLocalData() {
  try {
    S.teams      = JSON.parse(localStorage.getItem(localKey("teams"))      || "[]");
    S.deadlines  = JSON.parse(localStorage.getItem(localKey("deadlines"))  || "{}");
    S.totalMarks = parseInt(localStorage.getItem(localKey("totalMarks"))) || 100;
  } catch (_) {}
}

function saveLocalData() {
  if (!S.currentUser) return;
  localStorage.setItem(localKey("teams"),      JSON.stringify(S.teams));
  localStorage.setItem(localKey("deadlines"),  JSON.stringify(S.deadlines));
  localStorage.setItem(localKey("totalMarks"), String(S.totalMarks));
}

function persistLocalSession() {
  localStorage.setItem("mb_session", JSON.stringify(S.currentUser));
}

// ─────────────────────────────────────────────
//  SHOW APP
// ─────────────────────────────────────────────
function showApp() {
  id("auth-page").classList.remove("active");
  id("app").classList.add("active");
  const name  = S.currentUser?.name  || "Faculty";
  const email = S.currentUser?.email || "";
  id("sidebar-avatar").textContent = name.charAt(0).toUpperCase();
  id("sidebar-name").textContent   = name;
  id("sidebar-email").textContent  = email;
  if (S.useFirebase) attachFirebaseRealtimeListeners();
  navigate("dashboard", document.querySelector('[data-page="dashboard"]'));
}

// ─────────────────────────────────────────────
//  NAVIGATION
// ─────────────────────────────────────────────
function navigate(page, el) {
  if (el && el.classList.contains("nav-item")) {
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    el.classList.add("active");
  }
  document.querySelectorAll(".bnav-item").forEach(b => {
    b.classList.toggle("active", b.dataset.page === page);
  });
  document.querySelectorAll(".content-page").forEach(p => p.classList.remove("active"));
  id(`page-${page}`)?.classList.add("active");
  S.currentPage = page;

  const TITLES = { dashboard: "Dashboard", teams: "Teams", deadlines: "Deadlines", calendar: "Calendar" };
  id("page-title").textContent = TITLES[page] || page;

  if (window.innerWidth <= 768) closeSidebar();

  switch (page) {
    case "dashboard": renderDashboard(); break;
    case "teams":     renderTeams();     break;
    case "deadlines": renderDeadlines(); break;
    case "calendar":  renderCalendar();  break;
  }
}

function bnavNavigate(page, el) { navigate(page, null); }

function openSidebar() {
  id("sidebar").classList.add("open");
  id("sidebar-overlay").classList.add("show");
  document.body.classList.add("sidebar-open");
}
function closeSidebar() {
  id("sidebar").classList.remove("open");
  id("sidebar-overlay").classList.remove("show");
  document.body.classList.remove("sidebar-open");
}

function toggleTheme() {
  const html   = document.documentElement;
  const isDark = html.getAttribute("data-theme") === "dark";
  html.setAttribute("data-theme", isDark ? "light" : "dark");
  id("theme-icon").textContent = isDark ? "🌙" : "☀";
  localStorage.setItem("mb_theme", isDark ? "light" : "dark");
}

function togglePassword(inputId) {
  const inp = id(inputId);
  inp.type  = inp.type === "password" ? "text" : "password";
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function id(s) { return document.getElementById(s); }

function esc(s) {
  return String(s || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

function todayStr() { return new Date().toISOString().split("T")[0]; }

function formatDate(str) {
  if (!str) return "—";
  const [y, m, d] = str.split("-");
  const mo = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d} ${mo[+m-1]} ${y}`;
}

function statusLabel(s) {
  if (s === "completed")   return "✓ Done";
  if (s === "in-progress") return "▶ Active";
  return "○ Pending";
}

function defaultPhases() {
  return PHASES.map((name, i) => ({ name, status: i === 0 ? "in-progress" : "pending", report: "" }));
}

function teamProgress(team) {
  const done = team.phases.filter(p => p.status === "completed").length;
  return { done, pct: Math.round(done / 6 * 100) };
}

function completedGlobalPhases() {
  if (!S.teams.length) return 0;
  let n = 0;
  for (let i = 0; i < 6; i++) {
    if (S.teams.every(t => t.phases[i]?.status === "completed")) n++;
  }
  return n;
}

function upcomingCount() {
  const today = todayStr();
  return Object.values(S.deadlines).filter(d => d >= today).length;
}

function showErr(el, msg) { el.textContent = msg; el.classList.remove("hidden"); }

function setBtnLoading(btnId, loading) {
  const btn = id(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn._orig = btn.innerHTML;
    btn.innerHTML = '<span style="opacity:.7">Please wait…</span>';
  } else {
    if (btn._orig) btn.innerHTML = btn._orig;
  }
}

function showLoading(on) { id("loading-overlay").classList.toggle("hidden", !on); }

function firebaseErrMsg(code) {
  const map = {
    "auth/email-already-in-use":   "This email is already registered. Please sign in.",
    "auth/invalid-email":          "Please enter a valid email address.",
    "auth/weak-password":          "Password must be at least 6 characters.",
    "auth/user-not-found":         "No account found with this email.",
    "auth/wrong-password":         "Incorrect password. Please try again.",
    "auth/invalid-credential":     "Invalid email or password.",
    "auth/too-many-requests":      "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Network error. Please check your connection.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

// ─────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────
function renderDashboard() {
  id("stat-teams").textContent    = S.teams.length;
  id("stat-phases").textContent   = `${completedGlobalPhases()}/6`;
  id("stat-upcoming").textContent = upcomingCount();

  const tbody = id("dashboard-tbody");
  const cards = id("dashboard-cards");

  if (!S.teams.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">No teams yet. <a href="#" onclick="navigate('teams',document.querySelector('[data-page=teams]'))">Add your first →</a></td></tr>`;
    if (cards) cards.innerHTML = `<div class="empty-state-card">No teams yet. Go to <strong>Teams</strong> to add one.</div>`;
    return;
  }

  // Desktop table rows
  tbody.innerHTML = S.teams.map(t => {
    const { done, pct } = teamProgress(t);
    const cells = t.phases.map((p, i) =>
      `<td><span class="phase-badge ${p.status}" onclick="openPhaseModal('${t.id}',${i})">${statusLabel(p.status)}</span></td>`
    ).join("");
    const finalDone = t.phases[5]?.status === "completed";
    const marksCell = finalDone
      ? (t.marks !== undefined && t.marks !== null
          ? `<span class="marks-badge" onclick="openMarksModal('${t.id}')">${t.marks}/${S.totalMarks}</span>`
          : `<button class="btn btn-secondary btn-sm" onclick="openMarksModal('${t.id}')">+ Assign</button>`)
      : `<span style="color:var(--text3);font-size:.75rem">—</span>`;
    return `<tr>
      <td>
        <div style="font-weight:600;font-size:.86rem">${esc(t.name)}</div>
        <div style="font-size:.74rem;color:var(--text2)">${esc(t.project)}</div>
      </td>
      ${cells}
      <td>
        <div class="progress-wrap">
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="progress-label">${done}/6</div>
        </div>
      </td>
      <td>${marksCell}</td>
    </tr>`;
  }).join("");

  // Mobile cards
  if (!cards) return;
  cards.innerHTML = S.teams.map(t => {
    const { done, pct } = teamProgress(t);
    const finalDone = t.phases[5]?.status === "completed";
    const phaseItems = t.phases.map((p, i) =>
      `<div class="dash-phase-item" onclick="openPhaseModal('${t.id}',${i})">
        <div class="dash-phase-label">${esc(p.name)}</div>
        <div class="dash-phase-status ${p.status}">${statusLabel(p.status)}</div>
      </div>`
    ).join("");
    const marksRow = finalDone ? `
      <div class="dash-marks-row">
        <span class="dash-marks-label">Marks:</span>
        ${t.marks !== undefined && t.marks !== null
          ? `<span class="dash-marks-value">${t.marks}/${S.totalMarks}</span>
             <button class="btn btn-secondary btn-sm" onclick="openMarksModal('${t.id}')" style="margin-left:auto">✎ Edit</button>`
          : `<span class="dash-marks-empty">Not assigned</span>
             <button class="btn btn-secondary btn-sm" onclick="openMarksModal('${t.id}')" style="margin-left:auto">+ Assign</button>`}
      </div>` : "";
    return `<div class="dash-team-card">
      <div class="dash-team-name">${esc(t.name)}</div>
      <div class="dash-team-project">${esc(t.project)}</div>
      <div class="dash-phases">${phaseItems}</div>
      <div class="progress-wrap">
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-label">${done}/6 completed</div>
      </div>
      ${marksRow}
    </div>`;
  }).join("");
}

// ─────────────────────────────────────────────
//  TEAMS PAGE
// ─────────────────────────────────────────────
function renderTeams() {
  const container = id("teams-list");
  if (!S.teams.length) {
    container.innerHTML = `<div class="empty-state-card">No teams yet. Tap "+ New Team" to get started.</div>`;
    return;
  }
  container.innerHTML = S.teams.map(t => {
    const { done, pct } = teamProgress(t);

    // Members in aligned rows: name left, phone right
    const members = t.members.map((m, i) => {
      const phone = (t.phones || [])[i] || "";
      return `<div class="member-row">
        <span class="member-name">${esc(m)}</span>
        ${phone
          ? `<a href="tel:${esc(phone)}" class="member-phone" title="Call ${esc(m)}">📞 ${esc(phone)}</a>`
          : `<span class="member-no-phone">—</span>`}
      </div>`;
    }).join("");

    const phases = t.phases.map((p, i) =>
      `<div class="phase-item" onclick="openPhaseModal('${t.id}',${i})">
        <div class="phase-item-label">${esc(p.name)}</div>
        <div class="phase-item-status ${p.status}">${statusLabel(p.status)}</div>
      </div>`
    ).join("");

    const finalDone = t.phases[5]?.status === "completed";
    const marksRow = finalDone ? `
      <div class="team-marks-row">
        <span class="marks-label">Marks:</span>
        ${t.marks !== undefined && t.marks !== null
          ? `<span class="marks-value">${t.marks}/${S.totalMarks}</span>`
          : `<span class="marks-not-set">Not assigned yet</span>`}
        <button class="btn btn-secondary btn-sm" onclick="openMarksModal('${t.id}')" style="margin-left:auto">
          ${t.marks !== undefined && t.marks !== null ? "✎ Edit" : "+ Assign"} Marks
        </button>
      </div>` : "";

    return `<div class="team-card">
      <div class="team-card-header">
        <div>
          <div class="team-card-title">${esc(t.name)}</div>
          <div class="team-card-project">${esc(t.project)}</div>
        </div>
        <div class="team-card-actions">
          <button class="btn-icon" onclick="openTeamModal('${t.id}')" title="Edit">✎</button>
          <button class="btn-icon" onclick="openDeleteModal('${t.id}')" title="Delete" style="color:var(--red)">⊗</button>
        </div>
      </div>
      <div class="team-members">${members}</div>
      <div class="team-phases">${phases}</div>
      <div class="team-progress">
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-label" style="margin-top:3px">${done}/6 phases completed</div>
      </div>
      ${marksRow}
    </div>`;
  }).join("");
}

// ── Team CRUD ──
function openTeamModal(teamId) {
  id("modal-error").classList.add("hidden");
  if (teamId) {
    const t = S.teams.find(x => x.id === teamId);
    if (!t) return;
    id("modal-title").textContent   = "Edit Team";
    id("modal-team-id").value       = teamId;
    id("modal-team-name").value     = t.name;
    id("modal-project-title").value = t.project;
    id("modal-members").value       = t.members.join("\n");
    id("modal-phones").value        = (t.phones || []).join("\n");
  } else {
    id("modal-title").textContent   = "New Team";
    id("modal-team-id").value       = "";
    id("modal-team-name").value     = "";
    id("modal-project-title").value = "";
    id("modal-members").value       = "";
    id("modal-phones").value        = "";
  }
  id("team-modal").classList.remove("hidden");
  setTimeout(() => id("modal-team-name").focus(), 120);
}
function closeTeamModal() { id("team-modal").classList.add("hidden"); }

async function saveTeam() {
  const tid     = id("modal-team-id").value;
  const name    = id("modal-team-name").value.trim();
  const project = id("modal-project-title").value.trim();
  const members = id("modal-members").value.split("\n").map(m => m.trim()).filter(Boolean);
  const rawPh   = id("modal-phones").value.split("\n").map(p => p.trim());
  const phones  = members.map((_, i) => rawPh[i] || "");
  const errEl   = id("modal-error");
  errEl.classList.add("hidden");

  if (!name)           return showErr(errEl, "Team name is required.");
  if (!project)        return showErr(errEl, "Project title is required.");
  if (!members.length) return showErr(errEl, "At least one member is required.");

  if (tid) {
    const idx = S.teams.findIndex(x => x.id === tid);
    if (idx !== -1) {
      S.teams[idx] = { ...S.teams[idx], name, project, members, phones };
      await fbSaveTeam(S.teams[idx]);
    }
    showToast("Team updated ✓", "success");
  } else {
    const team = { id: genId(), name, project, members, phones, phases: defaultPhases() };
    S.teams.push(team);
    await fbSaveTeam(team);
    showToast("Team created ✓", "success");
  }
  saveLocalData();
  closeTeamModal();
  renderTeams();
  renderDashboard();
}

function openDeleteModal(teamId) {
  const t = S.teams.find(x => x.id === teamId);
  if (!t) return;
  S.pendingDeleteId = teamId;
  id("delete-team-name").textContent = t.name;
  id("delete-modal").classList.remove("hidden");
}
function closeDeleteModal() {
  id("delete-modal").classList.add("hidden");
  S.pendingDeleteId = null;
}
async function confirmDelete() {
  const tid = S.pendingDeleteId;
  if (!tid) return;
  S.teams = S.teams.filter(x => x.id !== tid);
  await fbDeleteTeam(tid);
  saveLocalData();
  closeDeleteModal();
  renderTeams();
  renderDashboard();
  showToast("Team deleted", "success");
}

// ─────────────────────────────────────────────
//  PHASE MODAL  (with report)
// ─────────────────────────────────────────────
function openPhaseModal(teamId, phaseIdx) {
  const t = S.teams.find(x => x.id === teamId);
  if (!t) return;
  const p = t.phases[phaseIdx];
  id("phase-modal-title").textContent = `Update: ${p.name}`;
  id("phase-modal-desc").textContent  = `Team: ${t.name}  ·  Current: ${statusLabel(p.status)}`;
  id("phase-modal-team-id").value     = teamId;
  id("phase-modal-phase-idx").value   = phaseIdx;
  id("phase-status-select").value     = p.status === "completed" ? "completed" : "pending";
  id("phase-report-text").value       = p.report || "";
  id("phase-modal").classList.remove("hidden");
}
function closePhaseModal() { id("phase-modal").classList.add("hidden"); }

async function savePhaseStatus() {
  const teamId    = id("phase-modal-team-id").value;
  const phaseIdx  = parseInt(id("phase-modal-phase-idx").value);
  const newStatus = id("phase-status-select").value;
  const report    = id("phase-report-text").value.trim();
  const t = S.teams.find(x => x.id === teamId);
  if (!t) return;

  // Save report
  t.phases[phaseIdx].report = report;

  if (newStatus === "completed") {
    t.phases.forEach(p => { if (p.status === "in-progress") p.status = "pending"; });
    t.phases[phaseIdx].status = "completed";
    const next = t.phases.findIndex((p, i) => i > phaseIdx && p.status !== "completed");
    if (next !== -1) t.phases[next].status = "in-progress";
  } else {
    t.phases[phaseIdx].status = "pending";
    t.phases.forEach(p => { if (p.status === "in-progress") p.status = "pending"; });
    let lastDone = -1;
    t.phases.forEach((p, i) => { if (p.status === "completed") lastDone = i; });
    const nextActive = t.phases.findIndex((p, i) => i > lastDone && p.status !== "completed");
    if (nextActive !== -1) t.phases[nextActive].status = "in-progress";
    else if (lastDone === -1) t.phases[0].status = "in-progress";
  }

  await fbSaveTeam(t);
  saveLocalData();
  closePhaseModal();
  renderDashboard();
  if (S.currentPage === "teams") renderTeams();
  showToast("Phase updated ✓", "success");
}

// ─────────────────────────────────────────────
//  MARKS
// ─────────────────────────────────────────────
function openMarksModal(teamId) {
  const t = S.teams.find(x => x.id === teamId);
  if (!t) return;
  id("marks-modal-title").textContent    = `Assign Marks — ${t.name}`;
  id("marks-modal-desc").textContent     = `Project: ${t.project}`;
  id("marks-out-of-label").textContent   = `(out of ${S.totalMarks})`;
  id("marks-input").value                = t.marks !== undefined && t.marks !== null ? t.marks : "";
  id("marks-input").max                  = S.totalMarks;
  id("marks-team-id").value             = teamId;
  id("marks-error").classList.add("hidden");
  id("marks-modal").classList.remove("hidden");
  setTimeout(() => id("marks-input").focus(), 120);
}
function closeMarksModal() { id("marks-modal").classList.add("hidden"); }

async function saveMarks() {
  const teamId = id("marks-team-id").value;
  const val    = id("marks-input").value.trim();
  const errEl  = id("marks-error");
  errEl.classList.add("hidden");

  if (val === "") return showErr(errEl, "Please enter marks.");
  const marks = parseFloat(val);
  if (isNaN(marks) || marks < 0) return showErr(errEl, "Please enter a valid number.");
  if (marks > S.totalMarks)      return showErr(errEl, `Marks cannot exceed ${S.totalMarks}.`);

  const t = S.teams.find(x => x.id === teamId);
  if (!t) return;
  t.marks = marks;
  await fbSaveTeam(t);
  saveLocalData();
  closeMarksModal();
  renderDashboard();
  if (S.currentPage === "teams") renderTeams();
  showToast(`Marks saved: ${marks}/${S.totalMarks}`, "success");
}

// ─────────────────────────────────────────────
//  TOTAL MARKS SETTING
// ─────────────────────────────────────────────
function openTotalMarksModal() {
  id("total-marks-input").value = S.totalMarks;
  id("total-marks-error").classList.add("hidden");
  id("total-marks-modal").classList.remove("hidden");
  setTimeout(() => id("total-marks-input").focus(), 120);
}
function closeTotalMarksModal() { id("total-marks-modal").classList.add("hidden"); }

async function saveTotalMarks() {
  const val   = id("total-marks-input").value.trim();
  const errEl = id("total-marks-error");
  errEl.classList.add("hidden");

  if (!val) return showErr(errEl, "Please enter a value.");
  const total = parseFloat(val);
  if (isNaN(total) || total < 1) return showErr(errEl, "Total marks must be at least 1.");

  S.totalMarks = total;
  await fbSaveTotalMarks(total);
  saveLocalData();
  closeTotalMarksModal();
  renderDashboard();
  if (S.currentPage === "teams") renderTeams();
  showToast(`Total marks set to ${total}`, "success");
}

// ─────────────────────────────────────────────
//  CONTACT MODAL
// ─────────────────────────────────────────────
function openContactModal() {
  id("contact-modal").classList.remove("hidden");
  if (window.innerWidth <= 768) closeSidebar();
}
function closeContactModal() { id("contact-modal").classList.add("hidden"); }

// ─────────────────────────────────────────────
//  DEADLINES PAGE
// ─────────────────────────────────────────────
function renderDeadlines() {
  const today = todayStr();
  id("deadlines-grid").innerHTML = PHASES.map((name, i) => {
    const dl = S.deadlines[i];
    let badge, cls;
    if (!dl)             { badge = "Not Set"; cls = "no-date"; }
    else if (dl < today) { badge = "Done";    cls = "done"; }
    else                 { badge = "Upcoming";cls = "upcoming"; }
    return `<div class="deadline-card">
      <div class="deadline-card-header">
        <div class="deadline-phase-name">${esc(name)}</div>
        <span class="deadline-status-badge ${cls}">${badge}</span>
      </div>
      <div class="deadline-date-display">Deadline: <span>${formatDate(dl)}</span></div>
      <div class="deadline-date-input">
        <input type="date" value="${dl||""}" onchange="updateDeadline(${i},this.value)">
        ${dl ? `<button class="btn-icon" onclick="clearDeadline(${i})" title="Clear">✕</button>` : ""}
      </div>
    </div>`;
  }).join("");
  renderMissed();
}

async function updateDeadline(idx, date) {
  S.deadlines[idx] = date;
  await fbSaveDeadline(idx, date);
  saveLocalData();
  renderDeadlines();
  if (S.currentPage === "calendar") renderCalendar();
  showToast("Deadline saved ✓", "success");
}

async function clearDeadline(idx) {
  delete S.deadlines[idx];
  await fbDeleteDeadline(idx);
  saveLocalData();
  renderDeadlines();
  if (S.currentPage === "calendar") renderCalendar();
  showToast("Deadline cleared", "success");
}

function renderMissed() {
  const today  = todayStr();
  const missed = [];
  PHASES.forEach((name, i) => {
    const dl = S.deadlines[i];
    if (!dl || dl >= today) return;
    const behind = S.teams.filter(t => t.phases[i]?.status !== "completed");
    if (behind.length) missed.push({ name, dl, teams: behind });
  });
  const el = id("missed-section");
  if (!missed.length) {
    el.innerHTML = `<div class="empty-state-card">🎉 No missed deadlines — great work!</div>`;
    return;
  }
  el.innerHTML = missed.map(m =>
    `<div class="missed-card">
      <div class="missed-card-header">
        <span class="missed-phase-name">⚠ ${esc(m.name)}</span>
        <span class="missed-deadline-date">Was: ${formatDate(m.dl)}</span>
      </div>
      <div class="missed-teams">
        ${m.teams.map(t => `<span class="missed-team-tag">${esc(t.name)}</span>`).join("")}
      </div>
    </div>`
  ).join("");
}

// ─────────────────────────────────────────────
//  CALENDAR
// ─────────────────────────────────────────────
function initCalendar() {
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
}
function prevMonth() { if (--calMonth < 0)  { calMonth = 11; calYear--; } renderCalendar(); }
function nextMonth() { if (++calMonth > 11) { calMonth = 0;  calYear++; } renderCalendar(); }

function renderCalendar() {
  if (calYear === undefined) initCalendar();
  const MONTHS = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  id("cal-month-label").textContent = `${MONTHS[calMonth]} ${calYear}`;

  const todayISO = todayStr();
  const dlMap    = {};
  PHASES.forEach((name, i) => {
    const dl = S.deadlines[i];
    if (!dl) return;
    if (!dlMap[dl]) dlMap[dl] = [];
    let status = dl < todayISO ? "missed" : "upcoming";
    if (S.teams.length && S.teams.every(t => t.phases[i]?.status === "completed")) status = "completed";
    dlMap[dl].push({ name, status });
  });

  const first    = new Date(calYear, calMonth, 1);
  const startDay = first.getDay();
  const daysInM  = new Date(calYear, calMonth + 1, 0).getDate();
  const trailing = 42 - startDay - daysInM;

  const cell = (day, ds, events, other) => {
    const isToday   = ds === todayISO;
    const hasEvent  = events.length > 0;
    const firstType = events[0]?.status || "";
    const evHTML    = events.map(e => `<span class="cal-event ${e.status}">${e.name}</span>`).join("");
    return `<div class="cal-cell${other?" other-month":""}${isToday?" today":""}"
      data-has-event="${hasEvent}" data-event-type="${firstType}">
      <div class="cal-date">${day}</div>${evHTML}
    </div>`;
  };

  let html = `<div class="cal-days-header">
    ${["S","M","T","W","T","F","S"].map(d => `<div class="cal-day-name">${d}</div>`).join("")}
  </div><div class="cal-cells">`;

  for (let i = 0; i < startDay; i++) {
    const d = new Date(calYear, calMonth, -startDay + i + 1);
    html += cell(d.getDate(), d.toISOString().split("T")[0], dlMap[d.toISOString().split("T")[0]] || [], true);
  }
  for (let d = 1; d <= daysInM; d++) {
    const ds = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    html += cell(d, ds, dlMap[ds] || [], false);
  }
  for (let d = 1; d <= trailing; d++) {
    const dt = new Date(calYear, calMonth + 1, d);
    html += cell(d, dt.toISOString().split("T")[0], dlMap[dt.toISOString().split("T")[0]] || [], true);
  }

  id("calendar-grid").innerHTML = html + "</div>";
}

// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = "success") {
  const t = id("toast");
  t.textContent = msg;
  t.className   = `toast ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.add("hidden"), 2800);
}

// ─────────────────────────────────────────────
//  KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeTeamModal(); closePhaseModal(); closeDeleteModal();
    closeMarksModal(); closeTotalMarksModal(); closeContactModal();
    closeSidebar();
  }
  if (e.key === "Enter" && id("auth-page").classList.contains("active")) {
    const loginVisible = !id("form-login").classList.contains("hidden");
    loginVisible ? handleLogin() : handleSignup();
  }
});

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
async function init() {
  const theme = localStorage.getItem("mb_theme") || "dark";
  document.documentElement.setAttribute("data-theme", theme);
  id("theme-icon").textContent = theme === "dark" ? "☀" : "🌙";

  initCalendar();
  await initFirebase();

  const session = localStorage.getItem("mb_session");
  if (session) {
    try {
      S.currentUser = JSON.parse(session);
      S.loggedIn    = true;
      if (S.useFirebase) {
        await new Promise(resolve => {
          const unsub = S.fb.onAuthStateChanged(S.auth, user => {
            unsub();
            if (user) {
              S.currentUser.uid   = user.uid;
              S.currentUser.email = user.email;
              S.currentUser.name  = user.displayName || S.currentUser.name;
              resolve();
            } else {
              S.loggedIn = false;
              localStorage.removeItem("mb_session");
              resolve();
            }
          });
        });
        if (S.loggedIn) {
          await loadFirebaseData();
          attachFirebaseRealtimeListeners();
        }
      } else {
        loadLocalData();
      }
      if (S.loggedIn) { showApp(); return; }
    } catch (_) {}
  }

  if (!S.useFirebase) {
    const accs = JSON.parse(localStorage.getItem("mb_accounts") || "{}");
    if (!accs[DEMO.email]) {
      accs[DEMO.email] = { name: "Demo Faculty", password: DEMO.password };
      localStorage.setItem("mb_accounts", JSON.stringify(accs));
    }
  }
}

init();