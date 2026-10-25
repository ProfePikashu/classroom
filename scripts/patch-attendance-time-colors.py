from pathlib import Path

path = Path("frontend/js/asistencias.js")
text = path.read_text(encoding="utf-8")


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return source.replace(old, new, 1)


old_normalize = '''  normalizeApiRow(row) {
    const clases = this.clases.map(({ n }) => [
      row[`class_${n}_status`] || "SIN DATOS",
      row[`class_${n}_time`] || "-"
    ]);

    return {
'''

new_normalize = '''  normalizeApiRow(row, course = "ayrpc-2025") {
    const progressByClass = new Map(
      (Array.isArray(row.classes) ? row.classes : []).map(item => [
        Number(item.class_number),
        item
      ])
    );

    const clases = this.clases.map(({ n }) => {
      const progress = progressByClass.get(Number(n)) || {};

      return [
        row[`class_${n}_status`] || progress.status || "SIN DATOS",
        row[`class_${n}_time`] || progress.time || "-",
        progress.live_presence_seconds ?? null,
        progress.live_presence_percent ?? null
      ];
    });

    return {
'''

text = replace_once(text, old_normalize, new_normalize, "normalizeApiRow")

text = replace_once(
    text,
    '      curso: row.course_slug || "ayrpc-2025",\n',
    '      curso: course || row.course_slug || "ayrpc-2025",\n',
    "course source",
)

text = replace_once(
    text,
    '      this.rows = rawRows.map(row => this.normalizeApiRow(row));\n',
    '      this.rows = rawRows.map(row => this.normalizeApiRow(row, curso));\n',
    "normalize call",
)

helper_anchor = '''  async render() {
'''

helpers = '''  formatAttendanceDuration(seconds) {
    if (seconds === null || seconds === undefined || seconds === "") return "";

    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) return "";

    const totalSeconds = Math.floor(value);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secondsPart = totalSeconds % 60;
    const minuteText = hours > 0
      ? String(minutes).padStart(2, "0")
      : String(minutes);
    const secondText = String(secondsPart).padStart(2, "0");

    return hours > 0
      ? `${hours}h ${minuteText}m ${secondText}s`
      : `${minuteText}m ${secondText}s`;
  },

  attendanceTimeTone(percent) {
    if (percent === null || percent === undefined || percent === "") return "";

    const value = Number(percent);
    if (!Number.isFinite(value)) return "";
    if (value >= 75) return "success";
    if (value >= 70) return "warning";
    return "danger";
  },

  renderAttendanceTime(course, legacyTime, seconds, percent) {
    if (course !== "ayrpc-2026") {
      return this.escapeHtml(legacyTime || "-");
    }

    const exactTime = this.formatAttendanceDuration(seconds);
    const displayTime = exactTime || String(legacyTime || "-");
    const tone = exactTime ? this.attendanceTimeTone(percent) : "";
    const color = {
      success: "var(--green)",
      warning: "var(--yellow)",
      danger: "var(--red)"
    }[tone] || "";

    if (!color) return this.escapeHtml(displayTime);

    return `<strong style="color:${color};font-weight:700;">${this.escapeHtml(displayTime)}</strong>`;
  },

'''

text = replace_once(text, helper_anchor, helpers + helper_anchor, "attendance helpers")

old_cells = '''      const classCells = alumno.clases.map(([estado, tiempo]) => `
        <td>${this.badge(estado)}</td>
        <td class="attendance-time">${this.escapeHtml(tiempo)}</td>
      `).join("");
'''

new_cells = '''      const classCells = alumno.clases.map(([estado, tiempo, segundos, porcentaje]) => `
        <td>${this.badge(estado)}</td>
        <td class="attendance-time">${this.renderAttendanceTime(
          alumno.curso,
          tiempo,
          segundos,
          porcentaje
        )}</td>
      `).join("");
'''

text = replace_once(text, old_cells, new_cells, "attendance time cells")

path.write_text(text, encoding="utf-8", newline="\n")
