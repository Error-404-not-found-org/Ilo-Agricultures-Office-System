# Web Technician UI Improvement Plan

Date: 2026-07-11

## Goal

Improve the technician web experience so a field technician can quickly:

```text
Understand today's priorities
→ Find a farmer
→ Select an animal
→ Review its complete history
→ Add the correct service or past record
```

This is a targeted evolution of the existing BreedSmart interface. It is not a full redesign and should preserve existing routes, permissions, backend contracts, and working workflows unless a change is explicitly approved.

## Design Direction

BreedSmart is a trust-first public-service records system. The interface should prioritize clarity, traceability, accessibility, and low-error data entry over decorative styling.

Recommended design characteristics:

- Plain field-oriented language.
- Clear record and service context.
- Moderate information density.
- Minimal decorative motion.
- Consistent emerald BreedSmart accent.
- Strong loading, empty, error, retry, and disabled states.
- Accessible keyboard and tablet behavior.

## Priority UI Areas

### 1. Navigation and page-title consistency

The technician sidebar has improved terminology, but several destination pages still use older or conflicting names.

| Sidebar label | Current page wording | Approved page wording |
| --- | --- | --- |
| Overview | Dashboard | Overview |
| Farmers | Clients | Farmers |
| Animals | Animals / Livestock Registry | Animals |
| Animal Records | Breeding Ledger | Animal Records |
| Health Records | Health & Diagnostics Ledger | Health Records |
| Map & Locations | GIS Field Hub | Map & Locations |
| Notes & Photos | Field Notes & Gallery | Notes & Photos |
| Reports & Exports | Field Reports | Reports & Exports |
| My Performance | Analytics Portal | My Performance |

Do not rename route paths in the first phase. Change user-facing labels while preserving bookmarked URLs and navigation behavior.

### 2. Plain-language copy

Replace software, military, and administrative terminology with field-oriented language.

| Avoid | Use |
| --- | --- |
| Operational Inbox | Service Requests |
| Field missions | Service visits |
| Spatial telemetry | Farmer and animal locations |
| Coordinate matrix | Locations |
| Deployment dispatch vector | Route order |
| Bovine fleet | Cattle |
| Open status units | Open animals |
| Clinical ledger | Health records |
| Technical asset ledger | Animal history |
| Biological ownership holdings | Farmer's animals |
| System hub | BreedSmart |

### 3. Overview hierarchy

The technician Overview should answer:

```text
What is urgent?
Where do I need to go?
Which farmer and animal are involved?
What must I record afterward?
```

Recommended section order:

1. Urgent health cases.
2. Today's scheduled visits.
3. Overdue visits.
4. Pregnancy checks due.
5. Calving follow-ups.
6. Offline work waiting to sync, where applicable.
7. Performance metrics.

Recommended quick actions:

- Find Farmer.
- Find Animal.
- Record Service.
- Add Past Record.
- View Schedule.

Metrics should remain available but should not appear before priority work.

### 4. Farmers directory

Rename the page and its statistics from `Clients` to `Farmers`.

Recommended summary cards:

- Total Farmers.
- Verified Farmers.
- New This Month.
- Average Animals per Farmer.

Recommended table fields:

```text
Farmer
Phone
Barangay
Animals
Last Service
Upcoming Visit
Status
Actions
```

Recommended actions:

- View Farmer.
- Call Farmer.
- Edit permitted profile information.
- Register Farmer.

Requirements:

- Search by farmer name, phone, and barangay.
- Server-backed pagination.
- Helpful empty state.
- Visible error and Retry action.
- Keyboard-accessible rows and action buttons.
- Duplicate names distinguishable through barangay and phone.

### 5. Farmer profile

The farmer profile should be the fastest route to the farmer's animals.

Recommended structure:

```text
Farmer Summary
  Name
  Phone
  Barangay
  Verification status
  Call Farmer

Farmer's Animals
  Search
  Status filter
  Animal list
  Last service
  Next action
  View Records
```

Remaining improvements:

- Add `Register Animal for This Farmer`.
- Preserve farmer context when registering an animal.
- Display last service from official service data.
- Display the next recommended action.
- Provide Retry when the animal list fails.
- Show `Not recorded` instead of guessed fallback data.
- Return to the correct farmer and filter state after viewing an animal.

### 6. Animals directory

Recommended summary cards:

- Total Animals.
- Cattle.
- Pregnant Animals.
- Pregnancy Checks Due.

Avoid `Bovine Fleet`, `Units`, and similar asset-oriented wording.

Recommended columns:

```text
Ear Tag
Farmer
Barangay
Species / Breed
Reproductive Status
Last Service
Next Action
Actions
```

Recommended actions:

- View Records.
- Record Service.
- Edit Animal.

Requirements:

- Search by ear tag, farmer, animal ID, breed, and species.
- Server-backed filters and pagination.
- Correct last-service dates from official records.
- No use of `updatedAt` as a substitute for last AI or last visit.

### 7. Animal profile and records workspace

The animal profile is the central technician workspace.

Recommended header:

```text
Animal #EAR-TAG
Farmer · Barangay · Phone
Species · Breed · Sex
Current reproductive or health status
Important warning
Next recommended action

[Add Record] [Call Farmer] [Edit Animal]
```

Recommended tabs:

- Overview.
- Animal Records.
- Breeding History.
- Health Records.
- Animal Information.

The combined Animal Records history should include:

- AI services.
- Pregnancy diagnoses.
- Calving records.
- Health assistance.
- Vaccination.
- Deworming.
- Treatment.
- Weight records.
- Notes and photos.

Recommended filters:

```text
All | Health | AI | Pregnancy | Calving | Medicine | Weight | Notes
```

Recommended search:

```text
Search diagnosis, medicine, sire code, technician, or notes
```

Requirements:

- Chronological ordering by service date.
- Date-range filter.
- Pagination or incremental loading.
- Distinction between no records and no matching records.
- Direct links among AI, pregnancy, calving, mother, and offspring records.

### 8. Record detail presentation

Use one consistent outer record-detail pattern that adapts to the record type.

Every record detail should show:

- Animal context.
- Farmer context.
- Record type.
- Service date.
- Date entered.
- Status or result.
- Technician who entered the record.
- Original performer for past records.
- Diagnosis or findings.
- Treatment.
- Medicine and dosage.
- Notes.
- Source request.
- Linked reproductive record.
- Attachments.
- Follow-up date.

Avoid maintaining unrelated record-detail modal designs for each record type.

### 9. Contextual Add Record menu

Do not present all service forms at the same time.

Recommended menu:

```text
Add Record

Health
  Health Check
  Treatment
  Vaccination
  Deworming
  Weight

Breeding
  Record AI
  Pregnancy Diagnosis
  Record Calving

Other
  Add Note or Photo
  Add Past Record
```

Only display biologically and operationally valid actions.

Examples:

- Male animal: hide AI, pregnancy, and calving actions.
- Inseminated animal: prioritize pregnancy diagnosis.
- Pregnant animal: prioritize monitoring and calving.
- Active withdrawal period: display a prominent warning.

### 10. Registration versus service entry

Clearly distinguish:

```text
Register Farmer
Register Animal
Record Scheduled Service
Record Unscheduled Visit
Add Past Record
```

Recommended walk-in flow:

```text
Search existing farmer
→ Select existing farmer or register new
→ Select existing animal or register new
→ Record service
```

New registration should be the exception after search, not the default service path.

### 11. Service Requests

Recommended title and subtitle:

```text
Service Requests
Review, schedule, and complete farmer service requests.
```

Recommended filters:

- Needs Review.
- Accepted.
- Scheduled.
- In Progress.
- Cancellation Requested.
- Completed.
- Overdue.

Every request should display:

- Service type.
- Farmer.
- Animal.
- Barangay.
- Requested date.
- Scheduled date.
- Urgency.
- Assigned technician.
- Next valid action.

Show one primary next action. Move secondary actions into a menu where appropriate.

### 12. Schedule

Rename `Deployment Schedule` to `Schedule`.

Recommended content:

- Today and Week views.
- Service type.
- Farmer.
- Animal.
- Barangay.
- Scheduled time.
- Status.
- Overdue indicator.
- Open request action.
- Call farmer action.
- Open location action.

Use service-visit language rather than deployment language.

### 13. Map and route tools

Recommended naming:

| Current | Recommended |
| --- | --- |
| GIS Field Hub | Map & Locations |
| Tactical Route Optimizer | Route Planner |
| Coordinate Matrix | Locations |
| Sync Map Waypoints | Refresh Route |
| Deployment | Visit |

The map should prioritize:

- Today's visits.
- Urgent health cases.
- Farmer location.
- Animal and service context.
- Open request.
- Start directions.

### 14. Reports and performance

Separate official reporting from personal performance.

```text
Reports & Exports
Generate official service and registry documents.

My Performance
Review personal workload, completion rate, and service outcomes.
```

Reports should prioritize:

- Date range.
- Record type.
- Farmer.
- Animal.
- Barangay.
- Export format.

Avoid subtitles based on compliance compilation, telemetry, or officer audits unless the page genuinely performs those functions.

### 15. Shared asynchronous states

Standardize important pages with:

- Layout-matched skeleton loading.
- Useful empty state.
- Contextual error message.
- Retry action.
- Stale-data indicator.
- Disabled submit state.
- Offline versus server-unavailable distinction.

Priority pages:

- Overview.
- Farmers.
- Animals.
- Farmer Profile.
- Animal Records.
- Service Requests.
- Schedule.
- Reports.

## Implementation Roadmap

## Phase W1: Language and navigation alignment

Scope:

- Page titles.
- Subtitles.
- Buttons.
- Table columns.
- Empty states.
- Tooltips.
- Report labels.
- Page metadata.

Do not change route paths.

Acceptance criteria:

- `Farmer` replaces technician-facing `Client`.
- `Animal` replaces technician-facing `Asset`, `Unit`, and `Fleet`.
- Page titles match sidebar labels.
- Primary UI no longer uses GIS, deployment, telemetry, or system-hub terminology unnecessarily.
- Behavior and backend contracts remain unchanged.

## Phase W2: Overview restructuring

Scope:

- Put priority work before metrics.
- Add urgent, today, overdue, and due-follow-up sections.
- Add quick farmer and animal search actions.
- Add partial-data and Retry states.

Acceptance criteria:

- Technician identifies the next task within five seconds.
- Urgent work is visible without scrolling on a typical laptop.
- Metrics remain available but secondary.

## Phase W3: Farmer and animal discovery

Scope:

- Farmers directory.
- Farmer profile.
- Animals directory.
- Direct record and service actions.
- Preserved search/filter state.

Acceptance criteria:

```text
Find farmer
→ Select animal
→ Open records
```

The flow should require no more than three major interactions.

## Phase W4: Animal Records workspace

Scope:

- Complete unified history.
- All official record categories.
- Search, filters, date range, and pagination.
- Standard record-detail presentation.
- AI, pregnancy, calving, mother, and offspring links.

Acceptance criteria:

- One animal has one understandable chronological history.
- Every record opens a consistent detail view.
- A technician can quickly find an old treatment, vaccination, or AI attempt.

## Phase W5: Contextual service entry

Scope:

- Add Record menu.
- Current health record.
- Scheduled-service completion.
- Unscheduled visit.
- Past record.
- AI, pregnancy, and calving actions.

Acceptance criteria:

- Registration and service recording are visibly different.
- Farmer and animal context remains visible throughout.
- Invalid actions are hidden or clearly explained.
- Past records show service date and entry date separately.

## Phase W6: Requests and schedule

Scope:

- Simplified Service Requests hierarchy.
- One primary next action.
- Cancellation review clarity.
- Simplified Schedule wording and layout.
- Links to exact request and animal records.

Acceptance criteria:

- Technician understands the next permitted action.
- Scheduled, overdue, cancelled, and completed work are distinct.
- Request and schedule states remain synchronized.

## Phase W7: Map, reports, and performance

Scope:

- Simplify map and route language.
- Separate official reports from personal performance.
- Improve filters, exports, and drill-down links.

Acceptance criteria:

- Map supports field visits rather than emphasizing GIS terminology.
- Reports are clearly official outputs.
- Performance is clearly personal operational feedback.

## Phase W8: Accessibility and responsive QA

Verify:

- Keyboard navigation.
- Screen-reader labels.
- Focus management after dialogs.
- Text and button contrast.
- Status information beyond color alone.
- Tablet layouts.
- Smaller laptop layouts.
- Dark mode.
- Browser zoom at 200%.
- Long farmer names, animal identifiers, and notes.
- Loading, empty, error, retry, and disabled states.

## Recommended Starting Order

1. Phase W1: language and page-title alignment.
2. Phase W2: Overview restructuring.
3. Phase W3: farmer and animal discovery.
4. Phase W4: complete Animal Records workspace.
5. Phase W5: contextual Add Record workflow.

These phases directly support the primary technician goal without requiring a full redesign.

## Safety Rules

- Preserve existing route paths during the naming phase.
- Preserve BreedSmart colors, logo, and established identity.
- Do not change backend field names merely to change visible labels.
- Do not invent operational values when data is missing.
- Use `Not recorded` for missing information.
- Do not use `updatedAt` as the last service, visit, or AI date.
- Preserve existing authorization and workflow protections.
- Do not copy the mobile layout directly into the web dashboard.
- Verify each phase with web lint, tests, production build, and manual responsive review.

## Definition of Done

The web UI improvement is complete when a technician can:

1. Understand the navigation without technical training.
2. Identify urgent and scheduled work immediately.
3. Find a farmer by name, phone, or barangay.
4. Open one of that farmer's animals directly.
5. Search the animal's complete official history.
6. Open linked AI, pregnancy, calving, and health records.
7. Add the correct current, unscheduled, or past record.
8. Distinguish registration from service recording.
9. Recover clearly from loading, empty, error, and offline states.
10. Complete the workflow on common laptop and tablet sizes.
