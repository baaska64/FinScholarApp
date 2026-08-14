# Milestone 1 Handoff Report — Dynamic Subject Assets & Helper Utilities

## 1. Observation
- **Files Created**:
  - `widget/subjectUtils.ts`: Implemented `getSubjectStyle`, `getSubjectIcon`, `getThemeTokens`, `SUBJECT_PALETTE`, and TypeScript interfaces `SubjectStyle`, `ThemeTokens`.
  - `__tests__/subjectUtils.test.js`: Comprehensive test suite containing 12 unit tests across 4 test suites verifying determinism, distribution, keyword resolution, edge cases (empty/undefined/null), and theme tokens.
- **Files Modified**:
  - `scripts/run-tests.js`: Registered `runSubjectUtilsTests` into the automated project test runner.
- **Build Output (`npx tsc --noEmit`)**:
  - Exited with code `0`, 0 compilation errors.
- **Test Execution Output (`node scripts/run-tests.js`)**:
  - Exited with code `0`.
  - Result: `Test Suites: 24 passed, 24 total`, `Tests: 83 passed, 0 failed, 83 total`.

## 2. Logic Chain
- **Deterministic Hash Function (`getSubjectStyle`)**:
  - Utilizes djb2 string hashing algorithm (`(hash * 33) ^ charCode`) to compute a non-negative integer modulo `SUBJECT_PALETTE.length`.
  - Guarantees 100% determinism: identical course strings yield the exact same color palette object every execution.
  - Safe fallback: empty strings, `null`, `undefined`, or non-string values safely return `SUBJECT_PALETTE[0]` without raising exceptions.
- **Keyword-based Icon Resolution (`getSubjectIcon`)**:
  - Employs regex pattern matching on course names:
    - CS / IT / Programming / Software / Code -> `'code'`
    - Math / Calculus / Statistics / Algebra -> `'math'`
    - Physics / Chemistry / Science / Biology -> `'science'`
    - English / Literature / History / Philosophy -> `'book'`
    - Default / Unmatched -> `'school'`
  - Handles surrounding word boundaries and attached numbers (e.g. `CS101`, `MATH201`) while avoiding false matches on substrings (e.g. `HISTORY` does not trigger `IT`).
- **Widget Theme Tokens (`getThemeTokens`)**:
  - Returns `ThemeTokens` containing `bgColor`, `cardColor`, `cardBorder`, `textColor`, `textSecondary`, `textTertiary`, `primaryColor`, `successColor`, `successBg`.
  - Dynamically switches between light mode (`isDark === false`) and dark mode (`isDark === true`).

## 3. Caveats
- No caveats. The implementation covers all edge cases, strict TypeScript compilation, and 100% passing automated unit tests.

## 4. Conclusion
Milestone 1 is complete and fully verified. `widget/subjectUtils.ts` and `__tests__/subjectUtils.test.js` fulfill all requirements specified in the project plan with zero type errors and zero test failures.

## 5. Verification Method
To independently verify:
1. Run TypeScript typecheck:
   ```bash
   npx tsc --noEmit
   ```
   Confirm 0 errors returned.
2. Run full project test suite:
   ```bash
   node scripts/run-tests.js
   ```
   Confirm all 24 test suites pass (including 4 new SubjectUtils suites).
