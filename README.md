# Ilo Agriculture Office System 🐄🌾

[![Status](https://img.shields.io/badge/Status-Development-orange.svg)]()
[![Stack](https://img.shields.io/badge/Stack-MERN%20+%20Expo-blue.svg)]()

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

### ⚙️ Backend Core
- **Enterprise Security**: Clerk-integrated authentication and role-based access control.
- **Mongoose ODM**: Structured MongoDB schemas for Farmers, Livestock, Inseminations, and Health Logs.
- **Lifecycle Automation**: Automated breeding timelines (Pregnancy, Calving, Re-insemination).

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend (Web)** | React 18, Vite, Tailwind CSS, Framer Motion, Lucide |
| **Mobile** | React Native, Expo, Clerk Auth |
| **Backend** | Node.js, Express, MongoDB, Mongoose |
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
   # Create a .env file based on .env.example
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

## 🤝 Contribution & License
Internal project for the Ilo Agriculture Office. 

---
*Developed with ❤️ for the farming community.*
