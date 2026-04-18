/* ============================================
   MentorBoard — Teams Management System
   app.js — All Application Logic
   ============================================ */

// ============================================================
// FIREBASE CONFIG
// ============================================================
// NOTE: Replace these with your actual Firebase project config.
// To set up: go to https://console.firebase.google.com
// Create a project → Add web app → Copy config below.
// Enable Authentication (Email/Password) and Firestore Database.
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};

// ============================================================
// LOCAL DATA STORE (used when Firebase is not configured)
// This gives full functionality with localStorage persistence.
// ============================================================

const PHASES = [
  "Idea Submission",
  "Proposal Approval",
  "Phase 1",
  "Phase 2",
  "Phase 3",
  "Final Submission"
];

const DEMO_CREDENTIALS = {
  email: "mentor@demo.com",
  password: "mentor123"
};

// ---- State ----
let state = {
  loggedIn: false,
  currentUser: null,
  teams: [],
  deadlines: {}, // { phaseIndex: "YYYY-MM-DD" }
  totalMarks: 100, // configurable total marks for final evaluation
  useFirebase: false,
  db: null,
  auth: null,
  currentPage: 'dashboard',
  calendarDate: new Date(),
  pendingDeleteId: null
};

// ---- Load from localStorage ----
function loadLocalData() {
  try {
    const teams = localStorage.getItem('mb_teams');
    const deadlines = localStorage.getItem('mb_deadlines');
    const user = localStorage.getItem('mb_user');
    const totalMarks = localStorage.getItem('mb_totalMarks');
    if (teams) state.teams = JSON.parse(teams);
    if (deadlines) state.deadlines = JSON.parse(deadlines);
    if (totalMarks) state.totalMarks = parseInt(totalMarks);
    if (user) {
      state.currentUser = JSON.parse(user);
      state.loggedIn = true;
    }
  } catch(e) { console.warn('Error loading local data', e); }
}

function saveLocalData() {
  localStorage.setItem('mb_teams', JSON.stringify(state.teams));
  localStorage.setItem('mb_deadlines', JSON.stringify(state.deadlines));
  localStorage.setItem('mb_totalMarks', String(state.totalMarks));
}

// ============================================================
// FIREBASE INIT (optional)
// ============================================================
async function initFirebase() {
  if (FIREBASE_CONFIG.apiKey === "YOUR_API_KEY") {
    console.log('Firebase not configured — using localStorage mode');
    return false;
  }
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js');
    const { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, onSnapshot } =
      await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
    const { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } =
      await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js');

    const app = initializeApp(FIREBASE_CONFIG);
    state.db = getFirestore(app);
    state.auth = getAuth(app);
    state.fbModules = { collection, getDocs, doc, setDoc, deleteDoc, onSnapshot,
      signInWithEmailAndPassword, signOut, onAuthStateChanged };
    state.useFirebase = true;
    console.log('Firebase initialized');
    return true;
  } catch(e) {
    console.warn('Firebase init failed, using localStorage:', e);
    return false;
  }
}

// ============================================================
// AUTH
// ============================================================
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');

  if (!email || !password) {
    showError(errEl, 'Please enter email and password.');
    return;
  }

  // Firebase auth
  if (state.useFirebase && state.auth) {
    try {
      const { signInWithEmailAndPassword } = state.fbModules;
      const cred = await signInWithEmailAndPassword(state.auth, email, password);
      state.currentUser = { email: cred.user.email, uid: cred.user.uid };
      state.loggedIn = true;
      localStorage.setItem('mb_user', JSON.stringify(state.currentUser));
      await loadFirebaseData();
      showApp();
      return;
    } catch(e) {
      showError(errEl, 'Invalid credentials. Please try again.');
      return;
    }
  }

  // Demo / local auth
  if (email === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password) {
    state.currentUser = { email };
    state.loggedIn = true;
    localStorage.setItem('mb_user', JSON.stringify(state.currentUser));
    showApp();
  } else {
    showError(errEl, 'Invalid credentials. Use mentor@demo.com / mentor123');
  }
}

async function handleLogout() {
  if (state.useFirebase && state.auth) {
    await state.fbModules.signOut(state.auth).catch(() => {});
  }
  state.loggedIn = false;
  state.currentUser = null;
  localStorage.removeItem('mb_user');
  document.getElementById('app').classList.remove('active');
  document.getElementById('login-page').classList.add('active');
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ============================================================
// FIREBASE DATA
// ============================================================

let listenersInitialized = false;

async function loadFirebaseData() {
  if (!state.useFirebase || !state.db) return;

  if (listenersInitialized) return; // 🚨 prevent duplicate listeners
  listenersInitialized = true;

  const { collection, onSnapshot } = state.fbModules;

  // 🔄 Teams listener
  onSnapshot(collection(state.db, 'teams'), (snapshot) => {
    state.teams = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    renderDashboard();
    if (state.currentPage === 'teams') renderTeams();
  });

  // 🔄 Deadlines listener
  onSnapshot(collection(state.db, 'deadlines'), (snapshot) => {
    state.deadlines = {};
    snapshot.docs.forEach(d => {
      state.deadlines[d.id] = d.data().date;
    });

    if (state.currentPage === 'deadlines') renderDeadlines();
    if (state.currentPage === 'calendar') renderCalendar();
  });

  // 🔄 Settings listener (totalMarks etc.)
  onSnapshot(collection(state.db, 'settings'), (snapshot) => {
    snapshot.docs.forEach(d => {
      if (d.id === 'marks' && d.data().totalMarks) {
        state.totalMarks = d.data().totalMarks;
      }
    });
    renderDashboard();
  });
}

async function saveTeamToFirebase(team) {
  if (!state.useFirebase || !state.db) return;
  const { doc, setDoc } = state.fbModules;
  await setDoc(doc(state.db, 'teams', team.id), team);
}

async function deleteTeamFromFirebase(id) {
  if (!state.useFirebase || !state.db) return;
  const { doc, deleteDoc } = state.fbModules;
  await deleteDoc(doc(state.db, 'teams', id));
}

async function saveDeadlineToFirebase(phaseIdx, date) {
  if (!state.useFirebase || !state.db) return;
  const { doc, setDoc } = state.fbModules;
  await setDoc(doc(state.db, 'deadlines', String(phaseIdx)), { date });
}

// ============================================================
// APP NAVIGATION
// ============================================================
function showApp() {
  document.getElementById('login-page').classList.remove('active');
  document.getElementById('app').classList.add('active');
  document.getElementById('sidebar-email').textContent =
    state.currentUser?.email || 'mentor@demo.com';
  navigate('dashboard', document.querySelector('[data-page="dashboard"]'));
}

function navigate(page, el) {
  if (el) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
  }
  // Sync bottom nav highlight
  document.querySelectorAll('.bnav-btn[data-page]').forEach(b => {
    b.classList.toggle('active', b.dataset.page === page);
  });
  document.querySelectorAll('.content-page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');
  state.currentPage = page;

  const titles = {
    dashboard: 'Dashboard',
    teams: 'Teams',
    deadlines: 'Deadlines',
    calendar: 'Calendar'
  };
  document.getElementById('page-title').textContent = titles[page] || page;

  // Close sidebar on mobile
  if (window.innerWidth <= 768) closeSidebar();

  // Render page
  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'teams':     renderTeams();     break;
    case 'deadlines': renderDeadlines(); break;
    case 'calendar':  renderCalendar();  break;
  }
}

// Bottom nav navigate — doesn't try to set sidebar nav active class
function bnavNavigate(page, el) {
  navigate(page, null);
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  let overlay = document.getElementById('sidebar-overlay');
  if (overlay) overlay.classList.add('show');
  document.body.classList.add('sidebar-open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) overlay.classList.remove('show');
  document.body.classList.remove('sidebar-open');
}

// Keep toggleSidebar as alias for hamburger
function toggleSidebar() {
  const isOpen = document.getElementById('sidebar').classList.contains('open');
  isOpen ? closeSidebar() : openSidebar();
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('theme-icon').textContent = isDark ? '🌙' : '☀';
  localStorage.setItem('mb_theme', isDark ? 'light' : 'dark');
}

function togglePassword() {
  const pw = document.getElementById('login-password');
  pw.type = pw.type === 'password' ? 'text' : 'password';
}

// ============================================================
// TEAM HELPERS
// ============================================================
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function createDefaultPhases() {
  // First phase in progress, rest pending
  return PHASES.map((name, i) => ({
    name,
    status: i === 0 ? 'in-progress' : 'pending'
  }));
}

function getCompletedPhasesCount() {
  // A phase is completed if ALL teams have completed it
  let count = 0;
  for (let i = 0; i < 6; i++) {
    if (state.teams.length === 0) break;
    const allDone = state.teams.every(t => t.phases[i]?.status === 'completed');
    if (allDone) count++;
  }
  return count;
}

function getTeamProgress(team) {
  const done = team.phases.filter(p => p.status === 'completed').length;
  return { done, total: 6, pct: Math.round((done / 6) * 100) };
}

function getUpcomingDeadlinesCount() {
  const today = todayStr();
  return Object.values(state.deadlines).filter(d => d >= today).length;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m)-1]} ${y}`;
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  document.getElementById('stat-teams').textContent = state.teams.length;
  const completed = getCompletedPhasesCount();
  document.getElementById('stat-phases').textContent = `${completed}/6`;
  document.getElementById('stat-upcoming').textContent = getUpcomingDeadlinesCount();

  const tbody = document.getElementById('dashboard-tbody');
  if (state.teams.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No teams yet. <a href="#" onclick="navigate('teams', document.querySelector('[data-page=teams]'))">Add your first team →</a></td></tr>`;
    return;
  }

  tbody.innerHTML = state.teams.map(team => {
    const { done, pct } = getTeamProgress(team);
    const phaseCells = team.phases.map((p, i) =>
      `<td><span class="phase-badge ${p.status}" onclick="openPhaseModal('${team.id}', ${i})" title="Click to update">${statusLabel(p.status)}</span></td>`
    ).join('');
    const finalDone = team.phases[5]?.status === 'completed';
    const marksCell = finalDone
      ? (team.marks !== undefined && team.marks !== null
          ? `<span class="marks-badge" onclick="openMarksModal('${team.id}')" title="Click to edit">${team.marks}/${state.totalMarks}</span>`
          : `<button class="btn btn-secondary btn-sm" onclick="openMarksModal('${team.id}')">+ Assign</button>`)
      : `<span style="color:var(--text3);font-size:0.75rem">—</span>`;
    return `
      <tr>
        <td>
          <div style="font-weight:600;font-size:0.88rem">${esc(team.name)}</div>
          <div style="font-size:0.76rem;color:var(--text2)">${esc(team.project)}</div>
        </td>
        ${phaseCells}
        <td>
          <div class="progress-wrap">
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
            <div class="progress-label">${done}/6</div>
          </div>
        </td>
        <td>${marksCell}</td>
      </tr>
    `;
  }).join('');
}

function statusLabel(s) {
  if (s === 'completed') return '✓ Done';
  if (s === 'in-progress') return '▶ Active';
  return '○ Pending';
}

// ============================================================
// TEAMS PAGE
// ============================================================
function renderTeams() {
  const container = document.getElementById('teams-list');
  if (state.teams.length === 0) {
    container.innerHTML = `<div class="empty-state-card">No teams yet. Click "New Team" to get started.</div>`;
    return;
  }
  container.innerHTML = state.teams.map(team => {
    const { done, pct } = getTeamProgress(team);
    const members = team.members.map((m, i) => {
      const phone = (team.phones || [])[i] || '';
      return `<span class="member-tag">
        ${esc(m)}${phone ? `<a href="tel:${esc(phone)}" class="member-phone" title="Call ${esc(m)}">📞 ${esc(phone)}</a>` : ''}
      </span>`;
    }).join('');
    const phases = team.phases.map((p, i) => `
      <div class="phase-item" onclick="openPhaseModal('${team.id}', ${i})" title="Click to update phase status">
        <div class="phase-item-label">${esc(p.name)}</div>
        <div class="phase-item-status ${p.status}">${statusLabel(p.status)}</div>
      </div>
    `).join('');

    // Marks display
    const finalDone = team.phases[5]?.status === 'completed';
    const marksDisplay = finalDone
      ? `<div class="team-marks-row">
          <span class="marks-label">Marks:</span>
          ${team.marks !== undefined && team.marks !== null
            ? `<span class="marks-value">${team.marks}/${state.totalMarks}</span>`
            : `<span class="marks-not-set">Not assigned yet</span>`}
          <button class="btn btn-secondary btn-sm" onclick="openMarksModal('${team.id}')" style="margin-left:auto">✎ ${team.marks !== undefined && team.marks !== null ? 'Edit' : 'Assign'} Marks</button>
        </div>`
      : '';

    return `
      <div class="team-card">
        <div class="team-card-header">
          <div>
            <div class="team-card-title">${esc(team.name)}</div>
            <div class="team-card-project">${esc(team.project)}</div>
          </div>
          <div class="team-card-actions">
            <button class="btn-icon" onclick="openTeamModal('${team.id}')" title="Edit">✎</button>
            <button class="btn-icon" onclick="openDeleteModal('${team.id}')" title="Delete" style="color:var(--red)">⊗</button>
          </div>
        </div>
        <div class="team-members">${members}</div>
        <div class="team-phases">${phases}</div>
        <div class="team-progress">
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="progress-label" style="margin-top:4px">${done}/6 phases completed</div>
        </div>
        ${marksDisplay}
      </div>
    `;
  }).join('');
}

// ---- TEAM MODAL ----
function openTeamModal(id) {
  const modal = document.getElementById('team-modal');
  document.getElementById('modal-error').classList.add('hidden');

  if (id) {
    const team = state.teams.find(t => t.id === id);
    if (!team) return;
    document.getElementById('modal-title').textContent = 'Edit Team';
    document.getElementById('modal-team-id').value = id;
    document.getElementById('modal-team-name').value = team.name;
    document.getElementById('modal-project-title').value = team.project;
    document.getElementById('modal-members').value = team.members.join('\n');
    document.getElementById('modal-phones').value = (team.phones || []).join('\n');
  } else {
    document.getElementById('modal-title').textContent = 'New Team';
    document.getElementById('modal-team-id').value = '';
    document.getElementById('modal-team-name').value = '';
    document.getElementById('modal-project-title').value = '';
    document.getElementById('modal-members').value = '';
    document.getElementById('modal-phones').value = '';
  }
  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('modal-team-name').focus(), 100);
}

function closeTeamModal() {
  document.getElementById('team-modal').classList.add('hidden');
}

async function saveTeam() {
  const id = document.getElementById('modal-team-id').value;
  const name = document.getElementById('modal-team-name').value.trim();
  const project = document.getElementById('modal-project-title').value.trim();
  const membersRaw = document.getElementById('modal-members').value;
  const phonesRaw = document.getElementById('modal-phones').value;
  const errEl = document.getElementById('modal-error');
  errEl.classList.add('hidden');

  if (!name) { showError(errEl, 'Team name is required.'); return; }
  if (!project) { showError(errEl, 'Project title is required.'); return; }
  const members = membersRaw.split('\n').map(m => m.trim()).filter(Boolean);
  if (members.length === 0) { showError(errEl, 'At least one member is required.'); return; }
  // phones: parse, pad/trim to match members length
  const rawPhones = phonesRaw.split('\n').map(p => p.trim());
  const phones = members.map((_, i) => rawPhones[i] || '');

  if (id) {
    // Edit existing
    const idx = state.teams.findIndex(t => t.id === id);
    if (idx !== -1) {
      state.teams[idx].name = name;
      state.teams[idx].project = project;
      state.teams[idx].members = members;
      state.teams[idx].phones = phones;
      await saveTeamToFirebase(state.teams[idx]);
    }
    showToast('Team updated successfully', 'success');
  } else {
    // New team
    const team = {
      id: generateId(),
      name, project, members, phones,
      phases: createDefaultPhases()
    };
    state.teams.push(team);
    await saveTeamToFirebase(team);
    showToast('Team created successfully', 'success');
  }

  saveLocalData();
  closeTeamModal();
  renderTeams();
  if (state.currentPage === 'dashboard') renderDashboard();
}

// ---- DELETE ----
function openDeleteModal(id) {
  const team = state.teams.find(t => t.id === id);
  if (!team) return;
  state.pendingDeleteId = id;
  document.getElementById('delete-team-name').textContent = team.name;
  document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
  document.getElementById('delete-modal').classList.add('hidden');
  state.pendingDeleteId = null;
}

async function confirmDelete() {
  const id = state.pendingDeleteId;
  if (!id) return;
  state.teams = state.teams.filter(t => t.id !== id);
  await deleteTeamFromFirebase(id);
  saveLocalData();
  closeDeleteModal();
  renderTeams();
  renderDashboard();
  showToast('Team deleted', 'success');
}

// ============================================================
// PHASE MODAL
// ============================================================
function openPhaseModal(teamId, phaseIdx) {
  const team = state.teams.find(t => t.id === teamId);
  if (!team) return;
  const phase = team.phases[phaseIdx];

  document.getElementById('phase-modal-title').textContent = `Update: ${phase.name}`;
  document.getElementById('phase-modal-desc').textContent =
    `Team: ${team.name} — Current status: ${statusLabel(phase.status)}`;
  document.getElementById('phase-modal-team-id').value = teamId;
  document.getElementById('phase-modal-phase-idx').value = phaseIdx;

  const sel = document.getElementById('phase-status-select');
  sel.innerHTML = `
    <option value="pending" ${phase.status === 'pending' ? 'selected' : ''}>○ Pending</option>
    <option value="completed" ${phase.status === 'completed' ? 'selected' : ''}>✓ Completed</option>
  `;

  // Load existing report text for this phase
  document.getElementById('phase-report-text').value = phase.report || '';

  document.getElementById('phase-modal').classList.remove('hidden');
}

function closePhaseModal() {
  document.getElementById('phase-modal').classList.add('hidden');
}

// ============================================================
// MARKS
// ============================================================
function openMarksModal(teamId) {
  const team = state.teams.find(t => t.id === teamId);
  if (!team) return;
  document.getElementById('marks-modal-title').textContent = `Assign Marks — ${team.name}`;
  document.getElementById('marks-modal-desc').textContent =
    `Project: ${team.project}`;
  document.getElementById('marks-out-of-label').textContent = `(out of ${state.totalMarks})`;
  document.getElementById('marks-input').value = team.marks !== undefined && team.marks !== null ? team.marks : '';
  document.getElementById('marks-input').max = state.totalMarks;
  document.getElementById('marks-team-id').value = teamId;
  document.getElementById('marks-error').classList.add('hidden');
  document.getElementById('marks-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('marks-input').focus(), 100);
}

function closeMarksModal() {
  document.getElementById('marks-modal').classList.add('hidden');
}

async function saveMarks() {
  const teamId = document.getElementById('marks-team-id').value;
  const val = document.getElementById('marks-input').value.trim();
  const errEl = document.getElementById('marks-error');
  errEl.classList.add('hidden');

  if (val === '') { showError(errEl, 'Please enter marks.'); return; }
  const marks = parseFloat(val);
  if (isNaN(marks) || marks < 0) { showError(errEl, 'Please enter a valid number (0 or above).'); return; }
  if (marks > state.totalMarks) { showError(errEl, `Marks cannot exceed total marks (${state.totalMarks}).`); return; }

  const team = state.teams.find(t => t.id === teamId);
  if (!team) return;

  team.marks = marks;
  await saveTeamToFirebase(team);
  saveLocalData();
  closeMarksModal();
  renderDashboard();
  if (state.currentPage === 'teams') renderTeams();
  showToast(`Marks saved: ${marks}/${state.totalMarks}`, 'success');
}

// ============================================================
// TOTAL MARKS SETTING
// ============================================================
function openTotalMarksModal() {
  document.getElementById('total-marks-input').value = state.totalMarks;
  document.getElementById('total-marks-error').classList.add('hidden');
  document.getElementById('total-marks-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('total-marks-input').focus(), 100);
}

function closeTotalMarksModal() {
  document.getElementById('total-marks-modal').classList.add('hidden');
}

async function saveTotalMarks() {
  const val = document.getElementById('total-marks-input').value.trim();
  const errEl = document.getElementById('total-marks-error');
  errEl.classList.add('hidden');

  if (val === '') { showError(errEl, 'Please enter a total marks value.'); return; }
  const total = parseFloat(val);
  if (isNaN(total) || total < 1) { showError(errEl, 'Total marks must be at least 1.'); return; }

  state.totalMarks = total;

  // Save to Firebase settings collection
  if (state.useFirebase && state.db) {
    const { doc, setDoc } = state.fbModules;
    await setDoc(doc(state.db, 'settings', 'marks'), { totalMarks: total });
  }
  saveLocalData();
  closeTotalMarksModal();
  renderDashboard();
  if (state.currentPage === 'teams') renderTeams();
  showToast(`Total marks set to ${total}`, 'success');
}

async function savePhaseStatus() {
  const teamId = document.getElementById('phase-modal-team-id').value;
  const phaseIdx = parseInt(document.getElementById('phase-modal-phase-idx').value);
  const newStatus = document.getElementById('phase-status-select').value;
  const reportText = document.getElementById('phase-report-text').value.trim();

  const team = state.teams.find(t => t.id === teamId);
  if (!team) return;

  // Save report text
  team.phases[phaseIdx].report = reportText;

  // Update phase status
  team.phases[phaseIdx].status = newStatus;

  // If completed, set next phase to in-progress (if not already completed)
  if (newStatus === 'completed') {
    // Clear any in-progress states first
    team.phases.forEach(p => { if (p.status === 'in-progress') p.status = 'pending'; });
    team.phases[phaseIdx].status = 'completed';
    // Find next non-completed phase
    const nextIdx = team.phases.findIndex((p, i) => i > phaseIdx && p.status !== 'completed');
    if (nextIdx !== -1) {
      team.phases[nextIdx].status = 'in-progress';
    }
  } else if (newStatus === 'pending') {
    let lastCompleted = -1;
    team.phases.forEach((p, i) => { if (p.status === 'completed') lastCompleted = i; });
    team.phases.forEach(p => { if (p.status === 'in-progress') p.status = 'pending'; });
    const nextActive = team.phases.findIndex((p, i) => i > lastCompleted && p.status !== 'completed');
    if (nextActive !== -1) {
      team.phases[nextActive].status = 'in-progress';
    } else if (lastCompleted === -1) {
      team.phases[0].status = 'in-progress';
    }
  }

  await saveTeamToFirebase(team);
  saveLocalData();
  closePhaseModal();

  // Re-render current page
  renderDashboard();
  if (state.currentPage === 'teams') renderTeams();
  showToast(`Phase updated`, 'success');
}

// ============================================================
// DEADLINES PAGE
// ============================================================
function renderDeadlines() {
  const grid = document.getElementById('deadlines-grid');
  const today = todayStr();

  grid.innerHTML = PHASES.map((phaseName, i) => {
    const deadline = state.deadlines[i];
    let statusBadge = '';
    let statusClass = '';

    if (!deadline) {
      statusBadge = 'Not Set';
      statusClass = 'no-date';
    } else if (deadline < today) {
      statusBadge = 'Done';
      statusClass = 'Done';
    } else {
      statusBadge = 'Upcoming';
      statusClass = 'upcoming';
    }

    return `
      <div class="deadline-card">
        <div class="deadline-card-header">
          <div class="deadline-phase-name">${esc(phaseName)}</div>
          <span class="deadline-status-badge ${statusClass}">${statusBadge}</span>
        </div>
        <div class="deadline-date-display">
          Deadline: <span>${formatDate(deadline)}</span>
        </div>
        <div class="deadline-date-input">
          <input type="date" value="${deadline || ''}" 
            onchange="updateDeadline(${i}, this.value)"
            min="2020-01-01">
          ${deadline ? `<button class="btn-icon" onclick="clearDeadline(${i})" title="Clear">✕</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  renderMissedDeadlines();
}

async function updateDeadline(phaseIdx, date) {
  state.deadlines[phaseIdx] = date;
  await saveDeadlineToFirebase(phaseIdx, date);
  saveLocalData();
  renderDeadlines();
  if (state.currentPage === 'calendar') renderCalendar();
  showToast('Deadline saved', 'success');
}

async function clearDeadline(phaseIdx) {
  delete state.deadlines[phaseIdx];
  if (state.useFirebase && state.db) {
    const { doc, deleteDoc } = state.fbModules;
    await deleteDoc(doc(state.db, 'deadlines', String(phaseIdx))).catch(() => {});
  }
  saveLocalData();
  renderDeadlines();
  if (state.currentPage === 'calendar') renderCalendar();
  showToast('Deadline cleared', 'success');
}

function renderMissedDeadlines() {
  const today = todayStr();
  const container = document.getElementById('missed-section');
  const missed = [];

  PHASES.forEach((phaseName, i) => {
    const deadline = state.deadlines[i];
    if (!deadline || deadline >= today) return;

    // Find teams that haven't completed this phase
    const missedTeams = state.teams.filter(t => t.phases[i]?.status !== 'completed');
    if (missedTeams.length > 0) {
      missed.push({ phaseName, deadline, teams: missedTeams });
    }
  });

  if (missed.length === 0) {
    container.innerHTML = `<div class="empty-state-card">🎉 No missed deadlines — great work!</div>`;
    return;
  }

  container.innerHTML = missed.map(m => `
    <div class="missed-card">
      <div class="missed-card-header">
        <span class="missed-phase-name">⚠ ${esc(m.phaseName)}</span>
        <span class="missed-deadline-date">Deadline was: ${formatDate(m.deadline)}</span>
      </div>
      <div class="missed-teams">
        ${m.teams.map(t => `<span class="missed-team-tag">${esc(t.name)}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

// ============================================================
// CALENDAR PAGE
// ============================================================
let calYear, calMonth;

function initCalendar() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
}

function prevMonth() {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}

function nextMonth() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
}

function renderCalendar() {
  if (calYear === undefined) initCalendar();
  const monthNames = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  document.getElementById('cal-month-label').textContent = `${monthNames[calMonth]} ${calYear}`;

  const today = new Date();
  today.setHours(0,0,0,0);
  const todayISO = todayStr();

  // Build deadline lookup: date string → [{phaseName, status}]
  const deadlineMap = {};
  PHASES.forEach((phaseName, i) => {
    const dl = state.deadlines[i];
    if (!dl) return;
    if (!deadlineMap[dl]) deadlineMap[dl] = [];
    let s;
    if (dl < todayISO) s = 'missed';
    else s = 'upcoming';
    // Check if all teams completed this phase
    if (state.teams.length > 0 && state.teams.every(t => t.phases[i]?.status === 'completed')) {
      s = 'completed';
    }
    deadlineMap[dl].push({ phaseName, status: s });
  });

  // First day of this month
  const first = new Date(calYear, calMonth, 1);
  const last = new Date(calYear, calMonth + 1, 0);
  const startDay = first.getDay(); // 0=Sun
  const daysInMonth = last.getDate();

  let html = `
    <div class="cal-days-header">
      ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-day-name">${d}</div>`).join('')}
    </div>
    <div class="cal-cells">
  `;

  // Leading empty cells
  for (let i = 0; i < startDay; i++) {
    const prevDate = new Date(calYear, calMonth, -startDay + i + 1);
    const ds = prevDate.toISOString().split('T')[0];
    const events = deadlineMap[ds] || [];
    html += calCell(prevDate.getDate(), ds, events, true, false);
  }

  // Days in month
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(calYear, calMonth, d);
    const ds = date.toISOString().split('T')[0];
    const events = deadlineMap[ds] || [];
    const isToday = ds === todayISO;
    html += calCell(d, ds, events, false, isToday);
  }

  // Trailing cells
  const trailing = 42 - startDay - daysInMonth;
  for (let d = 1; d <= trailing; d++) {
    const date = new Date(calYear, calMonth + 1, d);
    const ds = date.toISOString().split('T')[0];
    const events = deadlineMap[ds] || [];
    html += calCell(d, ds, events, true, false);
  }

  html += '</div>';
  document.getElementById('calendar-grid').innerHTML = html;
}

function calCell(day, ds, events, otherMonth, isToday) {
  const evHTML = events.map(e =>
    `<span class="cal-event ${e.status}" title="${e.phaseName}">${e.phaseName}</span>`
  ).join('');
  const hasEvent = events.length > 0;
  const firstType = events.length > 0 ? events[0].status : '';
  return `
    <div class="cal-cell${otherMonth ? ' other-month' : ''}${isToday ? ' today' : ''}"
      data-has-event="${hasEvent}" data-event-type="${firstType}">
      <div class="cal-date">${day}</div>
      ${evHTML}
    </div>
  `;
}

// ============================================================
// TOAST
// ============================================================
let toastTimer;
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2800);
}

// ============================================================
// UTILS
// ============================================================
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// CONTACT MODAL
// ============================================================
function openContactModal() {
  document.getElementById('contact-modal').classList.remove('hidden');
  if (window.innerWidth <= 768) closeSidebar();
}

function closeContactModal() {
  document.getElementById('contact-modal').classList.add('hidden');
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeTeamModal();
    closePhaseModal();
    closeDeleteModal();
    closeMarksModal();
    closeTotalMarksModal();
    closeContactModal();
    closeSidebar();
  }
  if (e.key === 'Enter' && document.getElementById('login-page').classList.contains('active')) {
    handleLogin();
  }
});

// ============================================================
// INIT
// ============================================================
async function init() {
  // Load theme
  const theme = localStorage.getItem('mb_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-icon').textContent = theme === 'dark' ? '☀' : '🌙';

  // Load local data
  loadLocalData();

  // Try Firebase
  await initFirebase();

  // Check if already logged in
  if (state.loggedIn) {
    if (state.useFirebase) await loadFirebaseData();
    showApp();
  }

  // Seed demo data if empty
  if (state.teams.length === 0 && !state.loggedIn) {
    seedDemoData();
  }

  initCalendar();
}

function seedDemoData() {
  // Pre-seed some demo teams so users can see the UI immediately
  state.teams = [
    {
      id: 'demo1',
      name: 'Team Alpha',
      project: 'Smart Campus Navigator',
      members: ['Alice Johnson', 'Bob Smith', 'Carol White'],
      phases: [
        { name: 'Idea Submission', status: 'completed' },
        { name: 'Proposal Approval', status: 'completed' },
        { name: 'Phase 1', status: 'in-progress' },
        { name: 'Phase 2', status: 'pending' },
        { name: 'Phase 3', status: 'pending' },
        { name: 'Final Submission', status: 'pending' }
      ]
    },
    {
      id: 'demo2',
      name: 'Team Beta',
      project: 'EcoTrack — Carbon Footprint App',
      members: ['David Lee', 'Emma Wilson'],
      phases: [
        { name: 'Idea Submission', status: 'completed' },
        { name: 'Proposal Approval', status: 'in-progress' },
        { name: 'Phase 1', status: 'pending' },
        { name: 'Phase 2', status: 'pending' },
        { name: 'Phase 3', status: 'pending' },
        { name: 'Final Submission', status: 'pending' }
      ]
    },
    {
      id: 'demo3',
      name: 'Team Gamma',
      project: 'AI Study Buddy Platform',
      members: ['Frank Brown', 'Grace Kim', 'Henry Davis', 'Iris Chen'],
      phases: [
        { name: 'Idea Submission', status: 'completed' },
        { name: 'Proposal Approval', status: 'completed' },
        { name: 'Phase 1', status: 'completed' },
        { name: 'Phase 2', status: 'in-progress' },
        { name: 'Phase 3', status: 'pending' },
        { name: 'Final Submission', status: 'pending' }
      ]
    }
  ];

  // Demo deadlines
  const now = new Date();
  const addDays = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  };
  state.deadlines = {
    0: addDays(-20),  // missed
    1: addDays(-5),   // missed
    2: addDays(7),    // upcoming
    3: addDays(21),   // upcoming
    4: addDays(42),   // upcoming
    5: addDays(60),   // upcoming
  };

  saveLocalData();
}

// ============================================================
// START
// ============================================================
init();