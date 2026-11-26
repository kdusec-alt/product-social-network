# 測試環境與公司內網交接

管理者可在右上角帳號選單點「儲存用量」，查看物件與資料庫容量。

目前主程式與資料存取介面相同，提供兩個執行環境：Cloudflare Worker + D1，以及 Node.js + 本機 SQLite。後者不需要 Cloudflare 或 Google 帳號。內網 SQL Server / MySQL / PostgreSQL 不等同 SQLite，若公司指定其他資料庫，需另外轉換查詢與儲存層。

## 啟動內網版

1. 安裝 Node.js 22.13+（建議受支援的 Node.js 24），下載此 GitHub 儲存庫。下列命令均在儲存庫根目錄執行。
2. `npm run build`。不需要下載 npm 套件。
3. 將 `.env.example` 複製為私有 `.env`，填入 `DEMO_PASSWORD` 與 `DEMO_PROFILES_JSON`。四帳號 JSON 可設為：

```json
{"tino":["Tino","PM","admin"],"tino1":["Tino 1","DCC","member"],"tino2":["Tino 2","PED","member"],"tino3":["Tino 3","QM","member"]}
```

所有帳號目前共用 `DEMO_PASSWORD`；這是展示測試登入機制。公司正式使用前，應由 IT 決定企業登入或每人獨立密碼機制。Microsoft 365 按鈕保留原專案的待串接提示，未宣稱已支援 SSO。

4. `node --env-file=.env scripts/server.mjs`。
5. 本機開啟 `http://localhost:3000`。預設僅監聽 127.0.0.1；對公司同仁開放時，交由內網 HTTPS 反向代理轉送至此埠，並設定 `PUBLIC_ORIGIN=https://實際內網網址`。Cookie 保持 Secure；不能用一般內網 IP 的明文 HTTP 取代 HTTPS。

預設 SQLite 在 `data/product-social-network.sqlite`。可透過 `DATA_DIR`、`HOST`、`PORT` 調整。伺服器自動按檔名套用 `drizzle/*.sql`，並記錄已套用項目；物件表在首次使用時建立。不要把同一 SQLite 檔案放在網路共享磁碟供多個伺服器同時寫入。

## 保留及搬遷測試資料

- 從 D1 匯出完整 SQL（包含 `storage_objects`、`storage_usage` 與觸發器）；匯出內容包含使用者及附件資料，僅限私下交接，不推送公開 GitHub。
- 停止內網伺服器，使用 SQLite 工具將匯出 SQL 匯入新的 `.sqlite` 檔，再啟動伺服器。首次搬遷先用複本驗證，不覆蓋唯一備份。
- 內網建立全新空資料庫時不需要搬雲端測試資料；啟動會自動建表。
- 遷移後建議清除 `demo_sessions`，要求重新登入；逐項核對貼文、留言、檢核表、成員、聊天、照片及下載。
- 內網備份用 SQLite backup API，或先停站再備份完整資料目錄（WAL 運行中不要只複製主資料庫檔）。

## 範圍

D1 物件層採 1 MiB 單項、300 MiB 總量及 400 MiB 頁面用量寫入保護，適合小型展示與 debug。這些不是伺服器硬碟極限；正式環境需由 IT 評估容量、備份、多使用者同時寫入及身分認證。GitHub 是程式主來源，不是使用者資料儲存位置。
