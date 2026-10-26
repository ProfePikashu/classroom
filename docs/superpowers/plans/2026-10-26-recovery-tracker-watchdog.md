# Recovery Tracker Watchdog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restaurar el contador de recuperación al tracker conocido y avisar al alumno cuando el tiempo no está siendo confirmado.

**Architecture:** El loop académico vuelve a quedar aislado de la reanudación. `Continuar desde...` usa sólo el checkpoint confirmado por backend. Un watchdog independiente observa montaje del player y confirmaciones de progreso para mostrar estado listo/activo/error sin acreditar tiempo por sí mismo.

**Tech Stack:** JavaScript vanilla, YouTube IFrame API, GitHub Pages, Node contract tests.

**Spec:** `docs/superpowers/specs/2026-10-26-recovery-tracker-watchdog-design.md`

## Global Constraints
- Backend único dueño del tiempo válido.
- Timeout de montaje: 15 s.
- Alerta por falta de progreso confirmado durante reproducción: 15 s.
- Sin crédito por localStorage, reloj de página o Cast.
- Mantener `Continuar desde...` usando `resume_position_seconds` del servidor.

## Review Focus
- Player no disponible: advertencia visible y botón de reintento.
- Player listo pero sin reproducir: no generar falso positivo.
- Reproducción visible sin confirmación por 15 s: advertir.
- Vuelve a llegar progreso: limpiar advertencia y mostrar validación activa.
- Reanudación no debe alterar `pendingSeconds`, `serverWatchedSeconds` ni el criterio de desbloqueo.

---

### Task 1: Contrato del watchdog y separación de responsabilidades

**Files:**
- Modify: `tests/ayrpc2026-class1-recovery.test.js`
- Modify: `frontend/js/ayrpc2026-recovery.js`
- Modify: `frontend/clases-ayrpc-2026.html`

**Interfaces:**
- Consumes: `resume_position_seconds`, `video_watch_seconds` y respuesta del heartbeat.
- Produces: `#watchValidationStatus`, `#retryWatchValidation`, estado de watchdog y reanudación por servidor.

- [ ] **Step 1: Write failing tests**
  Exigir: reanudación sin lectura/escritura de localStorage; constantes de watchdog a 15 s; estado visible; botón Reintentar; señal activa sólo después de progreso confirmado; el timeout de montaje debe pintar error.

- [ ] **Step 2: Run test to verify RED**
  Run: `node tests/ayrpc2026-class1-recovery.test.js`
  Expected: FAIL por watchdog ausente y dependencia de localStorage todavía presente.

- [ ] **Step 3: Implement minimal behavior**
  Restaurar el loop `startTracking`/heartbeat al flujo pre-checkpoint. Conservar `resume_position_seconds` como único origen para `Continuar desde...`. Añadir watchdog independiente y botón de reintento.

- [ ] **Step 4: Bump asset cache key**
  Cambiar el query string de `ayrpc2026-recovery.js` en `frontend/clases-ayrpc-2026.html`.

- [ ] **Step 5: Verify targeted and full suite**
  Run: `node --check frontend/js/ayrpc2026-recovery.js && node tests/ayrpc2026-class1-recovery.test.js`.
  Luego ejecutar todos los `tests/*.test.js`.

- [ ] **Step 6: PR, merge and verify Pages**
  Revisar diff, mergear y confirmar workflow de pruebas + deploy exitosos.
