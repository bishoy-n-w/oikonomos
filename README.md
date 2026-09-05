# Oikonomos: Sunday School Admin

Oikonomos (Greek: *steward* or *household manager*) is a modern, responsive, and task-oriented administrative application designed to help Sunday School coordinators and servants organize records, directories, and class attendance with security and ease.

---

## ✨ Features

*   **📊 Analytics Dashboard:** A welcoming dashboard offering real-time stats (enrolled children, active teachers, classes) directly from Firestore.
*   **🧒 Kids Directory:** A visual student database replacing generic text inputs with structured cards, profile avatars, pastoral logging, and visual calendar Date of Birth pickers.
*   **🧑‍🏫 Servants Directory:** An access-controlled teacher directory to manage servant rosters, permissions (`viewer`, `admin`), and phone logs.
*   **📝 Interactive Attendance Console:** A beautifully gamified roster checklist replacing raw JSON maps with color-coded check toggles (**Present**, **Absent**, **Excused**) and inline pastoral remarks.
*   **🔒 Secure Google Authentication:** Safe, secure sign-in with Google, satisfying OAuth policy requirements and protecting administrative records.
*   **⚙️ Structural Settings:** Grouped configurations for Families, Classes, Academic Years, and pastoral Home Visit logs, keeping daily tasks clean and separate.

---

## 🏗️ Architecture

Oikonomos is written in **Flutter 3.x** and uses **Firebase (Auth & Firestore)** for its database layer. The app is fully modularized for maintainability:
```text
lib/
├── main.dart             # App Entry, Firebase initialization & Auth Router
├── constants.dart        # Unified configuration (Reads version from pubspec.yaml)
├── models/
│   └── field_spec.dart   # Relational schemas & dynamic form definitions
├── services/
│   └── auth_service.dart # Firebase Authentication & federated Google login
├── widgets/
│   └── crud_collection.dart # Universal schema-driven CRUD forms & pickers
└── screens/
    ├── main_shell.dart   # Layout Sidebar navigation & top AppBar context
    ├── dashboard_screen.dart # Welcoming landing page with metrics
    ├── kids_directory.dart # Children records portal
    ├── misters_directory.dart # Servants directory portal
    ├── attendance_tracker.dart # Segmented visual attendance sheet
    └── settings_screen.dart # Sub-tab configurations (Classes, Years, Families)
```

---

## 🚀 Secure Setup & Deployment Guide (For Forking/Copying)

If you wish to deploy your own secure instance of Oikonomos, follow these instructions. This repository has been structured to serve as a secure template with private keys completely gitignored.

### 1. Prerequisites
*   [Flutter SDK](https://docs.flutter.dev/get-started/install) installed locally.
*   A [Firebase Project](https://console.firebase.google.com/) created.

### 2. Configure Your Database & Auth
1.  Navigate to your **Firebase Console** -> **Authentication** -> **Sign-in method** and enable the **Google** provider.
2.  Navigate to **Firestore Database** and enable it in production mode.
3.  Deploy the included security rules file (`firestore.rules`) to your Firestore database using the Firebase CLI:
    ```bash
    npm install -g firebase-tools
    firebase login
    firebase init firestore # select your project
    firebase deploy --only firestore:rules
    ```

### 3. Generate Your Private Credentials
To link this Flutter codebase to your newly created Firebase instance, generate your own private options file (it is automatically ignored by Git):
1.  Install the FlutterFire CLI: `dart pub global activate flutterfire_cli`
2.  Generate your config:
    ```bash
    flutterfire configure
    ```
    This automatically creates `lib/firebase_options.dart`, `android/app/google-services.json`, and other platform configuration files locally on your machine.

### 4. Configure Google Cloud OAuth Client
To enable Google Sign-In to function properly on Web and local development:
1.  Go to the [Google Cloud Console Credentials Screen](https://console.cloud.google.com/apis/credentials).
2.  Navigate to **OAuth Consent Screen**, set the App Name to `Oikonomos` and add authorized domains (e.g. `your-project.firebaseapp.com` and `github.io` if publishing on GitHub).
3.  Click your **Web Client ID** and append:
    *   **Authorized JavaScript origins:** `http://localhost`, `https://<your-username>.github.io`
    *   **Authorized redirect URIs:** `https://<your-project>.firebaseapp.com/__/auth/handler`, `https://<your-username>.github.io/oikonomos/`
4.  Save changes.

### 5. Running and Testing Locally
Because Google Sign-In requires your app to run on an authorized callback port, **always boot the local web server on port `5000`**:
```bash
flutter run -d chrome --web-port=5000
```

---

## 🛡️ Firestore Security Rules Blueprint
Oikonomos stores sensitive Personal Identifiable Information (PII) of minors under the age of 13. Security is paramount. 

The file `firestore.rules` is included in this repository. It enforces:
1.  **Authentication:** Blocks all read/write queries unless a user is logged in via Firebase Auth (`request.auth != null`).
2.  **Roster Security:** Validates that the logged-in user is a registered, active servant (`active == true`) in the specific church document they are querying.
3.  **Role Authorization:** Only users with `churchRole: 'admin'` inside their Mister profile can configure meta-collections (like Classes, Families, and Academic Years), preventing regular teachers from modifying configurations.
4.  **👑 Global Master Bypass:** Instantly grants unrestricted read/write access to the entire database for any authenticated user whose UID exists in the root-level `global_admins` collection. Because only project owners with Firebase Console access can manually write to this root collection, this serves as a highly secure, dynamic, and zero-hardcoded super-admin tier.

---

## 🤖 GitHub Actions CI/CD Deployment
This repository includes an automated GitHub Actions workflow (`.github/workflows/deploy_web.yml`) that compiles and publishes the project to GitHub Pages on every push to the `main` branch.

To make the build succeed securely without checking your private credentials into Git:
1.  Copy the full contents of your locally generated `lib/firebase_options.dart` file.
2.  Go to your GitHub repository -> **Settings** -> **Secrets and variables** -> **Actions**.
3.  Add a **New repository secret**:
    *   **Name:** `FIREBASE_OPTIONS_DART`
    *   **Value:** Paste the copied code.
4.  Push your changes! The pipeline will securely pull this secret, compile, and deploy.

---

## 📄 License
This project is licensed under the terms of the **GNU Affero General Public License v3.0 (AGPL-3.0)**. 

### Why AGPL-3.0?
*   **Viral Open Source:** Any user who copies or forks this project is legally required to keep their code and all modifications public under the same AGPL-3.0 license.
*   **Web/SaaS Protection:** If a third party hosts a modified version of this application on a public website as a service, they are legally obligated to make their modified source code available for download to their users for free.
*   **Liability Disclaimer:** The software is provided completely "AS IS" with zero liability or warranties on the original authors.

See `LICENSE` for details.
