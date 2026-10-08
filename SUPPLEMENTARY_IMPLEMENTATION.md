# Supplementary implementation — 5 October 2026

Approved implementation is installed in the local app and live Supabase project nnbijpmsixebfqeqamdd. Production app release is not performed by these changes.

## Confirmed business rules

- Assigned Advisor or Floor Incharge can raise Supplementary during stripping; discovery reason is required and discovery photo optional.
- Supplementary Survey always proceeds to a separate Supplementary Approval. Paid amount and receipt fields are individually optional.
- Decisions are Approve, Hold and Claim Rejected. Approval/Hold require proof; Hold/Rejection require remarks.
- Resolve reuses the same pending approval cycle and retains Hold evidence.
- Claim Rejected exposes an explicit Continue without supplementary action. It returns only the original approved scope to Floor and retains the rejected decision and history.
- Approved extra parts proceed through Advisor Work → Store → Floor. The original Advisor Work record is retained; each supplementary requisition links its cycle.
- Multiple supplementary cycles retain their survey, decision, evidence, events and Floor return history.

## Changes

Added Advisor Supplementary list/detail and Floor stripping connection, dedicated atomic RPCs, scoped cycle/photo access, cycle-specific Store requirements and route safeguards. Active job, ownership, stage/status and prior initial approval are checked on the server. Legacy Floor operations reject vehicles with open visits and direct those vehicles to the visit workflow.

Complete database definitions are in docs/supplementary_*.sql. The verification file contains transaction-scoped fixtures and ends with ROLLBACK; it is not a schema migration.

## Verification performed

TypeScript and Expo web export passed. Live rollback-only tests passed three repeated cycles, optional discovery/paid fields, Survey → Approval, Hold → Resolve → Approve using one cycle, Claim Rejected → Continue, supplementary requisition → Store order → receipt → handover, job/state preservation, single open stage/active Floor cycle, duplicate/invalid requests, role/RLS restrictions and legacy Floor bypass rejection. No historical records were repaired or test records retained.

## NEEDS VERIFICATION

Android runtime, actual camera/gallery upload and evidence viewing, navigation/back/safe-area behavior, two-device concurrency and a complete regression of completed workshop modules. Lint remains unavailable because the repository has no ESLint configuration; no dependencies were installed or upgraded for it. Full Floor work completion, Final Inspection, Billing and delivery remain future modules.

Owner test: use a fresh dummy vehicle through the completed Intake/Claim/Survey/Approval path into Floor. Open Floor workflow, prepare the assigned Floor Incharge and start stripping. Test Supplementary without discovery photo, optional Paid fields, Hold/Resolve/Approve, rejection/continuation, and approval with extra parts through Store. Check that the assigned Advisor and Floor Incharge see the appropriate queues and another Advisor cannot access the vehicle.
