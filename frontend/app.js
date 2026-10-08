(() => {
  "use strict";

  const API_BASE = String(window.TUITION_API_URL || "").replace(/\/+$/, "");
  const state = { view: "dashboard", records: { classes: [], teachers: [], students: [] }, filter: "", classFilter: "", loading: false };
  const content = document.getElementById("app-content");
  const notice = document.getElementById("notice-region");
  const dialog = document.getElementById("record-dialog");
  const form = document.getElementById("record-form");
  const fields = document.getElementById("form-fields");
  let editing = null;
  let toastTimer;

  const entities = {
    classes: {
      title: "Classes", singular: "Class", endpoint: "/api/classes", newLabel: "New class",
      fields: [
        { name: "class_code", label: "Class code", required: true, placeholder: "e.g. primary1" },
        { name: "class_name", label: "Class name", required: true, placeholder: "e.g. Primary 1" },
        { name: "subjects", label: "Subjects", required: true, placeholder: "English, Mathematics", wide: true },
        { name: "schedule_days", label: "Schedule days", placeholder: "Mon / Wed" },
        { name: "schedule_time", label: "Schedule time", placeholder: "16:00-17:30" },
        { name: "room", label: "Room", placeholder: "Room A" },
        { name: "teacher_id", label: "Assigned teacher", type: "select", optionEntity: "teachers", optionValue: "teacher_id", optionLabel: "full_name", optionalLabel: "Unassigned" },
        { name: "status", label: "Status", type: "select", options: ["Active", "Inactive"], required: true }
      ]
    },
    teachers: {
      title: "Teachers", singular: "Teacher", endpoint: "/api/teachers", newLabel: "New teacher",
      fields: [
        { name: "teacher_code", label: "Teacher code", required: true, placeholder: "e.g. teacher07" },
        { name: "full_name", label: "Full name", required: true, placeholder: "Teacher name" },
        { name: "email", label: "Email", type: "email", required: true, placeholder: "name@example.com" },
        { name: "phone", label: "Phone", placeholder: "+65 9000 0000" },
        { name: "subject_specialty", label: "Subject specialty", required: true, placeholder: "Mathematics" },
        { name: "class_id", label: "Assigned class", type: "select", optionEntity: "classes", optionValue: "class_id", optionLabel: "class_name", optionalLabel: "Unassigned" },
        { name: "join_date", label: "Join date", type: "date" },
        { name: "status", label: "Status", type: "select", options: ["Active", "On Leave", "Inactive"], required: true }
      ]
    },
    students: {
      title: "Students", singular: "Student", endpoint: "/api/students", newLabel: "New student",
      fields: [
        { name: "full_name", label: "Full name", required: true, placeholder: "Student name" },
        { name: "class_id", label: "Class", type: "select", optionEntity: "classes", optionValue: "class_id", optionLabel: "class_name", required: true },
        { name: "student_code", label: "Student code", required: true, placeholder: "Choose a class to suggest a code", wide: true, hint: "Suggested from the chosen class. You can change it if needed." },
        { name: "gender", label: "Gender", type: "select", options: ["M", "F", "Other"], required: true },
        { name: "age", label: "Age", type: "number", required: true, min: "3", max: "20" },
        { name: "guardian_name", label: "Guardian name", required: true, placeholder: "Guardian name" },
        { name: "guardian_phone", label: "Guardian phone", required: true, placeholder: "+65 8000 0000" },
        { name: "guardian_email", label: "Guardian email", type: "email", placeholder: "guardian@example.com", optional: true },
        { name: "enrolment_date", label: "Enrolment date", type: "date", required: true },
        { name: "status", label: "Status", type: "select", options: ["Active", "Withdrawn"], required: true }
      ]
    }
  };

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const initials = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
  const formatStatus = (value) => {
    const status = String(value || "Active");
    const cls = status === "Inactive" ? "is-inactive" : status === "Withdrawn" ? "is-withdrawn" : status === "On Leave" ? "is-on-leave" : "";
    return `<span class="status-pill ${cls}">${escapeHtml(status)}</span>`;
  };
  const display = (value) => value ? escapeHtml(value) : "—";
  const classNameFor = (id) => state.records.classes.find((item) => item.class_id === id)?.class_name || "Unassigned";
  const teacherNameFor = (id) => state.records.teachers.find((item) => item.teacher_id === id)?.full_name || "Unassigned";

  async function request(path, options = {}) {
    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) }
      });
    } catch (error) {
      throw new Error("Could not reach the API. Check your connection or try again after the service wakes up.");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  }

  async function loadAll() {
    state.loading = true;
    setConnection("Connecting to school data", false);
    showLoading();
    try {
      const [classes, teachers, students] = await Promise.all([
        request("/api/classes"), request("/api/teachers"), request("/api/students")
      ]);
      state.records = { classes, teachers, students };
      notice.innerHTML = "";
      setConnection("School data connected", false);
      render();
    } catch (error) {
      setConnection("Connection unavailable", true);
      content.innerHTML = `<section class="panel empty-state"><strong>We couldn't load your school data</strong><p>${escapeHtml(error.message)}</p><button class="button button-primary" data-action="retry">Try again</button></section>`;
      notice.innerHTML = "";
    } finally {
      state.loading = false;
    }
  }

  function setConnection(text, failed) {
    const label = document.getElementById("connection-label");
    label.textContent = text;
    label.previousElementSibling.classList.toggle("is-error", failed);
  }

  function showLoading() {
    content.innerHTML = '<div class="loading-block"><span class="spinner"></span><span>Waking up your school workspace…</span></div>';
  }

  function render() {
    document.getElementById("breadcrumb-current").textContent = state.view === "dashboard" ? "Overview" : entities[state.view].title;
    document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("is-active", item.dataset.view === state.view));
    if (state.view === "dashboard") renderDashboard();
    else renderList(state.view);
  }

  function renderDashboard() {
    const activeStudents = state.records.students.filter((student) => student.status === "Active").length;
    const todayLabel = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase();
    const classRows = state.records.classes.slice(0, 5).map((item) => {
      const count = state.records.students.filter((student) => student.class_id === item.class_id).length;
      return `<div class="class-preview"><span class="class-initial">${escapeHtml(item.class_name.replace(/\D/g, "") || "CL")}</span><div class="class-preview-info"><strong>${escapeHtml(item.class_name)}</strong><span>${escapeHtml(item.class_code)} · ${escapeHtml(item.schedule_days || "Schedule pending")}</span></div><span class="student-count">${count} students</span></div>`;
    }).join("");
    content.innerHTML = `
      <div class="page-heading"><div><span class="heading-kicker">${escapeHtml(todayLabel)}</span><h1>Good morning<span class="sun-accent">,</span> Sunrise <span aria-hidden="true">☀</span></h1><p>Here's what's happening at your learning centre.</p></div><button class="button button-primary" data-action="add-student"><span>＋</span> Add a student</button></div>
      <section class="stat-grid" aria-label="School totals">
        ${statCard("Classes", state.records.classes.length, "▦", "Learning groups")}
        ${statCard("Teachers", state.records.teachers.length, "♙", "Guiding every step")}
        ${statCard("Students", state.records.students.length, "♧", `${activeStudents} active learners`)}
      </section>
      <section class="dashboard-grid">
        <div class="panel"><div class="panel-head"><div><h2>Your classes</h2><p>A quick look at your learning groups</p></div><button class="text-link" data-view="classes">View all →</button></div><div class="class-list">${classRows || '<div class="empty-state">No classes have been added yet.</div>'}</div></div>
        <aside class="welcome-panel"><span class="eyebrow">A NOTE FOR TODAY</span><h2>Every learner has a bright future.</h2><p>Keep creating a place where curiosity can grow and every small win matters.</p><div class="welcome-rule"></div><span class="welcome-foot">Growing minds, one lesson at a time.</span></aside>
      </section>`;
  }

  function statCard(title, value, icon, caption) {
    return `<article class="stat-card"><div class="stat-top"><span>${title}</span><span class="stat-icon" aria-hidden="true">${icon}</span></div><div class="stat-value">${value}<span class="stat-caption">${caption}</span></div></article>`;
  }

  function renderList(entityKey) {
    const entity = entities[entityKey];
    const source = state.records[entityKey];
    let records = source.filter((item) => {
      const needle = state.filter.trim().toLowerCase();
      const matchesText = !needle || Object.values(item).some((value) => String(value ?? "").toLowerCase().includes(needle));
      const matchesClass = entityKey !== "students" || !state.classFilter || item.class_id === state.classFilter;
      return matchesText && matchesClass;
    });
    const fieldsForTable = {
      classes: [
        ["Class", (item) => `<div class="person-cell"><span class="person-avatar">${escapeHtml(item.class_name.replace(/\D/g, "") || "CL")}</span><div class="person-info"><strong>${escapeHtml(item.class_name)}</strong><span>${escapeHtml(item.class_code)}</span></div></div>`],
        ["Subjects", (item) => display(item.subjects)], ["Schedule", (item) => `${display(item.schedule_days)}${item.schedule_time ? ` · ${escapeHtml(item.schedule_time)}` : ""}`],
        ["Teacher", (item) => display(teacherNameFor(item.teacher_id))], ["Enrolment", (item) => `${state.records.students.filter((student) => student.class_id === item.class_id).length} students`], ["Status", (item) => formatStatus(item.status)]
      ],
      teachers: [
        ["Teacher", (item) => `<div class="person-cell"><span class="person-avatar">${initials(item.full_name)}</span><div class="person-info"><strong>${escapeHtml(item.full_name)}</strong><span>${escapeHtml(item.teacher_code)}</span></div></div>`],
        ["Specialty", (item) => display(item.subject_specialty)], ["Email", (item) => display(item.email)], ["Phone", (item) => display(item.phone)], ["Class", (item) => display(classNameFor(item.class_id))], ["Status", (item) => formatStatus(item.status)]
      ],
      students: [
        ["Student", (item) => `<div class="person-cell"><span class="person-avatar">${initials(item.full_name)}</span><div class="person-info"><strong>${escapeHtml(item.full_name)}</strong><span>${escapeHtml(item.student_code)}</span></div></div>`],
        ["Class", (item) => display(classNameFor(item.class_id))], ["Age", (item) => display(item.age)], ["Guardian", (item) => display(item.guardian_name)], ["Phone", (item) => display(item.guardian_phone)], ["Status", (item) => formatStatus(item.status)]
      ]
    }[entityKey];
    const searchPrompt = entityKey === "classes" ? "Search class name or code…" : entityKey === "teachers" ? "Search teacher name or code…" : "Search student name or code…";
    const classFilter = entityKey === "students" ? `<select class="filter-select" id="class-filter" aria-label="Filter students by class"><option value="">All classes</option>${state.records.classes.map((item) => `<option value="${escapeHtml(item.class_id)}" ${state.classFilter === item.class_id ? "selected" : ""}>${escapeHtml(item.class_name)}</option>`).join("")}</select>` : "";
    const head = fieldsForTable.map(([label]) => `<th scope="col">${label}</th>`).join("");
    const tableRows = records.length ? records.map((item) => `<tr>${fieldsForTable.map(([, cell]) => `<td>${cell(item)}</td>`).join("")}<td><div class="row-actions">${entityKey === "classes" ? `<button class="icon-button" data-action="details" data-id="${escapeHtml(item.class_id)}" title="View class" aria-label="View ${escapeHtml(item.class_name)}">↗</button>` : ""}<button class="icon-button" data-action="edit" data-entity="${entityKey}" data-id="${escapeHtml(idOf(entityKey, item))}" title="Edit record" aria-label="Edit record">✎</button><button class="icon-button delete" data-action="delete" data-entity="${entityKey}" data-id="${escapeHtml(idOf(entityKey, item))}" title="Delete record" aria-label="Delete record">⌫</button></div></td></tr>`).join("") : `<tr><td colspan="${fieldsForTable.length + 1}">${emptyContent(state.filter || state.classFilter)}</td></tr>`;
    const cards = records.length ? records.map((item) => {
      const person = fieldsForTable[0][1](item);
      const details = fieldsForTable.slice(1).map(([label, cell]) => `<div class="card-detail"><span>${label}</span><strong>${cell(item)}</strong></div>`).join("");
      return `<article class="record-card"><div class="record-card-top">${person}<div class="row-actions">${entityKey === "classes" ? `<button class="icon-button" data-action="details" data-id="${escapeHtml(item.class_id)}" aria-label="View class">↗</button>` : ""}<button class="icon-button" data-action="edit" data-entity="${entityKey}" data-id="${escapeHtml(idOf(entityKey, item))}" aria-label="Edit record">✎</button><button class="icon-button delete" data-action="delete" data-entity="${entityKey}" data-id="${escapeHtml(idOf(entityKey, item))}" aria-label="Delete record">⌫</button></div></div><div class="record-card-details">${details}</div></article>`;
    }).join("") : `<div class="panel empty-state">${emptyContent(state.filter || state.classFilter)}</div>`;
    content.innerHTML = `
      <div class="page-heading"><div><span class="heading-kicker">SCHOOL DIRECTORY</span><h1>${entity.title}</h1><p>Keep your ${entityKey} organised, connected, and up to date.</p></div><button class="button button-primary" data-action="add" data-entity="${entityKey}"><span>＋</span> ${entity.newLabel}</button></div>
      <div class="toolbar"><label class="search-wrap"><span class="search-icon" aria-hidden="true">⌕</span><input class="search-input" id="search-input" type="search" placeholder="${searchPrompt}" value="${escapeHtml(state.filter)}" aria-label="${searchPrompt}"></label>${classFilter}</div>
      <p class="record-count">${records.length} ${records.length === 1 ? entity.singular.toLowerCase() : entityKey} shown</p>
      <div class="panel table-panel"><table class="data-table"><thead><tr>${head}<th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${tableRows}</tbody></table></div>
      <div class="record-cards">${cards}</div>`;
  }

  function emptyContent(filtered) {
    const entity = entities[state.view];
    if (filtered) return `<strong>No matching ${entity.title.toLowerCase()}</strong><p>Try another search or filter.</p>`;
    return `<strong>No ${entity.title.toLowerCase()} yet</strong><p>Add your first record to get started.</p>`;
  }

  function idOf(entityKey, item) {
    return item[{ classes: "class_id", teachers: "teacher_id", students: "student_id" }[entityKey]];
  }

  function openForm(entityKey, record = null) {
    editing = record ? { entityKey, id: idOf(entityKey, record) } : { entityKey, id: null };
    const entity = entities[entityKey];
    document.getElementById("dialog-eyebrow").textContent = `${record ? "EDIT" : "ADD"} ${entity.singular.toUpperCase()}`;
    document.getElementById("dialog-title").textContent = `${record ? "Edit" : "Add"} ${entity.singular.toLowerCase()}`;
    document.getElementById("save-button").textContent = record ? "Save changes" : `Create ${entity.singular.toLowerCase()}`;
    fields.innerHTML = entity.fields.map((field) => renderField(field, record?.[field.name] ?? "")).join("");
    dialog.showModal();
    const classInput = form.elements.namedItem("class_id");
    if (entityKey === "students" && classInput) {
      classInput.addEventListener("change", () => suggestStudentCode(classInput.value, record));
      if (!record && classInput.value) suggestStudentCode(classInput.value, null);
    }
  }

  function renderField(field, value) {
    const required = field.required ? "required" : "";
    const optional = field.optional || !field.required ? '<span class="optional"> · optional</span>' : "";
    let control;
    if (field.type === "select") {
      const options = field.optionEntity
        ? state.records[field.optionEntity].map((item) => `<option value="${escapeHtml(item[field.optionValue])}" ${String(value) === String(item[field.optionValue]) ? "selected" : ""}>${escapeHtml(item[field.optionLabel])}</option>`).join("")
        : field.options.map((item) => `<option value="${escapeHtml(item)}" ${value === item ? "selected" : ""}>${escapeHtml(item)}</option>`).join("");
      control = `<select class="form-control" name="${field.name}" ${required}><option value="">${escapeHtml(field.optionalLabel || "Choose an option")}</option>${options}</select>`;
    } else {
      const readOnly = field.readonly ? "readonly" : "";
      const min = field.min ? `min="${field.min}"` : "";
      const max = field.max ? `max="${field.max}"` : "";
      control = `<input class="form-control" name="${field.name}" type="${field.type || "text"}" value="${escapeHtml(value)}" placeholder="${escapeHtml(field.placeholder || "")}" ${required} ${readOnly} ${min} ${max}>`;
    }
    return `<div class="field ${field.wide ? "is-wide" : ""}"><label for="field-${field.name}">${field.label}${optional}</label>${control.replace(`name="${field.name}"`, `id="field-${field.name}" name="${field.name}"`)}${field.hint ? `<span class="form-hint">${escapeHtml(field.hint)}</span>` : ""}</div>`;
  }

  async function suggestStudentCode(classId, record) {
    const input = form.elements.namedItem("student_code");
    if (!input || !classId) { if (input && !record) input.value = ""; return; }
    if (record && record.class_id === classId) return;
    input.value = "Suggesting…";
    input.readOnly = true;
    try {
      const result = await request(`/api/students/next-code?class_id=${encodeURIComponent(classId)}`);
      if (form.elements.namedItem("class_id")?.value === classId) input.value = result.student_code;
    } catch (error) {
      input.value = "";
      showToast(error.message, true);
    }
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
    editing = null;
  }

  async function saveRecord(event) {
    event.preventDefault();
    if (!editing) return;
    const { entityKey, id } = editing;
    const entity = entities[entityKey];
    const data = Object.fromEntries(new FormData(form).entries());
    for (const key of Object.keys(data)) if (data[key] === "") data[key] = null;
    if (entityKey === "students" && !data.student_code) {
      const suggested = await request(`/api/students/next-code?class_id=${encodeURIComponent(data.class_id)}`);
      data.student_code = suggested.student_code;
    }
    const button = document.getElementById("save-button");
    button.disabled = true;
    button.textContent = "Saving…";
    try {
      await request(id ? `${entity.endpoint}/${encodeURIComponent(id)}` : entity.endpoint, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(data)
      });
      closeDialog();
      showToast(`${entity.singular} ${id ? "updated" : "created"} successfully.`);
      await loadAll();
    } catch (error) {
      showToast(error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = id ? "Save changes" : `Create ${entity.singular.toLowerCase()}`;
    }
  }

  async function deleteRecord(entityKey, id) {
    const entity = entities[entityKey];
    const record = state.records[entityKey].find((item) => idOf(entityKey, item) === id);
    const name = record?.full_name || record?.class_name || record?.[`${entityKey.slice(0, -1)}_code`] || "this record";
    if (!window.confirm(`Delete ${name}? This action cannot be undone.`)) return;
    try {
      await request(`${entity.endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
      showToast(`${entity.singular} deleted.`);
      await loadAll();
    } catch (error) {
      showToast(error.message, true);
    }
  }

  async function showClassDetails(id) {
    const classRecord = state.records.classes.find((item) => item.class_id === id);
    if (!classRecord) return;
    const students = state.records.students.filter((student) => student.class_id === id);
    document.getElementById("detail-title").textContent = classRecord.class_name;
    document.getElementById("detail-content").innerHTML = `
      <div class="detail-block"><div class="detail-facts">
        ${detailFact("Class code", classRecord.class_code)}${detailFact("Teacher", teacherNameFor(classRecord.teacher_id))}
        ${detailFact("Schedule", [classRecord.schedule_days, classRecord.schedule_time].filter(Boolean).join(" · ") || "Not set")}${detailFact("Room", classRecord.room || "Not set")}
        ${detailFact("Subjects", classRecord.subjects || "Not set")}${detailFact("Status", classRecord.status)}
      </div><h3>Students (${students.length})</h3>
      <div class="detail-students">${students.length ? students.map((student) => `<div class="detail-student"><span class="person-avatar">${initials(student.full_name)}</span><div><strong>${escapeHtml(student.full_name)}</strong><span>${escapeHtml(student.student_code)} · Age ${escapeHtml(student.age)}</span></div></div>`).join("") : '<p class="form-hint">No students are enrolled in this class yet.</p>'}</div></div>`;
    document.getElementById("detail-dialog").showModal();
  }

  function detailFact(label, value) {
    return `<div class="detail-fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function showToast(message, error = false) {
    const region = document.getElementById("toast-region");
    region.innerHTML = `<div class="toast ${error ? "error" : ""}" role="status">${escapeHtml(message)}</div>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { region.innerHTML = ""; }, 4200);
  }

  document.addEventListener("click", (event) => {
    const view = event.target.closest("[data-view]");
    if (view) {
      event.preventDefault();
      state.view = view.dataset.view;
      state.filter = "";
      state.classFilter = "";
      render();
      return;
    }
    const action = event.target.closest("[data-action]");
    if (action) {
      const entityKey = action.dataset.entity;
      if (action.dataset.action === "retry") loadAll();
      if (action.dataset.action === "add") openForm(entityKey);
      if (action.dataset.action === "add-student") { state.view = "students"; render(); openForm("students"); }
      if (action.dataset.action === "edit") {
        const record = state.records[entityKey].find((item) => idOf(entityKey, item) === action.dataset.id);
        if (record) openForm(entityKey, record);
      }
      if (action.dataset.action === "delete") deleteRecord(entityKey, action.dataset.id);
      if (action.dataset.action === "details") showClassDetails(action.dataset.id);
      return;
    }
    if (event.target.closest("[data-close-dialog]")) closeDialog();
    if (event.target.closest("[data-close-detail]")) document.getElementById("detail-dialog").close();
  });

  content.addEventListener("input", (event) => {
    if (event.target.id === "search-input") {
      state.filter = event.target.value;
      const start = event.target.selectionStart;
      renderList(state.view);
      const input = document.getElementById("search-input");
      input.focus();
      input.setSelectionRange(start, start);
    }
  });
  content.addEventListener("change", (event) => {
    if (event.target.id === "class-filter") {
      state.classFilter = event.target.value;
      renderList(state.view);
    }
  });
  form.addEventListener("submit", saveRecord);
  form.addEventListener("close", () => { editing = null; });
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", closeDialog));
  document.querySelector("[data-close-detail]").addEventListener("click", () => document.getElementById("detail-dialog").close());
  document.getElementById("today-label").textContent = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date());
  loadAll();
})();
