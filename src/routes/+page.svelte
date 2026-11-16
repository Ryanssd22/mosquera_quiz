<script>
  import { onMount } from 'svelte';
  import defaultQuestionsData from '#lib/data/questions.json';
  import StartMenu from '#lib/components/StartMenu.svelte';
  import QuizView from '#lib/components/QuizView.svelte';
  import SettingsModal from '#lib/components/SettingsModal.svelte';
  import VictoryScreen from '#lib/components/VictoryScreen.svelte';
  import { setSoundEnabled, setSfxVolume } from '#lib/audio/soundFx.js';

  // State: View Navigation ('menu' | 'quiz' | 'victory')
  let currentView = $state('menu');
  let isSettingsOpen = $state(false);

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

  // Mood-tinted background color shift (subtle and non-blinding)
  $effect(() => {
    if (typeof document !== 'undefined') {
      let tint = '#0b132b'; // neutral default
      if (happiness <= 20) {
        tint = '#1a0e14'; // subtle deep crimson
      } else if (happiness <= 40) {
        tint = '#0d1524'; // subtle deep slate blue
      } else if (happiness <= 65) {
        tint = '#0b132b'; // classic deep navy
      } else if (happiness <= 85) {
        tint = '#091c1b'; // subtle deep spruce teal
      } else {
        tint = '#140d24'; // subtle deep royal purple
      }
      document.documentElement.style.setProperty('--mood-bg-color', tint);
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
  {/if}

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
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
</style>
