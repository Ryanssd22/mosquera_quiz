<script>
  import Icon from '@iconify/svelte';
  import { playClick } from '#lib/audio/soundFx.js';

  let {
    selectedTopicsCount = 0,
    totalQuestionsCount = 0,
    hasTimeLimit = false,
    timeLimitSeconds = 20,
    onStartGame = () => {},
    onOpenSettings = () => {}
  } = $props();

  function handlePlay() {
    playClick();
    onStartGame();
  }

  function handleSettings() {
    playClick();
    onOpenSettings();
  }
</script>

<div class="start-menu-container">
  <div class="menu-card">
    <!-- Header Title -->
    <div class="title-section">
      <div class="title-stars">
        <img src="/assets/glitter_star.gif" alt="Sparkle" class="star-gif" />
        <h1 class="game-title">Making Dr. Mosquera happy</h1>
        <img src="/assets/glitter_star.gif" alt="Sparkle" class="star-gif" />
      </div>
      <p class="subtitle">Digital CMOS VLSI Design Studying & Happiness Simulator</p>
    </div>

    <!-- Center Stage Character Frame -->
    <div class="character-preview-box">
      <div class="preview-speech">
        "Are you prepared to study? Answer the questions correctly to boost my happiness!"
      </div>

      <!-- IC Chip Package Frame -->
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
            <img src="/assets/mosquera_cutout.png" alt="Dr. Mosquera" class="preview-img" />
          </div>
          <img src="/assets/happy_sun.png" alt="Happy Sun" class="corner-sun" />
        </div>

        <div class="ic-pins-row bottom">
          {#each Array(6) as _}
            <div class="ic-pin"></div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Session Info Badges -->
    <div class="session-info-badge">
      <div class="info-pill">
        <Icon icon="mdi:book-open-page-variant" width="16" class="info-icon" />
        <span>Topics: <strong>{selectedTopicsCount}</strong></span>
      </div>
      <div class="pill-divider"></div>
      <div class="info-pill">
        <Icon icon="mdi:help-circle-outline" width="16" class="info-icon" />
        <span>Questions: <strong>{totalQuestionsCount}</strong></span>
      </div>
      <div class="pill-divider"></div>
      <div class="info-pill">
        <Icon icon="mdi:timer-outline" width="16" class="info-icon" />
        <span>Timer: <strong>{hasTimeLimit ? `${timeLimitSeconds}s` : 'Off'}</strong></span>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="menu-actions">
      <button class="btn-play-huge" onclick={handlePlay}>
        <Icon icon="mdi:play" width="28" />
        <span class="play-text">START STUDYING</span>
      </button>

      <button class="btn-settings" onclick={handleSettings}>
        <Icon icon="mdi:cog" width="16" />
        <span>Settings & Question Topics</span>
      </button>
    </div>
  </div>
</div>

<style>
  .start-menu-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    font-family: 'Comic Sans MS', 'Comic Sans', cursive, sans-serif;
  }

  /* Menu Card */
  .menu-card {
    width: 100%;
    background: #1e2638;
    border: 3px solid #334155;
    border-radius: 8px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    padding: 24px 32px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
  }

  /* Title Style */
  .title-section {
    text-align: center;
    margin-bottom: 16px;
  }

  .title-stars {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }

  .star-gif {
    width: 32px;
    height: 32px;
  }

  .game-title {
    font-size: 34px;
    margin: 0;
    color: #facc15;
    text-shadow:
      2px 2px 0 #991b1b,
      -1px -1px 0 #1e3a8a,
      0px 4px 8px rgba(0,0,0,0.7);
    letter-spacing: 0.5px;
  }

  .subtitle {
    margin: 6px 0 0 0;
    font-size: 14px;
    font-weight: bold;
    color: #94a3b8;
  }

  /* Character Preview */
  .character-preview-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 12px 0;
  }

  .preview-speech {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 8px 18px;
    font-size: 13px;
    font-weight: bold;
    color: #e2e8f0;
    margin-bottom: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    text-align: center;
    max-width: 440px;
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
    width: 170px;
    height: 170px;
    background: #111827;
    border: 3px solid #334155;
    border-radius: 6px;
    padding: 6px;
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.7),
      inset 0 0 12px rgba(0, 0, 0, 0.8),
      0 0 0 1px rgba(255, 255, 255, 0.1);
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
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    animation: gentleBob 2.5s infinite ease-in-out;
  }

  .corner-sun {
    position: absolute;
    bottom: -10px;
    right: -10px;
    width: 52px;
    animation: sunSpin 6s infinite linear;
    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.6));
  }

  /* Session Info */
  .session-info-badge {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 8px 18px;
    font-size: 13px;
    color: #cbd5e1;
    margin: 14px 0 20px;
    border-radius: 6px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.4);
  }

  .info-pill {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  :global(.info-icon) {
    color: #38bdf8;
  }

  .pill-divider {
    width: 1px;
    height: 14px;
    background: rgba(255, 255, 255, 0.2);
  }

  /* Buttons */
  .menu-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 360px;
  }

  .btn-play-huge {
    width: 100%;
    background: linear-gradient(180deg, #d97706 0%, #b45309 100%);
    border: 2px solid #f59e0b;
    border-radius: 6px;
    color: #ffffff;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    font-size: 20px;
    font-weight: bold;
    padding: 12px 24px;
    cursor: pointer;
    box-shadow: 0 6px 16px rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: transform 0.15s, filter 0.15s;
  }

  .btn-play-huge:hover {
    transform: translateY(-2px);
    filter: brightness(1.1);
  }

  .btn-play-huge:active {
    transform: translateY(1px);
  }

  .btn-settings {
    width: 100%;
    background: #1e293b;
    border: 1px solid #475569;
    border-radius: 6px;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    font-size: 13px;
    font-weight: bold;
    color: #cbd5e1;
    padding: 8px 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    transition: background 0.15s, border-color 0.15s;
  }

  .btn-settings:hover {
    background: #334155;
    border-color: #94a3b8;
  }

  .btn-settings:active {
    transform: translateY(1px);
  }

  @keyframes gentleBob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }

  @keyframes sunSpin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>
