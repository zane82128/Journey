// Floating local dates: calendar arithmetic never goes through UTC serialization.
export const pad = (n) => String(n).padStart(2, "0");
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function parseDate(key, internal = false) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key))
    throw Error("日期格式不正確");
  const [y, m, d] = key.split("-").map(Number),
    value = new Date(y, m - 1, d, 12);
  if (
    y < (internal ? 1800 : 1900) ||
    y > (internal ? 2299 : 2199) ||
    value.getFullYear() !== y ||
    value.getMonth() !== m - 1 ||
    value.getDate() !== d
  )
    throw Error("請使用 1900–2199 年間的有效日期");
  return value;
}
export function addDays(key, amount) {
  const d = parseDate(key, true);
  d.setDate(d.getDate() + amount);
  return dateKey(d);
}
export function monthKey(key) {
  return key.slice(0, 7);
}
export function shiftMonth(key, amount) {
  const d = parseDate(key),
    day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + amount);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return dateKey(d);
}
export function dayDiff(a, b) {
  const x = parseDate(a, true),
    y = parseDate(b, true);
  return Math.round(
    (Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) -
      Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) /
      86400000,
  );
}
export function weekDays(key, start = 0) {
  const d = parseDate(key),
    first = addDays(key, -((d.getDay() - start + 7) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}
export function monthDays(key, start = 0) {
  const first = key.slice(0, 7) + "-01",
    d = parseDate(first),
    offset = (d.getDay() - start + 7) % 7,
    count = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
    rows = Math.ceil((offset + count) / 7);
  return Array.from({ length: rows * 7 }, (_, i) => addDays(first, i - offset));
}
export const uid = () => crypto.randomUUID();
export const repeatLabels = {
  none: "不重複",
  daily: "每天",
  weekly: "每週",
  monthly: "每月",
};
export function initialData() {
  return {
    version: 1,
    revision: 0,
    events: [],
    tasks: [],
    categories: [
      { id: "work", name: "工作", color: "#4e7144" },
      { id: "life", name: "生活", color: "#b1782f" },
      { id: "personal", name: "個人", color: "#826393" },
    ],
    settings: {
      theme: "light",
      weekStart: 0,
      defaultView: "month",
      reminders: false,
    },
  };
}
const text = (s, max, required = false) =>
  typeof s === "string" &&
  s.length <= max &&
  (!required || s.trim().length > 0);
const time = (s) =>
  typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export function validateEvent(e, categories) {
  if (
    !e ||
    !text(e.id, 100, true) ||
    !text(e.title, 120, true) ||
    !text(e.location, 240) ||
    !text(e.notes, 4000)
  )
    throw Error("行程標題必填，並請確認文字長度");
  parseDate(e.startDate);
  parseDate(e.endDate);
  if (!time(e.startTime) || !time(e.endTime) || typeof e.allDay !== "boolean")
    throw Error("行程時間不正確");
  if (e.endDate < e.startDate || dayDiff(e.startDate, e.endDate) > 366)
    throw Error("結束日期必須在開始後，最長可跨 366 天");
  if (!e.allDay && e.endDate === e.startDate && e.endTime <= e.startTime)
    throw Error("結束時間必須晚於開始時間");
  if (
    !categories.some((c) => c.id === e.categoryId) ||
    !Object.hasOwn(repeatLabels, e.repeat)
  )
    throw Error("分類或重複規則不正確");
  if (e.repeatUntil) {
    parseDate(e.repeatUntil);
    if (e.repeatUntil < e.startDate) throw Error("重複結束日不可早於開始日");
  } else if (e.repeatUntil !== "") throw Error("重複結束日期格式不正確");
  if (![-1, 0, 5, 15, 60, 1440].includes(e.reminder))
    throw Error("提醒時間不正確");
  return e;
}
export function validateData(d) {
  if (
    !d ||
    d.version !== 1 ||
    !Number.isSafeInteger(d.revision) ||
    d.revision < 0 ||
    !Array.isArray(d.events) ||
    !Array.isArray(d.tasks) ||
    !Array.isArray(d.categories)
  )
    throw Error("備份或儲存格式不相容，原資料未修改");
  if (
    d.events.length > 10000 ||
    d.tasks.length > 10000 ||
    d.categories.length < 1 ||
    d.categories.length > 50
  )
    throw Error("資料數量超出限制");
  const ids = new Set();
  for (const c of d.categories) {
    if (
      !c ||
      !text(c.id, 100, true) ||
      !text(c.name, 30, true) ||
      !/^#[0-9a-f]{6}$/i.test(c.color) ||
      ids.has(c.id)
    )
      throw Error("分類資料不正確");
    ids.add(c.id);
  }
  const eventIds = new Set();
  for (const e of d.events) {
    validateEvent(e, d.categories);
    if (eventIds.has(e.id)) throw Error("行程編號重複");
    eventIds.add(e.id);
  }
  const taskIds = new Set();
  for (const t of d.tasks) {
    if (
      !t ||
      !text(t.id, 100, true) ||
      taskIds.has(t.id) ||
      !text(t.title, 120, true) ||
      !ids.has(t.categoryId) ||
      typeof t.done !== "boolean" ||
      !text(t.eventId, 100)
    )
      throw Error("待辦資料不正確");
    if (t.due) parseDate(t.due);
    else if (t.due !== "") throw Error("待辦日期不正確");
    taskIds.add(t.id);
  }
  const s = d.settings;
  if (
    !s ||
    !["light", "dark", "system"].includes(s.theme) ||
    ![0, 1].includes(s.weekStart) ||
    !["month", "week", "day"].includes(s.defaultView) ||
    typeof s.reminders !== "boolean"
  )
    throw Error("偏好設定不正確");
  return d;
}
function repeatsOn(e, day) {
  if (day < e.startDate || (e.repeatUntil && day > e.repeatUntil)) return false;
  if (e.repeat === "none") return day === e.startDate;
  if (e.repeat === "daily") return true;
  if (e.repeat === "weekly") return dayDiff(e.startDate, day) % 7 === 0;
  return day.slice(8) === e.startDate.slice(8); // Skip months without that date.
}
export function occurrences(events, from, to) {
  parseDate(from, true);
  parseDate(to, true);
  if (to < from || dayDiff(from, to) > 1100)
    throw Error("查詢範圍最長為 1100 天");
  const result = [];
  for (const e of events) {
    const duration = dayDiff(e.startDate, e.endDate);
    let start =
      e.repeat === "none"
        ? e.startDate
        : from > e.startDate
          ? addDays(from, -duration)
          : e.startDate;
    if (start < e.startDate) start = e.startDate;
    const last = e.repeat === "none" ? e.startDate : to;
    for (let day = start; day <= last; day = addDays(day, 1)) {
      if (repeatsOn(e, day)) {
        const end = addDays(day, duration);
        const lastDay =
          !e.allDay && e.endTime === "00:00" && end > day
            ? addDays(end, -1)
            : end;
        if (day <= to && lastDay >= from)
          result.push({
            ...e,
            occurrenceDate: day,
            occurrenceEnd: end,
            lastDay,
            key: `${e.id}@${day}`,
          });
      }
      if (e.repeat === "none") break;
    }
  }
  return result.sort(
    (a, b) =>
      a.occurrenceDate.localeCompare(b.occurrenceDate) ||
      Number(b.allDay) - Number(a.allDay) ||
      a.startTime.localeCompare(b.startTime) ||
      a.title.localeCompare(b.title, "zh-Hant"),
  );
}
export function onDate(events, date) {
  return occurrences(events, date, date);
}
export function localStart(e) {
  return new Date(
    `${e.occurrenceDate || e.startDate}T${e.allDay ? "00:00" : e.startTime}:00`,
  );
}
export function demoData(today = dateKey()) {
  const d = initialData();
  const common = {
    location: "",
    notes: "",
    allDay: false,
    repeat: "none",
    repeatUntil: "",
    reminder: 15,
  };
  d.events = [
    {
      ...common,
      id: uid(),
      title: "專案討論",
      startDate: today,
      endDate: today,
      startTime: "09:30",
      endTime: "10:30",
      categoryId: "work",
      location: "會議室 A",
      notes: "討論首頁配置與下週安排。",
      repeat: "weekly",
    },
    {
      ...common,
      id: uid(),
      title: "重量訓練",
      startDate: today,
      endDate: today,
      startTime: "19:00",
      endTime: "20:00",
      categoryId: "life",
      location: "健身房",
    },
    {
      ...common,
      id: uid(),
      title: "留一點時間給自己",
      startDate: addDays(today, 2),
      endDate: addDays(today, 2),
      startTime: "00:00",
      endTime: "00:00",
      allDay: true,
      categoryId: "personal",
    },
  ];
  d.tasks = [
    {
      id: uid(),
      title: "整理會議筆記",
      due: today,
      categoryId: "work",
      done: false,
      eventId: "",
    },
    {
      id: uid(),
      title: "買牛奶",
      due: addDays(today, 1),
      categoryId: "life",
      done: false,
      eventId: "",
    },
  ];
  return d;
}
