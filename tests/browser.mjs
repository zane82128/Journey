import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { startServer, root } from "../tools/preview.mjs";
import path from "node:path";
const output = path.join(root, "test-results");
await mkdir(output, { recursive: true });
const { server, url } = await startServer({
  port: 0,
  basePath: process.env.TEST_BASE_PATH || "/",
});
const browser = await chromium.launch(
  process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : process.env.PLAYWRIGHT_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_CHANNEL }
      : {},
);
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  timezoneId: "Asia/Taipei",
  acceptDownloads: true,
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.clock.install({ time: new Date("2026-11-05T01:00:00+08:00") });
const clickAction = async (a) =>
  page.locator(`[data-action="${a}"]`).first().click();
const go = async (hash) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForTimeout(80);
};
const check = async (test, message) => assert.ok(await test, message);
const noOverflow = async () =>
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "page must not overflow horizontally",
  );
const screenshot = async (name) => {
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.activeElement?.blur();
    window.scrollTo(0, 0);
    document.getElementById("toast").hidden = true;
  });
  await page.screenshot({
    path: path.join(output, name + ".png"),
    fullPage: true,
  });
};
let count = 0;
const pass = (name) => {
  count++;
  console.log(`PASS ${name}`);
};
try {
  await page.goto(url);
  await page.locator(".view-switch").waitFor();
  await noOverflow();
  pass("empty first launch");
  await go("settings");
  await clickAction("demo");
  await go("calendar/month/2026-11-05");
  await page.locator(".event-card").first().waitFor();
  await screenshot("mobile-month");
  pass("load sample data explicitly");
  for (const width of [320, 360, 390, 430, 768, 1100]) {
    await page.setViewportSize({ width, height: 844 });
    for (const hash of [
      "calendar/month/2026-11-05",
      "calendar/week/2026-11-05",
      "calendar/day/2026-11-05",
      "tasks",
      "search",
      "settings",
      "edit/new/2026-11-05",
      "task/new",
    ]) {
      await go(hash);
      await noOverflow();
    }
    pass(`layout ${width}px, eight routes`);
  }
  await page.setViewportSize({ width: 320, height: 640 });
  await go("tasks");
  for (const box of await page.locator(".task-check").all()) {
    const rect = await box.boundingBox();
    assert.ok(
      rect.width >= 44 && rect.height >= 44,
      "task checkbox touch area",
    );
  }
  await go("calendar/month/2026-11-05");
  for (const box of await page.locator(".date-toolbar .square").all()) {
    const rect = await box.boundingBox();
    assert.ok(
      rect.width >= 44 && rect.height >= 44,
      "date navigation touch area",
    );
  }
  pass("mobile primary touch targets remain at least 44px");
  await page.setViewportSize({ width: 390, height: 400 });
  await go("edit/new/2026-11-05");
  for (const name of ["notes", "title", "location"]) {
    await page.locator(`[name=${name}]`).focus();
    await page.waitForTimeout(80);
    const field = await page.locator(`[name=${name}]`).boundingBox();
    const toolbar = await page.locator(".editor-toolbar").boundingBox();
    assert.ok(
      field.y >= toolbar.y + toolbar.height,
      "focused field below sticky save bar",
    );
    assert.ok(
      field.y + field.height <= 400,
      "focused field within reduced viewport",
    );
  }
  await screenshot("mobile-editor-reduced-height");
  pass("editor focus stays visible in reduced mobile viewport");
  await page.setViewportSize({ width: 390, height: 844 });
  await go("calendar/month/2026-11-05");
  await page.locator(".fab").click();
  await page.locator("[name=title]").fill("跨日測試 <img src=x>");
  await page.locator("[name=startDate]").fill("2026-11-05");
  await page.locator("[name=endDate]").fill("2026-11-06");
  await page.locator("[name=startTime]").fill("23:00");
  await page.locator("[name=endTime]").fill("01:00");
  await page.locator("[name=repeat]").selectOption("weekly");
  await page.locator("[name=repeatUntil]").fill("2026-11-19");
  await page.locator("[name=location]").fill("測試地點");
  await page.locator("[name=notes]").fill("測試備註");
  await screenshot("mobile-editor");
  await page.locator(".editor-toolbar [type=submit]").click();
  await page.locator(".view-switch").waitFor();
  assert.equal(
    await page.locator(".event-card").filter({ hasText: "跨日測試" }).count(),
    1,
  );
  assert.equal(await page.locator("img[src=x]").count(), 0);
  pass("event create, recurrence, cross-day and escaped input");
  await page.reload();
  await page.locator(".view-switch").waitFor();
  assert.equal(
    await page.locator(".event-card").filter({ hasText: "跨日測試" }).count(),
    1,
  );
  pass("persistence after reload");
  await go("calendar/day/2026-11-06");
  await page.locator(".event-card").filter({ hasText: "跨日測試" }).click();
  await page.locator(".event-title").waitFor();
  await screenshot("mobile-detail");
  await page.getByRole("link", { name: "編輯", exact: true }).click();
  await page.locator("[name=title]").fill("修改後的系列");
  await page.locator(".editor-toolbar [type=submit]").click();
  await page.locator(".view-switch").waitFor();
  pass("detail and series editing");
  await go("task/new");
  await page.locator("[name=title]").fill("買一本新筆記本");
  await page.locator("[name=due]").fill("2026-11-05");
  await page.locator(".editor-toolbar [type=submit]").click();
  await page
    .locator(".task-row")
    .filter({ hasText: "買一本新筆記本" })
    .waitFor();
  const task = page.locator(".task-row").filter({ hasText: "買一本新筆記本" });
  await task.locator("[data-action=schedule-task]").click();
  assert.equal(
    await page.locator("[name=title]").inputValue(),
    "買一本新筆記本",
  );
  await page.locator(".editor-toolbar [type=submit]").click();
  await page.locator(".view-switch").waitFor();
  await go("tasks");
  assert.ok(
    await page
      .locator(".task-row")
      .filter({ hasText: "買一本新筆記本" })
      .textContent()
      .then((t) => t.includes("已排程")),
  );
  await page
    .locator(".task-row")
    .filter({ hasText: "買一本新筆記本" })
    .locator("input[type=checkbox]")
    .check();
  await page.locator(".completed-group summary").click();
  await page
    .locator(".completed")
    .filter({ hasText: "買一本新筆記本" })
    .waitFor();
  await screenshot("mobile-tasks");
  pass("task creation, scheduling and completion");
  await go("search");
  await page.locator("[name=query]").fill("修改後的系列");
  await page.locator("#search-form [type=submit]").click();
  assert.equal(await page.locator("#search-results .event-card").count(), 3);
  await screenshot("mobile-search");
  pass("search recurring occurrences");
  await go("calendar/week/2026-11-05");
  await screenshot("mobile-week");
  await go("calendar/day/2026-11-05");
  await screenshot("mobile-day");
  await go("settings");
  await page.locator("[name=theme]").selectOption("dark");
  await page.locator("#settings-form [type=submit]").click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await screenshot("mobile-settings-dark");
  await clickAction("category-new");
  await page.locator("#category-form [name=name]").fill("閱讀");
  await page.locator("#category-form [type=submit]").click();
  assert.ok(
    (await page.locator(".category-row").allTextContents()).some((x) =>
      x.includes("閱讀"),
    ),
  );
  pass("theme persistence and category creation");
  const downloadEvent = page.waitForEvent("download");
  await clickAction("export");
  const download = await downloadEvent;
  await download.saveAs(path.join(output, "backup.json"));
  pass("backup export");
  await go("edit/new/2026-11-05");
  await page.locator("[name=title]").fill("尚未儲存的草稿");
  await clickAction("cancel-form");
  await page.locator("#confirm-dialog[open]").waitFor();
  await page.locator("#confirm-dialog [value=cancel]").click();
  assert.equal(
    await page.locator("[name=title]").inputValue(),
    "尚未儲存的草稿",
  );
  await clickAction("cancel-form");
  await page.locator("#confirm-dialog [value=confirm]").click();
  await page.locator(".view-switch").waitFor();
  pass("cancel protects unsaved form");
  await go("calendar/day/2026-11-05");
  await page.locator(".event-card").filter({ hasText: "修改後的系列" }).click();
  await clickAction("delete-event");
  await page.locator("#confirm-dialog [value=confirm]").click();
  await page.locator(".view-switch").waitFor();
  await go("search");
  await page.locator("[name=query]").fill("修改後的系列");
  await page.locator("#search-form [type=submit]").click();
  assert.equal(await page.locator("#search-results .event-card").count(), 0);
  pass("delete entire series");
  await go("settings");
  const fileInput = page.locator("#import-file");
  await fileInput.setInputFiles(path.join(output, "backup.json"));
  await page.locator("#confirm-dialog [value=confirm]").click();
  await page.locator("h1").filter({ hasText: "分類與設定" }).waitFor();
  await go("search");
  await page.locator("[name=query]").fill("修改後的系列");
  await page.locator("#search-form [type=submit]").click();
  assert.equal(await page.locator("#search-results .event-card").count(), 3);
  pass("backup import restores deleted data");
  for (const [title, start, end] of [
    ["短行程一", "12:00", "12:05"],
    ["短行程二", "12:05", "12:10"],
  ]) {
    await go("edit/new/2026-11-05");
    await page.locator("[name=title]").fill(title);
    await page.locator("[name=startTime]").fill(start);
    await page.locator("[name=endTime]").fill(end);
    await page.locator(".editor-toolbar [type=submit]").click();
    await page.locator(".view-switch").waitFor();
  }
  await go("calendar/week/2026-11-05");
  const shortRects = await page
    .locator(".time-event")
    .filter({ hasText: "短行程" })
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect();
        return {
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          height: r.height,
        };
      }),
    );
  assert.equal(shortRects.length, 2);
  assert.ok(shortRects.every((r) => r.height >= 44));
  const [a, b] = shortRects;
  assert.ok(
    a.right <= b.left ||
      b.right <= a.left ||
      a.bottom <= b.top ||
      b.bottom <= a.top,
    "adjacent short cards must not overlap",
  );
  await screenshot("mobile-short-events");
  pass("short timeline events remain tappable without overlapping");
  await page.setViewportSize({ width: 1100, height: 900 });
  await go("calendar/month/2026-11-05");
  await screenshot("desktop-month-dark");
  await go("settings");
  await page.locator("[name=theme]").selectOption("light");
  await page.locator("#settings-form [type=submit]").click();
  await go("calendar/month/2026-11-05");
  await screenshot("desktop-month");
  await go("settings");
  await page.locator("[name=reminders]").check();
  await page.locator("#settings-form [type=submit]").click();
  await go("edit/new/2026-11-05");
  await page.locator("[name=title]").fill("提醒測試");
  await page.locator("[name=startTime]").fill("01:01");
  await page.locator("[name=endTime]").fill("01:10");
  await page.locator("[name=reminder]").selectOption("0");
  await page.locator(".editor-toolbar [type=submit]").click();
  await page.locator(".view-switch").waitFor();
  await page.clock.fastForward(60000);
  await page.locator("#reminder:not([hidden])").waitFor();
  assert.match(await page.locator("#reminder").textContent(), /提醒測試/);
  await page.locator("#reminder button").click();
  pass("in-app reminder at scheduled local time");
  await go("edit/new/2026-11-05");
  await page.locator("[name=title]").fill("跨分頁草稿");
  const other = await context.newPage();
  await other.goto(url);
  await other.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("pixelCalendar.v1"));
    d.revision++;
    d.settings.defaultView = "day";
    localStorage.setItem("pixelCalendar.v1", JSON.stringify(d));
  });
  await page.waitForTimeout(100);
  await page.locator(".editor-toolbar [type=submit]").click();
  assert.match(await page.locator("#form-error").textContent(), /其他分頁/);
  assert.equal(await page.locator("[name=title]").inputValue(), "跨分頁草稿");
  await other.close();
  await clickAction("cancel-form");
  await page.locator("#confirm-dialog [value=confirm]").click();
  await page.locator(".view-switch").waitFor();
  pass("stale tab preserves draft and rejects overwrite");
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) throw Error("service worker not active");
  });
  await context.setOffline(true);
  await page.reload();
  await page.locator(".view-switch").waitFor();
  await noOverflow();
  await context.setOffline(false);
  pass("built application reloads offline");
  const badContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    badPage = await badContext.newPage();
  await badPage.goto(url);
  await badPage.evaluate(() => {
    localStorage.setItem("pixelCalendar.v1", "{broken-json");
  });
  await badPage.reload();
  await badPage.getByRole("button", { name: "匯出原始資料" }).waitFor();
  assert.equal(
    await badPage.evaluate(() => localStorage.getItem("pixelCalendar.v1")),
    "{broken-json",
  );
  await badContext.close();
  pass("corrupt storage is preserved and recoverable");
  assert.deepEqual(errors, []);
  pass("no uncaught browser errors");
  await writeFile(
    path.join(output, "browser-results.json"),
    JSON.stringify(
      {
        passed: count,
        errors,
        viewportWidths: [320, 360, 390, 430, 768, 1100],
        browser: await browser.version(),
        basePath: process.env.TEST_BASE_PATH || "/",
      },
      null,
      2,
    ),
  );
  console.log(`${count} browser checks passed. Screenshots: test-results/`);
} catch (error) {
  await page
    .screenshot({ path: path.join(output, "failure.png"), fullPage: true })
    .catch(() => {});
  console.error({
    url: page.url(),
    errors,
    body: (await page.locator("body").innerText()).slice(0, 1600),
  });
  throw error;
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
