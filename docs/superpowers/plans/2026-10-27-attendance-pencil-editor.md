# Attendance Pencil Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los selects permanentes de edición de asistencia por un lapicito junto al badge que abre un editor compacto sólo cuando se usa.

**Architecture:** Mantener el endpoint y permisos actuales. El frontend renderiza badge + botón de lápiz y un select oculto/absoluto por celda; el click del lápiz abre ese editor sin aumentar la altura de la fila y el cambio sigue usando el mismo PATCH existente.

**Tech Stack:** HTML/CSS/JavaScript vanilla, Font Awesome, Node assert tests.

**Spec:** Solicitud del usuario del 27/10/2026 en esta conversación.

## Global Constraints

- No cambiar backend ni permisos.
- `attendance.edit` sigue siendo requisito para editar.
- Las bajas siguen sin ser editables.
- El editor no debe ocupar espacio permanente debajo del badge.
- El botón visible debe ser un lapicito junto al estado.

## Review Focus

- Sólo un editor abierto a la vez.
- Click fuera del editor lo cierra sin guardar.
- Cambio de estado conserva el PATCH actual.
- Mobile no aumenta la altura de filas por tener permisos de edición.
- Usuarios sin `attendance.edit` no ven el lapicito.

---

### Task 1: Editor contextual por lapicito

**Files:**
- Modify: `tests/attendance-admin-ux.test.js`
- Modify: `frontend/js/asistencias.js`
- Modify: `frontend/css/asistencias-admin.css`

- [ ] Escribir test rojo que exija botón `data-attendance-status-trigger`, ícono `fa-pen`, editor oculto/contextual y ausencia del select permanente.
- [ ] Ejecutar el test y confirmar que falla por el comportamiento viejo.
- [ ] Renderizar badge + lapicito + select contextual oculto.
- [ ] Agregar apertura/cierre y click afuera sin alterar el PATCH actual.
- [ ] Ajustar CSS para popover absoluto desktop/mobile.
- [ ] Ejecutar sintaxis y test focalizado hasta quedar verde.
