# Journey · 像素行事曆

手機優先的像素行事曆，使用原生 JavaScript ES modules、CSS 與瀏覽器 localStorage。延續同層 `workout_calendar` 的 Fusion Pixel 繁中字型、羊皮紙／夜間配色與硬邊按鈕。

## 本機啟動

Windows 可雙擊 `start.cmd`，或在 PowerShell 執行：

```powershell
.\start.ps1
```

接著開啟 **http://127.0.0.1:5174/**。腳本會先建置，再啟動本機預覽；Ctrl+C 停止。可用 `./start.ps1 -Port 5180` 改埠號。

需要 Node.js 22+。腳本優先使用 PATH 中的 Node，找不到時會嘗試目前 Codex 安裝中的 Node runtime。一般開發環境可直接使用：

```sh
npm install
npm test
npm run build
npm run preview
```

執行程式及建置本身不需第三方套件；開發依賴 Playwright 用於瀏覽器驗收。

```sh
npx playwright install chromium
npm run test:ui
```

也可用已安裝的 Chrome：PowerShell 先執行 `$env:PLAYWRIGHT_CHANNEL='chrome'`。`npm run dev` 在 5175 埠直接預覽 `src/`，不啟用離線快取，避免與 5174 的建置版本快取混淆。請透過 HTTP 啟動，不要直接雙擊 `src/index.html`。

## 已實作

- 月曆日期與行程標記、所選日期清單；桌面左右分欄，手機上下排列。
- 週日期切換與單日時間軸、單日行程與到期待辦。
- 新增、編輯、刪除、全天、跨日、地點與備註。
- 每天／每週／每月重複與結束日。每月 31 日會略過沒有 31 日的月份。
- 待辦新增、編輯、勾選、刪除與排成行程。排程後仍可獨立勾選完成。
- 依標題／地點／備註、分類與一年內日期範圍搜尋。
- 分類名稱與顏色、深淺／系統主題、每週起始日與預設檢視。
- JSON 備份匯出與確認後匯入；無資料時可從設定載入可編輯的示範資料。
- App 開啟期間的頁內提醒、建置版離線快取與手動套用更新。
- 儲存錯誤保留輸入、格式錯誤阻擋覆寫、表單版本衝突提示。

## 邊界

資料只在相同網站來源（協定、主機、埠號）、相同瀏覽器中保存，不會與健身專案共用資料。切換 `localhost`／`127.0.0.1`、埠號或裝置後會是另一份儲存空間。請先匯出備份，再搬移資料。

重複行程的編輯／刪除套用**整個系列**；尚未提供單次例外、拖拉排程、雲端同步、Google 串接、ICS 匯入或共用行事曆。時間使用裝置的本地日期與時間，尚無跨時區行程模型。

提醒只在頁面持續執行時提示，關閉 App 後不推播；作業系統暫停背景分頁可能使提醒延誤。離線功能需首次連線載入完成，正式裝置的安裝能力仍需實機確認。

手機版已做桌面瀏覽器的觸控與尺寸模擬，尚未完成 Android／iOS 實機驗收。已發布公開 GitHub Pages，網址為 https://zane82128.github.io/Journey/ 。

## 檔案

```text
src/model.js       日期、重複行程、驗證與示範資料
src/storage.js     資料版本、交易與儲存錯誤
src/main.js        路由、表單、頁面與提醒
src/styles.css     手機優先像素介面與桌面分欄
src/sw.js          離線快取，建置時注入資源指紋
tools/             原生 Node 建置與預覽伺服器
tests/             日期／儲存單元測試與瀏覽器操作驗收
docs/              產品、架構、決策與驗收紀錄
```

測試截圖與 JSON 結果放在 `test-results/`，不納入 Git。授權與沿用來源見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## GitHub 與部署

已準備手動 GitHub Pages 部署流程，發布前會先執行全部檢查，再發布同一份已驗證產物。公開 repo：https://github.com/zane82128/Journey ，網站：https://zane82128.github.io/Journey/ 。設定與操作見 [GitHub Pages 部署說明](docs/release/github-pages.md)。
