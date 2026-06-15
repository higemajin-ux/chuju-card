const DB_NAME = 'chuju-card-db';
const DB_VERSION = 1;
const STORE_NAME = 'cards';
const REQUIRED_COLUMNS = [
  'subject', 'unit', 'type', 'question', 'answer', 'explanation',
  'difficulty', 'source', 'check', 'questionImage', 'answerImage'
];

let db;
let cards = [];
let currentCard = null;
let answerVisible = false;

const el = {
  saveStatus: document.getElementById('saveStatus'),
  csvInput: document.getElementById('csvInput'),
  jsonInput: document.getElementById('jsonInput'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  clearAllBtn: document.getElementById('clearAllBtn'),
  totalCount: document.getElementById('totalCount'),
  dueCount: document.getElementById('dueCount'),
  graduatedCount: document.getElementById('graduatedCount'),
  cardMeta: document.getElementById('cardMeta'),
  cardBox: document.getElementById('cardBox'),
  questionText: document.getElementById('questionText'),
  answerArea: document.getElementById('answerArea'),
  answerText: document.getElementById('answerText'),
  explanationText: document.getElementById('explanationText'),
  showAnswerBtn: document.getElementById('showAnswerBtn'),
  nextCardBtn: document.getElementById('nextCardBtn'),
  markGoodBtn: document.getElementById('markGoodBtn'),
  markMaybeBtn: document.getElementById('markMaybeBtn'),
  markBadBtn: document.getElementById('markBadBtn'),
  cardList: document.getElementById('cardList'),
  itemTemplate: document.getElementById('cardListItemTemplate'),
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function createId(row) {
  const text = `${row.subject}|${row.unit}|${row.question}|${row.answer}`;
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return `card-${Math.abs(hash)}-${text.length}`;
}

function setStatus(message) {
  el.saveStatus.textContent = message;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txStore(mode = 'readonly') {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function getAllCards() {
  return new Promise((resolve, reject) => {
    const request = txStore().getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function putCards(items) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    items.forEach((item) => store.put(item));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function clearCards() {
  return new Promise((resolve, reject) => {
    const request = txStore('readwrite').clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

function csvRowsToCards(rows) {
  if (rows.length < 2) return [];
  const header = rows[0].map((name) => name.trim());
  const missing = REQUIRED_COLUMNS.filter((name) => !header.includes(name));
  if (missing.length) {
    throw new Error(`CSV列が足りません: ${missing.join(', ')}`);
  }

  return rows.slice(1).map((values) => {
    const row = {};
    header.forEach((key, index) => {
      row[key] = (values[index] || '').trim();
    });
    const now = new Date().toISOString();
    return {
      id: createId(row),
      ...row,
      status: 'active',
      goodStreak: 0,
      totalGood: 0,
      totalMaybe: 0,
      totalBad: 0,
      nextReviewDate: todayString(),
      createdAt: now,
      updatedAt: now,
    };
  }).filter((card) => card.question && card.answer);
}

async function reloadCards() {
  cards = await getAllCards();
  cards.sort((a, b) => (a.nextReviewDate || '').localeCompare(b.nextReviewDate || ''));
  render();
}

function dueCards() {
  const today = todayString();
  return cards.filter((card) => card.status !== 'graduated' && (!card.nextReviewDate || card.nextReviewDate <= today));
}

function pickNextCard() {
  const due = dueCards();
  currentCard = due[0] || cards.find((card) => card.status !== 'graduated') || cards[0] || null;
  answerVisible = false;
  renderStudyCard();
}

function render() {
  el.totalCount.textContent = String(cards.length);
  el.dueCount.textContent = String(dueCards().length);
  el.graduatedCount.textContent = String(cards.filter((card) => card.status === 'graduated').length);
  renderStudyCard();
  renderList();
  const hasCard = Boolean(currentCard);
  el.showAnswerBtn.disabled = !hasCard;
  el.nextCardBtn.disabled = cards.length === 0;
  el.markGoodBtn.disabled = !hasCard;
  el.markMaybeBtn.disabled = !hasCard;
  el.markBadBtn.disabled = !hasCard;
}

function renderStudyCard() {
  if (!currentCard) {
    el.cardBox.classList.add('empty');
    el.cardMeta.textContent = cards.length ? '今日のカードはありません' : 'CSVを読み込んでください';
    el.questionText.textContent = cards.length ? '今日の復習分は終わりです。' : 'まだカードがありません。';
    el.answerArea.classList.add('hidden');
    el.answerText.textContent = '';
    el.explanationText.textContent = '';
    return;
  }

  el.cardBox.classList.remove('empty');
  el.cardMeta.textContent = `${currentCard.subject || '科目未設定'} / ${currentCard.unit || '単元未設定'} / 次回: ${currentCard.nextReviewDate || todayString()}`;
  el.questionText.textContent = currentCard.question;
  el.answerText.textContent = currentCard.answer;
  el.explanationText.textContent = currentCard.explanation || '';
  el.answerArea.classList.toggle('hidden', !answerVisible);
}

function renderList() {
  el.cardList.innerHTML = '';
  if (!cards.length) {
    el.cardList.innerHTML = '<p class="hint">カード一覧はまだ空です。</p>';
    return;
  }

  cards.forEach((card) => {
    const item = el.itemTemplate.content.firstElementChild.cloneNode(true);
    item.querySelector('.list-title').textContent = card.question;
    item.querySelector('.list-sub').textContent = `${card.subject || '-'} / ${card.unit || '-'} / ${card.status} / ○連続 ${card.goodStreak || 0} / 次回 ${card.nextReviewDate || '-'}`;
    item.addEventListener('click', () => {
      currentCard = card;
      answerVisible = false;
      renderStudyCard();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    el.cardList.appendChild(item);
  });
}

async function handleCsvFile(file) {
  const text = await file.text();
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  const imported = csvRowsToCards(rows);
  await putCards(imported);
  setStatus(`${imported.length}枚保存`);
  await reloadCards();
  pickNextCard();
}

async function markCard(result) {
  if (!currentCard) return;
  const nextDays = { good: 7, maybe: 3, bad: 1 }[result];
  const updated = { ...currentCard, updatedAt: new Date().toISOString() };

  if (result === 'good') {
    updated.totalGood = (updated.totalGood || 0) + 1;
    updated.goodStreak = (updated.goodStreak || 0) + 1;
    updated.nextReviewDate = addDays(nextDays);
    if (updated.goodStreak >= 3) updated.status = 'graduated';
  } else if (result === 'maybe') {
    updated.totalMaybe = (updated.totalMaybe || 0) + 1;
    updated.goodStreak = 0;
    updated.status = 'active';
    updated.nextReviewDate = addDays(nextDays);
  } else {
    updated.totalBad = (updated.totalBad || 0) + 1;
    updated.goodStreak = 0;
    updated.status = 'active';
    updated.nextReviewDate = addDays(nextDays);
  }

  await putCards([updated]);
  setStatus('記録しました');
  await reloadCards();
  pickNextCard();
}

function exportJson() {
  const payload = {
    app: 'chuju-card',
    version: '0.1',
    exportedAt: new Date().toISOString(),
    cards,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chuju-card-backup-${todayString()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importJson(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  const imported = Array.isArray(payload) ? payload : payload.cards;
  if (!Array.isArray(imported)) throw new Error('JSON形式が違います。cards配列が必要です。');
  await putCards(imported.filter((card) => card.id && card.question && card.answer));
  setStatus(`${imported.length}枚復元`);
  await reloadCards();
  pickNextCard();
}

async function init() {
  db = await openDb();
  await reloadCards();
  pickNextCard();
  setStatus('保存OK');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      setStatus('SW登録失敗');
    });
  }
}

el.csvInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await handleCsvFile(file);
  } catch (error) {
    alert(error.message || 'CSV読み込みに失敗しました。');
  } finally {
    event.target.value = '';
  }
});

el.jsonInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await importJson(file);
  } catch (error) {
    alert(error.message || 'JSON読み込みに失敗しました。');
  } finally {
    event.target.value = '';
  }
});

el.exportJsonBtn.addEventListener('click', exportJson);
el.showAnswerBtn.addEventListener('click', () => { answerVisible = true; renderStudyCard(); });
el.nextCardBtn.addEventListener('click', pickNextCard);
el.markGoodBtn.addEventListener('click', () => markCard('good'));
el.markMaybeBtn.addEventListener('click', () => markCard('maybe'));
el.markBadBtn.addEventListener('click', () => markCard('bad'));
el.clearAllBtn.addEventListener('click', async () => {
  const ok = confirm('読み込んだカードと学習記録をこの端末から削除します。JSONバックアップ済みですか？');
  if (!ok) return;
  await clearCards();
  currentCard = null;
  setStatus('削除しました');
  await reloadCards();
});

init().catch((error) => {
  console.error(error);
  setStatus('起動失敗');
  alert('起動に失敗しました。Safariの設定や容量を確認してください。');
});
