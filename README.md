# BreedSmart

BreedSmart is a comprehensive, multi-platform livestock reproductive-health and field-service management system designed for the farming community of the Municipality of Oton. It bridges the gap between farmers, field veterinary technicians, and municipal agriculture administrators to optimize livestock breeding, veterinary healthcare, and database tracking.

---

## 1. What the Application Is

BreedSmart is a client-server enterprise application composed of an Expo React Native mobile application for offline-capable field operations and a React web dashboard for advanced office workflows, powered by a central Express backend and MongoDB database. It serves as the official registry and service ledger for municipal livestock and breeding operations.

---

## 2. The Problem It Solves

Traditional livestock tracking relies heavily on paper records, manual logs, and disjointed verbal reports. This leads to:
* **Traceability Gaps**: Missing parentage records, untracked breeding attempts, and fragmented animal histories.
* **Operational Inefficiencies**: Difficulty coordinating field service visits, delays in pregnancy confirmation, and lack of real-time status tracking.
* **Data Inconsistencies**: Duplicate records from sync conflicts, human error in calculating gestation or recovery periods, and inaccurate status reporting.
* **Connectivity Hurdles**: Field technicians working in remote barangays with weak or absent internet connections cannot record services in real time.

BreedSmart resolves these issues by centralizing animal histories, automating biological calculations through a shared lifecycle engine, providing strict database transaction safety, and offering an offline-first synchronization architecture for field personnel.

---

## 3. Target Users

The platform classifies access and features based on three core roles:

### Farmer
* Manages owned animals and profiles.
* Submits Artificial Insemination (AI) and veterinary health service requests.
* Reports breeding observations (e.g., return-to-heat, suspected pregnancy).
* Reviews animal history, notifications, and pregnancy/calving timelines.

### Technician
* Performs field services and manages assigned farmers/animals.
* Claims, schedules, and completes service requests.
* Records AI procedures, pregnancy diagnoses, continuation rechecks, calving outcomes, and health assistance.
* Accesses full offline capabilities to record work in remote areas.

### Administrator
* Manages user roles, system configurations, and permissions.
* Monitors system-wide activity, analytics, and operational feeds.
* Corrects records through administrative-only transactional endpoints.
* Generates municipal reports and audits service performance.

---

## 4. Main Features

* **Farmer & Animal Registry**: Core profile management containing location data, owned cattle, species, breed, sex, and age.
* **Artificial Insemination (AI) Management**: Comprehensive procedure logging, sire tracking, and attempt-series sequencing.
* **Breeding Observation Reporting**: Gateway for farmers to report animal heat signs or suspected pregnancy.
* **Method-Based Pregnancy Diagnosis**: Support for ultrasound and rectal palpation checks with custom timing validation.
* **Continuation Pregnancy Rechecks**: Follow-up diagnostics that update active pregnancy states rather than duplicating records.
* **Idempotent Calving & Offspring Registration**: Unified logging of calving events with support for live births, stillbirths, mixed deliveries, and abortions. It automatically registers the newborn offspring in the database.
* **Health & Veterinary Assistance**: Tracking of medical requests, treatment urgency (Emergency vs. Routine), administered medications, dosage, and withdrawal period alerts.
* **Schedule & Calendar**: Real-time calendar dashboard mapping scheduled service visits and overdue follow-ups.
* **Notification System**: In-app and push notifications for service approvals, schedule updates, and critical reminders.
* **Reporting & Analytics**: Exporters for official records and dashboards displaying aggregate reproductive outcomes.

---

## 5. Platform Responsibilities

To maintain a clean division of labor, each platform targets specific operational workflows:

```
┌────────────────────────────────────────────────────────────────────────┐
│                              BreedSmart                                │
│                       Functional Division Matrix                       │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ Platform          │ Target User(s)    │ Core Responsibility            │
├───────────────────┼───────────────────┼────────────────────────────────┤
│ Mobile App        │ Farmers,          │ Request creation, field data   │
│ (Expo / React Native)│ Technicians    │ collection, offline queuing    │
├───────────────────┼───────────────────┼────────────────────────────────┤
│ Web Dashboard     │ Technicians,      │ Schedule management, reports,  │
│ (React + Vite)    │ Administrators    │ data correction, configurations│
├───────────────────┼───────────────────┼────────────────────────────────┤
│ Express Backend   │ System            │ Business logic, transactional  │
│ & Workers         │                   │ persistence, background jobs   │
└───────────────────┴───────────────────┴────────────────────────────────┘
```

* **Mobile Farmer**: Initiates requests, views animal health cards, tracks technician visits, and reports observations.
* **Mobile Technician**: Optimized for field services. Claims requests, uses the offline queue to record procedures without connectivity, and visualizes immediate tasks.
* **Web Technician**: Primarily used in-office for managing the service requests queue, scheduling field assignments, viewing high-density logs, and exporting reports.
* **Web Admin**: Oversees user registrations, updates system configurations, modifies incorrect logs, and reviews performance analytics.
* **Backend**: Enforces security policies, runs background processes (via Inngest), manages Clerk user sessions, and coordinates Mongoose database transactions.

---

## 6. System Architecture

BreedSmart is architected as a decoupled, multi-platform client-server system. Below is a structural view of how components interact:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                              BreedSmart                                │
│                     System Architecture Overview                       │
└────────────────────────────────────────────────────────────────────────┘
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         ▼                                                     ▼
┌──────────────────┐                                   ┌────────────────┐
│   Mobile App     │                                   │    Web App     │
│  (Expo Router)   │                                   │ (React + Vite) │
├──────────────────┤                                   ├────────────────┤
│  Farmer Role     │◄───────── REST API (Clerk Auth) ─►│  Admin Role    │
│  Technician Role │                                   │  Tech Role     │
└────────┬─────────┘                                   └───────┬────────┘
         │ (Offline Queue / sync)                              │
         ▼                                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            Express Backend                             │
├────────────────────────────────────────────────────────────────────────┤
│         REST API Endpoints   │   Inngest Background Jobs               │
├────────────────────────────────────────────────────────────────────────┤
│         CattleCore Domain Logic (Shared reproductive rules)             │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        MongoDB Database (Mongoose)                     │
│                        (Transactions & Schema validation)              │
└────────────────────────────────────────────────────────────────────────┘
```

* **API Client Communication**: Clients communicate with the backend via a REST API secured by Clerk authentication.
* **Background Jobs**: Inngest serves as the queue runner executing background automation (like schedule reminders and follow-up creation).
* **Database Layer**: MongoDB is queried via Mongoose schemas. Mongoose Transactions protect multi-document writes (such as calving registrations and pregnancy checks).

---

## 7. Architectural Principles

1. **Smart Client / Secure Server**: While client apps manage UI validation and optimistic updates, the backend server remains the absolute authority for data validation, eligibility enforcement, and persistent state.
2. **Backend-Authoritative Validation**: All reproductive constraints (e.g., Voluntary Waiting Period, gestation times) are validated on the server side prior to saving.
3. **Domain-Driven Workflow Logic**: Core lifecycle workflows are encapsulated within domain service files rather than scattered in endpoint controllers.
4. **Shared Workflow Vocabulary**: A unified set of statuses and outcomes is maintained across all layers to ensure frontend screens and backend logic align.
5. **Offline-Capable Mobile Operations**: Field inputs are captured locally via an offline mutation queue and synchronized sequentially when internet connectivity is re-established.
6. **Transaction-Safe Critical Workflows**: Business actions modifying multiple documents (like registering a calving event, updating the mother, completing the pregnancy record, and adding offspring) are executed inside atomic MongoDB transactions to prevent orphaned data.
7. **Idempotency & Reconciliation**: Synchronizing queued offline requests uses unique idempotency keys to ensure multiple retries do not result in duplicate records.
8. **Reusable UI & Presentation Components**: Styling relies on shared design systems and Tailwind/DaisyUI configurations to enforce visual consistency.

---

## 8. Technology Stack

### Mobile
* **Core Framework**: React Native, Expo (v54), Expo Router
* **Language**: TypeScript
* **State & Networking**: TanStack Query (React Query)
* **Styling**: NativeWind (Tailwind CSS for React Native)
* **Icons & UI**: Lucide React Native, Sonner Native, React Native Safe Area Context

### Web
* **Core Framework**: React (v19), Vite
* **Routing**: React Router (v7)
* **Styling & Components**: Tailwind CSS, DaisyUI (v5)
* **Icons**: Lucide React

### Backend
* **Core Environment**: Node.js (>=20.0.0)
* **Framework**: Express.js
* **Database & ORM**: MongoDB, Mongoose
* **Event Dispatcher**: Inngest
* **Security & Middleware**: CORS, Express Rate Limit, Multer (file uploads)

### Authentication & Security
* **User Identity**: Clerk (Clerk Expo / Clerk SDK Node)
* **Role Enforcement**: Middleware checks for Farmer, Technician, and Admin authorizations.
* **Data Protection**: Document updates are validated using transactional ownership checks.

### Development & Quality Assurance
* **Version Control**: Git & GitHub
* **Linting & Code Style**: ESLint
* **TypeScript Compiler**: TSC for static analysis
* **Testing Engines**: Node.js Test Runner (backend), Vitest (web)

---

## 9. Repository Structure

```text
Ilo-AgriculturesOffice-System/
├── backend/            # Express backend, Mongoose models, Inngest jobs, and tests
├── mobile/             # Expo React Native mobile application for iOS and Android
├── web/                # React Vite web dashboard for technicians and admins
├── docs/               # System architecture documents and completion plans
├── AGENTS.md           # LLM agent instructions and repository rules
├── PRODUCT.md          # Core product requirements and design constraints
└── README.md           # Main project overview (this file)
```

---

## 10. Core Workflows

### Artificial Insemination (AI) Workflow
1. A **Farmer** requests AI or a **Technician** records a walk-in AI.
2. The request moves to `Pending`. A technician accepts the request, moving it to `Scheduled`.
3. The technician completes the procedure in the field, submitting the AI details.
4. The system validates the animal against the **Voluntary Waiting Period (VWP)** and writes the insemination record, changing the animal's reproductive status to `Inseminated`.
5. An Inngest background job registers a follow-up task for a **Pregnancy Diagnosis** (typically due after 60 days).

### Pregnancy Diagnosis Workflow
1. The system flags the animal as needing a pregnancy check.
2. The technician performs a diagnosis (ultrasound or rectal palpation) and submits the outcome.
3. The database updates in a transaction:
   * If `Pregnant`: Animal reproductive status updates to `Pregnant`, and the active insemination is marked as successful.
   * If `Empty` (Not Pregnant): Animal reproductive status is reset, and the insemination is closed as unsuccessful.
   * If `Needs Recheck`: The active insemination status remains pending, and a new follow-up check task is registered.
   * If `Return-to-Heat`: The active insemination is closed, and the animal is flagged for re-insemination.

### Calving & Offspring Registration Workflow
1. For a `Pregnant` animal, a calving event is recorded by the technician or farmer.
2. The calving controller opens a transaction:
   * Saves the `Calving` record.
   * Updates the mother's reproductive status back to `Normal` (or `Postpartum`).
   * Marks the associated pregnancy record as resolved.
   * Registers newborn offspring automatically under the farmer's ownership list.
3. If the request is retried (e.g., from an offline sync queue), database constraints using the `pregnancyId` prevent duplicate calving or offspring records.

---

## 11. Installation & Development Setup

### Prerequisites
* **Node.js**: Version 20.0.0 or higher.
* **MongoDB**: A running local MongoDB instance or a MongoDB Atlas connection string.
* **Expo Go**: Installed on your physical Android or iOS device to run the mobile client.
* **Git**: Installed for version control.

### Step 1: Clone the Repository
```bash
git clone https://github.com/Error-404-not-found-org/Ilo-Agricultures-Office-System.git
cd Ilo-Agricultures-Office-System
```

### Step 2: Backend Setup
1. Navigate to the backend directory and install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
3. Populate the required environment variables in `.env` (see the [Environment Variables](#12-environment-variables) section below).
4. Run database migrations and seed default data:
   ```bash
   # Run reproductive lifecycle configurations
   npm run seed:reproduction-lifecycle

   # Run vocabulary status migration
   npm run migrate:status-vocabulary
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

### Step 3: Web Dashboard Setup
1. Navigate to the web directory and install dependencies:
   ```bash
   cd ../web
   npm install
   ```
2. Create a `.env` file in the web folder containing:
   ```env
   VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   VITE_API_URL=http://localhost:3030/api
   VITE_VOICEFLOW_PROJECT_ID=your_voiceflow_project_id
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```

### Step 4: Mobile App Setup
1. Navigate to the mobile directory and install dependencies:
   ```bash
   cd ../mobile
   npm install
   ```
2. Create a `.env` file in the mobile folder containing:
   ```env
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   EXPO_PUBLIC_API_URL=http://<your-local-ip-address>:3030/api
   ```
3. Start Expo:
   ```bash
   npm start
   ```

### Android Physical-Device Development
To test the mobile app on a physical Android device while connecting to your local development backend:
1. Ensure both your computer and mobile device are connected to the **same Wi-Fi network**.
2. Find your computer's local IP address (e.g., `192.168.1.XX`).
3. Set `EXPO_PUBLIC_API_URL` in `mobile/.env` to `http://192.168.1.XX:3030/api` (replace `3030` if your backend port differs).
4. Ensure your backend server is accessible via your local network.
5. Scan the QR code displayed in the terminal using the Expo Go app.

---

## 12. Environment Variables

### Backend Configuration (`backend/.env`)
Provide placeholders for secrets. Do not publish production credentials.

```env
NODE_ENV=development
PORT=3030
DB_URL=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/breedsmart
DB_URL_DEV=mongodb://localhost:27017/breedsmart

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Inngest Background Worker
INNGEST_SIGNING_KEY=sign_...
INNGEST_EVENT_KEY=key_...

# Cloudinary Storage
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name

# Administrative Defaults
ADMIN_EMAIL=admin@breedsmart.gov

# APIs and Third Parties
GEMINI_API_KEY=your_gemini_key
VOICEFLOW_API_KEY=VF.your_voiceflow_key
CLIENT_URL=http://localhost:5173

# SMS Gateway Configuration
IPROG_SMS_ENABLED=false
IPROG_SMS_API_TOKEN=your_iprogsms_token
IPROG_SMS_BASE_URL=https://www.iprogsms.com/api/v1
```

### Web Configuration (`web/.env`)
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:3030/api
VITE_VOICEFLOW_PROJECT_ID=your_voiceflow_project_id
```

### Mobile Configuration (`mobile/.env`)
```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_API_URL=http://<local-ip-address>:3030/api
```

---

## 13. Testing and Validation

BreedSmart uses automated tests alongside comprehensive manual validation scenarios.

### Automated Test Runs
Execute these commands locally to verify syntax, compiling, and logical constraints:

* **Backend Unit & Domain Tests**:
  Runs CattleCore logic tests and route controllers.
  ```bash
  cd backend
  npm test
  ```
  *(Alternative manual CattleCore script validation: `node scratch-check-cattlecore.js`)*
* **Mobile TypeScript Verification**:
  ```bash
  cd mobile
  npx tsc --noEmit
  ```
* **Mobile Linting**:
  ```bash
  cd mobile
  npm run lint
  ```
* **Web Unit Tests**:
  ```bash
  cd web
  npm run test
  ```
* **Web Linting**:
  ```bash
  cd web
  npm run lint
  ```
* **Web Production Compiler**:
  Verifies successful production packaging.
  ```bash
  cd web
  npm run build
  ```

### Manual Testing Scenarios
All major changes require manual verification against our role matrix:
* **Lifecycle Validation**: Enforce that males cannot be inseminated or calving logged, VWP controls block premature rechecks, and gestation boundaries are obeyed.
* **Offline Verification**: Disable network access on mobile, perform multiple registrations/records, restart the application, re-establish connection, and check that sync occurs sequentially without duplication.
* **Role-Based UAT**: Ensure that a Farmer cannot access technician-only dashboards or edit veterinarian health cards, and verify that technician updates propagate correctly to the farmer's feed.
* **Responsive & UI Check**: Test all web directories on laptops and tablets. Verify that dark mode is fully supported and that labels display properly in both English, Filipino, and Hiligaynon.

---

## 14. Current Project Status

BreedSmart is currently in an active developmental stage. The following summarizes our progress:

* **Backend Services**: **82% Complete**. The core database models, transactional service layers, domain validation rules, and Inngest integrations are largely implemented and tested.
* **Mobile Platform**: **68% Complete**. Core mobile screens for Farmers and Technicians are operational. Offline queuing and transaction sequence execution are implemented, with final physical device verification in progress.
* **Web Technician Portal**: **73% Complete**. Terminology alignment and page navigations are functional. Search, discovery, and animal histories are connected to the live backend, and visual/responsive refinements are ongoing.
* **Web Admin Panel**: Review, security checks, audit ledger, and final completion tasks are still pending.
* **Overall Release Status**: Awaiting cross-platform User Acceptance Testing (UAT), localized language wrap reviews, and deployment hardening.

---

## 15. Documentation References

For in-depth design details, refer to the following local documentation:

* **[Master Web, Mobile, and Backend Completion Plan](file:///docs/master-web-mobile-completion-plan.md)**: Main checklist mapping task completions and remaining deliverables.
* **[Phase 0 Route & Endpoint Inventory](file:///docs/phase-0-route-endpoint-inventory.md)**: Complete mapping of active UI actions to canonical backend routes.
* **[Web Technician UI Improvement Plan](file:///docs/web-technician-ui-improvement-plan.md)**: Design system requirements and terminology updates for the web dashboard.
* **[Workflow and Offline Consolidation Plan](file:///docs/workflow-and-offline-consolidation-plan.md)**: Integration rules for offline queues, transactional operations, and status constants.

---

## 16. Contributors and Acknowledgements

This system was created and is maintained for the **Ilo Agriculture Office** to support local livestock development. We acknowledge the veterinary technicians, administrative staff, and farmers of Oton who contributed user feedback and operational domain knowledge to make this platform possible.
