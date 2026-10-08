# Backend changes recorded on 2026-10-06

These SQL files document backend changes already applied to the connected Supabase project during implementation. They require the existing workflow schema and are not a fresh database setup or an automatic deployment bundle.

- billing_role_backend.sql: Billing Executive invoices, survey advance deduction, insurance customer difference, payments and Advisor return.
- billing_role_rls_fix.sql: Billing record read authorization.
- ready_for_delivery_backend.sql: Advisor/CEO delivery review and clearance to Pending Gate Out.
- gate_out_job_closure.sql: visit-scoped job and assignment closure, with an audited repair of the previously exited job.
- intake_mobile_sync.sql: synchronize Intake mobile to the vehicle record and fill empty values from the latest open visit.

Gate Out/job closure integration passed 26 rollback-only checks. Delivery clearance's Insurance/CEO checks passed separately. Mobile verification confirmed matching Intake and vehicle mobile values for the currently pending Survey visit. Device UI and the full production lifecycle still require verification.
