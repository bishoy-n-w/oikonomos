# Oikonomos: Core User Scenarios & Pastoral Workflows

This document defines the high-signal user stories and scenarios for Oikonomos, modeled after the clarified structure where **"Families" are actually Service Groups / Departments** (teams of servants managing an age cohort or grade department).

---

## 👥 Core Personas

### 1. The Coordinator (Overall Administrator)
*   **Mission:** Ensures operational order across the entire Sunday School branch.
*   **Key Responsibilities:** Onboarding, servant assignments, class department structuring, and term transitions.

### 2. The Servant (Pastoral Teacher)
*   **Mission:** Delivers weekly spiritual lessons and pastoral care to a specific class.
*   **Key Responsibilities:** Weekly attendance tracking, calling absentees, and logging home visits.

---

## 📂 Structural Definitions (The Domain Model)
*   **Church:** The top-level tenant.
*   **Servant (Mister):** An authenticated teacher or admin.
*   **Service Group (Osra / Department):** A pastoral department managing a specific age group (e.g., *Junior High Service Group* or *Grade 5-6 Department*). It is composed of multiple classes and a team of assigned servants.
*   **Class:** A specific classroom unit (e.g., *Grade 5 Boys Class*, *Grade 6 Girls Class*).
*   **Child (Kid):** A Sunday School student, registered with parent contacts.
*   **Academic Year:** A term calendar (e.g., *Academic Year 2026*).
*   **Class Assignment (Class Instance):** Binds a **Class** to a **Service Group (Department)** and a **Grade Level** for a specific Academic Year.

---

## 📋 Standalone User Scenarios (User Stories)

### 🎯 Scenario 1: Structuring a Service Group / Department (Coordinator)
> **As a** Sunday School Coordinator,  
> **I want to** create a Service Group (Department) and assign a team of servants to manage it,  
> **So that** they can collaborate on teaching and pastoring that specific age group.

*   **Workflow:**
    1.  The Coordinator opens the control panel and adds a new **Service Group** (e.g., *"Junior High Group"*).
    2.  They select the group and click **Assign Servants**.
    3.  They select servants from the registry (e.g., *Mister Bishoy*, *Mister Mark*) and assign them roles (e.g., *Department Head*, *Assistant*).
*   **UX Expectation:** A smooth, visual drag-and-drop or checklist interface to assign teachers to departments in bulk, rather than manually typing IDs.

---

### 🎯 Scenario 2: Quick Onboarding of a New Child (Coordinator/Servant)
> **As a** servant,  
> **I want to** quickly register a new child who just walked in, record their parents' contact details, and assign them to their Grade Class immediately,  
> **So that** they don't get lost in the system and are included in today's attendance sheet.

*   **Workflow:**
    1.  The servant clicks **Onboard Student** on the dashboard.
    2.  They enter the child's full name, date of birth, parent names, phone numbers, and address.
    3.  The form automatically suggests the appropriate **Service Group (Department)** and **Class** based on the child's age/grade.
    4.  The servant clicks **Confirm** and the student is instantly added to today's active attendance checklist.
*   **UX Expectation:** A single, atomic, beautifully wizard-driven form that handles parent details, child profile, and class enrollment simultaneously.

---

### 🎯 Scenario 3: Weekly Attendance Taking & Absentee Flags (Servant)
> **As a** Sunday School Teacher,  
> **I want to** visually record who is present or absent in my class on Sunday morning, and immediately see who has been absent for 3 consecutive weeks,  
> **So that** I can focus my pastoral calls on the children who are dropping out.

*   **Workflow:**
    1.  The teacher opens the **Attendance Tracker** for their assigned class.
    2.  They see a clean roster with child photos/avatars.
    3.  Next to each name, a visual grid displays recent history (e.g., `🟢 🟢 🔴 🔴`).
    4.  If a child has been absent for 3+ weeks, a bold **"Red Alert: Absentee!"** badge appears.
    5.  The teacher taps the toggle buttons (**Present**, **Absent**, **Excused**) for each child and clicks **Save**.
*   **UX Expectation:** Quick, physical-tap interface optimized for mobile and tablets. Zero text entry or keyboard typing required for standard attendance.

---

### 🎯 Scenario 4: Post-Class Absentee Follow-up & Home Visit Logging (Servant)
> **As a** Sunday School Teacher,  
> **I want to** view a child's complete spiritual profile (parent contact, past absences, and home visit logs) and register a new home visit or pastoral call in one click,  
> **So that** my pastoral follow-up notes are organized and visible to the whole Service Group.

*   **Workflow:**
    1.  The teacher taps on an absentee's name (e.g., *Mark*).
    2.  A sliding **Pastoral Profile** slides open showing:
        *   Mother and Father phone numbers with one-tap buttons to **Call** or launch **WhatsApp**.
        *   A historical timeline of previous home visits made by other servants in the same Department.
    3.  The teacher visits Mark at home, opens his profile, and clicks **Log Visit**.
    4.  They select the visit date, type pastoral notes (e.g., *"Mark was sick, family requested prayers"*), and click save.
*   **UX Expectation:** All pastoral interactions (calls, visits) should be stored in a timeline format like a patient chart or CRM contact feed, fully accessible to all servants assigned to that department.

---

### 🎯 Scenario 5: Annual Promotion & Class Archiving (Coordinator)
> **As a** Sunday School Coordinator,  
> **I want to** start a new academic year, promote all children to their next grade-level classes in bulk, and preserve historical profiles,  
> **So that** the new term starts with clean sheets while past attendance is archived.

*   **Workflow:**
    1.  At the end of summer, the Coordinator clicks **Promote Year**.
    2.  They create the new Academic Year (e.g., *2027*).
    3.  The system displays a mapping table (e.g., *Grade 4 Boys -> Grade 5 Boys*).
    4.  The Coordinator clicks **Apply Promotion**.
    5.  The system automatically increments the grade level for all students, migrates them to the new class instances, and archives their old-year attendance logs.
*   **UX Expectation:** A highly visual batch confirmation view. No child is modified manually one-by-one.
