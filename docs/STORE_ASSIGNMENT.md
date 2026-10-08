# Store Incharge assignment — 8 October 2026

Implemented locally in Pagariya and installed in Supabase project `nnbijpmsixebfqeqamdd`.

## Using the flow

- Advisor Work → Parts Required: select a Store Incharge and enter the requisition details before sending to Store.
- Supplementary → Additional parts requirement: select a Store Incharge for the separate supplementary requisition.
- Store Incharge: the Store queue, counts and vehicle actions cover only their assigned active Store vehicles.
- CEO Admin: open the operational Store workspace. Below each vehicle card, use **Assign / Change Store Incharge**. Select an active Incharge and save. Use **Refresh assignment** if someone changed it while the dialog was open.
- The original Advisor assignment and job ownership remain intact for monitoring and later workflow steps.
- At Floor handover, the Store assignment closes and the Floor Incharge becomes the current assignee.

Existing Store vehicles **MHOL1212**, **MHPL3636**, **MH12LK6655** retain their historical records. They still need an explicit CEO Admin Store assignment. No person was automatically selected.

## Database behavior

Reuses `vehicle_assignments` with `assignment_role='STORE_TEAM'`; adds no tables or columns. Assignment updates the visit and vehicle current assignee atomically, closes the prior Store assignment and records a workflow event. Reassignment checks the previous assignee to reject stale saves. Visit locking serializes assignment changes and Store actions.

`new_workflow_process_advisor_work_v3` adds Store selection while retaining the no-parts Floor path. `new_workflow_supplementary_parts_assigned` covers supplementary requisitions. Legacy parts handovers without a selection now return an update/selection error instead of silently creating unassigned Store work; existing no-parts routing remains compatible.

Restrictive SELECT policies limit Store users on vehicles, visits, requisitions, orders, Advisor Work and assignment history. Other roles retain their prior policies. Dedicated create-order, receive-parts and handover functions also check active role, current stage and the active Store assignment, preventing direct-call bypasses. Supplementary requirement lookup uses the same visibility restriction. Internal assignment helpers are private and cannot be called by app roles. Relevant new public functions deny anonymous execution; removed pre-existing anonymous grants from create-order and receive-parts.

Applied migrations: `store_incharge_assignment_scope`, `store_actions_require_authenticated_session`. Complete installed definitions are saved in `docs/store_incharge_assignment.sql`.

## Validation

- `node scripts/tests/store-assignment.cjs`: actual client callbacks for personal/Admin queue scope, inactive/unauthorized profiles, clearing stale data, reassignment payload, stale failures, confirmed success and duplicate taps; integration checks for both handover screens and direct-link restriction.
- `docs/store_incharge_assignment_tests.sql`: fresh synthetic Paid, Insurance and supplementary vehicles; invalid/missing selection; legacy bypass rejection; preserved Advisor ownership; order/receipt/handover authorization; Admin-only reassignment, stale-save guard and assignment history; real authenticated-role RLS; no-parts Floor and regular Store-to-Floor handover. Entire transaction rolled back; verified zero synthetic vehicles remain.
- TypeScript, existing shared input regression suite and Android/iOS/web Expo bundle export passed. Existing static route warnings about helper components under `src/app` remain outside this change.
- Security advisors reviewed. Signed-in execution warnings for the intended public workflow endpoints are expected; their internal authorization is tested. Unrelated existing legacy-function/Auth advisories remain outside this assignment change. See [Supabase function-execution advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

**NEEDS VERIFICATION:** hands-on Android/iOS/web selection and reassignment UI, true simultaneous-device contention, and the full supplementary return-to-Floor UI. Rollback tests validate the new supplementary Store assignment but do not establish complete supplementary device acceptance. No dependency or native-build configuration changes. Changes are local and not pushed; an installed APK requires a new build to include these screens.
