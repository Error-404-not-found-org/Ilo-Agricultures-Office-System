# Ilo Agriculture Office System 🐄🌾

[![Status](https://img.shields.io/badge/Status-Development-orange.svg)]()
[![Stack](https://img.shields.io/badge/Stack-MERN%20+%20Expo-blue.svg)]()
[![Architecture](https://img.shields.io/badge/Architecture-Offline--First-green.svg)]()

A comprehensive livestock management and veterinary service platform designed for the Ilo Agriculture Office. This system bridges the gap between farmers and technicians through a high-performance web dashboard and a streamlined mobile application.

---

## 🎓 Capstone Project Documentation
> [!NOTE]
> This system is developed as a formal Capstone Research and Development initiative. For a comprehensive review of the **System Architecture**, **Developmental Methodologies**, and **Operational Manuals**, please refer to the official Technical Manuscript:
>
> 🔗 **[Official Project Documentation](https://docs.google.com/document/d/1IDUMZrsnRKFWEgM076toGD3jdnSDn5FQFA26vg4Pwj0/edit?tab=t.0#heading=h.f28ozy528sjo)**

---

## 🚀 Key Features

### 🖥️ Technician Dashboard (Mission Control)
- **Real-Time Herd Management**: High-density interface for tracking livestock health and breeding cycles.
- **Service Hub**: Quick-action modals for logging "Walk-In" Artificial Insemination (AI) and medical treatments.
- **Smart Data Entry**: Dual-mode entry system supporting both existing records and on-the-fly registrations.
- **Analytics & Feeds**: Live metrics on daily tasks, pending requests, and system-wide activity.

### 📱 Farmer Mobile App
- **Livestock Registry**: Digital profiles for all owned animals with ear-tag tracking.
- **Request Services**: Direct portal for requesting AI or medical assistance.
- **Status Tracking**: Real-time updates on the progress of pending field requests.

### ⚙️ Offline-First Architecture & Core Engine
- **Shared Domain Engine (`cattleCore`)**: Logic-identical modules deployed in typescript ([cattleCore.ts](file:///c:/Users/Acer/Documents/Ilo-AgriculturesOffice-System/mobile/lib/cattleCore.ts)) on mobile and javascript ([cattleCore.js](file:///c:/Users/Acer/Documents/Ilo-AgriculturesOffice-System/backend/src/utils/cattleCore.js)) on the server to compute age thresholds, species profiling, voluntary waiting periods, and pregnancy timelines locally.
- **Voluntary Waiting Period Firewall:** Automated check validating postpartum recovery days before allowing re-insemination.
- **Compound Database Uniqueness:** Prevent duplicate records from multiple offline sync attempts by using unique indexes on `pregnancyId` during calving.
- **Auditable Soft Deletes:** Cascading soft deletes across Animals, Inseminations, Pregnancies, Calvings, and Health Requests via a `deletedAt` flag, allowing historical recovery and auditing.
- **Barangay Denormalization:** Cached location addresses directly on Animal records to optimize search listings and eliminate complex user collection loops.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend (Web)** | React 18, Vite, Tailwind CSS, Framer Motion, Lucide |
| **Mobile** | React Native, Expo, Clerk Auth, Shared `cattleCore` (TS) |
| **Backend** | Node.js, Express, MongoDB, Mongoose, Shared `cattleCore` (JS) |
| **State Management** | TanStack Query (React Query) |

---

## 📦 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas account or local instance
- Expo Go (for mobile testing)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Error-404-not-found-org/Ilo-Agricultures-Office-System.git
   cd Ilo-Agricultures-Office-System
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   # Configure the .env file with MONGODB_URI/DB_URL, CLERK_SECRET_KEY, etc.
   npm run dev
   ```

3. **Web Dashboard Setup**
   ```bash
   cd web
   npm install
   npm run dev
   ```

4. **Mobile App Setup**
   ```bash
   cd mobile
   npm install
   npx expo start
   ```

---

## 🧪 Testing Utilities
You can run automated syntax validation and shared logic unit tests:
```bash
cd backend
# Run cattleCore unit tests
node scratch-check-cattlecore.js
```

---

## 🤝 Contribution & License
Internal project for the Ilo Agriculture Office. 

---
*Developed with ❤️ for the farming community.*
