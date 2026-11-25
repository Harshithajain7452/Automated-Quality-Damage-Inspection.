# Firestore Security Specification

## 1. Data Invariants
1. **Identity Isolation**: Every user profile (`/users/{userId}`), inspection (`/inspections/{inspectionId}`), finding (`/inspections/{inspectionId}/findings/{findingId}`), and custom standard (`/standards/{standardId}`) belongs exclusively to its `ownerId` (or `uid` for `/users`), and `request.auth.token.email_verified == true` is required for all mutations.
2. **No Self-Privilege Escalation**: Users cannot assign any role other than `'inspector'` on profile creation and cannot change `role`, `uid`, `ownerId`, or `createdAt` on updates.
3. **Master Gate Integrity**: A `DefectFinding` under `/inspections/{inspectionId}/findings/{findingId}` cannot exist without a parent `/inspections/{inspectionId}` document whose `ownerId` matches `request.auth.uid`.
4. **Terminal State Locking**: Once an inspection reaches `status == 'archived'`, no further updates are permitted.
5. **Temporal & Volumetric Integrity**: All `createdAt` and `updatedAt` timestamps must equal `request.time`. All strings, numbers, arrays, and document IDs are strictly bounded.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read or write on `/inspections/{id}`.
2. Creating an inspection with `ownerId` spoofed to another user's UID.
3. Creating an inspection with a shadow field `isAdminApproved: true`.
4. Creating an inspection with an invalid `verdict: "BYPASS"` or `qualityScore: 999`.
5. Creating an inspection with `createdAt` backdated to a client timestamp instead of `request.time`.
6. Updating an inspection to mutate `ownerId` or `aiVerdict` or `createdAt`.
7. Updating an inspection after `status` has already been set to `'archived'`.
8. Creating an inspection with an oversized `summary` (> 1000 chars) or `defectsSummary` (> 15 items).
9. Creating a `/users/{userId}` document with `role: "admin"`.
10. Listing `/inspections` without constraining `ownerId == request.auth.uid`.
11. Creating a finding under `/inspections/{otherUserInspectionId}/findings/{findingId}`.
12. Creating a document with an invalid ID containing `/` or spaces or length > 128 chars.
