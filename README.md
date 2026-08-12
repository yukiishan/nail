# 珊的美甲紀錄

一個部署在 GitHub Pages 的美甲紀錄網頁，資料存在 Google 試算表，圖片存在 Google 雲端硬碟。

```
你的瀏覽器 (GitHub Pages 網頁)
        │  fetch()
        ▼
Google Apps Script（Web App，免費、當作 API 橋接）
        │
        ├─► Google 試算表（存文字資料）
        └─► Google 雲端硬碟（存圖片，回傳圖片網址存回試算表）
```

因為 GitHub Pages 只能放靜態網頁，沒有伺服器可以直接安全地呼叫 Google Sheets API（會曝露金鑰），
所以用 **Google Apps Script 部署成 Web App** 當作免費的中介 API，前端只呼叫這個網址即可。

---

## 檔案結構

```
nail-journal/
├── index.html          網頁主體
├── style.css            樣式
├── app.js                前端邏輯（金額千分位、圖片壓縮上傳、串接 API）
├── config.js             填入你的 Apps Script 網址
└── apps-script/
    └── Code.gs           貼到 Google Apps Script 的後端程式
```

---

## 第一步：建立 Google 試算表

1. 前往 [Google 試算表](https://sheets.google.com)，新增一個空白試算表，命名為「美甲紀錄」。
2. 把工作表（分頁）改名為 `紀錄`（Apps Script 程式碼裡預設抓這個名字，也可以自行修改 `Code.gs` 裡的 `SHEET_NAME`）。
3. 標題列可以不用手動輸入，第一次執行時程式會自動幫你建立：

   | 日期 | 款式金額(NTD) | 卸甲金額(NTD) | 優惠/特殊費用(NTD) | 總額(NTD) | 參考款式圖片 | 施作款式圖片 |
   |---|---|---|---|---|---|---|

4. 複製網址列上的 **試算表 ID**：
   `https://docs.google.com/spreadsheets/d/`**`這一段就是SHEET_ID`**`/edit`

---

## 第二步：建立 Google 雲端硬碟資料夾（存圖片用）

1. 在 [Google 雲端硬碟](https://drive.google.com) 新增一個資料夾，例如「美甲紀錄圖片」。
2. 打開資料夾，複製網址中的 **資料夾 ID**：
   `https://drive.google.com/drive/folders/`**`這一段就是FOLDER_ID`**

---

## 第三步：部署 Google Apps Script

1. 在剛剛建立的試算表中，點選上方選單 **擴充功能 → Apps Script**。
2. 把跳出的編輯器裡原本的 `Code.gs` 內容全部刪除，貼上專案裡 `apps-script/Code.gs` 的內容。
3. 把檔案最上方這兩行換成你自己的 ID：
   ```js
   const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';   // 第一步拿到的試算表 ID
   const FOLDER_ID = 'YOUR_DRIVE_FOLDER_ID';  // 第二步拿到的資料夾 ID
   ```
4. 點選右上角 **部署 → New deployment（新增部署作業）**。
   - 類型選 **Web app（網頁應用程式）**
   - Execute as（執行身分）：**Me（我）**
   - Who has access（誰可以存取）：**Anyone（任何人）**
   - 點 **Deploy（部署）**
5. 第一次部署會要求你「授權」，選擇你自己的 Google 帳號 → 若跳出「未驗證應用程式」畫面，點選
   **Advanced（進階）→ Go to (專案名稱) (unsafe)** → Allow，這是正常的（因為是你自己寫的程式，還沒送 Google 審核）。
6. 部署完成後會拿到一個網址，長得像：
   ```
   https://script.google.com/macros/s/AKfycb.......narlong/exec
   ```
   這就是你的 **API_URL**，複製起來。

> ⚠️ 之後如果修改了 `Code.gs` 的內容，記得要「管理部署作業 → 編輯 → 新版本」重新部署，網址才會套用新程式碼。

---

## 第四步：設定前端

打開專案裡的 `config.js`，把網址換成你剛剛拿到的那個：

```js
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/你的部署ID/exec"
};
```

---

## 第五步：部署到 GitHub Pages

1. 在 GitHub 建立一個新的 Repository（例如 `nail-journal`）。
2. 把整個 `nail-journal` 資料夾內容（`index.html`、`style.css`、`app.js`、`config.js`）上傳到 Repository 根目錄。
   （`apps-script/Code.gs` 不需要上傳到 GitHub，那份是給 Google Apps Script 用的，放著參考即可，或另外收在私人資料夾。）
3. 進入 Repository 的 **Settings → Pages**：
   - Source 選擇 `Deploy from a branch`
   - Branch 選擇 `main`，資料夾選 `/root`
   - 儲存後等 1–2 分鐘，會出現網址，例如：
     `https://你的帳號.github.io/nail-journal/`
4. 打開這個網址，就可以開始使用了！

---

## 功能說明

- **新增紀錄**：輸入日期、款式金額、卸甲金額、優惠/特殊費用（輸入時自動加上千分位逗點），總額會即時自動加總並顯示千分位。
- **上傳圖片**：分別上傳「參考款式」與「施作款式」兩張圖，會在瀏覽器端先壓縮（最長邊 1400px），再以 base64 傳給 Apps Script 存進 Google 雲端硬碟，並把圖片網址寫回試算表。
- **時間軸**：下方會列出所有歷史紀錄（新到舊排序），點圖片可放大檢視。
- **重新整理**：右上角圓形按鈕可手動重新抓取試算表最新資料。

## 常見問題

**Q: 送出後畫面顯示「儲存失敗」？**
確認：`config.js` 的網址是否貼對、Apps Script 部署時 Access 是否選了「Anyone（任何人）」、`SHEET_ID`／`FOLDER_ID` 是否填對。

**Q: 圖片上傳很久或失敗？**
單張圖片 base64 後大小建議在 5–8MB 內（app.js 已自動壓縮到最長邊 1400px、JPEG 品質 0.82，一般狀況已足夠）。若手機端超大解析度照片仍失敗，可在 `app.js` 的 `fileToCompressedBase64` 把 `maxDim` 調更小或 `quality` 調更低。

**Q: 想自己再加欄位（例如美甲師、店家）怎麼辦？**
在 `Code.gs` 的 `HEADERS` 陣列加欄位、`doPost` 的 `appendRow` 加對應值，並在 `index.html` / `app.js` 加對應輸入欄位與顯示欄位即可。
