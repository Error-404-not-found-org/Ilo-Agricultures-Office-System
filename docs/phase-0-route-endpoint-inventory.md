# Phase 0 Route and Endpoint Inventory

Last verified: 2026-07-11

## Purpose

This inventory identifies the active technician web destinations and the principal backend contracts they consume. It is a migration aid, not a replacement for route-level tests.

## Technician Web Destinations

| User-facing destination | Preserved route | Primary page | Principal API contracts | Ownership decision |
|---|---|---|---|---|
| Overview | `/technician/dashboard` | `DashboardTechnician.jsx` | `GET /technician/dashboard-data`, `GET /technician/analytics` | Keep |
| Service Requests | `/technician/requests` | `Requests.jsx` | `GET /technician/requests`, canonical status/claim endpoints by request type | Keep |
| Farmers | `/technician/farmers` | `FarmersDirectory.jsx` | `GET /user?role=farmer`, `POST /technician/register-farmer` | Keep |
| Farmer Profile | `/technician/farmers/:id` | `FarmerProfile.jsx` | `GET /user/:id`, `GET /animals/farmer/:id` | Keep |
| Animals | `/technician/animals` | `Animals.jsx` | `GET /animals/all` with server pagination and filters | Keep |
| Animal Profile | `/technician/animals/:id` | shared `LivestockProfile.jsx` | animal detail, animal history, medical and reproduction contracts | Keep; complete unified history in Phase 3 |
| Breeding and Pregnancy Records | `/technician/ledger` | `BreedingLedger.jsx` | technician AI, pregnancy, and calving list endpoints | Keep as focused record view |
| AI Services | `/technician/inseminations` | `Inseminations.jsx` | `GET /technician/inseminations` | Keep as focused record view |
| Calving Records | `/technician/newborns` | `Newborns.jsx` | `GET /technician/calvings` | Keep as focused record view |
| Health Records | `/technician/health` | `Health.jsx` | `GET /health-request`, health request status endpoints | Keep as focused record view |
| Schedule | `/technician/schedule` | `Schedule.jsx` | operational requests and technician profile contracts | Keep |
| Map and Locations | `/technician/health-map` | `HealthMap.jsx` | `GET /gis/hub-data` | Keep; label simplified |
| Notes and Photos | `/technician/field-notes` | `FieldNotes.jsx` | technician field-note contracts | Keep |
| Reports and Exports | `/technician/reports` | `Reports.jsx` | AI, pregnancy, calving, health, farmer, and animal reporting queries | Keep; pagination work required |
| My Performance | `/technician/analytics` | `Analytics.jsx` | `GET /technician/analytics` | Keep |
| Ask Moowie | `/technician/moowie` | `Moowie.jsx` | dashboard registry and `POST /moowie/ask` | Keep |
| My Profile | `/technician/profile` | `Profile.jsx` | technician profile, analytics, user update | Keep |
| Settings | `/technician/settings` | `Settings.jsx` | configuration and local preference contracts | Keep |

## Official Record Mutations

| Record operation | Canonical active contract | Known callers |
|---|---|---|
| Record walk-in AI | `POST /technician/walk-in-insemination` | Web walk-in AI form; mobile technician record-AI service |
| Update AI workflow status | `PATCH /ai-request/:id/status` | Current mobile technician workflow; legacy technician URL remains an adapter |
| Record pregnancy diagnosis | `POST /technician/pregnancy-check` | Web and mobile pregnancy forms; shared transaction service owns persistence |
| Record calving | `POST /technician/record-calving` | Web and mobile calving forms; shared transaction service owns persistence |
| Record walk-in health service | `POST /health-request/walk-in` | Web health modal and mobile manual health workflow where migrated |
| Update health request | `PATCH /health-request/:id/status` | Web/mobile service-request workflow |
| Register farmer | `POST /technician/register-farmer` | Web and mobile technician registration forms |
| Register animal | `POST /technician/walk-in-livestock` | Web and mobile technician animal-registration forms |

## Compatibility Rules

- Do not remove `/technician/inseminations/:id/status` until installed clients and queued offline mutations no longer depend on it.
- Preserve current technician web route slugs during navigation and terminology work.
- Registration creates a farmer or animal identity. It does not create an official service record.
- Completing an official-service request must result in exactly one linked official record.
- Animal history is the target cross-record workspace; focused record pages may remain as secondary views.

## Outstanding Phase 0 Work

- Create and verify a development database backup.
- Run `npm run migrate:status-vocabulary` against development only.
- Record migration matched/updated counts.
- Spot-check migrated animal and health records.
- Expand this inventory to cover every farmer-mobile mutation before Phase 6.

