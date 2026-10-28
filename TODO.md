# Oikonomos Application Roadmap & Engineering Backlog

This backlog outlines completed milestones and forward-looking engineering initiatives for **Oikonomos (Sunday School Admin & CRM)**.

---

## ✅ Completed Milestones

### 📱 Phase 1: Responsive Dual-Mode UI/UX Overhaul
- [x] **Viewport & Notch Avoidance:** Modernized viewport with `viewport-fit=cover`, dynamic viewport heights (`dvh`), and safe-area inset bottom padding (`env(safe-area-inset-bottom)`).
- [x] **Touch Target Compliance (Apple HIG & WCAG 2.5.5 / 2.5.8):** Enforced $\ge 44\times 44$px interactive hit targets on mobile (attendance 3-state pills, WhatsApp/call shortcuts, navigation tabs) while maintaining high-density desktop mouse sizing.
- [x] **Mobile Adaptive Touch Cards:** Replaced wide 7–12 column tables on mobile with touch-friendly adaptive cards for the Servants Directory and Classes Management screens.
- [x] **Categorized Mobile Navigation:** Transformed 5th mobile tab to a streamlined "More" drawer categorized into Pastoral Care and Administration.
- [x] **Active Context Visibility:** Added dynamic active Class / Service Group badges to the mobile filter chip in TopAppBar.
- [x] **Accessibility (WCAG 2.1 SC 1.4.4):** Restored pinch-to-zoom scaling and prevented iOS Safari form auto-zoom via responsive input sizing.

### 🛡️ Phase 2: Code Health & Data Integrity Remediation
- [x] **Firestore Subscription Lifecycle:** Fixed nested subcollection listener memory leaks in `ChurchesScreen` using tracked `unsubNested` disposal.
- [x] **Asynchronous Concurrency:** Replaced un-awaited `forEach(async ...)` loops with `await Promise.all(...)` during bulk deletions.
- [x] **Debounce & Unmount Hygiene:** Hardened the 900ms attendance auto-save engine with `isMountedRef` and unmount timer cancellation.
- [x] **Class Roster Reconciliation:** Atomically pruned reassigned and reverted student IDs from old classroom rosters during bulk assignments and import batch reverts.
- [x] **Multi-Tenant State Isolation:** Added explicit state array resets on tenant switches across all directory and management views.
- [x] **Defensive Null-Safety:** Applied optional chaining across all dynamic user profile attributes.

### 🧪 Phase 3: QA Architecture & Security Expansion
- [x] **OWASP A03 Formula Injection Defense:** Hardened `sanitizeExcelCell` to neutralize leading `=`, `+`, `-`, `@`, `\t`, `\r` trigger prefixes across all CSV/Excel exports.
- [x] **LIFO Modal Escape Stack:** Verified nested modal dismissal ordering and cleanup via `useModalEscape`.
- [x] **Attendance Statistics & Ranking Engine:** Validated `topAttendees`, `lowestAttendees`, and core-only consecutive absence evaluations.
- [x] **Multi-Format Date Normalization:** Validated `normalizeDateStr` across native Dates, Firestore Timestamps, and string formats.

---

## 🚀 Forward Roadmap & Feature Backlog

### 🟥 Priority 1: Cloud Security & Access Governance
- [ ] **Email Domain Restriction:** Implement a Firebase Auth Blocking Cloud Function to restrict sign-ins to pre-approved Google Workspace domains or an invitation whitelist.
- [ ] **Time-To-Live (TTL) Compliance Policy:** Configure Firestore TTL rules to auto-archive minor personal data and historic attendance snapshots after students graduate.
- [ ] **Automated E2E Testing Suite:** Add Playwright browser integration tests for critical multi-step flows (Excel smart import, attendance roll-call, bulk assignment).

### 🟨 Priority 2: Pastoral Communications & Push Reminders
- [ ] **PWA Web Push Notifications:** Enable Service Worker push notifications to remind servants of weekly roll-calls and overdue home visitations.
- [ ] **Bulk SMS / WhatsApp Campaign Templates:** Pre-compose announcement messages for feast liturgies, trips, and parent meetings.
- [ ] **Pastoral Visit Scheduling Calendar:** Integration with Google Calendar to schedule and track upcoming home visits directly within the app.

### 🟩 Priority 3: Offline Sync & PWA Cache Hardening
- [ ] **Persistent Firestore Offline Cache:** Enable IndexedDB offline persistence for attendance logging in church basements with weak cellular reception.
- [ ] **Background Sync:** Queue offline attendance marks and automatically sync with Firestore upon network reconnection.

### 🟦 Priority 4: Biometrics & Automated Fast Attendance
- [ ] **QR Code Badge Attendance Scanning:** Generate individual student QR identity cards and support fast multi-student camera scanning in Attendance Tracker.
- [ ] **On-Device Facial Recognition Roll-Call:** Evaluate client-side WebAssembly face detection (`face-api.js` / MediaPipe) for automated classroom check-in.
