<script>
  import { onMount, onDestroy } from 'svelte';
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
  // { [questionId]: Set<string> }
  let disabledOptionsMap = $state({});

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

  // Shuffle the options of a question and re-map the correctIndex
  function prepareQuestionWithShuffledOptions(rawQ) {
    if (!rawQ) return null;
    const originalOptions = rawQ.options;
    const correctText = originalOptions[rawQ.correctIndex];

    // Create an array of indices [0, 1, 2, 3] and shuffle
    const shuffledIndices = shuffleArray([0, 1, 2, 3].slice(0, originalOptions.length));
    const shuffledOptions = shuffledIndices.map(i => originalOptions[i]);
    const newCorrectIndex = shuffledOptions.indexOf(correctText);

    return {
      ...rawQ,
      options: shuffledOptions,
      correctIndex: newCorrectIndex
    };
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

    // Randomize the multiple choice options (A, B, C, D)
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
    if (isAnswered) return;
    const optionText = currentQuestion?.options[index];
    // Prevent clicking already blacked-out options
    if (disabledOptionsMap[currentQuestion?.id]?.has(optionText)) return;

    playClick();
    submitAnswer(index, false);
  }

  function submitAnswer(index, isTimeout = false) {
    if (timerInterval) clearInterval(timerInterval);
    isAnswered = true;
    selectedOptionIndex = index;

    const correct = !isTimeout && index === currentQuestion.correctIndex;
    isCorrect = correct;

    if (correct) {
      if (streak >= 2) {
        playCombo();
        lastEvent = 'combo';
      } else {
        playCorrect();
        lastEvent = 'correct';
      }
    } else {
      playWrong();
      lastEvent = 'wrong';

      // Black out the chosen wrong option by its TEXT so it stays blacked out when retried!
      if (!isTimeout && index >= 0) {
        const wrongOptionText = currentQuestion.options[index];
        if (!disabledOptionsMap[currentQuestion.id]) {
          disabledOptionsMap[currentQuestion.id] = new Set();
        }
        disabledOptionsMap[currentQuestion.id].add(wrongOptionText);
      }

      if (isTimeout) {
        lastMessage = "Time expired.";
      }
    }

    onAnswer({
      questionId: currentQuestion.id,
      topic: activeTopic,
      isCorrect: correct,
      selectedOption: index
    });
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
    if (activeTopic) {
      loadNextQuestion();
    }
  });

  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval);
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
      <span>Menu</span>
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
        <button class="nav-btn switch-btn" onclick={promptSwitchTopic} title="Switch Topic">
          <Icon icon="mdi:swap-horizontal" width="16" />
          <span>Switch Topic</span>
        </button>
      {/if}
      <button class="nav-btn" onclick={handleSkipQuestion} disabled={isAnswered}>
        <Icon icon="mdi:skip-next" width="16" />
        <span>Skip</span>
      </button>
    </div>
  </div>

  {#if currentQuestion}
    <!-- Center Stage: Dr. Mosquera (Hot Seat) -->
    <div class="stage-center-area">
      <MosqueraMood
        {happiness}
        {streak}
        {lastEvent}
        {lastMessage}
      />
    </div>

    <!-- Feedback Banner (When Answered) -->
    {#if isAnswered}
      <div class="feedback-banner" class:correct={isCorrect} class:wrong={!isCorrect}>
        <div class="feedback-left">
          <Icon icon={isCorrect ? "mdi:check-circle" : "mdi:alert-circle"} width="28" class="feedback-icon" />
          <div class="feedback-text-group">
            <span class="feedback-title">{isCorrect ? "Correct!" : "Incorrect"}</span>
            {#if currentQuestion.explanation}
              <p class="feedback-explanation">{currentQuestion.explanation}</p>
            {/if}
          </div>
        </div>
        <button class="btn-continue" onclick={handleNextClick}>
          <span>Next</span>
          <Icon icon="mdi:arrow-right" width="18" />
        </button>
      </div>
    {/if}

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

            <!-- Corner Glints -->
            <div class="lozenge-glint tl"></div>
            <div class="lozenge-glint br"></div>
          </div>
        </div>

        <div class="gold-wing-line right"></div>
      </div>

      <!-- 2. Answers Row 1: Option A (left) and Option C (right) -->
      <div class="millionaire-row answers-row">
        <div class="gold-wing-line left"></div>

        {#each row1Options as item, i}
          {@const opt = currentQuestion.options[item.idx]}
          {@const isBlackedOut = disabledOptionsMap[currentQuestion.id]?.has(opt)}
          {@const isSelected = selectedOptionIndex === item.idx}
          {@const isCorrectOpt = item.idx === currentQuestion.correctIndex}

          {#if i > 0}
            <div class="center-gold-line"></div>
          {/if}

          <button
            class="lozenge-outer answer-lozenge"
            class:answered={isAnswered}
            class:selected={isSelected}
            class:reveal-correct={isAnswered && isCorrectOpt}
            class:reveal-wrong={isAnswered && isSelected && !isCorrectOpt}
            class:blacked-out={isBlackedOut}
            onclick={() => handleOptionClick(item.idx)}
            disabled={isAnswered || isBlackedOut}
          >
            <div class="lozenge-inner answer-inner">
              <div class="option-badge">
                <span class="badge-letter">{item.label}</span>
              </div>
              <span class="option-text">{opt}</span>
              <div class="lozenge-glint tl"></div>
              <div class="lozenge-glint br"></div>
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
          {@const isBlackedOut = disabledOptionsMap[currentQuestion.id]?.has(opt)}
          {@const isSelected = selectedOptionIndex === item.idx}
          {@const isCorrectOpt = item.idx === currentQuestion.correctIndex}

          {#if i > 0}
            <div class="center-gold-line"></div>
          {/if}

          <button
            class="lozenge-outer answer-lozenge"
            class:answered={isAnswered}
            class:selected={isSelected}
            class:reveal-correct={isAnswered && isCorrectOpt}
            class:reveal-wrong={isAnswered && isSelected && !isCorrectOpt}
            class:blacked-out={isBlackedOut}
            onclick={() => handleOptionClick(item.idx)}
            disabled={isAnswered || isBlackedOut}
          >
            <div class="lozenge-inner answer-inner">
              <div class="option-badge">
                <span class="badge-letter">{item.label}</span>
              </div>
              <span class="option-text">{opt}</span>
              <div class="lozenge-glint tl"></div>
              <div class="lozenge-glint br"></div>
            </div>
          </button>
        {/each}

        <div class="gold-wing-line right"></div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* 16:9 Full Screen Studio Layout */
  .millionaire-screen {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: 100%;
    min-height: calc(100vh - 20px);
    font-family: 'Comic Sans MS', 'Comic Sans', cursive, sans-serif;
    user-select: none;
    box-sizing: border-box;
    padding-bottom: 16px;
  }

  /* Top Navigation Bar */
  .top-nav-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(180deg, rgba(16, 30, 66, 0.95) 0%, rgba(9, 18, 40, 0.95) 100%);
    border: 1px solid #d4af37;
    border-radius: 8px;
    padding: 8px 20px;
    margin: 4px 16px 8px;
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

  .active-topic-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #ffffff;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
  }

  .topic-name {
    font-weight: bold;
    color: #fce69a;
  }

  .topic-count {
    color: #4ade80;
    font-weight: bold;
  }

  .nav-right-actions {
    display: flex;
    align-items: center;
    gap: 16px;
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

  /* Center Stage */
  .stage-center-area {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 2px 0 8px;
    flex-shrink: 0;
  }

  /* Feedback Banner */
  .feedback-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 900px;
    margin: 0 auto 10px;
    padding: 10px 24px;
    border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.7);
    animation: bannerPop 0.25s ease-out;
    z-index: 15;
  }

  .feedback-banner.correct {
    background: linear-gradient(180deg, #15803d 0%, #166534 100%);
    border: 2px solid #4ade80;
    color: #ffffff;
  }

  .feedback-banner.wrong {
    background: linear-gradient(180deg, #991b1b 0%, #7f1d1d 100%);
    border: 2px solid #ef4444;
    color: #ffffff;
  }

  .feedback-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .feedback-text-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .feedback-title {
    font-size: 16px;
    font-weight: bold;
  }

  .feedback-explanation {
    margin: 0;
    font-size: 13px;
    opacity: 0.95;
    line-height: 1.35;
  }

  .btn-continue {
    background: #ffffff;
    color: #0f1c3f;
    border: none;
    border-radius: 4px;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    font-size: 14px;
    font-weight: bold;
    padding: 8px 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
    white-space: nowrap;
    transition: transform 0.1s;
  }

  .btn-continue:hover {
    transform: scale(1.04);
  }

  /* Quiz Controls Stage (Millionaire Studio Design) */
  .quiz-controls-stage {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    margin-top: auto;
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
    width: 44px;
    height: 2px;
    background: linear-gradient(90deg, #cda754, #fce69a, #cda754);
    box-shadow: 0 0 8px rgba(252, 230, 154, 0.5);
    flex-shrink: 0;
  }

  /* Lozenge Shapes (Exact Match to Photo) */
  .lozenge-outer {
    position: relative;
    padding: 3px;
    background: linear-gradient(180deg, #fff3a8 0%, #d4af37 25%, #855b14 75%, #f7dc87 100%);
    clip-path: polygon(
      28px 0%,
      calc(100% - 28px) 0%,
      100% 50%,
      calc(100% - 28px) 100%,
      28px 100%,
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
    background: linear-gradient(180deg, #1b387e 0%, #13275c 48%, #0d1b42 52%, #08112c 100%);
    clip-path: polygon(
      26px 0%,
      calc(100% - 26px) 0%,
      100% 50%,
      calc(100% - 26px) 100%,
      26px 100%,
      0% 50%
    );
    display: flex;
    align-items: center;
    position: relative;
    overflow: hidden;
  }

  /* Top Glossy Highlight */
  .lozenge-inner::before {
    content: '';
    position: absolute;
    top: 0;
    left: 26px;
    right: 26px;
    height: 46%;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.02) 100%);
    pointer-events: none;
  }

  /* Corner Glints */
  .lozenge-glint {
    position: absolute;
    width: 16px;
    height: 16px;
    background: radial-gradient(circle, #ffffff 15%, #ffd700 45%, transparent 75%);
    pointer-events: none;
    filter: drop-shadow(0 0 5px #ffffff);
  }

  .lozenge-glint.tl {
    top: -4px;
    left: 32px;
  }

  .lozenge-glint.br {
    bottom: -4px;
    right: 32px;
  }

  /* Question Lozenge */
  .question-lozenge {
    width: 86%;
    max-width: 1400px;
    margin: 0 auto;
  }

  .question-inner {
    min-height: 85px;
    padding: 10px 32px;
    justify-content: space-between;
  }

  .question-qmark {
    color: #fce69a;
    font-size: 26px;
    font-weight: bold;
    text-shadow: 0 0 10px rgba(252, 230, 154, 0.8);
    padding: 0 8px;
    flex-shrink: 0;
  }

  .question-content {
    flex: 1;
    text-align: center;
    padding: 0 16px;
  }

  .timer-tag {
    display: inline-block;
    color: #38bdf8;
    font-size: 13px;
    font-weight: bold;
    margin-bottom: 4px;
  }

  .timer-tag.urgent {
    color: #f87171;
    animation: timerPulse 0.5s infinite alternate;
  }

  .question-text {
    font-size: 20px;
    font-weight: bold;
    color: #ffffff;
    margin: 0;
    line-height: 1.35;
    text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
  }

  /* Answers Lozenge */
  .answer-lozenge {
    flex: 1;
    max-width: 680px;
    cursor: pointer;
  }

  .answer-inner {
    min-height: 64px;
    padding: 10px 28px 10px 24px;
    display: flex;
    align-items: center;
    text-align: left;
  }

  .answer-lozenge:hover:not(:disabled) {
    transform: translateY(-2px);
    filter: drop-shadow(0 0 14px rgba(252, 230, 154, 0.7));
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
    color: #fce69a;
    font-size: 20px;
    font-weight: bold;
    letter-spacing: 0.5px;
    text-shadow: 0 0 8px rgba(252, 230, 154, 0.8);
  }

  .option-text {
    color: #ffffff;
    font-size: 17px;
    font-weight: bold;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
    line-height: 1.3;
    flex: 1;
  }

  /* States */
  .answer-lozenge.selected {
    background: linear-gradient(180deg, #fed7aa 0%, #f97316 40%, #c2410c 100%);
  }

  .answer-lozenge.selected .lozenge-inner {
    background: linear-gradient(180deg, #c2410c 0%, #9a3412 50%, #7c2d12 100%);
  }

  .answer-lozenge.reveal-correct {
    background: linear-gradient(180deg, #bbf7d0 0%, #22c55e 40%, #15803d 100%) !important;
    filter: drop-shadow(0 0 20px rgba(34, 197, 94, 0.9)) !important;
    animation: correctFlash 0.5s ease-out;
  }

  .answer-lozenge.reveal-correct .lozenge-inner {
    background: linear-gradient(180deg, #15803d 0%, #166534 50%, #14532d 100%) !important;
  }

  .answer-lozenge.reveal-wrong {
    background: linear-gradient(180deg, #fecaca 0%, #ef4444 40%, #b91c1c 100%) !important;
    filter: drop-shadow(0 0 20px rgba(239, 68, 68, 0.9)) !important;
  }

  .answer-lozenge.reveal-wrong .lozenge-inner {
    background: linear-gradient(180deg, #b91c1c 0%, #991b1b 50%, #7f1d1d 100%) !important;
  }

  /* Blacked out wrong choices on retry */
  .answer-lozenge.blacked-out {
    background: #1e293b !important;
    filter: grayscale(1) !important;
    opacity: 0.22 !important;
    pointer-events: none !important;
    cursor: not-allowed !important;
  }

  .answer-lozenge.blacked-out .lozenge-inner {
    background: #060b14 !important;
  }

  .answer-lozenge.blacked-out .option-text {
    text-decoration: line-through !important;
    color: #475569 !important;
  }

  .answer-lozenge.blacked-out .badge-letter {
    color: #334155 !important;
  }

  .answer-lozenge.answered:not(.reveal-correct):not(.reveal-wrong):not(.blacked-out) {
    opacity: 0.45;
  }

  @keyframes flamePulse {
    0% { transform: scale(0.95); }
    100% { transform: scale(1.1); }
  }

  @keyframes timerPulse {
    0% { transform: scale(1); }
    100% { transform: scale(1.1); }
  }

  @keyframes bannerPop {
    0% { transform: translateY(-8px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }

  @keyframes correctFlash {
    0% { filter: brightness(1.6) drop-shadow(0 0 25px rgba(255, 255, 255, 1)); }
    100% { filter: drop-shadow(0 0 20px rgba(34, 197, 94, 0.9)); }
  }
</style>
