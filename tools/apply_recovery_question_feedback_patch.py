from pathlib import Path

js_path = Path("frontend/js/ayrpc2026-recovery.js")
source = js_path.read_text(encoding="utf-8")
changed = False

feedback_anchor = '''  function feedbackMarkup(message, kind) {
    return `<div class="ayrpc2026-recovery-feedback ${kind}">${escapeHtml(message)}</div>`;
  }

  function renderQuiz() {
'''
feedback_replacement = '''  function feedbackMarkup(message, kind) {
    return `<div class="ayrpc2026-recovery-feedback ${kind}">${escapeHtml(message)}</div>`;
  }

  function clearQuestionResult(textarea) {
    if (!textarea) return;
    const wrapper = textarea.closest(".ayrpc2026-recovery-question");
    if (!wrapper) return;

    wrapper.classList.remove("is-valid", "is-invalid");
    textarea.classList.remove("is-valid", "is-invalid");

    const status = wrapper.querySelector(".ayrpc2026-recovery-question-status");
    if (status) {
      status.textContent = "";
      status.classList.remove("is-valid", "is-invalid");
    }
  }

  function paintQuestionResults(results = {}) {
    const form = $("ayrpc2026RecoveryForm");
    if (!form) return;

    for (const question of state.config?.questions || []) {
      const textarea = form.elements.namedItem(question.id);
      if (!textarea || textarea.tagName !== "TEXTAREA") continue;

      clearQuestionResult(textarea);
      const wrapper = textarea.closest(".ayrpc2026-recovery-question");
      if (!wrapper) continue;

      let status = wrapper.querySelector(".ayrpc2026-recovery-question-status");
      if (!status) {
        status = document.createElement("small");
        status.className = "ayrpc2026-recovery-question-status";
        textarea.insertAdjacentElement("afterend", status);
      }

      const result = results?.[question.id];
      if (result === true) {
        wrapper.classList.add("is-valid");
        textarea.classList.add("is-valid");
        status.classList.add("is-valid");
        status.textContent = "Respuesta válida.";
      } else if (result === false) {
        wrapper.classList.add("is-invalid");
        textarea.classList.add("is-invalid");
        status.classList.add("is-invalid");
        status.textContent = "Respuesta inválida o insuficiente. Revisala e intentá nuevamente.";
      }
    }
  }

  function renderQuiz() {
'''
if feedback_anchor in source:
    source = source.replace(feedback_anchor, feedback_replacement, 1)
    changed = True

listener_anchor = '''    if (!preview) {
      $("ayrpc2026RecoveryForm")?.addEventListener("submit", submitRecovery);
    }

    box.scrollIntoView({ behavior: "smooth", block: "start" });
'''
listener_replacement = '''    if (!preview) {
      const form = $("ayrpc2026RecoveryForm");
      form?.addEventListener("submit", submitRecovery);
      form?.querySelectorAll("textarea").forEach(textarea => {
        textarea.addEventListener("input", () => clearQuestionResult(textarea));
      });
    }

    box.scrollIntoView({ behavior: "smooth", block: "start" });
'''
if listener_anchor in source:
    source = source.replace(listener_anchor, listener_replacement, 1)
    changed = True

response_anchor = '''      if (!response.ok) {
        throw new Error(data?.detail || "No se pudo registrar la recuperación.");
      }

      if (data?.passed && data?.status === "RECUPERADA") {
'''
response_replacement = '''      if (!response.ok) {
        throw new Error(data?.detail || "No se pudo registrar la recuperación.");
      }

      paintQuestionResults(data?.question_results || {});

      if (data?.passed && data?.status === "RECUPERADA") {
'''
if response_anchor in source:
    source = source.replace(response_anchor, response_replacement, 1)
    changed = True

css_anchor = '''      .ayrpc2026-recovery-question textarea:disabled { opacity:.7; cursor:not-allowed; }
      .ayrpc2026-recovery-feedback { padding:11px 13px; border-radius:10px; line-height:1.45; }
'''
css_replacement = '''      .ayrpc2026-recovery-question textarea:disabled { opacity:.7; cursor:not-allowed; }
      .ayrpc2026-recovery-question-status { min-height:1.2em; font-size:.84rem; font-weight:800; line-height:1.3; }
      .ayrpc2026-recovery-question.is-valid > span, .ayrpc2026-recovery-question-status.is-valid { color:rgb(50,220,140); }
      .ayrpc2026-recovery-question textarea.is-valid { border-color:rgba(50,220,140,.85); background:rgba(50,220,140,.08); box-shadow:0 0 0 3px rgba(50,220,140,.08); }
      .ayrpc2026-recovery-question.is-invalid > span, .ayrpc2026-recovery-question-status.is-invalid { color:rgb(255,80,110); }
      .ayrpc2026-recovery-question textarea.is-invalid { border-color:rgba(255,80,110,.9); background:rgba(255,80,110,.08); box-shadow:0 0 0 3px rgba(255,80,110,.08); }
      .ayrpc2026-recovery-feedback { padding:11px 13px; border-radius:10px; line-height:1.45; }
'''
if css_anchor in source:
    source = source.replace(css_anchor, css_replacement, 1)
    changed = True

if changed:
    js_path.write_text(source, encoding="utf-8")

html_path = Path("frontend/clases-ayrpc-2026.html")
html = html_path.read_text(encoding="utf-8")
old_version = "js/ayrpc2026-recovery.js?v=20261026-tracker-restored-v1"
new_version = "js/ayrpc2026-recovery.js?v=20261027-question-feedback-v1"
if old_version in html:
    html_path.write_text(html.replace(old_version, new_version, 1), encoding="utf-8")
    changed = True

test_path = Path("tests/ayrpc2026-class1-recovery.test.js")
test = test_path.read_text(encoding="utf-8")
old_test_version = r'js\\/ayrpc2026-recovery\\.js\\?v=20261026-tracker-restored-v1'
new_test_version = r'js\\/ayrpc2026-recovery\\.js\\?v=20261027-question-feedback-v1'
if old_test_version in test:
    test_path.write_text(test.replace(old_test_version, new_test_version, 1), encoding="utf-8")
    changed = True

print("patched" if changed else "no changes needed")
