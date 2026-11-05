import {
  dateKey,
  parseDate,
  addDays,
  shiftMonth,
  weekDays,
  monthDays,
  dayDiff,
  initialData,
  demoData,
  validateData,
  validateEvent,
  occurrences,
  onDate,
  localStart,
  repeatLabels,
  uid,
} from "./model.js";
import { createStore, STORAGE_KEY } from "./storage.js";
const $ = (s) => document.querySelector(s),
  app = $("#app"),
  store = createStore({
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  }),
  today = () => dateKey();
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icon = (name) =>
  `<svg class="icon" aria-hidden="true"><use href="./icons/ui.svg#${name}"></use></svg>`;
const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
const fullDate = (d) => {
  const x = parseDate(d, true);
  return `${x.getFullYear()} 年 ${x.getMonth() + 1} 月 ${x.getDate()} 日 星期${weekdays[x.getDay()]}`;
};
const shortDate = (d) => {
  const x = parseDate(d, true);
  return `${x.getMonth() + 1} / ${x.getDate()}`;
};
let data,
  storageError = "",
  selected = today(),
  view = "month",
  lastPage = "calendar",
  formRevision = 0,
  formInitial = "",
  editingCategory = "",
  toastTimer,
  pwa,
  updateReady = false;
try {
  data = store.read();
  view = data.settings.defaultView;
} catch (e) {
  data = initialData();
  storageError = e.message;
}
let route = { page: "calendar", view, date: selected };
function showToast(message) {
  const box = $("#toast");
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.hidden = true), 4000);
}
function error(message) {
  const target = $("#form-error") || $("#page-error");
  if (target) {
    target.textContent = message;
    target.hidden = false;
    target.focus();
  } else showToast(message);
}
function save(fn, revision) {
  if (storageError) {
    error(storageError);
    return false;
  }
  try {
    data = store.transaction(fn, revision);
    return true;
  } catch (e) {
    error(e.message);
    return false;
  }
}
function category(id) {
  return data.categories.find((c) => c.id === id) || data.categories[0];
}
function catOptions(selectedId) {
  return data.categories
    .map(
      (c) =>
        `<option value="${escape(c.id)}" ${c.id === selectedId ? "selected" : ""}>${escape(c.name)}</option>`,
    )
    .join("");
}
const empty = (title, subtitle = "", button = "") =>
  `<div class="empty"><span class="empty-pixel" aria-hidden="true">◇</span><h3>${title}</h3><p>${subtitle}</p>${button}</div>`;
const action = (label, act, extra = "", className = "") =>
  `<button type="button" class="${className}" data-action="${act}" ${extra}>${label}</button>`;
function link(label, hash, className = "") {
  return `<a class="button ${className}" href="#${hash}">${label}</a>`;
}
async function confirmAction(title, message, button = "確認") {
  const d = $("#confirm-dialog");
  $("#confirm-title").textContent = title;
  $("#confirm-body").textContent = message;
  d.querySelector(".danger").textContent = button;
  d.returnValue = "cancel";
  d.showModal();
  return new Promise((resolve) =>
    d.addEventListener("close", () => resolve(d.returnValue === "confirm"), {
      once: true,
    }),
  );
}
function applyTheme() {
  const mode =
    data.settings.theme === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : data.settings.theme;
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
  $('meta[name="theme-color"]').content =
    mode === "dark" ? "#171e29" : "#f5e7c9";
}
function parseRoute() {
  let bits;
  try {
    bits = location.hash.slice(1).split("/").map(decodeURIComponent);
  } catch {
    bits = [];
  }
  const page = bits[0] || "calendar";
  if (page === "calendar") {
    const v = ["month", "week", "day"].includes(bits[1]) ? bits[1] : view;
    let d = bits[2] || selected;
    try {
      parseDate(d);
    } catch {
      d = today();
    }
    return { page, view: v, date: d };
  }
  if (["event", "edit", "task"].includes(page)) {
    let d = bits[2] || selected;
    try {
      parseDate(d);
    } catch {
      d = selected;
    }
    return {
      page,
      id: bits[1] || "new",
      date: d,
      fromTask: page === "edit" ? bits[3] : undefined,
    };
  }
  if (["tasks", "search", "settings"].includes(page)) return { page };
  return { page: "calendar", view, date: selected };
}
function routeTo(hash) {
  if (location.hash === "#" + hash) {
    route = parseRoute();
    render();
  } else location.hash = hash;
}
function mainNav() {
  return `<nav class="main-nav" aria-label="主要導覽">${[
    ["calendar", "日曆", "calendar"],
    ["tasks", "待辦", "check"],
    ["search", "搜尋", "search"],
    ["settings", "設定", "gear"],
  ]
    .map(
      ([p, n, i]) =>
        `<a href="#${p === "calendar" ? `calendar/${view}/${selected}` : p}" ${route.page === p ? 'aria-current="page"' : ""}>${i === "check" ? '<span class="nav-glyph" aria-hidden="true">☑</span>' : i === "search" ? '<span class="nav-glyph search-icon" aria-hidden="true"></span>' : icon(i)}<span>${n}</span></a>`,
    )
    .join("")}</nav>`;
}
function render() {
  applyTheme();
  const focus = ["event", "edit", "task"].includes(route.page);
  document.title = `${{ calendar: "日曆", tasks: "待辦清單", search: "搜尋", settings: "設定", event: "行程詳情", edit: "編輯行程", task: "編輯待辦" }[route.page]} · Journey`;
  app.innerHTML = `<div class="app-shell ${focus ? "focused" : ""}"><header class="brand"><a class="brand-name" href="#calendar/${view}/${selected}"><img src="./icons/calendar.svg" width="36" height="36" alt=""><span>Journey<small>YOUR DAILY JOURNEY</small></span></a><span class="header-note">一格一格，安排日常</span>${focus ? "" : action("今天", "today", "", "quiet")}</header>${focus ? "" : mainNav()}<main id="main" tabindex="-1"><p id="page-error" class="error" role="alert" tabindex="-1" hidden></p>${storageError ? `<div class="error" role="alert">${escape(storageError)}<p>為保護資料，已暫停寫入。請先匯出原始檔，再檢查瀏覽器儲存狀態。</p>${action("匯出原始資料", "raw-export")}${action("重新讀取", "retry")}</div>` : ""}${renderPage()}</main>${!focus && ["calendar", "tasks"].includes(route.page) ? `<a class="fab" aria-label="${route.page === "tasks" ? "新增待辦" : "新增行程"}" href="#${route.page === "tasks" ? "task/new" : `edit/new/${selected}`}">${icon("plus")}</a>` : ""}<footer class="app-footer">保存在此瀏覽器 · <a href="#settings">備份與設定</a></footer></div>`;
  if (route.page === "edit") setupEventForm();
  if (route.page === "task") setupTaskForm();
  if (route.page === "search") setupSearch();
  if (route.page === "settings") setupSettings();
}
function renderPage() {
  if (route.page === "calendar") return calendarPage();
  if (route.page === "tasks") return tasksPage();
  if (route.page === "search") return searchPage();
  if (route.page === "settings") return settingsPage();
  if (route.page === "event") return detailPage();
  if (route.page === "edit") return editPage();
  if (route.page === "task") return taskPage();
  return "";
}
function eventCard(e, date = selected) {
  const c = category(e.categoryId);
  const cross = e.occurrenceDate !== e.lastDay;
  const time = e.allDay
    ? "全天"
    : `${e.occurrenceDate < date ? "接續前日" : e.startTime} – ${e.lastDay > date ? "跨日" : e.endTime}`;
  return `<a class="event-card" href="#event/${encodeURIComponent(e.id)}/${e.occurrenceDate}" style="--category:${c.color}"><div class="event-time">${time}${cross ? `<small>${shortDate(e.occurrenceDate)} — ${shortDate(e.lastDay)}</small>` : ""}</div><div class="event-content"><strong>${escape(e.title)}</strong><small>${escape(c.name)}${e.location ? " · " + escape(e.location) : ""}${e.repeat !== "none" ? " · " + repeatLabels[e.repeat] : ""}</small></div><span aria-hidden="true">›</span></a>`;
}
function agenda(date) {
  const events = onDate(data.events, date);
  return `<div class="section-heading"><h2>${date === today() ? "今天" : shortDate(date)}的行程</h2><span class="muted">${events.length} 筆</span></div>${events.length ? events.map((e) => eventCard(e, date)).join("") : empty("這一天，留白也很好", "加一筆行程，開始安排你的日常。", link("＋ 新增行程", `edit/new/${date}`, "primary"))}`;
}
function calendarPage() {
  selected = route.date;
  view = route.view;
  const date = parseDate(selected);
  const dates = monthDays(selected, data.settings.weekStart);
  const all = occurrences(data.events, dates[0], dates.at(-1));
  return `<div class="view-switch" role="group" aria-label="日曆檢視">${[
    ["month", "月"],
    ["week", "週"],
    ["day", "日"],
  ]
    .map(
      ([v, n]) =>
        `<a href="#calendar/${v}/${selected}" ${v === view ? 'aria-current="true"' : ""}>${n}</a>`,
    )
    .join(
      "",
    )}</div><div class="date-toolbar">${action("‹", "period", 'data-direction="-1" aria-label="上一個時段"', "square")}<div><h1>${view === "month" ? `${date.getFullYear()} 年 ${date.getMonth() + 1} 月` : view === "week" ? `${shortDate(weekDays(selected, data.settings.weekStart)[0])} — ${shortDate(weekDays(selected, data.settings.weekStart)[6])}` : `${date.getMonth() + 1} 月 ${date.getDate()} 日 星期${weekdays[date.getDay()]}`}</h1><label class="date-jump">跳至日期<input aria-label="跳至日期" type="date" min="1900-01-01" max="2199-12-31" value="${selected}" id="jump-date"></label></div>${action("›", "period", 'data-direction="1" aria-label="下一個時段"', "square")}</div>${
    view === "month"
      ? `<div class="calendar-layout"><section aria-label="月曆"><div class="week-labels">${Array.from({ length: 7 }, (_, i) => `<span>${weekdays[(i + data.settings.weekStart) % 7]}</span>`).join("")}</div><div class="month-grid">${dates
          .map((d) => {
            const es = all.filter(
              (e) => e.occurrenceDate <= d && e.lastDay >= d,
            );
            return `<button type="button" data-action="select-day" data-date="${d}" ${d < "1900-01-01" || d > "2199-12-31" ? "disabled" : ""} class="calendar-day ${d.slice(0, 7) !== selected.slice(0, 7) ? "outside" : ""} ${d === today() ? "is-today" : ""}" aria-pressed="${d === selected}" aria-label="${fullDate(d)}，${es.length} 筆行程"><span class="day-number">${Number(d.slice(8))}</span><span class="day-markers" aria-hidden="true">${es
              .slice(0, 3)
              .map(
                (e) =>
                  `<i style="background:${category(e.categoryId).color}"></i>`,
              )
              .join(
                "",
              )}${es.length > 3 ? "<b>＋</b>" : ""}</span><span class="desktop-events" aria-hidden="true">${es
              .slice(0, 2)
              .map((e) => `<span>${escape(e.title)}</span>`)
              .join(
                "",
              )}${es.length > 2 ? `<small>另 ${es.length - 2} 筆</small>` : ""}</span></button>`;
          })
          .join(
            "",
          )}</div><div class="calendar-legend"><span>◆ 今天</span><span>▪ 有行程</span><span>綠底：選取日期</span></div></section><aside class="selected-agenda"><p class="eyebrow">${fullDate(selected)}</p>${agenda(selected)}<a class="text-link" href="#calendar/day/${selected}">開啟單日檢視 →</a></aside></div>`
      : view === "week"
        ? `${weekStrip()}${timeline(selected)}`
        : `<p class="eyebrow">${date.getFullYear()} · ${selected === today() ? "今天" : "每日記事"}</p><div class="day-layout"><section>${agenda(selected)}</section><aside class="today-tasks"><div class="section-heading"><h2>當日待辦</h2><a class="text-link" href="#tasks">全部 →</a></div>${taskRows(data.tasks.filter((t) => t.due === selected && !t.done)) || empty("沒有待辦事項")}</aside></div>`
  }`;
}
function weekStrip() {
  return `<div class="week-strip">${weekDays(selected, data.settings.weekStart)
    .map(
      (d) =>
        `<a href="#calendar/week/${d}" ${d === selected ? 'aria-current="date"' : ""} aria-label="${fullDate(d)}"><small>${weekdays[parseDate(d, true).getDay()]}</small><span>${Number(d.slice(8))}</span>${onDate(data.events, d).length ? '<i aria-hidden="true"></i>' : ""}</a>`,
    )
    .join("")}</div>`;
}
function timeline(date) {
  const events = onDate(data.events, date),
    allDay = events.filter((e) => e.allDay),
    timed = events.filter((e) => !e.allDay);
  const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const rows = timed
    .map((e) => ({
      ...e,
      a: e.occurrenceDate < date ? 0 : minutes(e.startTime),
      b: e.occurrenceEnd > date ? 1440 : minutes(e.endTime),
    }))
    .sort((a, b) => a.a - b.a);
  let lanes = [], group = [];
  const finishGroup = () => {
    for (const item of group) item.laneCount = lanes.length;
    lanes = [];
    group = [];
  };
  for (const e of rows) {
    if (lanes.length && lanes.every(end => end <= e.a)) finishGroup();
    let lane = lanes.findIndex((end) => end <= e.a);
    if (lane < 0) lane = lanes.length;
    lanes[lane] = Math.max(e.b, e.a + 52);
    e.lane = lane;
    group.push(e);
  }
  finishGroup();
  const start = Math.min(8, ...rows.map((e) => Math.floor(e.a / 60))),
    end = Math.max(21, ...rows.map((e) => Math.ceil(e.b / 60))),
    height = (end - start) * 56;
  return `<div class="section-heading"><h2>${fullDate(date)}</h2><span class="muted">${events.length} 筆行程</span></div>${allDay.length ? `<section class="all-day"><span class="muted">全天</span>${allDay.map((e) => eventCard(e, date)).join("")}</section>` : ""}${!events.length ? `<p class="timeline-hint">這天還沒有行程，可以挑個時間開始安排。</p>` : ""}<div class="timeline" style="height:${height}px"><div class="hour-lines">${Array.from({ length: end - start + 1 }, (_, i) => `<div style="top:${i * 56}px"><span>${String(start + i).padStart(2, "0")}:00</span></div>`).join("")}</div><div class="timeline-events">${rows
    .map((e) => {
      const c = category(e.categoryId),
        width = 100 / Math.max(1, e.laneCount);
      return `<a class="time-event" href="#event/${encodeURIComponent(e.id)}/${e.occurrenceDate}" style="--category:${c.color};top:${(e.a / 60 - start) * 56}px;height:${Math.max(48, ((e.b - e.a) / 60) * 56)}px;left:${e.lane * width}%;width:calc(${width}% - 4px)"><small>${e.startTime}–${e.endTime}</small><strong>${escape(e.title)}</strong></a>`;
    })
    .join("")}</div></div>`;
}
function backLink() {
  return link(
    "‹ 返回",
    lastPage === "calendar" ? `calendar/${view}/${selected}` : lastPage,
    "quiet",
  );
}
function detailPage() {
  const e = data.events.find((e) => e.id === route.id);
  if (!e)
    return empty("找不到這筆行程", "可能已在另一個分頁刪除。", backLink());
  const occurrence = onDate([e], route.date).find(
    (x) => x.occurrenceDate === route.date,
  );
  if (!occurrence)
    return empty("找不到這次行程", "重複規則可能已變更。", backLink());
  const c = category(e.categoryId);
  return `<div class="page-toolbar">${backLink()}<h1>行程詳情</h1>${link("編輯", `edit/${encodeURIComponent(e.id)}/${route.date}`, "primary")}</div><article class="detail-panel"><span class="category-tag" style="--category:${c.color}">▪ ${escape(c.name)}</span><h2 class="event-title">${escape(e.title)}</h2><dl class="detail-list"><div><dt>${icon("calendar")} 日期 / 時間</dt><dd>${fullDate(occurrence.occurrenceDate)}${occurrence.lastDay !== occurrence.occurrenceDate ? "<br>至 " + fullDate(occurrence.lastDay) : ""}<br>${e.allDay ? "全天" : `${e.startTime} — ${e.endTime}`}</dd></div><div><dt>⌖ 地點</dt><dd>${escape(e.location) || "未設定地點"}</dd></div><div><dt>${icon("timer")} 提醒</dt><dd>${reminderLabel(e.reminder)}<small>App 開啟期間提示${data.settings.reminders ? "" : " · 目前未啟用"}</small></dd></div><div><dt>↻ 重複</dt><dd>${repeatLabels[e.repeat]}${e.repeatUntil ? "，至 " + e.repeatUntil : ""}${e.repeat !== "none" ? "<small>編輯或刪除會套用整個系列。</small>" : ""}</dd></div><div><dt>▤ 備註</dt><dd class="preserve-space">${escape(e.notes) || "還沒有備註"}</dd></div></dl>${action(e.repeat === "none" ? "刪除行程" : "刪除整個系列", "delete-event", `data-id="${escape(e.id)}"`, "danger full-width")}</article>`;
}
function reminderLabel(n) {
  return n < 0
    ? "不提醒"
    : n === 0
      ? "開始時"
      : n === 1440
        ? "提前 1 天"
        : `提前 ${n} 分鐘`;
}
function editPage() {
  const current = data.events.find((e) => e.id === route.id);
  if (route.id !== "new" && !current)
    return empty("找不到這筆行程", "", backLink());
  const e = current || {
    title: "",
    startDate: route.date,
    endDate: route.date,
    startTime: "09:00",
    endTime: "10:00",
    allDay: false,
    categoryId: data.categories[0].id,
    repeat: "none",
    repeatUntil: "",
    reminder: -1,
    location: "",
    notes: "",
  };
  return `<form id="event-form" class="editor"><div class="page-toolbar editor-toolbar">${action("‹ 取消", "cancel-form", "", "quiet")}<h1>${current ? "編輯" : "新增"}行程</h1><button type="submit" class="primary">儲存</button></div><p id="form-error" class="error" role="alert" tabindex="-1" hidden></p>${current && e.repeat !== "none" ? '<p class="notice">正在編輯整個重複系列，包含過去與未來的行程。</p>' : ""}<label>行程標題 <span class="required">*</span><input name="title" required maxlength="120" placeholder="這次要安排什麼？" value="${escape(e.title)}" autocomplete="off"></label><label class="switch-row"><span>全天行程</span><input name="allDay" type="checkbox" ${e.allDay ? "checked" : ""}></label><div class="field-pair"><label>開始日期<input name="startDate" type="date" required min="1900-01-01" max="2199-12-31" value="${e.startDate}"></label><label>結束日期<input name="endDate" type="date" required min="1900-01-01" max="2199-12-31" value="${e.endDate}"></label></div><div id="time-fields" class="field-pair" ${e.allDay ? "hidden" : ""}><label>開始時間<input name="startTime" type="time" required value="${e.startTime}"></label><label>結束時間<input name="endTime" type="time" required value="${e.endTime}"></label></div><label>分類<select name="categoryId">${catOptions(e.categoryId)}</select></label><label>重複<select name="repeat">${Object.entries(
    repeatLabels,
  )
    .map(
      ([v, n]) =>
        `<option value="${v}" ${v === e.repeat ? "selected" : ""}>${n}</option>`,
    )
    .join(
      "",
    )}</select></label><label id="repeat-until" ${e.repeat === "none" ? "hidden" : ""}>重複結束日 <small>留白表示持續重複</small><input name="repeatUntil" type="date" min="${e.startDate}" max="2199-12-31" value="${e.repeatUntil}"></label><label>提醒<select name="reminder">${[-1, 0, 5, 15, 60, 1440].map((n) => `<option value="${n}" ${n === e.reminder ? "selected" : ""}>${reminderLabel(n)}</option>`).join("")}</select><small>App 開啟期間提示，可在設定中啟用。</small></label><label>地點<input name="location" maxlength="240" placeholder="地點或線上會議網址" value="${escape(e.location)}"></label><label>備註<textarea name="notes" rows="4" maxlength="4000" placeholder="記下需要帶的東西、討論重點…">${escape(e.notes)}</textarea></label><div class="actions editor-bottom">${action("取消", "cancel-form")}<button class="primary" type="submit">儲存行程</button></div></form>`;
}
function formSnapshot(form) {
  return JSON.stringify([...new FormData(form)]);
}
function setupEventForm() {
  const f = $("#event-form");
  if (!f) return;
  if (route.fromTask && route.id === "new") {
    const task = data.tasks.find((t) => t.id === route.fromTask);
    if (task) {
      f.elements.title.value = task.title;
      f.elements.categoryId.value = task.categoryId;
    }
  }
  formRevision = data.revision;
  formInitial = formSnapshot(f);
  f.elements.allDay.addEventListener("change", () => {
    $("#time-fields").hidden = f.elements.allDay.checked;
  });
  f.elements.repeat.addEventListener("change", () => {
    $("#repeat-until").hidden = f.elements.repeat.value === "none";
  });
  f.elements.startDate.addEventListener("change", () => {
    if (f.elements.endDate.value < f.elements.startDate.value)
      f.elements.endDate.value = f.elements.startDate.value;
  });
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f)),
      current = data.events.find((x) => x.id === route.id);
    const event = {
      ...current,
      id: current?.id || uid(),
      title: v.title.trim(),
      startDate: v.startDate,
      endDate: v.endDate,
      startTime: v.startTime,
      endTime: v.endTime,
      allDay: f.elements.allDay.checked,
      categoryId: v.categoryId,
      repeat: v.repeat,
      repeatUntil: v.repeat === "none" ? "" : v.repeatUntil,
      reminder: Number(v.reminder),
      location: v.location.trim(),
      notes: v.notes.trim(),
    };
    try {
      validateEvent(event, data.categories);
    } catch (err) {
      error(err.message);
      return;
    }
    if (
      save((next) => {
        const i = next.events.findIndex((x) => x.id === event.id);
        if (i < 0) next.events.push(event);
        else next.events[i] = event;
        if (route.fromTask) {
          const task = next.tasks.find((t) => t.id === route.fromTask);
          if (task) task.eventId = event.id;
        }
      }, formRevision)
    ) {
      selected = event.startDate;
      formInitial = formSnapshot(f);
      showToast("行程已儲存");
      routeTo(`calendar/${view}/${selected}`);
    }
  });
}
function taskRows(tasks) {
  return tasks
    .map((t) => {
      const c = category(t.categoryId);
      return `<div class="task-row ${t.done ? "completed" : ""}"><label class="task-check"><input type="checkbox" data-task-toggle="${escape(t.id)}" ${t.done ? "checked" : ""} aria-label="完成 ${escape(t.title)}"></label><div class="task-main"><a href="#task/${encodeURIComponent(t.id)}">${escape(t.title)}</a><small style="--category:${c.color}"><i></i>${escape(c.name)} · ${t.due ? shortDate(t.due) : "無期限"}${!t.done && t.due && t.due < today() ? " · 已逾期" : ""}${t.eventId ? " · 已排程" : ""}</small></div>${t.eventId && data.events.some((e) => e.id === t.eventId) ? link("行程", `event/${encodeURIComponent(t.eventId)}/${data.events.find((e) => e.id === t.eventId).startDate}`, "compact") : action("排程", "schedule-task", `data-id="${escape(t.id)}"`, "compact")}</div>`;
    })
    .join("");
}
function tasksPage() {
  const pending = data.tasks
      .filter((t) => !t.done)
      .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")),
    done = data.tasks.filter((t) => t.done);
  const groups = [
    ["今天與逾期", pending.filter((t) => t.due && t.due <= today())],
    ["接下來", pending.filter((t) => t.due > today())],
    ["沒有期限", pending.filter((t) => !t.due)],
  ];
  return `<div class="section-heading"><div><p class="eyebrow">一件一件，慢慢完成</p><h1>待辦清單</h1></div><span class="count-badge">${pending.length} 件未完成</span></div>${
    data.tasks.length
      ? groups
          .filter(([, ts]) => ts.length)
          .map(
            ([n, ts]) =>
              `<section class="task-group"><h2>${n}<span>${ts.length}</span></h2>${taskRows(ts)}</section>`,
          )
          .join("")
      : empty(
          "把腦袋裡的小事，放在這裡",
          "待辦可以設定期限，也可以排成一筆行程。",
          link("＋ 新增待辦", "task/new", "primary"),
        )
  }${done.length ? `<details class="completed-group"><summary>已完成 · ${done.length}</summary>${taskRows(done)}</details>` : ""}`;
}
function taskPage() {
  const t = data.tasks.find((t) => t.id === route.id);
  if (route.id !== "new" && !t) return empty("找不到這筆待辦", "", backLink());
  return `<form id="task-form" class="editor"><div class="page-toolbar editor-toolbar">${action("‹ 取消", "cancel-form", "", "quiet")}<h1>${t ? "編輯" : "新增"}待辦</h1><button type="submit" class="primary">儲存</button></div><p id="form-error" class="error" role="alert" tabindex="-1" hidden></p><label>待辦名稱 <span class="required">*</span><input name="title" required maxlength="120" placeholder="要記得做什麼？" value="${escape(t?.title || "")}"></label><label>截止日期 <small>可留白</small><input name="due" type="date" min="1900-01-01" max="2199-12-31" value="${t?.due || ""}"></label><label>分類<select name="categoryId">${catOptions(t?.categoryId)}</select></label>${t ? `<label class="switch-row">已完成<input name="done" type="checkbox" ${t.done ? "checked" : ""}></label>` : ""}<button type="submit" class="primary full-width">儲存待辦</button>${t ? action("刪除待辦", "delete-task", `data-id="${escape(t.id)}"`, "danger full-width") : ""}</form>`;
}
function setupTaskForm() {
  const f = $("#task-form");
  if (!f) return;
  formRevision = data.revision;
  formInitial = formSnapshot(f);
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    if (!v.title.trim()) {
      error("請輸入待辦名稱");
      return;
    }
    if (
      save((next) => {
        const old = next.tasks.find((t) => t.id === route.id),
          task = {
            id: old?.id || uid(),
            title: v.title.trim(),
            due: v.due,
            categoryId: v.categoryId,
            done: !!v.done,
            eventId: old?.eventId || "",
          };
        if (old) Object.assign(old, task);
        else next.tasks.push(task);
      }, formRevision)
    ) {
      formInitial = formSnapshot(f);
      showToast("待辦已儲存");
      routeTo("tasks");
    }
  });
}
function searchPage() {
  return `<p class="eyebrow">找回那些重要的安排</p><h1>搜尋行程</h1><form id="search-form" class="search-form"><label>關鍵字<input name="query" type="search" placeholder="標題、地點或備註" maxlength="120"></label><div class="search-filters"><label>分類<select name="categoryId"><option value="">全部分類</option>${catOptions("")}</select></label><label>開始日期<input name="from" type="date" required min="1900-01-01" max="2199-12-31" value="${shiftMonth(today(), -6)}"></label><label>結束日期<input name="to" type="date" required min="1900-01-01" max="2199-12-31" value="${shiftMonth(today(), 6)}"></label></div><button class="primary" type="submit">搜尋</button></form><p id="form-error" class="error" role="alert" tabindex="-1" hidden></p><div id="search-results" aria-live="polite"></div>`;
}
function setupSearch() {
  const f = $("#search-form");
  const run = () => {
    const v = Object.fromEntries(new FormData(f));
    try {
      if (dayDiff(v.from, v.to) > 366) throw Error("請選擇一年以內的日期範圍");
      const q = v.query.trim().toLocaleLowerCase();
      const events = occurrences(data.events, v.from, v.to).filter(
        (e) =>
          (!v.categoryId || e.categoryId === v.categoryId) &&
          [e.title, e.location, e.notes]
            .join(" ")
            .toLocaleLowerCase()
            .includes(q),
      );
      $("#form-error").hidden = true;
      $("#search-results").innerHTML =
        `<div class="section-heading"><h2>搜尋結果</h2><span class="muted">${events.length} 筆</span></div>${events.length ? events.map((e) => `<p class="search-date">${fullDate(e.occurrenceDate)}</p>${eventCard(e, e.occurrenceDate)}`).join("") : empty("找不到符合的行程", "試著換個關鍵字、日期或分類。")}`;
    } catch (e) {
      error(e.message);
    }
  };
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    run();
  });
  run();
}
function settingsPage() {
  return `<p class="eyebrow">讓日曆，適合你的日常</p><h1>分類與設定</h1><div class="settings-layout"><section class="panel"><h2>顯示偏好</h2><form id="settings-form"><label>外觀主題<select name="theme">${[
    ["light", "羊皮紙 · 淺色"],
    ["dark", "夜間 · 深色"],
    ["system", "跟隨系統"],
  ]
    .map(
      ([v, n]) =>
        `<option value="${v}" ${data.settings.theme === v ? "selected" : ""}>${n}</option>`,
    )
    .join(
      "",
    )}</select></label><label>每週起始日<select name="weekStart"><option value="0" ${data.settings.weekStart === 0 ? "selected" : ""}>星期日</option><option value="1" ${data.settings.weekStart === 1 ? "selected" : ""}>星期一</option></select></label><label>預設檢視<select name="defaultView">${[
    ["month", "月曆"],
    ["week", "週曆"],
    ["day", "單日"],
  ]
    .map(
      ([v, n]) =>
        `<option value="${v}" ${data.settings.defaultView === v ? "selected" : ""}>${n}</option>`,
    )
    .join(
      "",
    )}</select></label><label class="switch-row"><span>開啟期間提醒</span><input name="reminders" type="checkbox" ${data.settings.reminders ? "checked" : ""}></label><p class="muted">只在 App 開啟且仍執行時顯示提示；關閉 App 後不會推播，也不補發錯過的提醒。</p><button type="submit" class="primary">儲存偏好</button></form></section><section class="panel"><div class="section-heading"><h2>分類管理</h2>${action("＋ 新增", "category-new", "", "compact")}</div>${data.categories.map((c) => `<div class="category-row"><span style="--category:${c.color}"><i></i>${escape(c.name)}</span><div>${action("編輯", "category-edit", `data-id="${escape(c.id)}"`, "compact")}${data.categories.length > 1 ? action("刪除", "category-delete", `data-id="${escape(c.id)}"`, "compact quiet") : ""}</div></div>`).join("")}${editingCategory ? categoryForm() : ""}</section><section class="panel"><h2>資料與備份</h2><p>行程只保存在此瀏覽器。清除網站資料會移除紀錄，建議定期匯出備份。</p><div class="actions">${action("匯出 JSON 備份", "export")}${action("匯入備份", "import")}</div><input id="import-file" type="file" accept=".json,application/json" hidden><p class="muted">匯入會取代目前的行程、待辦與設定，確認前會顯示筆數。不同裝置目前不會自動同步。</p>${!data.events.length && !data.tasks.length ? action("載入示範資料", "demo", "", "full-width") : ""}</section><section class="panel"><h2>Journey <small>v0.1.0</small></h2><p class="muted">${pwa ? "已啟用離線快取，首次下載完成後可離線使用。" : "以本機伺服器開啟建置版本，可啟用離線快取。"}</p>${action("檢查更新", "check-update")}${updateReady ? action("有新版 · 套用更新", "apply-update", "", "primary") : ""}<p class="muted">像素字型與部分介面資源沿用 Workout Calendar。</p></section></div>`;
}
function categoryForm() {
  const c = data.categories.find((c) => c.id === editingCategory);
  return `<form id="category-form" class="category-form"><h3>${c ? "編輯" : "新增"}分類</h3><label>名稱<input name="name" required maxlength="30" value="${escape(c?.name || "")}"></label><label>顏色<input type="color" name="color" value="${c?.color || "#4e7144"}"></label><div class="actions">${action("取消", "category-cancel")}<button class="primary" type="submit">儲存分類</button></div></form>`;
}
function setupSettings() {
  $("#settings-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget));
    if (
      save(
        (next) =>
          (next.settings = {
            theme: v.theme,
            weekStart: Number(v.weekStart),
            defaultView: v.defaultView,
            reminders: !!v.reminders,
          }),
      )
    ) {
      applyTheme();
      showToast("偏好已儲存");
    }
  });
  $("#category-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget)),
      name = v.name.trim();
    if (!name) {
      error("請輸入分類名稱");
      return;
    }
    if (
      data.categories.some((c) => c.id !== editingCategory && c.name === name)
    ) {
      error("已有同名分類");
      return;
    }
    if (
      save((next) => {
        const c = next.categories.find((c) => c.id === editingCategory);
        if (c) Object.assign(c, { name, color: v.color });
        else next.categories.push({ id: uid(), name, color: v.color });
      })
    ) {
      editingCategory = "";
      render();
      showToast("分類已儲存");
    }
  });
  $("#import-file").addEventListener("change", importBackup);
}
function download(name, content) {
  const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw Error("備份檔不可超過 10 MB");
    const imported = validateData(JSON.parse(await file.text()));
    if (
      await confirmAction(
        "匯入備份",
        `將以備份的 ${imported.events.length} 筆行程、${imported.tasks.length} 筆待辦取代目前資料。請先匯出現有備份。`,
        "取代並匯入",
      )
    ) {
      data = store.replace(imported);
      render();
      showToast("備份已匯入");
    }
  } catch (e) {
    error(e.message);
  } finally {
    event.target.value = "";
  }
}
app.addEventListener("change", (e) => {
  if (e.target.id === "jump-date") {
    try {
      parseDate(e.target.value);
      routeTo(`calendar/${view}/${e.target.value}`);
    } catch (err) {
      error(err.message);
    }
  }
  if (e.target.dataset.taskToggle) {
    const id = e.target.dataset.taskToggle,
      checked = e.target.checked;
    if (
      save((next) => {
        const t = next.tasks.find((t) => t.id === id);
        if (!t) throw Error("待辦已不存在");
        t.done = checked;
      })
    ) {
      render();
      showToast(checked ? "完成一件小事，做得好" : "已恢復為未完成");
    } else e.target.checked = !checked;
  }
});
app.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const id = b.dataset.id;
  switch (b.dataset.action) {
    case "today":
      routeTo(`calendar/${view}/${today()}`);
      break;
    case "period":
      try {
        const n = Number(b.dataset.direction),
          d =
            view === "month"
              ? shiftMonth(selected, n)
              : addDays(selected, n * (view === "week" ? 7 : 1));
        parseDate(d);
        routeTo(`calendar/${view}/${d}`);
      } catch {
        showToast("已到支援的日期邊界");
      }
      break;
    case "select-day":
      routeTo(`calendar/${view}/${b.dataset.date}`);
      break;
    case "cancel-form": {
      const f = $("#event-form") || $("#task-form");
      if (
        !f ||
        formSnapshot(f) === formInitial ||
        (await confirmAction(
          "捨棄變更？",
          "尚未儲存的內容將會放棄。",
          "捨棄變更",
        ))
      ) {
        if (f) formInitial = formSnapshot(f);
        routeTo(
          route.page === "task" ? "tasks" : `calendar/${view}/${selected}`,
        );
      }
      break;
    }
    case "delete-event": {
      const item = data.events.find((x) => x.id === id);
      if (
        item &&
        (await confirmAction(
          item.repeat === "none" ? "刪除行程？" : "刪除整個系列？",
          item.repeat === "none"
            ? `「${item.title}」刪除後無法復原。`
            : `「${item.title}」所有過去與未來的重複行程都會刪除。`,
          "刪除",
        ))
      ) {
        if (
          save((next) => {
            next.events = next.events.filter((x) => x.id !== id);
            for (const t of next.tasks) if (t.eventId === id) t.eventId = "";
          })
        ) {
          showToast("行程已刪除");
          routeTo(`calendar/${view}/${selected}`);
        }
      }
      break;
    }
    case "delete-task":
      if (
        await confirmAction(
          "刪除待辦？",
          "已排入的行程會保留，這筆待辦將刪除。",
          "刪除",
        )
      )
        if (
          save((next) => (next.tasks = next.tasks.filter((t) => t.id !== id)))
        ) {
          formInitial = formSnapshot($("#task-form"));
          routeTo("tasks");
          showToast("待辦已刪除");
        }
      break;
    case "schedule-task": {
      const t = data.tasks.find((t) => t.id === id);
      if (!t) break;
      routeTo(`edit/new/${t.due || today()}/${encodeURIComponent(id)}`);
      break;
    }
    case "category-new":
      editingCategory = "new";
      render();
      $("#category-form input").focus();
      break;
    case "category-edit":
      editingCategory = id;
      render();
      $("#category-form input").focus();
      break;
    case "category-cancel":
      editingCategory = "";
      render();
      break;
    case "category-delete":
      if (
        data.events.some((x) => x.categoryId === id) ||
        data.tasks.some((x) => x.categoryId === id)
      ) {
        error("此分類仍有行程或待辦，請先將它們移到其他分類。");
        break;
      }
      if (await confirmAction("刪除分類？", "這個空分類將被刪除。", "刪除"))
        if (
          save(
            (next) =>
              (next.categories = next.categories.filter((c) => c.id !== id)),
          )
        )
          render();
      break;
    case "export":
      try {
        download(
          `pixel-days-${today()}.json`,
          JSON.stringify(store.read(), null, 2),
        );
        showToast("備份已準備下載");
      } catch (err) {
        error(err.message);
      }
      break;
    case "import":
      $("#import-file").click();
      break;
    case "demo":
      if (save((next) => Object.assign(next, demoData()))) {
        render();
        showToast("已加入示範行程與待辦，可自由編輯或刪除");
      }
      break;
    case "raw-export":
      try {
        download(
          "pixel-days-original.json",
          localStorage.getItem(STORAGE_KEY) || "null",
        );
      } catch (err) {
        error(err.message);
      }
      break;
    case "retry":
      try {
        data = store.read();
        storageError = "";
        render();
      } catch (err) {
        error(err.message);
      }
      break;
    case "check-update":
      if (!pwa) {
        showToast("目前尚未啟用離線服務，請使用建置版本");
        break;
      }
      try {
        await pwa.update();
        updateReady = !!pwa.waiting;
        render();
        showToast(updateReady ? "新版已準備好" : "目前沒有待套用的更新");
      } catch {
        error("無法檢查更新，請確認網路連線");
      }
      break;
    case "apply-update":
      if (
        pwa?.waiting &&
        (await confirmAction(
          "套用更新？",
          "目前頁面將重新載入，已儲存的資料會保留。",
          "套用更新",
        ))
      ) {
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => location.reload(),
          { once: true },
        );
        pwa.waiting.postMessage("APPLY_UPDATE");
      }
      break;
  }
});
// Sticky save controls and the on-screen keyboard must not cover the active field.
function revealEditorField() {
  requestAnimationFrame(() => {
    const field = document.activeElement;
    if (!field?.matches('.editor input, .editor select, .editor textarea')) return;
    const toolbar = $('.editor-toolbar');
    if (!toolbar) return;
    const viewport = window.visualViewport;
    const top = Math.max(toolbar.getBoundingClientRect().bottom, viewport?.offsetTop || 0) + 12;
    const bottom = (viewport ? viewport.offsetTop + viewport.height : window.innerHeight) - 12;
    if (bottom <= top) return;
    const rect = field.getBoundingClientRect();
    if (rect.top < top) window.scrollBy(0, rect.top - top);
    else if (rect.bottom > bottom) window.scrollBy(0, Math.min(rect.bottom - bottom, rect.top - top));
  });
}
app.addEventListener('focusin', revealEditorField);
window.visualViewport?.addEventListener('resize', revealEditorField);
let previousHash = location.hash;
window.addEventListener("hashchange", async () => {
  const f = $("#event-form") || $("#task-form");
  if (f && formSnapshot(f) !== formInitial) {
    if (
      !(await confirmAction(
        "捨棄變更？",
        "尚未儲存的內容將會放棄。",
        "捨棄變更",
      ))
    ) {
      history.replaceState(null, "", previousHash || location.pathname);
      return;
    }
  }
  previousHash = location.hash;
  if (["calendar", "tasks", "search", "settings"].includes(route.page))
    lastPage = route.page;
  route = parseRoute();
  render();
  window.scrollTo(0, 0);
  $("#main").focus({ preventScroll: true });
});
window.addEventListener("beforeunload", (e) => {
  const f = $("#event-form") || $("#task-form");
  if (f && formSnapshot(f) !== formInitial) {
    e.preventDefault();
    e.returnValue = "";
  }
});
window.addEventListener("storage", (e) => {
  if (e.key !== STORAGE_KEY && e.key !== null) return;
  try {
    data = store.read();
    storageError = "";
    if (["edit", "task"].includes(route.page)) {
      showToast("其他分頁的資料已更新。儲存時會檢查版本，避免覆蓋。");
    } else {
      render();
      showToast("已載入其他分頁的更新");
    }
  } catch (err) {
    storageError = err.message;
    error(storageError);
  }
});
matchMedia("(prefers-color-scheme: dark)").addEventListener(
  "change",
  applyTheme,
);
const reminded = new Set();
let previousTick = Date.now();
function tickReminders() {
  const now = Date.now();
  if (data.settings.reminders) {
    for (const e of occurrences(data.events, today(), addDays(today(), 1))) {
      if (e.reminder < 0) continue;
      const due = localStart(e).getTime() - e.reminder * 60000,
        key = e.key + ":" + e.reminder;
      if (
        due > previousTick &&
        due <= now &&
        now - due < 90000 &&
        !reminded.has(key)
      ) {
        reminded.add(key);
        const box = $("#reminder");
        box.replaceChildren();
        const text = document.createElement("span");
        text.textContent = `行程提醒：${e.title} · ${e.allDay ? "全天" : e.startTime}`;
        const close = document.createElement("button");
        close.textContent = "關閉";
        close.onclick = () => (box.hidden = true);
        box.append(text, close);
        box.hidden = false;
      }
    }
  }
  previousTick = now;
}
setInterval(tickReminders, 15000);
route = parseRoute();
render();
if ("serviceWorker" in navigator) {
  fetch("./version.json", { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw Error("source preview");
      return navigator.serviceWorker.register("./sw.js");
    })
    .then((reg) => {
      pwa = reg;
      updateReady = !!reg.waiting;
      reg.addEventListener("updatefound", () =>
        reg.installing?.addEventListener("statechange", () => {
          if (reg.waiting && navigator.serviceWorker.controller) {
            updateReady = true;
            showToast("新版已準備好，可至設定套用");
          }
        }),
      );
    })
    .catch(() => {});
}
