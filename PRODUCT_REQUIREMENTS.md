# Oikonomos Sunday School CRM - Product Requirements Document (PRD)

This document serves as the absolute architectural blueprint and behavioral specification reference for the **Oikonomos Sunday School Administration Platform**. It consolidates every product requirement, visual standard, real-time validation rule, and self-service security workflow implemented in the system.

---

## 1. Core Platform, Layout & UX Redesign

### 🔓 A. Implicit Document ID Management
*   **Behavior:** Manual, user-facing input fields for Firebase Document IDs are permanently disabled and hidden from all creation and edit form windows.
*   **Implementation:** The code automatically generates secure, random 20-character alphanumeric UIDs (via Firestore auto-IDs) or maps keys strictly to verified, unique natural identifiers (such as Email for Servants, and Full Name for Kids) behind the scenes, eliminating key collisions and UX friction.

### 🌍 B. Language Selector & Arabic RTL Mirroring
*   **Behavior:** The application supports English and Arabic. 
*   **Real-time State Update:** Toggling the language instantly translates all navigation labels, metrics, grids, and dialogs.
*   **RTL Mirroring:** Selecting Arabic dynamically wraps the layout in a `Directionality(textDirection: TextDirection.rtl)` widget, mirroring the sidebars, tables, alignments, and icons from Right-to-Left instantly.
*   **Persistence:** The chosen language code is cached in the browser's native `localStorage` and automatically loaded on session startup.

### 🌓 C. Theme Mode Controller
*   **Behavior:** Supports Light and Dark modes.
*   **Visual Standard:** Both themes are seeded with a modern, high-fidelity teal color palette (`Colors.teal`) using Material 3 specifications.
*   **Persistence:** Theme preferences are stored in the browser's native `localStorage` and loaded synchronously.

### 👥 D. Google-Style Multi-Account Session Switcher
*   **Behavior:** The generic, single-action sign-out button is replaced with a polished, circular User Profile Avatar in the top-right of the AppBar.
*   **The Profile Menu:** Clicking the avatar opens a material dropdown menu containing:
    *   The logged-in user's profile picture, full name, and verified email address.
    *   **Theme Toggle:** Seamlessly switches light/dark modes.
    *   **Language Toggle:** Switches English/Arabic.
    *   **Switch Account:** Invokes Google's native Account Chooser popup with `prompt: 'select_account'` parameters. This allows users to switch between signed-in browser accounts or click *"Use another account"* in one click, matching Google Drive exactly.
    *   **Sign Out:** Log out of the current Google Firebase session (with a safety confirmation dialog).

### ⚙️ E. Sidebar Promotion (Settings Tab Removal)
*   **Behavior:** The legacy, cluttered "Settings" tab has been completely removed.
*   **Flat Architecture:** All individual administrative and configurations directories are promoted directly to the primary sidebar `NavigationRail` as top-level options, creating a spacious and direct administrative workflow:
    1.  **Dashboard** (Quick tasks, metric counters, and admin notifications)
    2.  **Kids Directory** ( Tabular CRM student roster)
    3.  **Servants Directory** (Tabular servant management console)
    4.  **Attendance Tracker** (Lesson logs)
    5.  **Class Groups** (Generic list of classes)
    6.  **Service Groups** (Pastoral departments)
    7.  **Class Assignments** (Academic term class instances)
    8.  **Home Visits** (Pastoral visitation logs)
    9.  **Churches & Years** (Church timeline visualizer)

---

## 2. Directory Overhauls: Servants & Kids

### 🧑‍🏫 A. Servants (Misters) Directory
*   **Primary Key:** The servant's verified Google Email address is the primary Firestore Document ID Key (e.g. `/misters/bishoy@gmail.com`). 
*   **Roster DataTable:** Displays servants in a responsive checkbox grid with columns for *Full Name*, *Email (Key)*, *Mobile*, *Access Role*, *Active Status*, and *Actions*.
*   **Access Role Terminology:** The directory uses the explicit organizational levels **`Teacher`** (previously `'viewer'`) and **`Admin`** (previously `'admin'`).
*   **Phone Validation:** Mobile entries use our custom, smart-stripping input field.
*   **Roster Export:** Supports multi-checking checkboxes. Checking rows opens a bulk action bar allowing the Admin to **Export selected to CSV** or **Bulk Delete** (with safety confirmation checks).
*   **Spreadsheet Safe Formats:** CSV exports exclude separate country codes, formatting the phone number as a single unit cell prefixed with a tab `\t` separator to **force Excel/Sheets to preserve the leading plus sign** (`+201099441171`) instead of stripping it as a formula.
*   **Future Proof:** The document schema is open to accepting future personal and profiling sub-properties under `'profile'` safely.

---

### 🧒 B. Kids Directory CRM
*   **Primary Key:** The child's Full Name is the primary Firestore Document ID Key (e.g. `/kids/Mark Nagy`).
*   **Roster DataTable:** Displays children in a tabular checkbox grid with columns for *Photo*, *Full Name (Key)*, *Gender*, *Birthday*, *Father of Confession*, *Father Mobile*, *Mother Mobile*, *Area*, and *Actions*.
*   **Only Name is Mandatory:** Only the student's name is required to onboard a child; all other 15+ fields are optional.
*   **Collapsible Form Categories:** Add/Edit forms break down the extensive CRM information sheet into clean, expandable visual sections:
    1.  **General Profile:** Name, Gender, Birthday (visual calendar picker), School, and Confession Father.
    2.  **Home Address:** Street Name, Building Name/No, Floor, Apartment, and Area.
    3.  **Family Contacts:** Home Tele, Kid Mobile, Father Name, Father Mobile, Father Job, Mother Name, Mother Mobile, Mother Job, and Other Mobiles (dynamic comma-separated list).
    4.  **Pastoral Notes:** Special warnings, conditions, or visitation remarks.
*   **E.164 Normalization:** All contact inputs (Kid, Father, Mother) use our unified phone field to validate and format E.164 strings.
*   **Bulk Actions:** Supports multi-checking rows for bulk deletion or bulk CSV exports (with tab `\t` leading-plus preservation).
*   **Hardware Client-Side Profile Photo Compressor:**
    *   **Behavior:** When an image is uploaded, the browser uses HTML5 Canvas to scale and compress the photo down to an optimized JPEG thumbnail (max 150px) at 70% quality in milliseconds.
    *   **The Benefit:** It encodes the thumbnail into a compact `base64` string and saves it directly inside the child's Firestore document. This loads instantly on attendance sheets on all devices with **zero Firebase Storage server bills!**

---

## 3. Unified Validation & Form Entry Rules

### ⏱️ A. Real-Time, Cell-by-Cell Checking
*   **Behavior:** Form validation must **not** wait until the user presses "Save".
*   **Implementation:** All text cells use `TextFormField` wrapped inside a keyed `Form` configured with **`AutovalidateMode.onUserInteraction`**.
*   **Real-time Alerts:** Inputs highlight in bold red with descriptive helper guidelines directly below the active text input cell the moment the user types invalid data (e.g. invalid email syntax, or numeric character violations).

### 🛡️ B. Unbreakable Save Gates (Modal Lock)
*   **Behavior:** If a user clicks "Save" while the form contains any invalid data, **the dialog must remain completely open.**
*   **On-the-spot marking:** The saving trigger checks `formKey.currentState!.validate()`. If it returns `false`, it blocks the submission, scrolls/focuses on the invalid cell, and prevents the modal from closing. The window can **only** be closed by resolving all invalid cells, or by explicitly clicking the "Cancel" button.

### 📱 C. The Unified `OikonomosPhoneField` Widget
Every phone input in the application shares the same exact Google-style widget:
*   **Flags & Search:** Displays interactive search-filterable country flags and dial prefixes.
*   **Default Country:** The country picker always defaults to **Egypt (`EG` / `+20`)** automatically on clean launches.
*   **Google-Style Real-time Stripping:** It listens to keypresses as the user types. The millisecond they type a leading zero (e.g. `01099...`), **the leading `0` is instantly and silently stripped** from the input text field. It is mathematically impossible for any leading zero to remain in the input or write to the database!
*   **Single-Cell E.164 Storage:** It merges country prefixes and digits, outputting a single, normalized, complete E.164 string (e.g. `+201099441171`) directly to Firestore under the `'mobile'` document key. It does not write separate country code columns or duplicate `'phone'` keys.

---

## 4. Church Onboarding & Year Timelines

### ⛪ A. Churches & Years timeline Visual
*   **Behavior:** Academic Years are removed as a separate sidebar tab and merged directly under the Churches configuration panel.
*   **Timeline visual:** Expanding a Church Card displays a clean, vertical chronological timeline of all academic years registered in this church, featuring active-term checkmark indicators.

### 🧙‍♂️ B. Double-Step Church Wizard
*   **Behavior:** Adding a new church **forces** the user to initialize their first academic year.
*   **Transactional Safety:** The form acts as a two-step wizard (Step 1: Church Name, Step 2: Year Start). Clicking create transactionally batches both documents together, preventing empty database fragments.

### 📅 C. Simplified Month-Year Selector
*   **Behavior:** Adding an Academic Year **only** asks for the start Month and Year (via a dropdown selector). It does **not** ask for days or an end date.
*   **Implicit Calculation:** The code automatically sets the `startDate` to Day 1 of the chosen month, and calculates the `endDate` as exactly **one year later minus one day** (e.g., September 2026 to August 31, 2027), storing both timestamps in Firestore silently.

---

## 5. Secure Self-Service Onboarding

### 🔐 A. Multi-Tier Security Guard
The application utilizes a double-nested frontend StreamBuilder to verify user authorizations securely:
*   **Tier 1 (Database Owner bypass):** Listens to `/global_admins/{uid}`. If the signed-in user's Google UID exists in this collection (created during the setup bootstrap gate), they bypass all access limits and are automatically authorized with full `'Admin'` privileges for all churches.
*   **Tier 2 (Roster Verification):** If they are not a global owner, the gate listens to the selected church's `/misters/{email}` roster. If their verified email exists and is active (`active == true`), they are authorized. If not, they are locked out.

### 🚪 B. Self-Service Join Request Portal
*   **Behavior:** Guests or unapproved users are cleanly blocked from the dashboard and sidebar menus.
*   **Onboarding Portal:** They are shown a welcoming access request portal. It displays a dropdown of available Churches (which they can read publicly) and a **"Request to Join"** button.
*   **Request database:** Clicking it commits a join request under `/churches/{churchId}/joinRequests/{email}` with their display name, email, and timestamp.
*   **Stateful UI:** Once submitted, the card dynamically transitions to a friendly *"Pending Approval"* state, allowing them to cancel the request if needed.

### 🔔 C. Admins Dashboard Approval Panel
*   **Behavior:** When an authorized **`Admin`** logs into Oikonomos, the system checks for any pending join requests under `/churches/{churchId}/joinRequests` in real-time.
*   **Notification Alert:** If requests exist, a beautiful orange notification card slides open at the very top of their dashboard listing applicants' names and emails.
*   **Action Buttons:**
    *   **Approve:** Runs an atomic transaction that registers them as an active **`Teacher`** under `/churches/{churchId}/misters/{email}`, then deletes their pending request document. The approved user's screen automatically refreshes and logs them straight into the Sunday School Dashboard!
    *   **Reject:** Deletes the pending join request document safely.

---

## 6. Resilient Spreadsheet Importer Normalizer

When administrators import servant or student rosters from `.xlsx`, `.xls`, or `.csv` files:
1.  They select the file Sheet (tab).
2.  They select which row contains column names (headers).
3.  They interactively map their spreadsheet columns directly to Oikonomos required fields.
4.  **Resilient Normalization:** The importer parses incoming phone columns using the smart algorithm:
    *   *Strips non-digits:* Removes spaces, hyphens, pluses, or letters.
    *   *Strips leading zero:* If the number starts with `0` (e.g. `010...`), it deletes the `0`.
    *   *Resolves country prefix:*
        *   If it matches standard Egyptian mobile lengths (10 digits) and starts with Egyptian mobile prefixes, it prepends Egypt's dial code (`+20`).
        *   If it is a 10-digit number not matching Egypt, it prepends USA `+1`.
        *   *All other unaligned formats default safely to Egypt (`+20`).*
    *   *Saves E.164:* Batches the parsed string securely to Firestore as a single, combined, standard international E.164 string (`+201099441171`).

---

## 7. Soft Deletion Lifecycle: The "Active" Field Functionality

To preserve relational history and database integrity, no records are physically deleted from day-to-day administrative tables. Setting `active: false` archives the object:

| Entity / Object | `active: false` Behavioral Impact & Functionality |
| :--- | :--- |
| **`churches`** | Global multi-tenancy lock. Setting to `false` blocks all read/write accesses to this church. Teachers and admins are locked out. |
| **`misters`** | Real-time session termination. Security rules block access instantly, preventing them from viewing child PII. However, **their names are preserved on past attendance sheets** for historical accuracy. |
| **`serviceGroups`** | Organizational restructuring. Hides the department from active dropdown selectors, preventing coordinators from assigning new classes to it while preserving student/teacher assignment logs. |
| **`kids`** | Active classroom roster filter. Inactive children are archived, **instantly disappearing from weekly Attendance sheets** (teachers don't have to scroll past inactive names). They can still be viewed inside archives. |
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
