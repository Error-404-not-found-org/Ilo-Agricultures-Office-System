# BreedSmart QA Setup Guide

## Purpose

This document explains how every QA tester prepares their laptop, mobile device, and testing environment before participating in BreedSmart QA Round 1.

All testers must complete this setup before executing any workbook.

This guide ensures that every tester is using the same source code, backend, database, and application version so that reported defects are reproducible.

---

# 1. QA Environment Rules

All testing must use the following:

- QA branch only
- Development Backend only
- Development/Test MongoDB only
- Clerk Development instance only
- Assigned QA accounts only

Never:

- Use Production Backend
- Use Production Database
- Run the lifecycle seeder without QA Lead approval
- Edit MongoDB records manually
- Commit `.env` files, Clerk secrets, API tokens, or database credentials

---

# 2. Required Software

Every laptop should have the following installed.

## Windows

- Git
- Node.js LTS
- npm
- VS Code
- Google Chrome
- Android Studio (SDK + Platform Tools)
- Android Platform Tools (ADB)

Verify installation:

```powershell
git --version
node -v
npm -v
adb version
```

If any command fails, install the missing software before continuing.

---

# 3. Clone the Repository (First Time Only)

Skip this section if the repository already exists.

```powershell
git clone <YOUR_GITHUB_REPOSITORY>

cd Ilo-AgriculturesOffice-System
```

---

# 4. Switch to the QA Branch

Every tester must use the QA branch.

```powershell
git fetch origin

git switch codex/mobile-readiness-checkpoint

git pull --ff-only origin codex/mobile-readiness-checkpoint
```

If Git reports conflicts or local modifications, contact the QA Lead before continuing.

---

# 5. Verify the Baseline Commit

Run:

```powershell
git log -1 --oneline
```

Example:

```text
8a34d2b Prepare QA Round 1
```

Compare the commit hash with the **Baseline Commit** recorded in the QA Lead Progress Tracker.

If the hashes do not match:

**STOP TESTING**

Pull the latest changes or ask the QA Lead for assistance.

Every tester must always be on the exact same commit.

---

# 6. Install Project Dependencies

## Backend

```powershell
cd backend

npm install
```

## Mobile

```powershell
cd mobile

npm install
```

## Web

```powershell
cd web

npm install
```

Return to the project root when finished.

---

# 7. Configure Environment Variables

The QA Lead will privately distribute the required Development environment values.

Examples include:

- Backend API URL
- Clerk Publishable Key
- Development API endpoints

Never:

- Commit `.env`
- Share Clerk Secret Keys
- Share MongoDB credentials
- Share API tokens

---

# 8. Backend Setup

Start the Backend:

```powershell
cd backend

npm run dev
```

Verify:

- Backend starts successfully
- MongoDB connects
- Clerk initializes
- No startup errors appear
- API responds successfully

Leave the Backend running if instructed by the QA Lead.

---

# 9. Technician Web Setup

Start the Web application.

```powershell
cd web

npm run dev
```

Verify:

- Login page opens
- Technician Dashboard loads
- No fatal console errors
- API requests succeed

---

# 10. Mobile Setup

## Enable Developer Options

On the Android device:

Settings

→ About Phone

→ Tap **Build Number** seven (7) times.

Developer Options should now be available.

---

## Enable USB Debugging

Settings

→ Developer Options

Enable:

- USB Debugging

---

## Connect the Device

Connect the phone using a USB cable.

When prompted:

> Allow USB Debugging?

Select:

✅ Always allow from this computer

Then tap:

**Allow**

---

## Verify ADB Connection

Run:

```powershell
adb devices
```

Expected:

```text
XXXXXXXXXXXX    device
```

If you see:

```text
unauthorized
```

Unlock the phone and approve the USB debugging prompt.

If you see:

```text
offline
```

Disconnect and reconnect the USB cable, then run:

```powershell
adb kill-server

adb start-server

adb devices
```

Continue only when the device status is:

```text
device
```

---

# 11. Start the Mobile Application

If using Expo:

```powershell
cd mobile

npx expo start
```

or

```powershell
npx expo run:android
```

Follow the instructions provided by the QA Lead.

Verify:

- Application launches
- Login screen appears
- API requests succeed
- No fatal runtime errors occur

---

# 12. Test Account Verification

Use only the assigned QA accounts listed in:

**7 - QA Test Accounts.md**

Verify:

- Login succeeds
- Correct role loads
- Assigned dashboard appears
- No unauthorized routes are accessible

---

# 13. Pre-QA Checklist

Before beginning the assigned workbook, confirm:

- [ ] Repository cloned successfully
- [ ] Correct QA branch checked out
- [ ] Latest changes pulled
- [ ] Baseline commit matches QA Lead Tracker
- [ ] Dependencies installed
- [ ] Backend reachable
- [ ] Mobile/Web application launches
- [ ] Assigned QA account can sign in
- [ ] Assigned workbook is available

Only begin testing after every item above has been completed.

---

# 14. Updating to a New QA Build

Whenever the QA Lead announces a new build, every tester must update before continuing.

Run:

```powershell
git fetch origin

git switch codex/mobile-readiness-checkpoint

git pull --ff-only origin codex/mobile-readiness-checkpoint

git log -1 --oneline
```

Confirm that the displayed commit hash matches the new **Baseline Commit** announced by the QA Lead.

Do not continue testing until the commit matches.

---

# 15. Reporting Bugs

When a defect is found:

1. Stop and capture evidence.
2. Do not modify the database.
3. Do not retry repeatedly unless instructed.
4. Complete one **BreedSmart Bug Report**.
5. Notify the QA Lead.
6. Continue with the next independent test unless instructed otherwise.

Never fix defects yourself unless you are assigned as the developer for that issue.

---

# 16. QA Communication Rules

During the coordinated QA session:

- Notify the QA Lead before running the lifecycle seeder.
- Coordinate concurrent claim tests with the assigned Technician testers.
- Do not delete shared RC26 seed data.
- Do not restart shared Backend services without informing the team.
- Inform the QA Lead immediately when a Blocker defect is discovered.
- Pull the latest QA branch whenever a new fix is announced.

---

# 17. End of Testing

After completing the assigned workbook:

- Record PASS, FAIL, BLOCKED, or NOT RUN for every test.
- Submit all completed Bug Reports.
- Attach screenshots and recordings.
- Sign the workbook.
- Notify the QA Lead that testing is complete.

The QA Lead will review all reported defects, coordinate fixes, assign retests, and determine whether the current build is ready to proceed to the next QA stage.