# FinScholar - App Context & Roadmap

This document serves as the single source of truth for the app's current state, features, and future roadmap so that the development context is never lost.

## 📱 App Identity
- **App Name:** FinScholar
- **Package Name:** `com.lalex.finscholar`
- **Data & Privacy:** Uses Supabase for backend authentication, but login is completely OPTIONAL. Users can use the app 100% locally. If they choose to log in to sync data, the app collects their Email. Requests Camera permissions strictly for scanning syllabuses/schedules locally.

## ✨ Current Features (V1)
1. **Grade Tracker:** Calculate and track GWA/grades.
2. **Auto-import Schedule:** Uses the camera to scan and parse class schedules.
3. **Auto-import School Calendar:** Uses the camera to scan academic calendars.
4. **Track Tasks:** To-do list for assignments and exams.
5. **Flashcards:** Study tool for students.

## 🚀 Future Roadmap & Monetization
- **Current State:** The app currently has a Supabase authentication system (login/signup) but no in-app purchases.
- **Planned Premium Update:** 
  - Introduce a **one-time payment** tier.
  - Premium will unlock advanced **AI features**.
  - **Early Adopter Perk:** The first 50 users will get these premium AI features for free/unlocked.
  - *Note: Privacy policies and Google Play declarations should only be updated to reflect payments once this is actually coded and released.*
