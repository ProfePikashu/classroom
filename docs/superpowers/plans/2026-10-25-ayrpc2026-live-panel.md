# AyRPC 2026 Live Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `curso-ayrpc-2026.html` display real live attendance time and visually mark already-held modules.

**Architecture:** Keep the existing course-status endpoint and consume the modern attendance fields already returned by it. The course panel will retain raw attendance rows, derive exact display time from `live_presence_seconds`, and derive held-module progress from attendance activity with a Class 1 date fallback.

**Tech Stack:** Static HTML, vanilla JavaScript, Node source-contract tests, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-25-ayrpc2026-live-panel-design.md`

## Global Constraints
- Do not modify Supabase data or attendance rules.
- Do not alter AyRPC 2025 behavior.
- Prefer `live_presence_seconds` over legacy `time`.
- Keep legacy `time` as fallback.

## Review Focus
- Zero live seconds must remain a real value rather than fall through to legacy text.
- Future classes with PENDIENTE/null activity must not receive a green check.
- A held class with AUSENTE/REVISAR must still count as held in the roadmap.
- Class 1 must show as held after 2026-10-24 even if a student's progress row is absent.
- Exact time formatting must include seconds.

---

### Task 1: Add regression contract

**Files:**
- Create: `tests/ayrpc2026-live-panel.test.js`
- Create temporarily: `.github/workflows/test-ayrpc2026-live-panel.yml`

**Interfaces:**
- Consumes: `frontend/js/curso-ayrpc-2026.js`, `frontend/curso-ayrpc-2026.html`
- Produces: executable regression contract for live time and held-module UI.

- [ ] **Step 1:** Write the failing source-contract test for `live_presence_seconds`, exact formatting, held-class detection, roadmap check rendering, and cache-busted script version.
- [ ] **Step 2:** Run the workflow and verify RED because the production JS still reads only `row.time` and has no roadmap progress renderer.

### Task 2: Implement live panel behavior

**Files:**
- Modify: `frontend/js/curso-ayrpc-2026.js`
- Modify: `frontend/curso-ayrpc-2026.html`

**Interfaces:**
- Consumes: `data.attendance[*].status`, `live_presence_seconds`, `live_presence_percent`.
- Produces: exact time strings, held class numbers, and green roadmap checks.

- [ ] **Step 1:** Preserve raw attendance rows and prefer `live_presence_seconds` when building per-class state.
- [ ] **Step 2:** Add exact duration formatting and use the numeric seconds directly for total/best-class metrics and chart widths.
- [ ] **Step 3:** Add held-class detection and render a green Font Awesome check on roadmap modules already held.
- [ ] **Step 4:** Bump the course JS query-string version in the HTML.
- [ ] **Step 5:** Run the regression workflow and full Node test suite; expect GREEN.

### Task 3: Review and ship

**Files:**
- Remove temporary workflow after verification.

**Interfaces:**
- Produces: clean production diff and deployable `main`.

- [ ] **Step 1:** Compare branch to `main` and review only intended files.
- [ ] **Step 2:** Remove the temporary workflow while retaining the regression test.
- [ ] **Step 3:** Merge to `main` and verify GitHub Pages deployment succeeds.
