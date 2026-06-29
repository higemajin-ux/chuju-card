const DB_NAME = 'chuju-card-db';
const DB_VERSION = 4;
const STORE_NAME = 'cards';
const IMAGE_STORE_NAME = 'questionImages';
const SETTINGS_STORE_NAME = 'appSettings';
const PRIORITY_MATERIALS_KEY = 'priorityMaterials';
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
let isPrioritySelectMode = false;
let studySessionTargetIds = [];
let studySessionCorrectIds = new Set();
let isStudySessionComplete = false;
let questionImageRenderToken = 0;
const questionImageUrlCache = new Map();
let priorityMaterials = new Set();

const el = {
  saveStatus: document.getElementById('saveStatus'),
  importInput: document.getElementById('importInput'),
  imageImportStatus: document.getElementById('imageImportStatus'),
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
  studyCompleteNextBtn: document.getElementById('studyCompleteNextBtn'),
  studyCompleteReplayBtn: document.getElementById('studyCompleteReplayBtn'),
  studyReplayBtn: document.getElementById('studyReplayBtn'),
  studyEmptyImage: document.getElementById('studyEmptyImage'),
  questionText: document.getElementById('questionText'),
  questionImageWrap: document.getElementById('questionImageWrap'),
  questionImageEl: document.getElementById('questionImageEl'),
  questionImageMissingText: document.getElementById('questionImageMissingText'),
  questionImageModal: document.getElementById('questionImageModal'),
  questionImageModalImg: document.getElementById('questionImageModalImg'),
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
  priorityFilterBtn: document.getElementById('priorityFilterBtn'),
  materialButtons: document.getElementById('materialButtons'),
  materialScopeHint: document.getElementById('materialScopeHint'),
  studyBackBtn: document.getElementById('studyBackBtn'),
  studyModeChip: document.getElementById('studyModeChip'),
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
      scrollStudyCardIntoView();
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

  if (!el.studyModeChip) {
    const studyModeChip = document.createElement('span');
    studyModeChip.id = 'studyModeChip';
    studyModeChip.className = 'study-mode-chip hidden';
    studyTop.appendChild(studyModeChip);
    el.studyModeChip = studyModeChip;
  }

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
    { value: 'manual', label: 'わからなかった' },
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

function getCurrentStudyMaterialName(card) {
  return getCardMaterialName(card) || activeMaterialName || '';
}

function getCurrentStudyPositionText(card) {
  if (!card) return '';
  const materialName = getCurrentStudyMaterialName(card);
  if (!materialName) return '';
  const materialCards = cards.filter((item) => getCardMaterialName(item) === materialName);
  if (!materialCards.length) return '';
  const currentIndex = materialCards.findIndex((item) => item.id === card.id);
  if (currentIndex < 0) return '';
  return `${currentIndex + 1}/${materialCards.length}`;
}

function getCurrentStudyMetaText(card) {
  if (!card) return getCurrentListScopeLabel() || '';
  const subject = (card.subject || '').trim();
  const materialName = getCurrentStudyMaterialName(card);
  const progress = getCurrentStudyPositionText(card);
  return [subject, materialName, progress].filter(Boolean).join(' ｜ ');
}

function getCurrentStudyModeLabel(card) {
  if (isTodayWrongMode) return WRONG_LABEL;
  if (card && isPriorityMaterial(getCurrentStudyMaterialName(card))) return '優先';
  if (card && !isCardGraduated(card)) return '未合格';
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

function hasCardBeenCorrectAtLeastOnce(card) {
  const recentResults = normalizeRecentResults(card);
  if (recentResults.includes('correct')) return true;

  return ['correctCount', 'successCount', 'totalGood']
    .some((key) => typeof card?.[key] === 'number' && card[key] > 0);
}

function startStudySession(targetCards) {
  studySessionTargetIds = targetCards.map((card) => card.id).filter(Boolean);
  studySessionCorrectIds = new Set(
    targetCards
      .filter((card) => card?.id && hasCardBeenCorrectAtLeastOnce(card))
      .map((card) => card.id),
  );
  isStudySessionComplete = studySessionTargetIds.length > 0
    && studySessionCorrectIds.size >= studySessionTargetIds.length;
}

function markStudySessionCorrect(cardId) {
  if (!cardId || !studySessionTargetIds.includes(cardId)) return;
  studySessionCorrectIds.add(cardId);
  isStudySessionComplete = studySessionTargetIds.length > 0
    && studySessionCorrectIds.size >= studySessionTargetIds.length;
}

function getCurrentStudyResetTargets() {
  if (activeMaterialName) {
    return cards.filter((card) => getCardMaterialName(card) === activeMaterialName);
  }

  const sessionTargets = studySessionTargetIds
    .map((cardId) => cards.find((card) => card.id === cardId))
    .filter(Boolean);

  if (!sessionTargets.length) return [];

  const materialNames = [...new Set(sessionTargets.map((card) => getCardMaterialName(card)).filter(Boolean))];
  return materialNames.length === 1 ? sessionTargets : [];
}

function ensureStudyCompleteStateElement() {
  if (el.studyCompleteState || !el.cardBox || !el.questionText) return;

  const completeState = document.createElement('div');
  completeState.id = 'studyCompleteState';
  completeState.className = 'study-complete hidden';
  completeState.innerHTML = '<img class="study-complete-icon" src="./img/success-star.png" alt="\u5168\u554f\u6b63\u89e3"><p class="study-complete-title">\u5168\u554f\u6b63\u89e3\uff01</p><p class="study-complete-text">\u5168\u554f\u6b63\u89e3\u304a\u3081\u3067\u3068\u3046\uff01\u7d9a\u304d\u3082\u9811\u5f35\u3063\u3066\uff01</p><button id="studyCompleteNextBtn" class="big-button primary answer-button study-complete-next" type="button">\u6b21\u306e\u554f\u984c</button><button id="studyCompleteReplayBtn" class="big-button secondary-button answer-button study-replay-button hidden" type="button">\u3082\u3046\u4e00\u56de\u3084\u308b</button>';
  el.cardBox.insertBefore(completeState, el.questionText);
  el.studyCompleteState = completeState;
  el.studyCompleteNextBtn = completeState.querySelector('#studyCompleteNextBtn');
  el.studyCompleteReplayBtn = completeState.querySelector('#studyCompleteReplayBtn');
  el.studyCompleteNextBtn?.addEventListener('click', () => {
    resetStudySession();
    pickNextCard();
  });
  el.studyCompleteReplayBtn?.addEventListener('click', resetCurrentStudyTargetProgress);
}

function ensureStudyReplayButton() {
  if (el.studyReplayBtn || !el.cardBox || !el.questionText) return;

  const replayBtn = document.createElement('button');
  replayBtn.id = 'studyReplayBtn';
  replayBtn.type = 'button';
  replayBtn.className = 'big-button secondary-button answer-button study-replay-button hidden';
  replayBtn.textContent = 'もう一回やる';
  el.cardBox.insertBefore(replayBtn, el.questionText);
  el.studyReplayBtn = replayBtn;
  replayBtn.addEventListener('click', resetCurrentStudyTargetProgress);
}

async function resetCurrentStudyTargetProgress() {
  const targetCards = getCurrentStudyResetTargets();
  if (!targetCards.length || !activeMaterialName) {
    setStatus('リセットできる教材が特定できませんでした');
    return;
  }

  const confirmed = window.confirm('この教材の正誤記録と合格状態をリセットして、もう一回やりますか？');
  if (!confirmed) return;

  const updatedCards = targetCards.map((card) => resetCardProgressState(card));
  await putCards(updatedCards);
  resetStudySession();
  setStatus(`教材「${activeMaterialName}」の学習状態をリセットしました`);
  await reloadCards();
  startStudyForMaterial(activeMaterialName);
}

function ensureStudyBackButton() {
  if (el.studyBackBtn || !el.studyPanel) return;

  const appHeader = document.querySelector('.app-header');
  if (!appHeader) return;

  const backBtn = document.createElement('button');
  backBtn.id = 'studyBackBtn';
  backBtn.type = 'button';
  backBtn.className = 'quiet-button header-back-button hidden';
  backBtn.textContent = '← 教材一覧へ戻る';
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
    scrollMaterialListTopIntoView();
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
  document.body.classList.toggle('study-active', isStudyVisible);
}

function ensureStudyStartElements() {
  if (el.studyStartPanel && el.todayStudyBtn && el.priorityFilterBtn && el.materialButtons) return;

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

  const priorityBtn = document.createElement('button');
  priorityBtn.id = 'priorityFilterBtn';
  priorityBtn.type = 'button';
  priorityBtn.className = 'big-button secondary-button start-button';
  priorityBtn.textContent = '優先する教材を選ぶ';
  priorityBtn.addEventListener('click', () => {
    isPrioritySelectMode = !isPrioritySelectMode;
    renderMaterialButtons();
  });

  const actionRow = document.createElement('div');
  actionRow.className = 'start-action-row';
  actionRow.appendChild(todayBtn);
  actionRow.appendChild(priorityBtn);

  const materialScopeHint = document.createElement('p');
  materialScopeHint.id = 'materialScopeHint';
  materialScopeHint.className = 'hint start-scope-hint hidden';

  const materialButtons = document.createElement('div');
  materialButtons.id = 'materialButtons';
  materialButtons.className = 'material-buttons';

  panel.appendChild(title);
  panel.appendChild(hint);
  panel.appendChild(actionRow);
  panel.appendChild(materialHeading);
  panel.appendChild(materialScopeHint);
  panel.appendChild(materialButtons);
  main.insertBefore(panel, studyPanel);

  el.studyStartPanel = panel;
  el.todayStudyBtn = todayBtn;
  el.priorityFilterBtn = priorityBtn;
  el.materialButtons = materialButtons;
  el.materialScopeHint = materialScopeHint;
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

function ensureQuestionImageModalElements() {
  if (el.questionImageModal) return;

  const modal = document.createElement('div');
  modal.id = 'questionImageModal';
  modal.className = 'image-modal hidden';

  const dialog = document.createElement('div');
  dialog.className = 'image-modal-dialog';

  const image = document.createElement('img');
  image.id = 'questionImageModalImg';
  image.className = 'image-modal-img';
  image.alt = '';

  dialog.appendChild(image);
  modal.appendChild(dialog);
  modal.addEventListener('click', () => {
    closeQuestionImageModal();
  });
  document.body.appendChild(modal);

  el.questionImageModal = modal;
  el.questionImageModalImg = image;
  closeQuestionImageModal();
}

function openQuestionImageModal() {
  if (!el.questionImageEl?.src || !el.questionImageModal || !el.questionImageModalImg) return;
  el.questionImageModalImg.src = el.questionImageEl.src;
  el.questionImageModalImg.alt = el.questionImageEl.alt || '拡大画像';
  setElementVisible(el.questionImageModal, true);
  document.body.classList.add('image-modal-open');
}

function closeQuestionImageModal() {
  if (el.questionImageModalImg) {
    el.questionImageModalImg.removeAttribute('src');
    el.questionImageModalImg.alt = '';
  }
  setElementVisible(el.questionImageModal, false);
  document.body.classList.remove('image-modal-open');
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
  const notGraduated = materialCards.filter((card) => !isCardGraduated(card)).length;
  const graduated = materialCards.filter((card) => isCardGraduated(card)).length;
  return { total, notGraduated, graduated };
}

function normalizePriorityMaterialNames(names) {
  return [...new Set(
    (Array.isArray(names) ? names : [])
      .map((name) => (name || '').trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'ja'));
}

function isPriorityMaterial(materialName) {
  const normalizedMaterialName = (materialName || '').trim();
  return normalizedMaterialName ? priorityMaterials.has(normalizedMaterialName) : false;
}

async function savePriorityMaterials() {
  await putSetting(PRIORITY_MATERIALS_KEY, normalizePriorityMaterialNames([...priorityMaterials]));
}

async function loadPriorityMaterials() {
  const saved = await getSetting(PRIORITY_MATERIALS_KEY);
  priorityMaterials = new Set(normalizePriorityMaterialNames(saved));
}

async function setPriorityMaterial(materialName, enabled) {
  const normalizedMaterialName = (materialName || '').trim();
  if (!normalizedMaterialName) return;

  if (enabled) {
    priorityMaterials.add(normalizedMaterialName);
  } else {
    priorityMaterials.delete(normalizedMaterialName);
  }

  await savePriorityMaterials();
}

async function togglePriorityMaterial(materialName) {
  const normalizedMaterialName = (materialName || '').trim();
  if (!normalizedMaterialName) return;

  const nextEnabled = !isPriorityMaterial(normalizedMaterialName);
  await setPriorityMaterial(normalizedMaterialName, nextEnabled);
  renderMaterialButtons();
  setStatus(nextEnabled
    ? `教材「${normalizedMaterialName}」を優先にしました`
    : `教材「${normalizedMaterialName}」の優先を外しました`);
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
    target.scrollIntoView({ behavior: 'auto', block: 'start' });
  });
}

function scrollMaterialListTopIntoView() {
  const target = document.querySelector('.list-top') || el.listPanel;
  if (!target) return;
  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: 'auto', block: 'start' });
  });
}

function setStatus(message) {
  el.saveStatus.textContent = message;
}

function setImageImportStatus(message) {
  if (!el.imageImportStatus) return;
  const text = (message || '').trim();
  el.imageImportStatus.textContent = text;
  setElementVisible(el.imageImportStatus, Boolean(text));
}

function fileNameFromPath(filePath) {
  return (filePath || '')
    .split(/[/\\]/)
    .filter(Boolean)
    .pop() || '';
}

function buildQuestionImageKeys(fileName) {
  const normalizedName = fileNameFromPath((fileName || '').trim());
  if (!normalizedName) return [];

  const keys = [normalizedName];
  const alias = normalizedName.replace(/_diagram(?=\.[^.]+$)/i, '');
  if (alias && alias !== normalizedName) {
    keys.push(alias);
  }
  return [...new Set(keys)];
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

function resetQuestionImageDisplay() {
  questionImageRenderToken += 1;
  if (el.questionImageEl) {
    el.questionImageEl.removeAttribute('src');
    el.questionImageEl.alt = '';
  }
  closeQuestionImageModal();
  if (el.questionImageMissingText) {
    el.questionImageMissingText.textContent = '';
  }
  setElementVisible(el.questionImageEl, false);
  setElementVisible(el.questionImageMissingText, false);
  setElementVisible(el.questionImageWrap, false);
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
  const isTabletHistoryCompact = window.matchMedia('(min-width: 721px) and (max-width: 1180px)').matches;
  const historyLabels = isTabletHistoryCompact
    ? ['5前', '4前', '3前', '前', '今']
    : ['5回前', '4回前', '3回前', '前回', '今回'];

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

  const materialName = getCurrentStudyMaterialName(currentCard);
  if (!materialName) return;

  const counts = getMaterialCardCounts(materialName);
  const summary = document.createElement('div');
  summary.className = 'sidebar-material-summary';

  [
    ['全', counts.total],
    ['未合格', counts.notGraduated],
    ['合格', counts.graduated],
  ].forEach(([label, value]) => {
    const item = document.createElement('span');
    item.className = 'sidebar-material-summary-item';
    item.textContent = `${label}${value}`;
    summary.appendChild(item);
  });

  el.sidebarHistory.appendChild(summary);
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
      if (!database.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        database.createObjectStore(IMAGE_STORE_NAME, { keyPath: 'name' });
      }
      if (!database.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        database.createObjectStore(SETTINGS_STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txStore(mode = 'readonly') {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function txImageStore(mode = 'readonly') {
  return db.transaction(IMAGE_STORE_NAME, mode).objectStore(IMAGE_STORE_NAME);
}

function txSettingsStore(mode = 'readonly') {
  return db.transaction(SETTINGS_STORE_NAME, mode).objectStore(SETTINGS_STORE_NAME);
}

function getAllCards() {
  return new Promise((resolve, reject) => {
    const request = txStore().getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function getSetting(key) {
  return new Promise((resolve, reject) => {
    const request = txSettingsStore().get(key);
    request.onsuccess = () => resolve(request.result?.value);
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

function putSetting(key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SETTINGS_STORE_NAME);
    store.put({ key, value, updatedAt: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function putQuestionImages(items) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IMAGE_STORE_NAME);
    items.forEach((item) => store.put(item));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getQuestionImageRecord(name) {
  return new Promise((resolve, reject) => {
    const request = txImageStore().get(name);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
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

function clearSettings() {
  return new Promise((resolve, reject) => {
    const request = txSettingsStore('readwrite').clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function isSupportedQuestionImageFile(file) {
  if (!file?.name) return false;
  return ['.jpg', '.jpeg', '.png', '.webp']
    .some((ext) => file.name.toLowerCase().endsWith(ext));
}

function isSupportedQuestionImageName(fileName) {
  const normalizedName = (fileName || '').toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp']
    .some((ext) => normalizedName.endsWith(ext));
}

function getImportFileKind(fileName) {
  const normalizedName = (fileName || '').toLowerCase();
  if (normalizedName.endsWith('.zip')) return 'zip';
  if (normalizedName.endsWith('.csv')) return 'csv';
  if (isSupportedQuestionImageName(normalizedName)) return 'image';
  return 'unsupported';
}

function revokeQuestionImageUrl(fileName) {
  const cachedUrl = questionImageUrlCache.get(fileName);
  if (!cachedUrl) return;
  URL.revokeObjectURL(cachedUrl);
  questionImageUrlCache.delete(fileName);
}

async function getQuestionImageUrl(fileName) {
  if (!fileName) return '';
  if (questionImageUrlCache.has(fileName)) {
    return questionImageUrlCache.get(fileName);
  }

  const record = await getQuestionImageRecord(fileName);
  if (!record?.blob) return '';

  const objectUrl = URL.createObjectURL(record.blob);
  questionImageUrlCache.set(fileName, objectUrl);
  return objectUrl;
}

async function saveQuestionImageItems(items) {
  const supportedItems = Array.from(items || []).filter((item) => item?.name && item?.blob && isSupportedQuestionImageName(item.name));
  if (!supportedItems.length) {
    setImageImportStatus('保存できる画像が選択されていません。');
    return;
  }

  const records = supportedItems.flatMap((item) => buildQuestionImageKeys(item.name).map((name) => ({
    name,
    blob: item.blob,
    type: item.type || item.blob.type || '',
    updatedAt: new Date().toISOString(),
  })));

  records.forEach((item) => revokeQuestionImageUrl(item.name));
  await putQuestionImages(records);

  const message = `画像を${supportedItems.length}枚保存しました。`;
  setStatus(message);
  setImageImportStatus(message);
}

async function saveQuestionImages(files) {
  const supportedFiles = Array.from(files || []).filter((file) => isSupportedQuestionImageFile(file));
  await saveQuestionImageItems(supportedFiles.map((file) => ({
    name: file.name,
    blob: file,
    type: file.type || '',
  })));
}

async function renderQuestionImage(card) {
  const fileName = (card?.questionImage || '').trim();
  if (!fileName) {
    resetQuestionImageDisplay();
    return;
  }

  const renderToken = ++questionImageRenderToken;
  el.questionImageEl?.removeAttribute('src');
  if (el.questionImageEl) {
    el.questionImageEl.alt = `問題画像: ${fileName}`;
  }
  if (el.questionImageMissingText) {
    el.questionImageMissingText.textContent = '';
  }
  setElementVisible(el.questionImageWrap, true);
  setElementVisible(el.questionImageEl, false);
  setElementVisible(el.questionImageMissingText, false);

  const imageUrl = await getQuestionImageUrl(fileName);
  if (renderToken !== questionImageRenderToken || currentCard?.id !== card?.id) return;

  if (imageUrl) {
    el.questionImageEl.src = imageUrl;
    el.questionImageEl.title = 'タップで拡大';
    setElementVisible(el.questionImageEl, true);
    return;
  }

  el.questionImageMissingText.textContent = `画像未読込：${fileName}`;
  setElementVisible(el.questionImageMissingText, true);
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
  if (isStudySessionComplete && studySessionTargetIds.length > 0) {
    currentCard = null;
    answerVisible = false;
    choiceFeedback = null;
    resetChoiceCover(null);
    setDisplayedChoices(null);
    setStatus('');
    renderStudyCard();
    return;
  }

  const queue = studyQueueCards();
  if (!queue.length) {
    currentCard = activeMaterialName || isTodayWrongMode ? null : (cards[0] || null);
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
  isPrioritySelectMode = false;
  activeMaterialName = materialName || '';
  isTodayWrongMode = false;
  isStudyVisible = true;
  updateStudyVisibility();
  renderMaterialButtons();
  renderList();
  const queue = studyQueueCards();
  if (!queue.length) {
    resetStudySession();
    currentCard = null;
    answerVisible = false;
    choiceFeedback = null;
    resetChoiceCover(null);
    setDisplayedChoices(null);
    renderStudyCard();
    setStatus(activeMaterialName ? 'この教材の出題対象カードはありません' : '出題できるカードがありません');
    return;
  }

  startStudySession(queue);
  currentCard = null;
  pickNextCard();
  scrollStudyCardIntoView();
}

function startTodayStudy() {
  isPrioritySelectMode = false;
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
  if (isPriorityMaterial(normalizedMaterialName)) {
    await setPriorityMaterial(normalizedMaterialName, false);
  }

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
  if (!el.materialButtons || !el.todayStudyBtn || !el.priorityFilterBtn) return;

  const materialNames = [...new Set(
    cards.map((card) => getCardMaterialName(card)).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'ja'));

  el.todayStudyBtn.classList.toggle('is-active', !isPrioritySelectMode && !activeMaterialName);
  el.priorityFilterBtn.classList.toggle('is-active', isPrioritySelectMode);
  el.priorityFilterBtn.textContent = isPrioritySelectMode ? '優先選択中' : '優先する教材を選ぶ';
  el.materialButtons.innerHTML = '';
  if (el.materialScopeHint) {
    el.materialScopeHint.textContent = '教材をタップすると優先を切り替えます';
    el.materialScopeHint.classList.toggle('hidden', !isPrioritySelectMode);
  }

  if (!materialNames.length) {
    el.materialButtons.innerHTML = '<p class="hint">教材ボタンはCSV読み込み後に表示されます。</p>';
    return;
  }

  materialNames.forEach((materialName) => {
    const counts = getMaterialCardCounts(materialName);
    const isPriority = isPriorityMaterial(materialName);
    const isCompleted = counts.total > 0 && counts.notGraduated === 0;
    const progressLabel = isCompleted ? '合格済み' : `未合格${counts.notGraduated}問`;
    const item = document.createElement('div');
    item.className = 'material-button-item';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'big-button secondary-button material-button';
    button.classList.toggle('is-active', activeMaterialName === materialName);
    button.classList.toggle('is-priority', isPriority);
    button.classList.toggle('is-complete', isCompleted);
    button.classList.toggle('is-pending', !isCompleted);
    button.classList.toggle('is-priority-select-mode', isPrioritySelectMode);
    button.addEventListener('click', async () => {
      if (isPrioritySelectMode) {
        await togglePriorityMaterial(materialName);
        return;
      }
      startStudyForMaterial(materialName);
    });

    const badges = document.createElement('span');
    badges.className = 'material-button-badges';

    if (isPriority) {
      const priorityBadge = document.createElement('span');
      priorityBadge.className = 'material-badge material-badge-priority';
      priorityBadge.textContent = '優先';
      badges.appendChild(priorityBadge);
    }

    const progressBadge = document.createElement('span');
    progressBadge.className = `material-badge ${isCompleted ? 'material-badge-complete' : 'material-badge-pending'}`;
    progressBadge.textContent = progressLabel;
    badges.appendChild(progressBadge);

    const label = document.createElement('span');
    label.className = 'material-button-label';
    label.textContent = materialName;

    const summary = document.createElement('span');
    summary.className = 'material-button-summary';
    summary.textContent = `\u5168${counts.total}\uFF5C\u672A\u5408\u683C${counts.notGraduated}\uFF5C\u5408\u683C${counts.graduated}`;

    button.appendChild(badges);
    button.appendChild(label);
    button.appendChild(summary);
    if (isPrioritySelectMode) {
      const selectHint = document.createElement('span');
      selectHint.className = 'material-select-hint';
      selectHint.textContent = 'タップで優先切替';
      button.appendChild(selectHint);
    }

    item.appendChild(button);
    if (isEditMode) {
      const actionRow = document.createElement('div');
      actionRow.className = 'material-admin-actions';
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'quiet-button material-delete-button';
      deleteButton.textContent = '削除';
      deleteButton.setAttribute('aria-label', `教材「${materialName}」を削除`);
      deleteButton.addEventListener('click', async (event) => {
        event.stopPropagation();
        await deleteCardsByMaterial(materialName);
      });

      actionRow.appendChild(deleteButton);
      item.appendChild(actionRow);
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
    resetQuestionImageDisplay();
    const isCompleteStateVisible = isStudySessionComplete && studySessionTargetIds.length > 0;
    const canReplayCurrentStudy = Boolean(activeMaterialName) && getCurrentStudyResetTargets().length > 0;
    setElementVisible(el.studyCompleteState, isCompleteStateVisible);
    setElementVisible(el.studyCompleteReplayBtn, isCompleteStateVisible && canReplayCurrentStudy);
    setElementVisible(el.studyReplayBtn, !isCompleteStateVisible && canReplayCurrentStudy);
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
    if (el.studyModeChip) {
      el.studyModeChip.textContent = getCurrentStudyModeLabel(null);
      el.studyModeChip.classList.toggle('hidden', !el.studyModeChip.textContent);
    }
    updateStudyButtons();
    renderStudySidebar();
    return;
  }

  el.cardBox.classList.remove('empty');
  setElementVisible(el.studyCompleteState, false);
  setElementVisible(el.studyCompleteReplayBtn, false);
  setElementVisible(el.studyReplayBtn, false);
  setElementVisible(el.studyEmptyImage, false);
  setElementVisible(el.questionText, true);
  if (el.studyModeChip) {
    el.studyModeChip.textContent = getCurrentStudyModeLabel(currentCard);
    el.studyModeChip.classList.toggle('hidden', !el.studyModeChip.textContent);
  }
  const modeLabel = activeMaterialName ? `教材: ${activeMaterialName}` : WRONG_LABEL;
  el.cardMeta.textContent = `${modeLabel} / 次回 ${currentCard.nextReviewDate || todayString()}`;
  setTag(el.subjectTag, '科目', currentCard.subject);
  setTag(el.unitTag, '単元', currentCard.unit);
  setTag(el.difficultyTag, '難しさ', currentCard.difficulty);
  el.cardMeta.textContent = getCurrentStudyMetaText(currentCard) || getCurrentListScopeLabel();
  setTag(el.difficultyTag, '', '');
  setCheckBadge(el.checkBadge, currentCard.check);
  setElementVisible(el.problemBadge, isProblemFlagged(currentCard));
  setCheckReason(currentCard.checkReason);
  el.questionText.textContent = currentCard.question;
  renderQuestionImage(currentCard);
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
  const choiceNumberLabels = [
    '\u2776', '\u2777', '\u2778', '\u2779',
    '\u277a', '\u277b', '\u277c', '\u277d',
  ];

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

  choices.forEach((choice, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'big-button choice-button';
    button.disabled = Boolean(choiceFeedback);

    const number = document.createElement('span');
    number.className = 'choice-number';
    number.textContent = choiceNumberLabels[index] || String(index + 1);

    const label = document.createElement('span');
    label.className = 'choice-label';
    label.textContent = choice;

    button.appendChild(number);
    button.appendChild(label);

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
    if (listFilter === 'manual') return normalizeRecentResults(card).includes('manual');
    if (listFilter === 'notGraduated') return !isCardGraduated(card);
    if (listFilter === 'graduated') return isCardGraduated(card);
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
      const notGraduated = filteredCards.filter((card) => !isCardGraduated(card)).length;
      const graduated = filteredCards.filter((card) => isCardGraduated(card)).length;
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

async function handleCsvImportText(text, fileName) {
  const rows = parseCsv((text || '').replace(/^\uFEFF/, ''));
  const imported = csvRowsToCards(rows, fileName || '');
  const blankChoicesCount = imported.filter((card) => !(card.choices || '').trim()).length;
  await syncCardsFromCsv(imported);
  setStatus(`読み込み完了: ${imported.length}件 / choices空欄 ${blankChoicesCount}件`);
  await reloadCards();
  currentCard = null;
  pickNextCard();
  return { importedCount: imported.length, blankChoicesCount };
}

async function handleZipFile(file) {
  if (typeof JSZip === 'undefined') {
    throw new Error('ZIP展開ライブラリの読み込みに失敗しました');
  }

  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const csvEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith('.csv'));
  if (!csvEntries.length) {
    throw new Error('ZIP内にCSVファイルがありません');
  }
  if (csvEntries.length > 1) {
    throw new Error('ZIP内のCSVファイルが複数あるため取り込めません');
  }

  const csvEntry = csvEntries[0];
  const csvFileName = fileNameFromPath(csvEntry.name);
  const csvBytes = await csvEntry.async('uint8array');
  const csvText = new TextDecoder('utf-8').decode(csvBytes);
  const csvResult = await handleCsvImportText(csvText, csvFileName);

  const imageEntries = entries.filter((entry) => isSupportedQuestionImageName(fileNameFromPath(entry.name)));
  const imageItems = await Promise.all(imageEntries.map(async (entry) => {
    const blob = await entry.async('blob');
    const name = fileNameFromPath(entry.name);
    return {
      name,
      blob,
      type: blob.type || '',
    };
  }));
  await saveQuestionImageItems(imageItems);

  const message = `CSVを1件、画像を${imageItems.length}枚読み込みました。`;
  setStatus(message);
  setImageImportStatus(message);

  if (currentCard?.questionImage) {
    renderQuestionImage(currentCard);
  }

  return {
    csvCount: 1,
    imageCount: imageItems.length,
    importedCount: csvResult.importedCount,
  };
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
    priorityMaterials: normalizePriorityMaterialNames([...priorityMaterials]),
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
  if (!Array.isArray(payload) && Object.prototype.hasOwnProperty.call(payload, 'priorityMaterials')) {
    priorityMaterials = new Set(normalizePriorityMaterialNames(payload.priorityMaterials));
    await savePriorityMaterials();
  }
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
  ensureStudyReplayButton();
  ensureProblemFlagElements();
  ensureListFilterElements();
  ensureListSummaryElement();
  ensureListScopeHintElement();
  ensureStudyBackButton();
  ensureEditModalElements();
  ensureQuestionImageModalElements();
  ensureEditModeButton();
  el.questionImageEl?.addEventListener('click', () => {
    openQuestionImageModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeQuestionImageModal();
    }
  });
  db = await openDb();
  await loadPriorityMaterials();
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

el.importInput?.addEventListener('change', async (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  const fileKinds = [...new Set(files.map((file) => getImportFileKind(file.name)))];
  const importKind = fileKinds[0];

  try {
    if (fileKinds.includes('unsupported')) {
      throw new Error('対応していないファイル形式です。CSV、ZIP、画像ファイルを選択してください。');
    }

    if (fileKinds.length > 1) {
      throw new Error('CSV・ZIP・画像を同時には読み込めません。同じ種類のファイルだけ選択してください。');
    }

    if (importKind === 'image') {
      await saveQuestionImages(files);
      if (currentCard?.questionImage) {
        renderQuestionImage(currentCard);
      }
      return;
    }

    if (files.length > 1) {
      throw new Error('CSVまたはZIPは1ファイルずつ読み込んでください。');
    }

    if (importKind === 'csv') {
      await handleCsvFile(files[0]);
      return;
    }

    if (importKind === 'zip') {
      await handleZipFile(files[0]);
      return;
    }

    throw new Error('対応していないファイル形式です。');
  } catch (error) {
    const message = error?.message || '教材の読み込みに失敗しました';
    setStatus(`教材読み込みエラー: ${message}`);
    setImageImportStatus(`教材読み込みエラー: ${message}`);
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
  scrollStudyCardIntoView();
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
  await clearSettings();
  priorityMaterials = new Set();
  currentCard = null;
  setStatus('全データを削除しました');
  await reloadCards();
});

init().catch((error) => {
  console.error(error);
  setStatus('起動に失敗しました');
  alert('起動に失敗しました。Safariの設定や端末の空き容量を確認してください。');
});
