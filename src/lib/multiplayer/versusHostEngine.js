// Authoritative Game Engine running on the Host for Mosquera Quiz Versus Mode
import defaultQuestions from '#lib/data/questions.json';

export class VersusHostEngine {
  constructor({ peerManager, allQuestions = defaultQuestions, onStateChange }) {
    this.peerManager = peerManager;
    this.allQuestions = allQuestions;
    this.onStateChange = onStateChange || (() => {});

    // Game Configuration (configurable by Host)
    this.config = {
      questionCount: 10,
      timeLimitSeconds: 20,
      selectedTopics: []
    };

    // Connected Players (max 12)
    // Map: playerId -> { id, nickname, score: 0, currentAnswer: null, currentAnswerTimeMs: 0, isConnected: true }
    this.players = new Map();

    // Game State: 'lobby' | 'countdown' | 'question' | 'reveal' | 'finished'
    this.state = 'lobby';
    this.questions = [];
    this.currentQuestionIndex = 0;
    this.currentQuestion = null;
    this.questionStartTime = 0;
    this.timerInterval = null;
    this.autoAdvanceTimeout = null;
    this.autoAdvanceSecondsRemaining = 5;
    this.autoAdvanceInterval = null;
  }

  addHostPlayer(hostPlayerId, hostNickname) {
    this.players.set(hostPlayerId, {
      id: hostPlayerId,
      nickname: hostNickname,
      score: 0,
      currentAnswer: null,
      currentAnswerTimeMs: 0,
      isConnected: true,
      isHost: true
    });
    this._broadcastLobby();
  }

  addClientPlayer(playerId, nickname) {
    if (this.players.size >= 12 && !this.players.has(playerId)) {
      this.peerManager.sendTo(playerId, {
        type: 'ERROR',
        payload: { message: 'Room is full (max 12 players).' }
      });
      return false;
    }

    if (this.players.has(playerId)) {
      // Reconnecting player!
      const p = this.players.get(playerId);
      p.isConnected = true;
      p.nickname = nickname;
      console.log(`[Host] Player ${nickname} reconnected!`);
    } else {
      // New player
      this.players.set(playerId, {
        id: playerId,
        nickname: nickname,
        score: 0,
        currentAnswer: null,
        currentAnswerTimeMs: 0,
        isConnected: true,
        isHost: false
      });
    }

    if (this.state === 'lobby') {
      this._broadcastLobby();
    } else {
      // Send current live state to reconnecting player
      this._sendCurrentStateToPlayer(playerId);
    }
    return true;
  }

  removePlayer(playerId) {
    if (this.players.has(playerId)) {
      const p = this.players.get(playerId);
      p.isConnected = false;
      if (this.state === 'lobby') {
        this.players.delete(playerId);
        this._broadcastLobby();
      } else {
        this._notifyState();
      }
    }
  }

  updateConfig(newConfig) {
    if (this.state !== 'lobby') return;
    this.config = { ...this.config, ...newConfig };
    this._broadcastLobby();
  }

  startGame() {
    if (this.state !== 'lobby') return;
    if (this.players.size < 1) return;

    // Filter questions by selected topics (or all)
    let pool = [...this.allQuestions];
    if (this.config.selectedTopics && this.config.selectedTopics.length > 0) {
      pool = pool.filter(q => this.config.selectedTopics.includes(q.topic));
    }
    if (pool.length === 0) {
      pool = [...this.allQuestions];
    }

    // Shuffle questions
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const count = Math.min(pool.length, this.config.questionCount || 10);
    this.questions = pool.slice(0, count);
    this.currentQuestionIndex = 0;

    // Reset scores
    for (const p of this.players.values()) {
      p.score = 0;
      p.currentAnswer = null;
      p.currentAnswerTimeMs = 0;
    }

    this._startQuestion(0);
  }

  _startQuestion(index) {
    this._clearTimers();
    this.currentQuestionIndex = index;
    this.currentQuestion = this.questions[index];
    this.state = 'question';

    // Clear player current answers for this question
    for (const p of this.players.values()) {
      p.currentAnswer = null;
      p.currentAnswerTimeMs = 0;
    }

    this.questionStartTime = Date.now();

    const payload = {
      state: 'question',
      questionIndex: index,
      totalQuestions: this.questions.length,
      question: {
        id: this.currentQuestion.id,
        topic: this.currentQuestion.topic,
        question: this.currentQuestion.question,
        options: this.currentQuestion.options
        // Do NOT send correctIndex or explanation yet!
      },
      timeLimitSeconds: this.config.timeLimitSeconds,
      startTime: this.questionStartTime,
      players: this._getPlayersSummary()
    };

    this.peerManager.broadcast({ type: 'QUESTION_START', payload });
    this._notifyState(payload);

    // Host timer for timeout
    const ms = this.config.timeLimitSeconds * 1000;
    this.timerInterval = setTimeout(() => {
      this._endQuestion();
    }, ms);
  }

  handlePlayerAnswer(playerId, optionIndex) {
    if (this.state !== 'question') return;
    const player = this.players.get(playerId);
    if (!player || player.currentAnswer !== null) return; // Only 1 answer allowed!

    const elapsedMs = Math.max(100, Date.now() - this.questionStartTime);
    player.currentAnswer = optionIndex;
    player.currentAnswerTimeMs = elapsedMs;

    // Broadcast who has submitted an answer so far (without revealing choice yet)
    const payload = {
      answeredPlayerIds: Array.from(this.players.values())
        .filter(p => p.currentAnswer !== null)
        .map(p => p.id)
    };
    this.peerManager.broadcast({ type: 'PLAYER_ANSWERED', payload });
    this._notifyState();

    // Check if ALL connected players have answered
    const activePlayers = Array.from(this.players.values()).filter(p => p.isConnected);
    const allAnswered = activePlayers.every(p => p.currentAnswer !== null);

    if (allAnswered) {
      if (this.timerInterval) clearTimeout(this.timerInterval);
      this._endQuestion();
    }
  }

  _endQuestion() {
    this._clearTimers();
    this.state = 'reveal';

    const correctIndex = this.currentQuestion.correctIndex;
    const totalTimeMs = this.config.timeLimitSeconds * 1000;

    let correctCount = 0;
    let totalAnswered = 0;

    // Calculate speed points for each player
    const roundResults = [];
    for (const player of this.players.values()) {
      const isCorrect = player.currentAnswer === correctIndex;
      let pointsAwarded = 0;

      if (player.currentAnswer !== null) {
        totalAnswered++;
      }

      if (isCorrect) {
        correctCount++;
        // Kahoot-style speed points: 1000 * max(0.5, 1 - (t / 2T))
        const timeFraction = Math.min(1, player.currentAnswerTimeMs / totalTimeMs);
        pointsAwarded = Math.round(1000 * Math.max(0.5, 1 - (timeFraction * 0.5)));
      }

      player.score += pointsAwarded;

      roundResults.push({
        playerId: player.id,
        nickname: player.nickname,
        choiceIndex: player.currentAnswer,
        isCorrect,
        pointsAwarded,
        totalScore: player.score,
        timeElapsedMs: player.currentAnswerTimeMs
      });
    }

    // Room accuracy calculation
    const accuracy = totalAnswered > 0 ? (correctCount / totalAnswered) : 0;

    // Dr. Mosquera room reaction
    let moodTier = 'neutral';
    let mosqueraQuote = "Analicemos los parásitos y el retardo de esta cuestión, chavales.";

    if (accuracy >= 0.75) {
      moodTier = 'ascended';
      mosqueraQuote = "¡QUÉ BARBARIDAD! ¡El aula entera domina el silicio a la perfección!";
    } else if (accuracy >= 0.50) {
      moodTier = 'happy';
      mosqueraQuote = "¡Olé ahí! ¡Buen nivel medio en esta cuestión, chavales!";
    } else if (accuracy >= 0.25) {
      moodTier = 'sad';
      mosqueraQuote = "¡Hostia qué flojos! A repasar con más calma la teoría de hilos y retardos...";
    } else {
      moodTier = 'enraged';
      mosqueraQuote = "¡ES TERRIBLE! ¡Pero hombre, cómo me falla casi toda la clase!";
    }

    // Sort players for leaderboard ranking
    const leaderboard = Array.from(this.players.values())
      .map(p => ({ id: p.id, nickname: p.nickname, score: p.score, isConnected: p.isConnected }))
      .sort((a, b) => b.score - a.score);

    this.autoAdvanceSecondsRemaining = 5;

    const payload = {
      state: 'reveal',
      questionIndex: this.currentQuestionIndex,
      totalQuestions: this.questions.length,
      correctIndex: this.currentQuestion.correctIndex,
      explanation: this.currentQuestion.explanation,
      roundResults,
      leaderboard,
      accuracy,
      moodTier,
      mosqueraQuote,
      autoAdvanceSeconds: 5
    };

    this.peerManager.broadcast({ type: 'ROUND_REVEAL', payload });
    this._notifyState(payload);

    // Auto-advance countdown interval (5 seconds as requested)
    this.autoAdvanceInterval = setInterval(() => {
      this.autoAdvanceSecondsRemaining--;
      if (this.autoAdvanceSecondsRemaining <= 0) {
        clearInterval(this.autoAdvanceInterval);
        this._advanceToNext();
      } else {
        this.peerManager.broadcast({
          type: 'AUTO_ADVANCE_TICK',
          payload: { secondsRemaining: this.autoAdvanceSecondsRemaining }
        });
        this._notifyState();
      }
    }, 1000);
  }

  _advanceToNext() {
    this._clearTimers();
    if (this.currentQuestionIndex + 1 < this.questions.length) {
      this._startQuestion(this.currentQuestionIndex + 1);
    } else {
      this._finishGame();
    }
  }

  _finishGame() {
    this._clearTimers();
    this.state = 'finished';

    const finalLeaderboard = Array.from(this.players.values())
      .map(p => ({ id: p.id, nickname: p.nickname, score: p.score, isConnected: p.isConnected }))
      .sort((a, b) => b.score - a.score);

    const winner = finalLeaderboard[0] || null;

    const payload = {
      state: 'finished',
      finalLeaderboard,
      winner
    };

    this.peerManager.broadcast({ type: 'GAME_FINISHED', payload });
    this._notifyState(payload);
  }

  _broadcastLobby() {
    const payload = {
      state: 'lobby',
      config: this.config,
      players: this._getPlayersSummary()
    };
    this.peerManager.broadcast({ type: 'LOBBY_UPDATE', payload });
    this._notifyState(payload);
  }

  _getPlayersSummary() {
    return Array.from(this.players.values()).map(p => ({
      id: p.id,
      nickname: p.nickname,
      score: p.score,
      isConnected: p.isConnected,
      isHost: p.isHost
    }));
  }

  _sendCurrentStateToPlayer(playerId) {
    const leaderboard = Array.from(this.players.values())
      .map(p => ({ id: p.id, nickname: p.nickname, score: p.score, isConnected: p.isConnected }))
      .sort((a, b) => b.score - a.score);

    const currentP = this.players.get(playerId);

    const payload = {
      state: this.state,
      config: this.config,
      questionIndex: this.currentQuestionIndex,
      totalQuestions: this.questions.length,
      question: this.currentQuestion ? {
        id: this.currentQuestion.id,
        topic: this.currentQuestion.topic,
        question: this.currentQuestion.question,
        options: this.currentQuestion.options,
        correctIndex: this.state === 'reveal' ? this.currentQuestion.correctIndex : undefined,
        explanation: this.state === 'reveal' ? this.currentQuestion.explanation : undefined
      } : null,
      timeLimitSeconds: this.config.timeLimitSeconds,
      startTime: this.questionStartTime,
      hasAnswered: currentP ? currentP.currentAnswer !== null : false,
      myChoice: currentP ? currentP.currentAnswer : null,
      leaderboard,
      players: this._getPlayersSummary()
    };

    this.peerManager.sendTo(playerId, { type: 'SYNC_STATE', payload });
  }

  _clearTimers() {
    if (this.timerInterval) clearTimeout(this.timerInterval);
    if (this.autoAdvanceInterval) clearInterval(this.autoAdvanceInterval);
    if (this.autoAdvanceTimeout) clearTimeout(this.autoAdvanceTimeout);
    this.timerInterval = null;
    this.autoAdvanceInterval = null;
    this.autoAdvanceTimeout = null;
  }

  _notifyState(customPayload = null) {
    this.onStateChange(customPayload || {
      state: this.state,
      config: this.config,
      players: this._getPlayersSummary(),
      currentQuestionIndex: this.currentQuestionIndex,
      totalQuestions: this.questions.length
    });
  }

  destroy() {
    this._clearTimers();
    this.players.clear();
  }
}
