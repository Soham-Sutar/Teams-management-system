# MentorBoard — Multi-Faculty Teams Management System

A clean, mobile-ready web app where **multiple faculty members** can each manage their own student teams independently. Every faculty member's data is fully isolated — one faculty cannot see another's teams or deadlines.

---

## 🚀 Quick Start (No Firebase — Demo Mode)

1. Open `index.html` in a browser
2. Click **"Create Account"** and sign up with any email + password
3. Or use the built-in demo account:
   - **Email:** `demo@mentorboard.app`
   - **Password:** `demo1234`

In demo mode, each account's data is saved separately in `localStorage`.

---

## 🔥 Firebase Setup (Required for Real Deployment)

Firebase gives you a real backend with secure, isolated data per faculty member.

### Step 1 — Create Firebase Project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"** → give it a name → Create
3. In the left sidebar: **Build → Authentication**
   - Click **"Get started"**
   - Enable **Email/Password** sign-in method
4. In the left sidebar: **Build → Firestore Database**
   - Click **"Create database"**
   - Choose **"Start in production mode"** (or test mode for development)
   - Pick a region close to India (e.g., `asia-south1`)

### Step 2 — Get Your Config
1. Go to **Project Settings** (gear icon) → **General**
2. Scroll to **"Your apps"** → click **"</> Web"**
3. Register the app (give it any nickname)
4. Copy the `firebaseConfig` object shown

### Step 3 — Paste Config into app.js
Open `app.js` and replace the top section:

```javascript
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project-id",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123:web:abc123"
};
```

### Step 4 — Set Firestore Security Rules
In Firebase Console → Firestore → **Rules** tab, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Each user can only read/write their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
Click **Publish**.

### Step 5 — Done!
Each faculty member can now:
- Create their own account via the signup form
- Log in and manage their own teams independently
- All data is stored securely in Firestore under their account

---

## 📱 Mobile Support

The app is fully responsive:
- **Mobile (< 768px):** Bottom navigation bar, slide-in sidebar, sheet-style modals, tap-friendly buttons
- **Tablet:** Adaptive grid layouts
- **Desktop:** Sidebar always visible, full table view

---

## 🗂 Data Isolation

Each faculty member's data is stored at:
```
Firestore:
  users/
    {facultyUID}/
      profile/info     → { name, email }
      teams/{teamId}   → team object
      deadlines/{idx}  → { date: "YYYY-MM-DD" }
```

Faculty A cannot see or access Faculty B's data — enforced both by Firestore rules and the app logic.

---

## 📋 Features

| Feature | Description |
|---|---|
| **Multi-faculty signup** | Any faculty can create an account |
| **Isolated data** | Each faculty sees only their own teams |
| **Dashboard** | Team count, global phase completion, upcoming deadlines |
| **Phase tracking** | 6 phases per team, click to update status |
| **Auto-advance** | Completing a phase auto-activates the next |
| **Global deadlines** | Set one deadline per phase, per faculty |
| **Missed deadlines** | Highlighted with team names |
| **Calendar** | Visual month view of all phase deadlines |
| **Dark/Light theme** | Toggle in top-right |
| **Mobile bottom nav** | Thumb-friendly navigation on phones |
| **Session persistence** | Stay logged in across page refreshes |

---

## 📁 Files

```
teams-management/
├── index.html   — All HTML structure
├── style.css    — All styles (dark/light, mobile/desktop)
├── app.js       — All logic (auth, Firebase, CRUD, rendering)
└── README.md    — This file
```

All static — deploy by dragging the folder to Netlify.
