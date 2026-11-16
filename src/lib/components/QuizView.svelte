<script>
  import { onMount, onDestroy, untrack } from 'svelte';
  import Icon from '@iconify/svelte';
  import MosqueraMood from './MosqueraMood.svelte';
  import { playCorrect, playWrong, playCombo, playTick, playClick } from '#lib/audio/soundFx.js';
  import glossaryData from '#lib/data/glossary.json';

  let {
    questions = [],
    activeTopic = '',
    availableTopics = [],
    hasTimeLimit = false,
    timeLimitSeconds = 20,
    happiness = 50,
    streak = 0,
    topicProgress = {}, // { [topic]: { mastered: [], missed: [] } }
    onAnswer = () => {},
    onSwitchTopic = () => {},
    onFinishAll = () => {},
    onBackToMenu = () => {}
  } = $props();

  let currentQuestion = $state(null);
  let selectedOptionIndex = $state(null);
  let isAnswered = $state(false);
  let isCorrect = $state(false);
  let lastEvent = $state('idle');
  let lastMessage = $state('');

  // Map to track eliminated/blacked-out wrong options per question by OPTION TEXT:
  // { [questionId]: string[] }
  let disabledOptionsMap = $state({});

  // Persistent cache for randomized option orders per question so solutions NEVER move positions:
  // { [questionId]: { options: string[], correctIndex: number } }
  let questionOrderCache = {};

  // Track wrong attempt count per question:
  // { [questionId]: number }
  let questionWrongAttempts = $state({});

  // Countdown timer
  let timeLeft = $state(0);
  let timerInterval = null;

  // Helper: Fisher-Yates shuffle array
  function shuffleArray(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Shuffle the options of a question and re-map the correctIndex,
  // caching the result so the options NEVER move positions when retried!
  function prepareQuestionWithShuffledOptions(rawQ) {
    if (!rawQ) return null;
    if (questionOrderCache[rawQ.id]) {
      return {
        ...rawQ,
        options: questionOrderCache[rawQ.id].options,
        correctIndex: questionOrderCache[rawQ.id].correctIndex
      };
    }

    const originalOptions = rawQ.options;
    const correctText = originalOptions[rawQ.correctIndex];

    // Create an array of indices [0, 1, 2, 3] and shuffle
    const shuffledIndices = shuffleArray([0, 1, 2, 3].slice(0, originalOptions.length));
    const shuffledOptions = shuffledIndices.map(i => originalOptions[i]);
    const newCorrectIndex = shuffledOptions.indexOf(correctText);

    const prepared = {
      ...rawQ,
      options: shuffledOptions,
      correctIndex: newCorrectIndex
    };

    questionOrderCache[rawQ.id] = {
      options: shuffledOptions,
      correctIndex: newCorrectIndex
    };

    return prepared;
  }

  // Pick the next question randomized within the active topic
  function loadNextQuestion() {
    const topicQuestions = questions.filter(q => q.topic === activeTopic);
    const progress = topicProgress[activeTopic] || { mastered: [], missed: [] };

    const unmastered = topicQuestions.filter(q => !progress.mastered.includes(q.id));

    if (unmastered.length === 0) {
      // Check if all questions in all topics are mastered
      const allMastered = questions.every(q => {
        const p = topicProgress[q.topic];
        return p && p.mastered.includes(q.id);
      });
      if (allMastered) {
        onFinishAll();
        return;
      }
      const nextTopicWithWork = availableTopics.find(t => {
        const qs = questions.filter(q => q.topic === t);
        const p = topicProgress[t] || { mastered: [] };
        return qs.some(q => !p.mastered.includes(q.id));
      });
      if (nextTopicWithWork) {
        onSwitchTopic(nextTopicWithWork);
        return;
      } else {
        onFinishAll();
        return;
      }
    }

    // Prioritize missed questions for spaced retry, else pick randomly among unmastered questions
    const missedList = unmastered.filter(q => progress.missed.includes(q.id));
    let rawNextQ;
    if (missedList.length > 0) {
      // Randomize within missed
      const randIdx = Math.floor(Math.random() * missedList.length);
      rawNextQ = missedList[randIdx];
    } else {
      // Randomize within remaining unmastered
      const randIdx = Math.floor(Math.random() * unmastered.length);
      rawNextQ = unmastered[randIdx];
    }

    // Lock option positions with prepareQuestionWithShuffledOptions so solutions NEVER move positions!
    currentQuestion = prepareQuestionWithShuffledOptions(rawNextQ);
    selectedOptionIndex = null;
    isAnswered = false;
    isCorrect = false;
    lastEvent = 'idle';
    lastMessage = '';

    resetTimer();
  }

  function resetTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (hasTimeLimit) {
      timeLeft = timeLimitSeconds;
      timerInterval = setInterval(() => {
        if (!isAnswered) {
          timeLeft -= 1;
          if (timeLeft <= 5 && timeLeft > 0) {
            playTick();
          }
          if (timeLeft <= 0) {
            handleTimeOut();
          }
        }
      }, 1000);
    }
  }

  function handleTimeOut() {
    if (timerInterval) clearInterval(timerInterval);
    if (isAnswered) return;
    submitAnswer(-1, true);
  }

  function handleOptionClick(index) {
    if (isCorrect) return;
    const optionText = currentQuestion?.options[index];
    const qId = currentQuestion?.id;
    if (!qId || !optionText) return;

    // Prevent clicking already blacked-out wrong options
    if (disabledOptionsMap[qId]?.includes(optionText)) return;

    playClick();
    submitAnswer(index, false);
  }

  function submitAnswer(index, isTimeout = false) {
    const qId = currentQuestion.id;
    const correct = !isTimeout && index === currentQuestion.correctIndex;
    const optionText = index >= 0 ? currentQuestion.options[index] : null;

    if (correct) {
      if (timerInterval) clearInterval(timerInterval);
      isAnswered = true;
      isCorrect = true;
      selectedOptionIndex = index;

      if (streak >= 2) {
        playCombo();
        lastEvent = 'combo';
      } else {
        playCorrect();
        lastEvent = 'correct';
      }

      onAnswer({
        questionId: qId,
        topic: activeTopic,
        isCorrect: true,
        selectedOption: index
      });
    } else {
      playWrong();
      lastEvent = 'wrong';

      const prevCount = questionWrongAttempts[qId] || 0;
      const newCount = prevCount + 1;
      questionWrongAttempts = { ...questionWrongAttempts, [qId]: newCount };

      // Immediately shade out the wrong option in place without turning red!
      if (optionText) {
        const existingDisabled = disabledOptionsMap[qId] || [];
        if (!existingDisabled.includes(optionText)) {
          disabledOptionsMap = {
            ...disabledOptionsMap,
            [qId]: [...existingDisabled, optionText]
          };
        }
      }

      if (isTimeout) {
        lastMessage = "¡Se acabó el tiempo, chaval!";
        isAnswered = true;
      }

      onAnswer({
        questionId: qId,
        topic: activeTopic,
        isCorrect: false,
        selectedOption: index
      });
    }
  }

  function handleNextClick() {
    playClick();
    loadNextQuestion();
  }

  function handleSkipQuestion() {
    playClick();
    if (timerInterval) clearInterval(timerInterval);
    onAnswer({
      questionId: currentQuestion.id,
      topic: activeTopic,
      isCorrect: false,
      isSkip: true
    });
    loadNextQuestion();
  }

  function promptSwitchTopic() {
    playClick();
    if (timerInterval) clearInterval(timerInterval);
    const otherTopics = availableTopics.filter(t => t !== activeTopic);
    if (otherTopics.length > 0) {
      onSwitchTopic(otherTopics[0]);
    }
  }

  // Term definition popup state
  let activeModalTerm = $state(null);

  // Precompile sorted glossary candidates (longest alias first for greedy matching)
  const sortedGlossaryCandidates = (() => {
    const list = [];
    for (const entry of glossaryData) {
      const allPhrases = new Set([entry.term, ...(entry.aliases || [])]);
      for (const phrase of allPhrases) {
        const trimmed = phrase.trim();
        if (trimmed.length >= 2) {
          list.push({ alias: trimmed, entry });
        }
      }
    }
    list.sort((a, b) => b.alias.length - a.alias.length);
    return list;
  })();

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Parse current question text into plain text vs clickable VLSI terms
  let questionSegments = $derived.by(() => {
    const text = currentQuestion?.question;
    if (!text) return [];

    const matches = [];
    for (const cand of sortedGlossaryCandidates) {
      const pattern = new RegExp(`\\b${escapeRegex(cand.alias)}\\b`, 'gi');
      let m;
      while ((m = pattern.exec(text)) !== null) {
        matches.push({
          start: m.index,
          end: m.index + m[0].length,
          text: m[0],
          term: cand.entry
        });
      }
    }

    // Sort matches: start ascending, then length descending
    matches.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return (b.end - b.start) - (a.end - a.start);
    });

    // Greedily pick non-overlapping matches
    const chosen = [];
    let lastEnd = 0;
    for (const m of matches) {
      if (m.start >= lastEnd) {
        chosen.push(m);
        lastEnd = m.end;
      }
    }

    const segments = [];
    let curr = 0;
    for (const m of chosen) {
      if (m.start > curr) {
        segments.push({ text: text.slice(curr, m.start), isTerm: false });
      }
      segments.push({
        text: m.text,
        isTerm: true,
        term: m.term
      });
      curr = m.end;
    }
    if (curr < text.length) {
      segments.push({ text: text.slice(curr), isTerm: false });
    }

    return segments;
  });

  function handleOpenTerm(term, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    playClick();
    activeModalTerm = term;
  }

  function handleCloseTerm() {
    activeModalTerm = null;
  }

  $effect(() => {
    const topic = activeTopic;
    untrack(() => {
      if (topic) {
        loadNextQuestion();
      }
    });
  });

  function handleKeyDown(e) {
    if (activeModalTerm && e.key === 'Escape') {
      e.preventDefault();
      handleCloseTerm();
      return;
    }
    if (isCorrect && !activeModalTerm && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      handleNextClick();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval);
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeyDown);
    }
  });

  let topicStats = $derived.by(() => {
    const topicQuestions = questions.filter(q => q.topic === activeTopic);
    const progress = topicProgress[activeTopic] || { mastered: [], missed: [] };
    const masteredCount = topicQuestions.filter(q => progress.mastered.includes(q.id)).length;
    return {
      mastered: masteredCount,
      total: topicQuestions.length,
      pct: topicQuestions.length > 0 ? Math.round((masteredCount / topicQuestions.length) * 100) : 0
    };
  });

  // Millionaire photo grid layout:
  // Row 1: Option A (index 0) and Option C (index 2)
  // Row 2: Option B (index 1) and Option D (index 3)
  const row1Options = [
    { label: 'A:', idx: 0 },
    { label: 'C:', idx: 2 }
  ];

  const row2Options = [
    { label: 'B:', idx: 1 },
    { label: 'D:', idx: 3 }
  ];
</script>

<div class="millionaire-screen">
  <!-- Top Navigation & Stage HUD (Responsive Grid: impossible to overlap) -->
  <div class="top-nav-bar">
    <div class="nav-left-actions">
      <button class="nav-btn" onclick={onBackToMenu} title="Volver al Menú">
        <Icon icon="mdi:arrow-left" width="16" />
        <span class="btn-label-desktop">Menú</span>
      </button>
    </div>

    <div class="active-topic-badge">
      <span class="topic-name" title="{activeTopic}">{activeTopic}</span>
      <span class="topic-count">[{topicStats.mastered}/{topicStats.total}]</span>
    </div>

    <div class="nav-right-actions">
      <!-- Streak Display: Flame Icon and Number Only (no box, no text) -->
      <div class="streak-clean-display" title="Racha: {streak}">
        <Icon icon="mdi:fire" width="28" class="flame-icon" />
        <span class="streak-num">{streak}</span>
      </div>

      {#if availableTopics.length > 1}
        <button class="nav-btn switch-btn" onclick={promptSwitchTopic} title="Cambiar Tema">
          <Icon icon="mdi:swap-horizontal" width="16" />
          <span class="btn-label-desktop">Cambiar Tema</span>
        </button>
      {/if}
      <button class="nav-btn" onclick={handleSkipQuestion} disabled={isAnswered} title="Pasar Pregunta">
        <Icon icon="mdi:skip-next" width="16" />
        <span class="btn-label-desktop">Pasar</span>
      </button>
    </div>
  </div>

  {#if currentQuestion}
    <!-- Cohesive Vertically Centered Stage Cluster (Mosquera grouped right above question) -->
    <div class="stage-cohesive-cluster">
      <!-- Center Stage: Dr. Mosquera (Hot Seat) -->
      <div class="stage-center-area">
        <MosqueraMood
          {happiness}
          {streak}
          {lastEvent}
          {lastMessage}
        />
      </div>

      <!-- Lower Stage: The Iconic Millionaire Quiz Interface -->
      <div class="quiz-controls-stage">
        <!-- 1. Question Box with Full-Width Gold Wing Lines -->
        <div class="millionaire-row question-row">
          <div class="gold-wing-line left"></div>

          <div class="lozenge-outer question-lozenge">
            <div class="lozenge-inner question-inner">
              <span class="question-qmark left">?</span>
              <div class="question-content">
                {#if hasTimeLimit}
                  <span class="timer-tag" class:urgent={timeLeft <= 5}>[{timeLeft}s]</span>
                {/if}
                <h2 class="question-text">
                  {#each questionSegments as seg}
                    {#if seg.isTerm}
                      <button
                        type="button"
                        class="question-term-btn"
                        onclick={(e) => handleOpenTerm(seg.term, e)}
                        title="Haz clic para ver la definición y aplicación VLSI de {seg.term.term}"
                      >
                        <span class="term-text">{seg.text}</span>
                        <span class="term-sparkle">✦</span>
                      </button>
                    {:else}
                      <span>{seg.text}</span>
                    {/if}
                  {/each}
                </h2>
              </div>
              <span class="question-qmark right">?</span>
            </div>
          </div>

          <div class="gold-wing-line right"></div>
        </div>

        <!-- 2. Answers Row 1: Option A (left) and Option C (right) -->
        <div class="millionaire-row answers-row">
          <div class="gold-wing-line left"></div>

          {#each row1Options as item, i}
            {@const opt = currentQuestion.options[item.idx]}
            {@const isBlackedOut = (disabledOptionsMap[currentQuestion.id] || []).includes(opt)}
            {@const isSelected = selectedOptionIndex === item.idx}
            {@const isCorrectOpt = item.idx === currentQuestion.correctIndex}

            {#if i > 0}
              <div class="center-gold-line"></div>
            {/if}

            <button
              class="lozenge-outer answer-lozenge"
              class:answered={isCorrect}
              class:selected={isSelected}
              class:reveal-correct={isCorrect && isCorrectOpt}
              class:shaded-rest={isCorrect && !isCorrectOpt}
              class:blacked-out={isBlackedOut}
              onclick={() => handleOptionClick(item.idx)}
              disabled={isCorrect || isBlackedOut}
            >
              <div class="lozenge-inner answer-inner">
                <div class="option-badge">
                  <span class="badge-letter">{item.label}</span>
                </div>
                <span class="option-text">{opt}</span>
              </div>
            </button>
          {/each}

          <div class="gold-wing-line right"></div>
        </div>

        <!-- 3. Answers Row 2: Option B (left) and Option D (right) -->
        <div class="millionaire-row answers-row">
          <div class="gold-wing-line left"></div>

          {#each row2Options as item, i}
            {@const opt = currentQuestion.options[item.idx]}
            {@const isBlackedOut = (disabledOptionsMap[currentQuestion.id] || []).includes(opt)}
            {@const isSelected = selectedOptionIndex === item.idx}
            {@const isCorrectOpt = item.idx === currentQuestion.correctIndex}

            {#if i > 0}
              <div class="center-gold-line"></div>
            {/if}

            <button
              class="lozenge-outer answer-lozenge"
              class:answered={isCorrect}
              class:selected={isSelected}
              class:reveal-correct={isCorrect && isCorrectOpt}
              class:shaded-rest={isCorrect && !isCorrectOpt}
              class:blacked-out={isBlackedOut}
              onclick={() => handleOptionClick(item.idx)}
              disabled={isCorrect || isBlackedOut}
            >
              <div class="lozenge-inner answer-inner">
                <div class="option-badge">
                  <span class="badge-letter">{item.label}</span>
                </div>
                <span class="option-text">{opt}</span>
              </div>
            </button>
          {/each}

          <div class="gold-wing-line right"></div>
        </div>
      </div>
    </div>

    <!-- Side Feedback Panel (Zero Layout Shift - Fixed on upper-right side) -->
    {#if isCorrect}
      <aside class="side-feedback-panel" aria-live="polite">
        <div class="feedback-card-header">
          <Icon icon="mdi:check-decagram" width="28" class="feedback-success-icon" />
          <div class="header-titles">
            <span class="feedback-badge">¡CLAVADO!</span>
            <span class="feedback-sub">Respuesta Correcta</span>
          </div>
        </div>

        {#if currentQuestion.explanation}
          <div class="explanation-box">
            <div class="explanation-label">
              <Icon icon="mdi:lightbulb-on-outline" width="16" />
              <span>Explicación del Profesor:</span>
            </div>
            <p class="explanation-text">{currentQuestion.explanation}</p>
          </div>
        {/if}

        <button class="btn-next-question" onclick={handleNextClick}>
          <span>SIGUIENTE PREGUNTA</span>
          <Icon icon="mdi:arrow-right-thick" width="20" />
        </button>
        <span class="next-key-hint">Pulsa Intro ↵ para avanzar</span>
      </aside>
    {/if}
  {/if}

  <!-- Term Definition & VLSI Application Popup Modal (Clickable Question Terms) -->
  {#if activeModalTerm}
    <div
      class="term-modal-backdrop"
      onclick={handleCloseTerm}
      onkeydown={(e) => { if (e.key === 'Escape') handleCloseTerm(); }}
      role="button"
      tabindex="0"
      aria-label="Cerrar modal de término"
    >
      <div
        class="term-modal-card"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="term-modal-title"
        tabindex="-1"
      >
        <!-- Gold Luxury Accent Bar -->
        <div class="modal-gold-bar"></div>

        <div class="modal-card-header">
          <div class="modal-title-left">
            <span class="modal-category-tag">
              <Icon icon="mdi:chip" width="14" />
              <span>{activeModalTerm.category}</span>
            </span>
            <h3 id="term-modal-title" class="modal-term-name">{activeModalTerm.term}</h3>
          </div>
          <button
            class="modal-close-icon-btn"
            onclick={handleCloseTerm}
            aria-label="Cerrar modal"
          >
            <Icon icon="mdi:close" width="22" />
          </button>
        </div>

        <div class="modal-card-body">
          <!-- Section 1: Definition / Conceptual Meaning -->
          <div class="term-info-block definition-block">
            <div class="block-header">
              <Icon icon="mdi:book-open-page-variant-outline" width="18" class="block-icon gold" />
              <span class="block-label">¿QUÉ SIGNIFICA? (DEFINICIÓN)</span>
            </div>
            <p class="block-content">{activeModalTerm.brief}</p>
          </div>

          <!-- Section 2: Application in VLSI Design -->
          <div class="term-info-block application-block">
            <div class="block-header">
              <Icon icon="mdi:lightning-bolt-circle" width="18" class="block-icon cyan" />
              <span class="block-label">APLICACIÓN EN DISEÑO VLSI (IMPACTO & COMPROMISOS)</span>
            </div>
            <p class="block-content">{activeModalTerm.vlsiApplication}</p>
          </div>
        </div>

        <div class="modal-card-footer">
          <button class="btn-modal-close" onclick={handleCloseTerm}>
            <Icon icon="mdi:check-circle-outline" width="18" />
            <span>ENTENDIDO / VOLVER AL EXAMEN</span>
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* 16:9 Full Screen Studio Layout */
  .millionaire-screen {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    width: 100%;
    min-height: 100vh;
    font-family: 'Comic Sans MS', 'Comic Sans', cursive, sans-serif;
    user-select: none;
    box-sizing: border-box;
    padding: 8px 0 16px;
  }

  /* Top Navigation Bar with Responsive Grid (Cannot Clip or Overlap) */
  .top-nav-bar {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    background: linear-gradient(180deg, rgba(16, 30, 66, 0.95) 0%, rgba(9, 18, 40, 0.95) 100%);
    border: 1px solid #d4af37;
    border-radius: 8px;
    padding: 8px 18px;
    margin: 0 16px 4px 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
    z-index: 20;
    min-height: 46px;
  }

  .nav-left-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 2;
  }

  .nav-btn {
    background: #0f1c3f;
    border: 1px solid #d4af37;
    color: #fce69a;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    font-size: 13px;
    font-weight: bold;
    padding: 6px 14px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: background 0.15s, transform 0.1s;
    white-space: nowrap;
    z-index: 2;
  }

  .nav-btn:hover:not(:disabled) {
    background: #1b3576;
    transform: translateY(-1px);
  }

  .nav-btn.switch-btn {
    background: #18336d;
    border-color: #f5c518;
    color: #ffffff;
  }

  /* Centered Topic Badge: Grid center cell with guaranteed non-overlapping truncation */
  .active-topic-badge {
    position: static;
    transform: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 15px;
    color: #ffffff;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
    pointer-events: none;
    min-width: 0;
    width: 100%;
    overflow: hidden;
  }

  .topic-name {
    font-weight: bold;
    color: #fce69a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    text-align: center;
  }

  .topic-count {
    color: #4ade80;
    font-weight: bold;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .nav-right-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 2;
  }

  /* Streak Display: Flame Icon and Number Only (no box, no text) */
  .streak-clean-display {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 20px;
    font-weight: bold;
  }

  :global(.flame-icon) {
    color: #f97316;
    filter: drop-shadow(0 0 8px rgba(249, 115, 22, 0.8));
    animation: flamePulse 1s infinite alternate;
  }

  .streak-num {
    color: #fb923c;
    font-size: 22px;
  }

  /* Cohesive Stage Cluster: Mosquera grouped directly above Question Box, vertically centered */
  .stage-cohesive-cluster {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 10px;
    width: 100%;
    max-width: 1720px;
    margin: auto 0;
  }

  /* Center Stage */
  .stage-center-area {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0;
    flex-shrink: 0;
  }

  /* Side Feedback Panel (Floating upper-right, zero layout shift in stage) */
  .side-feedback-panel {
    position: fixed;
    top: 96px;
    right: 24px;
    width: 380px;
    max-width: calc(100vw - 32px);
    background: linear-gradient(180deg, rgba(16, 42, 30, 0.96) 0%, rgba(8, 24, 18, 0.98) 100%);
    border: 2px solid #22c55e;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.85), 0 0 20px rgba(34, 197, 94, 0.35);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    z-index: 90;
    animation: sideSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes sideSlideIn {
    0% { transform: translateX(30px); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
  }

  .feedback-card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid rgba(74, 222, 128, 0.25);
    padding-bottom: 10px;
  }

  :global(.feedback-success-icon) {
    color: #4ade80;
    filter: drop-shadow(0 0 8px rgba(74, 222, 128, 0.8));
    flex-shrink: 0;
  }

  .header-titles {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .feedback-badge {
    color: #4ade80;
    font-size: 20px;
    font-weight: bold;
    letter-spacing: 0.5px;
    text-shadow: 0 0 8px rgba(74, 222, 128, 0.6);
  }

  .feedback-sub {
    color: #a7f3d0;
    font-size: 13px;
    opacity: 0.9;
  }

  .explanation-box {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(74, 222, 128, 0.2);
    border-radius: 6px;
    padding: 10px 12px;
  }

  .explanation-label {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #fce69a;
    font-size: 12px;
    font-weight: bold;
    margin-bottom: 4px;
  }

  .explanation-text {
    margin: 0;
    font-size: 13px;
    color: #f1f5f9;
    line-height: 1.4;
  }

  .btn-next-question {
    background: linear-gradient(180deg, #4ade80 0%, #22c55e 50%, #16a34a 100%);
    border: 2px solid #bbf7d0;
    border-radius: 8px;
    color: #052e16;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    font-size: 16px;
    font-weight: bold;
    padding: 12px 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.6);
    transition: transform 0.12s, box-shadow 0.12s;
    letter-spacing: 0.5px;
  }

  .btn-next-question:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 6px 20px rgba(34, 197, 94, 0.6);
  }

  .btn-next-question:active {
    transform: translateY(1px);
  }

  .next-key-hint {
    text-align: center;
    font-size: 11px;
    color: #86efac;
    opacity: 0.75;
  }

  /* Quiz Controls Stage (Millionaire Studio Design) */
  .quiz-controls-stage {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    margin-top: 0;
  }

  /* Full-width row with wing lines */
  .millionaire-row {
    display: flex;
    align-items: center;
    width: 100%;
    position: relative;
  }

  .gold-wing-line {
    flex: 1;
    height: 2px;
    background: linear-gradient(90deg, transparent, #cda754 30%, #fce69a 50%, #cda754 70%, transparent);
    box-shadow: 0 0 8px rgba(252, 230, 154, 0.5);
  }

  .center-gold-line {
    width: 48px;
    height: 2px;
    background: linear-gradient(90deg, #cda754, #fce69a, #cda754);
    box-shadow: 0 0 8px rgba(252, 230, 154, 0.5);
    flex-shrink: 0;
  }

  /* Lozenge Shapes (Exact Match to Reference Photo - No Rectangular Highlight) */
  .lozenge-outer {
    position: relative;
    padding: 3px;
    background: linear-gradient(180deg, #fff3a8 0%, #d4af37 25%, #855b14 75%, #f7dc87 100%);
    clip-path: polygon(
      32px 0%,
      calc(100% - 32px) 0%,
      100% 50%,
      calc(100% - 32px) 100%,
      32px 100%,
      0% 50%
    );
    filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.8));
    transition: transform 0.15s, filter 0.15s, opacity 0.2s;
    border: none;
    cursor: default;
  }

  .lozenge-inner {
    width: 100%;
    height: 100%;
    background:
      radial-gradient(ellipse 85% 65% at 50% 18%, rgba(70, 125, 230, 0.55) 0%, transparent 70%),
      linear-gradient(180deg, #284da0 0%, #1e3c84 32%, #13275c 52%, #08112c 100%);
    clip-path: polygon(
      30px 0%,
      calc(100% - 30px) 0%,
      100% 50%,
      calc(100% - 30px) 100%,
      30px 100%,
      0% 50%
    );
    display: flex;
    align-items: center;
    position: relative;
    overflow: hidden;
    box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.4), inset 0 -2px 6px rgba(0, 0, 0, 0.6);
  }

  /* Question Lozenge */
  .question-lozenge {
    width: 92%;
    max-width: 1600px;
    margin: 0 auto;
  }

  .question-inner {
    min-height: 112px;
    padding: 16px 48px;
    justify-content: space-between;
  }

  .question-qmark {
    color: #fce69a;
    font-size: 32px;
    font-weight: bold;
    text-shadow: 0 0 12px rgba(252, 230, 154, 0.85);
    padding: 0 14px;
    flex-shrink: 0;
  }

  .question-content {
    flex: 1;
    text-align: center;
    padding: 0 18px;
  }

  .timer-tag {
    display: inline-block;
    color: #38bdf8;
    font-size: 14px;
    font-weight: bold;
    margin-bottom: 4px;
  }

  .timer-tag.urgent {
    color: #f87171;
    animation: timerPulse 0.5s infinite alternate;
  }

  .question-text {
    font-size: 26px;
    font-weight: bold;
    color: #ffffff;
    margin: 0;
    line-height: 1.45;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.95);
  }

  /* Interactive VLSI Term Buttons inside the Question */
  .question-term-btn {
    background: rgba(254, 240, 138, 0.12);
    border: none;
    border-bottom: 2px dashed #fef08a;
    border-radius: 4px;
    padding: 1px 7px 2px 7px;
    margin: 0 3px;
    color: #fef08a;
    font-family: inherit;
    font-size: inherit;
    font-weight: bold;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    vertical-align: baseline;
    transition: background 0.15s, color 0.15s, transform 0.1s, box-shadow 0.15s, border-bottom 0.15s;
    text-shadow: 0 0 8px rgba(254, 240, 138, 0.6);
  }

  .question-term-btn:hover {
    background: rgba(254, 240, 138, 0.32);
    color: #ffffff;
    border-bottom-style: solid;
    border-bottom-color: #ffd700;
    transform: translateY(-2px);
    box-shadow: 0 4px 14px rgba(254, 240, 138, 0.45);
    text-shadow: 0 0 12px rgba(255, 255, 255, 0.95);
  }

  .question-term-btn:active {
    transform: translateY(0);
  }

  .term-sparkle {
    font-size: 13px;
    color: #ffd700;
    opacity: 0.9;
    animation: sparkleSpin 4s infinite linear;
    flex-shrink: 0;
  }

  /* Answers Lozenge */
  .answer-lozenge {
    flex: 1;
    max-width: 780px;
    cursor: pointer;
  }

  .answer-inner {
    min-height: 82px;
    padding: 12px 34px 12px 24px;
    display: flex;
    align-items: center;
    text-align: left;
  }

  .answer-lozenge:hover:not(:disabled) {
    transform: translateY(-2px);
    filter: drop-shadow(0 0 14px rgba(252, 230, 154, 0.7));
  }

  .answer-lozenge:hover:not(:disabled) .lozenge-inner {
    background:
      radial-gradient(ellipse 85% 65% at 50% 18%, rgba(95, 155, 255, 0.7) 0%, transparent 70%),
      linear-gradient(180deg, #3765c4 0%, #294fa4 32%, #193475 52%, #0b173b 100%);
  }

  .answer-lozenge:active:not(:disabled) {
    transform: translateY(1px);
  }

  /* Badge: A:, B:, C:, D: */
  .option-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 14px;
    padding-left: 12px;
    flex-shrink: 0;
  }

  .badge-letter {
    color: #ffd700;
    font-size: 25px;
    font-weight: bold;
    letter-spacing: 0.5px;
    text-shadow: 0 0 8px rgba(252, 230, 154, 0.85);
  }

  .option-text {
    color: #ffffff;
    font-size: 20px;
    font-weight: bold;
    text-shadow: 0 2px 6px rgba(0, 0, 0, 0.95);
    line-height: 1.32;
    flex: 1;
  }

  /* States */
  .answer-lozenge.selected {
    background: linear-gradient(180deg, #fed7aa 0%, #f97316 40%, #c2410c 100%);
  }

  .answer-lozenge.selected .lozenge-inner {
    background:
      radial-gradient(ellipse 85% 65% at 50% 18%, rgba(254, 215, 170, 0.6) 0%, transparent 70%),
      linear-gradient(180deg, #d97706 0%, #b45309 35%, #78350f 100%) !important;
  }

  .answer-lozenge.reveal-correct {
    background: linear-gradient(180deg, #bbf7d0 0%, #22c55e 40%, #15803d 100%) !important;
    filter: drop-shadow(0 0 20px rgba(34, 197, 94, 0.9)) !important;
    animation: correctFlash 0.5s ease-out;
  }

  .answer-lozenge.reveal-correct .lozenge-inner {
    background:
      radial-gradient(ellipse 85% 65% at 50% 18%, rgba(187, 247, 208, 0.6) 0%, transparent 70%),
      linear-gradient(180deg, #16a34a 0%, #15803d 35%, #14532d 100%) !important;
  }

  /* Shaded out non-correct choices when question is solved */
  .answer-lozenge.shaded-rest {
    opacity: 0.22 !important;
    filter: grayscale(0.85) brightness(0.6) !important;
    pointer-events: none !important;
    cursor: not-allowed !important;
    transition: opacity 0.3s ease, filter 0.3s ease;
  }

  /* Blacked out wrong choices: shaded out, strikethrough, disabled in place (no red) */
  .answer-lozenge.blacked-out {
    background: #141d2e !important;
    filter: grayscale(1) !important;
    opacity: 0.25 !important;
    pointer-events: none !important;
    cursor: not-allowed !important;
  }

  .answer-lozenge.blacked-out .lozenge-inner {
    background: #050a14 !important;
  }

  .answer-lozenge.blacked-out .option-text {
    text-decoration: line-through !important;
    color: #475569 !important;
  }

  .answer-lozenge.blacked-out .badge-letter {
    color: #334155 !important;
  }

  .answer-lozenge.answered:not(.reveal-correct):not(.blacked-out) {
    opacity: 0.35;
  }

  @keyframes flamePulse {
    0% { transform: scale(0.95); }
    100% { transform: scale(1.1); }
  }

  @keyframes timerPulse {
    0% { transform: scale(1); }
    100% { transform: scale(1.1); }
  }

  @keyframes correctFlash {
    0% { filter: brightness(1.6) drop-shadow(0 0 25px rgba(255, 255, 255, 1)); }
    100% { filter: drop-shadow(0 0 20px rgba(34, 197, 94, 0.9)); }
  }

  @keyframes sparkleSpin {
    0% { transform: rotate(0deg) scale(0.9); }
    50% { transform: rotate(180deg) scale(1.15); }
    100% { transform: rotate(360deg) scale(0.9); }
  }

  @keyframes modalFadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }

  @keyframes modalZoomIn {
    0% { transform: scale(0.92); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }

  /* Term Glossary Modal Backdrop & Card */
  .term-modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(3, 7, 18, 0.78);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    padding: 20px;
    animation: modalFadeIn 0.2s ease-out;
  }

  .term-modal-card {
    position: relative;
    width: 100%;
    max-width: 640px;
    background: linear-gradient(180deg, #13244e 0%, #0d1736 60%, #070e24 100%);
    border: 2px solid #d4af37;
    border-radius: 12px;
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.9),
      0 0 25px rgba(212, 175, 55, 0.35);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: modalZoomIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .modal-gold-bar {
    height: 4px;
    width: 100%;
    background: linear-gradient(90deg, #d4af37, #fef08a, #d4af37);
  }

  .modal-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 16px 22px 12px;
    border-bottom: 1px solid rgba(212, 175, 55, 0.25);
    background: rgba(0, 0, 0, 0.25);
  }

  .modal-title-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .modal-category-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: bold;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.3);
    padding: 2px 8px;
    border-radius: 4px;
    width: fit-content;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .modal-term-name {
    margin: 0;
    color: #fce69a;
    font-size: 24px;
    font-weight: bold;
    text-shadow: 0 0 12px rgba(252, 230, 154, 0.7);
    letter-spacing: 0.5px;
  }

  .modal-close-icon-btn {
    background: transparent;
    border: 1px solid rgba(212, 175, 55, 0.4);
    border-radius: 6px;
    color: #fce69a;
    cursor: pointer;
    padding: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, transform 0.1s, border-color 0.15s;
  }

  .modal-close-icon-btn:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: #ef4444;
    color: #f87171;
    transform: scale(1.08);
  }

  .modal-card-body {
    padding: 18px 22px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: 60vh;
    overflow-y: auto;
  }

  .term-info-block {
    background: rgba(0, 0, 0, 0.35);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .definition-block {
    border-left: 3px solid #facc15;
  }

  .application-block {
    border-left: 3px solid #38bdf8;
    background: rgba(8, 24, 48, 0.45);
  }

  .block-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :global(.block-icon.gold) {
    color: #facc15;
  }

  :global(.block-icon.cyan) {
    color: #38bdf8;
  }

  .block-label {
    font-size: 12px;
    font-weight: bold;
    letter-spacing: 0.5px;
    color: #e2e8f0;
  }

  .block-content {
    margin: 0;
    font-size: 14px;
    color: #f1f5f9;
    line-height: 1.45;
  }

  .modal-card-footer {
    display: flex;
    justify-content: flex-end;
    padding: 12px 22px 16px;
    border-top: 1px solid rgba(212, 175, 55, 0.2);
    background: rgba(0, 0, 0, 0.2);
  }

  .btn-modal-close {
    background: linear-gradient(180deg, #1e3a8a 0%, #172554 100%);
    border: 1px solid #d4af37;
    border-radius: 6px;
    color: #fce69a;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    font-size: 14px;
    font-weight: bold;
    padding: 9px 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .btn-modal-close:hover {
    background: linear-gradient(180deg, #2563eb 0%, #1e40af 100%);
    color: #ffffff;
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(37, 99, 235, 0.4);
  }

  /* ==========================================================================
     Responsive Mobile Viewport (Dynamic Single-Screen Fit - ZERO Vertical Scroll)
     ========================================================================== */
  @media (max-width: 768px), (max-height: 720px) {
    .millionaire-screen {
      height: 100vh;
      height: 100dvh;
      max-height: 100dvh;
      overflow: hidden;
      justify-content: space-between;
      padding: 2px 0 4px;
    }

    /* Top Nav Bar Mobile Optimization */
    .top-nav-bar {
      margin: 2px 4px;
      padding: 4px 8px;
      gap: 4px;
      min-height: 36px;
      border-radius: 6px;
    }

    .nav-left-actions {
      gap: 4px;
    }

    .nav-btn {
      padding: 4px 6px;
      font-size: 11px;
      gap: 3px;
      border-radius: 4px;
    }

    .btn-label-desktop {
      display: none; /* Icon-only on mobile gives maximum breathing room to topic title */
    }

    .active-topic-badge {
      font-size: 11px;
      gap: 4px;
    }

    .topic-name {
      font-size: 11px;
      max-width: 150px;
    }

    .topic-count {
      font-size: 10px;
    }

    .nav-right-actions {
      gap: 6px;
    }

    .streak-clean-display {
      font-size: 14px;
      gap: 2px;
    }

    .streak-num {
      font-size: 14px;
    }

    :global(.flame-icon) {
      width: 18px;
      height: 18px;
    }

    /* Center Stage Cluster - Extended to screen edges, Kahoot-like presence */
    .stage-cohesive-cluster {
      gap: 6px;
      width: 100%;
      max-width: 100%;
      padding: 0 8px;
      flex: 1;
      justify-content: center;
      margin: 0 auto;
      overflow: hidden;
      box-sizing: border-box;
    }

    .quiz-controls-stage {
      gap: 6px;
      width: 100%;
    }

    .millionaire-row {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .question-row {
      width: 100%;
    }

    .option-row {
      width: 100%;
      gap: 6px;
    }

    /* Hide wing lines on mobile so buttons extend out to the border of the screen */
    .gold-wing-line {
      display: none;
    }

    .center-gold-line {
      display: none;
    }

    /* Question Lozenge Mobile - Full width, large readable text */
    .question-lozenge {
      width: 100%;
      max-width: 100%;
      padding: 2.5px;
      border-radius: 8px;
      clip-path: polygon(
        10px 0%,
        calc(100% - 10px) 0%,
        100% 50%,
        calc(100% - 10px) 100%,
        10px 100%,
        0% 50%
      );
    }

    .question-inner {
      min-height: 68px;
      padding: 6px 12px;
      border-radius: 6px;
      clip-path: polygon(
        9px 0%,
        calc(100% - 9px) 0%,
        100% 50%,
        calc(100% - 9px) 100%,
        9px 100%,
        0% 50%
      );
    }

    .question-qmark {
      font-size: 18px;
      padding: 0 4px;
    }

    .question-content {
      padding: 0 4px;
    }

    .question-text {
      font-size: 15px;
      font-weight: bold;
      line-height: 1.35;
      text-shadow: 0 2px 6px rgba(0, 0, 0, 0.95);
    }

    .question-term-btn {
      font-size: 15px;
      padding: 1px 4px;
      margin: 0 2px;
    }

    .term-sparkle {
      font-size: 11px;
    }

    .timer-tag {
      font-size: 10px;
      margin-bottom: 2px;
    }

    /* Answer Lozenges Mobile - Big, wide, high-contrast, Kahoot-like prominence */
    .answer-lozenge {
      flex: 1;
      width: calc(50% - 3px);
      max-width: 100%;
      padding: 2.5px;
      border-radius: 8px;
      clip-path: polygon(
        10px 0%,
        calc(100% - 10px) 0%,
        100% 50%,
        calc(100% - 10px) 100%,
        10px 100%,
        0% 50%
      );
    }

    .answer-inner {
      min-height: 76px;
      padding: 6px 10px 6px 6px;
      border-radius: 6px;
      clip-path: polygon(
        9px 0%,
        calc(100% - 9px) 0%,
        100% 50%,
        calc(100% - 9px) 100%,
        9px 100%,
        0% 50%
      );
    }

    .option-badge {
      margin-right: 5px;
      padding-left: 2px;
    }

    .badge-letter {
      font-size: 16px;
    }

    .option-text {
      font-size: 13.5px;
      font-weight: bold;
      line-height: 1.3;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.95);
    }

    /* Side Feedback Panel docked as sleek Mobile Bottom Sheet */
    .side-feedback-panel {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      top: auto;
      width: 100%;
      max-width: 100%;
      border-radius: 14px 14px 0 0;
      padding: 10px 14px 12px;
      gap: 6px;
      z-index: 10000;
      box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.95);
      animation: sideSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .feedback-card-header {
      gap: 6px;
      padding-bottom: 4px;
    }

    .feedback-badge {
      font-size: 14px;
    }

    .feedback-sub {
      font-size: 10px;
    }

    .explanation-box {
      padding: 6px 8px;
      max-height: 60px;
      overflow-y: auto;
    }

    .explanation-label {
      font-size: 10px;
      margin-bottom: 2px;
    }

    .explanation-text {
      font-size: 10px;
      line-height: 1.2;
    }

    .btn-next-question {
      padding: 8px 12px;
      font-size: 13px;
    }

    .next-key-hint {
      display: none;
    }

    /* Term Modal Mobile Tuning */
    .term-modal-backdrop {
      padding: 8px;
    }

    .term-modal-card {
      max-width: 96vw;
      max-height: 88vh;
    }

    .modal-card-header {
      padding: 8px 12px;
    }

    .modal-term-name {
      font-size: 16px;
    }

    .modal-card-body {
      padding: 10px 12px;
      gap: 8px;
      max-height: 55vh;
    }

    .term-info-block {
      padding: 8px 10px;
      gap: 4px;
    }

    .block-label {
      font-size: 10px;
    }

    .block-content {
      font-size: 11px;
      line-height: 1.3;
    }

    .modal-card-footer {
      padding: 8px 12px 10px;
    }

    .btn-modal-close {
      padding: 6px 14px;
      font-size: 12px;
    }
  }

  @keyframes sideSlideUp {
    0% { transform: translateY(100%); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }
</style>
