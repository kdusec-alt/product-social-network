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

需要 Cloudflare D1 綁定 `DB`、R2 綁定 `BUCKET`，依序套用 `drizzle/0000_paleonet.sql` 至 `0002_direct_messages.sql`。`.openai/hosting.json` 保留 Sites 專案識別與綁定設定，沒有密鑰。

由執行環境安全設定 `OWNER_EMAIL` 與選用的 `OWNER_NAME`。帳號密碼登入需設定 `DEMO_PASSWORD` 與 `DEMO_PROFILES_JSON`（帳號對應 `[顯示名稱,單位,角色]` 的 JSON）；預設無帳號亦無密碼。請勿將真實值提交。`.env.example` 僅列設定名稱；Worker 不會自行載入此檔。

`oai-authenticated-user-*` 標頭由 Sites 身分驗證閘道提供。移至其他平台時必須在可信任的驗證閘道中建立這些標頭，不能直接信任外部訪客傳入的值。

## 功能與資料範圍

保留多語介面、動態牆、標註、照片與附件、Outlook MSG 匯入、型體就緒與檢核、搜尋、通知、知識庫、個人檔案、聊天、成員與報告等原始碼。原有 Microsoft 365 按鈕仍保留原專案的待串接提示。

固定密碼改為執行環境設定；管理員與測試個資改為匿名設定或測試資料；預載貼文、郵件及人員清單已清空。未匯出正式資料庫、R2 上傳檔、使用者資料、會話或舊 Git 歷史。匯出後僅執行本機建置測試，沒有部署或更動 Sites 正式站。
