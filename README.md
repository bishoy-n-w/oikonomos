# Oikonomos: Sunday School Admin & CRM

Oikonomos (Greek: *steward* or *household manager*) is a modern, responsive, and task-oriented administrative web application designed to help Sunday School coordinators and servants organize records, directories, attendance, and student pastoral care across mobile and desktop.

![Oikonomos Preview](public/icons.svg)

---

## 🌟 Key Features

- **Responsive Dual-Mode UX:** Desktop high-density data tables and mobile touch-friendly cards with quick shortcuts (Call Father, Call Mother, WhatsApp, GPS Navigation).
- **Google Contacts Cloud Sync:** Synchronizes Sunday School student and parent contact numbers directly to your connected Google Account via the Google People API, making them immediately accessible in your phone's native dialer and WhatsApp.
- **4-Tier Cascading Filter:** Global Church ➔ Academic Year ➔ Service Group ➔ Class context filtering with dynamic context badges in the mobile app bar.
- **Smart Data Import & 1-Click Rollback:** Excel and CSV student onboarding with automatic header mapping, Arabic encoding auto-detection, and safe batch rollbacks.
- **Role-Based Access Control:** Real-time authorization gating (Owner, Church Admin, Group Admin, Class Servant, Viewer).
- **Gamified Attendance Tracker:** 3-state tactile controller (Present / Absent / Excused) with live metrics and instant absence follow-up shortcuts.
- **Pastoral Care & Home Visits:** Visitation health tracking, cross-platform turn-by-turn navigation (Apple/Google Maps), and location pinning.
- **Bilingual (English / Arabic RTL):** Full 180° right-to-left layout mirroring and localization.
- **Light & Dark Mode:** Material teal aesthetic with instant theme switching.
- **PWA Ready:** Installable directly to home screens on iOS and Android.

---

## 🚀 Run Your Own Free Instance (Fork & Publish Guide)

Oikonomos is architected to be **100% free to host and operate forever**. By combining GitHub Pages and Firebase's Spark (Free) Tier, any church can fork this repository and launch their own secure, private CRM with **zero monthly costs**.

Follow these 7 steps to get your own instance running in less than 10 minutes:

### Step 1: Fork this Repository
1. Click the **Fork** button at the top right of this GitHub page.
2. Choose your personal account or church organization as the destination.
3. Keep the repository name or change it (e.g., `sunday-school-crm`).

### Step 2: Set Up a Free Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **Add project**.
2. Name your project (e.g., `my-church-crm`). *You can disable Google Analytics to keep things simple.*
3. **Enable Authentication:**
   - Go to **Build ➔ Authentication ➔ Get started**.
   - Under the **Sign-in method** tab, click **Google**, enable it, select a support email, and click **Save**.
4. **Enable Cloud Firestore Database:**
   - Go to **Build ➔ Firestore Database ➔ Create database**.
   - Choose a location close to you and start in **Production mode**.
   - **Important:** Click the **Rules** tab, delete the default rules, paste the entire contents of the `firestore.rules` file from this repository, and click **Publish**. *(These rules secure student data and handle the Day-0 bootstrap lock).*
5. **Register Your Web App:**
   - Go to **Project Settings** (the gear icon ⚙️) ➔ **General**.
   - Scroll down to "Your apps" and click the **Web icon (`</>`)**.
   - Enter a nickname (e.g., `Oikonomos Web`) and click **Register app**.
   - Copy the `firebaseConfig` JSON object provided on the screen. Keep it handy for Step 4.

### Step 3: Enable Google Contacts Sync (Optional but Recommended)
1. From Firebase Project Settings, click on the **Google Cloud Platform (GCP)** link, or go to the [GCP Console](https://console.cloud.google.com/).
2. Navigate to **APIs & Services ➔ Library**.
3. Search for **Google People API** and click **Enable**.
4. Navigate to **APIs & Services ➔ OAuth consent screen**:
   - Choose **External** user type and click Create.
   - Fill in the App Name and Support Emails.
   - Click **Add or Remove Scopes**, search for `.../auth/contacts` and check it.
   - If your app is in "Testing" mode, add the Google emails of your admins to the **Test users** list. Alternatively, publish the app.

### Step 4: Configure GitHub Secrets (Deployment Credentials)
1. Go to your forked repository on GitHub.
2. Navigate to **Settings ➔ Secrets and variables ➔ Actions**.
3. Click **New repository secret**.
4. Name the secret `FIREBASE_CONFIG_JSON`.
5. In the Secret field, paste the exact JSON configuration you copied in Step 2:
   ```json
   {
     "apiKey": "AIzaSy...",
     "authDomain": "your-project.firebaseapp.com",
     "projectId": "your-project",
     "storageBucket": "your-project.firebasestorage.app",
     "messagingSenderId": "123456789",
     "appId": "1:1234:web:5678"
   }
   ```
   *(Note: The deployment pipeline also supports individual secrets like `VITE_FIREBASE_API_KEY` if you prefer).*

### Step 5: Enable GitHub Pages & Deploy
1. In your GitHub repository, go to **Settings ➔ Pages**.
2. Under **Build and deployment ➔ Source**, select **GitHub Actions**.
3. Ensure Actions have permissions to run: **Settings ➔ Actions ➔ General ➔ Workflow permissions**: check **Read and write permissions**.
4. Go to the **Actions** tab at the top of your repository.
5. Click **Deploy Web App to GitHub Pages** on the left.
6. Click **Run workflow** ➔ Select branch `main` ➔ **Run workflow**.
7. Wait 1-2 minutes. Once it turns green, your CRM is live! You will see the URL (e.g., `https://<your-username>.github.io/<repo-name>/`).

### Step 6: Authorize Your New Domain
1. Return to the **Firebase Console**.
2. Go to **Authentication ➔ Settings ➔ Authorized domains**.
3. Click **Add domain** and enter your GitHub Pages domain (e.g., `your-username.github.io`).

### Step 7: Day-0 Bootstrap (Become the Super Admin)
1. Visit your newly published live URL.
2. Click **Sign in with Google** and log in with your personal account.
3. Because the database is brand new, you must register yourself as the Global Admin:
   - **Recommended Approach:** Go back to the **Firebase Console ➔ Firestore Database ➔ Data**.
   - Click **Start collection** and name it `global_admins`.
   - For the **Document ID**, enter your exact Google UID (you can find this in Firebase ➔ Authentication ➔ Users ➔ "User UID").
   - Add fields: `email` (string, your email), `role` (string, `owner`), and optionally create a second document named `_lock` with `initialized: true` to lock the gate permanently.
4. Refresh your web app. You are now the Super Owner!
5. Navigate to **Church Admin** in the sidebar to create your first Church, Academic Year, and Classes. Enjoy!

---

## 💻 Local Development

Want to contribute or customize the code?

1. **Clone your fork:**
   ```bash
   git clone https://github.com/your-username/oikonomos.git
   cd oikonomos
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Firebase credentials in `.env.local`.

4. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

5. **Run tests & linter:**
   ```bash
   npm run lint
   npm test
   ```

---
*Built with ❤️ for Sunday Schools everywhere. 100% Free and Open Source.*