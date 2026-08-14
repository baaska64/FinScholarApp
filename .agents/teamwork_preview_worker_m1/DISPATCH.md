## 2026-08-12T15:11:07Z
Implement Milestone 1 — Dynamic Subject Assets & Helper Utilities in `widget/subjectUtils.ts` and test suite in `__tests__/subjectUtils.test.js`.

Requirements:
1. Create `widget/subjectUtils.ts` with TypeScript exports:
   - `getSubjectStyle(courseName: string)`: Deterministic string hash mapping `courseName` to a subject color palette entry `{ color: string, lightBg: string, darkBg: string }`. Must be 100% deterministic (same input string always yields same palette index). Handle empty/undefined gracefully.
   - `getSubjectIcon(courseName: string)`: Resolves icon keyword or character symbol based on course name keyword match (e.g., CS/IT -> code, MATH/CALC -> math, PHYS/CHEM/SCI -> science, ENG/LIT -> book, default -> school).
   - `getThemeTokens(isDark: boolean)`: Resolves widget palette tokens for light and dark modes (`bgColor`, `cardColor`, `cardBorder`, `textColor`, `textSecondary`, `textTertiary`, `primaryColor`, `successColor`, `successBg`).
2. Create unit tests in `__tests__/subjectUtils.test.js` verifying:
   - Deterministic color selection for identical course names.
   - Distinct color distribution for different course names.
   - Keyword icon resolution.
   - Empty/undefined course name handling.
   - Light and dark theme token resolution.
3. Verify implementation by running `npx tsc --noEmit` and `node scripts/run-tests.js`. Ensure 0 TypeScript errors and 100% passing tests.
