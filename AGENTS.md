# BreedSmart Repository Instructions

## Project

BreedSmart is a multi-platform livestock management system with:

- Expo React Native mobile application
- React web application
- Express and MongoDB backend

The mobile Technician workflow is currently the business-logic source of truth when aligning the Web Technician application.

## Design rules

- Preserve the BreedSmart green palette.
- Preserve Outfit typography.
- Use existing DaisyUI components for web.
- Preserve existing routes, sidebar hierarchy, and role identity.
- Support light and dark mode.
- Prefer reusable shared components over page-specific styling.
- Do not introduce another design system.
- Do not install UI libraries unless explicitly approved.
- Do not use marketing-page, bento, or motion-heavy dashboard layouts.

## Workflow rules

Do not change these unless explicitly requested:

- AI request and duplicate-prevention logic
- Re-insemination attempt linkage
- Pregnancy confirmation policy
- Continuation recheck workflow
- Calving reconciliation and idempotency
- Health workflow rules
- Offline mobile queue behavior
- Authentication and role permissions

## Implementation rules

- Work in small reviewable batches.
- Inspect existing components before creating new ones.
- Do not modify unrelated files.
- Do not access or mutate database data unless explicitly requested.
- Do not run seeders or cleanup scripts unless explicitly requested.
- Do not stage, commit, or push unless explicitly requested.
- Run relevant tests, type checking, linting, and git diff checks.
- Report exact files changed and validation results.

## User-facing terminology

Distinguish:

- Service progress
- Reproductive outcome
- Farmer observation
- Technician review
- Official pregnancy diagnosis
- Continuation recheck
- Diagnostic follow-up

Never display raw enum values, backend error codes, or test-seed prefixes.