# MentorBoard — Teams Management System


## 📋 Features

| Feature | Description |
|---|---|
| **Auth** | Secure mentor login (Firebase) |
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


## 📁 File Structure

```
teams-management/
├── index.html    — App structure & all HTML
├── style.css     — All styles (dark/light theme)
├── app.js        — All logic (auth, CRUD, Firebase)
└── README.md     — This file
```
