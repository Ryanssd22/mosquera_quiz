<script>
  import { onMount } from 'svelte';
  import Icon from '@iconify/svelte';
  import { playCombo, playClick } from '#lib/audio/soundFx.js';

  let {
    masteredCount = 0,
    totalQuestions = 0,
    maxStreak = 0,
    wrongAnswersCount = 0,
    onRestart = () => {},
    onBackToMenu = () => {}
  } = $props();

  onMount(() => {
    playCombo();
  });

  function handleRestart() {
    playClick();
    onRestart();
  }

  function handleMenu() {
    playClick();
    onBackToMenu();
  }
</script>

<div class="victory-container">
  <div class="victory-card">
    <!-- Celebration Header -->
    <div class="victory-header">
      <img src="/assets/glitter_star.gif" alt="Sparkle" class="header-star" />
      <h1 class="victory-title">COURSE MASTERED!</h1>
      <img src="/assets/glitter_star.gif" alt="Sparkle" class="header-star" />
    </div>
    <h2 class="victory-subtitle">Dr. Mosquera is Thoroughly Impressed!</h2>

    <!-- Center Ascended Stage -->
    <div class="ascended-showcase">
      <img src="/assets/happy_sun.png" alt="Happy Sun" class="sun-dancer left" />
      <div class="ic-chip-frame">
        <div class="ic-pins-row top">
          {#each Array(6) as _}
            <div class="ic-pin"></div>
          {/each}
        </div>

        <div class="silicon-die-container">
          <div class="circuit-corner top-left"></div>
          <div class="circuit-corner top-right"></div>
          <div class="circuit-corner bottom-left"></div>
          <div class="circuit-corner bottom-right"></div>

          <div class="die-surface">
            <img src="/assets/mosquera_puppet_ascended.png" alt="Ascended Dr. Mosquera" class="mosquera-ascended" />
          </div>
          <div class="gold-badge">100% HAPPINESS ACHIEVED</div>
        </div>

        <div class="ic-pins-row bottom">
          {#each Array(6) as _}
            <div class="ic-pin"></div>
          {/each}
        </div>
      </div>
      <img src="/assets/happy_sun.png" alt="Happy Sun" class="sun-dancer right" />
    </div>

    <!-- Speech Quote -->
    <div class="speech-quote">
      "Outstanding work! You analyzed interconnect parasitics, Elmore delay, velocity saturation, and nonideal device physics with pure precision!"
    </div>

    <!-- Stats Certificate -->
    <div class="stats-certificate">
      <div class="cert-title">
        <Icon icon="mdi:certificate" width="18" class="cert-icon" />
        <span>DIGITAL CMOS VLSI DESIGN - MASTERY REPORT</span>
      </div>
      <div class="cert-grid">
        <div class="cert-item">
          <span class="cert-label">Questions Mastered</span>
          <span class="cert-value">{masteredCount} / {totalQuestions} (100%)</span>
        </div>
        <div class="cert-item">
          <span class="cert-label">Highest Streak</span>
          <span class="cert-value">
            <Icon icon="mdi:fire" width="16" class="streak-fire" />
            <span>{maxStreak} in a row</span>
          </span>
        </div>
        <div class="cert-item">
          <span class="cert-label">Retried Questions Overcome</span>
          <span class="cert-value">{wrongAnswersCount}</span>
        </div>
        <div class="cert-item">
          <span class="cert-label">Mastery Status</span>
          <span class="cert-value grade-a">COMPLETE & READY FOR EXAM</span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="victory-actions">
      <button class="btn-play-again" onclick={handleRestart}>
        <Icon icon="mdi:refresh" width="18" />
        <span>Study Again</span>
      </button>
      <button class="btn-menu" onclick={handleMenu}>
        <Icon icon="mdi:home" width="18" />
        <span>Main Menu</span>
      </button>
    </div>
  </div>
</div>

<style>
  .victory-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    font-family: 'Comic Sans MS', 'Comic Sans', cursive, sans-serif;
  }

  .victory-card {
    position: relative;
    width: 100%;
    background: #1e2638;
    border: 3px solid #334155;
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
    padding: 24px 32px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: hidden;
  }

  .victory-header {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .header-star {
    width: 32px;
    height: 32px;
  }

  .victory-title {
    font-size: 32px;
    margin: 0;
    color: #facc15;
    text-shadow:
      2px 2px 0 #991b1b,
      -1px -1px 0 #1e3a8a,
      0px 4px 8px rgba(0,0,0,0.7);
    letter-spacing: 0.5px;
    text-align: center;
  }

  .victory-subtitle {
    margin: 6px 0 16px;
    font-size: 16px;
    color: #94a3b8;
  }

  /* Ascended Stage */
  .ascended-showcase {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    margin-bottom: 16px;
    z-index: 2;
  }

  .sun-dancer {
    width: 70px;
    animation: sunDance 1.2s infinite alternate ease-in-out;
    filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5));
  }

  .sun-dancer.right {
    transform: scaleX(-1);
    animation-delay: 0.6s;
  }

  @keyframes sunDance {
    0% { transform: translateY(0) rotate(-4deg); }
    100% { transform: translateY(-10px) rotate(4deg); }
  }

  /* IC Chip Package Frame */
  .ic-chip-frame {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .ic-pins-row {
    display: flex;
    gap: 14px;
    height: 8px;
    z-index: 2;
  }

  .ic-pins-row.top { margin-bottom: -1px; }
  .ic-pins-row.bottom { margin-top: -1px; }

  .ic-pin {
    width: 8px;
    height: 8px;
    background: linear-gradient(180deg, #ffd700 0%, #b8860b 100%);
    border-radius: 1px;
    box-shadow: 0 0 3px rgba(255, 215, 0, 0.4);
  }

  .silicon-die-container {
    position: relative;
    width: 180px;
    height: 180px;
    background: #111827;
    border: 3px solid #ffd700;
    border-radius: 6px;
    padding: 6px;
    box-shadow:
      0 0 25px rgba(250, 204, 21, 0.4),
      inset 0 0 15px rgba(0, 0, 0, 0.8);
  }

  .circuit-corner {
    position: absolute;
    width: 10px;
    height: 10px;
    border-color: #ffd700;
    border-style: solid;
    z-index: 10;
  }

  .circuit-corner.top-left { top: 2px; left: 2px; border-width: 2px 0 0 2px; }
  .circuit-corner.top-right { top: 2px; right: 2px; border-width: 2px 2px 0 0; }
  .circuit-corner.bottom-left { bottom: 2px; left: 2px; border-width: 0 0 2px 2px; }
  .circuit-corner.bottom-right { bottom: 2px; right: 2px; border-width: 0 2px 2px 0; }

  .die-surface {
    width: 100%;
    height: 100%;
    background: #0f172a;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mosquera-ascended {
    width: 100%;
    height: 100%;
    object-fit: cover;
    animation: ascendedSpin 3s infinite ease-in-out alternate;
  }

  @keyframes ascendedSpin {
    0% { transform: scale(1) rotate(-2deg); }
    50% { transform: scale(1.05) rotate(2deg); }
    100% { transform: scale(1) rotate(-2deg); }
  }

  .gold-badge {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: #0f172a;
    color: #facc15;
    font-size: 10px;
    font-weight: bold;
    text-align: center;
    padding: 3px 0;
    border-top: 1px solid #ffd700;
  }

  .speech-quote {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 10px 18px;
    font-size: 13px;
    font-weight: bold;
    color: #e2e8f0;
    text-align: center;
    max-width: 520px;
    margin-bottom: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    z-index: 2;
  }

  /* Stats Certificate */
  .stats-certificate {
    width: 100%;
    max-width: 560px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 14px 18px;
    margin-bottom: 20px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.5);
    z-index: 2;
  }

  .cert-title {
    font-size: 13px;
    font-weight: bold;
    color: #38bdf8;
    text-align: center;
    border-bottom: 1px solid #334155;
    padding-bottom: 6px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  :global(.cert-icon) {
    color: #facc15;
  }

  .cert-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    font-size: 12px;
  }

  .cert-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .cert-label {
    color: #94a3b8;
    font-size: 11px;
  }

  .cert-value {
    font-size: 13px;
    font-weight: bold;
    color: #f1f5f9;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  :global(.streak-fire) {
    color: #f97316;
  }

  .grade-a {
    color: #4ade80;
  }

  /* Actions */
  .victory-actions {
    display: flex;
    gap: 14px;
    z-index: 2;
  }

  .btn-play-again {
    background: linear-gradient(180deg, #d97706 0%, #b45309 100%);
    border: 2px solid #f59e0b;
    border-radius: 6px;
    color: #ffffff;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    font-size: 14px;
    font-weight: bold;
    padding: 10px 20px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    gap: 8px;
    transition: transform 0.15s, filter 0.15s;
  }

  .btn-play-again:hover {
    transform: translateY(-2px);
    filter: brightness(1.1);
  }

  .btn-play-again:active {
    transform: translateY(1px);
  }

  .btn-menu {
    background: #1e293b;
    border: 1px solid #475569;
    border-radius: 6px;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    font-size: 14px;
    font-weight: bold;
    color: #cbd5e1;
    padding: 10px 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background 0.15s, border-color 0.15s;
  }

  .btn-menu:hover {
    background: #334155;
    border-color: #94a3b8;
  }

  .btn-menu:active {
    transform: translateY(1px);
  }
</style>
