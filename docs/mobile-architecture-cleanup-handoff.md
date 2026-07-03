# BreedSmart Mobile Architecture Cleanup Handoff

## Purpose

This document is a future improvement prompt and planning file for cleaning up `mobile_2.0` after the pagination, skeleton loader, and smooth transition work.

The goal is to reduce:

- Big screens
- Duplicate API calls
- Multiple competing UI patterns
- Overlapping feature modules

Original backup folders must stay untouched:

- `mobile`
- `backend`

Implementation targets:

- `mobile_2.0`
- `backend_2.0` only when a backend contract is required

## Current Known Issues

### 1. Big Screens

Several mobile screens still contain too many responsibilities in one file.

Priority files:

```txt
mobile_2.0/features/animals/screens/AnimalDetailsScreen.tsx
mobile_2.0/app/(technician)/animal-details.tsx
mobile_2.0/features/farmer-dashboard/screens/FarmerHomeScreen.tsx
mobile_2.0/app/(farmer)/request-ai/index.tsx
mobile_2.0/app/(farmer)/report-sickness/index.tsx
mobile_2.0/app/(farmer)/my-requests.tsx
mobile_2.0/app/(technician)/request-details.tsx
mobile_2.0/app/(technician)/health-log.tsx
```

These screens may mix:

- UI rendering
- API calls
- local derived state
- TanStack Query logic
- mutation logic
- modals
- form validation
- formatting/mapping
- offline behavior

### 2. Duplicate API Calls

Some APIs are called in multiple ways across screens, services, and older route files.

Common endpoints to audit:

```txt
/animals/my
/animals/all
/animals/:id
/animals/:id/timeline
/animals/:id/health-history
/medical/:id
/ai-request
/health-request
/technician/requests
```

Long-term goal:

- Route files should not issue raw API calls.
- Screens should use feature hooks.
- Feature hooks should call feature services.
- Services should own endpoint paths and response normalization.

### 3. Multiple UI Patterns

The app currently mixes several UI approaches:

```txt
components/ui
components/shared
features/farmer-ui
screen-local UI components
NativeWind className styling
inline style objects
```

This is manageable, but it can make screens visually inconsistent.

Long-term goal:

- Keep `components/ui` for primitive components.
- Keep `components/shared` for cross-role shared app states and inputs.
- Keep `features/farmer-ui` only for farmer-specific workflow components.
- Move repeated section/card/list items into feature components.
- Avoid creating a second competing component system.

### 4. Overlapping Modules

Animal-related logic exists across several modules:

```txt
features/animals
features/animal-records
features/technician
features/technician-animals
app/(farmer)/animal-details.tsx
app/(technician)/animal-details.tsx
```

Some overlap is expected because farmer and technician users need different workflows.

But shared record logic should move toward:

```txt
features/animal-records
features/animals/services
features/animals/hooks
```

Technician-only list/search/dashboard logic can stay under:

```txt
features/technician-animals
features/technician-dashboard
features/technician-requests
```

## Cleanup Principles

Use a restrained senior-engineer approach.

Before adding code, ask:

```txt
1. Does this need to exist?
2. Is there already a local component, hook, or service that does this?
3. Can TanStack Query handle the data state instead of custom state?
4. Can the current theme/card/text utilities handle the UI?
5. Can the existing backend endpoint be extended instead of adding a duplicate?
6. If new code is needed, what is the smallest safe abstraction?
```

Do not rewrite the app.

Do not redesign the client-approved BreedSmart UI.

Refactor one section at a time.

## Target Structure

Recommended direction:

```txt
mobile_2.0/
  app/
    route files only
  components/
    ui/
    shared/
  features/
    animals/
      components/
      hooks/
      services/
      screens/
      types/
      utils/
    animal-records/
      components/
      hooks/
      services/
      types/
      utils/
    farmer-dashboard/
    farmer-requests/
    farmer-reports/
    technician-animals/
    technician-dashboard/
    technician-requests/
    technician-records/
```

Route files should mostly be shells:

```tsx
export default function Route() {
  return <FeatureScreen />;
}
```

## Refactor Pattern

For each big screen:

1. Identify one section to extract.
2. Move API call into a service if needed.
3. Move query/mutation logic into a hook.
4. Move UI into a feature component.
5. Keep props small and typed.
6. Keep old behavior the same.
7. Run TypeScript and lint.
8. Test the screen manually.

Example extraction:

```txt
AnimalDetailsScreen.tsx
  -> AnimalProfileSummary.tsx
  -> AnimalTimelineSection.tsx
  -> AnimalMedicalHistorySection.tsx
  -> AnimalBreedingRecordsSection.tsx
  -> AnimalActionBar.tsx
  -> useAnimalTimeline.ts
  -> useAnimalHealthHistory.ts
  -> animalRecords.service.ts
```

## Priority Cleanup Order

### P0

- Farmer Animal Details timeline section
- Farmer Animal Details medical history section
- Technician Animal Details timeline section
- Technician Animal Details medical history section
- Direct `/animals/my` calls in forms and lists

### P1

- Farmer AI request form
- Farmer health request form
- Farmer My Requests
- Technician Request Details
- Technician Health Log

### P2

- Farmer Home dashboard section extraction
- Reports and PDF preview cleanup
- Shared status badge standardization
- Shared empty/error/offline state standardization
- Remove duplicate styling patterns where safe

## API Ownership Rules

Use services for API calls:

```txt
features/animals/services/animals.service.ts
features/animal-records/services/animalRecords.service.ts
features/technician-requests/services/technicianRequests.service.ts
```

Use hooks for TanStack Query:

```txt
features/animals/hooks/useMyAnimals.ts
features/animal-records/hooks/useAnimalTimeline.ts
features/technician-requests/hooks/useTechnicianRequests.ts
```

Avoid this inside screens:

```tsx
const res = await api.get("/animals/my?limit=100");
```

Prefer:

```tsx
const animalsQuery = useMyAnimalsInfiniteQuery({ limit: 10, search });
```

## UI Ownership Rules

Use existing primitives first:

```txt
components/ui/Text.tsx
components/ui/Card.tsx
components/ui/Skeleton.tsx
components/shared/AsyncState.tsx
features/farmer-ui/components/StatusBadge.tsx when farmer-specific
```

Create new components only when:

- used by more than one section, or
- a big screen section becomes easier to understand after extraction, or
- the UI block has its own loading/empty/error state.

## Verification

Run after every small refactor:

```txt
cd mobile_2.0
npx tsc --noEmit
npm run lint
```

Run backend only if backend contracts changed:

```txt
cd backend_2.0
npm test
npm run check
```

Manual test:

- farmer login
- technician login
- My Animals
- Animal Details
- Timeline
- Medical History
- Request AI
- Report Health Concern
- Technician Animal Hub
- Technician Request Details
- Back navigation
- Offline/cached behavior
- Light/dark mode

## Copy-Paste Prompt For Antigravity

```txt
Act as a senior React Native, Expo Router, TanStack Query, and TypeScript engineer.

Continue BreedSmart 2.0 mobile architecture cleanup using this file as the source of truth:

docs/mobile-architecture-cleanup-handoff.md

Important constraints:
- Do not modify the original mobile or backend folders.
- Work only in mobile_2.0, and backend_2.0 only if an API contract must change.
- Preserve the current BreedSmart UI identity, green palette, Outfit typography, light/dark mode, and existing farmer/technician workflows.
- Do not redesign the app.
- Do not rewrite big screens all at once.
- Refactor one section at a time and preserve behavior.

Current problems to reduce:
1. Big screens still mix UI, API calls, query state, mutation logic, validation, formatting, and modals.
2. Some duplicate API calls still exist across route files, feature services, and older screens.
3. Multiple UI patterns exist across components/ui, components/shared, features/farmer-ui, and screen-local components.
4. Animal-related logic overlaps across features/animals, features/animal-records, features/technician, and technician/farmer route screens.

Priority files:
- mobile_2.0/features/animals/screens/AnimalDetailsScreen.tsx
- mobile_2.0/app/(technician)/animal-details.tsx
- mobile_2.0/app/(farmer)/request-ai/index.tsx
- mobile_2.0/app/(farmer)/report-sickness/index.tsx
- mobile_2.0/app/(farmer)/my-requests.tsx
- mobile_2.0/app/(technician)/request-details.tsx
- mobile_2.0/app/(technician)/health-log.tsx

Start with:
1. Farmer Animal Details timeline section.
2. Farmer Animal Details medical history section.
3. Technician Animal Details timeline section.
4. Technician Animal Details medical history section.

Use the existing new pagination/skeleton foundation:
- mobile_2.0/components/ui/Skeleton.tsx
- mobile_2.0/features/shared/types/pagination.ts
- mobile_2.0/features/animal-records/hooks/useAnimalTimeline.ts
- mobile_2.0/features/animal-records/services/animalRecords.service.ts

Refactor pattern:
1. Extract one screen section into a feature component.
2. Move API calls into a service if they are still direct.
3. Move query/mutation behavior into a hook.
4. Keep cached data visible during refetch.
5. Add loading, empty, error, and load-more states.
6. Keep old visible behavior and navigation intact.
7. Run TypeScript and lint.

Do not create a new component library.
Reuse existing Text, Card, Skeleton, AsyncState, theme, and farmer-ui components where they fit.

Acceptance criteria:
- No newly refactored section issues raw API calls from the screen file.
- Refactored sections use typed feature hooks/services.
- Animal detail timeline and medical history sections become smaller and easier to reason about.
- Existing farmer and technician behavior remains intact.
- No visual redesign beyond necessary state/pagination/skeleton improvements.
- npx tsc --noEmit passes.
- npm run lint has no new errors.
```
