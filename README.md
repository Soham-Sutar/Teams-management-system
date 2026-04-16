# MentorBoard — Teams Management System

A clean, modern web app for mentors to manage student teams and track project phases.

---

## 🚀 Quick Start (No Firebase needed)

1. Open `index.html` in a browser — that's it!
2. Login with demo credentials:
   - **Email:** `mentor@demo.com`
   - **Password:** `mentor123`

All data is saved to `localStorage` in your browser.

---

## 🔥 Firebase Setup (for persistent backend)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Add a **Web App** and copy the config
4. Enable **Authentication → Email/Password**
5. Enable **Firestore Database** (start in test mode)
6. In `app.js`, replace the `FIREBASE_CONFIG` object:

```javascript
const FIREBASE_CONFIG = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

7. In Firebase Auth, create a user with your mentor email/password
8. Done! Data now persists in Firestore.

---

## 📋 Features

| Feature | Description |
|---|---|
| **Auth** | Secure mentor login (demo or Firebase) |
| **Dashboard** | Stats: teams, completed phases, upcoming deadlines |
| **Phase Overview** | All 6 phases per team with color-coded badges |
| **Teams CRUD** | Create, edit, delete teams with members & project title |
| **Phase Tracking** | Click any phase badge to update status |
| **Auto In-Progress** | Next phase auto-advances when current is completed |
| **Global Deadlines** | Set one deadline per phase, shared across all teams |
| **Missed Deadlines** | Highlighted with which teams are behind |
| **Calendar** | Visual month view of all phase deadlines |
| **Dark/Light Theme** | Toggle in top-right corner |
| **Responsive** | Works on desktop and mobile |

---

## 🎨 Phase Status Logic

- **Pending** (🔴) — Not yet started
- **In Progress** (🟡) — Currently active (auto-set by system)
- **Completed** (🟢) — Done

**Rules:**
- Only one phase is "In Progress" per team at a time
- Marking a phase "Completed" auto-advances the next phase to "In Progress"
- Mentor can only manually set: Pending or Completed
- A global phase is counted as "completed" only when **ALL teams** have completed it

---

## 📁 File Structure

```
teams-management/
├── index.html    — App structure & all HTML
├── style.css     — All styles (dark/light theme)
├── app.js        — All logic (auth, CRUD, Firebase)
└── README.md     — This file
```
