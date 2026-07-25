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

## 🚀 Monetization & Premium (Implemented)
- **Current State:** The app currently integrates Google Play Billing via RevenueCat (`react-native-purchases`).
- **Premium Features:** 
  - Premium unlocks advanced **AI features** (like the Schedule Scanner).
- **Early Adopter Perk (First 80 Users):** 
  - A Supabase PostgreSQL trigger automatically grants `is_premium = true` to the first 80 users who sign up in the `profiles` table.
  - The frontend `SyncService` fetches this flag. If the user is premium, they bypass the RevenueCat paywall entirely.
  - *Note: Privacy policies and Google Play declarations must reflect that you process payments and offer digital goods.*
