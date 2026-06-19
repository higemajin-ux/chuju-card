const DB_NAME = 'chuju-card-db';
const DB_VERSION = 1;
const STORE_NAME = 'cards';
const RECENT_RESULTS_LIMIT = 5;
const REQUIRED_COLUMNS = [
  'cardId', 'subject', 'unit', 'type', 'question', 'choices', 'answer', 'explanation',
  'difficulty', 'source', 'check', 'checkReason', 'questionImage', 'answerImage',
];
const CONTENT_COLUMNS = [
  'subject', 'unit', 'type', 'question', 'answer', 'choices', 'explanation',
  'difficulty', 'source', 'check', 'checkReason', 'questionImage', 'answerImage',
  'sourceFileName', 'materialName',
];

let db;
let cards = [];
let currentCard = null;
let answerVisible = false;
let choiceFeedback = null;
let shuffledChoices = [];
let isChoiceCoverVisible = false;
let listFilter = 'all';
let isEditMode = false;
let editingCardId = null;
let activeMaterialName = '';
let isStudyVisible = false;
let isTodayWrongMode = false;
let studySessionTargetIds = [];
let studySessionCorrectIds = new Set();
let isStudySessionComplete = false;

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
  studyCompleteState: document.getElementById('studyCompleteState'),
  studyEmptyImage: document.getElementById('studyEmptyImage'),
  questionText: document.getElementById('questionText'),
  sourceText: document.getElementById('sourceText'),
  subjectTag: document.getElementById('subjectTag'),
  unitTag: document.getElementById('unitTag'),
  difficultyTag: document.getElementById('difficultyTag'),
  checkBadge: document.getElementById('checkBadge'),
  problemBadge: document.getElementById('problemBadge'),
  checkReasonText: document.getElementById('checkReasonText'),
  choiceArea: document.getElementById('choiceArea'),
  choiceButtons: document.getElementById('choiceButtons'),
  choiceResultText: document.getElementById('choiceResultText'),
  choiceCover: document.getElementById('choiceCover'),
  choiceRevealBtn: document.getElementById('choiceRevealBtn'),
  choiceNextBtn: document.getElementById('choiceNextBtn'),
  choiceManualBtn: document.getElementById('choiceManualBtn'),
  studyBody: document.getElementById('studyBody'),
  studyMain: document.getElementById('studyMain'),
  studySidebar: document.getElementById('studySidebar'),
  sidebarActions: document.getElementById('sidebarActions'),
  sidebarHistory: document.getElementById('sidebarHistory'),
  sidebarLegend: document.getElementById('sidebarLegend'),
  answerArea: document.getElementById('answerArea'),
  answerText: document.getElementById('answerText'),
  explanationText: document.getElementById('explanationText'),
  studyActions: document.getElementById('studyActions') || document.querySelector('.study-actions'),
  showAnswerBtn: document.getElementById('showAnswerBtn'),
  judgeActions: document.getElementById('judgeActions') || document.querySelector('.judge-actions'),
  problemFlagBtn: document.getElementById('problemFlagBtn'),
  nextCardBtn: document.getElementById('nextCardBtn'),
  markGoodBtn: document.getElementById('markGoodBtn'),
  markMaybeBtn: document.getElementById('markMaybeBtn'),
  markBadBtn: document.getElementById('markBadBtn'),
  studyPanel: document.querySelector('.study-panel'),
  listPanel: document.querySelector('.list-panel'),
  studyStartPanel: document.getElementById('studyStartPanel'),
  todayStudyBtn: document.getElementById('todayStudyBtn'),
  materialButtons: document.getElementById('materialButtons'),
  studyBackBtn: document.getElementById('studyBackBtn'),
  listFilterSelect: document.getElementById('listFilterSelect'),
  listSummary: document.getElementById('listSummary'),
  listScopeHint: document.getElementById('listScopeHint'),
  editModal: document.getElementById('editModal'),
  editQuestionInput: document.getElementById('editQuestionInput'),
  editChoicesInput: document.getElementById('editChoicesInput'),
  editAnswerInput: document.getElementById('editAnswerInput'),
  editExplanationInput: document.getElementById('editExplanationInput'),
  editCheckReasonInput: document.getElementById('editCheckReasonInput'),
  editSaveBtn: document.getElementById('editSaveBtn'),
  editCancelBtn: document.getElementById('editCancelBtn'),
  editModeBtn: document.getElementById('editModeBtn'),
  cardList: document.getElementById('cardList'),
  itemTemplate: document.getElementById('cardListItemTemplate'),
};

const WRONG_LABEL = '間違えた問題';
const WRONG_SHORT_LABEL = '間違い';

function renderWrongCountLabels() {
  if (el.dueCount?.parentElement) {
    el.dueCount.parentElement.replaceChildren(WRONG_LABEL, ' ', el.dueCount, ' 枚');
  }
  if (el.dueCountInline?.parentElement) {
    el.dueCountInline.parentElement.replaceChildren(WRONG_SHORT_LABEL, el.dueCountInline);
  }
}

function ensureChoiceElements() {
  const hasChoiceElements = el.choiceArea && el.choiceButtons && el.choiceResultText;

  if (!hasChoiceElements) {
    const choiceArea = el.choiceArea || document.createElement('div');
    choiceArea.id = choiceArea.id || 'choiceArea';
    choiceArea.className = choiceArea.className || 'choice-area hidden';

    const choiceResultText = el.choiceResultText || document.createElement('p');
    choiceResultText.id = choiceResultText.id || 'choiceResultText';
    choiceResultText.className = choiceResultText.className || 'choice-result hidden';

    const choiceButtons = el.choiceButtons || document.createElement('div');
    choiceButtons.id = choiceButtons.id || 'choiceButtons';
    choiceButtons.className = choiceButtons.className || 'choice-buttons';

    if (!choiceResultText.parentElement) choiceArea.appendChild(choiceResultText);
    if (!choiceButtons.parentElement) choiceArea.appendChild(choiceButtons);

    if (!choiceArea.parentElement) {
      if (el.answerArea?.parentElement) {
        el.answerArea.parentElement.insertBefore(choiceArea, el.answerArea);
      } else if (el.cardBox) {
        el.cardBox.appendChild(choiceArea);
      }
    }

    el.choiceArea = choiceArea;
    el.choiceButtons = choiceButtons;
    el.choiceResultText = choiceResultText;
  }

  if (!el.choiceNextBtn) {
    const choiceNextBtn = document.createElement('button');
    choiceNextBtn.id = 'choiceNextBtn';
    choiceNextBtn.type = 'button';
    choiceNextBtn.className = 'big-button primary answer-button choice-next-button hidden';
    choiceNextBtn.textContent = '次のカード';
    choiceNextBtn.addEventListener('click', () => {
      pickNextCard();
    });

    if (el.answerArea?.parentElement) {
      el.answerArea.parentElement.appendChild(choiceNextBtn);
    } else if (el.cardBox) {
      el.cardBox.appendChild(choiceNextBtn);
    }

    el.choiceNextBtn = choiceNextBtn;
  }

  if (!el.choiceManualBtn) {
    const choiceManualBtn = document.createElement('button');
    choiceManualBtn.id = 'choiceManualBtn';
    choiceManualBtn.type = 'button';
    choiceManualBtn.className = 'small-button choice-manual-button hidden';
    choiceManualBtn.textContent = '\u308f\u304b\u3089\u306a\u304b\u3063\u305f';
    choiceManualBtn.addEventListener('click', () => {
      markChoiceAnswerManual();
    });

    if (el.studySidebar) {
      el.studySidebar.insertBefore(choiceManualBtn, el.sidebarLegend || null);
    } else if (el.answerArea) {
      el.answerArea.appendChild(choiceManualBtn);
    } else if (el.cardBox) {
      el.cardBox.appendChild(choiceManualBtn);
    }

    el.choiceManualBtn = choiceManualBtn;
  }

  if (!el.choiceCover) {
    const choiceCover = document.createElement('div');
    choiceCover.id = 'choiceCover';
    choiceCover.className = 'choice-cover hidden';
    choiceCover.addEventListener('click', () => {
      revealChoiceCover();
    });

    const choiceRevealBtn = document.createElement('button');
    choiceRevealBtn.id = 'choiceRevealBtn';
    choiceRevealBtn.type = 'button';
    choiceRevealBtn.className = 'big-button choice-reveal-button';
    choiceRevealBtn.textContent = '選択肢を見る';
    choiceRevealBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      revealChoiceCover();
    });

    choiceCover.appendChild(choiceRevealBtn);
    el.choiceArea.appendChild(choiceCover);
    el.choiceCover = choiceCover;
    el.choiceRevealBtn = choiceRevealBtn;
  }
}

function ensureStudySidebarElements() {
  if (el.studyBody && el.studyMain && el.studySidebar) return;
  if (!el.studyPanel || !el.cardBox) return;

  const studyTop = el.studyPanel.querySelector('.study-top');
  if (!studyTop) return;

  const studyBody = document.createElement('div');
  studyBody.id = 'studyBody';
  studyBody.className = 'study-body';

  const studyMain = document.createElement('div');
  studyMain.id = 'studyMain';
  studyMain.className = 'study-main';

  [el.cardBox, el.studyActions, el.judgeActions]
    .filter(Boolean)
    .forEach((node) => studyMain.appendChild(node));

  const studySidebar = document.createElement('aside');
  studySidebar.id = 'studySidebar';
  studySidebar.className = 'study-sidebar';

  const sidebarHistory = document.createElement('div');
  sidebarHistory.id = 'sidebarHistory';
  sidebarHistory.className = 'sidebar-history';

  const sidebarActions = document.createElement('div');
  sidebarActions.id = 'sidebarActions';
  sidebarActions.className = 'sidebar-actions';

  const sidebarLegend = document.createElement('div');
  sidebarLegend.id = 'sidebarLegend';
  sidebarLegend.className = 'sidebar-legend';

  studySidebar.appendChild(sidebarHistory);
  studySidebar.appendChild(sidebarActions);
  studySidebar.appendChild(sidebarLegend);
  studyBody.appendChild(studyMain);
  studyBody.appendChild(studySidebar);
  studyTop.insertAdjacentElement('afterend', studyBody);

  el.studyBody = studyBody;
  el.studyMain = studyMain;
  el.studySidebar = studySidebar;
  el.sidebarActions = sidebarActions;
  el.sidebarHistory = sidebarHistory;
  el.sidebarLegend = sidebarLegend;
}

function ensureProblemFlagElements() {
  if (!el.problemBadge && el.checkBadge?.parentElement) {
    const problemBadge = document.createElement('span');
    problemBadge.id = 'problemBadge';
    problemBadge.className = 'problem-badge hidden';
    problemBadge.textContent = '⚠ 問題確認';
    el.checkBadge.parentElement.appendChild(problemBadge);
    el.problemBadge = problemBadge;
  }

  if (!el.problemFlagBtn) {
    const problemFlagBtn = document.createElement('button');
    problemFlagBtn.id = 'problemFlagBtn';
    problemFlagBtn.type = 'button';
    problemFlagBtn.className = 'quiet-button problem-flag-button hidden';
    problemFlagBtn.textContent = '⚠ 問題がおかしい';
    problemFlagBtn.addEventListener('click', () => {
      toggleProblemFlag();
    });

    if (el.sourceText?.parentElement) {
      el.sourceText.parentElement.appendChild(problemFlagBtn);
    } else if (el.cardBox) {
      el.cardBox.appendChild(problemFlagBtn);
    }

    el.problemFlagBtn = problemFlagBtn;
  }
}

function ensureListFilterElements() {
  if (el.listFilterSelect) return;

  const listTop = document.querySelector('.list-top');
  if (!listTop) return;

  const filterWrap = document.createElement('label');
  filterWrap.className = 'list-filter';
  filterWrap.textContent = '表示';

  const filterSelect = document.createElement('select');
  filterSelect.id = 'listFilterSelect';
  filterSelect.className = 'list-filter-select';

  [
    { value: 'all', label: 'すべて' },
    { value: 'problem', label: '問題確認あり' },
  ].forEach((optionData) => {
    const option = document.createElement('option');
    option.value = optionData.value;
    option.textContent = optionData.label;
    filterSelect.appendChild(option);
  });

  [
    { value: 'notGraduated', label: '未合格' },
    { value: 'graduated', label: '合格済み' },
  ].forEach((optionData) => {
    const option = document.createElement('option');
    option.value = optionData.value;
    option.textContent = optionData.label;
    filterSelect.appendChild(option);
  });

  filterSelect.value = listFilter;
  filterSelect.addEventListener('change', (event) => {
    listFilter = event.target.value;
    renderList();
  });

  filterWrap.appendChild(filterSelect);
  listTop.appendChild(filterWrap);
  el.listFilterSelect = filterSelect;
}

function ensureListScopeHintElement() {
  if (el.listScopeHint) return;

  const listTop = document.querySelector('.list-top');
  const headingWrap = listTop?.querySelector('div');
  if (!headingWrap) return;

  const scopeHint = document.createElement('p');
  scopeHint.id = 'listScopeHint';
  scopeHint.className = 'hint hidden';
  headingWrap.appendChild(scopeHint);
  el.listScopeHint = scopeHint;
}

function ensureListSummaryElement() {
  if (el.listSummary) return;

  const listTop = document.querySelector('.list-top');
  const headingWrap = listTop?.querySelector('div');
  if (!headingWrap) return;

  const summary = document.createElement('p');
  summary.id = 'listSummary';
  summary.className = 'list-summary hidden';
  const hint = headingWrap.querySelector('.hint');
  if (hint) {
    headingWrap.insertBefore(summary, hint);
  } else {
    headingWrap.appendChild(summary);
  }
  el.listSummary = summary;
}

function getCurrentListScopeLabel() {
  if (activeMaterialName) return activeMaterialName;
  if (isTodayWrongMode) return WRONG_LABEL;
  return '';
}

function buildEmptyStateMarkup(message) {
  return `<div class="empty-state"><img class="empty-state-image" src="./img/empty-state-card.png" alt="\u30ab\u30fc\u30c9\u306a\u3057"><p class="hint">${message}</p></div>`;
}

function resetStudySession() {
  studySessionTargetIds = [];
  studySessionCorrectIds = new Set();
  isStudySessionComplete = false;
}

function startStudySession(targetCards) {
  studySessionTargetIds = targetCards.map((card) => card.id).filter(Boolean);
  studySessionCorrectIds = new Set();
  isStudySessionComplete = false;
}

function markStudySessionCorrect(cardId) {
  if (!cardId || !studySessionTargetIds.includes(cardId)) return;
  studySessionCorrectIds.add(cardId);
  isStudySessionComplete = studySessionTargetIds.length > 0
    && studySessionCorrectIds.size >= studySessionTargetIds.length;
}

function ensureStudyCompleteStateElement() {
  if (el.studyCompleteState || !el.cardBox || !el.questionText) return;

  const completeState = document.createElement('div');
  completeState.id = 'studyCompleteState';
  completeState.className = 'study-complete hidden';
  completeState.innerHTML = '<img class="study-complete-icon" src="./img/success-star.png" alt="\u5168\u554f\u6b63\u89e3"><p class="study-complete-title">\u5168\u554f\u6b63\u89e3\uff01</p><p class="study-complete-text">\u4eca\u65e5\u306e\u5fa9\u7fd2\u306f\u3072\u3068\u307e\u305a\u5b8c\u4e86\u3067\u3059\u3002</p>';
  el.cardBox.insertBefore(completeState, el.questionText);
  el.studyCompleteState = completeState;
}

function ensureStudyBackButton() {
  if (el.studyBackBtn || !el.studyPanel) return;

  const appHeader = document.querySelector('.app-header');
  if (!appHeader) return;

  const backBtn = document.createElement('button');
  backBtn.id = 'studyBackBtn';
  backBtn.type = 'button';
  backBtn.className = 'quiet-button header-back-button hidden';
  backBtn.textContent = '教材一覧へ戻る';
  backBtn.addEventListener('click', () => {
    isStudyVisible = false;
    isTodayWrongMode = false;
    activeMaterialName = '';
    resetStudySession();
    currentCard = null;
    answerVisible = false;
    choiceFeedback = null;
    resetChoiceCover(null);
    render();
  });

  appHeader.appendChild(backBtn);
  el.studyBackBtn = backBtn;
}

function updateStudyVisibility() {
  setElementVisible(el.studyStartPanel, !isStudyVisible);
  setElementVisible(el.studyPanel, isStudyVisible);
  setElementVisible(el.listPanel, isStudyVisible);
  setElementVisible(el.studyBackBtn, isStudyVisible);
  setElementVisible(el.saveStatus, false);
}

function ensureStudyStartElements() {
  if (el.studyStartPanel && el.todayStudyBtn && el.materialButtons) return;

  const main = document.querySelector('main');
  const studyPanel = document.querySelector('.study-panel');
  if (!main || !studyPanel) return;

  const panel = document.createElement('section');
  panel.id = 'studyStartPanel';
  panel.className = 'panel start-panel';

  const title = document.createElement('h2');
  title.className = 'start-title';
  title.textContent = '教材から選ぶ';

  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = '教材を選ぶと、その教材の問題だけを解けます。';

  const materialHeading = document.createElement('p');
  materialHeading.className = 'start-subtitle';
  materialHeading.textContent = '教材';

  const todayBtn = document.createElement('button');
  todayBtn.id = 'todayStudyBtn';
  todayBtn.type = 'button';
  todayBtn.className = 'big-button secondary-button start-button';
  todayBtn.textContent = WRONG_LABEL;
  todayBtn.addEventListener('click', () => {
    startTodayStudy();
  });

  const materialButtons = document.createElement('div');
  materialButtons.id = 'materialButtons';
  materialButtons.className = 'material-buttons';

  panel.appendChild(title);
  panel.appendChild(hint);
  panel.appendChild(todayBtn);
  panel.appendChild(materialHeading);
  panel.appendChild(materialButtons);
  main.insertBefore(panel, studyPanel);

  el.studyStartPanel = panel;
  el.todayStudyBtn = todayBtn;
  el.materialButtons = materialButtons;
}

function ensureEditModalElements() {
  if (el.editModal) return;

  const modal = document.createElement('div');
  modal.id = 'editModal';
  modal.className = 'edit-modal hidden';

  const dialog = document.createElement('div');
  dialog.className = 'edit-dialog';
  dialog.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  const title = document.createElement('h3');
  title.className = 'edit-title';
  title.textContent = 'カード編集';
  dialog.appendChild(title);

  const fields = [
    ['問題文', 'editQuestionInput'],
    ['選択肢', 'editChoicesInput'],
    ['正解', 'editAnswerInput'],
    ['解説', 'editExplanationInput'],
    ['確認理由', 'editCheckReasonInput'],
  ];

  fields.forEach(([labelText, id]) => {
    const label = document.createElement('label');
    label.className = 'edit-field';
    label.textContent = labelText;

    const input = document.createElement(id === 'editAnswerInput' ? 'input' : 'textarea');
    input.id = id;
    input.className = 'edit-input';
    if (id === 'editAnswerInput') {
      input.type = 'text';
    } else {
      input.rows = id === 'editQuestionInput' ? 3 : 4;
    }

    label.appendChild(input);
    dialog.appendChild(label);
    el[id] = input;
  });

  const actions = document.createElement('div');
  actions.className = 'edit-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.id = 'editCancelBtn';
  cancelBtn.type = 'button';
  cancelBtn.className = 'quiet-button';
  cancelBtn.textContent = 'キャンセル';
  cancelBtn.addEventListener('click', () => {
    closeEditModal();
  });

  const saveBtn = document.createElement('button');
  saveBtn.id = 'editSaveBtn';
  saveBtn.type = 'button';
  saveBtn.className = 'small-button primary';
  saveBtn.textContent = '保存';
  saveBtn.addEventListener('click', async () => {
    await saveCardEdit();
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  dialog.appendChild(actions);

  modal.appendChild(dialog);
  modal.addEventListener('click', () => {
    closeEditModal();
  });
  document.body.appendChild(modal);

  el.editModal = modal;
  el.editSaveBtn = saveBtn;
  el.editCancelBtn = cancelBtn;
  closeEditModal();
}

function ensureEditModeButton() {
  if (el.editModeBtn) return;

  const dataFooter = document.querySelector('.data-footer');
  if (!dataFooter) return;

  const editModeBtn = document.createElement('button');
  editModeBtn.id = 'editModeBtn';
  editModeBtn.type = 'button';
  editModeBtn.className = 'quiet-button edit-mode-button';
  editModeBtn.addEventListener('click', () => {
    isEditMode = !isEditMode;
    if (!isEditMode) {
      closeEditModal();
    }
    updateEditModeButton();
    renderMaterialButtons();
    renderList();
  });

  dataFooter.appendChild(editModeBtn);
  el.editModeBtn = editModeBtn;
  updateEditModeButton();
}

function updateEditModeButton() {
  if (!el.editModeBtn) return;
  el.editModeBtn.textContent = isEditMode ? '編集モード終了' : '編集モード';
  el.editModeBtn.classList.toggle('is-active', isEditMode);
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeCsvValue(value) {
  return (value || '').replace(/^\uFEFF/, '').trim();
}

function materialNameFromFileName(fileName) {
  const normalized = (fileName || '').trim().replace(/\.csv$/i, '');
  if (!normalized) return '';
  const separatorIndex = normalized.indexOf('_');
  return separatorIndex >= 0 ? normalized.slice(0, separatorIndex).trim() : normalized;
}

function materialNameFromSource(source) {
  const normalized = (source || '').trim();
  if (!normalized) return '';
  const match = normalized.match(/^(.*?)\s+p\d+/i);
  return (match?.[1] || normalized).trim();
}

function getCardMaterialName(card) {
  return (card?.materialName || '').trim()
    || materialNameFromFileName(card?.sourceFileName || '')
    || materialNameFromSource(card?.source || '');
}

function getMaterialCardCounts(materialName) {
  const materialCards = cards.filter((card) => getCardMaterialName(card) === materialName);
  const total = materialCards.length;
  const notGraduated = materialCards.filter((card) => card?.graduated !== true).length;
  const graduated = materialCards.filter((card) => card?.graduated === true).length;
  return { total, notGraduated, graduated };
}

function getStudyCardLabel(card) {
  if (!card) return '';
  const subject = (card.subject || '').trim();
  const materialName = getCardMaterialName(card);
  const normalizedMaterialName = materialName.startsWith(subject)
    ? materialName.slice(subject.length).trimStart()
    : materialName;
  return [subject, normalizedMaterialName]
    .map((value) => (value || '').trim())
    .filter(Boolean)
    .join('\u3000');
}

function scrollStudyCardIntoView() {
  const target = el.questionText || el.cardBox;
  if (!target) return;
  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function setStatus(message) {
  el.saveStatus.textContent = message;
}

function setElementVisible(element, visible) {
  if (!element) return;
  element.hidden = !visible;
  element.style.display = visible ? '' : 'none';
  element.classList.toggle('hidden', !visible);
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

function normalizeRecentResults(card) {
  if (!Array.isArray(card?.recentResults)) return [];
  return card.recentResults
    .filter((result) => result === 'correct' || result === 'wrong' || result === 'manual')
    .slice(-RECENT_RESULTS_LIMIT);
}

function appendRecentResult(card, result) {
  return [...normalizeRecentResults(card), result].slice(-RECENT_RESULTS_LIMIT);
}

function isTodayStudyTarget(card) {
  const recentResults = normalizeRecentResults(card);
  if (!recentResults.length) return false;
  if (card?.graduated === true || card?.status === 'graduated') return false;
  return recentResults[recentResults.length - 1] === 'wrong';
}

function isProblemFlagged(card) {
  return Boolean(card?.problemFlag);
}

function normalizeChoicesText(value) {
  return (value || '')
    .split(/\r?\n|\|/)
    .map((choice) => choice.trim())
    .filter(Boolean)
    .join('|');
}

function resetCardProgressState(card) {
  const updated = {
    ...card,
    recentResults: [],
    nextReviewDate: '',
    status: 'active',
    updatedAt: new Date().toISOString(),
  };

  ['goodStreak', 'totalGood', 'totalMaybe', 'totalBad', 'correctCount', 'wrongCount', 'reviewCount', 'successCount', 'failCount']
    .forEach((key) => {
      if (key in updated) updated[key] = 0;
    });

  ['lastReviewedAt', 'lastAnsweredAt']
    .forEach((key) => {
      if (key in updated) updated[key] = '';
    });

  if ('graduated' in updated) updated.graduated = false;

  return updated;
}

function isCardGraduated(card) {
  const recentResults = normalizeRecentResults(card);
  if (card.status === 'graduated') return true;
  if (recentResults.length < RECENT_RESULTS_LIMIT) return false;
  return recentResults.filter((result) => result === 'correct').length >= 4;
}

function buildRecentResultsBar(container, card) {
  const recentResults = normalizeRecentResults(card);
  const paddedResults = [
    ...Array(Math.max(RECENT_RESULTS_LIMIT - recentResults.length, 0)).fill('empty'),
    ...recentResults,
  ];

  container.innerHTML = '';
  paddedResults.forEach((result) => {
    const segment = document.createElement('span');
    segment.className = `history-segment is-${result}`;
    segment.setAttribute('aria-hidden', 'true');
    container.appendChild(segment);
  });
}

function parseChoices(card) {
  if (!card?.choices) return [];
  return card.choices
    .split('|')
    .map((choice) => choice.trim())
    .filter(Boolean);
}

function shuffleArray(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function setDisplayedChoices(card) {
  shuffledChoices = isChoiceCard(card) ? shuffleArray(parseChoices(card)) : [];
}

function resetChoiceCover(card) {
  isChoiceCoverVisible = isChoiceCard(card);
}

function revealChoiceCover() {
  if (!currentCard || !isChoiceCard(currentCard)) return;
  isChoiceCoverVisible = false;
  renderStudyCard();
}

function canMarkChoiceAnswerManual(card = currentCard) {
  if (!card || !isChoiceCard(card) || !choiceFeedback?.isCorrect || !answerVisible) return false;
  const recentResults = normalizeRecentResults(card);
  return recentResults[recentResults.length - 1] === 'correct';
}

function renderSidebarHistory() {
  if (!el.sidebarHistory) return;

  const recentResults = normalizeRecentResults(currentCard);
  const paddedResults = [
    ...Array(Math.max(RECENT_RESULTS_LIMIT - recentResults.length, 0)).fill('empty'),
    ...recentResults,
  ];
  const historyLabels = ['5回前', '4回前', '3回前', '前回', '今回'];

  el.sidebarHistory.innerHTML = '';

  const title = document.createElement('p');
  title.className = 'sidebar-section-title';
  title.textContent = '最近の成績';
  el.sidebarHistory.appendChild(title);

  paddedResults.forEach((result, index) => {
    const row = document.createElement('div');
    row.className = 'sidebar-history-row';

    const label = document.createElement('span');
    label.className = 'sidebar-history-label';
    label.textContent = historyLabels[index] || '';

    const mark = document.createElement('span');
    mark.className = `sidebar-history-mark is-${result}`;
    mark.textContent = ({
      correct: '○',
      wrong: '×',
      manual: '△',
      empty: '－',
    })[result] || '－';

    row.appendChild(label);
    row.appendChild(mark);
    el.sidebarHistory.appendChild(row);
  });
}

function renderSidebarLegend() {
  if (!el.sidebarLegend) return;

  el.sidebarLegend.innerHTML = '';

  [
    { key: 'correct', label: '正解' },
    { key: 'wrong', label: '不正解' },
    { key: 'manual', label: 'わからなかった' },
    { key: 'empty', label: '未回答' },
  ].forEach((item) => {
    const row = document.createElement('div');
    row.className = 'sidebar-legend-row';

    const mark = document.createElement('span');
    mark.className = `sidebar-legend-mark is-${item.key}`;
    mark.textContent = ({ correct: '○', wrong: '×', manual: '△', empty: '－' })[item.key] || '－';

    const text = document.createElement('span');
    text.textContent = item.label;

    row.appendChild(mark);
    row.appendChild(text);
    el.sidebarLegend.appendChild(row);
  });
}

function renderStudySidebar() {
  if (!el.studySidebar) return;

  setElementVisible(el.studySidebar, Boolean(currentCard));
  if (el.nextCardBtn) {
    el.nextCardBtn.textContent = '\u6B21\u306E\u554F\u984C';
    el.nextCardBtn.classList.add('sidebar-next-button');
  }
  if (el.sidebarActions) {
    if (el.choiceManualBtn?.parentElement !== el.sidebarActions) {
      el.sidebarActions.appendChild(el.choiceManualBtn);
    }
    if (el.nextCardBtn?.parentElement !== el.sidebarActions) {
      el.sidebarActions.appendChild(el.nextCardBtn);
    }
  }
  renderSidebarHistory();
  renderSidebarLegend();
}

function isChoiceCard(card) {
  return parseChoices(card).length > 0;
}

function updateStudyButtons() {
  const hasCard = Boolean(currentCard);
  const choiceCard = isChoiceCard(currentCard);
  el.showAnswerBtn.disabled = !hasCard || answerVisible || choiceCard;
  el.nextCardBtn.disabled = cards.length === 0 || (choiceCard && !choiceFeedback);
  el.markGoodBtn.disabled = !hasCard || !answerVisible || choiceCard;
  el.markMaybeBtn.disabled = !hasCard || !answerVisible || choiceCard;
  el.markBadBtn.disabled = !hasCard || !answerVisible || choiceCard;
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

function csvRowsToCards(rows, fileName = '') {
  if (rows.length < 2) return [];

  const header = rows[0].map((name) => normalizeCsvValue(name));
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
        row[key] = normalizeCsvValue(values[index]);
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
      choices: header.includes('choices') ? (row.choices || '') : '',
      explanation: row.explanation,
      difficulty: row.difficulty,
      source: row.source,
      check: row.check,
      checkReason: header.includes('checkReason') ? row.checkReason : '',
      questionImage: row.questionImage,
      answerImage: row.answerImage,
      sourceFileName: fileName || '',
      materialName: materialNameFromFileName(fileName) || materialNameFromSource(row.source),
    }));
}

async function syncCardsFromCsv(importedRows) {
  const existingCards = await getAllCards();
  const existingByCardId = new Map();

  existingCards.forEach((card) => {
    const key = card.cardId || card.id;
    if (key) existingByCardId.set(key, card);
  });

  const deleteKeys = new Set();
  const upserts = importedRows.map((row) => {
    const cardId = row.cardId;
    const existing = existingByCardId.get(cardId);
    const now = new Date().toISOString();

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
      recentResults: [],
      goodStreak: 0,
      totalGood: 0,
      totalMaybe: 0,
      totalBad: 0,
      nextReviewDate: todayString(),
      createdAt: now,
      updatedAt: now,
    };
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
  return cards.filter((card) => {
    const matchesMaterial = !activeMaterialName || getCardMaterialName(card) === activeMaterialName;
    return matchesMaterial && card.status !== 'graduated' && (!card.nextReviewDate || card.nextReviewDate <= today);
  });
}

function studyQueueCards() {
  if (isTodayWrongMode) {
    return cards.filter((card) => isTodayStudyTarget(card));
  }

  const allTargetCards = cards.filter((card) => {
    const matchesMaterial = !activeMaterialName || getCardMaterialName(card) === activeMaterialName;
    return matchesMaterial && card.status !== 'graduated';
  });

  return dueCards().length
    ? dueCards()
    : allTargetCards;
}

function pickNextCard() {
  const queue = studyQueueCards();
  if (!queue.length) {
    currentCard = isStudySessionComplete
      ? null
      : (activeMaterialName || isTodayWrongMode ? null : (cards[0] || null));
  } else if (!currentCard || !queue.some((card) => card.id === currentCard.id)) {
    currentCard = queue[0];
  } else {
    const index = queue.findIndex((card) => card.id === currentCard.id);
    currentCard = queue[(index + 1) % queue.length];
  }

  answerVisible = false;
  choiceFeedback = null;
  resetChoiceCover(currentCard);
  setDisplayedChoices(currentCard);
  setStatus(currentCard ? '' : '出題できるカードがありません');
  renderStudyCard();
}

function startStudyForMaterial(materialName) {
  activeMaterialName = materialName || '';
  isTodayWrongMode = false;
  isStudyVisible = true;
  updateStudyVisibility();
  renderMaterialButtons();
  renderList();
  const queue = studyQueueCards();
  if (!queue.length) {
    resetStudySession();
    setStatus(activeMaterialName ? 'この教材の出題対象カードはありません' : '出題できるカードがありません');
    return;
  }

  startStudySession(queue);
  currentCard = null;
  pickNextCard();
  scrollStudyCardIntoView();
}

function startTodayStudy() {
  activeMaterialName = '';
  isTodayWrongMode = true;
  const queue = studyQueueCards();
  if (!queue.length) {
    resetStudySession();
    isStudyVisible = false;
    currentCard = null;
    answerVisible = false;
    choiceFeedback = null;
    updateStudyVisibility();
    renderMaterialButtons();
    renderList();
    renderStudyCard();
    setStatus('出題できるカードがありません');
    return;
  }

  isStudyVisible = true;
  updateStudyVisibility();
  renderMaterialButtons();
  renderList();
  startStudySession(queue);
  currentCard = null;
  pickNextCard();
  scrollStudyCardIntoView();
}

async function deleteCardsByMaterial(materialName) {
  const normalizedMaterialName = (materialName || '').trim();
  if (!normalizedMaterialName) return;

  const confirmed = window.confirm(`教材「${normalizedMaterialName}」のカードをすべて削除します。学習履歴も消えます。よろしいですか？`);
  if (!confirmed) return;

  const targetCards = cards.filter((card) => getCardMaterialName(card) === normalizedMaterialName);
  if (!targetCards.length) {
    setStatus(`教材「${normalizedMaterialName}」のカードは見つかりませんでした`);
    return;
  }

  const deleteKeys = targetCards.map((card) => card.id).filter(Boolean);
  const shouldResetActiveMaterial = activeMaterialName === normalizedMaterialName;
  const shouldClearCurrentCard = deleteKeys.includes(currentCard?.id);
  const shouldCloseEdit = deleteKeys.includes(editingCardId);

  await replaceCards([], deleteKeys);

  if (shouldResetActiveMaterial) {
    activeMaterialName = '';
  }
  if (shouldClearCurrentCard) {
    currentCard = null;
    answerVisible = false;
    choiceFeedback = null;
  }
  if (shouldCloseEdit) {
    closeEditModal();
  }

  await reloadCards();
  setStatus(`教材「${normalizedMaterialName}」を削除しました`);
}

function renderMaterialButtons() {
  if (!el.materialButtons || !el.todayStudyBtn) return;

  const materialNames = [...new Set(
    cards.map((card) => getCardMaterialName(card)).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'ja'));

  el.todayStudyBtn.classList.toggle('is-active', !activeMaterialName);
  el.materialButtons.innerHTML = '';

  if (!materialNames.length) {
    el.materialButtons.innerHTML = '<p class="hint">教材ボタンはCSV読み込み後に表示されます。</p>';
    return;
  }

  materialNames.forEach((materialName) => {
    const counts = getMaterialCardCounts(materialName);
    const item = document.createElement('div');
    item.className = 'material-button-item';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'big-button secondary-button material-button';
    button.classList.toggle('is-active', activeMaterialName === materialName);
    button.addEventListener('click', () => {
      startStudyForMaterial(materialName);
    });

    const label = document.createElement('span');
    label.className = 'material-button-label';
    label.textContent = materialName;

    const summary = document.createElement('span');
    summary.className = 'material-button-summary';
    summary.textContent = `\u5168${counts.total}\uFF5C\u672A\u5408\u683C${counts.notGraduated}\uFF5C\u5408\u683C${counts.graduated}`;

    button.appendChild(label);
    button.appendChild(summary);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'quiet-button material-delete-button';
    deleteButton.textContent = '削除';
    deleteButton.setAttribute('aria-label', `教材「${materialName}」を削除`);
    deleteButton.addEventListener('click', async (event) => {
      event.stopPropagation();
      await deleteCardsByMaterial(materialName);
    });

    item.appendChild(button);
    if (isEditMode) {
      item.appendChild(deleteButton);
    }
    el.materialButtons.appendChild(item);
  });
}

function render() {
  const due = dueCards().length;
  el.totalCount.textContent = String(cards.length);
  renderWrongCountLabels();
  el.dueCount.textContent = String(due);
  el.dueCountInline.textContent = String(due);
  el.graduatedCount.textContent = String(cards.filter((card) => isCardGraduated(card)).length);
  updateStudyVisibility();
  renderMaterialButtons();
  renderStudyCard();
  renderList();
}

function renderStudyCard() {
  if (!currentCard) {
    el.cardBox.classList.add('empty');
    resetChoiceCover(null);
    const isCompleteStateVisible = isStudySessionComplete && studySessionTargetIds.length > 0;
    setElementVisible(el.studyCompleteState, isCompleteStateVisible);
    setElementVisible(el.studyEmptyImage, !isCompleteStateVisible);
    setElementVisible(el.questionText, !isCompleteStateVisible);
    const modeLabel = activeMaterialName ? `教材: ${activeMaterialName}` : WRONG_LABEL;
    el.cardMeta.textContent = isCompleteStateVisible
      ? (getCurrentListScopeLabel() || modeLabel)
      : (cards.length ? `${modeLabel} / 出題できるカードがありません` : 'CSVを読み込んでください');
    el.questionText.textContent = cards.length ? '復習待ちのカードはありません。' : 'まだカードがありません。';
    setTag(el.subjectTag, '', '');
    setTag(el.unitTag, '', '');
    setTag(el.difficultyTag, '', '');
    setCheckBadge(el.checkBadge, '');
    setElementVisible(el.problemBadge, false);
    setCheckReason('');
    el.sourceText.textContent = '';
    el.sourceText.classList.add('hidden');
    setElementVisible(el.choiceArea, false);
    el.choiceArea.classList.remove('is-covered');
    el.choiceButtons.innerHTML = '';
    el.choiceResultText.textContent = '';
    el.choiceResultText.className = 'choice-result hidden';
    setElementVisible(el.studyActions, false);
    setElementVisible(el.judgeActions, false);
    setElementVisible(el.answerArea, false);
    setElementVisible(el.choiceNextBtn, false);
    setElementVisible(el.choiceManualBtn, false);
    setElementVisible(el.choiceCover, false);
    setElementVisible(el.problemFlagBtn, false);
    el.answerText.textContent = '';
    el.explanationText.textContent = '';
    updateStudyButtons();
    renderStudySidebar();
    return;
  }

  el.cardBox.classList.remove('empty');
  setElementVisible(el.studyCompleteState, false);
  setElementVisible(el.studyEmptyImage, false);
  setElementVisible(el.questionText, true);
  const modeLabel = activeMaterialName ? `教材: ${activeMaterialName}` : WRONG_LABEL;
  el.cardMeta.textContent = `${modeLabel} / 次回 ${currentCard.nextReviewDate || todayString()}`;
  setTag(el.subjectTag, '科目', currentCard.subject);
  setTag(el.unitTag, '単元', currentCard.unit);
  setTag(el.difficultyTag, '難しさ', currentCard.difficulty);
  el.cardMeta.textContent = getStudyCardLabel(currentCard) || modeLabel;
  setTag(el.subjectTag, '', '');
  setTag(el.unitTag, '', '');
  setTag(el.difficultyTag, '', '');
  setCheckBadge(el.checkBadge, currentCard.check);
  setElementVisible(el.problemBadge, isProblemFlagged(currentCard));
  setCheckReason(currentCard.checkReason);
  el.questionText.textContent = currentCard.question;
  setElementVisible(el.choiceArea, isChoiceCard(currentCard));
  setElementVisible(el.studyActions, !isChoiceCard(currentCard));
  setElementVisible(el.judgeActions, !isChoiceCard(currentCard));
  setElementVisible(el.choiceCover, isChoiceCard(currentCard) && isChoiceCoverVisible);
  el.choiceArea.classList.toggle('is-covered', isChoiceCard(currentCard) && isChoiceCoverVisible);

  if (currentCard.source) {
    el.sourceText.textContent = `${currentCard.source}から出題`;
    el.sourceText.classList.remove('hidden');
  } else {
    el.sourceText.textContent = '';
    el.sourceText.classList.add('hidden');
  }

  el.sourceText.textContent = '';
  el.sourceText.classList.add('hidden');
  el.answerText.textContent = currentCard.answer;
  el.explanationText.textContent = currentCard.explanation || '';
  renderChoiceButtons(shuffledChoices, currentCard.answer);
  setElementVisible(el.answerArea, answerVisible);
  setElementVisible(el.choiceNextBtn, false);
  setElementVisible(el.choiceManualBtn, canMarkChoiceAnswerManual(currentCard));
  setElementVisible(el.problemFlagBtn, true);
  el.problemFlagBtn.classList.toggle('is-active', isProblemFlagged(currentCard));
  updateStudyButtons();
  renderStudySidebar();
}

function renderChoiceButtons(choices, answer) {
  el.choiceButtons.innerHTML = '';

  if (!choices.length) {
    el.choiceResultText.textContent = '';
    el.choiceResultText.className = 'choice-result hidden';
    return;
  }

  if (choiceFeedback) {
    el.choiceResultText.textContent = choiceFeedback.isCorrect ? '正解' : `不正解 正解: ${answer}`;
    el.choiceResultText.className = `choice-result ${choiceFeedback.isCorrect ? 'is-correct' : 'is-wrong'}`;
  } else {
    el.choiceResultText.textContent = '';
    el.choiceResultText.className = 'choice-result hidden';
  }

  choices.forEach((choice) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'big-button choice-button';
    button.textContent = choice;
    button.disabled = Boolean(choiceFeedback);

    if (choiceFeedback) {
      if (choice === answer) {
        button.classList.add('is-correct');
      } else if (!choiceFeedback.isCorrect && choice === choiceFeedback.selectedChoice) {
        button.classList.add('is-selected-wrong');
      }
    }

    button.addEventListener('click', () => {
      handleChoiceAnswer(choice);
    });
    el.choiceButtons.appendChild(button);
  });
}

function renderList() {
  el.cardList.innerHTML = '';
  const filteredCards = cards.filter((card) => {
    const matchesMaterial = isTodayWrongMode
      ? isTodayStudyTarget(card)
      : (!activeMaterialName || getCardMaterialName(card) === activeMaterialName);
    if (!matchesMaterial) return false;
    if (listFilter === 'problem') return isProblemFlagged(card);
    if (listFilter === 'notGraduated') return card?.graduated !== true;
    if (listFilter === 'graduated') return card?.graduated === true;
    return true;
  });
  const scopeLabel = getCurrentListScopeLabel();
  if (el.listScopeHint) {
    if (scopeLabel) {
      el.listScopeHint.textContent = `\u8868\u793a\u4E2D: ${scopeLabel}`;
      el.listScopeHint.classList.remove('hidden');
    } else {
      el.listScopeHint.textContent = '';
      el.listScopeHint.classList.add('hidden');
    }
  }
  if (el.listSummary) {
    if (cards.length) {
      const total = filteredCards.length;
      const notGraduated = filteredCards.filter((card) => card?.graduated !== true).length;
      const graduated = filteredCards.filter((card) => card?.graduated === true).length;
      const summaryLabel = scopeLabel || '\u3059\u3079\u3066';
      el.listSummary.textContent = `${summaryLabel}\u3000\u5168${total}\uFF5C\u672A\u5408\u683C${notGraduated}\uFF5C\u5408\u683C${graduated}`;
      el.listSummary.classList.remove('hidden');
    } else {
      el.listSummary.textContent = '';
      el.listSummary.classList.add('hidden');
    }
  }
  if (!cards.length) {
    el.cardList.innerHTML = buildEmptyStateMarkup('\u30ab\u30fc\u30c9\u4e00\u89a7\u306f\u307e\u3060\u7a7a\u3067\u3059\u3002');
    return;
  }

  if (!filteredCards.length && activeMaterialName) {
    el.cardList.innerHTML = buildEmptyStateMarkup('\u3053\u306e\u6559\u6750\u306e\u6761\u4ef6\u306b\u5408\u3046\u30ab\u30fc\u30c9\u306f\u3042\u308a\u307e\u305b\u3093');
    return;
  }

  if (!filteredCards.length) {
    el.cardList.innerHTML = buildEmptyStateMarkup('\u554f\u984c\u78ba\u8a8d\u4e2d\u306e\u30ab\u30fc\u30c9\u306f\u3042\u308a\u307e\u305b\u3093');
    return;
  }

  filteredCards.forEach((card) => {
    const row = document.createElement('div');
    row.className = 'list-row';
    const item = el.itemTemplate.content.firstElementChild.cloneNode(true);
    const recentResults = normalizeRecentResults(card);
    const correctCount = recentResults.filter((result) => result === 'correct').length;
    buildRecentResultsBar(item.querySelector('.list-history'), card);
    item.querySelector('.list-title').textContent = card.question;
    item.querySelector('.list-sub').textContent = `${card.subject || '-'} / ${card.unit || '-'} / ${isCardGraduated(card) ? '合格' : '学習中'} / 直近 ${correctCount}/${RECENT_RESULTS_LIMIT} / 次回 ${card.nextReviewDate || '-'}`;
    setCheckBadge(item.querySelector('.list-check'), card.check);
    const listProblemBadge = document.createElement('span');
    listProblemBadge.className = `list-problem problem-badge${isProblemFlagged(card) ? '' : ' hidden'}`;
    listProblemBadge.textContent = '⚠ 問題確認';
    item.appendChild(listProblemBadge);
    item.addEventListener('click', () => {
      currentCard = card;
      answerVisible = false;
      choiceFeedback = null;
      resetChoiceCover(currentCard);
      setDisplayedChoices(currentCard);
      setStatus('カードを選びました');
      renderStudyCard();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    row.appendChild(item);
    if (isEditMode) {
      const actionWrap = document.createElement('div');
      actionWrap.className = 'list-admin-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'small-button edit-card-button';
      editBtn.textContent = '編集';
      editBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        openEditModal(card.id);
      });

      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'small-button reset-card-button';
      resetBtn.textContent = '正誤リセット';
      resetBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        await resetCardProgress(card.id);
      });

      actionWrap.appendChild(editBtn);
      actionWrap.appendChild(resetBtn);
      row.appendChild(actionWrap);
    }
    el.cardList.appendChild(row);
  });
}

async function handleCsvFile(file) {
  const text = await file.text();
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  const imported = csvRowsToCards(rows, file.name);
  const blankChoicesCount = imported.filter((card) => !(card.choices || '').trim()).length;
  await syncCardsFromCsv(imported);
  setStatus(`読み込み完了: ${imported.length}件（choices空欄 ${blankChoicesCount}件）`);
  await reloadCards();
  currentCard = null;
  pickNextCard();
}

async function markCard(result, options = {}) {
  if (!currentCard || !answerVisible) return;

  const { advance = true } = options;
  const currentCardId = currentCard.id;
  const nextDays = { good: 7, maybe: 3, bad: 1 }[result];
  const updated = { ...currentCard, updatedAt: new Date().toISOString() };
  updated.recentResults = appendRecentResult(updated, result === 'good' ? 'correct' : 'wrong');

  if (result === 'good') {
    updated.totalGood = (updated.totalGood || 0) + 1;
    updated.goodStreak = (updated.goodStreak || 0) + 1;
    updated.nextReviewDate = addDays(nextDays);
  } else if (result === 'maybe') {
    updated.totalMaybe = (updated.totalMaybe || 0) + 1;
    updated.goodStreak = 0;
    updated.nextReviewDate = addDays(nextDays);
  } else {
    updated.totalBad = (updated.totalBad || 0) + 1;
    updated.goodStreak = 0;
    updated.nextReviewDate = addDays(nextDays);
  }

  if (updated.status !== 'graduated') {
    updated.status = isCardGraduated(updated) ? 'graduated' : 'active';
  }

  await putCards([updated]);
  setStatus('');
  if (result === 'good') {
    markStudySessionCorrect(currentCardId);
  }
  await reloadCards();
  currentCard = cards.find((card) => card.id === currentCardId) || updated;
  if (advance) {
    pickNextCard();
  } else {
    renderStudyCard();
  }
}

async function markChoiceAnswerManual() {
  if (!currentCard || !canMarkChoiceAnswerManual(currentCard)) return;

  const currentCardId = currentCard.id;
  const recentResults = normalizeRecentResults(currentCard);
  const updated = { ...currentCard, updatedAt: new Date().toISOString() };
  updated.recentResults = [...recentResults.slice(0, -1), 'manual'];

  if (typeof updated.totalGood === 'number' && updated.totalGood > 0) {
    updated.totalGood -= 1;
  }
  updated.totalMaybe = (updated.totalMaybe || 0) + 1;
  updated.goodStreak = 0;
  updated.nextReviewDate = addDays(3);
  updated.status = isCardGraduated(updated) ? 'graduated' : 'active';
  if ('graduated' in updated) updated.graduated = updated.status === 'graduated';

  await putCards([updated]);
  setStatus('\u308f\u304b\u3089\u306a\u304b\u3063\u305f\u3068\u3057\u3066\u8a18\u9332\u3057\u307e\u3057\u305f');
  await reloadCards();
  currentCard = cards.find((card) => card.id === currentCardId) || updated;
  renderStudyCard();
}

async function handleChoiceAnswer(selectedChoice) {
  if (!currentCard || !isChoiceCard(currentCard) || isChoiceCoverVisible || answerVisible) return;

  choiceFeedback = {
    selectedChoice,
    isCorrect: selectedChoice === currentCard.answer,
  };
  answerVisible = true;
  renderStudyCard();
  await markCard(choiceFeedback.isCorrect ? 'good' : 'bad', { advance: false });
}

async function toggleProblemFlag() {
  if (!currentCard) return;

  const updated = {
    ...currentCard,
    problemFlag: !isProblemFlagged(currentCard),
    updatedAt: new Date().toISOString(),
  };

  await putCards([updated]);
  currentCard = updated;
  setStatus(updated.problemFlag ? '問題確認にしました' : '問題確認を解除しました');
  await reloadCards();
  currentCard = cards.find((card) => card.id === updated.id) || updated;
  renderStudyCard();
}

async function resetCardProgress(cardId) {
  const card = cards.find((item) => item.id === cardId);
  if (!card || !isEditMode) return;

  const confirmed = window.confirm('このカードの正誤履歴をリセットします。問題文や選択肢は残ります。よろしいですか？');
  if (!confirmed) return;

  const updated = resetCardProgressState(card);
  await putCards([updated]);
  setStatus('正誤履歴をリセットしました');
  await reloadCards();
  currentCard = currentCard?.id === updated.id
    ? cards.find((item) => item.id === updated.id) || updated
    : currentCard;
  setDisplayedChoices(currentCard);
  renderStudyCard();
}

function openEditModal(cardId) {
  const card = cards.find((item) => item.id === cardId);
  if (!card || !el.editModal || !isEditMode) return;

  editingCardId = cardId;
  el.editQuestionInput.value = card.question || '';
  el.editChoicesInput.value = parseChoices(card).join('\n');
  el.editAnswerInput.value = card.answer || '';
  el.editExplanationInput.value = card.explanation || '';
  el.editCheckReasonInput.value = card.checkReason || '';
  setElementVisible(el.editModal, true);
}

function closeEditModal() {
  editingCardId = null;
  if (el.editQuestionInput) el.editQuestionInput.value = '';
  if (el.editChoicesInput) el.editChoicesInput.value = '';
  if (el.editAnswerInput) el.editAnswerInput.value = '';
  if (el.editExplanationInput) el.editExplanationInput.value = '';
  if (el.editCheckReasonInput) el.editCheckReasonInput.value = '';
  setElementVisible(el.editModal, false);
}

async function saveCardEdit() {
  if (!editingCardId) return;

  const card = cards.find((item) => item.id === editingCardId);
  if (!card) {
    closeEditModal();
    return;
  }

  const question = (el.editQuestionInput.value || '').trim();
  const choices = normalizeChoicesText(el.editChoicesInput.value);
  const answer = (el.editAnswerInput.value || '').trim();
  const explanation = (el.editExplanationInput.value || '').trim();
  const checkReason = (el.editCheckReasonInput.value || '').trim();
  const choiceList = choices ? choices.split('|').map((choice) => choice.trim()).filter(Boolean) : [];

  if (choiceList.length && answer && !choiceList.includes(answer)) {
    const shouldSave = window.confirm('正解が選択肢に含まれていません。保存しますか？');
    if (!shouldSave) return;
  }

  const updated = {
    ...card,
    question,
    choices,
    answer,
    explanation,
    checkReason,
    updatedAt: new Date().toISOString(),
  };

  closeEditModal();
  await putCards([updated]);
  setStatus('問題を更新しました');
  await reloadCards();
  currentCard = currentCard?.id === updated.id
    ? cards.find((item) => item.id === updated.id) || updated
    : currentCard;
  setDisplayedChoices(currentCard);
  renderStudyCard();
}

function exportJson() {
  const payload = {
    app: 'chuju-card',
    version: '0.4-history-bar',
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
    recentResults: normalizeRecentResults(card),
  })));
  setStatus(`${imported.length}件を復元しました`);
  await reloadCards();
  currentCard = null;
  pickNextCard();
}

async function init() {
  ensureStudyStartElements();
  ensureStudySidebarElements();
  ensureChoiceElements();
  ensureStudyCompleteStateElement();
  ensureProblemFlagElements();
  ensureListFilterElements();
  ensureListSummaryElement();
  ensureListScopeHintElement();
  ensureStudyBackButton();
  ensureEditModalElements();
  ensureEditModeButton();
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
    const message = error?.message || 'CSV読み込みに失敗しました';
    setStatus(`CSV読み込みエラー: ${message}`);
    alert(message);
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
