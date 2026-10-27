# Classroom Native Fullscreen Landscape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace YouTube's internal fullscreen entry point with a Classroom-controlled fullscreen button that can reliably request landscape orientation on compatible mobile browsers.

**Architecture:** Keep YouTube playback inside the existing iframe, but set `fs=0` so its internal fullscreen button is not offered. Add a Classroom button that requests fullscreen on `#videoPlayerBox`, then uses the Screen Orientation API to lock to `landscape`; release the lock on exit. Reuse the existing fullscreen sizing and recovery tracking logic.

**Tech Stack:** Vanilla JavaScript, YouTube IFrame API/player parameters, Fullscreen API, Screen Orientation API, CSS, Node contract tests.

**Spec:** User report on 2026-10-27 that YouTube fullscreen remains portrait on mobile.

## Global Constraints

- Do not change recovery attendance timing or 1x enforcement.
- Preserve captions policy.
- Preserve existing fullscreen responsive sizing.
- Fullscreen orientation lock must fail gracefully on unsupported browsers.
- Keep normal YouTube controls other than its own fullscreen button.

## Approaches

- React to YouTube iframe fullscreen and lock afterward: already implemented, but unreliable on some mobile browsers because the fullscreen request originates inside the cross-origin iframe.
- Classroom-owned fullscreen: selected. The user's click enters fullscreen from the top document, giving the page a reliable opportunity to request landscape.
- CSS-only rotated pseudo-fullscreen: rejected because it does not create true fullscreen and would distort controls/accessibility.

## Tasks

- [ ] Extend player-policy contract tests to require `fs=0`, a Classroom fullscreen button, a top-document `requestFullscreen()` path, landscape lock, and `#videoPlayerBox:fullscreen` sizing.
- [ ] Run the contract tests and confirm they fail before implementation.
- [ ] Add the Classroom fullscreen button and disable YouTube's internal fullscreen control in normal and recovery players.
- [ ] Reuse/extend the existing fullscreen UX to request fullscreen on `#videoPlayerBox`, lock landscape, toggle exit, and gracefully handle unsupported browsers.
- [ ] Add CSS for the custom button and `#videoPlayerBox:fullscreen` layout.
- [ ] Bump cache keys, run syntax + contract tests, merge, and verify GitHub Pages deployment.
