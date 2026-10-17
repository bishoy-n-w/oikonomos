# Oikonomos: Sunday School Admin

Oikonomos (Greek: *steward* or *household manager*) is a modern, responsive, and task-oriented administrative web application designed to help Sunday School coordinators and servants organize records, directories, attendance, and student pastoral care across mobile and desktop.

---

## Features
- **Responsive Dual-Mode UX:** Desktop high-density data tables and mobile touch-friendly cards with quick shortcuts (Call Father, Call Mother, WhatsApp).
- **Google Contacts Cloud Sync:** Synchronizes Sunday School student and parent contact numbers directly to your connected Google Account via the Google People API, making them immediately accessible in your phone's native dialer and WhatsApp.
- **4-Tier Cascading Filter:** Global Church ➔ Academic Year ➔ Service Group ➔ Class context filtering.
- **Role-Based Access Control:** Real-time authorization gating with self-service field locking.
- **Gamified Attendance Tracker:** 3-state touch controller (Present / Absent / Excused) with live metrics.
- **Bilingual (English / Arabic RTL):** Full right-to-left layout mirroring and localization.
- **Light & Dark Mode:** Material teal aesthetic with instant theme switching.
- **PWA Ready:** Installable directly to home screens on iOS and Android.

---

## Tech Stack
- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide React
- **Backend / Database:** Firebase Authentication (OAuth 2.0 Google Sign-In) & Cloud Firestore
- **Testing:** Vitest & React Testing Library
- **Deployment:** GitHub Pages (Automated CI/CD via GitHub Actions)

---

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

3. **Run tests:**
   ```bash
   npm test
   ```

4. **Build production bundle:**
   ```bash
   npm run build
   ```

---

## Automated GitHub Pages Deployment

Pushing to the `main` branch triggers `.github/workflows/deploy_web.yml` which:
1. Runs automated Vitest test suites.
2. Extracts your existing `FIREBASE_OPTIONS_DART` secret automatically into `.env.local`.
3. Builds the production bundle with `/oikonomos/` base path.
4. Deploys the static site to GitHub Pages with 404 SPA fallback routing.

> **Note:** Ensure your GitHub Pages domain (`<username>.github.io`) is listed in **Firebase Console ➔ Authentication ➔ Settings ➔ Authorized Domains**.
