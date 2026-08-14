/* ============================================================
   珊的美甲紀錄 - 前端邏輯 (v4)
   ============================================================ */

/* ---------- 登入驗證 ---------- */
const SESSION_KEY = 'nailjournal_auth';
const TOKEN_KEY = 'nailjournal_token';
const LOGIN_TIME_KEY = 'nailjournal_login_time';
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 小時

let TOKEN = sessionStorage.getItem(TOKEN_KEY) || '';
let _expiryHandled = false;
let _heartbeatTimer = null;

function _updatePwDots() {
  const len = document.getElementById('pwInput').value.length;
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('pwDot' + i);
    if (dot) dot.classList.toggle('filled', len > 0);
  }
}

async function doLogin() {
  const input = document.getElementById('pwInput');
  const err = document.getElementById('loginErr');
  const pw = input.value.trim();
  if (!pw) return;
  err.textContent = '驗證中…';
  input.disabled = true;
  try {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'login', pw }),
    });
    const json = await res.json();
    if (json.ok) {
      TOKEN = json.token;
      sessionStorage.setItem(SESSION_KEY, '1');
      sessionStorage.setItem(TOKEN_KEY, TOKEN);
      sessionStorage.setItem(LOGIN_TIME_KEY, String(Date.now()));
      startTokenHeartbeat();
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      loadRecords();
    } else {
      err.textContent = json.error || '密碼錯誤';
      input.value = ''; _updatePwDots(); input.focus();
      setTimeout(() => { err.textContent = ''; }, 3000);
    }
  } catch (e) {
    err.textContent = '連線失敗，請確認網路';
    setTimeout(() => { err.textContent = ''; }, 3000);
  } finally {
    input.disabled = false;
  }
}

function _checkSessionExpiry() {
  if (!TOKEN || !sessionStorage.getItem(SESSION_KEY)) return;
  const loginTime = Number(sessionStorage.getItem(LOGIN_TIME_KEY) || 0);
  if (!loginTime) return;
  if (Date.now() - loginTime >= SESSION_TTL_MS) _handleTokenExpiry();
}

function startTokenHeartbeat() {
  stopTokenHeartbeat();
  const loginTime = Number(sessionStorage.getItem(LOGIN_TIME_KEY) || 0);
  if (!loginTime) return;
  if (Date.now() - loginTime >= SESSION_TTL_MS) { _handleTokenExpiry(); return; }
  _heartbeatTimer = setInterval(_checkSessionExpiry, 60 * 1000);
  document.addEventListener('visibilitychange', _onVisibilityChange);
}

function stopTokenHeartbeat() {
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
  document.removeEventListener('visibilitychange', _onVisibilityChange);
}

function _onVisibilityChange() {
  if (document.visibilityState === 'visible') _checkSessionExpiry();
}

function _handleTokenExpiry() {
  if (_expiryHandled) return;
  _expiryHandled = true;
  stopTokenHeartbeat();
  TOKEN = '';
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(LOGIN_TIME_KEY);
  const ls = document.getElementById('loginScreen');
  if (ls) ls.style.cssText = 'display:flex!important';
  const app = document.getElementById('app');
  if (app) app.style.display = 'none';
  const err = document.getElementById('loginErr');
  if (err) err.textContent = '登入已過期，請重新登入';
  setTimeout(() => {
    const pw = document.getElementById('pwInput');
    if (pw) { pw.value = ''; pw.focus(); }
    _expiryHandled = false;
  }, 100);
}

/* ---------- 工具函式 ---------- */
function formatThousands(num) {
  const n = Math.round(Number(num) || 0);
  return n.toLocaleString('en-US');
}
function parseMoney(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/[^0-9-]/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}
function bindMoneyInput(el, onChange) {
  el.addEventListener('input', () => {
    const raw = parseMoney(el.value);
    const caretAtEnd = el.selectionStart === el.value.length;
    el.value = raw === 0 && el.value.trim() === '' ? '' : formatThousands(raw);
    if (caretAtEnd) { const len = el.value.length; el.setSelectionRange(len, len); }
    onChange && onChange();
  });
}
function fileToCompressedBase64(file, maxDim = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function fileToRawBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function formatDate(val) {
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}
// 幫 Google 圖片網址加上縮圖尺寸參數，大幅縮小手機載入時的資料量
function thumbUrl(url) {
  if (!url || !url.includes('lh3.googleusercontent.com')) return url;
  return url + '=w300';
}

// 讀取用（GET）：安全可重試，自動帶入 Token。加上時間戳記避免瀏覽器快取舊回應；
// 若解析失敗（常見於行動裝置瀏覽器對 Google 服務的暫時性回應異常），自動重試一次。
async function fetchJsonRetry(url, options = {}) {
  const sep = url.includes('?') ? '&' : '?';
  const finalUrl = url + sep + 'token=' + encodeURIComponent(TOKEN) + '&_ts=' + Date.now();
  const doFetch = async () => {
    const res = await fetch(finalUrl, { ...options, cache: 'no-store' });
    return await res.json();
  };
  let json;
  try {
    json = await doFetch();
  } catch (e) {
    await new Promise(r => setTimeout(r, 900));
    try {
      json = await doFetch();
    } catch (e2) {
      throw new Error('伺服器回應異常，已自動重試一次仍失敗。請稍後再重新整理一次看看。');
    }
  }
  if (json && json.code === 'INVALID_TOKEN') { _handleTokenExpiry(); throw new Error('AUTH_EXPIRED'); }
  return json;
}

// 寫入用（POST：新增/編輯/刪除/備份/還原）：自動帶入 Token，絕不自動重試，
// 因為如果第一次其實已經寫入成功、只是回應解析失敗，重試會造成重複寫入（例如新增變兩筆）。
// 解析失敗時只回報錯誤，請使用者自行重新整理確認資料狀態，避免誤判而重複送出。
async function fetchJsonOnce(payload) {
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    cache: 'no-store',
    body: JSON.stringify({ ...payload, token: TOKEN }),
  });
  let json;
  try {
    json = await res.json();
  } catch (e) {
    throw new Error('伺服器回應異常，無法確認這次操作是否成功。請重新整理頁面確認資料狀態，避免重複送出，再視情況重新操作一次。');
  }
  if (json && json.code === 'INVALID_TOKEN') { _handleTokenExpiry(); throw new Error('AUTH_EXPIRED'); }
  return json;
}

/* ---------- 分頁切換（同步頂部分頁與底部導覽列） ---------- */
const tabBtns = document.querySelectorAll('.tab-btn');
const bnBtns = document.querySelectorAll('.bn-btn');
const panels = document.querySelectorAll('.panel');
function switchTab(name) {
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  bnBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  panels.forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
  window.scrollTo({ top: 0, behavior: 'auto' });
}
tabBtns.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
bnBtns.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

/* ---------- 狀態 ---------- */
const state = {
  editing: false,
  editRowIndex: null,
  refImages: [],         // 陣列: { kind:'existing', url } 或 { kind:'new', data, name }
  actImages: [],         // 陣列: { kind:'existing', url } 或 { kind:'new', data, name }
  videos: [],            // 陣列: { kind:'existing', url } 或 { kind:'new', data, name }
};
let allRecords = [];

/* ---------- DOM refs ---------- */
const fDate = document.getElementById('fDate');
const fDateDisplay = document.getElementById('fDateDisplay');
const dateDisplayBox = document.getElementById('dateDisplayBox');
const fPart = document.getElementById('fPart');
const fStyle = document.getElementById('fStyle');
const fRemove = document.getElementById('fRemove');
const fDiscount = document.getElementById('fDiscount');
const fTotal = document.getElementById('fTotal');
const entryForm = document.getElementById('entryForm');
const submitBtn = document.getElementById('submitBtn');
const submitBtnText = document.getElementById('submitBtnText');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const formMsg = document.getElementById('formMsg');
const formModeTag = document.getElementById('formModeTag');
const formModeTitle = document.getElementById('formModeTitle');
const backBtn = document.getElementById('backBtn');
const backupBtnList = document.getElementById('backupBtnList');
const backupBtnTimeline = document.getElementById('backupBtnTimeline');

const refDrop = document.getElementById('refDrop');
const fRefImg = document.getElementById('fRefImg');
const refThumbGrid = document.getElementById('refThumbGrid');

const actDrop = document.getElementById('actDrop');
const fActImg = document.getElementById('fActImg');
const actThumbGrid = document.getElementById('actThumbGrid');

const videoDrop = document.getElementById('videoDrop');
const fVideo = document.getElementById('fVideo');
const videoListGrid = document.getElementById('videoListGrid');

const recordTableBody = document.getElementById('recordTableBody');
const mobileList = document.getElementById('mobileList');
const emptyStateList = document.getElementById('emptyStateList');
const refreshBtnList = document.getElementById('refreshBtnList');
const filterRowList = document.getElementById('filterRowList');
const filterRowTimeline = document.getElementById('filterRowTimeline');
const restoreBtnList = document.getElementById('restoreBtnList');
const restorePanelList = document.getElementById('restorePanelList');
const restoreSelectList = document.getElementById('restoreSelectList');
const restoreConfirmList = document.getElementById('restoreConfirmList');
const restoreCancelList = document.getElementById('restoreCancelList');

const restoreBtnTimeline = document.getElementById('restoreBtnTimeline');
const restorePanelTimeline = document.getElementById('restorePanelTimeline');
const restoreSelectTimeline = document.getElementById('restoreSelectTimeline');
const restoreConfirmTimeline = document.getElementById('restoreConfirmTimeline');
const restoreCancelTimeline = document.getElementById('restoreCancelTimeline');

let filterPart = ''; // '' | '手' | '足'

const timeline = document.getElementById('timeline');
const emptyStateTimeline = document.getElementById('emptyStateTimeline');
const refreshBtnTimeline = document.getElementById('refreshBtnTimeline');

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');

fDate.value = new Date().toISOString().slice(0, 10);

/* ---------- 自訂日期顯示框（與隱藏的原生 input 同步） ---------- */
function updateDateDisplay() {
  if (!fDate.value) { fDateDisplay.textContent = '請選擇日期'; return; }
  const d = new Date(fDate.value + 'T00:00:00');
  fDateDisplay.textContent = `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`;
}
fDate.addEventListener('change', updateDateDisplay);
fDate.addEventListener('focus', () => dateDisplayBox.classList.add('focused'));
fDate.addEventListener('blur', () => dateDisplayBox.classList.remove('focused'));
updateDateDisplay();

/* ---------- 金額即時千分位 + 自動加總 ---------- */
function recalcTotal() {
  const total = parseMoney(fStyle.value) + parseMoney(fRemove.value) + parseMoney(fDiscount.value);
  fTotal.textContent = formatThousands(total);
}
bindMoneyInput(fStyle, recalcTotal);
bindMoneyInput(fRemove, recalcTotal);
bindMoneyInput(fDiscount, recalcTotal);

const discountSignBtn = document.getElementById('discountSignBtn');
discountSignBtn.addEventListener('click', () => {
  const raw = parseMoney(fDiscount.value);
  if (raw === 0) return;
  fDiscount.value = formatThousands(-raw);
  recalcTotal();
});

/* ---------- 參考款式（多圖） ---------- */
fRefImg.addEventListener('change', async () => {
  const files = Array.from(fRefImg.files || []);
  if (!files.length) return;
  const processingItem = document.createElement('div');
  processingItem.className = 'thumb-item thumb-processing';
  processingItem.innerHTML = `<span class="dz-processing">處理中…</span>`;
  refThumbGrid.appendChild(processingItem);
  try {
    for (const file of files) {
      const data = await fileToCompressedBase64(file);
      state.refImages.push({ kind: 'new', data, name: file.name });
    }
  } catch (err) {
    alert('圖片讀取失敗：' + err.message);
  }
  fRefImg.value = '';
  renderRefThumbs();
});
function renderRefThumbs() {
  refThumbGrid.innerHTML = '';
  state.refImages.forEach((img, idx) => {
    const src = img.kind === 'existing' ? img.url : img.data;
    const div = document.createElement('div');
    div.className = 'thumb-item';
    div.innerHTML = `<img src="${src}" alt="參考款式 ${idx + 1}"><button type="button" class="thumb-remove" data-idx="${idx}">✕</button>`;
    refThumbGrid.appendChild(div);
  });
  refThumbGrid.querySelectorAll('.thumb-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      state.refImages.splice(Number(btn.dataset.idx), 1);
      renderRefThumbs();
    });
  });
}

/* ---------- 施作款式（多圖） ---------- */
fActImg.addEventListener('change', async () => {
  const files = Array.from(fActImg.files || []);
  if (!files.length) return;
  const processingItem = document.createElement('div');
  processingItem.className = 'thumb-item thumb-processing';
  processingItem.innerHTML = `<span class="dz-processing">處理中…</span>`;
  actThumbGrid.appendChild(processingItem);
  try {
    for (const file of files) {
      const data = await fileToCompressedBase64(file);
      state.actImages.push({ kind: 'new', data, name: file.name });
    }
  } catch (err) {
    alert('圖片讀取失敗：' + err.message);
  }
  fActImg.value = '';
  renderActThumbs();
});
function renderActThumbs() {
  actThumbGrid.innerHTML = '';
  state.actImages.forEach((img, idx) => {
    const src = img.kind === 'existing' ? img.url : img.data;
    const div = document.createElement('div');
    div.className = 'thumb-item';
    div.innerHTML = `<img src="${src}" alt="施作款式 ${idx + 1}"><button type="button" class="thumb-remove" data-idx="${idx}">✕</button>`;
    actThumbGrid.appendChild(div);
  });
  actThumbGrid.querySelectorAll('.thumb-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      state.actImages.splice(Number(btn.dataset.idx), 1);
      renderActThumbs();
    });
  });
}

/* ---------- 施作影片（多支） ---------- */
fVideo.addEventListener('change', async () => {
  const files = Array.from(fVideo.files || []);
  if (!files.length) return;

  const oversized = files.filter(f => f.size > 45 * 1024 * 1024);
  const okFiles = files.filter(f => f.size <= 45 * 1024 * 1024);
  if (oversized.length) {
    showMsg(`有 ${oversized.length} 支影片超過 45MB 已略過，請先壓縮後再上傳。`, 'error');
  }
  if (!okFiles.length) { fVideo.value = ''; return; }

  const processingChip = document.createElement('div');
  processingChip.className = 'video-chip';
  processingChip.innerHTML = `<span class="dz-processing">處理中…</span>`;
  videoListGrid.appendChild(processingChip);

  try {
    for (const file of okFiles) {
      const data = await fileToRawBase64(file);
      state.videos.push({ kind: 'new', data, name: file.name });
    }
  } catch (err) {
    alert('影片讀取失敗：' + err.message);
  }
  fVideo.value = '';
  renderVideoList();
});

function renderVideoList() {
  videoListGrid.innerHTML = '';
  state.videos.forEach((v, idx) => {
    const name = v.kind === 'existing' ? (v.url.split('/').pop() || `影片 ${idx + 1}`) : v.name;
    const chip = document.createElement('div');
    chip.className = 'video-chip';
    chip.innerHTML = `<span class="vc-icon">🎬</span><span class="vc-name">${name}</span><button type="button" class="vc-remove" data-idx="${idx}">✕</button>`;
    videoListGrid.appendChild(chip);
  });
  videoListGrid.querySelectorAll('.vc-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      state.videos.splice(Number(btn.dataset.idx), 1);
      renderVideoList();
    });
  });
}

/* ---------- 表單模式：新增 / 編輯 ---------- */
function enterEditMode(record) {
  state.editing = true;
  state.editRowIndex = record._row;

  fDate.value = record['日期'] ? String(record['日期']).slice(0, 10) : '';
  updateDateDisplay();
  fPart.value = record['施作部位'] || '';
  fStyle.value = record['款式金額(NTD)'] ? formatThousands(record['款式金額(NTD)']) : '';
  fRemove.value = record['卸甲金額(NTD)'] ? formatThousands(record['卸甲金額(NTD)']) : '';
  fDiscount.value = record['優惠/特殊費用(NTD)'] ? formatThousands(record['優惠/特殊費用(NTD)']) : '';
  recalcTotal();

  const refUrls = (record['參考款式圖片'] || '').split(',').map(s => s.trim()).filter(Boolean);
  state.refImages = refUrls.map(url => ({ kind: 'existing', url }));
  renderRefThumbs();

  const actUrls = (record['施作款式圖片'] || '').split(',').map(s => s.trim()).filter(Boolean);
  state.actImages = actUrls.map(url => ({ kind: 'existing', url }));
  renderActThumbs();

  const videoUrls = (record['施作影片'] || '').split(',').map(s => s.trim()).filter(Boolean);
  state.videos = videoUrls.map(url => ({ kind: 'existing', url }));
  renderVideoList();

  formModeTag.textContent = '編輯紀錄';
  formModeTitle.textContent = `編輯 ${formatDate(record['日期'])} 的紀錄`;
  submitBtnText.textContent = '更新紀錄';
  cancelEditBtn.hidden = false;
  backBtn.hidden = false;

  switchTab('add');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function exitEditMode() {
  state.editing = false;
  state.editRowIndex = null;
  formModeTag.textContent = '新增紀錄';
  formModeTitle.textContent = '今天做了什麼款式？';
  submitBtnText.textContent = '儲存紀錄';
  cancelEditBtn.hidden = true;
  backBtn.hidden = true;
  resetForm();
}
cancelEditBtn.addEventListener('click', exitEditMode);
backBtn.addEventListener('click', () => { exitEditMode(); switchTab('list'); });

function resetForm() {
  fPart.value = '';
  fStyle.value = ''; fRemove.value = ''; fDiscount.value = '';
  fTotal.textContent = '0';
  state.refImages = [];
  state.actImages = [];
  state.videos = [];
  renderRefThumbs(); renderActThumbs(); renderVideoList();
  fRefImg.value = ''; fActImg.value = ''; fVideo.value = '';
  fDate.value = new Date().toISOString().slice(0, 10);
  updateDateDisplay();
}

/* ---------- 送出表單（新增 / 更新） ---------- */
entryForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!CONFIG.API_URL || CONFIG.API_URL.includes('YOUR_DEPLOYMENT_ID')) {
    showMsg('尚未設定 Google Apps Script 網址，請先完成 config.js 設定。', 'error');
    return;
  }
  if (!fPart.value) {
    showMsg('請選擇施作部位。', 'error');
    return;
  }

  const payload = {
    action: state.editing ? 'update' : 'create',
    date: fDate.value,
    part: fPart.value,
    styleAmount: parseMoney(fStyle.value),
    removeAmount: parseMoney(fRemove.value),
    discount: parseMoney(fDiscount.value),
    referenceImages: state.refImages.filter(i => i.kind === 'new').map(i => ({ data: i.data, name: i.name })),
    existingReferenceImageUrls: state.refImages.filter(i => i.kind === 'existing').map(i => i.url),
    actualImages: state.actImages.filter(i => i.kind === 'new').map(i => ({ data: i.data, name: i.name })),
    existingActualImageUrls: state.actImages.filter(i => i.kind === 'existing').map(i => i.url),
    actualVideos: state.videos.filter(v => v.kind === 'new').map(v => ({ data: v.data, name: v.name })),
    existingActualVideoUrls: state.videos.filter(v => v.kind === 'existing').map(v => v.url),
  };
  if (state.editing) payload.rowIndex = state.editRowIndex;

  submitBtn.disabled = true;
  showMsg('儲存中，圖片／影片上傳可能需要一些時間…', '');

  try {
    const json = await fetchJsonOnce(payload);
    if (!json.ok) throw new Error(json.error || '未知錯誤');

    showMsg(state.editing ? '已成功更新這筆紀錄 ✓' : '已成功儲存這筆紀錄 ✓', 'success');
    const wasEditing = state.editing;
    exitEditModeSilently();
    await loadRecords();
    if (wasEditing) switchTab('list');
  } catch (err) {
    if (err.message === 'AUTH_EXPIRED') return;
    console.error(err);
    showMsg('儲存失敗：' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

function exitEditModeSilently() {
  state.editing = false;
  state.editRowIndex = null;
  formModeTag.textContent = '新增紀錄';
  formModeTitle.textContent = '今天做了什麼款式？';
  submitBtnText.textContent = '儲存紀錄';
  cancelEditBtn.hidden = true;
  backBtn.hidden = true;
  resetForm();
}

function showMsg(text, type) {
  formMsg.textContent = text;
  formMsg.className = 'form-msg' + (type ? ' ' + type : '');
}

/* ---------- 刪除 ---------- */
async function deleteRecord(rowIndex) {
  if (!confirm('確定要刪除這筆紀錄嗎？此動作無法復原。')) return;
  try {
    const json = await fetchJsonOnce({ action: 'delete', rowIndex });
    if (!json.ok) throw new Error(json.error || '刪除失敗');
    await loadRecords();
  } catch (err) {
    if (err.message === 'AUTH_EXPIRED') return;
    alert('刪除失敗：' + err.message);
  }
}

/* ---------- 部位篩選（手／足） ---------- */
function setFilterPart(part) {
  filterPart = part;
  [filterRowList, filterRowTimeline].forEach(row => {
    row.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.part === part);
    });
  });
  renderTable(allRecords);
  renderTimeline(allRecords);
}
[filterRowList, filterRowTimeline].forEach(row => {
  row.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setFilterPart(btn.dataset.part));
  });
});
function applyFilter(records) {
  if (!filterPart) return records;
  return records.filter(r => (r['施作部位'] || '') === filterPart);
}

/* ---------- 讀取紀錄 ---------- */
async function loadRecords() {
  if (!CONFIG.API_URL || CONFIG.API_URL.includes('YOUR_DEPLOYMENT_ID')) {
    const msg = '尚未設定 Google Apps Script 網址，請先完成 config.js 設定。';
    emptyStateList.textContent = msg; emptyStateList.style.display = 'block';
    emptyStateTimeline.textContent = msg; emptyStateTimeline.style.display = 'block';
    return;
  }
  emptyStateList.textContent = '載入中…'; emptyStateList.style.display = 'block';
  emptyStateTimeline.textContent = '載入中…'; emptyStateTimeline.style.display = 'block';
  try {
    const json = await fetchJsonRetry(CONFIG.API_URL, { method: 'GET' });
    if (!json.ok) throw new Error(json.error || '讀取失敗');
    allRecords = json.records || [];
    renderTable(allRecords);
    renderTimeline(allRecords);
  } catch (err) {
    if (err.message === 'AUTH_EXPIRED') return;
    console.error(err);
    const msg = '讀取紀錄失敗：' + err.message;
    emptyStateList.textContent = msg; emptyStateList.style.display = 'block';
    emptyStateTimeline.textContent = msg; emptyStateTimeline.style.display = 'block';
  }
}

function sortedRecords(records) {
  return [...records].sort((a, b) => new Date(b['日期']) - new Date(a['日期']));
}

/* ---------- 紀錄明細（表格 + 手機卡片） ---------- */
function renderTable(records) {
  recordTableBody.innerHTML = '';
  mobileList.innerHTML = '';

  const filtered = applyFilter(records);
  if (!filtered.length) {
    emptyStateList.style.display = 'block';
    emptyStateList.textContent = records.length ? '這個篩選條件下沒有紀錄。' : '還沒有任何紀錄，新增第一筆吧！';
    return;
  }
  emptyStateList.style.display = 'none';

  const list = sortedRecords(filtered);
  renderMobileList(list);

  list.forEach(r => {
    const styleAmount = Number(r['款式金額(NTD)']) || 0;
    const removeAmount = Number(r['卸甲金額(NTD)']) || 0;
    const discount = Number(r['優惠/特殊費用(NTD)']) || 0;
    const total = Number(r['總額(NTD)']) || (styleAmount + removeAmount + discount);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(r['日期'])}</td>
      <td class="part-cell"><span class="part-badge">${r['施作部位'] || '—'}</span></td>
      <td>${formatThousands(styleAmount)}</td>
      <td>${formatThousands(removeAmount)}</td>
      <td>${formatThousands(discount)}</td>
      <td class="total-cell">NT$ ${formatThousands(total)}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="icon-btn edit" title="編輯">✎</button>
          <button type="button" class="icon-btn delete" title="刪除">🗑</button>
        </div>
      </td>
    `;
    tr.querySelector('.edit').addEventListener('click', (ev) => { ev.stopPropagation(); enterEditMode(r); });
    tr.querySelector('.delete').addEventListener('click', (ev) => { ev.stopPropagation(); deleteRecord(r._row); });
    tr.addEventListener('click', () => enterEditMode(r));
    recordTableBody.appendChild(tr);
  });
}

function renderMobileList(list) {
  mobileList.innerHTML = '';
  list.forEach(r => {
    const styleAmount = Number(r['款式金額(NTD)']) || 0;
    const removeAmount = Number(r['卸甲金額(NTD)']) || 0;
    const discount = Number(r['優惠/特殊費用(NTD)']) || 0;
    const total = Number(r['總額(NTD)']) || (styleAmount + removeAmount + discount);

    const card = document.createElement('div');
    card.className = 'mobile-record-card';
    card.innerHTML = `
      <div class="mrc-top">
        <span class="mrc-date">${formatDate(r['日期'])}</span>
        <span class="mrc-total">NT$ ${formatThousands(total)}</span>
      </div>
      <div class="mrc-mid">
        <span class="part-badge">${r['施作部位'] || '—'}</span>
        <span class="mrc-breakdown">款式 ${formatThousands(styleAmount)}・卸甲 ${formatThousands(removeAmount)}・優惠 ${formatThousands(discount)}</span>
      </div>
      <div class="mrc-actions">
        <button type="button" class="icon-btn edit" title="編輯">✎</button>
        <button type="button" class="icon-btn delete" title="刪除">🗑</button>
      </div>
    `;
    card.querySelector('.edit').addEventListener('click', (ev) => { ev.stopPropagation(); enterEditMode(r); });
    card.querySelector('.delete').addEventListener('click', (ev) => { ev.stopPropagation(); deleteRecord(r._row); });
    card.addEventListener('click', () => enterEditMode(r));
    mobileList.appendChild(card);
  });
}

/* ---------- 時間軸 ---------- */
function renderTimeline(records) {
  timeline.querySelectorAll('.entry').forEach(el => el.remove());

  const filtered = applyFilter(records);
  if (!filtered.length) {
    emptyStateTimeline.style.display = 'block';
    emptyStateTimeline.textContent = records.length ? '這個篩選條件下沒有紀錄。' : '還沒有任何紀錄，新增第一筆吧！';
    return;
  }
  emptyStateTimeline.style.display = 'none';

  sortedRecords(filtered).forEach(r => {
    const styleAmount = Number(r['款式金額(NTD)']) || 0;
    const removeAmount = Number(r['卸甲金額(NTD)']) || 0;
    const discount = Number(r['優惠/特殊費用(NTD)']) || 0;
    const total = Number(r['總額(NTD)']) || (styleAmount + removeAmount + discount);
    const refImgs = (r['參考款式圖片'] || '').split(',').map(s => s.trim()).filter(Boolean);
    const actImgs = (r['施作款式圖片'] || '').split(',').map(s => s.trim()).filter(Boolean);
    const videoUrls = (r['施作影片'] || '').split(',').map(s => s.trim()).filter(Boolean);

    const el = document.createElement('article');
    el.className = 'entry';
    el.innerHTML = `
      <div class="entry-head">
        <div class="entry-head-left">
          <span class="entry-date">${formatDate(r['日期'])}</span>
          <span class="part-badge">${r['施作部位'] || '—'}</span>
          <button type="button" class="icon-btn edit" title="編輯">✎</button>
          <button type="button" class="icon-btn delete" title="刪除">🗑</button>
        </div>
        <span class="entry-total">NT$ <b>${formatThousands(total)}</b></span>
      </div>
      <div class="entry-breakdown">
        <div class="bd-item"><span class="bd-label">款式金額</span><span class="bd-value">${formatThousands(styleAmount)}</span></div>
        <div class="bd-item"><span class="bd-label">卸甲金額</span><span class="bd-value">${formatThousands(removeAmount)}</span></div>
        <div class="bd-item"><span class="bd-label">優惠/特殊費用</span><span class="bd-value">${formatThousands(discount)}</span></div>
      </div>
      <div class="entry-images">
        <div>
          <span class="img-block-label">參考款式</span>
          <div class="img-strip">${refImgs.length ? refImgs.map(u => `<img src="${thumbUrl(u)}" data-full="${u}" loading="lazy" decoding="async">`).join('') : `<span class="no-img">無圖片</span>`}</div>
        </div>
        <div>
          <span class="img-block-label">施作款式</span>
          <div class="img-strip">${actImgs.length ? actImgs.map(u => `<img src="${thumbUrl(u)}" data-full="${u}" loading="lazy" decoding="async">`).join('') : `<span class="no-img">無圖片</span>`}</div>
        </div>
        ${videoUrls.length ? `<div class="video-links">${videoUrls.map((u, i) => `<a class="video-link" href="${u}" target="_blank" rel="noopener">🎬 影片 ${i + 1}</a>`).join('')}</div>` : ''}
      </div>
    `;
    el.querySelectorAll('.img-strip img').forEach(img => {
      img.addEventListener('click', () => {
        const gallery = [...refImgs, ...actImgs];
        const startIndex = gallery.indexOf(img.dataset.full);
        openLightbox(gallery, startIndex >= 0 ? startIndex : 0);
      });
    });
    el.querySelector('.edit').addEventListener('click', () => enterEditMode(r));
    el.querySelector('.delete').addEventListener('click', () => deleteRecord(r._row));
    timeline.appendChild(el);
  });
}

/* ---------- 燈箱（支援多張照片左右滑動） ---------- */
const lbPrev = document.getElementById('lbPrev');
const lbNext = document.getElementById('lbNext');
const lbDots = document.getElementById('lbDots');

let lbGallery = [];
let lbIndex = 0;

function openLightbox(gallery, startIndex = 0) {
  lbGallery = Array.isArray(gallery) ? gallery : [gallery];
  lbIndex = startIndex;
  renderLightbox();
  lightbox.classList.add('open');
  lockBodyScroll();
}

function closeLightbox() {
  lightbox.classList.remove('open');
  lightboxImg.src = '';
  unlockBodyScroll();
}

function lockBodyScroll() {
  const y = window.scrollY || window.pageYOffset || 0;
  document.body.dataset.scrollY = String(y);
  document.documentElement.style.overflowAnchor = 'none';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${y}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
}

function unlockBodyScroll() {
  const y = parseInt(document.body.dataset.scrollY || '0', 10);
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  const prevScrollBehavior = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = 'auto'; // 用行內樣式強制覆蓋 CSS 的平滑捲動設定
  requestAnimationFrame(() => {
    window.scrollTo(0, y);
    document.documentElement.style.scrollBehavior = prevScrollBehavior;
    document.documentElement.style.overflowAnchor = '';
  });
}

function renderLightbox() {
  lightboxImg.src = lbGallery[lbIndex];
  const multi = lbGallery.length > 1;
  lbPrev.hidden = !multi;
  lbNext.hidden = !multi;
  lbDots.innerHTML = multi
    ? lbGallery.map((_, i) => `<span class="${i === lbIndex ? 'active' : ''}"></span>`).join('')
    : '';
}

function lbGo(delta) {
  if (!lbGallery.length) return;
  lbIndex = (lbIndex + delta + lbGallery.length) % lbGallery.length;
  renderLightbox();
}

lbPrev.addEventListener('click', (e) => { e.stopPropagation(); lbGo(-1); });
lbNext.addEventListener('click', (e) => { e.stopPropagation(); lbGo(1); });

lightbox.addEventListener('click', (e) => {
  if (e.target === lbPrev || e.target === lbNext) return;
  closeLightbox();
});

// 觸控滑動切換（同時擋掉背景頁面被一起滑動）
let lbTouchStartX = null;
let lbTouchStartY = null;
lightbox.addEventListener('touchstart', (e) => {
  lbTouchStartX = e.touches[0].clientX;
  lbTouchStartY = e.touches[0].clientY;
}, { passive: true });
lightbox.addEventListener('touchmove', (e) => {
  e.preventDefault();
}, { passive: false });
lightbox.addEventListener('touchend', (e) => {
  if (lbTouchStartX === null) return;
  const deltaX = e.changedTouches[0].clientX - lbTouchStartX;
  const deltaY = e.changedTouches[0].clientY - lbTouchStartY;
  if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) lbGo(deltaX > 0 ? -1 : 1);
  lbTouchStartX = null;
  lbTouchStartY = null;
}, { passive: true });

/* ---------- 還原備份 ---------- */
let backupsCache = null;

function setupRestorePanel({ openBtn, panel, select, confirmBtn, cancelBtn }) {
  openBtn.addEventListener('click', async () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    if (opening) await loadBackupsIntoSelect(select);
  });

  cancelBtn.addEventListener('click', () => { panel.hidden = true; });

  confirmBtn.addEventListener('click', async () => {
    const fileId = select.value;
    if (!fileId) { alert('請先選擇一份備份。'); return; }
    const selected = (backupsCache || []).find(b => b.id === fileId);
    const label = selected ? `${selected.date}　${selected.name}` : fileId;
    if (!confirm(`確定要用「${label}」覆蓋目前所有紀錄嗎？\n此動作無法復原，目前的資料會被取代。`)) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = '還原中…';
    try {
      const json = await fetchJsonOnce({ action: 'restore', backupFileId: fileId });
      if (!json.ok) throw new Error(json.error || '還原失敗');
      alert(`還原完成，共還原 ${json.restoredRows} 筆紀錄 ✓`);
      panel.hidden = true;
      await loadRecords();
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED') return;
      alert('還原失敗：' + err.message);
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = '還原此備份';
    }
  });
}

async function loadBackupsIntoSelect(select) {
  select.innerHTML = '<option value="">讀取備份清單中…</option>';
  try {
    const json = await fetchJsonRetry(CONFIG.API_URL + '?type=backups', { method: 'GET' });
    if (!json.ok) throw new Error(json.error || '讀取備份清單失敗');
    backupsCache = json.backups || [];
    if (!backupsCache.length) {
      select.innerHTML = '<option value="">目前沒有任何備份檔案</option>';
      return;
    }
    select.innerHTML = backupsCache
      .map(b => `<option value="${b.id}">${b.date}　${b.name}</option>`)
      .join('');
  } catch (err) {
    if (err.message === 'AUTH_EXPIRED') { select.innerHTML = '<option value="">請重新登入</option>'; return; }
    select.innerHTML = '<option value="">讀取失敗：' + err.message + '</option>';
  }
}

setupRestorePanel({
  openBtn: restoreBtnList, panel: restorePanelList, select: restoreSelectList,
  confirmBtn: restoreConfirmList, cancelBtn: restoreCancelList,
});
setupRestorePanel({
  openBtn: restoreBtnTimeline, panel: restorePanelTimeline, select: restoreSelectTimeline,
  confirmBtn: restoreConfirmTimeline, cancelBtn: restoreCancelTimeline,
});

/* ---------- 手動備份 ---------- */
async function runManualBackup(btn) {
  if (!CONFIG.API_URL || CONFIG.API_URL.includes('YOUR_DEPLOYMENT_ID')) {
    alert('尚未設定 Google Apps Script 網址。');
    return;
  }
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⏳';
  try {
    const json = await fetchJsonOnce({ action: 'backup' });
    if (!json.ok) throw new Error(json.error || '備份失敗');
    alert('備份完成 ✓\n檔名：' + json.backupName);
  } catch (err) {
    if (err.message === 'AUTH_EXPIRED') return;
    alert('備份失敗：' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
}
backupBtnList.addEventListener('click', () => runManualBackup(backupBtnList));
backupBtnTimeline.addEventListener('click', () => runManualBackup(backupBtnTimeline));

/* ---------- 重新整理 ---------- */
function bindRefresh(btn) {
  btn.addEventListener('click', () => {
    btn.classList.add('spinning');
    loadRecords().finally(() => setTimeout(() => btn.classList.remove('spinning'), 400));
  });
}
bindRefresh(refreshBtnList);
bindRefresh(refreshBtnTimeline);

/* ---------- 初始載入：檢查登入狀態 ---------- */
if (sessionStorage.getItem(SESSION_KEY) === '1' && TOKEN) {
  const loginTime = Number(sessionStorage.getItem(LOGIN_TIME_KEY) || 0);
  if (loginTime && (Date.now() - loginTime) < SESSION_TTL_MS) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    startTokenHeartbeat();
    loadRecords();
  } else {
    _handleTokenExpiry();
  }
} else {
  setTimeout(() => {
    const pw = document.getElementById('pwInput');
    if (pw) pw.focus();
  }, 300);
}
