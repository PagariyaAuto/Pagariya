# Supplementary proposal — Pagariya Auto

Prepared from repository and live PagariaDemo database inspection on 2026-10-05. Status: PROPOSAL ONLY. No application code, database definitions or live records changed during preparation. Implementation requires owner approval of the final scope and the decisions below.

## Where we are

- Owner tested MH98UI0909 through Approval Hold → Resolve → Approved. Live database confirms one reused INITIAL cycle, retained Hold remark/timestamp/photo, intact audit events, consistent assignment and Advisor Work as the resulting stage. Negative authorization, mandatory-field and concurrency cases remain NEEDS VERIFICATION.
- Supplementary dashboard card exists but points to `/(tabs)/advisor/approval`, which has no corresponding screen. Dashboard counts already recognize SUPPLEMENTARY_SURVEY and SUPPLEMENTARY_APPROVAL.
- Existing tables: supplementary_cycles, floor_work_cycles, floor_work_items, surveys and approval_cycles. Per-visit cycle/survey numbers have unique indexes. All have RLS enabled; their current SELECT policies allow active users broadly, rather than enforcing Advisor ownership.
- Live counts: supplementary_cycles = 0, floor_work_cycles = 0, floor_work_items = 0. These counts do not establish readiness of the older Floor implementation.
- No public function writes supplementary_cycles. Initial Survey functions accept PENDING_SURVEY and write INITIAL records. Approval accepts PENDING_APPROVAL and sends approved vehicles to ADVISOR_WORK. Hold Resolve returns to PENDING_APPROVAL.
- Current Floor Incharge screen uses floor_work_progress and legacy start/complete/advance functions; it does not use the visit-based Floor cycle/item architecture. The observed open FLOOR visit has no active vehicle job. It must not be used to hide missing-job defects or be automatically repaired.
- Advisor Work has UNIQUE(visit_id) and a duplicate-record guard. A second supplementary parts requirement cannot simply run through the original save operation.
- Active work-type master already contains STRIPPING, DENTING, PAINTING, FITTING and DUSTING. Floor Incharge has no photo-upload permission. vehicle_photos.event_id references vehicle_events, not workflow_events; supplementary evidence must not misuse that foreign key.

## Recommended business flow

1. During Floor stripping, the assigned Floor Incharge or assigned Advisor raises Supplementary with a mandatory reason. Optional discovery photos are recommended; mandatory discovery photos would require an explicitly scoped Floor upload permission. Work stops when the request saves successfully.
2. The same visit and active job continue. A numbered supplementary cycle records the originating Floor cycle/item, requesting actor and time. Existing completed work and initial approval remain historical records.
3. The assigned Advisor sees the request in Supplementary → Survey, including the reason, evidence and prior cycles. Save Survey creates a SUPPLEMENTARY survey and links it to that specific supplementary cycle.
4. Every completed supplementary survey opens SUPPLEMENTARY_APPROVAL with one linked SUPPLEMENTARY/PENDING approval cycle. The owner explicitly requires a separate approval step: supplementary Survey cannot approve directly, even though initial Survey still permits that behavior.
5. Approval Hold uses the existing APPROVAL_HOLD branch and mandatory Hold remark/photo. Resolve returns to PENDING_APPROVAL/PENDING and resets the same approval cycle to PENDING. The linked supplementary cycle determines which queue/form handles the next approval; Resolve does not approve or create another cycle.
6. Approved supplementary work without extra parts returns to Floor. If extra parts are required, use Advisor Work (a supplementary work-requirement step) → Store → Floor, retaining the original Advisor Work record.
7. Returning to Floor records the receiving Floor Incharge and time and creates the next Floor cycle. Paused source work stays in history; resumed work references its source through explicit links/audit metadata. Resume/start is a separate action, so approval does not falsely record work as already started or completed.
8. The loop can repeat without a fixed limit. Permit only one unresolved supplementary request per visit. Rejection/Total Loss must record the linked cycle outcome, preserve the paused work and follow the explicitly supported exit/rejection behavior; neither may restart Floor automatically.

## Owner decisions confirmed

| Decision | Owner choice | Effect |
|---|---|---|
| Who can raise the request? | Either assigned Floor Incharge or assigned Advisor | Server checks the role-specific assignment; vehicle.current_assigned_to alone is insufficient at Floor |
| Direct approval during supplementary Survey? | No | Every completed survey enters Supplementary Approval; initial Survey behavior remains unchanged |
| Additional parts after approval? | Advisor Work → Store → Floor | Requires cycle-linked requisition handling without overwriting the initial work requirement |

Also NEEDS VERIFICATION before the affected branch is finalized: whether Paid supplementary work requires a new amount/receipt, permitted supplementary rejection/Total Loss outcomes, and whether discovery photos must be mandatory. These are not reasons to silently add payments, convert jobs or require new evidence.

## Screens and routing

- Correct the existing dashboard card to a new Supplementary queue with Survey, Approval and History views. Advisors see assigned vehicles; CEO Admin monitoring follows supported role permissions.
- Add Supplementary detail/Survey/Approval screens with cycle number, source work, reason, evidence, timestamps and previous decisions. Reuse current visual controls, dialogs and photo viewer behavior rather than copying the entire initial workflow.
- Add the request action to a visit-based Floor view and support stopped/resumed work. This is the minimum Floor connection required for Supplementary; the broader Floor completion/inspection module remains separate.
- Make Hold details and Pending Approval routing recognize an explicitly linked supplementary cycle. Initial approval actions must not consume a supplementary pending cycle and send it down the wrong route.
- Validate readiness on load and before upload/save. Missing active visit/job, ownership conflicts and moved stages show Refresh/Back; no assignment or stage movement occurs on form opening.

## Database changes proposed

- Reuse existing cycle, survey, approval, event, history, assignment and photo tables. Add only the confirmed missing links needed to identify the source Floor cycle, supplementary work/requisition and return Floor cycle. Exact additive columns/constraints will be presented with the implementation migration.
- Add dedicated atomic operations for request, supplementary Survey, supplementary decision and return-to-Floor/work routing. Names/signatures are proposed APIs, not existing live functions. Keep current public initial-workflow signatures compatible.
- Extend the shared Hold Resolve operation only for linked supplementary status synchronization, preserving its PENDING_APPROVAL return and same-cycle rule. Guard initial approval entry points against processing supplementary context incorrectly.
- Keep UNIQUE(visit_id) for original Advisor Work. For extra parts, create a supplementary-linked requisition with its own number/time through a dedicated operation; retain the original work requirement and historical order rows. Trace Store callers before making its queues cycle-aware.
- Terminal rejection/Total Loss require targeted supplementary status-constraint support if those decisions are included. Define returned-to-Floor separately from completed work; do not mark Supplementary completed at approval time.
- Authenticate, require active profiles, validate exact visit/vehicle/job/cycle relationships and assigned actors, lock rows consistently, allocate numbers under the visit lock, write audit/history and mirror vehicle/job state in one transaction. Require the Intake-created active job; never create a replacement job here.
- Enforce assigned Advisor access on server reads and mutations, not just queue filters. Review all callers of touched SELECT policies before tightening them so required Floor/Store/CEO reads remain supported. Scope any Floor photo upload to the assigned vehicle and its request; do not grant general bucket upload rights.
- Reuse photo records and bucket. Store cycle-specific photo IDs/references in workflow metadata and verify undeleted records, job/vehicle association and expected evidence type. Failed or retried submissions must not delete evidence belonging to an already committed operation. No historical data patch or bucket recreation.

## Implementation order and completion checks

1. Finalize remaining branch details and additive schema, exact operation signatures, permissions and Floor/Store dependencies for review.
2. Implement the dedicated backend and minimum visit-based Floor stop/request/return connection.
3. Add Advisor queues/forms and linked Hold routing; integrate the confirmed extra-parts branch.
4. Test fresh vehicles through at least two supplementary cycles, including mandatory separate approval, Hold → Resolve → Approve, no-parts and extra-parts routes, and supported negative decisions. Verify that direct approval is rejected for supplementary Survey while remaining available for initial Survey.
5. Verify actors, business times displayed in IST, cycle links/numbers, retained initial records/photos, stage/history closure, one active job, assignments and stopped/resumed work. Test wrong Advisor/Floor Incharge, inactive user, missing job, blank reason, missing proof, moved stage, concurrent/double submission and upload/save failure.
6. Run TypeScript and applicable configured repository checks; verify Android loading, errors, success, safe areas and Back navigation. Regress completed Intake/Claim/initial Survey/direct approval/Approval/Hold/Advisor Work/Store flows.

Supplementary is complete only when the full Floor → Advisor → Survey → Approval → Floor loop passes UI and database checks. This proposal does not mark Floor, Supplementary or remaining modules complete, and it is not an executable migration.
