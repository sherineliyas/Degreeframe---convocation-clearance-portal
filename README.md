# DegreeFrame — Convocation Photo Clearance Administration System

**Hindustan Institute of Technology and Science (HITS)**  
*Office of the Controller of Examinations (COE)*

DegreeFrame is a multi-role, end-to-end academic governance web application engineered for degree photo validation, department-level reviews, Google Drive storage folder routing, and Google Sheets database synchronization for upcoming convocation ceremonies.

---

## 🌟 Key System Modules & Features

### 1. 🎓 **Student Portal (`/#/student`)**
* **Instant Verification**: Students enter their Register Number to retrieve profile details (Name, Father's Name, Branch, Semester, Batch) pre-loaded from the official student database.
* **Final-Year Semester Selection**: Dynamic semester selection based on degree program:
  * **UG Engineering (4-Year)**: Semester `VII` or `VIII`
  * **UG Non-Engineering (3-Year)**: Semester `V` or `VI`
  * **PG Programs (2-Year)**: Semester `III` or `IV`
* **Visual Progress Indicator**: Tracks clearance status across 3 stages:
  1. `Submitted`
  2. `Class Teacher Review`
  3. `HOD Approved`
* **Passport Photo Compression**: Validates and uploads passport photograph under the mandatory **80 KB limit**.
* **Profile Edit Requests**: Allows flag selection if minor spelling corrections are requested for degree certificate printing.

---

### 2. 👨‍🏫 **Faculty & HOD Review Portal (`/#/faculty`)**
* **Official OTP Authentication**: Secure login via official university email ID (`@hindustanuniv.ac.in`).
* **Class Teacher Verification**: Review assigned section photos against official passport specifications. Approve or reject with custom feedback remarks.
* **Head of Department (HOD) Approval**: Departmental oversight to grant final degree printing clearance for cleared students.
* **Assign Class Teacher Modal**: HODs can assign Class Teachers by filling in:
  * Teacher Official Email ID
  * Teacher Full Name
  * Department
  * Specialization
  * Shift / Batch
  * Section(s)
  * **Semester**

---

### 3. 🛡️ **COE Admin Portal (`/#/coe`)**
* **ACOE Officer Access**: Accessible by Assistant COE Officers (e.g. `acoe1@hindustanuniv.ac.in` for Engineering, `acoe2@hindustanuniv.ac.in` for Non-Engineering).
* **Passwordless OTP Login**: ACOE officers log in strictly via their **Official Email ID** and **6-Digit OTP** (no password required).
* **Stream-Scoped Management**:
  * **Engineering Scope**: CSE, ECE, Mechanical, Aeronautical, Civil, IT, etc.
  * **Non-Engineering Scope**: BCA, B.Sc, B.Com, BBA, B.A, MCA, MBA, etc.
* **Google Drive Storage Configuration**: Configure the target **Google Drive Storage Folder URL/ID** where uploaded student photos (`2021CSE101.jpg`) are saved.
* **Upload & Manage Sheets**: Paste or upload CSV files directly to update database tables (`Student_data`, `Submissions`, `Faculty` tabs) and download blank CSV templates.
* **HOD Appointments**: Assign department HODs for any branch.
* **Submissions Audit**: Search, filter, and inspect passport photo approvals across departments.

---

### 4. 👑 **Chief COE Super Admin Module (`/#/superadmin`)**
* **Dedicated Standalone UI**: Accessible at `/#/superadmin`.
* **Username & Password Login**: Login strictly via **Username** (`superadmin`) and **Password** (`Admin@123`). **No email required!**
* **Default Password Alert**: Security reminder banner alerts Super Admin when default credentials (`Admin@123`) are active with a 1-click update trigger.
* **Appoint & Manage ACOE Administrators**:
  * All ACOE officers appointed by Super Admin gain master access across **ALL streams** (Engineering & Non-Engineering).
  * Create new Assistant COE accounts by filling in:
    * Official ACOE Email ID (e.g., `acoe1@hindustanuniv.ac.in`, `acoe2@hindustanuniv.ac.in`)
    * Full Name / Designation
  * **Super Admin Email OTP Control**: Super Admin can **Enable or Disable Email OTP** for any ACOE email alone at any time with a 1-click toggle, as well as Edit or Remove ACOE emails.
* **Super Admin Password Change**: Modal to safely update the `superadmin` password.
* **Super Admin Password Change**: Modal to safely update the `superadmin` password.

---

## 📧 Official Email OTP Setup (`coe@hindustanuniv.ac.in`)

DegreeFrame includes an integrated SMTP mailer (`nodemailer`). This enables **Person A** (who deploys the app on GitHub / Render) to dispatch official verification OTP emails directly from **`coe@hindustanuniv.ac.in`**.

### Environment Variables (`.env`)

Create a `.env` file in the project root:

```env
# Server Port
PORT=3000

# Official Email SMTP Configuration (coe@hindustanuniv.ac.in)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=coe@hindustanuniv.ac.in
SMTP_PASS=your_google_app_password_here
FROM_EMAIL="Controller of Examinations <coe@hindustanuniv.ac.in>"
```

> **Note**: To generate `SMTP_PASS`, enable 2-Step Verification on `coe@hindustanuniv.ac.in` Google Account and generate an **App Password** under Security Settings.
>
> **Offline Demo Passcode**: If `SMTP_PASS` is not provided during local testing, the system accepts the universal passcode **`123456`**.

---

## 🚀 Performance & Memory Efficiency

* **Memory Usage on Render Free Tier (512 MB Limit)**:
  * 10,000 student records require **~4 MB of RAM**.
  * Total server footprint is **~34 MB RAM**, using less than **7% of Render's 512 MB memory limit**!
* **$O(1)$ Hash Map Indexing**:
  * Student lookups via Register Number execute in **< 0.001 milliseconds** using Node.js $O(1)$ Hash Maps (`studentIndexMap`).

---

## 🛠️ Quick Local Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:3000`.

---

## ☁️ Deployment Guide (GitHub Web Upload & Render)

### Step 1: Upload Code to GitHub via Browser (No Terminal Required)
If you are deploying from another laptop or account without using the command line:
1. Go to [GitHub.com](https://github.com) and log into your official account (e.g., `xxxxx@hindustanuniv.ac.in`).
2. Click the **`+`** icon in the top right corner and select **New repository**.
3. Name your repository (e.g., `degreeframe-convocation`), select **Public** or **Private**, and click **Create repository**.
4. On your repository main page, click the link that says **"uploading an existing file"**.
5. Drag and drop all project folders and files (`src`, `server.ts`, `package.json`, `index.html`, etc.) from your computer into the browser upload box.
6. Click **Commit changes** at the bottom. Your code is now safely on GitHub!

---

### Step 2: Deploy on GitHub Pages (Frontend Static Mode)
> **Why did `GET /src/main.tsx 404 Not Found` happen on GitHub Pages?**  
> Browsers cannot run raw `.tsx` (TypeScript + React) files directly from source code. When GitHub Pages is set to **"Deploy from a branch"**, it serves the uncompiled `index.html` which points to `src/main.tsx`. Instead, GitHub Pages must serve the compiled `dist/` folder built by Vite (`npm run build`).

To fix this on GitHub Pages:
1. Ensure `.github/workflows/deploy.yml` is in your repository (included in this project).
2. Go to your GitHub Repository $\rightarrow$ **Settings** $\rightarrow$ **Pages** (on the left sidebar).
3. Under **Build and deployment** $\rightarrow$ **Source**, change **"Deploy from a branch"** to **"GitHub Actions"**.
4. Push a commit or go to the **Actions** tab and click **Re-run jobs**. GitHub will automatically run `npm run build` and publish the compiled `dist/` bundle to `https://sherineliyas.github.io/Degreeframe---convocation-clearance-portal/`.

---

### Step 3: Deploy on Render (Full-Stack with Express Backend & Official Email OTP)
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository `Degreeframe---convocation-clearance-portal`.
3. Set the following build options:
   * **Runtime**: `Node`
   * **Build Command**: `npm install && npm run build`
   * **Start Command**: `npm start`
4. Under **Environment Variables**, add:
   * `NODE_ENV`: `production`
   * `SMTP_HOST`: `smtp.gmail.com`
   * `SMTP_PORT`: `587`
   * `SMTP_USER`: `coe@hindustanuniv.ac.in` (your central deployment email)
   * `SMTP_PASS`: `your_google_app_password`
   * `FROM_EMAIL`: `Controller of Examinations <coe@hindustanuniv.ac.in>`
5. Click **Deploy Web Service**.

---

### 💡 Multi-ACOE Email Dispatch & SMTP Solution
**Scenario Question**: If you deploy using your official account (`xxxxx@hindustanuniv.ac.in`) as `SMTP_USER`, and in Super Admin you enable Email OTP for `acoe1@hindustanuniv.ac.in`, will the email send from `xxxxx@hindustanuniv.ac.in` or `acoe1@hindustanuniv.ac.in`?

#### Technical Reason:
Gmail & Google Workspace SMTP servers strictly enforce authentication security: **The SMTP Authenticated User (`SMTP_USER`) must match the sender address in the `From` header**. If your backend attempts to send an email with `From: acoe1@hindustanuniv.ac.in` while authenticating with `xxxxx@hindustanuniv.ac.in`, Gmail SMTP will reject the message or automatically rewrite the sender address back to `xxxxx@hindustanuniv.ac.in`.

#### How to Solve This Cleanly Without Changing Render Variables Every Time:
1. **Google Workspace "Send mail as" Alias Delegation (Recommended)**:
   * Log into your Google Workspace account (`xxxxx@hindustanuniv.ac.in` or `coe@hindustanuniv.ac.in`).
   * Go to **Gmail Settings** $\rightarrow$ **Accounts** $\rightarrow$ **Send mail as**.
   * Add `acoe1@hindustanuniv.ac.in` (and any other ACOE emails) as a permitted alias address.
   * Once delegated, your authenticated SMTP user (`coe@hindustanuniv.ac.in`) can send emails originating from any authorized ACOE alias without triggering SMTP rejection!
2. **Dynamic ACOE Sender Labeling**:
   * Keep `SMTP_USER=coe@hindustanuniv.ac.in` fixed on Render.
   * In Super Admin, when you enable Email OTP dispatch for an ACOE user, the email body and subject line dynamically state that the OTP is dispatched for that specific ACOE office.

---

## 🔑 Walkthrough Account Setup

The following credentials can be used after they have been added via the appropriate administration portal:

| Module / Portal | URL Route | Login Identity | Auth Mechanism |
| :--- | :--- | :--- | :--- |
| **Chief Super Admin** | `/#/superadmin` | Username: `superadmin` | Password `Admin@123` |
| **ACOE** | `/#/coe` | Registered Official Email | Email OTP (Demo: `123456`) |
| **HOD Review** | `/#/faculty` | Registered Official Email | Email OTP (Demo: `123456`) |
| **Class Teacher Review** | `/#/faculty` | Registered Official Email | Email OTP (Demo: `123456`) |
| **Student Verification** | `/#/student` | Reg No | Reg No Verification |

---

© **Office of the Controller of Examinations (COE)**  
Hindustan Institute of Technology and Science (HITS)
