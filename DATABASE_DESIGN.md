# Oikonomos: Firestore Database Schema & Relational Design

Oikonomos uses a hierarchical, multi-tenant database design inside **Google Cloud Firestore**. 

The architecture is split into three layers:
1.  **Global Layer (`global_admins`):** System-wide locks and super-user authorizations.
2.  **Tenant Layer (`churches`):** Scoped church databases (each church is isolated from others).
3.  **Academic Year Scoped Layer (`academicYears`):** Year-specific class rosters, student assignments, home visits, and attendance logs.

---

## 🗺️ Architectural Entity-Relationship Diagram (ERD)

```text
+-------------------+
|   global_admins   | <--- Root-level system locks & master bypasses
+-------------------+
          |
          | manages
          v
+-------------------+
|     churches      | <--- Multi-tenant church documents
+-------------------+
          |
          +------> [misters] (Servants/Teachers Directory)
          |
          +------> [kids] (Children Roster PII) ---> [versions] (History Archive)
          |
          +------> [serviceGroups] (Service Groups Directory)
          |
          +------> [classes] (Class Groups)
          |
          +------> [academicYears] (Academic Years Metadata)
                         |
                         +---> [classInstances] (Roster Enrollment Mapping)
                         |
                         +---> [attendanceEvents] (Pastoral Roster Logs)
                         |
                         +---> [homeVisitsByClassInstance] (Pastoral Visit logs)
```

---

## 📂 1. Global Layer (Root)

### Collection: `global_admins`
Responsible for the dynamic "Self-Locking Bootstrap Gate" that authorizes the system owner with zero hardcoding.

#### Document: `_lock` (System Initialization Lock)
*   **Path:** `/global_admins/_lock`
*   **Fields:**
    *   `initialized` (boolean): `true`
    *   `initializedBy` (string): Firebase User UID of the owner.
    *   `createdAt` (server timestamp): Date/Time of initialization.

#### Document: `{User_UID}` (Global Owner Profile)
*   **Path:** `/global_admins/{User_UID}`
*   **Fields:**
    *   `email` (string): Owner's Google Email address.
    *   `role` (string): `owner`
    *   `createdAt` (server timestamp): Date/Time of registration.

---

## 📂 2. Tenant Layer (Church Level)

### Collection: `churches`
Contains the core registry of churches.

#### Document: `{churchId}` (e.g., `CHC_ABC123`)
*   **Fields:**
    *   `displayName` (string): Public name of the church (e.g., `Saint George Sunday School`).
    *   `active` (boolean): Whether this church is active in the database.
    *   `activeAcademicYearId` (string): Foreign key pointing to the active `academicYears` document ID.
    *   `createdAt` (server timestamp): Creation date.

---

### Subcollection: `churches/{churchId}/misters`
The Directory of Servants (Teachers/Coordinators) in this specific church.

#### Document: `{Mister_User_UID}`
*   **Fields:**
    *   `authUid` (string): Firebase User UID used for Google Sign-In.
    *   `displayName` (string): Full name of the teacher/servant.
    *   `phone` (string): Contact phone number.
    *   `churchRole` (string): Access permissions: `'viewer'` (Teacher) or `'admin'` (Coordinator).
    *   `active` (boolean): Whether this servant is currently active.
    *   `createdAt` (server timestamp): Registration date.

---

### Subcollection: `churches/{churchId}/kids`
The Student Directory containing Personal Identifiable Information (PII).

#### Document: `{kidId}` (e.g., `KID_1001`)
*   **Fields:**
    *   `active` (boolean): Status of the child.
    *   `createdAt` (server timestamp): Roster enrollment date.
    *   `current` (map): Active profile details:
        *   `fullName` (string): Child's full name.
        *   `gender` (string): `'M'` or `'F'`.
        *   `dob` (timestamp): Date of birth (visual picker).
        *   `school` (string): School details.
        *   `address` (string): Residential home address.
        *   `phone` (string): Parent's contact phone number.
        *   `notes` (string/multiline): Pastoral notes or medical warnings.

#### Nested Subcollection: `churches/{churchId}/kids/{kidId}/versions`
*   Maintains historical profiles whenever a child’s details change.
*   **Fields:**
    *   `at` (timestamp): Archive date.
    *   `changes` (map/json): The delta properties that were changed.

---

### Subcollection: `churches/{churchId}/serviceGroups`
The Directory of Service Groups (ministry departments) responsible for managing specific age group cohorts in this specific church.

#### Document: `{serviceGroupId}` (e.g., `SG_JUNIOR_HIGH`)
*   **Fields:**
    *   `active` (boolean): Service Group status.
    *   `current` (map):
        *   `displayName` (string): Service Group Name (e.g., `Junior High Department`).
        *   `roles` (map/json): Map of Mister UIDs to roles (e.g. `{"UID_123": "admin"}`).

#### Nested Subcollection: `churches/{churchId}/serviceGroups/{serviceGroupId}/mistersMemberships`
*   Links servants assigned to collaborate and pastor within this Service Group (department).
*   **Fields:**
    *   `misterId` (string/reference): FK pointing to `churches/{churchId}/misters/{misterId}`.
    *   `role` (string): `'viewer'` or `'admin'`.
    *   `startAt` (timestamp): Assignment start date.
    *   `endAt` (timestamp): Assignment end date (optional).

---

### Subcollection: `churches/{churchId}/classes`
The Directory of Class Groups (Grade groups) defined in this church.

#### Document: `{classId}` (e.g., `CLS_GRADE5`)
*   **Fields:**
    *   `active` (boolean): Status of the class group.
    *   `createdAt` (server timestamp): Class creation date.
    *   `current` (map):
        *   `name` (string): Name of the class (e.g., `Grade 5 Boys Class`).
        *   `currentKidIds` (array of strings): Enrolled children IDs list.
        *   `currentMisters` (map/json): Assigned teachers' roles map.

---

## 📂 3. Academic Year Layer (Scoped Data)

### Subcollection: `churches/{churchId}/academicYears`
Defines the timeline metadata of Sunday School terms.

#### Document: `{yearId}` (e.g., `AY_2026`)
*   **Fields:**
    *   `displayName` (string): The term name (e.g., `Academic Year 2026/2027`).
    *   `startDate` (timestamp): School year start date.
    *   `endDate` (timestamp): School year end date.
    *   `active` (boolean): Active year toggle.

---

### Subcollection: `churches/{churchId}/academicYears/{yearId}/classInstances`
Maps and binds a **Class Group** to an active **Service Group (Department)** and a specific **Grade Level** for this Academic Year term.

#### Document: `{instanceId}` (e.g., `CI_G5_2026`)
*   **Fields:**
    *   `classId` (string/reference): FK pointing to `churches/{churchId}/classes/{classId}`.
    *   `serviceGroupId` (string/reference): FK pointing to `churches/{churchId}/serviceGroups/{serviceGroupId}`.
    *   `gradeId` (string/option): Grade levels: `'KG', 'G1', ..., 'G12'`.

---

### Subcollection: `churches/{churchId}/academicYears/{yearId}/attendanceEvents`
Attendance Logs of classrooms taken on lesson dates.

#### Document: `{eventId}`
*   **Fields:**
    *   `title` (string): Title of the event (e.g. `Sunday School Lesson 1`).
    *   `type` (string): Event category (e.g. `'Sunday School'`, `'Bible Study'`).
    *   `eventDate` (timestamp): Visual calendar date when the event occurred.
    *   `takenAt` (server timestamp): System date/time of attendance entry.
    *   `takenBy` (string/reference): FK pointing to `churches/{churchId}/misters/{misterId}`.
    *   `statuses` (map): Dynamic roster map of student status:
        *   `Key` (string): `kidId` (e.g. `KID_1001`)
        *   `Value` (string): `'present'` | `'absent'` | `'excused'`
    *   `notesByKid` (map): Dynamic remarks logged for individual kids:
        *   `Key` (string): `kidId`
        *   `Value` (string): Text notes (e.g. `Sick`, `Came 10 mins late`).
    *   `createdAt` (server timestamp): Date of creation.
    *   `updatedAt` (server timestamp): Date of last edit.

---

### Subcollection: `churches/{churchId}/academicYears/{yearId}/homeVisitsByClassInstance`
Logs pastoral home visits made by servants to kids enrolled in a class.

#### Document: `{instanceId}` (Class Instance ID)
##### Nested Collection: `churches/{churchId}/academicYears/{yearId}/homeVisitsByClassInstance/{instanceId}/visits`
###### Document: `{visitId}`
*   **Fields:**
    *   `kidId` (string/reference): FK pointing to `churches/{churchId}/kids/{kidId}` (displays the kid's full name in the UI dropdown).
    *   `visitDateTime` (timestamp): Visual calendar date/time of the pastoral home visit.
    *   `visitorMisterIds` (array of strings): FK list pointing to the servants who performed the visit.
    *   `notes` (string/multiline): Pastoral session notes of the visit.
    *   `createdBy` (string/reference): FK pointing to `churches/{churchId}/misters/{misterId}`.
    *   `createdAt` (server timestamp): Creation timestamp.
    *   `updatedAt` (server timestamp): Edit timestamp.

---

## 🔗 Foreign Key Mappings & UI Display Paths

This table maps how the relational dropdown selects resolve database identifiers into human-readable representations inside Oikonomos's custom UI:

| Source Collection | Form Field Path | Target Firestore Collection Path | UI Display Path |
| :--- | :--- | :--- | :--- |
| `serviceGroups/{serviceGroupId}/mistersMemberships` | `misterId` | `churches/{churchId}/misters` | `displayName` |
| `classes/{classId}/mistersMemberships` | `misterId` | `churches/{churchId}/misters` | `displayName` |
| `classes/{classId}/kidsMemberships` | `kidId` | `churches/{churchId}/kids` | `current.fullName` |
| `classInstances` | `classId` | `churches/{churchId}/classes` | `current.name` |
| `classInstances` | `serviceGroupId` | `churches/{churchId}/serviceGroups` | `current.displayName` |
| `attendanceEvents` | `createdBy` | `churches/{churchId}/misters` | `displayName` |
| `attendanceEvents` | `takenBy` | `churches/{churchId}/misters` | `displayName` |
| `visits` (Home Visits) | `kidId` | `churches/{churchId}/kids` | `current.fullName` |
| `visits` (Home Visits) | `createdBy` | `churches/{churchId}/misters` | `displayName` |
