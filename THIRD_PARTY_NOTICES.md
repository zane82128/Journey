# 沿用來源與授權

依使用者在本次對話中授權，參考／複製同層 `../workout_calendar`：

- `src/fonts/fusion-pixel-tw.woff2`、`OFL.txt`、`LICENSES/`、字型 README：原樣複製。Fusion Pixel 與上游組件授權隨檔保留於 `src/fonts/`。
- `src/icons/ui.svg`：原樣複製，以 calendar、timer、plus、gear symbols 呈現圖示。保留原本未使用的 barbell symbol。
- `src/styles.css`：改寫原專案像素主題 token、Fusion Pixel 宣告、硬邊陰影與焦點處理；行事曆／底部導覽／響應式結構重新實作。
- `tools/preview.mjs`：改寫原本的安全相對路徑檢查及 HTTP 靜態檔案伺服器，改為獨立根目錄與 5174 埠。
- `src/storage.js`：沿用「重新讀取 → 副本修改 → 驗證 → 寫入成功才回報」的設計模式；使用獨立 key 與新行程資料模型，未複製訓練資料或服務端點。

本專案未替原專案程式碼宣告新的授權。公開散布前應由專案擁有者確認程式碼的授權政策。

Playwright 僅為開發依賴，其授權隨 npm 套件提供。
