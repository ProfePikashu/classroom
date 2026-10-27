# Attendance Pencil Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la apariencia de los selects permanentes de edición de asistencia por un lapicito compacto junto al badge.

**Architecture:** Mantener exactamente el select, permisos, eventos `change` y PATCH actuales. Sólo se cambia su presentación con CSS: el control queda reducido a 24–26 px, sin texto visible, con ícono de lápiz; al tocarlo se abre el desplegable nativo y las opciones siguen siendo legibles.

**Tech Stack:** CSS, JavaScript vanilla existente, Node assert tests.

**Spec:** Solicitud del usuario del 27/10/2026 en esta conversación.

## Global Constraints

- No cambiar backend ni permisos.
- `attendance.edit` sigue siendo requisito para que exista el control.
- Las bajas siguen sin ser editables.
- El editor no ocupa una segunda línea ni todo el ancho de la celda.
- Visualmente debe verse como un lapicito junto al estado.

## Review Focus

- El desplegable nativo sigue mostrando los cinco estados legibles.
- El `change` existente sigue enviando el PATCH actual.
- Mobile no aumenta la altura de las filas.
- Usuarios sin `attendance.edit` siguen viendo sólo el badge.
- El control conserva foco visible para teclado.

---

### Task 1: Select compacto con apariencia de lapicito

**Files:**
- Modify: `tests/attendance-admin-ux.test.js`
- Modify: `frontend/css/asistencias-admin.css`

- [x] Escribir test rojo que exija ancho 24–26 px, ícono de lápiz y opciones legibles.
- [x] Ejecutar el test y confirmar que falla contra el select ancho anterior.
- [x] Compactar el select existente con CSS y mantener su comportamiento nativo.
- [ ] Ejecutar el test focalizado y confirmar verde.
- [ ] Mergear y verificar GitHub Pages.
