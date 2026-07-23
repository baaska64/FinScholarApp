# Original User Request

## Follow-up Request — 2026-07-17T13:05:10Z

Completely overhaul the FinScholar React Native mobile app to make it feel like a polished, "cute" native companion app. Integrate "Fin" (the mascot) prominently throughout the app as the user's companion. Ensure all existing core functionalities (offline saving, Supabase cloud sync, AI schedule/grading scanning, interactive calendar) remain perfectly intact and robust. Finally, port over the full "Tasks/Requirements" feature from the web application into the mobile app, and creatively add new complementary features where appropriate.

### Requirements

#### R1. Native "Cute" Companion App Overhaul
Redesign the UI/UX across all screens (Dashboard, Calendar, Schedule, Grades, Profile) to feel extremely native, playful, and premium. Use smooth micro-animations, consistent padding, and vibrant modern styling without breaking any existing logic.

#### R2. Deep Integration of Fin (The Mascot)
Embed Fin seamlessly into the UI (e.g., peeking from behind headers, sitting on empty state boxes, reacting to grades). Assume the user has generated and placed standard poses in `assets/images/` (e.g., `happy.png`, `confused.png`, `studying.png`, `sleeping.png`).

#### R3. Preservation of Core Mechanics
Zero regressions allowed. The local AsyncStorage + Supabase sync pipeline, AI scanner modules, and complex grading/schedule calculators must continue to function perfectly.

#### R4. Port "Tasks/Requirements" Feature
Implement a new Tab/Screen for Tasks and Requirements. The Supabase database tables for this are already established from the web app—you must pull this data structure but design your own dedicated, native mobile UI.

#### R5. Autonomous Feature Additions & Rigorous Testing
Proactively design and implement minor complementary features that elevate the companion app experience. Rigorously test all changes (UI and state logic) to ensure seamless integration.

### Acceptance Criteria

#### UI & Companion Integration
- [ ] The app features a consistent, upgraded "cute" design system across all 5 main tabs.
- [ ] Fin appears in at least 3 distinct contextual states (e.g., Empty State, Dashboard Welcome, Success State).
- [ ] The user can navigate between all tabs without visual glitching or overlapping safe areas.

#### Core Mechanics Parity
- [ ] Creating an event offline successfully saves to AsyncStorage.
- [ ] Coming back online successfully syncs local changes to Supabase without data loss.
- [ ] The AI scanning mock functions still correctly parse and save timetable data.

#### New Features
- [ ] The new Tasks tab allows users to create, read, update, and delete tasks/requirements.
- [ ] Added at least one new autonomous companion feature (e.g., a daily quote from Fin, or a focus timer).
