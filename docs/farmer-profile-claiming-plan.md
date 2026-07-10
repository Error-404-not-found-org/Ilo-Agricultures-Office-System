# Farmer Profile Claiming Plan

## Goal

Allow a farmer who was first registered by a technician without an email or Clerk login to later create an app account and safely connect that account to the existing farmer profile, animals, AI records, health records, and history.

The current backend has partial automatic linking, but it is not reliable for no-email farmers because it can only fall back to exact name matching. This plan replaces risky name-based linking with a safer claim-code workflow.

## Current Problem

Example situation:

1. A technician registers Juan Dela Cruz during a field visit.
2. Juan has no email yet, so the system creates a local farmer profile only.
3. Animals and records are saved under that local farmer `_id`.
4. Later, Juan installs the mobile app and signs up with Clerk using his email.
5. If the new Clerk account cannot be matched to the old local farmer profile, the app may create a second farmer account.
6. Juan logs in but cannot see the animals and records that were registered earlier.

The system should instead let Juan claim the technician-created profile.

## Phase 0: Data Safety Audit

Before implementing, scan existing records.

Tasks:

- Find farmers with no `clerkId`.
- Find farmers with no `email`.
- Find duplicate phone numbers.
- Find duplicate names in the same barangay/municipality.
- Find animals linked to unclaimed farmer profiles.
- Find existing users where `phoneNumber` formats differ but represent the same number.

Acceptance:

- We know whether duplicate or risky records exist before enforcing phone and claim rules.
- No automatic linking is added until duplicate risks are understood.

## Phase 1: User Model Preparation

Add claim-ready fields to the `User` model.

Suggested fields:

- `normalizedPhoneNumber`
- `registeredByTechnician`
- `profileClaimStatus`: `unclaimed`, `pending`, `claimed`, `rejected`
- `profileClaimCode`
- `profileClaimCodeExpiresAt`
- `profileClaimedAt`
- `profileClaimedByClerkId`
- `profileClaimApprovedBy`

Rules:

- Phone numbers must be normalized before saving.
- Claim codes should only be generated for technician-created farmer profiles.
- A claimed profile cannot be claimed again.
- Blank phone numbers should not conflict with each other.
- Duplicate normalized phone numbers should be blocked or moved to manual review.

Acceptance:

- Technician-created farmer profiles can be identified.
- Unclaimed, pending, claimed, and rejected states are explicit.
- Future claim attempts can be audited.

## Phase 2: Technician Farmer Registration

When a technician registers a farmer without email:

1. Create the farmer profile.
2. Require phone number.
3. Normalize phone number.
4. Block duplicate normalized phone number.
5. Generate a claim code.
6. Show the claim code on the registration success screen.
7. Allow the technician to copy/share the code with the farmer.

Example:

```txt
Farmer: Juan Dela Cruz
Claim Code: BRD-482913
```

When a technician registers a farmer with email:

1. Send Clerk invitation.
2. Create local farmer profile.
3. Claim code can be optional fallback, but the main linking path is email invitation.

Acceptance:

- A technician-created no-email farmer always has a claim code.
- Duplicate phone numbers are blocked before profile creation.
- The technician can give the farmer the claim code immediately.

## Phase 3: Farmer First Login Detection

After a farmer signs up or logs in through Clerk, backend checks:

1. Does this Clerk ID already belong to a local user?
2. If yes, continue to the normal farmer dashboard.
3. If no, determine whether the account should see an account setup/claim screen.

Mobile setup screen:

```txt
Welcome to BreedSmart

Were you already registered by a technician?

[ Claim Existing Profile ]
[ Continue as New Farmer ]
```

Acceptance:

- Farmers with linked profiles go straight to the dashboard.
- Farmers without linked profiles are guided into claim or new-profile setup.
- The app does not silently create duplicate farmers when a claim may be needed.

## Phase 4: Claim Existing Profile Screen

The farmer enters:

- Claim code.
- Phone number.
- Barangay/municipality.
- Optional animal ear tag or animal name.

The claim code is the main key. The extra fields are safety checks.

Required UI states:

- Loading.
- Invalid code.
- Expired code.
- Already claimed.
- Details mismatch.
- Claim successful.
- Pending technician/admin approval.

Recommended locations:

- First-login account setup screen.
- Farmer Profile/Settings as `Claim Existing Technician Profile`.

Acceptance:

- A farmer can claim after first login.
- A farmer can also claim later if they skipped onboarding.
- Error states are clear and do not expose too much private information.

## Phase 5: Backend Claim Endpoint

Add endpoint:

```txt
POST /api/user/claim-profile
```

Backend validates:

- Current user is authenticated through Clerk.
- Current Clerk account is not already linked to another farmer profile.
- Claim code exists.
- Claim code is not expired.
- Farmer profile is still unclaimed.
- Optional phone/barangay/animal detail matches enough to pass safety rules.

If valid:

- Attach `clerkId` to the existing farmer profile.
- Attach Clerk email to the existing farmer profile.
- Set `isVerified` to `true`.
- Set `profileClaimStatus` to `claimed`.
- Set `profileClaimedAt`.
- Set `profileClaimedByClerkId`.
- Clear or invalidate the claim code.
- Write an audit log.

Important:

- Do not move animals manually.
- Animals and records should already point to the existing farmer `_id`.
- Once the Clerk account links to that same farmer record, the farmer should automatically see the existing data.

Acceptance:

- Valid claim links the login account to the existing farmer profile.
- Invalid, expired, claimed, or conflicting claims fail safely.
- Existing animals, AI records, health records, and history become visible after successful claim.

## Phase 6: Admin/Technician Review For Risky Claims

If details partially match or duplicates exist, do not auto-link.

Instead:

1. Create a pending claim request.
2. Notify technician/admin.
3. Let staff approve or reject the claim.

Review screen should show:

- Claiming user email.
- Submitted phone.
- Submitted barangay/municipality.
- Matched farmer profile.
- Animals under the profile.
- Technician who registered the farmer.
- Claim attempt timestamps.

Acceptance:

- Risky claims do not auto-link.
- Staff can approve legitimate claims.
- Staff can reject suspicious claims.

## Phase 7: Notifications

Notify relevant users:

- Farmer: claim submitted.
- Farmer: claim successful.
- Farmer: claim rejected.
- Technician: claim submitted for a farmer they registered.
- Admin: claim needs review.

Acceptance:

- Farmers are not left wondering what happened.
- Staff can act on pending claims.
- Claim results are visible in notification history.

## Phase 8: Security Rules

Protections:

- Do not reveal full farmer details before claim validation.
- Limit claim attempts per account/device/IP.
- Expire claim codes.
- Audit every claim attempt.
- Never allow claimed profile to be claimed again.
- Normalize phone numbers before comparison.
- Block duplicate normalized phone numbers where safe.
- Move duplicate-risk cases to manual review.

Acceptance:

- Claiming cannot be brute-forced easily.
- Private farmer records are not exposed during failed claim attempts.
- Mistaken claims can be investigated through audit logs.

## Phase 9: Testing

Backend tests:

- Valid claim code links farmer profile.
- Invalid code fails.
- Expired code fails.
- Already claimed code fails.
- Clerk account already linked to a farmer cannot claim another profile.
- Duplicate phone users require manual review.
- Successful claim writes audit log.

Mobile tests:

- First login shows claim setup when profile is not linked.
- Claim Existing Profile form validates required fields.
- Successful claim redirects to farmer dashboard.
- Existing animals appear after claim.
- Existing AI and health records appear after claim.
- Profile/Settings fallback claim entry works.

Regression tests:

- Existing linked farmers still log in normally.
- Technician farmer registration still works.
- Clerk invitation flow still works for farmers with email.

## Recommended Build Order

1. Data audit and duplicate phone cleanup.
2. Add phone normalization utility.
3. Add claim fields to the user model.
4. Generate claim codes during technician farmer registration.
5. Add backend claim endpoint.
6. Add mobile first-login claim screen.
7. Add Profile/Settings fallback entry.
8. Add notifications.
9. Add admin/technician review for risky claims.

## Notes For Antigravity

- Do not rely on exact-name auto-linking as the primary claim method.
- Do not migrate animals when claiming; link the Clerk account to the existing farmer `User` record instead.
- Keep the original farmer `_id` stable because animals and records already depend on it.
- Normalize phone numbers consistently across create, update, and claim flows.
- Add duplicate-phone protection globally, not only in technician registration.
- Keep all claim changes additive and backward-compatible with existing MongoDB data.
