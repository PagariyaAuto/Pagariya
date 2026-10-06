# Evidence-based reconstruction preview

Owner approved the repair and prevention scope. This preview records the proven sources before execution.

## GJ25LP6363

Keep its existing job, Intake, Survey, visit stage, Floor entry time, assignment and history. Set job approval status from Pending to Approved and approval_at to the existing initial approval_received_at (5 October 2026, 12:30:03 IST). Source: initial Approved cycle and SURVEY_COMPLETED_APPROVAL_RECEIVED event reference the same job. No Floor Incharge, work-start time or work completion is supplied.

## MH33JK3030

| Job field | Reconstructed value/source |
|---|---|
| Vehicle and Advisor | Existing visit and unique active Advisor assignment |
| Job type | PAID, from completed Intake |
| Job card | 12345, from Intake |
| Vehicle type / Arena-Nexa | PRIVATE / NEXA, from Intake |
| Vehicle model ID | Existing Intake model reference |
| Insurance company / MI type | Null as in Paid Intake |
| Survey time | Existing completed initial Survey, 1 October 2026 13:44:12 IST |
| Approval status/time | Approved, from recorded approval and approval event, 1 October 2026 15:01:43 IST |
| Current job stage | FLOOR, matching unchanged open visit |
| Floor assignment | Existing assignment and matching parts handover; retain original actor/time |
| Advisor remarks | Existing Intake remarks |
| Customer/name snapshots | Leave unavailable historical snapshots null; do not copy current details into historical fields |
| Job created_at | Correction time, with original Intake timestamp in audit metadata |

The historical approval cycle 2 is labelled SUPPLEMENTARY, but its event records PENDING_APPROVAL → ADVISOR_WORK, and no supplementary cycle or survey exists. Correct its cycle_type to INITIAL and audit the original label. Retain the old pending cycle 1 and all original events/history. Link the existing approval photo to the reconstructed job after verifying its Storage object; retain its original upload actor/time.

## Authorization and audit

Corrections run through a private, non-client-callable reconciliation function. Normal application identities must be active CEO Admin; approved maintenance uses the verified PostgreSQL database-owner session. Maintenance audit records explicitly identify owner-approved database maintenance and the database operator, with performed_by null rather than impersonating a CEO session. Before/after values, evidence IDs, original cycle label, reason and correction time are stored in workflow_events.

Locks and expected-job checks reject stale/repeated calls. Missing-job guards remain in operational functions. No completed work, Floor work cycle or labor timestamps are manufactured; operational Floor assignment/start behavior remains deferred.
