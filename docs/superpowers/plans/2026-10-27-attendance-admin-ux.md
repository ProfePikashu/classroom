# Attendance Admin UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que Asistencias sea usable en mobile, muestre bajas sin tratarlas como asistencia activa, abra AyRPC 2026 por defecto y permita correcciones manuales con `attendance.edit`.

**Architecture:** Mantener el endpoint histórico de planilla activa intacto y sumar un router backend pequeño para alumnos dados de baja y edición manual. El frontend fusiona activos + bajas, renderiza bajas como filas anuladas y sólo habilita controles de edición a usuarios con `attendance.edit`. El layout mobile se resuelve con un CSS específico de Asistencias, sin seguir creciendo `styles.css`.

**Tech Stack:** FastAPI, SQLAlchemy text queries, PostgreSQL/Supabase, HTML/CSS/JavaScript vanilla, Node assert tests, pytest.

**Spec:** Solicitud del usuario del 27/10/2026 en esta conversación.

## Global Constraints

- Las bajas siguen visibles en la planilla, pero no se vuelven a contabilizar como alumnos activos en KPIs.
- Una fila de baja muestra badge `BAJA` y queda anulada visualmente con doble tachado.
- AyRPC 2026 es la cursada inicial.
- Mobile conserva la columna alumno sticky, pero compacta a ~128 px, sin avatar y con texto truncable para dejar visibles las columnas académicas.
- La edición manual usa exclusivamente `attendance.edit`; `attendance.view` sólo permite lectura.
- No permitir edición manual sobre matrículas `withdrawn`.
- Estados manuales válidos: `PENDIENTE`, `PRESENTE`, `AUSENTE`, `REVISAR`, `RECUPERADA`.

## Review Focus

- Moderador con `attendance.view` pero sin `attendance.edit` no debe ver controles mutantes.
- Alumno dado de baja debe seguir visible con sus clases históricas, sin poder editarse.
- Cambio manual a `RECUPERADA` debe conservar el trigger existente de campanita.
- Filtros específicos no deben mezclar filas de baja salvo en vista general/búsqueda.
- Mobile no debe perder acceso horizontal a Clase 1 por una columna alumno sobredimensionada.

---

### Task 1: Backend admin de bajas y edición

**Files:**
- Create: `app/routers/classroom_attendance_admin.py`
- Modify: `app/main.py`
- Test: `tests/test_classroom_attendance_admin.py`

- [ ] Escribir tests rojos para agrupado de bajas, estados permitidos y registro de rutas protegidas por permisos.
- [ ] Ejecutar pytest y confirmar fallo por módulo/rutas inexistentes.
- [ ] Implementar `GET /api/classroom/admin/attendance/withdrawn` con `attendance.view`.
- [ ] Implementar `PATCH /api/classroom/admin/attendance/progress` con `attendance.edit`, rechazo de matrícula withdrawn y upsert de progreso.
- [ ] Recalcular `valid_classes` y `exam_eligible` de la matrícula después de una edición.
- [ ] Registrar router en `app/main.py`.
- [ ] Ejecutar test focalizado y suite relevante.

### Task 2: Frontend de Asistencias

**Files:**
- Modify: `frontend/asistencias.html`
- Modify: `frontend/js/asistencias.js`
- Create: `frontend/css/asistencias-admin.css`
- Test: `tests/attendance-admin-ux.test.js`

- [ ] Escribir test rojo para 2026 por defecto, fetch de bajas, badge BAJA, fila anulada, CSS mobile y edición condicionada por `attendance.edit`.
- [ ] Ejecutar test y confirmar fallo por funcionalidades ausentes.
- [ ] Cambiar selector/default JS a `ayrpc-2026`.
- [ ] Fusionar activos + bajas y marcar `withdrawn` en el modelo normalizado.
- [ ] Renderizar badge BAJA, doble tachado y deshabilitar edición para bajas.
- [ ] Agregar control de estado por clase sólo a usuarios con `attendance.edit`, con PATCH y refresh posterior.
- [ ] Agregar CSS mobile dedicado con sticky de ~128 px, avatar oculto y datos secundarios compactos.
- [ ] Ejecutar sintaxis + test focalizado + regresiones existentes de asistencia.

### Task 3: Integración y despliegue

- [ ] Abrir PR backend y frontend.
- [ ] Verificar CI verde en ambos.
- [ ] Merge backend primero y confirmar Render live.
- [ ] Merge frontend después y confirmar GitHub Pages.
- [ ] Smoke final: 2026 abre primero, baja visible/tachada, mobile permite ver estados y edición manual funciona sólo con permiso.