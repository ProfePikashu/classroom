# AyRPC 2026 live panel design

## Intent
The student course page must reflect real AyRPC 2026 attendance data after classes run, without copying or reprocessing Supabase data.

## Goals
- Show each student's exact live attendance duration from `live_presence_seconds`.
- Keep `status` as the source of truth for PRESENTE / REVISAR / AUSENTE / RECUPERADA.
- Mark modules in the course roadmap with a green check when the class has already been held.
- Preserve legacy `time` as a fallback only when live seconds are unavailable.

## Non-goals
- Do not change attendance calculations or database records.
- Do not change recovery or exam eligibility rules.
- Do not alter AyRPC 2025.

## Approach
Use the existing `/api/classroom/me/course-status?course=ayrpc-2026` payload. Keep the raw `attendance` rows in the page model, render time from `live_presence_seconds`, and infer a held class from real attendance activity/status. Class 1 also has an explicit course-start fallback because its occurrence is already known even for an enrollment with no progress row. Later held classes imply earlier modules have also happened because the course is sequential.
