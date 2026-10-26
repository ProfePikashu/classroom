# Recovery Resume Checkpoint Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar el progreso persistido y permitir reanudar una recuperación desde el último punto guardado sin otorgar crédito desde el navegador.

**Architecture:** Extender `ayrpc2026-recovery.js` con estado de checkpoint, helpers de almacenamiento local y una acción de reanudación. El cálculo siempre parte de `resume_position_seconds` del servidor; localStorage sólo puede adelantar hasta 10 segundos y se rebobinan 5 segundos antes del seek.

**Tech Stack:** JavaScript vanilla, YouTube IFrame API, localStorage, Node contract tests.

**Spec:** `docs/superpowers/specs/2026-10-25-recovery-resume-checkpoint-design.md`

## Global Constraints
- La barra usa sólo progreso del backend.
- LocalStorage no acredita tiempo ni habilita el cuestionario.
- Sin autoplay; el alumno pulsa `Continuar desde HH:MM:SS`.
- Máximo local: servidor + 10 s; rewind: 5 s; botón sólo desde 10 s.
- Vista docente sin checkpoint local.

## Review Focus
- Recarga con 60% conserva 60% aunque el checkpoint local sea distinto.
- LocalStorage manipulado muy adelante queda acotado a servidor + 10 s.
- Corte antes del próximo heartbeat puede recuperar unos segundos en el mismo dispositivo.
- Cambiar de dispositivo usa sólo el checkpoint del servidor.
- Clase recuperada limpia el checkpoint y no muestra botón.

---

### Task 1: Reanudación segura de reproducción

**Files:**
- Modify: `frontend/js/ayrpc2026-recovery.js`
- Modify: `frontend/clases-ayrpc-2026.html`
- Modify: `tests/ayrpc2026-class1-recovery.test.js`

**Interfaces:**
- Consumes: `resume_position_seconds`, `video_watch_seconds` del backend.
- Produces: botón `Continuar desde HH:MM:SS`, checkpoint local acotado y seek manual.

- [ ] **Step 1: Write failing contract tests**
  Exigir constantes de seguridad, lectura/escritura local, clamp contra servidor, texto del botón, seek manual y actualización de ancla desde heartbeat.
- [ ] **Step 2: Run test to verify RED**
  Run: `node tests/ayrpc2026-class1-recovery.test.js`
  Expected: FAIL por funciones/campos de reanudación ausentes.
- [ ] **Step 3: Implement minimal resume behavior**
  Añadir estado y helpers; persistir posición local durante reproducción; crear botón dinámico; hacer seek sólo al click; limpiar checkpoint al recuperar.
- [ ] **Step 4: Bump asset cache key**
  Actualizar query string de `ayrpc2026-recovery.js` en `clases-ayrpc-2026.html`.
- [ ] **Step 5: Run targeted and full Node tests**
  Run: `node --check frontend/js/ayrpc2026-recovery.js && node tests/ayrpc2026-class1-recovery.test.js`
  Expected: PASS.
  Run: todos los `tests/*.test.js`.
  Expected: PASS sin regresiones.
- [ ] **Step 6: Review, PR, merge and verify GitHub Pages**
  Revisar diff, mergear y comprobar deploy exitoso.