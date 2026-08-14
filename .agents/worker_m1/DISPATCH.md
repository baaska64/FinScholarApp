## Dispatch Assignment — Worker M1 (Hero Header & Condensed GWA Cards)
Target: c:\Projects\FinScholarApp
Working Directory: c:\Projects\FinScholarApp\.agents\worker_m1
Original Request: c:\Projects\FinScholarApp\ORIGINAL_REQUEST.md
Scope Document: c:\Projects\FinScholarApp\.agents\orchestrator\PROJECT.md

Exclusive Write Ownership:
- `components/ledger/GwaSummary.tsx`
- `components/ledger/DonutChart.tsx`

Requirements (R1 & R2):
1. **Overall GWA Hero Banner (R1)**:
   - Redesign top header of Grade Ledger to render an Overall/Cumulative GWA banner card matching the reference app layout.
   - Include `FinDashboard.png` mascot graphic (`require('../../assets/images/FinDashboard.png')`), styled with vibrant background gradient (purple/indigo `#4f46e5` to `#312e81` or theme colors), quote/cheer message e.g. "Celebrate Every Milestone!", and prominent Overall GWA display (`cumGwa` / `cumPercent`).
   - Support dark and light mode theme tokens (`constants/Theme.ts`).

2. **Condensed GWA Summary Cards (R2)**:
   - Remove standalone Cumulative donut chart.
   - Position **Semester GWA** and **Year GWA** side-by-side underneath the hero banner in equal-width condensed cards.
   - Use soft drop shadows (`Shadows.md`), rounded corners (`Radius['2xl']` / `Radius['3xl']`), clean typography, and mini progress rings/bars for `semGwa`/`semPercent` and `yearGwa`/`yearPercent`.

3. **Prop Compatibility**:
   - Maintain exact interface `GwaSummaryProps = { semGwa, yearGwa, cumGwa, semPercent, yearPercent, cumPercent, system }`.

4. **Verification**:
   - Run `npx tsc --noEmit` and `npm test`. Ensure 0 errors in target files and tests pass.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Deliverable:
- Refactored `components/ledger/GwaSummary.tsx` (and `DonutChart.tsx` if needed)
- Report in `c:\Projects\FinScholarApp\.agents\worker_m1\handoff.md`
