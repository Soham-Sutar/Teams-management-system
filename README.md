# MentorBoard — Project Teams Management System

A web-based project management tool built for faculty members to independently manage student project teams, track progress across structured phases, monitor deadlines, and evaluate final submissions — all from a clean, mobile-friendly interface.

---

## Live Demo

> Deploy your own instance by following the [Deployment](#deployment) section below.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Firebase Setup](#firebase-setup)
- [Firestore Security Rules](#firestore-security-rules)
- [Deployment](#deployment)
- [Screenshots](#screenshots)
- [FAQ](#faq)

---

## Overview

MentorBoard is a **static web application** that allows multiple faculty members to each manage their own set of student project teams. Every faculty account is fully isolated — one faculty cannot see or access another's data.

Each team progresses through **6 structured project phases**, and the mentor tracks status, writes phase reports, sets global deadlines, and assigns final marks — all in one place.

The app is built with plain HTML, CSS, and JavaScript (no frameworks), backed by **Firebase Authentication** and **Cloud Firestore**, and hosted for free on **Netlify**.

---

## Features

### Authentication
- Email/Password signup and login
- **Google Sign-In** (one-click OAuth)
- Both methods work independently and can be used interchangeably
- Persistent sessions — stay logged in across page refreshes

### Multi-Faculty Support
- Any faculty member can create their own account
- Each account has completely isolated data in Firestore
- One faculty cannot view or modify another's teams or deadlines

### Dashboard
- Overview stats — total teams, completed phases (out of 6), upcoming deadlines
- Full team overview table (desktop) with all 6 phase statuses per team
- Mobile-friendly stacked card view (replaces table on small screens)
- Quick access to assign/edit marks per team

### Team Management (Full CRUD)
Each team stores:
- Team name and project title
- Member names with individual contact phone numbers
- 6 project phases with status and per-phase reports

### Project Phase Tracking
Teams progress through these 6 phases in order:

| # | Phase |
|---|-------|
| 1 | Idea Submission |
| 2 | Proposal Approval |
| 3 | Phase 1 |
| 4 | Phase 2 |
| 5 | Phase 3 |
| 6 | Final Submission |

**Phase rules:**
- Mentor manually sets a phase to **Pending** or **Completed**
- **In Progress** is set automatically — when a phase is completed, the next one activates
- Only one phase can be "In Progress" per team at a time
- A global phase is counted as completed only when **all teams** have completed it

### Phase Reports
- Mentor can write a short report/observation for any phase
- Report is saved per-phase per-team and pre-loads when reopened

### Marks Allocation
- Available only after a team's **Final Submission** is marked as Completed
- Mentor sets a **configurable total marks** value (e.g. 50, 100) — applies to all teams
- Marks displayed as `obtained / total` (e.g. `45/100`)
- Editable at any time after assignment

### Deadline Management
- Global deadlines set per phase — shared across all teams under that faculty
- Upcoming deadlines highlighted in yellow
- Missed deadlines clearly flagged in red, showing which teams have not completed that phase

### Calendar View
- Interactive monthly calendar showing all phase deadlines
- Color coded — green (all done), yellow (upcoming), red (missed)
- Navigate between months

### Student Contact Numbers
- Each team member can have a stored phone number
- Displayed in aligned rows (name left, number right)
- Tap-to-call link on mobile devices

### UI / UX
- Dark and Light theme toggle (preference saved)
- Sidebar navigation on desktop
- **Mobile bottom navigation bar** (Home, Teams, Deadlines, Calendar, Contact)
- Slide-in sidebar overlay on mobile
- Sheet-style modals (slide up from bottom on mobile, centered on desktop)
- Responsive across all screen sizes

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| Authentication | Firebase Authentication (Email/Password + Google OAuth) |
| Database | Cloud Firestore |
| Hosting | Netlify (static) |
| Fonts | Google Fonts — Syne, DM Sans |

No frameworks, no build tools, no npm. Open `index.html` in a browser and it runs.

---

## Project Structure

```
mentorboard/
├── index.html      — All HTML structure and modals
├── style.css       — All styles (dark/light theme, responsive)
├── app.js          — All application logic (auth, Firebase, CRUD, rendering)
└── README.md       — This file
```

---

## Getting Started

### Run Locally

1. Clone or download this repository
2. Open `index.html` directly in a browser

   > In demo mode (no Firebase configured), you can sign up with any email and the data is saved in `localStorage`.

3. For full multi-user functionality, complete the [Firebase Setup](#firebase-setup) below.

---

## Firebase Setup

### Step 1 — Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → give it a name → Create
3. Once created, click **Add app → Web app `</>`**
4. Register the app (give it any nickname)
5. Copy the `firebaseConfig` object shown

### Step 2 — Paste Config into app.js

Open `app.js` and replace the `FIREBASE_CONFIG` object at the top:

```javascript
const FIREBASE_CONFIG = {
  apiKey:            "your-api-key",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project-id",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId:             "your-app-id"
};
```

### Step 3 — Enable Authentication

1. Firebase Console → **Build → Authentication → Get started**
2. Under **Sign-in method**, enable:
   - **Email/Password**
   - **Google** (set a support email when prompted)

### Step 4 — Enable Firestore Database

1. Firebase Console → **Build → Firestore Database → Create database**
2. Choose **Start in production mode**
3. Select a region close to your users (e.g. `asia-south1` for India)
4. Paste the [security rules](#firestore-security-rules) below

### Step 5 — Add Authorised Domains

Firebase blocks OAuth (Google sign-in) on unrecognised domains. Add yours:

1. Firebase Console → **Authentication → Settings → Authorised domains**
2. Click **Add domain** for each environment:

| Environment | Domain to add |
|---|---|
| Local development | `localhost` |
| Netlify deployment | `yoursite.netlify.app` |
| Custom domain | `yourdomain.com` |

> Email/Password login does not require this step — only Google sign-in does.

---


## Firestore Security Rules

Paste these rules in **Firebase Console → Firestore → Rules** and click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null
        && request.auth.uid == userId;
    }
  }
}
```

This ensures each faculty can only read and write their own data. No faculty can access another's records — enforced at the database level.

---

## Deployment

### Deploy to Netlify (Free)

**Option A — Drag and Drop (easiest)**

1. Go to [netlify.com](https://netlify.com) and sign up / log in
2. From your dashboard, drag the entire project folder onto the page
3. Netlify gives you a live URL instantly (e.g. `yoursite.netlify.app`)

**Option B — GitHub + Netlify (recommended for updates)**

1. Push your project to a GitHub repository
2. Go to Netlify → **Add new site → Import from Git**
3. Connect your GitHub account and select the repository
4. Leave build settings blank (no build command needed — it's static)
5. Click **Deploy site**

After deploying, remember to add your Netlify URL to **Firebase → Authorised domains**.

---

## FAQ

**Can any person on the internet create an account?**
Yes, by default. If you want to restrict access to specific email addresses only, consider adding an email whitelist check in the `handleSignup()` function in `app.js`.

**Is the data shared between faculty members?**
No. Each faculty's teams, deadlines, and settings are stored under their own Firebase `uid` and cannot be accessed by anyone else — this is enforced by both the app logic and the Firestore security rules.

**What happens if I use Google sign-in and my colleague uses email/password?**
They are treated as two completely separate accounts. Each has their own isolated data. The sign-in method used does not affect how data is stored or accessed.

**Does this work offline?**
Partial. The UI loads without internet, but reading and writing data requires a connection to Firebase. Firestore does have built-in offline caching — recent data may still be visible if the connection drops briefly.

**Can I use this without Firebase?**
Yes. Without a Firebase config, the app runs in demo mode — accounts and data are stored in `localStorage` in the browser. This is single-device only and data is lost if the browser cache is cleared.

**Is it really free to host?**
Yes. Netlify's free tier handles hosting. Firebase's free Spark plan covers Authentication and Firestore at limits far beyond what a faculty managing a handful of teams would ever hit (50,000 reads/day, 20,000 writes/day).

---

## Contact

Built and maintained by **Soham**

| | |
|---|---|
| Email | sohamsutar2204@gmail.com |
| LinkedIn | [linkedin.com/in/soham-sutar](www.linkedin.com/in/soham-sutar-b6664b291) |

---

> MentorBoard is a static web application — no server required, no maintenance overhead. Just deploy and use.