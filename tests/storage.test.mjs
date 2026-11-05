import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore, STORAGE_KEY } from "../src/storage.js";
import { demoData } from "../src/model.js";
function memory() {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    values,
  };
}
test("empty installation has no sample data; transactions persist and increment revision", () => {
  const m = memory(),
    s = createStore(m);
  assert.equal(s.read().events.length, 0);
  s.transaction((d) => (d.settings.theme = "dark"));
  assert.equal(s.read().settings.theme, "dark");
  assert.equal(s.read().revision, 1);
});
test("failed mutations and invalid data never alter stored bytes", () => {
  const m = memory(),
    s = createStore(m);
  s.replace(demoData());
  const before = m.getItem(STORAGE_KEY);
  assert.throws(() =>
    s.transaction((d) => {
      d.events[0].title = "";
    }),
  );
  assert.equal(m.getItem(STORAGE_KEY), before);
});
test("corrupt or future-version data blocks writes without clearing originals", () => {
  for (const raw of ["{bad", JSON.stringify({ ...demoData(), version: 2 })]) {
    const m = memory();
    m.setItem(STORAGE_KEY, raw);
    const s = createStore(m);
    assert.throws(() => s.read());
    assert.throws(() => s.transaction(() => {}));
    assert.equal(m.getItem(STORAGE_KEY), raw);
  }
});
test("quota failures do not report success or mutate persisted data", () => {
  const m = memory();
  const s = createStore(m);
  s.replace(demoData());
  const before = m.getItem(STORAGE_KEY);
  const failing = createStore({
    getItem: m.getItem,
    setItem: () => {
      throw Error("quota");
    },
  });
  assert.throws(() => failing.transaction((d) => (d.events = [])), /儲存失敗/);
  assert.equal(m.getItem(STORAGE_KEY), before);
});
test("stale editor rejects overwriting another tab", () => {
  const m = memory(),
    a = createStore(m),
    b = createStore(m);
  const rev = a.read().revision;
  b.transaction((d) => (d.settings.theme = "dark"));
  assert.throws(
    () => a.transaction((d) => (d.settings.theme = "light"), rev),
    /其他分頁/,
  );
  assert.equal(a.read().settings.theme, "dark");
});
test("backup round trip retains identifiers, recurrence, tasks and settings", () => {
  const m = memory(),
    s = createStore(m),
    d = demoData("2026-11-05");
  s.replace(d);
  const snapshot = JSON.parse(JSON.stringify(s.read()));
  s.transaction((d) => (d.events = []));
  s.replace(snapshot);
  assert.deepEqual(s.read().events, snapshot.events);
  assert.deepEqual(s.read().tasks, snapshot.tasks);
  assert.equal(s.read().revision, 3);
});
