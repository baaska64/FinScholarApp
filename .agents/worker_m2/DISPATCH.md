## Dispatch Assignment — Worker M2 (Term Selector & Subject Cards Redesign)
Target: c:\Projects\FinScholarApp
Working Directory: c:\Projects\FinScholarApp\.agents\worker_m2
Original Request: c:\Projects\FinScholarApp\ORIGINAL_REQUEST.md
Scope Document: c:\Projects\FinScholarApp\.agents\orchestrator\PROJECT.md

Exclusive Write Ownership:
- `components/ledger/Tabs.tsx`
- `components/ledger/SubjectCard.tsx`

Requirements (R3):
1. **Term Selector & Tab Bar (`Tabs.tsx`)**:
   - Redesign view filter tabs (All / Tracked) using pill-shaped buttons (`Radius.full`), soft drop shadows (`Shadows.sm`), and dynamic active state styling (active pill highlight).
   - Redesign academic term selector button (`${year.name} • ${sem.name}`) and modal switcher with pill styling, soft shadows, clear typography, and smooth touch response.

2. **Subject Card UI Polishing (`SubjectCard.tsx`)**:
   - Overhaul subject cards with soft drop shadows (`Shadows.sm`/`Shadows.md`), rounded card surfaces (`Radius['2xl']`), and clean padding.
   - Add pill-shaped status badges (Units badge, Schedule status badge, Grade Equivalent chip).
   - Redesign score progress bar with smooth rounded fills.
   - Polish interactive action buttons: tracking toggle (`eye`/`eye-off`), duplicate action, delete action, edit mode select checkbox.
   - Support dark/light mode tokens (`constants/Theme.ts`).

3. **Prop & Callback Parity**:
   - Preserve all existing props and callbacks on `SubjectCardProps` (`subject`, `system`, `onSelect`, `isEditMode`, `isSelected`, `onToggleSelect`, `onToggleTracking`, `onDelete`, `onDuplicate`).
   - Preserve all existing props on `TabsProps` (`activeTab`, `setActiveTab`).

4. **Verification**:
   - Run `npx tsc --noEmit` and `npm test`. Ensure 0 errors in target files and tests pass.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Deliverable:
- Refactored `components/ledger/Tabs.tsx` and `components/ledger/SubjectCard.tsx`
- Report in `c:\Projects\FinScholarApp\.agents\worker_m2\handoff.md`
