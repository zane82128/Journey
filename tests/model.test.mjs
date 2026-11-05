import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dateKey,
  parseDate,
  addDays,
  shiftMonth,
  monthDays,
  weekDays,
  occurrences,
  onDate,
  validateEvent,
  validateData,
  initialData,
  demoData,
} from "../src/model.js";
const make = (patch = {}) => ({
  id: "e1",
  title: "Test",
  startDate: "2026-11-05",
  endDate: "2026-11-05",
  startTime: "09:30",
  endTime: "10:30",
  allDay: false,
  categoryId: "work",
  repeat: "none",
  repeatUntil: "",
  reminder: 15,
  location: "",
  notes: "",
  ...patch,
});
test("local dates, leap days and clamped month navigation", () => {
  assert.equal(dateKey(parseDate("2024-02-29")), "2024-02-29");
  assert.throws(() => parseDate("2026-02-29"));
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftMonth("2026-01-31", 1), "2026-02-28");
  assert.equal(shiftMonth("2024-01-31", 1), "2024-02-29");
});
test("November 2026 starts Sunday; week start and full week rows", () => {
  assert.equal(monthDays("2026-11-05")[0], "2026-11-01");
  assert.equal(monthDays("2026-11-05").length, 35);
  assert.equal(monthDays("2026-11-05", 1)[0], "2026-10-26");
  assert.deepEqual(weekDays("2026-11-05", 1), [
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
    "2026-11-07",
    "2026-11-08",
  ]);
});
test("weekly recurrence, inclusive repeat end, no phantom earlier instances", () => {
  const e = make({ repeat: "weekly", repeatUntil: "2026-11-19" });
  assert.deepEqual(
    occurrences([e], "2026-11-01", "2026-11-30").map((x) => x.occurrenceDate),
    ["2026-11-05", "2026-11-12", "2026-11-19"],
  );
  assert.equal(onDate([e], "2026-10-29").length, 0);
});
test("monthly recurrence skips missing dates instead of drifting", () => {
  const e = make({
    startDate: "2026-01-31",
    endDate: "2026-01-31",
    repeat: "monthly",
  });
  assert.deepEqual(
    occurrences([e], "2026-01-01", "2026-04-30").map((x) => x.occurrenceDate),
    ["2026-01-31", "2026-03-31"],
  );
});
test("cross-day and recurring cross-day overlap query start", () => {
  const e = make({ endDate: "2026-11-07", repeat: "weekly" });
  assert.equal(onDate([e], "2026-11-06")[0].occurrenceDate, "2026-11-05");
  assert.equal(onDate([e], "2026-11-13")[0].occurrenceDate, "2026-11-12");
  assert.equal(onDate([e], "2026-11-08").length, 0);
});
test("midnight-exclusive timed end, inclusive all-day dates", () => {
  const e = make({ endDate: "2026-11-06", endTime: "00:00" });
  assert.equal(onDate([e], "2026-11-05").length, 1);
  assert.equal(onDate([e], "2026-11-06").length, 0);
  assert.equal(onDate([{ ...e, allDay: true }], "2026-11-06").length, 1);
});
test("daily recurrence spans year and leap boundary", () => {
  const e = make({
    startDate: "2024-02-28",
    endDate: "2024-02-28",
    repeat: "daily",
  });
  assert.deepEqual(
    occurrences([e], "2024-02-28", "2024-03-01").map((x) => x.occurrenceDate),
    ["2024-02-28", "2024-02-29", "2024-03-01"],
  );
});
test("reject invalid time, unknown categories, inverted interval and bad repeat ending", () => {
  const cats = initialData().categories;
  for (const patch of [
    { title: "  " },
    { startTime: "25:00" },
    { endTime: "08:30" },
    { categoryId: "missing" },
    { endDate: "2026-11-04" },
    { repeatUntil: "2026-11-04" },
    { reminder: 9 },
    { repeat: "yearly" },
  ])
    assert.throws(() => validateEvent(make(patch), cats));
  assert.doesNotThrow(() =>
    validateEvent(
      make({ allDay: true, startTime: "00:00", endTime: "00:00" }),
      cats,
    ),
  );
});
test("backup rejects future schema, duplicate ids and malformed data", () => {
  const d = demoData("2026-11-05");
  assert.doesNotThrow(() => validateData(d));
  assert.throws(() => validateData({ ...d, version: 2 }));
  assert.throws(() =>
    validateData({ ...d, events: [d.events[0], d.events[0]] }),
  );
  assert.throws(() =>
    validateData({ ...d, tasks: [{ ...d.tasks[0], done: "yes" }] }),
  );
  assert.throws(() =>
    validateData({
      ...d,
      categories: [{ ...d.categories[0], color: "url(evil)" }],
    }),
  );
});
test("occurrence queries reject inverted or unbounded ranges", () => {
  assert.throws(() => occurrences([], "2026-11-05", "2026-11-01"));
  assert.throws(() => occurrences([], "2020-01-01", "2026-11-01"));
});
test("calendar boundary padding supports first and last supported years", () => {
  assert.equal(monthDays("1900-01-01")[0], "1899-12-31");
  const days = monthDays("2199-12-01");
  assert.equal(days.length % 7, 0);
  assert.doesNotThrow(() => occurrences([], days[0], days.at(-1)));
  assert.throws(() => parseDate("1899-12-31"));
  assert.equal(parseDate("1899-12-31", true).getFullYear(), 1899);
});
