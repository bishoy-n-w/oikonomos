# Oikonomos: Sunday School Admin & CRM

Oikonomos (Greek: *steward* or *household manager*) is a modern, responsive, and task-oriented administrative web application designed to help Sunday School coordinators and servants organize records, directories, attendance, and student pastoral care across mobile and desktop.

---

## 🌟 Key Features

- **Responsive Dual-Mode UX:** Desktop high-density data tables and mobile touch-friendly cards with quick shortcuts (Call Father, Call Mother, WhatsApp, GPS Navigation). Built with `viewport-fit=cover`, dynamic viewport heights (`dvh`), and safe-area insets (`env(safe-area-inset-bottom)`).
- **Google Contacts Cloud Sync:** Synchronizes Sunday School student and parent contact numbers directly to your connected Google Account via the Google People API, making them immediately accessible in your phone's native dialer and WhatsApp.
- **4-Tier Cascading Filter:** Global Church ➔ Academic Year ➔ Service Group ➔ Class context filtering with dynamic context badges in the mobile app bar.
- **Smart Data Import & 1-Click Rollback:** Excel and CSV student onboarding with automatic header mapping, Arabic encoding auto-detection (UTF-8 vs. Windows-1256 ANSI), and safe batch rollbacks.
- **Role-Based Access Control:** Real-time authorization gating (Owner, Church Admin, Group Admin, Class Servant, Viewer) with self-service field locking.
- **Gamified Attendance Tracker:** 3-state tactile controller (Present / Absent / Excused) with live metrics, unrecorded tracking, instant absence follow-up shortcuts, and debounced auto-save.
- **Pastoral Care & Home Visits:** 30/60-day visitation health tracking, cross-platform turn-by-turn navigation (Apple Maps / Google Maps), and location pinning.
- **OWASP A03 Security Defense:** Automatic formula injection sanitization on all exported spreadsheets.
- **Bilingual (English / Arabic RTL):** Full 180° right-to-left layout mirroring and localization.
- **Light & Dark Mode:** Material teal aesthetic with instant theme switching.
- **PWA Ready:** Installable directly to home screens on iOS and Android.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 19 (`react`, `react-dom` v19.2.x) |
| **Language** | TypeScript (~6.0) |
| **Build Tool & Bundler** | Vite 8 (`@vitejs/plugin-react`) with Rollup vendor chunking |
| **Styling & Icons** | Tailwind CSS v4 (`@tailwindcss/vite`), Lucide React (`lucide-react`) |
| **Backend & Auth** | Firebase (v13.x) — Cloud Firestore, Firebase Authentication (Google OAuth 2.0) |
| **External APIs** | Google People API (Google Contacts synchronization) |
| **Data Processing** | SheetJS / XLSX (`xlsx` v0.18.x) |
| **Linter** | Oxlint (`oxlint` v1.81.x) |
| **Testing Framework** | Vitest (v5.x), React Testing Library (`@testing-library/react`), jsdom |
| **CI/CD & Deployment** | GitHub Actions, GitHub Pages (SPA deployment workflow) |

---

## 💻 Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/oikonomos.git
   cd oikonomos
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file by copying the example template:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Firebase project credentials from the [Firebase Console](https://console.firebase.google.com/):
   ```ini
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

5. **Run static analysis (linter):**
   ```bash
   npm run lint
   ```

6. **Run automated test suites:**
   ```bash
   npm test
   ```

7. **Build production bundle:**
   ```bash
   npm run build
   ```

---

## 🚀 Automated GitHub Pages Deployment

Pushing to the `main` branch triggers `.github/workflows/deploy_web.yml` which:
1. Installs clean dependencies via `npm ci`.
2. Automatically extracts web Firebase config from your existing `FIREBASE_OPTIONS_DART` secret into `.env.local`.
3. Runs Oxlint static code analysis (`npm run lint`).
4. Runs automated Vitest test suites (`npm test`).
5. Builds the production bundle with code-split vendor chunks (`dist/assets/vendor-*.js`, `firebase-*.js`, `xlsx-*.js`, `icons-*.js`).
6. Deploys the static site to GitHub Pages with 404 SPA fallback routing.

> **Note:** Ensure your GitHub Pages domain (`<username>.github.io`) is listed in **Firebase Console ➔ Authentication ➔ Settings ➔ Authorized Domains**.
