from pathlib import Path

path = Path('frontend/js/clases-ayrpc-2026.js')
text = path.read_text(encoding='utf-8')

anchor = '''  function statusClass(status) {
'''
insert = '''  async function loadCourseProgress() {
    const token = getClassroomToken();

    if (!token) return;

    const apiBase =
      typeof EXAMPRO_API_BASE !== "undefined"
        ? EXAMPRO_API_BASE
        : "https://api.andyazhtec.com";

    try {
      const response = await fetch(
        `${apiBase}/api/classroom/me/course-status?course=ayrpc-2026`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) return;

      const data = await response.json();

      if (!Array.isArray(data?.attendance)) return;

      const validStatuses = new Set([
        "PENDIENTE",
        "PRESENTE",
        "REVISAR",
        "AUSENTE",
        "RECUPERADA"
      ]);

      for (const row of data.attendance) {
        const classItem = CLASSES.find(
          item => item.number === Number(row.class_number)
        );

        if (!classItem) continue;

        const rawStatus = String(
          row.status || "PENDIENTE"
        ).trim().toUpperCase();

        const normalizedStatus = validStatuses.has(rawStatus)
          ? rawStatus
          : "PENDIENTE";

        state.statuses[classItem.id] = normalizedStatus;
      }
    }
    catch (error) {
      console.warn(
        "No se pudo cargar el progreso de asistencia:",
        error
      );
    }
  }

'''

if 'async function loadCourseProgress()' not in text:
    if anchor not in text:
        raise SystemExit('No se encontró el punto de inserción de loadCourseProgress')
    text = text.replace(anchor, insert + anchor, 1)

old_init = '''      await loadStaffAccess();
      await loadCanonicalClasses();
      renderClasses();
'''
new_init = '''      await loadStaffAccess();
      await loadCanonicalClasses();
      await loadCourseProgress();
      renderClasses();
'''

if old_init in text:
    text = text.replace(old_init, new_init, 1)
elif new_init not in text:
    raise SystemExit('No se encontró el bloque de init para cargar progreso')

path.write_text(text, encoding='utf-8')
