# Floor accountability and record correction

## Approved and applied — 5 October 2026

Owner approved this scope in chat. Both evidence-based corrections are complete and verified live. GJ25LP6363 has its existing Approved job; MH33JK3030 has one reconstructed Approved Paid job and audited correction of the mislabelled initial approval cycle. All original history and Floor entry times are preserved. Work cycles/start/completion remain unrecorded, consistent with deferred operational Floor work. Reconstruction preview: FLOOR_RECONSTRUCTION_PREVIEW.md.

Direct Survey approval now synchronizes job approval fields; Advisor Work and Store handover reject disagreement with approved initial scope. Rollback-only tests passed the affected workflow paths and supplementary regression. Concurrent repair requests produced one correction and one duplicate rejection. No test fixtures were retained.

Read-only live verification on 5 October 2026:

- MH33JK3030: open Floor visit since 1 October 2026, Intake exists, no vehicle job, no Floor cycle. Historical initial approval is Pending and a supplementary approval is Approved. This cannot safely be fixed by inserting a generic approved job.
- GJ25LP6363: open Floor visit since 5 October 2026, one active Insurance job, Intake exists, initial approval cycle Approved, job approval status Pending, no Floor cycle. Historical visit stages show Survey directly moved to Advisor Work, then Floor.

## Applied display correction

Floor cards now use the current open Floor visit stage_started_at for Time on Floor. This is independent of Floor cycle preparation. On Floor since is shown in detail in IST. Waiting becomes Pending. Empty work is Work update pending; missing job is Vehicle record correction pending. Server missing-job guards remain intact.

## Approved repair scope

1. Trace the deployed direct-survey approval function and other Floor entry callers. Ensure approved decisions synchronize the active job, and future Floor entry records the appropriate cycle/work scope atomically when the operational Floor rules are approved. Full Floor Incharge assignment and work-start behavior remain deferred.
2. For GJ25LP6363, validate the approved initial cycle against its visit, survey and active job; correct only proven job approval fields with an explicit correction event recording actor, reason, old/new values and source approval. Do not invent assignment, work starts or completed items.
3. For MH33JK3030, inspect the Intake, survey, both approval cycles, Advisor Work, Store handover and assignment records. Produce a field-by-field reconstruction preview and resolve the old initial/supplementary approval interpretation before any job is created. Preserve all original history.
4. Execute approved corrections atomically with CEO authorization, locks, expected-state checks and an audit event. No generic move-stage or missing-job bypass; no history deletion. If evidence is incomplete, require a custom correction popup collecting the missing business facts rather than filling defaults.
5. Validate corrected vehicles and fresh Survey direct-approval/Advisor Work/Store paths, including repeat/concurrent attempts. A historical repair alone is not the prevention fix.

The current display fix does not establish work-start/end accountability. That requires the deferred operational work update actions to record actor, start/end times and history. Time on Floor is queue duration, not labor duration.
