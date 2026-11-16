<!-- Versus Mode Live Game Screen: Kahoot-style mobile layout with Dr. Mosquera reactions, 4-color buttons, reveal badges, speed scoring, and 5s auto-advance -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import Icon from '@iconify/svelte';
  import MosqueraMood from '#lib/components/MosqueraMood.svelte';
  import { playCorrect, playWrong, playCombo, playTick, playClick } from '#lib/audio/soundFx.js';

  let {
    isHost = false,
    peerManager = null,
    hostEngine = null,
    roomCode = '',
    playerId = '',
    nickname = '',
    initialPayload = null,
    onExitToMenu = () => {}
  } = $props();

  // Current Game Phase: 'question' | 'reveal' | 'finished'
  let gameState = $state('question');

  // Question Info
  let currentQuestionIndex = $state(0);
  let totalQuestions = $state(10);
  let questionData = $state({
    id: '',
    topic: '',
    question: '',
    options: []
  });

  // Timer
  let timeLimitSeconds = $state(20);
  let secondsRemaining = $state(20);
  let timerProgressPct = $state(100);
  let timerInterval = null;

  // Single Attempt Player Answer State
  let mySelectedOption = $state(null); // null or 0..3
  let hasLockedIn = $state(false);
  let answeredPlayerIds = $state([]); // IDs of players who have answered

  // Reveal Phase State
  let correctIndex = $state(-1);
  let explanation = $state('');
  let roundResults = $state([]); // [{ playerId, nickname, choiceIndex, isCorrect, pointsAwarded, totalScore }]
  let leaderboard = $state([]);
  let myRoundPoints = $state(0);
  let myTotalScore = $state(0);
  let roomAccuracyPct = $state(0);
  let roomMoodTier = $state('neutral');
  let mosqueraRoomQuote = $state('');
  let autoAdvanceCountdown = $state(5);

  // Side Popup State & Helpers (Showing who got it right/wrong and what they chose)
  let isSidePopupOpen = $state(true);

  let correctPlayers = $derived.by(() => {
    return roundResults.filter(r => r.isCorrect);
  });

  let wrongPlayers = $derived.by(() => {
    return roundResults.filter(r => !r.isCorrect);
  });

  function getOptionInfo(idx) {
    if (idx === null || idx === undefined || idx < 0 || idx >= questionData.options.length) {
      return { symbol: '⏱', label: '—', text: 'No Answer / Timed Out', color: '#94a3b8' };
    }
    const theme = optionThemes[idx % 4];
    return {
      symbol: theme.symbol,
      label: theme.label,
      text: questionData.options[idx] || `Option ${theme.label}`,
      color: theme.color
    };
  }

  // Final Match State
  let finalLeaderboard = $state([]);
  let matchWinner = $state(null);

  // Active players list
  let playersList = $state([]);

  // Kahoot color palettes & shapes for 4 options
  const optionThemes = [
    { color: '#e21b3c', bgGradient: 'linear-gradient(135deg, #e21b3c 0%, #b8142f 100%)', symbol: '▲', label: 'A', name: 'red' },
    { color: '#1368ce', bgGradient: 'linear-gradient(135deg, #1368ce 0%, #0d4a94 100%)', symbol: '◆', label: 'B', name: 'blue' },
    { color: '#d89e00', bgGradient: 'linear-gradient(135deg, #ffa602 0%, #d88900 100%)', symbol: '●', label: 'C', name: 'yellow' },
    { color: '#26890c', bgGradient: 'linear-gradient(135deg, #26890c 0%, #195f08 100%)', symbol: '■', label: 'D', name: 'green' }
  ];

  // Dr. Mosquera happiness percentage based on room accuracy or current state
  let mosqueraHappiness = $state(50);

  onMount(() => {
    // Save session in sessionStorage so phone closing/refreshing reconnects seamlessly
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('mosq_vs_session', JSON.stringify({
        roomCode,
        isHost,
        playerId,
        nickname
      }));
    }

    // Attach message handlers to PeerManager
    if (peerManager) {
      peerManager.onMessage = handleIncomingMessage;
      peerManager.onPlayerDisconnected = handlePlayerDisconnected;
    }

    // If host engine exists, subscribe to its state changes
    if (isHost && hostEngine) {
      hostEngine.onStateChange = handleHostEngineStateChange;
    }

    // Process initial payload if provided from lobby start
    if (initialPayload) {
      applyQuestionStart(initialPayload);
    }
  });

  onDestroy(() => {
    clearInterval(timerInterval);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('mosq_vs_session');
    }
  });

  // Handle incoming P2P messages
  function handleIncomingMessage(data, senderId) {
    if (!data) return;

    switch (data.type) {
      case 'QUESTION_START':
        applyQuestionStart(data.payload);
        break;

      case 'PLAYER_ANSWERED':
        if (data.payload?.answeredPlayerIds) {
          answeredPlayerIds = data.payload.answeredPlayerIds;
        }
        break;

      case 'ROUND_REVEAL':
        applyRoundReveal(data.payload);
        break;

      case 'AUTO_ADVANCE_TICK':
        if (data.payload?.secondsRemaining !== undefined) {
          autoAdvanceCountdown = data.payload.secondsRemaining;
        }
        break;

      case 'GAME_FINISHED':
        applyGameFinished(data.payload);
        break;

      case 'SYNC_STATE':
        applySyncState(data.payload);
        break;

      case 'SUBMIT_ANSWER':
        if (isHost && hostEngine) {
          hostEngine.handlePlayerAnswer(senderId, data.payload?.optionIndex);
        }
        break;
    }
  }

  function handleHostEngineStateChange(statePayload) {
    if (!statePayload) return;
    if (statePayload.players) {
      playersList = statePayload.players;
    }
    if (statePayload.state === 'question' && statePayload.question) {
      applyQuestionStart(statePayload);
    } else if (statePayload.state === 'reveal') {
      applyRoundReveal(statePayload);
    } else if (statePayload.state === 'finished') {
      applyGameFinished(statePayload);
    }
  }

  function handlePlayerDisconnected(pId) {
    if (pId === 'host' && !isHost) {
      alert('The Host has disconnected from the match.');
      onExitToMenu();
    }
  }

  // --- START A QUESTION ---
  function applyQuestionStart(payload) {
    clearInterval(timerInterval);

    gameState = 'question';
    isSidePopupOpen = false;
    currentQuestionIndex = payload.questionIndex ?? 0;
    totalQuestions = payload.totalQuestions ?? 10;
    questionData = payload.question || { id: '', topic: '', question: '', options: [] };
    timeLimitSeconds = payload.timeLimitSeconds || 20;
    secondsRemaining = timeLimitSeconds;
    timerProgressPct = 100;

    mySelectedOption = null;
    hasLockedIn = false;
    answeredPlayerIds = [];

    correctIndex = -1;
    explanation = '';
    roundResults = [];
    myRoundPoints = 0;

    if (payload.players) {
      playersList = payload.players;
    }

    // Start local visual countdown
    const startMs = payload.startTime || Date.now();
    const totalMs = timeLimitSeconds * 1000;

    timerInterval = setInterval(() => {
      const elapsed = Date.now() - startMs;
      const leftMs = Math.max(0, totalMs - elapsed);
      secondsRemaining = Math.ceil(leftMs / 1000);
      timerProgressPct = Math.max(0, (leftMs / totalMs) * 100);

      if (secondsRemaining <= 3 && secondsRemaining > 0) {
        playTick();
      }

      if (leftMs <= 0) {
        clearInterval(timerInterval);
      }
    }, 100);
  }

  // --- SINGLE ATTEMPT ANSWER LOCK-IN ---
  function handleSelectOption(index) {
    if (gameState !== 'question' || hasLockedIn) return; // Strict single choice!

    playClick();
    mySelectedOption = index;
    hasLockedIn = true;

    // Send answer to host (or handle locally if self is host)
    if (isHost && hostEngine) {
      hostEngine.handlePlayerAnswer(playerId, index);
    } else if (peerManager) {
      peerManager.sendToHost({
        type: 'SUBMIT_ANSWER',
        payload: { optionIndex: index }
      });
    }

    if (!answeredPlayerIds.includes(playerId)) {
      answeredPlayerIds = [...answeredPlayerIds, playerId];
    }
  }

  // --- ROUND REVEAL PHASE ---
  function applyRoundReveal(payload) {
    clearInterval(timerInterval);
    gameState = 'reveal';
    isSidePopupOpen = true;

    correctIndex = payload.correctIndex ?? -1;
    explanation = payload.explanation || '';
    roundResults = payload.roundResults || [];
    leaderboard = payload.leaderboard || [];
    roomAccuracyPct = Math.round((payload.accuracy || 0) * 100);
    roomMoodTier = payload.moodTier || 'neutral';
    mosqueraRoomQuote = payload.mosqueraQuote || '';
    autoAdvanceCountdown = payload.autoAdvanceSeconds || 5;

    // Determine Mosquera happiness meter from class accuracy
    mosqueraHappiness = roomAccuracyPct;

    // Check local player's result
    const me = roundResults.find(r => r.playerId === playerId);
    if (me) {
      myRoundPoints = me.pointsAwarded;
      myTotalScore = me.totalScore;
      if (me.isCorrect) {
        if (myRoundPoints >= 850) {
          playCombo();
        } else {
          playCorrect();
        }
      } else {
        playWrong();
      }
    } else {
      playWrong();
    }
  }

  // --- GAME FINISHED (PODIUM) ---
  function applyGameFinished(payload) {
    clearInterval(timerInterval);
    gameState = 'finished';
    finalLeaderboard = payload.finalLeaderboard || [];
    matchWinner = payload.winner || null;
    playCombo();
  }

  // --- SYNC RECONNECTING STATE ---
  function applySyncState(payload) {
    gameState = payload.state;
    currentQuestionIndex = payload.questionIndex ?? 0;
    totalQuestions = payload.totalQuestions ?? 10;
    if (payload.question) {
      questionData = payload.question;
    }
    timeLimitSeconds = payload.timeLimitSeconds || 20;
    if (payload.hasAnswered) {
      hasLockedIn = true;
      mySelectedOption = payload.myChoice;
    }
    if (payload.leaderboard) {
      leaderboard = payload.leaderboard;
      const me = leaderboard.find(p => p.id === playerId);
      if (me) myTotalScore = me.score;
    }
  }

  // Helper: Find players who picked a specific option index
  function getPlayersForOption(optionIdx) {
    return roundResults.filter(r => r.choiceIndex === optionIdx);
  }

  // Host restarts match with new random questions
  function handlePlayAgain() {
    if (isHost && hostEngine) {
      playClick();
      hostEngine.startGame();
    }
  }

  function handleExit() {
    playClick();
    if (confirm('Are you sure you want to leave the match?')) {
      if (peerManager) peerManager.destroy();
      if (hostEngine) hostEngine.destroy();
      onExitToMenu();
    }
  }
</script>

<div class="versus-stage-wrapper">
  <!-- Top Utility Bar: Room Code, Question Counter, Score, Exit -->
  <header class="versus-topbar">
    <div class="topbar-left">
      <div class="room-code-badge" title="4-Letter Room Code">
        <Icon icon="mdi:broadcast" width="16" class="code-icon" />
        <span class="code-label">ROOM:</span>
        <strong class="code-text">{roomCode}</strong>
      </div>
      {#if gameState !== 'finished'}
        <div class="q-counter-badge">
          <span>Q {currentQuestionIndex + 1}/{totalQuestions}</span>
        </div>
      {/if}
    </div>

    <div class="topbar-right">
      <div class="player-score-pill">
        <Icon icon="mdi:trophy" width="16" class="score-icon" />
        <span class="player-nick-text">{nickname}:</span>
        <strong class="score-num">{myTotalScore} pts</strong>
      </div>
      <button class="btn-leave-match" onclick={handleExit} title="Exit Match">
        <Icon icon="mdi:logout" width="18" />
      </button>
    </div>
  </header>

  <!-- MAIN PLAY AREA: QUESTION & REVEAL PHASES -->
  {#if gameState === 'question' || gameState === 'reveal'}
    <div class="versus-play-container">

      <!-- 1. DR. MOSQUERA CHARACTER & CLASS REACTION (Top area matching screenshot) -->
      <section class="mosquera-versus-section">
        <MosqueraMood
          happiness={mosqueraHappiness}
          streak={0}
          lastEvent={gameState === 'reveal' ? (roomAccuracyPct >= 50 ? 'correct' : 'wrong') : 'idle'}
          lastMessage={gameState === 'reveal'
            ? `${mosqueraRoomQuote} (${roomAccuracyPct}% Class Accuracy)`
            : ''}
        />
      </section>

      <!-- 2. QUESTION CARD -->
      <section class="question-card-box">
        <div class="question-meta-row">
          <span class="topic-tag-pill">{questionData.topic || 'CMOS VLSI'}</span>
          {#if gameState === 'question'}
            <span class="answered-ratio-pill">
              <Icon icon="mdi:account-check" width="14" />
              <span>{answeredPlayerIds.length}/{playersList.length || 1} answered</span>
            </span>
          {:else}
            <span class="accuracy-tag-pill {roomMoodTier}">
              Room Accuracy: <strong>{roomAccuracyPct}%</strong>
            </span>
          {/if}
        </div>
        <div class="question-prompt-text">
          {questionData.question}
        </div>
      </section>

      <!-- 3. KAHOOT-STYLE 2x2 ANSWER GRID (Full-bleed responsive buttons) -->
      <section class="answers-grid-2x2">
        {#each questionData.options as option, idx}
          {@const theme = optionThemes[idx % 4]}
          {@const isMyPick = mySelectedOption === idx}
          {@const isCorrectChoice = gameState === 'reveal' && idx === correctIndex}
          {@const isWrongChoice = gameState === 'reveal' && idx !== correctIndex}
          {@const playersOnThis = gameState === 'reveal' ? getPlayersForOption(idx) : []}

          <button
            type="button"
            class="kahoot-answer-btn {theme.name}
              {hasLockedIn ? 'locked-state' : ''}
              {isMyPick ? 'my-pick' : ''}
              {isCorrectChoice ? 'is-correct-reveal' : ''}
              {isWrongChoice ? 'is-wrong-reveal' : ''}"
            style="--tile-color: {theme.color}; --tile-bg: {theme.bgGradient};"
            disabled={hasLockedIn || gameState === 'reveal'}
            onclick={() => handleSelectOption(idx)}
          >
            <!-- Button Shape Symbol (Triangle, Diamond, Circle, Square) -->
            <div class="symbol-badge">
              <span class="symbol-glyph">{theme.symbol}</span>
            </div>

            <!-- Option Text Content -->
            <div class="answer-content">
              <span class="option-text">{option}</span>
            </div>

            <!-- Single Choice Lock-in Indicator -->
            {#if isMyPick && gameState === 'question'}
              <div class="locked-in-badge">
                <Icon icon="mdi:check-circle" width="18" />
                <span>LOCKED</span>
              </div>
            {/if}

            <!-- Reveal Phase: Show player badges who guessed this option -->
            {#if gameState === 'reveal' && playersOnThis.length > 0}
              <div class="revealed-players-container">
                {#each playersOnThis as p}
                  <span class="player-guess-chip {p.playerId === playerId ? 'is-me' : ''} {p.isCorrect ? 'chip-correct' : 'chip-wrong'}">
                    {p.nickname} {p.isCorrect ? `(+${p.pointsAwarded})` : '✗'}
                  </span>
                {/each}
              </div>
            {/if}
          </button>
        {/each}
      </section>

      <!-- 4. REVEAL OVERLAY BANNER & 5-SECOND AUTO-ADVANCE BAR -->
      {#if gameState === 'reveal'}
        <div class="reveal-advance-banner">
          <div class="reveal-result-info">
            {#if mySelectedOption === correctIndex}
              <div class="points-awarded-badge correct-badge">
                <Icon icon="mdi:check-bold" width="22" />
                <span>CORRECT! +{myRoundPoints} PTS!</span>
              </div>
            {:else}
              <div class="points-awarded-badge wrong-badge">
                <Icon icon="mdi:close-thick" width="22" />
                <span>MISSED! (+0 PTS)</span>
              </div>
            {/if}

            <div class="auto-advance-timer">
              <span>Next question in <strong>{autoAdvanceCountdown}s</strong></span>
              <div class="auto-advance-bar-track">
                <div
                  class="auto-advance-bar-fill"
                  style="width: {(autoAdvanceCountdown / 5) * 100}%;"
                ></div>
              </div>
            </div>
          </div>

          <!-- Quick Round Mini-Leaderboard -->
          {#if leaderboard.length > 0}
            <div class="round-mini-leaderboard">
              {#each leaderboard.slice(0, 4) as rankP, rankIdx}
                <div class="mini-rank-pill {rankP.id === playerId ? 'highlight-me' : ''}">
                  <span class="rank-pos">#{rankIdx + 1}</span>
                  <span class="rank-nick">{rankP.nickname}</span>
                  <span class="rank-score">{rankP.score}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- 5. BOTTOM TIMER PILL / PROGRESS BAR (Matching attachment) -->
      {#if gameState === 'question'}
        <footer class="bottom-timer-container">
          <div class="kahoot-timer-pill">
            <div
              class="timer-progress-fill"
              style="width: {timerProgressPct}%;"
            ></div>
            <div class="timer-number-bubble">
              <span class="timer-digits">{secondsRemaining}</span>
            </div>
          </div>
        </footer>
      {/if}

    </div>

    <!-- Side Popup: Shows all players who got it right and wrong, and what answer they chose -->
    {#if gameState === 'reveal'}
      <!-- Floating Side Tab for toggling/peeking -->
      <button
        type="button"
        class="side-popup-toggle-btn {isSidePopupOpen ? 'open' : ''}"
        onclick={() => { playClick(); isSidePopupOpen = !isSidePopupOpen; }}
        title={isSidePopupOpen ? "Hide player answers" : "Show player answers"}
      >
        <Icon icon="mdi:account-group" width="16" class="toggle-icon-gold" />
        <span class="toggle-btn-text">
          Players ({correctPlayers.length}✓ / {wrongPlayers.length}✗)
        </span>
        <Icon icon={isSidePopupOpen ? "mdi:chevron-right" : "mdi:chevron-left"} width="16" />
      </button>

      <!-- Side Popup Card: Floating cleanly on the side, zero layout interference -->
      {#if isSidePopupOpen}
        <aside class="versus-side-popup" aria-label="Round Answers Breakdown">
          <div class="side-popup-header">
            <div class="side-popup-title-box">
              <Icon icon="mdi:poll" width="17" class="side-icon-gold" />
              <span class="side-popup-title">ROUND ANSWERS</span>
            </div>
            <div class="side-popup-actions">
              <span class="count-badge right">{correctPlayers.length} Right</span>
              <span class="count-badge wrong">{wrongPlayers.length} Wrong</span>
              <button
                type="button"
                class="side-btn-close"
                onclick={() => { playClick(); isSidePopupOpen = false; }}
                aria-label="Close"
                title="Close"
              >
                <Icon icon="mdi:close" width="15" />
              </button>
            </div>
          </div>

          <div class="side-popup-body">
            <!-- Correct Group -->
            {#if correctPlayers.length > 0}
              <div class="side-group correct-group">
                <div class="side-group-header">
                  <Icon icon="mdi:check-circle" width="14" class="status-icon-correct" />
                  <span>GOT IT RIGHT ({correctPlayers.length})</span>
                </div>
                <div class="side-players-list">
                  {#each correctPlayers as p}
                    {@const opt = getOptionInfo(p.choiceIndex)}
                    <div class="side-player-card {p.playerId === playerId ? 'is-self' : ''}">
                      <div class="side-player-top">
                        <span class="side-player-name">
                          {p.nickname}
                          {#if p.playerId === playerId}
                            <strong class="self-tag">(You)</strong>
                          {/if}
                        </span>
                        <span class="side-pts-badge correct">+{p.pointsAwarded} pts</span>
                      </div>
                      <div class="side-choice-preview" style="border-left-color: {opt.color};">
                        <span class="choice-symbol" style="color: {opt.color};">{opt.symbol}</span>
                        <span class="choice-text-snip" title={opt.text}>{opt.text}</span>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Wrong Group -->
            {#if wrongPlayers.length > 0}
              <div class="side-group wrong-group">
                <div class="side-group-header">
                  <Icon icon="mdi:close-circle" width="14" class="status-icon-wrong" />
                  <span>GOT IT WRONG / MISSED ({wrongPlayers.length})</span>
                </div>
                <div class="side-players-list">
                  {#each wrongPlayers as p}
                    {@const opt = getOptionInfo(p.choiceIndex)}
                    <div class="side-player-card wrong {p.playerId === playerId ? 'is-self' : ''}">
                      <div class="side-player-top">
                        <span class="side-player-name">
                          {p.nickname}
                          {#if p.playerId === playerId}
                            <strong class="self-tag">(You)</strong>
                          {/if}
                        </span>
                        <span class="side-pts-badge wrong">0 pts</span>
                      </div>
                      <div class="side-choice-preview" style="border-left-color: {opt.color};">
                        <span class="choice-symbol" style="color: {opt.color};">{opt.symbol}</span>
                        <span class="choice-text-snip" title={opt.text}>{opt.text}</span>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            {#if roundResults.length === 0}
              <div class="side-empty">
                <span>Waiting for results...</span>
              </div>
            {/if}
          </div>
        </aside>
      {/if}
    {/if}

  <!-- FINISHED MATCH: FINAL PODIUM & LEADERBOARD -->
  {:else if gameState === 'finished'}
    <div class="finished-podium-stage">
      <div class="podium-header">
        <h2 class="podium-title">🏆 VLSI EXAM VERSUS RESULTS 🏆</h2>
        <p class="podium-subtitle">Dr. Mosquera has finalized the grades!</p>
      </div>

      <!-- Top 3 Podium -->
      <div class="top3-podium-container">
        <!-- 2nd Place -->
        {#if finalLeaderboard[1]}
          <div class="podium-column silver-col">
            <div class="player-avatar-box">
              <span class="medal-icon">🥈</span>
              <span class="podium-name">{finalLeaderboard[1].nickname}</span>
              <span class="podium-pts">{finalLeaderboard[1].score} pts</span>
            </div>
            <div class="podium-block silver-block">
              <span class="place-number">2</span>
            </div>
          </div>
        {/if}

        <!-- 1st Place (Gold / Champion) -->
        {#if finalLeaderboard[0]}
          <div class="podium-column gold-col">
            <div class="player-avatar-box first-place">
              <div class="crown-icon-float">👑</div>
              <span class="medal-icon">🥇</span>
              <span class="podium-name">{finalLeaderboard[0].nickname}</span>
              <span class="podium-pts gold-pts">{finalLeaderboard[0].score} pts</span>
            </div>
            <div class="podium-block gold-block">
              <span class="place-number">1</span>
            </div>
          </div>
        {/if}

        <!-- 3rd Place -->
        {#if finalLeaderboard[2]}
          <div class="podium-column bronze-col">
            <div class="player-avatar-box">
              <span class="medal-icon">🥉</span>
              <span class="podium-name">{finalLeaderboard[2].nickname}</span>
              <span class="podium-pts">{finalLeaderboard[2].score} pts</span>
            </div>
            <div class="podium-block bronze-block">
              <span class="place-number">3</span>
            </div>
          </div>
        {/if}
      </div>

      <!-- Full Standings Table -->
      <div class="full-standings-card">
        <h3 class="standings-title">FULL CLASS RANKING ({finalLeaderboard.length} PLAYERS)</h3>
        <div class="standings-list-scroll">
          {#each finalLeaderboard as p, rank}
            <div class="standing-row {p.id === playerId ? 'is-me-row' : ''}">
              <div class="standing-left">
                <span class="rank-badge">#{rank + 1}</span>
                <span class="standing-nick">{p.nickname}</span>
                {#if p.id === playerId}
                  <span class="you-indicator">(You)</span>
                {/if}
              </div>
              <div class="standing-right">
                <strong class="standing-score">{p.score} pts</strong>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Finished Actions -->
      <div class="finished-actions-row">
        {#if isHost}
          <button class="btn-play-again" onclick={handlePlayAgain}>
            <Icon icon="mdi:replay" width="22" />
            <span>PLAY AGAIN (NEW QUESTIONS)</span>
          </button>
        {/if}
        <button class="btn-exit-to-menu" onclick={handleExit}>
          <Icon icon="mdi:home" width="22" />
          <span>RETURN TO MAIN MENU</span>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .versus-stage-wrapper {
    width: 100vw;
    max-width: 100%;
    min-height: 100vh;
    min-height: 100dvh;
    max-height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    user-select: none;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    box-sizing: border-box;
  }

  /* Top Utility Bar */
  .versus-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: linear-gradient(180deg, #0b1736 0%, #060e22 100%);
    border-bottom: 2px solid #d4af37;
    z-index: 100;
  }

  .topbar-left, .topbar-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .room-code-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #102146;
    border: 1px solid #d4af37;
    border-radius: 6px;
    padding: 4px 10px;
    color: #fce69a;
    font-size: 13px;
  }

  :global(.code-icon) {
    color: #fce69a;
  }

  .code-text {
    letter-spacing: 2px;
  }

  .q-counter-badge {
    background: #1e3a78;
    border-radius: 6px;
    padding: 4px 8px;
    color: #ffffff;
    font-size: 13px;
    font-weight: bold;
  }

  .player-score-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #132448;
    border: 1px solid #3b82f6;
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 13px;
  }

  :global(.score-icon) {
    color: #fce69a;
  }

  .score-num {
    color: #fce69a;
  }

  .btn-leave-match {
    background: transparent;
    border: 1px solid #64748b;
    border-radius: 6px;
    color: #cbd5e1;
    padding: 4px 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-leave-match:hover {
    background: rgba(239, 68, 68, 0.3);
    border-color: #ef4444;
    color: #ef4444;
  }

  /* Play Container */
  .versus-play-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    padding: 8px 12px 14px;
    overflow-y: hidden;
    box-sizing: border-box;
  }

  /* Character Area */
  .mosquera-versus-section {
    flex-shrink: 0;
    margin-bottom: 6px;
  }

  /* Question Card Box */
  .question-card-box {
    background: linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%);
    color: #0f172a;
    border-radius: 14px;
    padding: 12px 18px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
    border: 2px solid #cbd5e1;
    text-align: center;
    margin-bottom: 8px;
    flex-shrink: 0;
  }

  .question-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
    font-size: 11px;
    font-weight: bold;
  }

  .topic-tag-pill {
    background: #e2e8f0;
    color: #1e3a8a;
    padding: 2px 8px;
    border-radius: 12px;
  }

  .answered-ratio-pill {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #64748b;
  }

  .accuracy-tag-pill {
    padding: 2px 8px;
    border-radius: 12px;
  }
  .accuracy-tag-pill.ascended { background: #dcfce7; color: #15803d; }
  .accuracy-tag-pill.happy { background: #dbeafe; color: #1d4ed8; }
  .accuracy-tag-pill.sad { background: #fef3c7; color: #b45309; }
  .accuracy-tag-pill.enraged { background: #fee2e2; color: #b91c1c; }

  .question-prompt-text {
    font-size: 17px;
    font-weight: bold;
    line-height: 1.35;
    color: #0f172a;
  }

  /* 2x2 Answer Grid (Kahoot style!) */
  .answers-grid-2x2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 10px;
    flex: 1;
    min-height: 180px;
    margin-bottom: 8px;
  }

  .kahoot-answer-btn {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--tile-bg);
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-radius: 12px;
    padding: 12px;
    color: #ffffff;
    cursor: pointer;
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.4);
    transition: transform 0.1s, filter 0.15s, opacity 0.2s;
    overflow: hidden;
    text-align: left;
  }

  .kahoot-answer-btn:hover:not(:disabled) {
    transform: scale(1.02);
    filter: brightness(1.1);
  }

  .kahoot-answer-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .symbol-badge {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12px;
    flex-shrink: 0;
  }

  .symbol-glyph {
    font-size: 28px;
    color: #ffffff;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }

  .answer-content {
    flex: 1;
    display: flex;
    align-items: center;
  }

  .option-text {
    font-size: 16px;
    font-weight: bold;
    line-height: 1.25;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  }

  /* Single Choice Locked-in Visual State */
  .kahoot-answer-btn.locked-state:not(.my-pick) {
    opacity: 0.6;
    filter: grayscale(0.3);
  }

  .kahoot-answer-btn.my-pick {
    border: 4px solid #fce69a !important;
    box-shadow: 0 0 24px rgba(252, 230, 154, 0.8) !important;
    transform: scale(1.02);
    z-index: 5;
  }

  .locked-in-badge {
    position: absolute;
    top: 6px;
    right: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid #fce69a;
    border-radius: 12px;
    padding: 2px 8px;
    color: #fce69a;
    font-size: 11px;
    font-weight: bold;
  }

  /* Reveal State */
  .kahoot-answer-btn.is-correct-reveal {
    border: 4px solid #4ade80 !important;
    box-shadow: 0 0 26px rgba(74, 222, 128, 0.8) !important;
    opacity: 1 !important;
    filter: none !important;
  }

  .kahoot-answer-btn.is-wrong-reveal {
    opacity: 0.35 !important;
    filter: grayscale(0.7) !important;
  }

  /* Player chips showing who guessed this option */
  .revealed-players-container {
    position: absolute;
    bottom: 6px;
    left: 8px;
    right: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    z-index: 10;
  }

  .player-guess-chip {
    background: rgba(0, 0, 0, 0.75);
    border-radius: 10px;
    padding: 2px 6px;
    font-size: 10px;
    font-weight: bold;
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .player-guess-chip.is-me {
    border-color: #fce69a;
    color: #fce69a;
  }

  .player-guess-chip.chip-correct {
    border-color: #4ade80;
    color: #86efac;
  }

  .player-guess-chip.chip-wrong {
    border-color: #f87171;
    color: #fca5a5;
  }

  /* Reveal Overlay & 5s Countdown */
  .reveal-advance-banner {
    background: linear-gradient(180deg, #112046 0%, #09132b 100%);
    border: 2px solid #d4af37;
    border-radius: 12px;
    padding: 10px 14px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.7);
    margin-bottom: 6px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .reveal-result-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .points-awarded-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: bold;
  }

  .correct-badge {
    background: linear-gradient(90deg, #16a34a, #15803d);
    color: #ffffff;
    box-shadow: 0 0 14px rgba(22, 163, 74, 0.6);
  }

  .wrong-badge {
    background: linear-gradient(90deg, #dc2626, #b91c1c);
    color: #ffffff;
  }

  .auto-advance-timer {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    font-size: 12px;
    color: #cbd5e1;
  }

  .auto-advance-bar-track {
    width: 140px;
    height: 6px;
    background: #060c1d;
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid rgba(212, 175, 55, 0.4);
  }

  .auto-advance-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #d4af37, #fce69a);
    transition: width 1s linear;
  }

  .round-mini-leaderboard {
    display: flex;
    gap: 6px;
    overflow-x: auto;
  }

  .mini-rank-pill {
    background: #060c1d;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: 3px 8px;
    font-size: 11px;
    display: flex;
    gap: 4px;
    white-space: nowrap;
  }

  .mini-rank-pill.highlight-me {
    border-color: #d4af37;
    background: #18336d;
    color: #fce69a;
  }

  .rank-pos { color: #93c5fd; font-weight: bold; }
  .rank-nick { font-weight: bold; }
  .rank-score { color: #fce69a; }

  /* Bottom Timer Pill (Matching user's attachment screenshot!) */
  .bottom-timer-container {
    display: flex;
    justify-content: center;
    width: 100%;
    flex-shrink: 0;
  }

  .kahoot-timer-pill {
    position: relative;
    width: 100%;
    height: 38px;
    background: #4a154b; /* Deep purple pill like in Kahoot */
    border: 2px solid #8e44ad;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
  }

  .timer-progress-fill {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: linear-gradient(90deg, #8e44ad 0%, #be4bdb 100%);
    transition: width 0.1s linear;
  }

  .timer-number-bubble {
    position: absolute;
    right: 8px;
    width: 28px;
    height: 28px;
    background: #ffffff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    z-index: 10;
  }

  .timer-digits {
    font-size: 14px;
    font-weight: bold;
    color: #4a154b;
  }

  /* Finished Podium Screen */
  .finished-podium-stage {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 16px 12px 24px;
    overflow-y: auto;
  }

  .podium-header {
    text-align: center;
    margin-bottom: 12px;
  }

  .podium-title {
    margin: 0;
    font-size: 26px;
    color: #fce69a;
    text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
  }

  .podium-subtitle {
    margin: 4px 0 0 0;
    font-size: 14px;
    color: #93c5fd;
  }

  .top3-podium-container {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 16px;
    width: 100%;
    margin-bottom: 18px;
  }

  .podium-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    max-width: 160px;
  }

  .player-avatar-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    margin-bottom: 8px;
  }

  .crown-icon-float {
    font-size: 28px;
    animation: crownFloat 2s infinite ease-in-out;
  }

  @keyframes crownFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }

  .medal-icon {
    font-size: 32px;
  }

  .podium-name {
    font-size: 15px;
    font-weight: bold;
    color: #ffffff;
    text-align: center;
  }

  .podium-pts {
    font-size: 13px;
    color: #cbd5e1;
  }

  .gold-pts {
    color: #fce69a;
    font-weight: bold;
    font-size: 15px;
  }

  .podium-block {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px 8px 0 0;
    box-shadow: 0 -4px 14px rgba(0, 0, 0, 0.4);
  }

  .place-number {
    font-size: 36px;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.7);
  }

  .gold-block {
    height: 140px;
    background: linear-gradient(180deg, #ffd700 0%, #b8860b 100%);
    border: 2px solid #fff3a8;
  }

  .silver-block {
    height: 105px;
    background: linear-gradient(180deg, #c0c0c0 0%, #708090 100%);
    border: 2px solid #ffffff;
  }

  .bronze-block {
    height: 80px;
    background: linear-gradient(180deg, #cd7f32 0%, #8b4513 100%);
    border: 2px solid #f4a460;
  }

  /* Full Standings Card */
  .full-standings-card {
    width: 100%;
    background: #081126;
    border: 1px solid rgba(212, 175, 55, 0.4);
    border-radius: 12px;
    padding: 12px;
    margin-bottom: 16px;
  }

  .standings-title {
    margin: 0 0 10px 0;
    font-size: 13px;
    color: #fce69a;
    letter-spacing: 1px;
  }

  .standings-list-scroll {
    max-height: 140px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .standing-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #0f1c3f;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 13px;
  }

  .standing-row.is-me-row {
    border-color: #d4af37;
    background: #19336d;
  }

  .standing-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .rank-badge {
    color: #93c5fd;
    font-weight: bold;
    min-width: 24px;
  }

  .standing-nick {
    font-weight: bold;
    color: #ffffff;
  }

  .you-indicator {
    color: #fce69a;
    font-size: 11px;
  }

  .standing-score {
    color: #fce69a;
  }

  /* Actions */
  .finished-actions-row {
    display: flex;
    gap: 12px;
    width: 100%;
  }

  .btn-play-again {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: linear-gradient(180deg, #16a34a 0%, #15803d 100%);
    border: 2px solid #86efac;
    border-radius: 10px;
    color: #ffffff;
    font-size: 15px;
    font-weight: bold;
    padding: 12px;
    cursor: pointer;
  }

  .btn-exit-to-menu {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: #182e66;
    border: 1px solid #d4af37;
    border-radius: 10px;
    color: #fce69a;
    font-size: 15px;
    font-weight: bold;
    padding: 12px;
    cursor: pointer;
  }

  /* RESPONSIVE MOBILE SIZING (Matching user's attachment) */
  @media (max-width: 600px), (max-height: 700px) {
    .versus-play-container {
      padding: 4px 6px 10px;
    }

    .versus-topbar {
      padding: 4px 10px;
    }

    .room-code-badge {
      font-size: 11px;
      padding: 2px 6px;
    }

    .q-counter-badge {
      font-size: 11px;
      padding: 2px 6px;
    }

    .player-score-pill {
      font-size: 11px;
      padding: 2px 8px;
    }

    .question-card-box {
      padding: 8px 10px;
      margin-bottom: 6px;
      border-radius: 10px;
    }

    .question-prompt-text {
      font-size: 14px;
    }

    .answers-grid-2x2 {
      gap: 6px;
      margin-bottom: 6px;
    }

    .kahoot-answer-btn {
      padding: 8px 6px;
      border-radius: 8px;
    }

    .symbol-badge {
      width: 26px;
      height: 26px;
      margin-right: 6px;
    }

    .symbol-glyph {
      font-size: 20px;
    }

    .option-text {
      font-size: 12px;
      line-height: 1.2;
    }

    .kahoot-timer-pill {
      height: 30px;
    }

    .timer-number-bubble {
      width: 22px;
      height: 22px;
      right: 4px;
    }

    .timer-digits {
      font-size: 12px;
    }
  }

  /* ========================================================
     SIDE POPUP: Round Answers Breakdown (Right vs Wrong)
     Does NOT interfere with main question or answer grid layout
     ======================================================== */
  .side-popup-toggle-btn {
    position: fixed;
    right: 14px;
    top: 52px;
    background: linear-gradient(180deg, #1b3570 0%, #0d1e44 100%);
    border: 1.5px solid #d4af37;
    border-radius: 20px;
    color: #fce69a;
    font-size: 12px;
    font-weight: bold;
    padding: 5px 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.7), 0 0 10px rgba(212, 175, 55, 0.3);
    z-index: 1100;
    transition: all 0.15s ease-out;
    font-family: inherit;
  }

  .side-popup-toggle-btn:hover {
    background: #244694;
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.8), 0 0 14px rgba(212, 175, 55, 0.5);
  }

  :global(.toggle-icon-gold) {
    color: #fce69a;
  }

  .versus-side-popup {
    position: fixed;
    right: 14px;
    top: 90px;
    width: 300px;
    max-width: calc(100vw - 28px);
    max-height: calc(100vh - 110px);
    background: linear-gradient(180deg, #0e1b38 0%, #070e20 100%);
    border: 2px solid #d4af37;
    border-radius: 14px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.92), 0 0 24px rgba(212, 175, 55, 0.28);
    display: flex;
    flex-direction: column;
    z-index: 1101;
    overflow: hidden;
    animation: sidePopupSlide 0.2s ease-out;
  }

  @keyframes sidePopupSlide {
    from {
      opacity: 0;
      transform: translateX(16px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .side-popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: linear-gradient(180deg, #1b3570 0%, #102146 100%);
    border-bottom: 1.5px solid #d4af37;
  }

  .side-popup-title-box {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  :global(.side-icon-gold) {
    color: #fce69a;
  }

  .side-popup-title {
    font-size: 13px;
    font-weight: bold;
    color: #fce69a;
    letter-spacing: 0.5px;
  }

  .side-popup-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .count-badge {
    font-size: 10px;
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 10px;
  }

  .count-badge.right {
    background: #14532d;
    color: #86efac;
    border: 1px solid #22c55e;
  }

  .count-badge.wrong {
    background: #7f1d1d;
    color: #fca5a5;
    border: 1px solid #ef4444;
  }

  .side-btn-close {
    background: transparent;
    border: none;
    color: #cbd5e1;
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.15s, color 0.15s;
  }

  .side-btn-close:hover {
    background: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .side-popup-body {
    padding: 8px 10px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: calc(100vh - 170px);
  }

  .side-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .side-group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: bold;
    letter-spacing: 0.5px;
  }

  .correct-group .side-group-header {
    color: #86efac;
  }

  .wrong-group .side-group-header {
    color: #fca5a5;
  }

  :global(.status-icon-correct) {
    color: #4ade80;
  }

  :global(.status-icon-wrong) {
    color: #f87171;
  }

  .side-players-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .side-player-card {
    background: #08122a;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .side-player-card.is-self {
    border-color: #d4af37;
    background: linear-gradient(180deg, #152957 0%, #0d1b3d 100%);
    box-shadow: 0 0 10px rgba(212, 175, 55, 0.25);
  }

  .side-player-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .side-player-name {
    font-size: 12px;
    font-weight: bold;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .self-tag {
    color: #fce69a;
    font-size: 10px;
  }

  .side-pts-badge {
    font-size: 10px;
    font-weight: bold;
    padding: 1px 6px;
    border-radius: 8px;
  }

  .side-pts-badge.correct {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
    border: 1px solid rgba(74, 222, 128, 0.4);
  }

  .side-pts-badge.wrong {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .side-choice-preview {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #050b18;
    border-radius: 4px;
    padding: 3px 6px;
    border-left: 3px solid #3b82f6;
  }

  .choice-symbol {
    font-size: 12px;
    font-weight: bold;
  }

  .choice-text-snip {
    font-size: 11px;
    color: #cbd5e1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .side-empty {
    font-size: 11px;
    color: #94a3b8;
    text-align: center;
    padding: 8px 0;
  }

  /* Responsive sizing for mobile */
  @media (max-width: 600px), (max-height: 700px) {
    .side-popup-toggle-btn {
      top: 40px;
      right: 6px;
      font-size: 10px;
      padding: 3px 8px;
    }

    .versus-side-popup {
      right: 6px;
      top: 66px;
      width: min(270px, calc(100vw - 12px));
      max-height: 55vh;
    }

    .side-popup-title {
      font-size: 11px;
    }

    .count-badge {
      font-size: 9px;
      padding: 1px 4px;
    }

    .side-player-name {
      font-size: 11px;
    }

    .choice-text-snip {
      font-size: 10px;
    }
  }
</style>