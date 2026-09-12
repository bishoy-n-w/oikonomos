# Oikonomos: Firestore Database Schema & Relational Design

Oikonomos uses a hierarchical, multi-tenant database design inside **Google Cloud Firestore**. 

The architecture is split into three layers:
1.  **Global Layer (`global_admins`):** System-wide locks and super-user authorizations.
2.  **Tenant Layer (`churches`):** Scoped church databases (each church is isolated from others).
3.  **Academic Year Scoped Layer (`academicYears`):** Year-specific class rosters, student assignments, home visits, and attendance logs.

---

## 🗺️ Architectural Entity-Relationship Diagram (ERD)

```text
=========================================================================================
                            ROOT COLLECTION: global_admins
=========================================================================================
  {User_UID}
  - email (string)
  - role (string)
  - createdAt (timestamp)
  
  _lock
  - initialized (boolean)
  - initializedBy (string)

                                     |
                                     V
=========================================================================================
                            TENANT COLLECTION: churches
=========================================================================================
  {churchId}
  - displayName (string)
  - active (boolean)
  - activeAcademicYearId (string/FK)
  - grades (map) -> { "1": "Grade 1", "2": "Grade 2" }
  - createdAt (timestamp)

     |
     |--▶ [misters] (Subcollection)
     |      {Mister_User_UID}
     |      - authUid (string)
     |      - displayName (string)
     |      - phone (string)
     |      - churchRole (string) -> 'viewer'|'admin'
     |      - active (boolean)
     |
     |--▶ [serviceGroups] (Subcollection)
     |      {serviceGroupId}
     |      - displayName (string)
     |      - roles (map) -> { misterId: 'admin'|'servant' }
     |      - grades (array) -> [ 1, 2, 3 ]
     |
     |--▶ [academicYears] (Subcollection)
     |      {yearId}
     |      - displayName (string)
     |      - startDate (timestamp)
     |      - endDate (timestamp/optional)
     |      - active (boolean)
     |
     |--▶ [kids] (Subcollection)
     |      {kidId}
     |      - active (boolean)
     |      - createdAt (timestamp)
     |      - activeAssignment (map) -> { academicYearId, serviceGroupId, classId }
     |      - current (map)
     |          - fullName, gender, dob, school, address, phone, notes
     |        |
     |        `--▶ [versions] (Nested Subcollection)
     |               {versionId}
     |               - at (timestamp)
     |               - changes (map)
     |
     `--▶ [classes] (Subcollection)
            {classId}
            - active (boolean)
            - createdAt (timestamp)
            - academicYears (map) 
                `-- {yearId} 
                    - serviceGroupId (string/FK)
                    - gradeId (integer/FK)
                    - name (string)
                    - KidIds (array of strings)
                    - Misters (map) -> { misterId: 'servant' }
              |
              |--▶ [attendanceEvents] (Nested Subcollection)
              |      {eventId}
              |      - academicYearId, title, type, eventDate
              |      - takenAt, takenBy
              |      - statuses (map) -> { kidId: 'present'|'absent'|'excused' }
              |      - notesByKid (map) -> { kidId: 'note text' }
              |
              `--▶ [visits] (Nested Subcollection)
                     {visitId}
                     - academicYearId
                     - kidId, visitDateTime
                     - visitorMisterIds (array of strings)
                     - notes, createdBy, createdAt, updatedAt
=========================================================================================
```

---

## 🛡️ Security & Role-Based Access Control (RBAC)

Oikonomos implements strict data isolation and role-based permissions at the Firestore Rules level.

| Database Entity | Database Admin | Church Admin | Church Servants | Group Admin | Group Servants | Class Servants |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`global_admins`** | Read / Write | No Access | No Access | No Access | No Access | No Access |
| **`churches`** (incl. `grades`) | Read / Write | Read / Write | Read Only | Read Only | Read Only | Read Only |
| **`churches/*/academicYears`** | Read / Write | Read / Write | Read Only | Read Only | Read Only | Read Only |
| **`churches/*/misters`** | Read / Write | Read / Write | Read Only | Read / Write** | Read Only | Read Only |
| **`churches/*/kids`** | Read / Write | Read / Write | No Access | Read/Write (Active)* | Read (Active) | Read/Write (Active)* |
| **`churches/*/serviceGroups`**| Read / Write | Read / Write | Read Only | Read / Write** | Read Only | Read Only |
| **`churches/*/classes`** | Read / Write | Read / Write | No Access | Read / Write** | Read Only** | Read Only** |
| **`classes/*/attendanceEvents`**| Read / Write | Read / Write | No Access | Read / Write** | Read / Write** | Read / Write** |
| **`classes/*/visits`** | Read / Write | Read / Write | No Access | Read / Write** | Read / Write** | Read / Write** |

*\* **Kids Edit Rule (`activeAssignment`)**: To allow secure, scalable edits without breaching Firestore Rule `get()` limits, Group Admins and Class Servants are granted **Write/Edit** access to a Kid's document **only if** the Kid's `activeAssignment` fields point to the current Active Academic Year AND point to a class/group where the Servant is actively assigned. If the assignment is historical (inactive academic year), they are demoted to **Read Only**.*
*\*\* **Group/Class scoping**: Group Admins/Servants only have access to misters/classes/events/visits mapped to their specific `serviceGroupId`. Class Servants only have access to data for their assigned `classId`.*

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
    *   `grades` (map): Auto-incrementing integer keys mapping to grade details and their specific service group.
        *   `Key` (string): System auto-incremented integer (e.g., `'1'`, `'2'`).
        *   `Value` (map):
            *   `name` (string): UI Display Name, e.g., `'Grade 1'`.
            *   `serviceGroupId` (string/reference): Unique FK pointing to the assigned Service Group. (Cannot be reused across multiple grades).
    *   `createdAt` (server timestamp): Creation date.
    *   `createdBy` (string/reference): FK pointing to the Admin who created the church.

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
    *   `activeAssignment` (map/optional): Denormalized pointers to active location (Used strictly by Firestore Rules for RBAC evaluation).
        *   `academicYearId` (string/reference): FK to the active year they are assigned in.
        *   `serviceGroupId` (string/reference): FK to their current service group.
        *   `classId` (string/reference): FK to their current class.
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
    *   `displayName` (string): Service Group Name (e.g., `Junior High Department`).
    *   `misters` (map): Map of assigned misters and their group-level roles.
        *   `Key` (string): `misterId`
        *   `Value` (string): `'admin'` (Group Admin) or `'servant'` (Group Servant).
    *   `createdAt` (server timestamp): Creation date.
    *   `createdBy` (string/reference): FK pointing to the Admin who created the group.
    *(Note: Grades assigned to the group are now read inversely from the `churches` document's `grades` map. The legacy `grades` and `roles` array/maps were removed).*

---

### Subcollection: `churches/{churchId}/classes`
The Directory of Class Groups (Grade groups) defined in this church.

#### Document: `{classId}` (e.g., `CLS_GRADE5`)
*   **Fields:**
    *   `active` (boolean): Status of the class group.
    *   `createdAt` (server timestamp): Class creation date.
    *   `academicYears` (map): 
        *   `{yearId}` (e.g., `AY_2026`): Map of class data for a specific academic year.
            *   `serviceGroupId` (string/reference): FK pointing to `churches/{churchId}/serviceGroups/{serviceGroupId}`.
            *   `gradeId` (integer): Grade level ID pointing to the integer key in the church's `grades` map.
            *   `name` (string): Name of the class (e.g., `Grade 5 Boys Class`).
            *   `KidIds` (array of strings): Enrolled children IDs list.
            *   `Misters` (map/json): Assigned teachers' roles map (`misterId`: `'servant'`).

#### Nested Subcollection: `churches/{churchId}/classes/{classId}/attendanceEvents`
Attendance Logs of classrooms taken on lesson dates.

*   **Document:** `{eventId}`
*   **Fields:**
    *   `academicYearId` (string/reference): FK pointing to the academic year.
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

#### Nested Subcollection: `churches/{churchId}/classes/{classId}/visits`
Logs pastoral home visits made by servants to kids enrolled in a class.

*   **Document:** `{visitId}`
*   **Fields:**
    *   `academicYearId` (string/reference): FK pointing to the academic year.
    *   `kidId` (string/reference): FK pointing to `churches/{churchId}/kids/{kidId}` (displays the kid's full name in the UI dropdown).
    *   `visitDateTime` (timestamp): Visual calendar date/time of the pastoral home visit.
    *   `visitorMisterIds` (array of strings): FK list pointing to the servants who performed the visit.
    *   `notes` (string/multiline): Pastoral session notes of the visit.
    *   `createdBy` (string/reference): FK pointing to `churches/{churchId}/misters/{misterId}`.
    *   `createdAt` (server timestamp): Creation timestamp.
    *   `updatedAt` (server timestamp): Edit timestamp.

---

## 📂 3. Academic Year Layer (Scoped Data)

### Subcollection: `churches/{churchId}/academicYears`
Defines the timeline metadata of Sunday School terms.

#### Document: `{yearId}` (e.g., `AY_2026`)
*   **Fields:**
    *   `displayName` (string): The term name (e.g., `Academic Year 2026/2027`).
    *   `startDate` (timestamp): School year start date (Month and Year).
    *   `active` (boolean): Active year toggle.
    *   `createdAt` (server timestamp): Creation date.
    *   `createdBy` (string/reference): FK pointing to the Admin who created the term.

---

## 🔗 Foreign Key Mappings & UI Display Paths

This table maps how the relational dropdown selects resolve database identifiers into human-readable representations inside Oikonomos's custom UI:

| Source Collection | Form Field Path | Target Firestore Collection Path | UI Display Path |
| :--- | :--- | :--- | :--- |
| `serviceGroups/{serviceGroupId}` | `roles` keys | `churches/{churchId}/misters` | `displayName` |
| `classes/{classId}/academicYears/{yearId}` | `Misters` | `churches/{churchId}/misters` | `displayName` |
| `classes/{classId}/academicYears/{yearId}` | `KidIds` | `churches/{churchId}/kids` | `current.fullName` |
| `classes/{classId}/academicYears/{yearId}` | `serviceGroupId` | `churches/{churchId}/serviceGroups` | `displayName` |
| `kids/{kidId}` | `activeAssignment.serviceGroupId` | `churches/{churchId}/serviceGroups` | `displayName` |
| `kids/{kidId}` | `activeAssignment.classId` | `churches/{churchId}/classes` | `academicYears.{yearId}.name` |
| `attendanceEvents` | `createdBy` | `churches/{churchId}/misters` | `displayName` |
| `attendanceEvents` | `takenBy` | `churches/{churchId}/misters` | `displayName` |
| `visits` (Home Visits) | `kidId` | `churches/{churchId}/kids` | `current.fullName` |
| `visits` (Home Visits) | `createdBy` | `churches/{churchId}/misters` | `displayName` |