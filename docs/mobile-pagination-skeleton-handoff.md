# BreedSmart Mobile Pagination, Skeleton Loaders, and Smooth Transition Handoff

## Purpose

This file is a continuation handoff for implementing scalable pagination and premium loading transitions in `mobile_2.0` and the required backend support in `backend_2.0`.

The goal is to prevent large screens from fetching unlimited records and to remove rough UI blinking caused by full-screen loading states, refetch flashes, and raw `ActivityIndicator` usage.

Original folders must stay untouched:

- `mobile`
- `backend`

Implementation targets:

- `mobile_2.0`
- `backend_2.0`

## Current Problem

The mobile app still has growing screens that may fetch all data at once:

- Farmer `My Animals`
- Technician `Animal Hub`
- Animal profile `Timeline`
- Animal profile `Medical History`
- Animal profile `Detailed Records`

The UI also feels rough during navigation or back transitions because some screens blank out or show generic loading spinners while data refetches.

## Main Strategy

Use pagination and better query caching for performance.

Use layout-matched skeleton loaders for first-load polish.

Keep cached data visible during refetches so screen transitions do not blink.

## Core Rules

- Default list limit: `10`
- Backend max limit: `50`
- No growing mobile screen should fetch unlimited records.
- Timeline and medical history should use infinite scroll or a `Load More` footer.
- Animal lists should use pagination or `Load More`.
- Skeletons should show only when no cached data exists.
- If cached data exists, keep it visible and show only a subtle refresh/loading state.

## Backend Pagination Contract

Standard response shape:

```js
{
  data: [],
  page: 1,
  limit: 10,
  total: 42,
  totalPages: 5
}
```

Backend rules:

- Clamp `limit` to max `50`.
- Default invalid or missing `page` to `1`.
- Default invalid or missing `limit` to `10`.
- Sort timeline, health history, and detailed records newest first.
- Keep ownership and role policy checks.
- Keep backward compatibility only where older screens still expect the old shape.

Recommended utility:

```js
const normalizePagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};
```

## Backend Endpoints To Add Or Standardize

```txt
GET /api/animals/my?page=1&limit=10&search=&status=&species=
GET /api/animals?page=1&limit=10&search=&farmerId=&barangay=&status=
GET /api/technician/animals?page=1&limit=10&search=&barangay=&status=
GET /api/animals/:id/timeline?page=1&limit=10&type=&search=
GET /api/animals/:id/health-history?page=1&limit=10&type=&fromDate=&toDate=
GET /api/animals/:id/records?page=1&limit=10&type=&fromDate=&toDate=
```

Recommended indexes:

- `Animal`: `farmerId`, `barangay`, `reproductiveStatus`, `animalId`, `earTag`, `createdAt`
- `AnimalTimelineEvent`: `animalId`, `occurredAt`, `eventType`
- `MedicalRecord`: `animalId`, `date`, `type`
- `HealthRequest`: `animalId`, `status`, `createdAt`

## Mobile Query Strategy

Move pagination logic into services and hooks.

Recommended files:

```txt
mobile_2.0/features/animals/services/animal.service.ts
mobile_2.0/features/animals/hooks/useMyAnimals.ts
mobile_2.0/features/animals/hooks/useAnimalTimeline.ts
mobile_2.0/features/animals/hooks/useAnimalHealthHistory.ts
mobile_2.0/features/technician/hooks/useTechnicianAnimals.ts
```

Shared type:

```ts
export type PaginatedResponse<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
```

Recommended TanStack Query behavior:

```ts
staleTime: 30_000,
placeholderData: keepPreviousData,
refetchOnMount: false,
refetchOnWindowFocus: false,
```

For infinite scroll:

```ts
useInfiniteQuery({
  queryKey: ["animal-timeline", animalId, filters],
  queryFn: ({ pageParam = 1 }) =>
    animalService.getTimeline(animalId, {
      page: pageParam,
      limit: 10,
      ...filters,
    }),
  getNextPageParam: (lastPage) =>
    lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
});
```

## Loading State Rules

- No cached data and first load: show layout skeleton.
- Cached data exists and query refetches: keep data visible.
- Next page loading: show footer skeleton.
- Pull-to-refresh: keep screen visible and show refresh control.
- Error with cached data: show stale warning.
- Error with no data: show full error state with retry.
- Offline with cached data: show cached data plus offline banner.

## Skeleton Component Plan

Create:

```txt
mobile_2.0/components/ui/Skeleton.tsx
```

Requirements:

- Supports `rect` and `circle`.
- Accepts width, height, border radius, and style/className if compatible with local styling.
- Uses React Native `Animated` pulse.
- Supports light and dark theme colors.
- Does not cause layout shift.
- Keeps animation lightweight.

Then create layout-specific skeletons:

```txt
mobile_2.0/features/animals/components/skeletons/AnimalCardSkeleton.tsx
mobile_2.0/features/animals/components/skeletons/AnimalProfileSkeleton.tsx
mobile_2.0/features/animals/components/skeletons/TimelineSkeleton.tsx
mobile_2.0/features/animals/components/skeletons/MedicalHistorySkeleton.tsx
mobile_2.0/features/farmer/components/skeletons/FarmerHomeSkeleton.tsx
mobile_2.0/features/technician-dashboard/components/skeletons/TechnicianRequestSkeleton.tsx
mobile_2.0/features/technician-dashboard/components/skeletons/TechnicianRouteSkeleton.tsx
```

Do not use one generic full-page skeleton everywhere. Match each screen structure.

## Farmer Screen Scope

### Farmer Home

Preserve:

- Greeting
- Moowie banner
- Current BreedSmart visual identity

Improve:

- Skeletons for greeting summary, AI outcome check, heat/breeding alerts, My Cattle preview, and recent activity.
- Keep cached dashboard visible during refetch.
- Avoid blanking the screen on back navigation.

### My Animals

Improve:

- Fetch 10 animals at a time.
- Search and filter server-side.
- Fix selected filter chip growing too large.
- Use animal card skeletons on first load.
- Use footer skeleton while loading more.
- Show count text such as `Showing 10 of 42`.

Filters:

```txt
All
Pregnant
Inseminated
In Heat
Health Alert
Recovery
```

### Animal Profile

Improve:

- Load profile summary first.
- Timeline and medical history should fetch paginated data separately.
- Keep profile header visible while timeline or records refetch.
- Do not fetch all detailed records at once.

### Pregnancy Tracker

Improve:

- Use dedicated tracker skeleton.
- Keep existing milestone data visible while refreshing.
- Avoid reloading unrelated animal history if only tracker data is needed.

## Technician Screen Scope

### Technician Animal Hub

Improve:

- Fetch 10 animals at a time.
- Search and filter server-side.
- Use animal card/list skeletons.
- Add load more or pagination footer.

Filters:

```txt
Barangay
Farmer
Reproductive status
Health alert
Pregnancy due
Calving due
```

Search:

```txt
Farmer name
Phone
Animal ID
Ear tag
Barangay
```

### Technician Animal Details

Replace full-screen spinner with skeletons for:

- Top animal header card
- Details grid
- Quick actions
- Timeline and record sections

### Client Profile

Replace full-screen spinner with:

- Avatar skeleton
- Name/location skeleton
- Direct action button skeletons
- Animals list skeletons

### Technician Requests Section

Replace request loading spinner with request card skeletons.

### Technician Route Section

Replace route loading spinner with route/task skeletons.

## Timeline, Medical History, And Detailed Records

### Timeline

Endpoint:

```txt
GET /api/animals/:id/timeline?page=1&limit=10&type=health
```

UI:

- Pinned summary remains visible.
- Filter chips reset pagination to page 1.
- Footer skeleton appears while loading the next page.

Filters:

```txt
All
Breeding
Pregnancy
Calving
Health
Medication
Photos
```

### Medical History

Endpoint:

```txt
GET /api/animals/:id/health-history?page=1&limit=10&type=Treatment
```

Filters:

```txt
All
Treatment
Vaccination
Deworming
Check-up
Weight
```

UI:

- Latest first.
- `Load older records`.
- Empty state per filter.
- Error state with retry.

### Detailed Records

Do not fetch everything in one request.

Split into tabs:

```txt
Overview
Timeline
Breeding
Pregnancy
Calving
Health
Reports
```

Each tab should fetch its own paginated data:

```txt
GET /api/animals/:id/records?type=breeding&page=1&limit=10
GET /api/animals/:id/records?type=health&page=1&limit=10
GET /api/animals/:id/records?type=calving&page=1&limit=10
```

## Transition Smoothness Plan

Fix page blinking by combining:

- Cached query data
- `placeholderData`
- Stable layout dimensions
- Section-level skeletons instead of full-screen blanks
- Avoid clearing state on focus
- Avoid unnecessary `router.replace`
- Use `router.back()` where appropriate
- Memoize expensive list/card components
- Avoid remounting whole screen shells unnecessarily

Back navigation rule:

```txt
Do not clear data immediately.
Do not show full skeleton if cached data exists.
Refetch quietly in the background.
Show only a small stale/refresh state.
```

## Implementation Priority

### P0

- Backend pagination for animals, timeline, and health history.
- Farmer My Animals pagination.
- Technician Animal Hub pagination.
- Animal Timeline pagination.
- Medical History pagination.
- Base `Skeleton` component.

### P1

- Screen-specific skeletons.
- Query caching improvements.
- Detailed Records split into paginated tabs.
- Technician request and route skeletons.
- Farmer Home skeletons.

### P2

- Cursor pagination for timeline.
- Prefetch next page.
- Saved filters.
- Additional transition polish.
- Advanced timeline search.

## Testing Plan

Backend:

- `page=1&limit=10`
- `page=2&limit=10`
- invalid page fallback
- max limit clamp
- search plus filters
- empty page
- ownership and role access
- timeline and health history sorting

Mobile:

- Farmer with more than 10 animals.
- Technician with more than 10 animals.
- Animal with 25+ timeline events.
- Animal with 10+ medical records.
- Filter resets pagination.
- Load more does not duplicate items.
- Pull-to-refresh keeps layout stable.
- Back navigation does not blink.
- Offline cached page still displays.
- Dark mode skeleton colors look correct.
- Small screens: 360, 390, and 412 px widths.

Run:

```txt
cd mobile_2.0
npx tsc --noEmit
npm run lint
```

Also test manually in Expo Go with slow network, Android back navigation, and light/dark mode.

Backend checks:

```txt
cd backend_2.0
npm test
```

## Acceptance Criteria

- `My Animals` does not fetch all animals at once.
- Technician `Animal Hub` does not fetch all animals at once.
- Animal Timeline loads first page only and can load more.
- Medical History loads first page only and can load more.
- Detailed Records does not fetch all categories at once.
- Raw full-screen spinners are replaced on priority screens.
- Cached data remains visible during refetch.
- Back navigation no longer causes obvious blink/blank transitions.
- Loading, empty, error, offline, refreshing, and footer-loading states exist.
- Original `mobile` and `backend` folders remain untouched.

## Copy-Paste Continuation Prompt For Antigravity Or Gemini

```txt
Act as a senior full-stack React Native, Expo, Express, MongoDB, and TanStack Query engineer.

Continue the BreedSmart 2.0 mobile performance and UI smoothness work using this file as the source of truth:

docs/mobile-pagination-skeleton-handoff.md

Important constraints:
- Do not modify the original mobile or backend folders.
- Only work in mobile_2.0 and backend_2.0.
- Preserve the current BreedSmart visual identity, routes, green palette, Outfit typography, light/dark mode, and familiar farmer/technician workflows.
- Do not redesign the app from scratch.
- Implement pagination and skeleton loaders incrementally.
- Keep current behavior working while improving performance and transitions.

Primary problems to solve:
1. Farmer My Animals fetches too much data and needs limit=10 pagination or Load More.
2. Technician Animal Hub fetches too much data and needs limit=10 pagination or Load More.
3. Animal Profile Timeline fetches all events and needs paginated/infinite loading.
4. Medical History fetches all records and needs paginated/infinite loading.
5. Detailed Records should not fetch all categories at once; split by tabs and paginate each tab.
6. Screens should stop blinking on back navigation by keeping cached data visible.
7. Replace raw full-screen ActivityIndicator loading states with layout-matched skeleton loaders.

Implementation order:
1. Add/standardize backend pagination contracts for animals, timeline, health history, and animal records.
2. Add mobile PaginatedResponse type, services, and TanStack Query hooks.
3. Update Farmer My Animals to use paginated data and stable filter chips.
4. Update Technician Animal Hub to use paginated data.
5. Update Animal Timeline and Medical History to use useInfiniteQuery or Load More.
6. Create mobile_2.0/components/ui/Skeleton.tsx.
7. Add screen-specific skeletons for Farmer Home, Animal Cards, Animal Profile, Timeline, Medical History, Technician Requests, and Technician Route sections.
8. Apply query caching rules so cached data remains visible during refetch.
9. Run TypeScript, lint, backend tests, and manual Expo Go slow-network testing.

Use these loading rules:
- No cached data: show skeleton.
- Cached data exists: keep old data visible while refetching.
- Next page loading: show footer skeleton.
- Pull refresh: keep current screen visible.
- Error with cached data: show stale warning.
- Error with no data: show full error state with retry.

Acceptance criteria:
- No growing list fetches unlimited records.
- Default list limit is 10.
- Backend max limit is 50.
- Farmer and technician animal lists support pagination or Load More.
- Timeline and Medical History load first page only and support loading more.
- Detailed Records are split by type and paginated.
- Back navigation does not blank or visibly blink.
- Priority loading spinners are replaced by layout-matched skeletons.
- Original mobile and backend folders are untouched.
```
