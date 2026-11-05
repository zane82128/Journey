# 協作方式

以繁體中文說明產品行為。使用者已授權依手機草圖開發本機行事曆，允許沿用同層 workout_calendar 的程式與資源；不要修改原專案。

- 先讀 README、docs/product/spec.md、docs/architecture/overview.md 與 docs/decisions/README.md。
- 優先保護資料；寫入成功才顯示成功。不要清除使用者的 localStorage 來處理錯誤。
- 主題、字型、圖示可參考原專案，訓練資料格式和外部回報服務不適用本專案。
- 修改產品行為時同步更新文件，執行 npm test、npm run build；涉及互動與版面時執行 npm run test:ui。
- 手機尺寸瀏覽器測試不等於實機驗收。不要把本機實作描述為已部署或已同步。
- 不自行推送、部署或建立遠端服務。

目前使用者已明確授權建立 `zane82128/Journey` 公開 repo、推送此專案並部署公開 GitHub Pages。此授權優先於上面的預設限制，不需再問相同公開範圍；先驗證 GitHub 帳號與既有遠端狀態，避免覆蓋同名 repo。連線狀態與交接見 docs/release/github-pages.md 和 docs/decisions/README.md。
