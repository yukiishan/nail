/* ---------- 工具函式 ---------- */

// 數字轉千分位字串（保留原始正負號，不含小數）
function formatThousands(num) {
  const n = Math.round(Number(num) || 0);
  return n.toLocaleString('en-US');
}

// 從千分位字串取回純數字
function parseMoney(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/[^0-9-]/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}

// 綁定一個「輸入時即時千分位」的金額欄位
function bindMoneyInput(el, onChange) {
  el.addEventListener('input', () => {
    const raw = parseMoney(el.value);
    const caretAtEnd = el.selectionStart === el.value.length;
    el.value = raw === 0 && el.value.trim() === '' ? '' : formatThousands(raw);
    if (caretAtEnd) {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
    onChange && onChange();
  });
}

// 將圖片檔案壓縮並轉為 base64（限制最長邊，避免 payload 過大）
function fileToCompressedBase64(file, maxDim = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          } else {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setDropzonePreview(wrapEl, dataUrl, placeholderText) {
  if (dataUrl) {
    wrapEl.classList.add('has-image');
    wrapEl.innerHTML = `<img src="${dataUrl}" alt="預覽圖">`;
  } else {
    wrapEl.classList.remove('has-image');
    wrapEl.innerHTML = `<span class="dz-icon">＋</span><span class="dz-text">${placeholderText}</span>`;
  }
}

/* ---------- 狀態 ---------- */
const state = {
  refImageData: null,
  refImageName: '',
  actImageData: null,
  actImageName: '',
};

/* ---------- DOM refs ---------- */
const fDate = document.getElementById('fDate');
const fStyle = document.getElementById('fStyle');
const fRemove = document.getElementById('fRemove');
const fDiscount = document.getElementById('fDiscount');
const fTotal = document.getElementById('fTotal');
const entryForm = document.getElementById('entryForm');
const submitBtn = document.getElementById('submitBtn');
const formMsg = document.getElementById('formMsg');

const refDrop = document.getElementById('refDrop');
const fRefImg = document.getElementById('fRefImg');
const refPreviewWrap = document.getElementById('refPreviewWrap');

const actDrop = document.getElementById('actDrop');
const fActImg = document.getElementById('fActImg');
const actPreviewWrap = document.getElementById('actPreviewWrap');

const timeline = document.getElementById('timeline');
const emptyState = document.getElementById('emptyState');
const refreshBtn = document.getElementById('refreshBtn');

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');

/* ---------- 預設日期為今天 ---------- */
fDate.value = new Date().toISOString().slice(0, 10);

/* ---------- 金額欄位即時千分位 + 自動加總 ---------- */
function recalcTotal() {
  const total = parseMoney(fStyle.value) + parseMoney(fRemove.value) + parseMoney(fDiscount.value);
  fTotal.textContent = formatThousands(total);
}
bindMoneyInput(fStyle, recalcTotal);
bindMoneyInput(fRemove, recalcTotal);
bindMoneyInput(fDiscount, recalcTotal);

/* ---------- 圖片上傳 ---------- */
refDrop.addEventListener('click', () => fRefImg.click());
actDrop.addEventListener('click', () => fActImg.click());

fRefImg.addEventListener('change', async () => {
  const file = fRefImg.files[0];
  if (!file) return;
  state.refImageName = file.name;
  state.refImageData = await fileToCompressedBase64(file);
  setDropzonePreview(refPreviewWrap, state.refImageData, '點擊上傳參考圖');
});

fActImg.addEventListener('change', async () => {
  const file = fActImg.files[0];
  if (!file) return;
  state.actImageName = file.name;
  state.actImageData = await fileToCompressedBase64(file);
  setDropzonePreview(actPreviewWrap, state.actImageData, '點擊上傳完成圖');
});

/* ---------- 送出表單 ---------- */
entryForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!CONFIG.API_URL || CONFIG.API_URL.includes('YOUR_DEPLOYMENT_ID')) {
    showMsg('尚未設定 Google Apps Script 網址，請先完成 config.js 設定。', 'error');
    return;
  }

  const payload = {
    date: fDate.value,
    styleAmount: parseMoney(fStyle.value),
    removeAmount: parseMoney(fRemove.value),
    discount: parseMoney(fDiscount.value),
    referenceImage: state.refImageData || '',
    referenceImageName: state.refImageName || '',
    actualImage: state.actImageData || '',
    actualImageName: state.actImageName || '',
  };

  submitBtn.disabled = true;
  showMsg('儲存中，圖片上傳可能需要幾秒鐘…', '');

  try {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // 避免觸發 CORS 預檢
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || '未知錯誤');

    showMsg('已成功儲存這筆紀錄 ✓', 'success');
    resetForm();
    loadRecords();
  } catch (err) {
    console.error(err);
    showMsg('儲存失敗：' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

function resetForm() {
  fStyle.value = '';
  fRemove.value = '';
  fDiscount.value = '';
  fTotal.textContent = '0';
  state.refImageData = null;
  state.refImageName = '';
  state.actImageData = null;
  state.actImageName = '';
  setDropzonePreview(refPreviewWrap, null, '點擊上傳參考圖');
  setDropzonePreview(actPreviewWrap, null, '點擊上傳完成圖');
  fRefImg.value = '';
  fActImg.value = '';
  fDate.value = new Date().toISOString().slice(0, 10);
}

function showMsg(text, type) {
  formMsg.textContent = text;
  formMsg.className = 'form-msg' + (type ? ' ' + type : '');
}

/* ---------- 讀取歷史紀錄 ---------- */
async function loadRecords() {
  if (!CONFIG.API_URL || CONFIG.API_URL.includes('YOUR_DEPLOYMENT_ID')) {
    emptyState.textContent = '尚未設定 Google Apps Script 網址，請先完成 config.js 設定。';
    emptyState.style.display = 'block';
    return;
  }
  try {
    const res = await fetch(CONFIG.API_URL, { method: 'GET' });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || '讀取失敗');
    renderTimeline(json.records || []);
  } catch (err) {
    console.error(err);
    emptyState.textContent = '讀取紀錄失敗：' + err.message;
    emptyState.style.display = 'block';
  }
}

function renderTimeline(records) {
  timeline.querySelectorAll('.entry').forEach(el => el.remove());

  if (!records.length) {
    emptyState.style.display = 'block';
    emptyState.textContent = '還沒有任何紀錄，新增第一筆吧！';
    return;
  }
  emptyState.style.display = 'none';

  // 依日期新到舊排序
  const sorted = [...records].sort((a, b) => new Date(b['日期']) - new Date(a['日期']));

  sorted.forEach(r => {
    const styleAmount = Number(r['款式金額(NTD)']) || 0;
    const removeAmount = Number(r['卸甲金額(NTD)']) || 0;
    const discount = Number(r['優惠/特殊費用(NTD)']) || 0;
    const total = Number(r['總額(NTD)']) || (styleAmount + removeAmount + discount);
    const refImg = r['參考款式圖片'];
    const actImg = r['施作款式圖片'];

    const el = document.createElement('article');
    el.className = 'entry';
    el.innerHTML = `
      <div class="entry-head">
        <span class="entry-date">${formatDate(r['日期'])}</span>
        <span class="entry-total">NT$ <b>${formatThousands(total)}</b></span>
      </div>
      <div class="entry-breakdown">
        <div class="bd-item"><span class="bd-label">款式金額</span><span class="bd-value">${formatThousands(styleAmount)}</span></div>
        <div class="bd-item"><span class="bd-label">卸甲金額</span><span class="bd-value">${formatThousands(removeAmount)}</span></div>
        <div class="bd-item"><span class="bd-label">優惠/特殊費用</span><span class="bd-value">${formatThousands(discount)}</span></div>
      </div>
      <div class="entry-images">
        <div class="img-slot">
          <span class="img-slot-label">參考款式</span>
          ${refImg ? `<img src="${refImg}" alt="參考款式" data-full="${refImg}">` : `<div class="no-img">無圖片</div>`}
        </div>
        <div class="img-slot">
          <span class="img-slot-label">施作款式</span>
          ${actImg ? `<img src="${actImg}" alt="施作款式" data-full="${actImg}">` : `<div class="no-img">無圖片</div>`}
        </div>
      </div>
    `;
    timeline.appendChild(el);
  });

  timeline.querySelectorAll('.img-slot img').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.dataset.full));
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

/* ---------- 燈箱 ---------- */
function openLightbox(src) {
  lightboxImg.src = src;
  lightbox.classList.add('open');
}
lightbox.addEventListener('click', () => {
  lightbox.classList.remove('open');
  lightboxImg.src = '';
});

/* ---------- 重新整理 ---------- */
refreshBtn.addEventListener('click', () => {
  refreshBtn.classList.add('spinning');
  loadRecords().finally(() => {
    setTimeout(() => refreshBtn.classList.remove('spinning'), 400);
  });
});

/* ---------- 初始載入 ---------- */
loadRecords();
