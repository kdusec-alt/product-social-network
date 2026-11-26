# Product Social Network

Sites 專案完整原始碼匯出，來源提交 `e1e0c9a597746f7ae740de925a5852e8d5daf86b`。此儲存庫不觸發正式站部署。

## 建置與測試

需要 Node.js 22.13 以上，無外部套件依賴。

```sh
npm run build
npm test
```

`worker/` 是 Cloudflare Worker API；`ui/` 是主要入口；`classic/` 保留原工作台所有模組與圖像；`drizzle/` 是資料庫結構；`tests/` 是記憶體資料庫整合測試。建置結果在 `dist/server/`，可由原始碼重新產生。

## 執行環境

需要 Cloudflare D1 綁定 `DB`；沒有 R2 `BUCKET` 時自動使用 D1 儲存層，依序套用 `drizzle/0000_paleonet.sql` 至 `0002_direct_messages.sql`。`.openai/hosting.json` 保留 Sites 專案識別與綁定設定，沒有密鑰。

由執行環境安全設定 `OWNER_EMAIL` 與選用的 `OWNER_NAME`。帳號密碼登入需設定 `DEMO_PASSWORD` 與 `DEMO_PROFILES_JSON`（帳號對應 `[顯示名稱,單位,角色]` 的 JSON）；預設無帳號亦無密碼。請勿將真實值提交。`.env.example` 僅列設定名稱；Worker 不會自行載入此檔。

`oai-authenticated-user-*` 標頭預設不採信，避免離開 Sites 後訪客偽造身分。只有仍位於可信任的 Sites 身分閘道時才能設定 `TRUST_SITES_HEADERS=true`。Cloudflare 獨立站與內網版本均使用伺服器驗證的登入 Cookie。

## 功能與資料範圍

保留多語介面、動態牆、標註、照片與附件、Outlook MSG 匯入、型體就緒與檢核、搜尋、通知、知識庫、個人檔案、聊天、成員與報告等原始碼。原有 Microsoft 365 按鈕仍保留原專案的待串接提示。

固定密碼改為執行環境設定；管理員與測試個資改為匿名設定或測試資料；預載貼文、郵件及人員清單已清空。未匯出正式資料庫、R2 上傳檔、使用者資料、會話或舊 Git 歷史。匯出後僅執行本機建置測試，沒有部署或更動 Sites 正式站。


## 免費測試儲存與內網交接

不需訂閱 R2 或接入 Google Drive。未綁定 R2 時，個人檔案、知識標記、共用貼文／型體、照片與聊天附件均存入 D1 的 `storage_objects`；首次使用會自動建立儲存表及容量觸發器，保留原有 SQL 資料。若已綁定 R2，繼續使用原 R2；兩種模式不自動搬資料。

- 每個物件（附件或 JSON 記錄）最多 **1 MiB**；過大時回傳 413，不靜默截斷。現有 8 MB 前端檢查仍可保留，但 D1 儲存層的限制優先。
- 物件內容、名稱與 metadata 總量最多 **300 MiB**，使用 SQLite 觸發器原子計帳。
- SQLite 檔案頁面用量達 **400 MiB** 時，停止新的物件寫入，保留 SQL 資料與索引空間。此保護僅涵蓋物件儲存，不是整個資料庫所有寫入的硬上限；仍須留意 D1 500 MB 及每日讀寫額度。
- 管理者登入後可開啟 `/api/storage` 查看用量；此介面不列出使用者內容。
- 成員頁顯示 `tino`、`tino1`、`tino2`、`tino3`；帳號仍由 Cloudflare 私密環境變數設定。既有其他帳號資料不刪除。

內網部署、備份與交接方式見 [docs/intranet.md](docs/intranet.md)。
