# GitHub repo 與部署

## 本輪準備狀態

2026-11-05 已確認 GitHub 帳號為 `zane82128`，建立公開 repo 並推送 main，Pages 來源設為 GitHub Actions。

- 原始碼：https://github.com/zane82128/Journey
- 正式網站：https://zane82128.github.io/Journey/
- 首次發布提交：`38d068467b4b80c2bd2d2ffad167ad15c94d2b45`
- 部署紀錄：https://github.com/zane82128/Journey/actions/runs/42036589221
- verify / check 與 deploy 均成功；CI 已執行 npm ci、npm test、npm run build、產物檢查及 npm run test:ui。正式網址已開啟確認月曆與字型呈現。
- 本機亦通過 17 項單元測試及 26 項瀏覽器檢查。手機實機、正式來源的 CRUD 與離線人工驗收仍待完成，不等同已驗收。
- Actions 顯示既有 action 的 Node 20 棄用提示，但此次作業成功；後續維護應更新 action 版本。

## 一次設定

1. 完成 GitHub 帳號連線，確認擁有者及 repo 的公開／私有設定。
2. 建立空 repo `Journey`，將本機 `main` 推送為初始版本。
3. 在 GitHub repo 的 Settings → Pages 將發布來源設為 GitHub Actions。
4. 在 Actions 選擇 Deploy GitHub Pages，從 main 手動執行。
5. 等 verify 與 deploy 都通過後，打開部署作業回報的 page_url；此時才能記為已部署。

GitHub Free 的 Pages 以公開 repo 為前提；其他方案是否支援私有 repo，依帳號實際方案確認。Pages 網站的可見性與原始碼 repo 可見性須分別確認，不將私有 repo 誤認成私人網站。

## 檢查與發布

`check.yml` 可被 push、PR 或部署 workflow 呼叫，依序執行：

1. `npm ci`、`npm test`。
2. `npm run build` 與 `npm run check:artifact`。
3. 安裝 Chromium，在 `/Journey/` 子路徑執行完整瀏覽器驗收。
4. 只有全部通過才上傳 `verified-dist-<commit SHA>`；截圖則無論成功失敗都保留。

`deploy.yml` 只接受 main 的手動執行。部署工作下載同一次執行的已驗證 artifact，再交給 Pages；不在發布時另建另一份 dist。部署權限限該作業使用 pages:write 與 id-token:write。

## 本機模擬 Pages

```powershell
npm run build
npm run check:artifact
$env:PLAYWRIGHT_CHANNEL='chrome'
$env:TEST_BASE_PATH='/Journey/'
npm run test:ui
```

也可用 `$env:BASE_PATH='/Journey/'` 後執行 `npm run preview`，開啟 `http://127.0.0.1:5174/Journey/`。請使用未被占用的埠，或先停止舊預覽。

## 上線後人工驗收

- 檢查實際回報的網址、行動版版面、字型、月曆與表單。
- 新增一筆測試行程，重載後仍存在，再刪除測試資料。
- 首次完整載入後斷網重載，確認離線啟動。
- 在 Android／iOS 實機檢查軟鍵盤、底部安全區與主畫面安裝。

上線網址與本機來源不同，瀏覽器資料不會自動搬移；需要時從本機匯出 JSON，再到正式站點匯入。部署只發布程式，不上傳 localStorage 裡的行程。

官方依據：
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
