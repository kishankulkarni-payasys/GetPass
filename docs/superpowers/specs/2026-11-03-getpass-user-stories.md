# GatePass — User Stories and Open Tasks

Date: 2026-11-03. Done / Gap is judged against the code on that date. Only open tasks are listed.

## IN — Inward vehicle gate pass flow

US-IN-01 | As a Security Guard, I want to create inward and other-vehicle passes with camera capture, OCR I confirm, PO checks and an offline queue, then let out only vehicles cleared to leave, so that every truck is logged and released correctly. | Must | Done

US-IN-02 | As a Weighbridge Operator or Quality Inspector, I want stable-only weight capture with manual and re-capture history, and a quality queue with per-line results, so that weights and inspections are correct and traceable. | Must | Gap

T-IN-01 | Remove the legacy PATCH /api/entries/{id}/weight route so weight can only be recorded through the weighment rules | Backend | US-IN-02 | To do

US-IN-03 | As a Store In-charge, I want GRNs only after quality, editable drafts, segregation of duty, ERP posting with retry and clear failure messages, so that material is received correctly and reaches the ERP once. | Must | Gap

T-IN-02 | Add an erp_error_code next to erp_last_error on GRN responses (grn_posting.py, grn_views.py) | Backend | US-IN-03 | To do

T-IN-03 | Show a translated ERP failure message per erp_error_code with the raw text as detail in GrnPage.jsx and GrnEditor.jsx | Frontend | US-IN-03 | To do

## ADM — Administration, access and usability

US-ADM-01 | As an Admin, I want role-based sign-in and full user management, including password reset, self-service password change, a failed-login limit and an audit of user changes, so that access is safe and reviewable. | Must | Gap

T-ADM-01 | Add POST /api/auth/change-password, a failed-login throttle on POST /api/auth/login, and user-admin audit rows in routers/users.py with a user_audit_log migration for review | Backend | US-ADM-01 | To do

T-ADM-02 | Add reset-password and edit-name actions on UsersPage.jsx and a change-password form on AccountPage.jsx | Frontend | US-ADM-01 | To do

US-ADM-02 | As a Site Supervisor, I want a live dashboard and a filterable Entry Log that loads in pages, so that I can follow the site and find any vehicle fast as history grows. | Must | Gap

T-ADM-03 | Add limit/offset and a total count to GET /api/entries, checking indexes on vehicle_entries | Backend | US-ADM-02 | To do

T-ADM-04 | Add Load more to the Log cards and table (EntriesPage.jsx, EntryTable.jsx, useEntries.js) | Frontend | US-ADM-02 | To do

US-ADM-03 | As any user, I want mobile cards and tabs, breadcrumbs, an offline notice and every screen and error message in English, Hindi or Marathi, so that I can work on site in the language I read best. | Must | Gap

T-ADM-05 | Map the photo-upload and Internal server error messages in apiErrors.js with keys in strings/common.js | Frontend | US-ADM-03 | To do

T-ADM-06 | Build the GRN weighed-by notice and waiting-time line from single templates in GrnEditor.jsx and GrnPage.jsx | Frontend | US-ADM-03 | To do

T-ADM-07 | Add an app-wide offline banner and disable write actions outside Gate-in | Frontend | US-ADM-03 | To do

## Testing

T-QA-01 | Test all open tasks | QA | US-IN-02, US-IN-03, US-ADM-01, US-ADM-02, US-ADM-03 | To do

## Summary

| Epic | Stories | Gaps | Open tasks |
|---|---|---|---|
| IN | 3 | 2 | 3 |
| ADM | 3 | 3 | 7 |
| Testing | — | — | 1 |
| **Total** | **6** | **5** | **11** |
