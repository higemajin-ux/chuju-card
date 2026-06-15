const DB_NAME = 'chuju-card-db';
const DB_VERSION = 1;
const STORE_NAME = 'cards';
const REQUIRED_COLUMNS = [
  'cardId', 'subject', 'unit', 'type', 'question', 'answer', 'explanation',
  'difficulty', 'source', 'check', 'questionImage', 'answerImage',
];
const CONTENT_COLUMNS = [
  'subject', 'unit', 'type', 'question', 'answer', 'explanation',
  'difficulty', 'source', 'check', 'checkReason', 'questionImage', 'answerImage',
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
  dueCountInline: document.getElementById('dueCountInline'),
  graduatedCount: document.getElementById('graduatedCount'),
  cardMeta: document.getElementById('cardMeta'),
  cardBox: document.getElementById('cardBox'),
  questionText: document.getElementById('questionText'),
  sourceText: document.getElementById('sourceText'),
  subjectTag: document.getElementById('subjectTag'),
  unitTag: document.getElementById('unitTag'),
  difficultyTag: document.getElementById('difficultyTag'),
  checkBadge: document.getElementById('checkBadge'),
  checkReasonText: document.getElementById('checkReasonText'),
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

function setStatus(message) {
  el.saveStatus.textContent = message;
}

function setTag(element, label, value) {
  if (value) {
    element.textContent = `${label} ${value}`;
    element.classList.remove('hidden');
  } else {
    element.textContent = '';
    element.classList.add('hidden');
  }
}

function setCheckBadge(element, value) {
  const text = (value || '').trim();
  element.classList.toggle('hidden', !text);
  element.classList.toggle('is-dual', text === '要確認・AI要チェック');
  element.textContent = text;
}

function setCheckReason(value) {
  const text = (value || '').trim();
  el.checkReasonText.classList.toggle('hidden', !text);
  el.checkReasonText.textContent = text ? `理由：${text}` : '';
}

function updateStudyButtons() {
  const hasCard = Boolean(currentCard);
  el.showAnswerBtn.disabled = !hasCard || answerVisible;
  el.nextCardBtn.disabled = cards.length === 0;
  el.markGoodBtn.disabled = !hasCard || !answerVisible;
  el.markMaybeBtn.disabled = !hasCard || !answerVisible;
  el.markBadBtn.disabled = !hasCard || !answerVisible;
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

function replaceCards(upserts, deleteKeys) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    deleteKeys.forEach((key) => store.delete(key));
    upserts.forEach((item) => store.put(item));

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
  if (!header.includes('cardId')) {
    throw new Error('cardId列がありません。新CSV形式で読み込んでください。');
  }

  const missing = REQUIRED_COLUMNS.filter((name) => !header.includes(name));
  if (missing.length) {
    throw new Error(`CSVに必要な列がありません: ${missing.join(', ')}`);
  }

  return rows.slice(1)
    .map((values) => {
      const row = {};
      header.forEach((key, index) => {
        row[key] = (values[index] || '').trim();
      });
      return row;
    })
    .filter((row) => row.cardId && row.question && row.answer)
    .map((row) => ({
      id: row.cardId,
      cardId: row.cardId,
      subject: row.subject,
      unit: row.unit,
      type: row.type,
      question: row.question,
      answer: row.answer,
      explanation: row.explanation,
      difficulty: row.difficulty,
      source: row.source,
      check: row.check,
      checkReason: header.includes('checkReason') ? row.checkReason : '',
      questionImage: row.questionImage,
      answerImage: row.answerImage,
    }));
}

async function syncCardsFromCsv(importedRows) {
  const existingCards = await getAllCards();
  const existingByCardId = new Map();

  existingCards.forEach((card) => {
    const key = card.cardId || card.id;
    if (key) existingByCardId.set(key, card);
  });

  const importedIds = new Set();
  const deleteKeys = new Set();
  const upserts = importedRows.map((row) => {
    const cardId = row.cardId;
    const existing = existingByCardId.get(cardId);
    const now = new Date().toISOString();

    importedIds.add(cardId);

    if (existing) {
      if (existing.id !== cardId) deleteKeys.add(existing.id);

      const updated = {
        ...existing,
        id: cardId,
        cardId,
        updatedAt: now,
      };

      CONTENT_COLUMNS.forEach((column) => {
        updated[column] = row[column] || '';
      });

      return updated;
    }

    return {
      ...row,
      id: cardId,
      cardId,
      status: 'active',
      goodStreak: 0,
      totalGood: 0,
      totalMaybe: 0,
      totalBad: 0,
      nextReviewDate: todayString(),
      createdAt: now,
      updatedAt: now,
    };
  });

  existingCards.forEach((card) => {
    const key = card.cardId || card.id;
    if (!importedIds.has(key)) {
      deleteKeys.add(card.id);
    }
  });

  await replaceCards(upserts, [...deleteKeys]);
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

function studyQueueCards() {
  return dueCards().length
    ? dueCards()
    : cards.filter((card) => card.status !== 'graduated');
}

function pickNextCard() {
  const queue = studyQueueCards();
  if (!queue.length) {
    currentCard = cards[0] || null;
  } else if (!currentCard || !queue.some((card) => card.id === currentCard.id)) {
    currentCard = queue[0];
  } else {
    const index = queue.findIndex((card) => card.id === currentCard.id);
    currentCard = queue[(index + 1) % queue.length];
  }

  answerVisible = false;
  setStatus(currentCard ? '次のカードを表示中' : '出題できるカードがありません');
  renderStudyCard();
}

function render() {
  const due = dueCards().length;
  el.totalCount.textContent = String(cards.length);
  el.dueCount.textContent = String(due);
  el.dueCountInline.textContent = String(due);
  el.graduatedCount.textContent = String(cards.filter((card) => card.status === 'graduated').length);
  renderStudyCard();
  renderList();
}

function renderStudyCard() {
  if (!currentCard) {
    el.cardBox.classList.add('empty');
    el.cardMeta.textContent = cards.length ? '出題できるカードがありません' : 'CSVを読み込んでください';
    el.questionText.textContent = cards.length ? '復習待ちのカードはありません。' : 'まだカードがありません。';
    setTag(el.subjectTag, '', '');
    setTag(el.unitTag, '', '');
    setTag(el.difficultyTag, '', '');
    setCheckBadge(el.checkBadge, '');
    setCheckReason('');
    el.sourceText.textContent = '';
    el.sourceText.classList.add('hidden');
    el.answerArea.classList.add('hidden');
    el.answerText.textContent = '';
    el.explanationText.textContent = '';
    updateStudyButtons();
    return;
  }

  el.cardBox.classList.remove('empty');
  el.cardMeta.textContent = `次回 ${currentCard.nextReviewDate || todayString()}`;
  setTag(el.subjectTag, '科目', currentCard.subject);
  setTag(el.unitTag, '単元', currentCard.unit);
  setTag(el.difficultyTag, '難しさ', currentCard.difficulty);
  setCheckBadge(el.checkBadge, currentCard.check);
  setCheckReason(currentCard.checkReason);
  el.questionText.textContent = currentCard.question;

  if (currentCard.source) {
    el.sourceText.textContent = `${currentCard.source}から出題`;
    el.sourceText.classList.remove('hidden');
  } else {
    el.sourceText.textContent = '';
    el.sourceText.classList.add('hidden');
  }

  el.answerText.textContent = currentCard.answer;
  el.explanationText.textContent = currentCard.explanation || '';
  el.answerArea.classList.toggle('hidden', !answerVisible);
  updateStudyButtons();
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
    item.querySelector('.list-sub').textContent = `${card.subject || '-'} / ${card.unit || '-'} / ${card.status === 'graduated' ? '合格' : '学習中'} / ○連続 ${card.goodStreak || 0} / 次回 ${card.nextReviewDate || '-'}`;
    setCheckBadge(item.querySelector('.list-check'), card.check);
    item.addEventListener('click', () => {
      currentCard = card;
      answerVisible = false;
      setStatus('カードを選びました');
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
  await syncCardsFromCsv(imported);
  setStatus(`${imported.length}件を教材セットとして更新しました`);
  await reloadCards();
  currentCard = null;
  pickNextCard();
}

async function markCard(result) {
  if (!currentCard || !answerVisible) return;

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
  currentCard = updated;
  pickNextCard();
}

function exportJson() {
  const payload = {
    app: 'chuju-card',
    version: '0.3-cardid',
    exportedAt: new Date().toISOString(),
    cards,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `chuju-card-backup-${todayString()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function importJson(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  const imported = Array.isArray(payload) ? payload : payload.cards;
  if (!Array.isArray(imported)) {
    throw new Error('JSON形式が正しくありません');
  }

  await putCards(imported.filter((card) => {
    const key = card.cardId || card.id;
    return key && card.question && card.answer;
  }).map((card) => ({
    ...card,
    id: card.cardId || card.id,
    cardId: card.cardId || card.id,
  })));
  setStatus(`${imported.length}件を復元しました`);
  await reloadCards();
  currentCard = null;
  pickNextCard();
}

async function init() {
  db = await openDb();
  await reloadCards();
  currentCard = null;
  pickNextCard();
  setStatus('準備OK');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      setStatus('SW登録に失敗しました');
    });
  }
}

el.csvInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    await handleCsvFile(file);
  } catch (error) {
    alert(error.message || 'CSV読み込みに失敗しました');
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
    alert(error.message || 'JSON読み込みに失敗しました');
  } finally {
    event.target.value = '';
  }
});

el.exportJsonBtn.addEventListener('click', exportJson);
el.showAnswerBtn.addEventListener('click', () => {
  if (!currentCard) return;
  answerVisible = true;
  setStatus('答え表示');
  renderStudyCard();
});
el.nextCardBtn.addEventListener('click', () => {
  pickNextCard();
});
el.markGoodBtn.addEventListener('click', () => {
  markCard('good');
});
el.markMaybeBtn.addEventListener('click', () => {
  markCard('maybe');
});
el.markBadBtn.addEventListener('click', () => {
  markCard('bad');
});
el.clearAllBtn.addEventListener('click', async () => {
  const ok = confirm('読み込んだカードと学習記録をこの端末から削除します。JSONバックアップ済みですか？');
  if (!ok) return;

  await clearCards();
  currentCard = null;
  setStatus('全データを削除しました');
  await reloadCards();
});

init().catch((error) => {
  console.error(error);
  setStatus('起動に失敗しました');
  alert('起動に失敗しました。Safariの設定や端末の空き容量を確認してください。');
});
