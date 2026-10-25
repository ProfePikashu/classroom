# Teacher Live Panel Implementation Plan

**Goal:** Mostrar la conexión real Twitch/MKC del docente en `curso-ayrpc-2026.html` sin afectar la vista de alumnos.

**Architecture:** Mantener el controlador académico actual sin cambios para alumnos. Un controlador separado se activa sólo para sesiones docentes, consume la respuesta `teacher_preview` y reutiliza los helpers existentes de tiempo, gráfico y recorrido.

**Tech Stack:** HTML estático, JavaScript vanilla, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-25-teacher-live-panel-design.md`

## Constraints
- No alterar el flujo de alumnos.
- No presentar al docente como alumno.
- Mostrar sólo conexiones reales.
- Mantener tiempos exactos desde `live_presence_seconds`.

## Tasks
1. Crear contrato de regresión para vista docente.
2. Implementar controlador docente separado.
3. Cargarlo con cache busting en la página 2026.
4. Ejecutar sintaxis, regresión y suite Node completa.
