# Attendance Admin UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que Asistencias sea usable en mobile, muestre bajas sin tratarlas como asistencia activa, abra AyRPC 2026 por defecto y permita correcciones manuales con `attendance.edit`.

**Architecture:** Reutilizar `/api/classroom/admin/attendance/students`, que ya devuelve `enrollment_id` y `enrollment_status` también para matrículas `withdrawn`. El frontend detecta la baja desde esa fuente canónica, la mantiene visible en la vista general y la excluye de KPIs/filtros académicos activos. Un router backend pequeño agrega solamente la mutación manual de progreso, protegida por `attendance.edit`. El layout mobile vive en un CSS específico de Asistencias.

**Tech Stack:** FastAPI, SQLAlchemy text queries, PostgreSQL/Supabase, HTML/CSS/JavaScript vanilla, Node assert tests, pytest.

## Global Constraints

- Las bajas siguen visibles en la planilla y conservan su historial por clase.
- Una fila de baja muestra badge `BAJA` y queda anulada visualmente con doble tachado.
- Las bajas no cuentan en KPIs académicos activos.
- AyRPC 2026 es la cursada inicial.
- Mobile conserva la columna alumno sticky, compactada a ~128 px, sin avatar y con nombre en hasta dos líneas.
- La edición manual usa exclusivamente `attendance.edit`; `attendance.view` sólo permite lectura.
- Backend rechaza mutaciones sobre matrículas `withdrawn` aunque se manipule el frontend.
- Estados manuales válidos: `PENDIENTE`, `PRESENTE`, `AUSENTE`, `REVISAR`, `RECUPERADA`.
- Un cambio manual a `RECUPERADA` pasa por UPDATE para conservar el trigger de campanita existente.

---

### Task 1: Backend de edición manual

**Files:**
- Create: `app/routers/classroom_attendance_admin.py`
- Modify: `app/routers/__init__.py`
- Test: `tests/test_classroom_attendance_admin.py`

- [x] Escribir tests rojos para estados permitidos y ruta protegida.
- [x] Implementar `PATCH /api/classroom/admin/attendance/progress` con `attendance.edit`.
- [x] Rechazar matrícula `withdrawn`.
- [x] Hacer upsert seguro: crear PENDIENTE si falta y luego UPDATE al estado pedido.
- [x] Recalcular la matrícula 2026 usando sus reglas canónicas; 2025 no inventa reglas inexistentes.
- [x] Registrar auditoría del cambio manual.
- [x] Montar el router dentro de `/api/classroom`.
- [x] Sintaxis y tests focalizados verdes.

### Task 2: Frontend de Asistencias

**Files:**
- Modify: `frontend/asistencias.html`
- Modify: `frontend/js/asistencias.js`
- Create: `frontend/css/asistencias-admin.css`
- Test: `tests/attendance-admin-ux.test.js`

- [x] Escribir contrato rojo para 2026 por defecto, BAJA, mobile y edición por permiso.
- [x] Cambiar selector/default JS a `ayrpc-2026`.
- [x] Detectar `withdrawn` desde `enrollment_status` canónico.
- [x] Renderizar badge BAJA, doble tachado y bloquear edición en bajas.
- [x] Excluir bajas de KPIs y filtros académicos específicos.
- [x] Agregar selector manual por clase sólo con `attendance.edit`.
- [x] Eliminar la request separada de summary y calcular KPIs desde las mismas filas activas.
- [x] Agregar CSS mobile dedicado: sticky ~128 px, avatar oculto, nombre truncado y columnas académicas más visibles.
- [x] Sintaxis + tests de contrato verdes.

### Task 3: Integración y despliegue

- [x] Abrir PR backend y frontend.
- [x] Verificar CI verde en ambas ramas.
- [ ] Merge backend primero y confirmar Render live.
- [ ] Merge frontend después y confirmar GitHub Pages.
- [ ] Smoke final en producción.