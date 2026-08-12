/* ============================================================
   珊的美甲紀錄 - 前端邏輯 (v2)
   ============================================================ */

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
  refImage: null,        // { data, name } 新上傳的參考圖
  existingRefUrl: '',    // 編輯模式下沿用的參考圖網址
  actImages: [],         // 陣列: { kind:'existing', url } 或 { kind:'new', data, name }
  video: null,           // { data, name } 新上傳影片
  existingVideoUrl: '',  // 編輯模式下沿用的影片網址
};
let allRecords = [];

/* ---------- DOM refs ---------- */
const fDate = document.getElementById('fDate');
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
const refPreviewWrap = document.getElementById('refPreviewWrap');

const actDrop = document.getElementById('actDrop');
const fActImg = document.getElementById('fActImg');
const actThumbGrid = document.getElementById('actThumbGrid');

const videoDrop = document.getElementById('videoDrop');
const fVideo = document.getElementById('fVideo');
const videoPreviewWrap = document.getElementById('videoPreviewWrap');

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

/* ---------- 金額即時千分位 + 自動加總 ---------- */
function recalcTotal() {
  const total = parseMoney(fStyle.value) + parseMoney(fRemove.value) + parseMoney(fDiscount.value);
  fTotal.textContent = formatThousands(total);
}
bindMoneyInput(fStyle, recalcTotal);
bindMoneyInput(fRemove, recalcTotal);
bindMoneyInput(fDiscount, recalcTotal);

/* ---------- 參考款式（單圖） ---------- */
refDrop.addEventListener('click', () => fRefImg.click());
fRefImg.addEventListener('change', async () => {
  const file = fRefImg.files[0];
  if (!file) return;
  const data = await fileToCompressedBase64(file);
  state.refImage = { data, name: file.name };
  state.existingRefUrl = '';
  renderRefPreview();
});
function renderRefPreview() {
  const src = state.refImage ? state.refImage.data : state.existingRefUrl;
  if (src) {
    refPreviewWrap.classList.add('has-image');
    refPreviewWrap.innerHTML = `<img src="${src}" alt="參考款式預覽">`;
  } else {
    refPreviewWrap.classList.remove('has-image');
    refPreviewWrap.innerHTML = `<span class="dz-icon">＋</span><span class="dz-text">點擊上傳參考圖</span>`;
  }
}

/* ---------- 施作款式（多圖） ---------- */
actDrop.addEventListener('click', () => fActImg.click());
fActImg.addEventListener('change', async () => {
  const files = Array.from(fActImg.files || []);
  for (const file of files) {
    const data = await fileToCompressedBase64(file);
    state.actImages.push({ kind: 'new', data, name: file.name });
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

/* ---------- 施作影片 ---------- */
videoDrop.addEventListener('click', () => fVideo.click());
fVideo.addEventListener('change', async () => {
  const file = fVideo.files[0];
  if (!file) return;
  if (file.size > 45 * 1024 * 1024) {
    showMsg('影片檔案過大（建議 45MB 以內），請先壓縮後再上傳。', 'error');
    fVideo.value = '';
    return;
  }
  const data = await fileToRawBase64(file);
  state.video = { data, name: file.name };
  state.existingVideoUrl = '';
  renderVideoPreview();
});
function renderVideoPreview() {
  if (state.video) {
    videoPreviewWrap.classList.add('has-image');
    videoPreviewWrap.innerHTML = `<video src="${state.video.data}" muted></video>`;
  } else if (state.existingVideoUrl) {
    videoPreviewWrap.classList.add('has-image');
    videoPreviewWrap.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:6px;">
      <span style="font-size:22px;">🎬</span><span style="font-size:12px;color:var(--ink-dim);">已有影片（點擊可更換）</span></div>`;
  } else {
    videoPreviewWrap.classList.remove('has-image');
    videoPreviewWrap.innerHTML = `<span class="dz-icon">▶</span><span class="dz-text">點擊上傳影片</span>`;
  }
}

/* ---------- 表單模式：新增 / 編輯 ---------- */
function enterEditMode(record) {
  state.editing = true;
  state.editRowIndex = record._row;

  fDate.value = record['日期'] ? String(record['日期']).slice(0, 10) : '';
  fPart.value = record['施作部位'] || '';
  fStyle.value = record['款式金額(NTD)'] ? formatThousands(record['款式金額(NTD)']) : '';
  fRemove.value = record['卸甲金額(NTD)'] ? formatThousands(record['卸甲金額(NTD)']) : '';
  fDiscount.value = record['優惠/特殊費用(NTD)'] ? formatThousands(record['優惠/特殊費用(NTD)']) : '';
  recalcTotal();

  state.refImage = null;
  state.existingRefUrl = record['參考款式圖片'] || '';
  renderRefPreview();

  const actUrls = (record['施作款式圖片'] || '').split(',').map(s => s.trim()).filter(Boolean);
  state.actImages = actUrls.map(url => ({ kind: 'existing', url }));
  renderActThumbs();

  state.video = null;
  state.existingVideoUrl = record['施作影片'] || '';
  renderVideoPreview();

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
  state.refImage = null; state.existingRefUrl = '';
  state.actImages = [];
  state.video = null; state.existingVideoUrl = '';
  renderRefPreview(); renderActThumbs(); renderVideoPreview();
  fRefImg.value = ''; fActImg.value = ''; fVideo.value = '';
  fDate.value = new Date().toISOString().slice(0, 10);
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
    referenceImage: state.refImage ? state.refImage.data : '',
    referenceImageName: state.refImage ? state.refImage.name : '',
    existingReferenceImageUrl: state.existingRefUrl || '',
    actualImages: state.actImages.filter(i => i.kind === 'new').map(i => ({ data: i.data, name: i.name })),
    existingActualImageUrls: state.actImages.filter(i => i.kind === 'existing').map(i => i.url),
    actualVideo: state.video ? state.video.data : '',
    actualVideoName: state.video ? state.video.name : '',
    existingActualVideoUrl: state.existingVideoUrl || '',
  };
  if (state.editing) payload.rowIndex = state.editRowIndex;

  submitBtn.disabled = true;
  showMsg('儲存中，圖片／影片上傳可能需要一些時間…', '');

  try {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || '未知錯誤');

    showMsg(state.editing ? '已成功更新這筆紀錄 ✓' : '已成功儲存這筆紀錄 ✓', 'success');
    const wasEditing = state.editing;
    exitEditModeSilently();
    await loadRecords();
    if (wasEditing) switchTab('list');
  } catch (err) {
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
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'delete', rowIndex }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || '刪除失敗');
    await loadRecords();
  } catch (err) {
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
  try {
    const res = await fetch(CONFIG.API_URL, { method: 'GET' });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || '讀取失敗');
    allRecords = json.records || [];
    renderTable(allRecords);
    renderTimeline(allRecords);
  } catch (err) {
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
    const refImg = r['參考款式圖片'];
    const actImgs = (r['施作款式圖片'] || '').split(',').map(s => s.trim()).filter(Boolean);
    const videoUrl = r['施作影片'];

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
          <div class="img-strip">${refImg ? `<img src="${refImg}" data-full="${refImg}">` : `<span class="no-img">無圖片</span>`}</div>
        </div>
        <div>
          <span class="img-block-label">施作款式</span>
          <div class="img-strip">${actImgs.length ? actImgs.map(u => `<img src="${u}" data-full="${u}">`).join('') : `<span class="no-img">無圖片</span>`}</div>
        </div>
        ${videoUrl ? `<div><a class="video-link" href="${videoUrl}" target="_blank" rel="noopener">🎬 觀看施作影片</a></div>` : ''}
      </div>
    `;
    el.querySelectorAll('.img-strip img').forEach(img => {
      img.addEventListener('click', () => openLightbox(img.dataset.full));
    });
    el.querySelector('.edit').addEventListener('click', () => enterEditMode(r));
    el.querySelector('.delete').addEventListener('click', () => deleteRecord(r._row));
    timeline.appendChild(el);
  });
}

/* ---------- 燈箱 ---------- */
function openLightbox(src) {
  lightboxImg.src = src;
  lightbox.classList.add('open');
}
lightbox.addEventListener('click', () => { lightbox.classList.remove('open'); lightboxImg.src = ''; });

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
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'restore', backupFileId: fileId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || '還原失敗');
      alert(`還原完成，共還原 ${json.restoredRows} 筆紀錄 ✓`);
      panel.hidden = true;
      await loadRecords();
    } catch (err) {
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
    const res = await fetch(CONFIG.API_URL + '?type=backups', { method: 'GET' });
    const json = await res.json();
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
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'backup' }),
    });
    let json;
    try {
      json = await res.json();
    } catch (parseErr) {
      throw new Error('伺服器回應異常（通常是瀏覽器同時登入多個 Google 帳號造成），但備份實際上可能已經完成，請直接到雲端硬碟備份資料夾確認。');
    }
    if (!json.ok) throw new Error(json.error || '備份失敗');
    alert('備份完成 ✓\n檔名：' + json.backupName);
  } catch (err) {
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

/* ---------- 初始載入 ---------- */
loadRecords();
