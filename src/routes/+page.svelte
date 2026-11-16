<script>
  import { onMount } from 'svelte';
  import defaultQuestionsData from '#lib/data/questions.json';
  import StartMenu from '#lib/components/StartMenu.svelte';
  import QuizView from '#lib/components/QuizView.svelte';
  import SettingsModal from '#lib/components/SettingsModal.svelte';
  import VictoryScreen from '#lib/components/VictoryScreen.svelte';
  import VersusLobbyModal from '#lib/components/VersusLobbyModal.svelte';
  import VersusGameView from '#lib/components/VersusGameView.svelte';
  import { setSoundEnabled, setSfxVolume } from '#lib/audio/soundFx.js';

  // State: View Navigation ('menu' | 'quiz' | 'victory' | 'versus')
  let currentView = $state('menu');
  let isSettingsOpen = $state(false);
  let isVersusLobbyOpen = $state(false);

  // Versus Mode Session Data
  let versusSession = $state({
    isHost: false,
    peerManager: null,
    hostEngine: null,
    roomCode: '',
    playerId: '',
    nickname: '',
    initialPayload: null
  });

  // Questions Database
  let allQuestions = $state(defaultQuestionsData);

  // Topics
  let allTopics = $derived.by(() => {
    const set = new Set();
    allQuestions.forEach(q => set.add(q.topic));
    return Array.from(set);
  });

  let selectedTopics = $state([]);

  // Session Preferences
  let questionLimit = $state(0); // 0 = all
  let hasTimeLimit = $state(false);
  let timeLimitSeconds = $state(20);
  let sfxEnabled = $state(true);
  let sfxVolume = $state(70);

  // Gameplay State
  let activeTopic = $state('');
  let happiness = $state(50); // 0 to 100
  let streak = $state(0);
  let maxStreak = $state(0);
  let wrongAnswersCount = $state(0);
  let topicProgress = $state({}); // { [topic]: { mastered: [id, ...], missed: [id, ...] } }

  onMount(() => {
    selectedTopics = [...allTopics];
    if (allTopics.length > 0) {
      activeTopic = allTopics[0];
    }
  });

  // Mood-tinted background color shift (subtle and non-blinding) + tacky dots color shift
  $effect(() => {
    if (typeof document !== 'undefined') {
      let tint = '#0b132b'; // neutral default
      let dot1 = 'rgba(80, 140, 255, 0.36)';
      let dot2 = 'rgba(255, 215, 0, 0.25)';

      if (happiness <= 20) {
        tint = '#1a0c14'; // subtle deep crimson
        dot1 = 'rgba(239, 68, 68, 0.42)';
        dot2 = 'rgba(251, 146, 60, 0.28)';
      } else if (happiness <= 40) {
        tint = '#0d1525'; // subtle deep slate blue
        dot1 = 'rgba(96, 165, 250, 0.34)';
        dot2 = 'rgba(148, 163, 184, 0.24)';
      } else if (happiness <= 65) {
        tint = '#0b132b'; // classic deep navy
        dot1 = 'rgba(80, 140, 255, 0.36)';
        dot2 = 'rgba(255, 215, 0, 0.25)';
      } else if (happiness <= 85) {
        tint = '#081a1a'; // subtle deep spruce teal
        dot1 = 'rgba(52, 211, 153, 0.42)';
        dot2 = 'rgba(251, 191, 36, 0.28)';
      } else {
        tint = '#150c26'; // subtle deep royal purple
        dot1 = 'rgba(192, 132, 252, 0.45)';
        dot2 = 'rgba(250, 204, 21, 0.32)';
      }

      document.documentElement.style.setProperty('--mood-bg-color', tint);
      document.documentElement.style.setProperty('--mood-dot-color-1', dot1);
      document.documentElement.style.setProperty('--mood-dot-color-2', dot2);
    }
  });

  // Start the Game
  function handleStartGame() {
    if (selectedTopics.length === 0) {
      selectedTopics = [...allTopics];
    }
    activeTopic = selectedTopics[0];
    happiness = 50;
    streak = 0;
    maxStreak = 0;
    wrongAnswersCount = 0;

    const prog = {};
    selectedTopics.forEach(t => {
      prog[t] = { mastered: [], missed: [] };
    });
    topicProgress = prog;

    currentView = 'quiz';
  }

  // Answer Submitted
  function handleAnswer({ questionId, topic, isCorrect, isSkip = false }) {
    if (!topicProgress[topic]) {
      topicProgress[topic] = { mastered: [], missed: [] };
    }

    if (isCorrect) {
      if (!topicProgress[topic].mastered.includes(questionId)) {
        topicProgress[topic].mastered.push(questionId);
      }
      topicProgress[topic].missed = topicProgress[topic].missed.filter(id => id !== questionId);

      const boost = 15 + Math.min(10, streak * 2);
      happiness = Math.min(100, happiness + boost);

      streak += 1;
      if (streak > maxStreak) {
        maxStreak = streak;
      }
    } else {
      if (!isSkip) {
        wrongAnswersCount += 1;
        const penalty = 18;
        happiness = Math.max(0, happiness - penalty);
        streak = 0;
      }

      if (!topicProgress[topic].missed.includes(questionId)) {
        topicProgress[topic].missed.push(questionId);
      }
    }
  }

  // Switch to another topic
  function handleSwitchTopic(nextTopic) {
    if (selectedTopics.includes(nextTopic)) {
      activeTopic = nextTopic;
    } else {
      const other = selectedTopics.find(t => t !== activeTopic);
      if (other) activeTopic = other;
    }
  }

  // All questions mastered!
  function handleFinishAll() {
    happiness = 100;
    currentView = 'victory';
  }

  // Save Settings
  function handleSaveSettings(newSettings) {
    selectedTopics = newSettings.selectedTopics;
    questionLimit = newSettings.questionLimit;
    hasTimeLimit = newSettings.hasTimeLimit;
    timeLimitSeconds = newSettings.timeLimitSeconds;
    sfxEnabled = newSettings.sfxEnabled;
    sfxVolume = newSettings.sfxVolume;

    setSoundEnabled(sfxEnabled);
    setSfxVolume(sfxVolume / 100);

    if (newSettings.customQuestions) {
      allQuestions = newSettings.customQuestions;
    }
  }

  // Versus Mode Launch
  function handleStartVersus({ isHost, peerManager, hostEngine, roomCode, playerId, nickname, initialPayload }) {
    versusSession = {
      isHost,
      peerManager,
      hostEngine,
      roomCode,
      playerId,
      nickname,
      initialPayload
    };
    currentView = 'versus';
  }

  // Versus Mode Exit
  function handleExitVersus() {
    if (versusSession.peerManager) {
      versusSession.peerManager.destroy();
    }
    if (versusSession.hostEngine) {
      versusSession.hostEngine.destroy();
    }
    versusSession = {
      isHost: false,
      peerManager: null,
      hostEngine: null,
      roomCode: '',
      playerId: '',
      nickname: '',
      initialPayload: null
    };
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('mosq_vs_session');
    }
    currentView = 'menu';
  }

  // Filter questions for active topics
  let activeQuestions = $derived.by(() => {
    return allQuestions.filter(q => selectedTopics.includes(q.topic));
  });

  let totalMastered = $derived.by(() => {
    let count = 0;
    Object.values(topicProgress).forEach(p => {
      count += p.mastered?.length || 0;
    });
    return count;
  });
</script>

<svelte:head>
  <title>Making Dr. Mosquera happy</title>
</svelte:head>

<div class="app-layout">
  {#if currentView === 'menu'}
    <StartMenu
      selectedTopicsCount={selectedTopics.length}
      totalQuestionsCount={activeQuestions.length}
      {hasTimeLimit}
      {timeLimitSeconds}
      onStartGame={handleStartGame}
      onOpenSettings={() => { isSettingsOpen = true; }}
      onOpenVersus={() => { isVersusLobbyOpen = true; }}
    />
  {:else if currentView === 'quiz'}
    <QuizView
      questions={activeQuestions}
      {activeTopic}
      availableTopics={selectedTopics}
      {hasTimeLimit}
      {timeLimitSeconds}
      {happiness}
      {streak}
      {topicProgress}
      onAnswer={handleAnswer}
      onSwitchTopic={handleSwitchTopic}
      onFinishAll={handleFinishAll}
      onBackToMenu={() => { currentView = 'menu'; }}
    />
  {:else if currentView === 'victory'}
    <VictoryScreen
      masteredCount={totalMastered}
      totalQuestions={activeQuestions.length}
      {maxStreak}
      {wrongAnswersCount}
      onRestart={handleStartGame}
      onBackToMenu={() => { currentView = 'menu'; }}
    />
  {:else if currentView === 'versus'}
    <VersusGameView
      isHost={versusSession.isHost}
      peerManager={versusSession.peerManager}
      hostEngine={versusSession.hostEngine}
      roomCode={versusSession.roomCode}
      playerId={versusSession.playerId}
      nickname={versusSession.nickname}
      initialPayload={versusSession.initialPayload}
      onExitToMenu={handleExitVersus}
    />
  {/if}

  <!-- Versus Lobby Modal -->
  <VersusLobbyModal
    isOpen={isVersusLobbyOpen}
    {allTopics}
    onClose={() => { isVersusLobbyOpen = false; }}
    onStartVersus={handleStartVersus}
  />

  <!-- Settings & Custom JSON Modal -->
  <SettingsModal
    isOpen={isSettingsOpen}
    {allTopics}
    {selectedTopics}
    {questionLimit}
    {hasTimeLimit}
    {timeLimitSeconds}
    {sfxEnabled}
    {sfxVolume}
    questionsJson={JSON.stringify(allQuestions, null, 2)}
    onSave={handleSaveSettings}
    onClose={() => { isSettingsOpen = false; }}
  />
</div>

<style>
  .app-layout {
    width: 100%;
    min-height: 100vh;
    min-height: 100dvh;
    max-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
</style>
