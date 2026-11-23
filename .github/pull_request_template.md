## Summary

What changed and why.

## Wave / feature IDs

- Wave: W?
- Feature IDs: I??

## Scope

- [ ] ...

## Verification

- [ ] `pnpm check` (lint, typecheck, unit tests, i18n key parity)
- [ ] API: `uv run --directory apps/api pytest -q`, `ruff check .`, `mypy src` (if touched)
- [ ] Golden vectors regenerated/verified (if algorithms touched)
- [ ] Playwright smoke (if UI touched)
- [ ] Screenshots or recordings attached, fa (RTL) and en (LTR) (if UI touched)

## Definition of Done

- [ ] Works in fa (RTL) and en (LTR)
- [ ] New algorithms documented in `docs/ALGORITHMS.md` with golden/property tests
- [ ] Theory panel added (fa + en; fa flagged for owner review)
- [ ] Performance budgets respected; no main-thread DSP
- [ ] No console errors/warnings for the exercised flow
- [ ] `docs/PROGRESS.md` updated (status, known issues, review needs)

## Risks / follow-ups

Known gaps, deferred items, next steps.

## Phase close-out (wave PRs only)

- Features completed:
- Deviations or deferred items:
- Next wave:
