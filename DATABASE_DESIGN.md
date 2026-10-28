# Oikonomos: Firestore Database Schema & Relational Design

Oikonomos uses a modern, hierarchical, multi-tenant database architecture inside **Google Cloud Firestore**. 

The architecture is organized into three distinct tiers:
1.  **Global Layer (`global_admins`):** System-wide Day-0 bootstrap lock and super-user root authorizations.
2.  **Tenant Layer (`churches`):** Scoped church databases isolating tenant records, servant profiles, student CRM directories, and ministry departments.
3.  **Scoped Academic Layer (`academicYears` / `classes`):** Term-specific class rosters, student active assignments, home visitation logs, and attendance session events.

---

## 🗺️ Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    GLOBAL_ADMINS ||--o{ CHURCHES : oversees
    CHURCHES ||--|{ ACADEMIC_YEARS : defines
    CHURCHES ||--|{ SERVICE_GROUPS : organizes
    CHURCHES ||--|{ MISTERS : registers
    CHURCHES ||--|{ KIDS : enrolls
    CHURCHES ||--|{ CLASSES : configures
    
    ACADEMIC_YEARS ||--o{ CLASSES : instances
    SERVICE_GROUPS ||--o{ CLASSES : contains
    
    CLASSES ||--o{ ATTENDANCE_EVENTS : logs
    CLASSES ||--o{ HOME_VISITS : tracks
    
    KIDS ||--o{ KIDS_VERSIONS : audits
    KIDS ||--o{ ATTENDANCE_EVENTS : records
    KIDS ||--o{ HOME_VISITS : receives

    GLOBAL_ADMINS {
        string uid PK
        string email
        string role
        timestamp createdAt
    }

    GLOBAL_ADMINS_LOCK {
        string id PK "Always '_lock'"
        boolean initialized
        string initializedBy
        timestamp createdAt
    }

    CHURCHES {
        string id PK "e.g. CHC_123"
        string displayName
        boolean active
        string activeAcademicYearId FK
        map grades "Auto-incrementing integer key -> { name, serviceGroupId }"
        array defaultEventTypes
        timestamp createdAt
        string createdBy
    }

    MISTERS {
        string email PK "Normalized lower/original email"
        string authUid
        string displayName
        string churchRole "admin | viewer"
        boolean active
        map personalInfo "phone, dob, job, address, photoUrl, notes"
        timestamp createdAt
        timestamp lastEditAt
    }

    SERVICE_GROUPS {
        string id PK "e.g. SG_ELEM"
        string displayName
        boolean active
        map misters "email -> admin | servant"
        array admins "Fallback list of admin emails"
        array servants "Fallback list of servant emails"
        array eventTypes "Custom group event types { id, name, isCore }"
        timestamp createdAt
        string createdBy
    }

    ACADEMIC_YEARS {
        string id PK "e.g. AY_2026"
        string displayName
        string startDate "YYYY-MM"
        boolean active
        timestamp createdAt
        string createdBy
    }

    CLASSES {
        string id PK "e.g. CLS_G4"
        boolean active
        map academicYears "yearId -> { name, gradeId, serviceGroupId, KidIds, Misters }"
        string serviceGroupId "Legacy/default fallback pointer"
        timestamp createdAt
        string createdBy
    }

    KIDS {
        string id PK "Random Firestore Auto-ID"
        boolean active
        string importBatchId "Optional for 1-click rollback"
        map activeAssignment "academicYearId, serviceGroupId, classId"
        map info "fullName, gender, dob, school, schoolType, deacon, fatherOfConfession, photoUrl"
        map address "street, building, floor, apartment, region, landmark, geoLocation"
        map contacts "kidMob, fatherName, fatherProfession, fatherMob, motherName, motherProfession, motherMob, otherMob"
        string notes
        timestamp createdAt
        timestamp lastEditAt
    }

    ATTENDANCE_EVENTS {
        string id PK "e.g. EVT_20261018"
        string academicYearId FK
        string classId FK
        string serviceGroupId FK
        string title
        string type "Sunday School, Liturgy, etc."
        string eventDate "YYYY-MM-DD"
        string takenAt "ISO Timestamp"
        string takenBy "Servant name/email"
        map statuses "kidId -> present | absent | excused"
        map notesByKid "kidId -> pastoral note text"
        string recurringSeriesId "Optional batch recurrence ID"
        timestamp createdAt
        timestamp updatedAt
    }

    HOME_VISITS {
        string id PK "Random Firestore Auto-ID"
        string academicYearId FK
        string classId FK
        string kidId FK
        string visitDate "YYYY-MM-DD"
        string type "home_visit | phone_call | hospital | church_1on1"
        array visitorMisterIds "List of attending servant IDs/emails"
        string notes
        boolean needsFollowUp
        string followUpDate "YYYY-MM-DD"
        timestamp createdAt
        timestamp updatedAt
    }
```

---

## 🏛️ Multi-Tenant Hierarchical Path Topology

```mermaid
graph TD
    Root["/ (Firestore Root)"]
    Root --> GA["global_admins (Collection)"]
    GA --> GALock["_lock (Permanent Immutable Lock)"]
    GA --> GAUser["{adminUid} (Root Owner Profile)"]

    Root --> Churches["churches (Collection)"]
    Churches --> ChurchDoc["{churchId} (Tenant Document)"]

    ChurchDoc --> Misters["misters (Subcollection, Keyed by Email)"]
    ChurchDoc --> SGs["serviceGroups (Subcollection)"]
    ChurchDoc --> AYs["academicYears (Subcollection)"]
    ChurchDoc --> Kids["kids (Subcollection)"]
    ChurchDoc --> Classes["classes (Subcollection)"]

    Kids --> Versions["versions (Audit Subcollection)"]

    AYs --> AYClasses["classes/{classId} (Scoped Instance)"]
    AYClasses --> AttEvents["attendanceEvents (Session Logs)"]
    AYClasses --> Visits["visits (Pastoral Care Logs)"]
```

---

## 🛡️ Security & Role-Based Access Control (RBAC)

Oikonomos enforces multi-tenant zero-trust security at the Cloud Firestore database layer (`firestore.rules`). Client-supplied queries are strictly evaluated against authenticated session tokens and verified servant records.

### RBAC Permission Matrix

| Database Entity / Path | Global Admin | Church Admin | Group Admin | Group Servant | Class Servant | Viewer / Unassigned |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`/global_admins/_lock`** | Read (Create once) | Read Only | Read Only | Read Only | Read Only | Read Only |
| **`/global_admins/{adminId}`** | Read / Write | No Access | No Access | No Access | No Access | No Access |
| **`/churches/{churchId}`** | Full CRUD | Full CRUD | Read Only | Read Only | Read Only | Read Only |
| **`.../academicYears/{yearId}`** | Full CRUD | Full CRUD | Read Only | Read Only | Read Only | Read Only |
| **`.../misters/{misterEmail}`** | Full CRUD | Full CRUD | Read Only | Read Only | Self-Profile Only* | Self-Profile Only* |
| **`.../serviceGroups/{groupId}`**| Full CRUD | Full CRUD | Full CRUD** | Read Only | Read Only | Read Only |
| **`.../classes/{classId}`** | Full CRUD | Full CRUD | Full CRUD** | Read Only | Read Only | No Access |
| **`.../kids/{kidId}`** | Full CRUD | Full CRUD | Full CRUD** | Read Only** | Read / Edit (Class)* | No Access |
| **`.../kids/{kidId}/versions`** | Full CRUD | Full CRUD | Read Only** | Read Only** | Read Only** | No Access |
| **`.../attendanceEvents/{id}`** | Full CRUD | Full CRUD | Full CRUD** | Full CRUD** | Full CRUD (Class)** | No Access |
| **`.../visits/{visitId}`** | Full CRUD | Full CRUD | Full CRUD** | Full CRUD** | Full CRUD (Class)** | No Access |

*\* **Self-Service Lock:** Servants editing their own profile can modify personal information (`personalInfo`, `displayName`, `lastEditAt`, `lastEditBy`), but are strictly blocked from changing administrative fields (`churchRole`, `active`).*  
*\*\* **Division & Classroom Scoping:** Group-level and class-level roles are strictly scoped to resources matching the user's active assignment. Class servants updating a kid document can edit personal and contact fields, but are permanently locked from modifying `activeAssignment.serviceGroupId` or `academicYearId`.*

---

## 🔒 Security Invariant Decision Flow

```mermaid
flowchart TD
    Req([Client Firestore Request]) --> AuthCheck{request.auth != null?}
    AuthCheck -- No --> Deny[⛔ Permission Denied]
    
    AuthCheck -- Yes --> GlobalCheck{Caller in global_admins?}
    GlobalCheck -- Yes --> AllowGlobal[✅ Unrestricted Master Access]
    
    GlobalCheck -- No --> ChurchCheck{Caller active in churches/churchId/misters?}
    ChurchCheck -- No --> Deny
    
    ChurchCheck -- Yes --> RoleCheck{Caller Church Role?}
    RoleCheck -- Admin --> AllowAdmin[✅ Full Church CRUD Access]
    
    RoleCheck -- Viewer --> ResourceRouter{Target Resource Type?}
    
    ResourceRouter -- Student Profile --> ScopeKid{Assigned to Student Group or Class?}
    ScopeKid -- No --> Deny
    ScopeKid -- Yes --> FieldCheck{Altering Group or Year FK?}
    FieldCheck -- Yes --> Deny
    FieldCheck -- No --> AllowKid[✅ Read / Update Student]
    
    ResourceRouter -- Attendance / Visits --> ScopeClass{Assigned to Target Class?}
    ScopeClass -- No --> Deny
    ScopeClass -- Yes --> AllowSession[✅ Record Attendance / Log Visit]

    ResourceRouter -- Self Profile --> SelfCheck{Editing own email?}
    SelfCheck -- No --> Deny
    SelfCheck -- Yes --> KeysCheck{Altering churchRole or active?}
    KeysCheck -- Yes --> Deny
    KeysCheck -- No --> AllowSelf[✅ Update Personal Info]
```

---

## 📂 Detailed Collection Specifications

### 1. `churches/{churchId}/kids`
*   **Document ID:** Auto-generated 20-character alphanumeric ID (`doc(collection(...))`).
*   **Schema:**
    *   `active` (`boolean`, required): Active status indicator. Inactive kids are archived and hidden from active attendance sheets.
    *   `importBatchId` (`string`, optional): UUID tag linking all records created during a specific spreadsheet import for 1-click batch rollbacks.
    *   `activeAssignment` (`map`, required):
        *   `academicYearId` (`string`): Foreign key to the active term.
        *   `serviceGroupId` (`string`): Foreign key to the department.
        *   `classId` (`string`): Foreign key to the enrolled classroom.
    *   `info` (`map`, required):
        *   `fullName` (`string`): Full student name.
        *   `gender` (`'male' | 'female'`): Student gender.
        *   `dob` (`string`): ISO `YYYY-MM-DD` date of birth.
        *   `school` (`string`): Name of academic school.
        *   `schoolType` (`string`): `'National' | 'International' | custom`.
        *   `deacon` (`boolean`): Ordained altar deacon status.
        *   `fatherOfConfession` (`string`): Name of Father of Confession.
        *   `photoUrl` (`string`): Base64-encoded compressed WebP avatar ($128\times 128$ px, $<6$ KB).
    *   `address` (`map`, optional):
        *   `street`, `building`, `floor`, `apartment`, `region`, `landmark` (`string`).
        *   `geoLocation` (`string`): Standard `geo:lat,lng` URI or universal map coordinate string.
    *   `contacts` (`map`, optional):
        *   `kidMob`, `fatherMob`, `motherMob`, `otherMob` (`string`): Normalized E.164 phone numbers.
        *   `fatherName`, `fatherProfession`, `motherName`, `motherProfession` (`string`).
    *   `notes` (`string`): Multiline pastoral care remarks.
    *   `createdAt`, `lastEditAt` (`string`): ISO 8601 audit timestamps.
    *   `createdBy`, `lastEditBy` (`string`): Author email addresses.

---

### 2. `churches/{churchId}/misters`
*   **Document ID:** Verified Google Account Email address (e.g. `servant.john@gmail.com`).
*   **Schema:**
    *   `authUid` (`string`): Firebase Auth User UID.
    *   `email` (`string`): Google account email.
    *   `displayName` (`string`): Full legal/church name of the servant.
    *   `churchRole` (`'admin' | 'viewer'`): Branch authorization level.
    *   `active` (`boolean`): Active service status.
    *   `personalInfo` (`map`):
        *   `phone` (`string`): Contact mobile number in E.164.
        *   `dob` (`string`): ISO `YYYY-MM-DD` birthdate.
        *   `job` (`string`): Secular profession.
        *   `address` (`string`): Residential address.
        *   `gender` (`'male' | 'female'`).
        *   `notes` (`string`): Administrative remarks.
        *   `photoUrl` (`string`): Base64 compressed WebP photo.
    *   `createdAt`, `lastEditAt` (`string`): Audit timestamps.

---

### 3. `churches/{churchId}/classes`
*   **Document ID:** Semantic or auto-generated ID (e.g. `grade_4_st_george`).
*   **Schema:**
    *   `active` (`boolean`): Active classroom toggle.
    *   `academicYears` (`map`): Multi-term instance map:
        *   `{yearId}` (`map`):
            *   `name` (`string`): Localized class title for this term.
            *   `gradeId` (`string`): Foreign key to the church's `grades` taxonomy.
            *   `serviceGroupId` (`string`): Foreign key to the parent Service Group.
            *   `KidIds` (`array of strings`): Enrolled student IDs array.
            *   `Misters` (`map`): Assigned servant roles (`{ [email]: 'servant' }`).
            *   `MistersIds` (`array of strings`): Fast array search index of servant emails.

---

### 4. `academicYears/{yearId}/classes/{classId}/attendanceEvents`
*   **Document ID:** Unique event ID (e.g. `evt_20261018_lesson1`).
*   **Schema:**
    *   `title` (`string`): Session name (e.g. `David and Goliath`).
    *   `type` (`string`): Ministry event category (`Sunday School`, `Liturgy`, `Trip`, etc.).
    *   `eventDate` (`string`): Strict `YYYY-MM-DD` session date.
    *   `takenAt` (`string | null`): Timestamp when roll-call was finalized.
    *   `takenBy` (`string | null`): Servant name/email who completed roll-call.
    *   `statuses` (`map`): Dynamic student status map (`{ [kidId]: 'present' | 'absent' | 'excused' }`).
    *   `notesByKid` (`map`): Per-student pastoral follow-up notes (`{ [kidId]: string }`).
    *   `recurringSeriesId` (`string`, optional): Links sessions generated via recurring schedule.

---

### 5. `academicYears/{yearId}/classes/{classId}/visits`
*   **Document ID:** Auto-generated visit UUID.
*   **Schema:**
    *   `kidId` (`string`): Foreign key to target student in `kids`.
    *   `visitDate` (`string`): Strict `YYYY-MM-DD` visitation date.
    *   `type` (`'home_visit' | 'phone_call' | 'hospital' | 'church_1on1'`): Interaction mode.
    *   `visitorMisterIds` (`array of strings`): Array of participating servant IDs.
    *   `notes` (`string`): Pastoral discussion minutes and prayer requests.
    *   `needsFollowUp` (`boolean`): Flag marking this case for subsequent review.
    *   `followUpDate` (`string`, optional): Target follow-up date.
