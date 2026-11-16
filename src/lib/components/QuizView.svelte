<script>
  import { onMount, onDestroy, untrack } from 'svelte';
  import Icon from '@iconify/svelte';
  import MosqueraMood from './MosqueraMood.svelte';
  import { playCorrect, playWrong, playCombo, playTick, playClick } from '#lib/audio/soundFx.js';

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

  $effect(() => {
    const topic = activeTopic;
    untrack(() => {
      if (topic) {
        loadNextQuestion();
      }
    });
  });

  function handleKeyDown(e) {
    if (isCorrect && (e.key === 'Enter' || e.key === ' ')) {
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
  <!-- Top Navigation & Stage HUD -->
  <div class="top-nav-bar">
    <button class="nav-btn" onclick={onBackToMenu}>
      <Icon icon="mdi:arrow-left" width="16" />
      <span>Menú</span>
    </button>

    <div class="active-topic-badge">
      <span class="topic-name">{activeTopic}</span>
      <span class="topic-count">[{topicStats.mastered}/{topicStats.total}]</span>
    </div>

    <div class="nav-right-actions">
      <!-- Streak Display: Flame Icon and Number Only (no box, no text) -->
      <div class="streak-clean-display">
        <Icon icon="mdi:fire" width="28" class="flame-icon" />
        <span class="streak-num">{streak}</span>
      </div>

      {#if availableTopics.length > 1}
        <button class="nav-btn switch-btn" onclick={promptSwitchTopic} title="Cambiar Tema">
          <Icon icon="mdi:swap-horizontal" width="16" />
          <span>Cambiar Tema</span>
        </button>
      {/if}
      <button class="nav-btn" onclick={handleSkipQuestion} disabled={isAnswered}>
        <Icon icon="mdi:skip-next" width="16" />
        <span>Pasar</span>
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
                <h2 class="question-text">{currentQuestion.question}</h2>
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

  /* Top Navigation Bar with Centered Topic Title */
  .top-nav-bar {
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(180deg, rgba(16, 30, 66, 0.95) 0%, rgba(9, 18, 40, 0.95) 100%);
    border: 1px solid #d4af37;
    border-radius: 8px;
    padding: 8px 24px;
    margin: 0 16px 4px 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
    z-index: 20;
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

  /* Centered Topic Badge */
  .active-topic-badge {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 15px;
    color: #ffffff;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
    pointer-events: none;
    max-width: 65%;
  }

  .topic-name {
    font-weight: bold;
    color: #fce69a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .topic-count {
    color: #4ade80;
    font-weight: bold;
    flex-shrink: 0;
  }

  .nav-right-actions {
    display: flex;
    align-items: center;
    gap: 16px;
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
    line-height: 1.35;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.95);
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
</style>
