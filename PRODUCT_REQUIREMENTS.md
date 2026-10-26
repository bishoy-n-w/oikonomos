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

### 🔗 H. Hash-Based Deep Linking & Hybrid Filter Persistence (URL & LocalStorage)
*   **Behavior:** The application supports full browser deep-linking, refresh persistence, and back/forward navigation without 404 errors on GitHub Pages or static hosts.
*   **Hash Routes Mapping:**
    *   `/#/dashboard` $\to$ Dashboard
    *   `/#/kids` $\to$ Kids Directory
    *   `/#/servants` $\to$ Servants Directory
    *   `/#/attendance` $\to$ Attendance Tracker
    *   `/#/classes` $\to$ Classes Screen
    *   `/#/service-groups` $\to$ Service Groups Screen
    *   `/#/home-visits` $\to$ Home Visits Screen
    *   `/#/church-admin` $\to$ Church Admin Screen
*   **Hybrid State Precedence Hierarchy on Load & Refresh:**
    1.  **Priority 1 (URL Parameters):** Active hash query parameters (e.g. `/#/attendance?church=c1&year=y1&group=g1&class=k1`) override local state, enabling shareable deep links and multi-tab workflows.
    2.  **Priority 2 (LocalStorage Caching):** If no URL parameters are present, the system loads the user's previously selected Church, Term, Service Group, and Class from `localStorage`.
    3.  **Priority 3 (System Defaults):** For new users, defaults to the first permitted church and its active academic year.
*   **Synchronization Lifecycle:**
    *   **Tab Switching:** Pushes a new browser history entry (`window.location.hash = ...`), enabling native browser Back and Forward navigation between screens.
    *   **Filter Toggling:** Synchronizes selections to `localStorage` and updates the URL query string using `history.replaceState`, avoiding history spam while keeping the address bar in real-time sync with user selections.

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
3.  **General Profile Group (`info` map):** `fullName`, `gender`, `dob`, `school`, `schoolType` (National, International, or Other custom), `deacon` (Yes/No), `fatherOfConfession`. *Folded preview:* Shows name as a clickable hyperlink.
4.  **Home Address Group (`address` map):** `street`, `building`, `floor`, `apartment`, `region`, `landmark`. *Folded preview:* Displays region area. (Collapsed/Folded by default).
5.  **Family Contacts Group (`contacts` map):** `kidMob`, `fatherName`, `fatherProfession`, `fatherMob`, `fatherDOB`, `motherName`, `motherProfession`, `motherMob`, `motherDOB`, `otherMob`. *Folded preview:* Shows main father and mother numbers. (Collapsed/Folded by default).
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
*   **Self-Service Cloud Rules (`firestore.rules`):** Evaluates `request.resource.data.diff(resource.data).affectedKeys()` with case-insensitive email matching. Self-service updates are strictly limited to `['personalInfo', 'displayName', 'lastEditAt', 'lastEditBy', 'email']`. Attempts to modify administrative keys (`churchRole`, `active`, `adminInGroups`, `servantInGroups`, etc.) are securely rejected at the database layer.

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

---

## 12. Kids View Fixed Full Name Column & 5-Category Collapsible Sections

*   **Permanently Visible Full Name Column:** The `info/fullName` column is fixed in visibility (cannot be hidden or folded by any category toggle). Clicking on the student's name directly opens the Edit Student modal.
*   **Column Order (22 Fields):**
    1. Active & Multi-select Checkbox
    2. Student Full Name (Fixed visibility, click-to-edit)
    3. **Assignment Group:** Academic Year, Service Group, Class
    4. **General Profile Group:** Gender, DOB, School, Father of Confession
    5. **Address Group:** Street, Building, Floor, Apartment, Region
    6. **Contacts Group:** Kid Mobile, Father Name, Father Profession, Father Mobile, Mother Name, Mother Profession, Mother Mobile, Other Mobile
    7. **Notes Group:** Pastoral Notes
    8. **Actions:** Edit & Delete
*   **Header Filtering Matrix:** Every visible column provides inline header filtering inputs matched to data type.

---

## 13. Multi-Select, Bulk Classroom Reassignment & Bulk Delete

*   **Selection Controls:** Master checkbox in the table header to select/deselect all visible filtered students, alongside per-row checkboxes.
*   **Floating Bulk Action Bar:** Appears at viewport bottom when $\ge 1$ student is selected, showing count and action triggers.
*   **Bulk Assignment Execution:** Reassigns `activeAssignment.academicYearId`, `activeAssignment.serviceGroupId`, and `activeAssignment.classId` across all selected students via atomic Firestore batch transactions.
*   **Multi-Select Bulk Delete (with Confirmation):** Administrators can delete multiple selected students at once. Clicking "Delete Selected" triggers an in-app confirmation modal displaying the exact student count and permanent deletion warning. Upon confirmation, records are atomically deleted using Firestore `writeBatch` in chunks of 400 with Approach 2 loading spinner and input freezing.

---

## 14. Smart Excel/CSV Import Engine with Hybrid AI Mapping & 1-Click Rollback

*   **File Formats:** Supports `.xlsx`, `.xls`, and `.csv`.
*   **Arabic CSV & Text File Encoding Resilience:**
    *   **Auto-Detection & Decoding Pipeline:** Automatically decodes delimited text files (`.csv`, `.tsv`, `.txt`) using native browser `TextDecoder` before parsing, eliminating mojibake corruption (e.g. `Ø£Ø³Ù ...`):
        *   Supports UTF-8 with BOM (`EF BB BF`) or without BOM.
        *   Detects UTF-16LE / UTF-16BE BOM signatures.
        *   Employs strict UTF-8 validation (`TextDecoder('utf-8', { fatal: true })`) to immediately catch legacy Arabic ANSI byte streams exported from older Windows Excel setups (*"CSV (Comma delimited)"*), automatically falling back to `windows-1256` (Arabic ANSI).
    *   **Real-Time UI Encoding Badge & Manual Override:** In Step 1 of the Import Wizard, CSV uploads display an encoding badge (`UTF-8` vs `Windows-1256 (Arabic Excel ANSI)`) alongside an on-the-fly override dropdown allowing users to switch encoding with immediate real-time table re-parsing and re-mapping.
*   **Multi-Sheet Workbook Tab Selection:** For workbooks containing multiple sheets/tabs, the importer extracts all sheets and displays an interactive tab selector with sheet names and row counts. Switching tabs dynamically loads the selected sheet, resets the header row index, and re-runs bilingual heuristic column mapping.
*   **Automated Smart Header Detection:** Scans the first 10 rows of the spreadsheet using Sunday School CRM semantic keyword scoring to detect and pre-select the true header row, automatically bypassing sheet titles, decorative banners, and blank rows.
*   **Header Row Index Selector:** Interactive preview of first 6 rows allowing the user to visually inspect and change which row contains column headers.
*   **Option 3 Hybrid AI Mapping:**
    *   **Layer 1 (Offline Heuristic):** High-speed bilingual dictionary matching Arabic (including Egyptian colloquial terms like `موبايل ولي الأمر`, `تليفون بابا`, `اسم المخدوم`) and English column headers with dedicated status badges (`✨ Auto-Mapped` vs `⚪ Ignored`).
    *   **Layer 2 (Gemini AI Enhancement):** Optional free-tier Google Gemini integration (`gemini-2.5-flash`) for deep scan disambiguation of unmapped or custom headers.
*   **Comprehensive Excel Date Normalization:** Automatically converts native JS Date instances, Excel numeric serial codes (e.g. `44197`), DD/MM/YYYY, ISO strings, and Arabic-Indic numerals (`١٥/٠٧/٢٠١٢`) into strict `YYYY-MM-DD` standard ISO date strings.
*   **Phone Normalization & Classroom Assignment:** All phone numbers auto-formatted to international E.164 (`+20...`). Safely accepts both strings and raw numbers (from Excel numeric cells where the leading `0` was omitted, e.g. `1223344556`), prefixing the default country code cleanly. Supports unmapped fallback defaults specified in Step 3. Target classroom assignment selected by user.
*   **Dynamic Unmapped Fields List with Type-Based Unified Inputs (One Value for All):** In Step 3, the wizard dynamically computes the exact list of schema fields that were **NOT** mapped to any column in the user's spreadsheet. Only unmapped fields are shown. For each unmapped field, an input corresponding to its specific data type is provided:
    *   **Select Dropdown:** for `gender` (`-- Leave Empty / فارغ --`, `All Male / كلهم بنين`, `All Female / كلهم بنات`), `deacon` (`-- Leave Empty / فارغ --`, `All Deacons / كلهم شمامسة`, `Not Deacons / مش شمامسة`), and `schoolType` (`-- Leave Empty / فارغ --`, `National`, `International`).
    *   **Native Date Picker:** for `dob` (Date of Birth), `fatherDOB` (Father DOB), and `motherDOB` (Mother DOB).
    *   **Telephone Input:** for `kidMob`, `fatherMob`, `motherMob`, `otherMob` (auto-formatted to E.164).
    *   **Text Input:** for `fatherOfConfession`, `school`, `region`, `landmark`, `street`, `building`, `floor`, `apartment`, `fatherProfession`, `motherProfession`, `notes`.
    Specifying a value automatically populates that attribute across all students imported in that batch. If all CRM fields are mapped from spreadsheet columns, the panel confirms: *"All CRM fields have been mapped from your spreadsheet columns!"*.
*   **Name & Date Collision Guards:** Heuristic mapping explicitly excludes headers containing `تاريخ`, `ميلاد`, `موبايل`, `وظيفة` from matching `fatherName` or `motherName`. Disambiguation rules prevent generic `dob` from accidentally matching parent birth dates (`fatherDOB`, `motherDOB`), and prevent generic `school` from matching `schoolType`.
*   **Detailed Post-Import Attribute Breakdown & Live Preview:** Step 4 completion report displays an attribute-by-attribute coverage matrix (Full Name, Date of Birth, Gender, Father Phone, Mother Phone, Father DOB, Mother DOB, Address, Landmark, School, School Type, Deacon, Confession Father) alongside a live sample preview table displaying the normalized student data.
*   **One-Click Batch Rollback:** All imported records are tagged with a unique `importBatchId`. The post-import completion report provides an instant **"Revert This Import"** button that atomically deletes all records from that batch in one click.

---

## 15. Modal Save Loading States, Input Freezing & Escape Dismissal

*   **Approach 2 Save Loading States:** When saving any entity across the application (Churches, Academic Years, Service Groups, Classes, Servants, Kids, Attendance, and Bulk Assignments):
    *   Form fields and action buttons are immediately disabled (`<fieldset disabled={isSaving}>`).
    *   The Save button displays an animated spinner with localized status (`Saving...` in English / `جاري الحفظ...` in Arabic).
    *   Multi-document transactions (e.g. Church + Academic Years) execute via atomic Firestore `writeBatch` in a single network round-trip.
    *   The modal automatically dismisses upon successful cloud confirmation.
*   **Global Escape Key Dismissal:** Pressing `Escape` cleanly dismisses the top-most active modal or picker without saving changes, preserving underlying parent dialogs when nested.

---

## 16. Event-Based Attendance Tracking, Hierarchical Storage & Recurring Schedules

*   **Hierarchical Scoped Data Storage:**
    *   Attendance session events (`AttendanceEvent`) are stored strictly under the Academic Year and Class:
        `churches/{churchId}/academicYears/{academicYearId}/classes/{classId}/attendanceEvents/{eventId}`.
    *   This ensures complete term-by-term and classroom data isolation, preventing crossover of session records between different school years or classrooms.
*   **Event-Centric Data Model:** Attendance is tracked by session events (`AttendanceEvent`) with:
    *   `id`: Unique eventId.
    *   `academicYearId`, `serviceGroupId`, `classId`.
    *   `title`, `type` (`Sunday School`, `Liturgy`, `Bible Study`, etc.), `eventDate` (`YYYY-MM-DD`).
    *   `takenAt` (ISO timestamp), `takenBy` (servant name/email).
    *   `statuses`: Map of `{ [kidId]: 'present' | 'absent' | 'excused' }`.
    *   `notesByKid`: Map of `{ [kidId]: 'pastoral note text' }`.
    *   `recurringSeriesId`: Shared ID linking batch-generated recurring sessions.
*   **Split-Pane Master-Detail UX (Option A):**
    *   **Left Pane:** Scheduled events list with type filters (`lesson`, `liturgy`, `hymns`, `activity`), completion status (`✅ X% Present` vs `⏳ Pending`), and `+ New Event` / `+ Recurring Schedule` action buttons.
    *   **Right Pane:** Selected event attendance logger with live 5-metric summary (Roster, Present, Absent, Excused, Attendance Rate %), student search, `"Mark All Present"` shortcut, 3-state tactile pills (Present / Absent / Excused), and per-kid expandable pastoral notes.
*   **Recurring Schedule Generator Wizard:** Generates weekly sessions across an entire term (e.g. every Sunday or Friday from October to June) via atomic Firestore `writeBatch` in a single click, with optional date exclusions for church feasts and holidays.

---

## 17. Modernized Attendance Tracker UX: Ribbon, Matrix, Auto-Save & Pastoral Alerts

*   **Horizontal Date / Session Timeline Ribbon:** Replaces the squished split-pane layout with a scrollable top timeline ribbon (`<` / `>`). Each session card displays the session date, type badge, completion status, and attendance rate, giving the student roster 100% full screen width.
*   **Dual View Mode (Checklist vs Term Matrix):**
    *   **📋 Weekly Checklist View:** High-touch, spacious student cards for running roll-call today with 3-state tactile toggles (`Present`, `Absent`, `Excused`) and expandable pastoral notes.
    *   **📊 Term Matrix Grid View:** Full-term spreadsheet-style grid (students as rows $\times$ session dates as columns) with high-density status pills (`P`, `A`, `E`) and overall attendance rate percentages, allowing servants to spot chronic absence trends at a glance. Clicking any cell toggles attendance status inline.
*   **Background Auto-Save Engine & 10-Second Roll Call:**
    *   **Auto-Save:** Every state toggle automatically saves to Firestore in the background via debounced commit (900ms) with a subtle live indicator (`✓ Saved to cloud` / `Saving...`), eliminating manual save anxiety while keeping a manual save button for immediate trigger.
    *   **⚡ Mark All Present Shortcut:** Servants tap *"Mark All Present"* once when class starts and only tap the 2 or 3 absent students, reducing roll-call time to under 10 seconds.
*   **Instant Absence WhatsApp Pastoral Shortcut:** Marking a child `Absent` immediately surfaces a green WhatsApp button on their card that opens a pre-composed pastoral message to the parents in one tap (e.g. *"سلام ونعمة يا أستاذ رامي، بنفتقد جداً إدريان في مدارس الأحد، لعله بخير ومستنينه الأسبوع الجاي بنعمة ربنا!"*).
*   **Pastoral Care Consecutive Absence Alert Banner (يحتاج افتقاد):**
    *   Automatically evaluates chronological attendance events to detect students who have missed 2 or more consecutive sessions.
    *   Renders a top alert banner listing flagged students with their consecutive absence count and one-tap **WhatsApp** and **Phone Call** shortcuts to parents.

---

## 18. Group-Specific Event Types & Horizon-Aware Attendance UX

*   **Configurable Church-Wide Initial Event Types Template:**
    *   Hard-coded baseline defaults: `["Sunday School", "Liturgy", "Bible Study", "Hymns", "Conference", "Trip", "Activity", "Other"]`.
    *   In Church Admin (`ChurchesScreen`), Church Admins / Global Owners can customize the church-level `defaultEventTypes` template (adding custom types or removing types).
*   **Automatic Inheritance & Group Admin Management:**
    *   When any new Service Group is created, it automatically inherits the church's configured default event types list.
    *   Group Admins and Church Admins can open the **"Event Types"** dialog on any service group in `ServiceGroupsScreen` to add new custom types, delete types, and toggle the `isCore` property.
*   **Core vs. Optional Events (`isCore`):**
    *   Each event type carries an `isCore: boolean` flag (defaulting to `true` for regular educational/spiritual sessions, `false` for voluntary trips or sports activities).
    *   The **Pastoral Care Consecutive Absence Alert Engine** evaluates strictly core events (`isCore: true`), ensuring that a student missing a voluntary social trip does not trigger a false-alarm pastoral visit alert.
*   **Timeline Horizon Filtering & Navigation:**
    *   Ribbon sessions can be filtered by horizon: `[ All Sessions ]`, `[ ⏪ Past ]`, `[ ⭐ Today ]`, and `[ ⏩ Upcoming ]`.
    *   **🎯 Jump to Today Button:** Instantly scrolls the timeline ribbon and selects today's active session (or the closest upcoming session).
    *   **Past Unrecorded Warning Badge (`⚠️ Attendance Not Taken`):** Highlights past sessions that occurred with zero recorded attendance, prompting servants to catch up.
    *   **Future Event Guardrail:** Displays an informative banner when viewing future sessions (*"Upcoming Session: You are viewing or scheduling a future event."*).
*   **Event-Type Filter & Engagement Analytics:**
    *   Filter both the Weekly Checklist and the Term Matrix Grid by event type (e.g. view strictly **Sunday School** or strictly **Liturgy**).
    *   Displays average attendance rate badges per event type (e.g., `Sunday School: 88%` • `Liturgy: 64%`), providing coordinators with immediate attendance health insights across ministry facets.

---

## 19. 3-Tier Role-Based Access Control (RBAC) for Classes & Attendance

*   **Tier 1: Full Edit Access:**
    *   **Eligible Roles:** Database Admin (`owner`), Church Admin (`Admin`), Group Admin of the class's assigned Service Group, and designated Class Misters (`Misters` / `MistersIds`).
    *   **Permissions:** Full read/write access to Class configurations, creation/deletion of attendance events, recurring term schedule generation, recording attendance status toggles (`Present`, `Absent`, `Excused`), "Mark All Present" shortcut, and pastoral note editing.
*   **Tier 2: View-Only Access:**
    *   **Eligible Roles:** Servants registered in the same Service Group (department), but not designated as Class Misters or Group Admins.
    *   **Permissions:** Full read/view access to student rosters, class details, session attendance history, and the full-term Matrix Grid.
    *   **UI Experience:** Displays a prominent **`[ 👁️ View Only Mode ]`** banner. Modification controls (save buttons, event creation/deletion, status toggle clicks, and note edits) are disabled or hidden.
*   **Tier 3: Zero Access (Strict Isolation):**
    *   **Eligible Roles:** Servants in the church who are NOT assigned to this class's Service Group.
    *   **Permissions:** Zero read and zero write access.
    *   **UI Experience:** Unassigned classes are automatically filtered out of the top navigation dropdowns and the Classes DataTable. Direct navigation renders a secure **`[ 🔒 Class Access Restricted ]`** notice.
    *   **Security Rules:** Backed by Cloud Firestore Security Rules rejecting unassigned read/write queries at the database layer.

---

## 20. Top-Down Group-to-Class Servant Governance

*   **Parent Group Constraint:**
    *   To enforce logical ministry hierarchy, a servant **must** be a registered member of a Service Group (department) before they can be assigned to teach a specific class within that group.
    *   **Class Form Picker Isolation:** When editing a class, the "Add Servant" picker popup is dynamically filtered to only display misters who are members of the class's selected Service Group.
    *   `FilterContext` preserves the complete group data (`misters`, `admins`, and `servants`) within each `serviceGroups` item, enabling real-time member resolution and defensive, case-insensitive email/id matching in the class modal picker.
    *   If no servants are in the group yet, a dedicated warning banner (`no_servants_in_group_hint`) instructs the coordinator to add them to the Service Group first.
*   **Automatic Fallback Enrollment:**
    *   If a class is saved with a servant ID via API bypass or stale state, the system's `writeBatch` automatically adds that servant to the parent Service Group as a regular `'servant'` to maintain data consistency.
*   **Group Settings Lockdown:**
    *   Editing a Service Group's core settings (Name, Active Status, Administrators, Event Types) is strictly locked to **Church Admins** and **Group Admins** belonging to that group.
    *   Regular class servants (who only have 'servant' role in the group) are restricted from opening the Edit modal or modifying Event Types.

---

## 21. Attendance State Architecture: Toggle-to-Clear, Session Reset & Visual States

*   **Toggle-to-Clear per Student (Undo Erroneous Records):**
    *   Tapping the currently active attendance status button (`Present`, `Absent`, or `Excused`) unselects it, removing the record and resetting the student back to **Unrecorded / Pending (`-`)**.
    *   This allows teachers and servants to easily undo accidental taps without having to keep an incorrect status.
*   **Session-Wide Reset Attendance (Whole-Class Undo):**
    *   A dedicated **`Reset Attendance`** button in the session control bar allows coordinators and teachers to clear all attendance records for an entire session with an in-app confirmation modal.
    *   Resets all student records to unrecorded and returns session status (`takenAt`, `takenBy`) back to `Pending` via atomic cloud update.
*   **4-State Matrix Cycling:**
    *   Clicking a cell in the Term Matrix Grid smoothly cycles through all 4 possible states:
        $$\text{Unrecorded } (-) \longrightarrow \text{Present } (\mathbf{P}) \longrightarrow \text{Absent } (\mathbf{A}) \longrightarrow \text{Excused } (\mathbf{E}) \longrightarrow \text{Unrecorded } (-)$$
*   **Enhanced Visual State Hierarchy:**
    *   **Present:** Left green border accent (`border-s-4 border-s-emerald-500`), subtle emerald background tint, green avatar with a checkmark badge, and bold `✓ Present` status tag.
    *   **Absent:** Left red border accent (`border-s-4 border-s-rose-500`), subtle rose background tint, rose avatar with an 'X' badge, bold `✕ Absent` status tag, and instant one-tap WhatsApp pastoral follow-up shortcut.
    *   **Excused:** Left amber border accent (`border-s-4 border-s-amber-500`), subtle amber background tint, amber avatar with a clock badge, and bold `⏱ Excused` status tag.
    *   **Unrecorded:** Neutral left border (`border-s-4 border-s-zinc-300`), clean white/dark card, and an italicized `Unrecorded` indicator prompting roll-call action.
*   **6-Card Live Metrics Bar:**
    *   Added a dedicated **Unrecorded** live metric card in the summary header (highlighted in amber if $> 0$), providing instant visibility on how many students remain pending in the active roll call.
*   **Ribbon Session Completion Tracking:**
    *   Session cards on the timeline ribbon dynamically reflect roll-call progress:
        *   **`✓ Complete (X%)`** (Emerald): All enrolled students in class have been recorded.
        *   **`⏳ X/Y In Progress`** (Teal): Roll-call is partially recorded.
        *   **`⚠️ Attendance Not Taken`** (Rose): Session date has passed with zero recorded attendance.
        *   **`⚪ Not Started`** (Zinc): Upcoming session with zero records yet.

---

## 21. Attendance Statistics, Pastoral Insights & Excel Export Module

*   **Tri-Mode View Switcher:**
    *   Users can seamlessly toggle between **`📋 Weekly Checklist`**, **`📊 Term Matrix Grid`**, and **`📈 Statistics & Insights`**.
*   **Executive KPI Cards:**
    *   **Average Term Attendance:** Overall percentage across all conducted sessions.
    *   **Sessions Conducted:** Completed sessions out of scheduled sessions with completion rate.
    *   **Best Attended Session:** Highlights the highest-attended session title, date, and attendance rate %.
    *   **At-Risk Students Count:** Flagging students attending under 50% who need pastoral visitation.
*   **Interactive Weekly Attendance Trend Chart:**
    *   A responsive, visual vertical bar chart showing attendance % across each chronological week.
    *   Color-coded bars: Green ($\ge 80\%$), Teal ($60\% - 79\%$), Rose ($< 60\%$) with hover tooltips displaying session title, date, type, and attendance counts.
*   **Pastoral Engagement Distribution (3 Categories):**
    *   🟢 **Faithful (80%-100%):** Consistent attendees eligible for certificates and honors.
    *   🟡 **Irregular (50%-79%):** Fluctuating attendees needing check-in phone calls.
    *   🔴 **At-Risk (<50%):** High absence rate; displays full student card with last attended date and direct **WhatsApp** / **Phone Call** shortcuts to parents.
*   **Event Type Engagement Comparison:**
    *   Visual progress bars comparing average attendance rates across different ministry activities (e.g. Sunday School Lesson vs. Divine Liturgy vs. Hymns & Praises vs. Bible Study).
*   **Honor Roll & Pastoral Attention Needed:**
    *   **🌟 Honor Roll:** Top 5 attendees ranked with gold, silver, and bronze badges.
    *   **🚨 Pastoral Attention Needed:** Lowest 5 attendees with absence counts and follow-up links.
*   **1-Click Formatted Excel Export (.xlsx):**
    *   Downloads a formatted multi-sheet Excel spreadsheet (`<Church>_<Class>_Attendance_Report.xlsx`):
        *   **Sheet 1: Executive Summary & Statistics:** Class metadata, KPI summary, pastoral distribution counts, and type comparisons.
        *   **Sheet 2: Attendance Register Matrix:** Full spreadsheet of students, per-date status (`P`, `A`, `E`, `-`), total present, total absent, total excused, and attendance percentage.

---

## 22. Bidirectional Synchronization: Class Rosters & Student Active Assignments

*   **Intelligent Dynamic Enrollment Resolution:**
    *   In `ClassesScreen`, enrolled students and student counts are resolved dynamically from **both** sources:
        $$\text{Enrolled Students} = \text{Unique}(\text{class.KidIds} \cup \{ \text{kids where } \texttt{activeAssignment.classId} == \texttt{classId} \})$$
    *   This guarantees that students imported via `smartImport.ts` or assigned via `BulkAssignmentModal` immediately appear in their classroom rosters and counts without requiring any manual re-import.
*   **Atomic Sync on Smart Import:**
    *   When executing an Excel/CSV import assigned to a class, `smartImport.ts` atomically updates the target class document's `academicYears[yearId].KidIds` array with the imported student IDs.
*   **Atomic Sync on Bulk Reassignment:**
    *   When bulk-reassigning students in `BulkAssignmentModal`, the target classroom's `KidIds` array is atomically updated to include the reassigned students.
*   **Synchronized Class Form Saving:**
    *   When saving a classroom in `ClassesScreen`, any added or removed students have their `activeAssignment.classId` updated in the `kids` collection in the same `writeBatch`, maintaining 100% two-way consistency across collections.

---

## 23. Profile Pictures (Option 1 Client-Compressed WebP in Firestore & Google Contacts Sync)

*   **Zero-Cost Architecture (100% Free Spark Tier):**
    *   Avoids the Firebase Storage pay-as-you-go (Blaze plan) credit card requirement entirely.
    *   Images are compressed client-side before upload and saved directly within Cloud Firestore documents (`kid.info.photoUrl` and `mister.personalInfo.photoUrl`) as lightweight base64 Data URLs (`data:image/webp;base64,...`).
*   **Client-Side Canvas Processing & WebP Compression:**
    *   **Square Center Crop:** Automatically calculates the centered square aspect ratio to eliminate distorted portraits.
    *   **Dimensional Constraint:** Rescaled to $128 \times 128$ px (optimal sharp resolution for mobile & web circular avatars).
    *   **Format & Quality:** Encoded as WebP at $70\%$ quality (with automatic JPEG fallback).
    *   **Storage Footprint:** Each profile image occupies only **$3\text{ KB} - 6\text{ KB}$**, which is less than $0.6\%$ of the $1\text{ MB}$ single Firestore document limit.
*   **Device Camera & File Selection:**
    *   **`ProfilePhotoUploader` Component:** Reusable avatar component displaying the circular photo with gender-themed initials fallback.
    *   **Upload from Device:** Hidden file input supporting any image format from local storage or photo galleries.
    *   **Take Photo:**
        *   On mobile devices: Natively invokes the front-facing camera via `<input capture="user" />`.
        *   On desktop browsers: Launches an in-app webcam viewfinder modal utilizing `navigator.mediaDevices.getUserMedia` with a circular framing guide, live preview, and "Snap Photo" capture button.
    *   **Remove Photo:** Allows clearing previously uploaded photos.
*   **Cross-Application Avatar Rendering:**
    *   **Kids Directory:** Renders circular photos in student rows (28px) and a photo uploader inside `KidFormModal`.
    *   **Servants Directory:** Renders circular servant photos in table rows and a photo uploader in `MisterFormModal` (self-service servants can update their own picture).
    *   **Attendance Tracker:** Displays student photos in the Weekly Checklist roll-call cards (44px) and in Pastoral Care absence alert banners.
    *   **Classes Screen:** Renders photo avatars in the servant and student picker modals.
*   **Google Contacts Photo Sync:**
    *   When syncing a classroom roster to Google Contacts via the People API, if a student possesses a `photoUrl`, the base64 payload is extracted and pushed to `PATCH https://people.googleapis.com/v1/{resourceName}:updateContactPhoto`, allowing servants to see students' photos in their mobile contacts.
*   **Smart Import & Excel Export:**
    *   `photoUrl` is registered in `TARGET_FIELDS` and heuristic mappings (`Photo URL`, `صورة الطالب`, `Avatar`).
    *   Excel export includes the `Photo URL` column.










