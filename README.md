# AI 客戶管理系統

以業務人員日常工作為核心的個人 AI CRM：打開就知道今天該聯絡誰、該說什麼，做完一鍵記錄。每位業務只看得到自己的客戶。

## 主要功能

- **今日工作台**：依「逾期 → 今天到期 → 客戶變冷（14 天未聯絡）→ 未設下一步」與加權金額排序，一鍵完成 / 延後 / 設定行動，並可取得 AI 一句話建議。
- **Gmail 整合**
  - 客戶頁顯示與該客戶的往來郵件（收到 / 寄出），可一鍵記錄或「AI 摘要並記錄」（同時建議下一步）
  - AI 草擬的郵件可檢視、修改後直接用 Gmail 寄出，並自動記錄
  - 智慧建檔可直接從最近的 Gmail 收件匣挑選郵件建立客戶
- **AI 助理**：串流回覆、可停止 / 重試；建議下一步可一鍵套用，回覆可存成備註。
- **快速記錄**：語音輸入、「AI 整理」把零散筆記整理成互動摘要並建議下一步、新痛點與競爭對手。
- **客戶管理**：列表 / 看板（觸控裝置可用選單移動階段）、搜尋、篩選、批次操作、刪除可復原、結案時詢問原因。
- **儀表板**：加權預測、成交率、階段轉換率與停留天數、每週活動量、成交 / 流失原因與 AI 規律分析。
- **跟進不漏接**：記錄互動後立即詢問下一步（明天／3 天後／下週）；下一步可一鍵加入 Google 日曆或下載 .ics；可開啟每日桌面到期提醒，分頁標題顯示待辦數。
- **互動記錄**：可編輯、刪除（可復原）。
- **匯入**：CSV／Excel（另存 CSV）匯入客戶，支援中英文欄位名稱、匯入前預覽、逐列錯誤說明與自動略過重複；新增客戶時偵測可能重複。
- **資料**：雲端模式存於 Supabase（自動儲存，失敗可重試）；可匯出 JSON / CSV、匯入備份；登入後可把先前存在瀏覽器的資料上傳。
- 繁中 / 英文、深色模式、手機底部導覽、鍵盤快捷鍵（`N` 新增、`/` 搜尋、`L` 記錄、`1/2/3` 切換頁面、`?` 說明）。

## 架構

```
瀏覽器（React, Vercel 靜態托管）
 ├─ 客戶資料 → Supabase（Row Level Security：只能存取自己的資料）
 └─ /api/*  → Vercel Functions（server/）
       ├─ /api/ai              Gemini 代理（驗證登入、每日用量上限）
       ├─ /api/google/connect  儲存 / 查詢 / 中斷 Gmail 授權
       └─ /api/gmail/*         讀取往來郵件、寄信
```

- 所有金鑰（Gemini、Google client secret、Supabase service role）只存在伺服器端。
- Google refresh token 存在 `google_tokens` 表，瀏覽器端無任何讀取權限。
- 未設定 Supabase 時為「本機模式」：不需登入、資料存於瀏覽器，適合試用與開發。

## 部署步驟

### 1. Supabase
1. 建立專案，於 SQL Editor 依序執行 `supabase/migrations/` 內的檔案（或 `supabase db push`）。
2. Authentication → Providers：啟用 Email；啟用 Google（填入步驟 2 的 Client ID / Secret）。
3. Authentication → URL Configuration：Site URL 設為正式網址，Redirect URLs 加入正式網址與 `http://localhost:3000`。
4. 若要讓 Email 帳號之後再連結 Gmail：Authentication → 啟用 **Manual linking**。

### 2. Google Cloud
1. 建立 OAuth 用戶端（Web application），Authorized redirect URI 填 `https://<專案>.supabase.co/auth/v1/callback`。
2. 啟用 **Gmail API**。
3. OAuth 同意畫面加入 scope：`gmail.readonly`、`gmail.send`。
   - 這兩個屬於 Google 的「受限範圍」：測試模式下最多 100 位測試使用者（需加入名單）；對外公開需通過 Google 驗證。

### 3. Vercel
1. 匯入此 repo（Framework：Vite）。
2. 依 `.env.example` 設定環境變數（`VITE_*` 為前端公開值，其餘僅伺服器端）。
3. 部署。`vercel.json` 已設定函式執行時間與安全標頭。

## 本機開發

```bash
npm install
cp .env.example .env.local   # 填入金鑰；VITE_SUPABASE_* 留空即為本機模式
npm run dev                  # http://localhost:3000（/api 由 Vite 伺服器提供）
```

| 指令 | 用途 |
|---|---|
| `npm run check` | lint + 型別檢查 + 測試 + 建置（CI 同樣執行） |
| `npm test` | 單元測試（含以 PGlite 驗證資料庫 RLS） |
