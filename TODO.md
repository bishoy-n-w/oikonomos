# Oikonomos Application Backlog & Roadmap

This todo list outlines planned enhancements, features, and technical tasks for Oikonomos, categorized by priority and phase. 

---

## 🟥 Phase 1: Security & Compliance (High Priority)
- [TODO] **Email Domain Whitelisting:** Enforce a sign-in filter (e.g., in a Firebase Auth Blocking Cloud Function) that only permits specific email domains or pre-approved lists to authenticate, preventing arbitrary `@gmail.com` registrations.
- [IGNORE] **Time-To-Live (TTL) Policies:** Enable TTL rules in Firestore on `versions` and old attendance events to automatically purge child data after they graduate out of the Sunday School age bracket (complying with COPPA/GDPR minor-privacy regulations).
- [TODO] **Automated Integration Tests:** Write widget and integration tests for the `BootstrapGuard` to verify that uninitialized database deployments always secure themselves correctly.

---

## 🟨 Phase 2: User Experience Polish (Medium Priority)
- [TODO] **🌓 Dark Mode Toggle:** Integrate a theme switcher inside the `MainShell` sidebar using a stateful `ThemeMode` builder to easily switch between light and dark modes.
- [TODO] **🖼️ Profile Picture Uploads:** Binds Firebase Storage to the Kids Profile form, letting teachers upload or snap photos of children to display next to their name in the Attendance and Directory lists. The system should handle image compression and resizing for optimal performance and storage saving in database.
- [TODO] **🔍 Advanced Filtering & Search:** Add inline search bars and tag filters (by Grade, Gender, or Status) on the Kids and Servants directories.

---

## 🟩 Phase 3: Features & Analytics (Feature Expansion)
- [TODO] **📊 Visual Attendance Charts:** Integrate the `fl_chart` package to render beautiful, interactive analytics graphs on the `DashboardScreen` showing attendance rate over time.
- [TODO] **📥 CSV/Excel Data Export:** Add a "Download Roster" action on class and directory views, allowing coordinators to export clean spreadsheet reports (`.csv`/`.xlsx`) for offline archive or printing.
- [TODO] **🔔 Home Visit Reminders:** Automatically detect which children have not received a pastoral home visit in the last 60 days and highlight them on the Dashboard as "Overdue for Care."
- [TODO] **📧 Email Notifications:** Trigger automated email summary notifications to teachers when a new attendance event is logged or when they are assigned to a new Class group.

---

## 🟦 Phase 4: Localization & Scaling (Long-Term)
- [TODO] **🌍 Internationalization (i18n):** Implement Flutter’s standard localization framework to easily translate Oikonomos’s interface into **Arabic**, **English**, or **French** dynamically.
- [TODO] **📱 Native Responsive Shell:** Adapt the `MainShell` to seamlessly switch from a desktop `NavigationRail` sidebar to a mobile `NavigationBar` bottom tab when the screen width drops below 600px.

---

### 💡 Contributing
If you are running a fork of Oikonomos, feel free to pick up any of these tasks! Mark your pull request with the corresponding checkbox reference.
