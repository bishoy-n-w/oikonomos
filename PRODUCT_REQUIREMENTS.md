# Oikonomos Sunday School CRM - Product Requirements Document (PRD)

This document serves as the absolute architectural blueprint and behavioral specification reference for the **Oikonomos Sunday School Administration Platform**. It consolidates every product requirement, visual standard, real-time validation rule, and self-service security workflow implemented in the system.

---

## 1. Core Visual & Platform Behaviors

### 🔐 A. Implicit Document ID Management
*   **Behavior:** Manual, user-facing input fields for Firebase Document IDs are permanently disabled and hidden from all creation and edit form windows.
*   **Implementation:** The code automatically generates secure, random 20-character alphanumeric UIDs (via Firestore auto-IDs) or maps keys strictly to verified, unique natural identifiers (such as Email for Servants, and Full Name for Kids). This eliminates key collisions and UX friction.

### 🌐 B. Language Selector & Arabic RTL Mirroring
*   **Behavior:** The application supports English and Arabic.
*   **Real-time State Update:** Toggling the language instantly translates all navigation labels, metrics, tabular columns, form fields, validation guidelines, and action buttons. 
*   **RTL Transformation:** Toggling to Arabic flips the global visual axis 180 degrees (Right-to-Left orientation), mirroring sidebars, icons, input fields, navigation flows, and DataTable rows cleanly across all clients.

### 🎨 C. Dynamic Dark Theme System
*   **Visual Standard:** Both light and dark themes are seeded with a modern, high-fidelity teal color palette (`Colors.teal`) using Material 3 specifications.
*   **Persistence:** Theme preferences are stored in the browser's native local storage and loaded synchronously.

### 👥 D. Google-Style Multi-Account Session Switcher
*   **Behavior:** The generic, single-action sign-out button is replaced with a polished, circular User Profile Avatar in the top-right of the AppBar.
*   **The Profile Menu:** Clicking the avatar opens a material dropdown menu containing:
    *   The logged-in user's profile picture, full name, and verified email address.
    *   **Theme Toggle:** Seamlessly switches light/dark modes.
    *   **Language Toggle:** Switches English/Arabic.
    *   **Switch Account:** Invokes Google's native Account Chooser popup with `prompt: 'select_account'` parameters. This allows users to switch between signed-in browser accounts or click *"Use another account"* in one click.
    *   **Sign Out:** Log out of the current Google Firebase session (with a safety confirmation dialog).       

### ⚙️ E. Sidebar Promotion & Settings Tab Removal
*   **Behavior:** The legacy, cluttered "Settings" tab has been completely removed.
*   **Flat Architecture:** All individual administrative and configuration directories are promoted directly to the primary sidebar `NavigationRail` as top-level options, creating a spacious and direct administrative workflow:
    1.  **Dashboard** (Quick tasks, metric counters, and admin notifications)
    2.  **Kids Directory** (Tabular CRM student roster)
    3.  **Servants Directory** (Tabular servant management console)
    4.  **Attendance Tracker** (Lesson logs)
    5.  **Classes** (Classroom DataTable list & Dialog config)
    6.  **Service Groups** (Pastoral departments)
    7.  **Home Visits** (Pastoral visitation logs)
    8.  **Church Admin** (Church timeline and core admin configs)

### 📋 F. Global Text Selection & Copying
*   **Behavior:** All text fields, data rows, metrics, and profiles on the website are fully selectable and copyable by administrators.
*   **Implementation:** The entire authenticated homepage tree is wrapped inside a Flutter **`SelectionArea`** widget, allowing coordinators to highlight and copy student names, parent emails, addresses, or dashboard metrics with native system convenience.

### 🎛️ G. Global Cascading Navigation Filters
*   **Behavior:** The top-right of the app layout features a persistent set of 4 selection dropdowns that dictate the active context for all views.
*   **Filter Order:** **Church ➡️ Academic Year ➡️ Service Group ➔ Class**
*   **Cascading Logic:** Selections filter subsequent dropdowns (e.g., selecting a Church filters the available Academic Years and Service Groups to only those belonging to the selected Church).
*   **Distinct Sizing Hierarchy:** 
    1.  **Church Dropdown (Largest/Anchor):** Unique asymmetric corner rounded shape, solid vibrant primary background color, extra bold formatting (`FontWeight.w800`), increased horizontal padding (`18`), and an elevation drop shadow.
    2.  **Academic Year Dropdown (2nd in size):** Medium asymmetric shape, semi-translucent background (`0.6` opacity), and medium padding (`15`), establishing an intuitive visual hierarchy.
    3.  **Service Group & Class Dropdowns (Standard):** Classic symmetrical pill containers (`BorderRadius.circular(20)`), soft translucent background (`0.3` opacity), and standard padding (`12`).
*   **"All" Option:** Users can select "All" for Service Group and Class filters to view aggregate data. 
*   **"All" Restriction:** The root **Church** and **Academic Year** dropdowns strictly **disallow** the "All" option (`allowAll: false`). This guarantees a single, stable Church and active Term context across the application at all times.
*   **Active Year Default:** On initial load or refresh, the Academic Year dropdown is strictly bound and defaults to the Church's active year.

---

## 2. Church Admin & Timeline View (`ChurchesScreen`)

The "Church Admin" panel enables global owners and authorized church admins to configure core tenants, academic timelines, and church-wide grade schemas.

### 🏛️ A. Details List View (DataTable)
Displays registered churches in a clean grid with columns in order:
1.  **Status (Active / Inactive Icon):** Colored indicators showing if the tenant is active.
2.  **Church Name (`displayName`):** Real name of the church.
3.  **Active Academic Year (`displayName`):** Resolves and displays the real-time term display name instead of the raw year ID.
4.  **Grades (Count action-chip):** Displays only the sum number of grades configured (e.g., "5 Grades"). Clicking it opens the popup Grades Mapping popup.
5.  **Actions (Edit / Delete Icons):** Group of icons at the end of the row.

### 🔍 B. Header Filtering Matrix
Each column header in the Churches DataTable hosts local filters built directly inside the table header layout: 
*   **Status Column Header:** A popup menu offering status filters (`All Statuses`, `Active Only`, `Inactive Only`).
*   **Church Name Column Header:** An inline search text field inside the column label to filter matching church display names instantly on keypress.
*   **Active Year Column Header:** A dropdown mapping unique, resolved active year display names to filter the rows live on selection.

### 📊 C. Grades & Service Group Mapping Popup
Pressing on the Grades ActionChip launches a stateful configuration panel:
*   **Auto-Incrementing Integer Keys:** Integer values start at `1` and sequentially increment when the user adds a new grade line (no manual input is permitted, preventing ID collisions). Deleting a line automatically shifts and re-indexes remaining grades sequentially.
*   **Name:** A free-text field (e.g., `Grade 1`, `High School Junior`).
*   **Service Group Dropdown:** A dropdown selector mapping each grade to an available Service Group in that church.
*   **Duplicate Assignments Allowed:** Multiple grades can map to the same Service Group (e.g., `Grade 7` and `Grade 8` both point to `Junior High Department`).

### 📝 D. Church Onboarding & Edit Modals
*   **Onboarding Church Wizard:** Creating a new church mandates setting `displayName`, `active` status, and **adding at least one Academic Year** (timeline label and start Month/Year picker, set to active by default), creating them transactionally as a single atomic batch.
*   **Church Edit Dialog:** Provides forms to update the name and active status of the church.
    *   *Grades Map Tile:* Shows the sum count of grades and clicking it launches the Grades Mapping Popup.
    *   *In-place Academic Years List:* Displays all registered timeline terms at the bottom of the edit dialog.
        *   *Active Switch:* Toggling a year active automatically disables all other terms inside that church document.
        *   *Edit inline:* Clicking the edit icon opens an inline form to update the term's label and start date.
        *   *Add Academic Year:* Allows adding a new year (label and Month/Year picker).
        *   *Delete Year Constraints:* Supports deleting years, subject to constraints:
            *   *At least one year:* Blocked if it's the last registered term.
            *   *At least one active:* Blocked if it is currently set active.
            *   *Class Reference check:* The system queries the `classes` collection. If the year ID is referenced inside any class document's `academicYears` map, deletion is blocked with a warning: *"Cannot delete. This Academic Year is referenced inside active Class configurations."*

### 🗑️ E. Deletion Confirmation Popup
Clicking the Delete icon next to any Church row pops a modal: *"Delete Church? This will delete the church tenant. This action is permanent."* Confirmation permanently deletes the document and all nested collections.

---

## 3. Service Groups View (`ServiceGroupsScreen`)

The Service Groups screen manages pastoral departments (e.g., Elementary, High School) within the active Church.

### 🏷️ A. Details List View (DataTable)
Displays service groups in a clean grid with columns in order:
1.  **Status (Active / Inactive Icon):** Colored indicators.
2.  **Group Name (`displayName`):** Department label.
3.  **Admins (Stacked list):** Displays the names of all assigned coordinators stacked together.
4.  **Servants (Total Count):** Displays the sum number of active teachers assigned to the group.
5.  **Assigned Grades:** Inverse-reads the church's main `grades` map, collects all grades where `serviceGroupId == thisGroupId`, and displays them neatly as visual chips.
6.  **Actions (Edit / Delete Icons):** Located at the end of the row.

### 🔍 B. Header Filtering Matrix
Supports local filtering per value inside the column headers:
*   **Status Column Header:** Popup menu (`All Statuses`, `Active Only`, `Inactive Only`).
*   **Group Name Column Header:** Inline search field to filter group names on keypress.
*   **Admins Column Header:** Inline search field to filter service groups by assigned admin names/emails.
*   **Assigned Grades Column Header:** Dropdown menu mapping all unique assigned grade names to filter the rows.

### 🗑️ C. Deletion Confirmation Popup
Clicking the Delete icon next to any Service Group row pops a modal: *"Delete Service Group? This will delete the service group. This action is permanent."* Deleting a group removes the document from Firestore.

### 📝 D. Service Group Onboarding & Edit Modals
*   **Onboarding Service Group:** Auto-selects and binds the group to the currently active Church in your top-right filter. If "All" is active, it prompts the user to select one. It mandates setting `displayName` and `active` status.
*   **Group Edit Dialog:** Updates group name and active status.
    *   *Admins & Servants Chip Management:* Displays assigned admins and servants as chips showing their **full display name** instead of raw emails. Clicking the `'x'` delete icon instantly removes them from that role in this group.
    *   *"+" Servant Selector popup:* Clicking `+` next to Admins or Servants launches a multi-select search-and-select grid:
        *   Displays all active church servants, showing their **displayName**, email, and list of **all currently assigned Service Groups** (supporting multi-group assignments).
        *   Includes search fields to filter by Name and by Group.
        *   Checkbox list tile is only blocked/disabled if the servant *already* holds that exact role in this specific group. If they have a different role or no role, they are fully selectable. Clicking apply adds them to the target role.

---

## 4. Kids Directory CRM View (`KidsDirectoryScreen`)

The Kids Directory manages tabular student registries with an advanced collapsible layout suited for high-density visual tracking.

### 🎨 A. Details List View (DataTable) with Collapsible Column Groups
Displays extensive student sheets (over 20 fields) neatly. The columns list is grouped into **5 logical categories** which can be folded or unfolded independently inside the headers:
1.  **Active Status (Always Visible):** Colored active indicator.
2.  **Assignment Group:** Selected Year, Group, and Class. *Folded preview:* Merged string representation (e.g. `2026 • Elementary • Grade 5`).
3.  **General Profile Group (`info` map):** `fullName`, `gender`, `dob`, `school`, `fatherOfConfession`. *Folded preview:* Shows name as a clickable hyperlink.
4.  **Home Address Group (`address` map):** `street`, `building`, `floor`, `apartment`, `region`. *Folded preview:* Displays region area. (Collapsed/Folded by default).
5.  **Family Contacts Group (`contacts` map):** `kidMob`, `fatherName`, `fatherProfession`, `fatherMob`, `motherName`, `motherProfession`, `motherMob`, `otherMob`. *Folded preview:* Shows main father and mother numbers. (Collapsed/Folded by default).
6.  **Pastoral Notes:** Displays Multiline notes. *Folded preview:* Shows a truncated text snippet.

### 🔍 B. Header Filtering Matrix & Deletion Popups
*   **Matrix Filters:** Every visible active column head contains a dedicated filter popup menu (for status, gender, region, job) or inline search field (for name, phone, school) matching its data type.
*   **Delete Icon & Dialog:** Triggers a popup: *"Delete Student? Are you sure you want to delete 'fullName'? This cannot be undone."* deletes the document and updates classes collections.

### 🔐 C. Secure Role-Based Access Controls
Editing permissions are evaluated dynamically for each student row:
*   **Who can edit:** Church Admins, Group Admins (matching the student's assigned group ID), and Class Teachers (matching the student's assigned active class ID) can edit.
*   **Who can view:** All other servants in the church have strict **Read Only** access.

---

## 5. Classes View (`ClassesScreen`)

The Classes screen manages classroom assignments and student-servant mappings within terms.

### 🏷️ A. Details List View (DataTable)
Displays active classroom directories in order:
1.  **Status:** Active indicator.
2.  **Class Name:** Dynamic class name resolved for the selected term.
3.  **Service Group:** Resolved group display name.
4.  **Grade Level:** Resolved grade display name.
5.  **Enrolled Kids:** Sum count of student IDs in the list.
6.  **Assigned Servants:** Sum count of assigned servants in the list.
7.  **Actions:** Edit / Delete.

### 🔍 B. Header Filtering Matrix & Actions
*   **Column Matrix Filters:** Includes Status popup, Name inline search, Service Group dropdown, and Grade Level dropdown in column headers.
*   **Filters Dimming:** Dims the **Class** global top-bar dropdown while on this tab, keeping Church, Year, and Group fully applicable.
*   **Edit / Delete Modals:** Form dialog maps:
    *   *Dynamic Grade Dropdown:* Filters dynamically based on selected Service Group.
    *   *Servants popup selector:* Restricts select list to servants mapped inside the selected Service Group's misters list, displaying name, groups, and classes.
    *   *Kids popup selector:* Pulls active church kids, displaying current assigned groups and classes.

---

## 6. Servants Directory View (`MistersDirectoryScreen`)

The Servants Directory manages servants access profiles and personal details.

### 🏛️ A. Details List View (DataTable)
Displays registered servants in order:
1.  **Status:** Active status icon.
2.  **Full Name:** Display name.
3.  **Access Role:** Mapped to `'admin'` or `'viewer'`.
4.  **Admin in Groups:** Stacked list of groups they manage.
5.  **Servant in Groups:** Stacked list of groups they serve.
6.  **Servant in Classes:** Stacked list of active classrooms they serve.
7.  **Email / Phone / Date of Birth / Job / Address:** Detailed personal tracing fields.

### 🔍 B. Header Filtering Matrix & Self-Service Locks
*   **Filters Matrix:** Includes status dropdown, name search, access role dropdown, phone search, job selector, and address search filters inside column headers.
*   **Self-Service Fields Lock:** If a regular servant is editing their *own* profile, the `active` status switch and `churchRole` dropdown are **automatically locked and greyed out** (opacity `0.5`). They can only modify their personal fields (`phone`, `dob`, `job`, `address`, `notes`, `gender`).
*   **Self-Service Cloud Rules (`firestore.rules`):** Evaluates `request.resource.data.diff(resource.data).affectedKeys()` to securely block self-service updates trying to modify any field other than `personalInfo`.

---

## 7. Operational & Database Integrity Lifecycle

To preserve relational history and database integrity, no records are physically deleted from day-to-day administrative tables. Setting `active: false` archives the object:

| Entity / Object | `active: false` Behavioral Impact & Functionality |
| :--- | :--- |
| **`churches`** | Global multi-tenancy lock. Setting to `false` blocks all read/write accesses to this church. Teachers and admins are locked out. |
| **`misters`** | Real-time session termination. Security rules block access instantly, preventing them from viewing child PII. However, **their names are preserved on past attendance sheets** for historical accuracy. |     
| **`serviceGroups`** | Hides the department from active dropdown selectors, preventing coordinators from assigning new classes to it while preserving student/teacher assignment logs. |
| **`kids`** | Active classroom roster filter. Inactive children are archived, **instantly disappearing from weekly Attendance sheets**. They can still be viewed inside archives. |
| **`classes`** | Classroom lifecycle management. Inactive classes are hidden from current assignments, preventing enrollment errors while preserving history. |
| **`academicYears`** | Default viewport binding. Marking a year `active: true` establishes it as the current active term. The dashboard top bar reads this configuration to automatically filter and display classes and visitations for that specific term by default. |

---

## 8. Automated Testing Validation Guidelines

The platform enforces a mandatory automated validation policy. Every core mechanism must possess a corresponding unit or widget test verified on the native VM runner before shipping:

1.  **Translation lookups:** English and Arabic lookup verification.
2.  **RTL layout calculations:** State validations for text direction resolution.
3.  **Dynamic theme triggers:** Caching state toggles.
4.  **E.164 phone formats:** Tests for leading-zero stripping, missing dial code defaulting, and dial code prefixing.
5.  **Simplified timelines:** Month-Year calendar term checks.
6.  **Self-Service role transitions:** Onboarding payload state tests.
7.  **Platform storage stubs:** VM safety checks.
8.  **Church Year Deletion Integrity Checks:** Blocks year deletion if referenced in classes.
9.  **Kids Foldable Columns & Expansion Layouts:** Sizing recalculations based on toggled header states.
10. **Classes Dynamic Grade Bindings:** Restricts grade dropdown configurations based on selected service group dynamically.

---

## 9. Responsive Dual-Mode UI Specifications (Web Application)

The web application adapts seamlessly between desktop and mobile devices via standard DOM, CSS logical properties, and responsive layout breakpoints.

### 📱 A. Viewport Breakpoints & Core Architecture
*   **Desktop Viewport (`>= 1024px`):** Persistent collapsible sidebar navigation, high-density multi-column data tables, floating modal dialogs, and a persistent horizontal cascading filter toolbar.
*   **Tablet Viewport (`768px - 1023px`):** Collapsed icon-only sidebar or slide-over drawer, horizontally scrollable data tables with sticky freeze columns.
*   **Mobile Viewport (`< 768px`):** 
    *   **Navigation:** Floating bottom navigation bar for primary daily flows (Dashboard, Attendance, Kids, Visits) plus a slide-over drawer for administrative metadata configurations.
    *   **Global Filters:** Replaced with a compact, sticky contextual "Filter" pill chip that opens an accessible modal Bottom Sheet.
    *   **Data Layout:** Multi-column tables automatically transform into touch-friendly **Adaptive Card Lists**, highlighting child name, avatar, contact shortcuts, and status.

### 🌐 B. RTL & Localization Architecture
*   Arabic language toggling applies HTML `dir="rtl"` dynamically.
*   All layouts use CSS logical properties (`margin-inline-start`, `padding-inline-end`, `border-inline-start`), eliminating manual coordinate recalculations and ensuring 100% natural mirror animations.

---

## 10. Google Contacts Cloud Synchronization

Enables Sunday School servants and administrators to synchronize church contact records directly to their connected Google Account without requiring an installed native mobile app.

### 🔄 A. Synchronization Scope & Permissions
*   **OAuth Scopes:** Requests incremental consent for `https://www.googleapis.com/auth/contacts` upon invoking the sync feature.
*   **Target Grouping:** Creates/updates a dedicated Google Contact Group / Label formatted as: `[Oikonomos] <Church Name> - <Class Name> (<Year>)`.

### 👥 B. Contact Schema Mapping
*   **Display Name:** `[SS] <Kid Full Name>` (with parent names tagged in phonetic/nickname notes).
*   **Phone Numbers:** Formatted strictly in E.164 standard. Father mobile labeled as `Father`, Mother mobile labeled as `Mother`, Kid mobile labeled as `Mobile`.
*   **Job & Organization:** Set to Church Name and Sunday School Class title.
*   **Idempotency & Deduplication:** Checks existing contacts within the designated Oikonomos label by matching normalized phone numbers or stored external IDs, updating records rather than generating duplicates.

---

## 11. Progressive Web App (PWA) & Offline Integration

*   **Web App Manifest:** Configured for `display: "standalone"`, branding with primary teal colors, and responsive adaptive icon sets.
*   **Service Worker:** Caches application shell, translations, and static assets for instant load and offline session warnings.

