# Floor correction verification — 5 October 2026

## Live results

| Check | GJ25LP6363 | MH33JK3030 |
|---|---|---|
| Active jobs | 1, existing Insurance job | 1, reconstructed Paid job |
| Job approval | Approved at original approval time | Approved at recorded approval time |
| Stage/status | Floor / Pending | Floor / Pending |
| Original Floor entry | Preserved, 5 October 2026 12:30:39 IST | Preserved, 1 October 2026 18:42:49 IST |
| Open history stages | 1 | 1 |
| Correction audit events | 1 | 1 |
| Approval photo/job link | Matches | Matches |
| Floor cycles/work starts manufactured | None | None |

The historical MH33JK3030 approved cycle 2 is now INITIAL; the prior pending cycle 1 remains as historical evidence. Original events retain their original metadata, including the old cycle label. The correction event documents this discrepancy and the resolution.

Correction audit IDs: GJ25LP6363 ecae4d58-90d7-4b00-9521-a7725de29607; MH33JK3030 95d391be-339b-41d8-8d26-85e3b3154a00. Maintenance uses the database-owner session; the audit explicitly identifies this and leaves application performed_by null. No CEO login was impersonated.

## Checks performed

- Both correction paths were executed under ROLLBACK before permanent execution; repeated calls and unauthorized Advisor were rejected.
- Two concurrent requests for the approved GJ correction produced one success and one already-applied rejection; only one audit row persisted.
- Fresh rollback fixtures verified Paid/Insurance direct Survey approval, pending Survey approval, active-job synchronization, missing job/session, unauthorized Store user, repeated Survey submission, mismatch blocking before Advisor Work/Store handover, and one-open-stage consistency.
- Real dedicated Advisor Work and Store create-order/receipt/handover RPCs returned fresh fixture vehicles to Floor with synchronized jobs.
- Supplementary regression passed three cycles, Hold/Resolve same-cycle reuse, rejection/continuation, optional fields, extra-parts Store handover and role/RLS checks.
- Reconciliation function is private and has no anon/authenticated/service_role execution. Changed Survey function is authenticated-only. Existing RLS is preserved. Security advisors reported no new notices (4 before and after).
- TypeScript and diff checks passed. Database tests retained no fixtures.

## Limits

Android visual checks, actual evidence rendering and complete Gate In/Gate Out regression remain NEEDS VERIFICATION. Work update actions are deferred with the dedicated Floor Incharge workflow; Pending work is not a completed-work assertion. Floor time is queue duration, not labor duration. Lint configuration remains absent; no dependency changes were made.
