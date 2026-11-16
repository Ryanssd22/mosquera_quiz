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

<div class="start-menu-stage">
  <!-- Title Row with Full-Width Gold Wing Lines -->
  <div class="millionaire-title-row">
    <div class="gold-wing-line left"></div>

    <div class="lozenge-outer title-lozenge">
      <div class="lozenge-inner title-inner">
        <img src="/assets/glitter_star.gif" alt="Sparkle" class="star-gif left" />
        <div class="title-text-group">
          <h1 class="game-title">Making Dr. Mosquera happy</h1>
          <p class="subtitle">Digital CMOS VLSI Design Studying & Happiness Simulator</p>
        </div>
        <img src="/assets/glitter_star.gif" alt="Sparkle" class="star-gif right" />

        <div class="lozenge-glint tl"></div>
        <div class="lozenge-glint br"></div>
      </div>
    </div>

    <div class="gold-wing-line right"></div>
  </div>

  <!-- Center Stage Character (Hot Seat Frame matching photo) -->
  <div class="center-stage-box">
    <div class="speech-plaque">
      <span class="speech-text">
        "Welcome to Digital CMOS VLSI Design. Answer correctly to make me proud and reach 100% happiness!"
      </span>
    </div>

    <div class="studio-portrait-frame">
      <div class="gold-rim-outer">
        <div class="gold-rim-inner">
          <div class="portrait-surface">
            <img src="/assets/mosquera_cutout.png" alt="Dr. Mosquera" class="preview-img" />
          </div>
        </div>
        <div class="rim-glint top"></div>
        <div class="rim-glint bottom"></div>
      </div>
      <img src="/assets/happy_sun.png" alt="Happy Sun" class="corner-sun" />
    </div>
  </div>

  <!-- Session Info Badges (Sleek Gold-Bordered Bar) -->
  <div class="session-info-bar">
    <div class="info-pill">
      <Icon icon="mdi:book-open-page-variant" width="18" class="info-icon" />
      <span>Topics: <strong>{selectedTopicsCount}</strong></span>
    </div>
    <div class="pill-divider"></div>
    <div class="info-pill">
      <Icon icon="mdi:help-circle-outline" width="18" class="info-icon" />
      <span>Questions: <strong>{totalQuestionsCount}</strong> (Randomized)</span>
    </div>
    <div class="pill-divider"></div>
    <div class="info-pill">
      <Icon icon="mdi:timer-outline" width="18" class="info-icon" />
      <span>Timer: <strong>{hasTimeLimit ? `${timeLimitSeconds}s` : 'Off'}</strong></span>
    </div>
  </div>

  <!-- Actions (Millionaire Lozenge Play Button) -->
  <div class="menu-actions">
    <div class="millionaire-btn-row">
      <div class="gold-wing-line left"></div>

      <button class="lozenge-outer play-lozenge-btn" onclick={handlePlay}>
        <div class="lozenge-inner play-inner">
          <Icon icon="mdi:play" width="30" class="play-icon" />
          <span class="play-text">START STUDYING (HOT SEAT)</span>
          <div class="lozenge-glint tl"></div>
          <div class="lozenge-glint br"></div>
        </div>
      </button>

      <div class="gold-wing-line right"></div>
    </div>

    <button class="btn-settings-sleek" onclick={handleSettings}>
      <Icon icon="mdi:cog" width="16" />
      <span>Settings & Choose Topics</span>
    </button>
  </div>
</div>

<style>
  .start-menu-stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: calc(100vh - 20px);
    font-family: 'Comic Sans MS', 'Comic Sans', cursive, sans-serif;
    user-select: none;
    box-sizing: border-box;
    padding: 16px 0 24px;
  }

  /* Full-width Title Row */
  .millionaire-title-row {
    display: flex;
    align-items: center;
    width: 100%;
    margin-bottom: 12px;
  }

  .gold-wing-line {
    flex: 1;
    height: 2px;
    background: linear-gradient(90deg, transparent, #cda754 30%, #fce69a 50%, #cda754 70%, transparent);
    box-shadow: 0 0 8px rgba(252, 230, 154, 0.5);
  }

  /* Lozenge Styles */
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
    border: none;
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

  .lozenge-glint {
    position: absolute;
    width: 16px;
    height: 16px;
    background: radial-gradient(circle, #ffffff 15%, #ffd700 45%, transparent 75%);
    pointer-events: none;
    filter: drop-shadow(0 0 5px #ffffff);
  }

  .lozenge-glint.tl { top: -4px; left: 32px; }
  .lozenge-glint.br { bottom: -4px; right: 32px; }

  /* Title Lozenge */
  .title-lozenge {
    width: 78%;
    max-width: 1100px;
    margin: 0 auto;
  }

  .title-inner {
    min-height: 85px;
    padding: 12px 32px;
    justify-content: space-between;
  }

  .title-text-group {
    flex: 1;
    text-align: center;
  }

  .game-title {
    font-size: 34px;
    margin: 0;
    color: #fce69a;
    text-shadow:
      2px 2px 0 #855b14,
      0px 4px 10px rgba(0,0,0,0.9);
    letter-spacing: 0.5px;
  }

  .subtitle {
    margin: 4px 0 0 0;
    font-size: 14px;
    font-weight: bold;
    color: #93c5fd;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  }

  .star-gif {
    width: 32px;
    height: 32px;
  }

  /* Center Stage */
  .center-stage-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 8px 0;
  }

  .speech-plaque {
    background: linear-gradient(180deg, #182e66 0%, #0d1a3d 100%);
    border: 2px solid #d4af37;
    border-radius: 20px;
    padding: 8px 24px;
    font-size: 14px;
    font-weight: bold;
    color: #fce69a;
    margin-bottom: 12px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.7);
    text-align: center;
    max-width: 520px;
  }

  /* Studio Portrait Frame */
  .studio-portrait-frame {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .gold-rim-outer {
    position: relative;
    padding: 3px;
    background: linear-gradient(180deg, #fff3a8 0%, #d4af37 30%, #8a6218 70%, #f7dc87 100%);
    border-radius: 12px;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.8);
  }

  .gold-rim-inner {
    background: #091326;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 9px;
    padding: 4px;
    width: 175px;
    height: 175px;
    overflow: hidden;
  }

  .portrait-surface {
    width: 100%;
    height: 100%;
    background: radial-gradient(circle at 50% 40%, #1e3a78 0%, #0b1733 100%);
    border-radius: 6px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    animation: gentleBob 3s infinite ease-in-out;
  }

  .rim-glint {
    position: absolute;
    width: 14px;
    height: 14px;
    background: radial-gradient(circle, #ffffff 15%, #ffd700 45%, transparent 75%);
    pointer-events: none;
    filter: drop-shadow(0 0 4px #ffffff);
  }

  .rim-glint.top { top: -4px; left: 20px; }
  .rim-glint.bottom { bottom: -4px; right: 20px; }

  .corner-sun {
    position: absolute;
    bottom: -12px;
    right: -12px;
    width: 58px;
    animation: sunSpin 6s infinite linear;
    filter: drop-shadow(0 2px 8px rgba(0,0,0,0.7));
  }

  /* Session Info Bar */
  .session-info-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    background: linear-gradient(180deg, #101e42 0%, #091228 100%);
    border: 1px solid #d4af37;
    padding: 8px 24px;
    font-size: 13px;
    color: #cbd5e1;
    margin: 8px 0;
    border-radius: 20px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.6);
  }

  .info-pill {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  :global(.info-icon) {
    color: #fce69a;
  }

  .pill-divider {
    width: 1px;
    height: 16px;
    background: rgba(212, 175, 55, 0.4);
  }

  /* Actions */
  .menu-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
  }

  .millionaire-btn-row {
    display: flex;
    align-items: center;
    width: 100%;
  }

  .play-lozenge-btn {
    width: 48%;
    max-width: 600px;
    margin: 0 auto;
    cursor: pointer;
    transition: transform 0.15s, filter 0.15s;
  }

  .play-lozenge-btn:hover {
    transform: translateY(-2px);
    filter: drop-shadow(0 0 20px rgba(252, 230, 154, 0.8));
  }

  .play-lozenge-btn:active {
    transform: translateY(1px);
  }

  .play-inner {
    min-height: 64px;
    padding: 10px 32px;
    justify-content: center;
    gap: 12px;
    background: linear-gradient(180deg, #1f4294 0%, #163070 48%, #0e1e4c 52%, #0a1436 100%);
  }

  .play-text {
    font-size: 20px;
    font-weight: bold;
    color: #ffffff;
    letter-spacing: 0.5px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
  }

  :global(.play-icon) {
    color: #fce69a;
    filter: drop-shadow(0 0 6px rgba(252, 230, 154, 0.7));
  }

  .btn-settings-sleek {
    background: #0f1c3f;
    border: 1px solid #d4af37;
    border-radius: 6px;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    font-size: 13px;
    font-weight: bold;
    color: #fce69a;
    padding: 8px 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    transition: background 0.15s, transform 0.1s;
  }

  .btn-settings-sleek:hover {
    background: #18336d;
    transform: translateY(-1px);
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
