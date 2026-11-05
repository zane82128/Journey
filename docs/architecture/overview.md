# 架構與資料流

原生 ES modules，無應用框架或後端。Node 工具只在開發與建置時需要。使用者開啟後，瀏覽器從靜態檔案執行應用。

## 操作 → 儲存 → 呈現

1. `main.js` 根據 hash 路由建立月曆、週時間軸、單日、詳情、表單、待辦、搜尋與設定。
2. `model.js` 驗證本地日期／時間與資料，再根據查詢範圍展開重複行程。跨日使用日期差運算，避免用 UTC 字串替代本地日期。
3. `storage.js` 每次交易重新讀取 `pixelCalendar.v1`，複製並修改，驗證完整結果後才 `setItem`；寫入成功後 UI 才更新與回報。
4. 編輯行程／待辦保存開表單時的 revision，其他分頁改動後拒絕舊表單寫入。此為樂觀檢查，localStorage 本身沒有跨分頁原子交易；極短時間的同時寫入仍有競爭限制。

`revealEditorField` 在編輯欄位 focusin 與 visualViewport resize 後，以實際工具列位置、可視高度與欄位位置計算必要捲動，不改寫輸入。時間軸分欄同時考慮短行程卡片的最小顯示高度，而不只按實際結束時間判斷重疊。

資料根物件為 `{version:1, revision, events, tasks, categories, settings}`。行程保存 startDate/endDate/startTime/endTime/allDay/repeat/repeatUntil；搜尋與畫面只展開 occurrences，不將無限重複行程實體化存入資料。

JSON 匯入保留識別碼但重新接續本機 revision。未知或損壞版本阻擋寫入，提供原始檔下載；不自動重設。網站儲存與健身 app 的 `workoutCalendar.v1` 完全分開。

## 建置與離線

`tools/build.mjs` 複製 src 至 dist，依全部靜態資源建立 SHA-256 指紋，注入 service worker 資源表與版本。首次安裝完整快取指定資源；新版進入 waiting，不在使用者輸入時自行重載。設定頁明確套用更新後才 skipWaiting 並重載。

`tools/preview.mjs` 只監聽 127.0.0.1:5174，限制檔案路徑在 dist 之內，不提供資料後端。用不同埠啟動會是不同儲存來源。

預覽伺服器新增 basePath，可用 `/Journey/` 模擬 GitHub Pages 專案路徑。建置 metadata 同時包含版本與快取資源表，`check-artifact.mjs` 檢查檔案、manifest 相對路徑及 worker metadata 一致性。部署工作呼叫相同 CI，下載通過測試的 artifact 後發布，不重新建置；詳見 docs/release/github-pages.md。

## 參考專案

原樣複製 Fusion Pixel 字型、授權及 ui.svg；改寫像素主題與本機預覽伺服器。因原 repo 資料規則是訓練紀錄，行程資料與建置版本另外實作。沒有沿用外部意見回報服務、訓練計算或既有個人資料。
