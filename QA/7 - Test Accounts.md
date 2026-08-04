# BreedSmart QA Test Accounts

## Security rules

- Development/QA accounts only.
- Never record passwords, one-time codes, Clerk secret keys, API tokens, or database credentials here.
- Share credentials through an approved private channel.
- Do not reuse personal production passwords.
- Do not use real private Farmer information.
- Confirm every account's role before seeding or testing.

## Account register

Fill every `TBD` before the coordinated test round.

| Alias | Required role | Intended owner/use | Email | Clerk instance | Verified |
| --- | --- | --- | --- | --- | --- |
| QA-ADMIN-01 | Admin | John Lloyd — Admin and oversight | TBD | Development | NO |
| QA-FARMER-01 | Farmer | Nelmar — seeded lifecycle Farmer | TBD | Development | NO |
| QA-FARMER-02 | Farmer | Fresh registration/request testing | TBD | Development | NO |
| QA-TECH-MOBILE-01 | Technician | John Arvy — Technician Mobile | TBD | Development | NO |
| QA-TECH-WEB-01 | Technician | Justine — Technician Web | TBD | Development | NO |
| QA-TECH-SECONDARY-01 | Technician | Concurrent claim/ownership tests | TBD | Development | NO |

## Seeder accounts

The lifecycle seeder requires existing database records for:

| Seeder argument | Account alias | Exact email |
| --- | --- | --- |
| `--farmerEmail` | QA-FARMER-01 | TBD |
| `--technicianEmail` | Choose one primary Technician | TBD |

The QA Lead must verify that both accounts exist in Clerk development and the development database before running the seeder.

## Account verification checklist

For every account:

- [ ] Sign-in succeeds.
- [ ] `/api/user` resolves the intended database user.
- [ ] Role matches the register.
- [ ] Account is not suspended unless it is the dedicated suspension test.
- [ ] Display name clearly indicates a QA account without exposing a seed prefix to ordinary users.
- [ ] No production personal data is attached.

## Test data ownership

| Data group | Owner | Rule |
| --- | --- | --- |
| RC26 lifecycle records | QA Lead | Shared read access; mutate only when workbook assigns the action |
| Fresh Farmer/Animal registration | Technician Web tester | Do not reuse RC26 Animals |
| Fresh AI request | Farmer tester | Coordinate claim with one Technician tester |
| Fresh Health request | Farmer tester | Coordinate claim/schedule/completion before reuse |
| Concurrent claim record | QA Lead | Both Technician testers attempt only during scheduled test window |

## Dedicated negative accounts

Create only if required; do not repurpose primary workflow accounts.

| Alias | State | Purpose | Email | Verified |
| --- | --- | --- | --- | --- |
| QA-SUSPENDED-01 | Suspended | Suspended-access test | TBD | NO |
| QA-FARMER-OTHER-01 | Active Farmer | Cross-Farmer ownership test | TBD | NO |

QA Lead approval: `TBD`

Date verified: `TBD`
