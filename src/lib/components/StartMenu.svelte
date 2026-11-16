<script>
  import Icon from '@iconify/svelte';
  import { playClick } from '#lib/audio/soundFx.js';

  let {
    selectedTopicsCount = 0,
    totalQuestionsCount = 0,
    hasTimeLimit = false,
    timeLimitSeconds = 20,
    onStartGame = () => {},
    onOpenSettings = () => {},
    onOpenVersus = () => {}
  } = $props();

  function handlePlay() {
    playClick();
    onStartGame();
  }

  function handleSettings() {
    playClick();
    onOpenSettings();
  }

  function handleVersus() {
    playClick();
    onOpenVersus();
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
          <h1 class="game-title">Dr. Mosquerra's Practice VLSI Exam</h1>
          <p class="subtitle">Can you master these Digital CMOS VLSI questions?</p>
        </div>
        <img src="/assets/glitter_star.gif" alt="Sparkle" class="star-gif right" />
      </div>
    </div>

    <div class="gold-wing-line right"></div>
  </div>

  <!-- Center Stage Character (Hot Seat Frame matching photo) -->
  <div class="center-stage-box">
    <div class="speech-plaque">
      <span class="speech-text">
        "Welcome to Digital CMOS VLSI Design! Let's see if you can answer these right, make me proud, and reach 100% happiness!"
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
      <img src="/assets/more_sun.png" alt="Happy Sun" class="corner-sun" />
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
      <span>Timer: <strong>{hasTimeLimit ? `${timeLimitSeconds}s` : 'Disabled'}</strong></span>
    </div>
  </div>

  <!-- Actions (Millionaire Lozenge Play Button) -->
  <div class="menu-actions">
    <div class="millionaire-btn-row">
      <div class="gold-wing-line left"></div>

      <button class="lozenge-outer play-lozenge-btn" onclick={handlePlay}>
        <div class="lozenge-inner play-inner">
          <Icon icon="mdi:play" width="30" class="play-icon" />
          <span class="play-text">START SOLO PRACTICE EXAM</span>
        </div>
      </button>

      <div class="gold-wing-line right"></div>
    </div>

    <div class="menu-secondary-row">
      <button class="btn-versus-mode" onclick={handleVersus}>
        <Icon icon="mdi:sword-cross" width="18" class="versus-icon" />
        <span>VERSUS MULTIPLAYER (ROOM CODE)</span>
      </button>

      <button class="btn-settings-sleek" onclick={handleSettings}>
        <Icon icon="mdi:cog" width="16" />
        <span>Settings & Topics</span>
      </button>
    </div>
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
    background:
      radial-gradient(ellipse 85% 65% at 50% 18%, rgba(70, 125, 230, 0.55) 0%, transparent 70%),
      linear-gradient(180deg, #284da0 0%, #1e3c84 32%, #13275c 52%, #08112c 100%);
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
    box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.4), inset 0 -2px 6px rgba(0, 0, 0, 0.6);
  }

  /* Title Lozenge */
  .title-lozenge {
    width: 82%;
    max-width: 1250px;
    margin: 0 auto;
  }

  .title-inner {
    min-height: 105px;
    padding: 16px 40px;
    justify-content: space-between;
  }

  .title-text-group {
    flex: 1;
    text-align: center;
  }

  .game-title {
    font-size: 38px;
    margin: 0;
    color: #fce69a;
    text-shadow:
      2px 2px 0 #855b14,
      0px 4px 10px rgba(0,0,0,0.9);
    letter-spacing: 0.5px;
  }

  .subtitle {
    margin: 6px 0 0 0;
    font-size: 16px;
    font-weight: bold;
    color: #93c5fd;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  }

  .star-gif {
    width: 36px;
    height: 36px;
  }

  /* Center Stage */
  .center-stage-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 12px 0;
  }

  .speech-plaque {
    background: linear-gradient(180deg, #182e66 0%, #0d1a3d 100%);
    border: 2px solid #d4af37;
    border-radius: 24px;
    padding: 10px 28px;
    font-size: 15px;
    font-weight: bold;
    color: #fce69a;
    margin-bottom: 14px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.75);
    text-align: center;
    max-width: 620px;
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
    padding: 4px;
    background: linear-gradient(180deg, #fff3a8 0%, #d4af37 30%, #8a6218 70%, #f7dc87 100%);
    border-radius: 16px;
    box-shadow: 0 10px 32px rgba(0, 0, 0, 0.9);
  }

  .gold-rim-inner {
    background: #091326;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: 5px;
    width: 240px;
    height: 240px;
    overflow: hidden;
  }

  .portrait-surface {
    width: 100%;
    height: 100%;
    background: radial-gradient(circle at 50% 40%, #1e3a78 0%, #0b1733 100%);
    border-radius: 8px;
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
    width: 16px;
    height: 16px;
    background: radial-gradient(circle, #ffffff 15%, #ffd700 45%, transparent 75%);
    pointer-events: none;
    filter: drop-shadow(0 0 4px #ffffff);
  }

  .rim-glint.top { top: -4px; left: 24px; }
  .rim-glint.bottom { bottom: -4px; right: 24px; }

  .corner-sun {
    position: absolute;
    bottom: -14px;
    right: -14px;
    width: 68px;
    animation: sunSpin 6s infinite linear;
    filter: drop-shadow(0 2px 10px rgba(0,0,0,0.8));
  }

  /* Session Info Bar */
  .session-info-bar {
    display: flex;
    align-items: center;
    gap: 20px;
    background: linear-gradient(180deg, #101e42 0%, #091228 100%);
    border: 1px solid #d4af37;
    padding: 10px 32px;
    font-size: 14px;
    color: #cbd5e1;
    margin: 10px 0;
    border-radius: 24px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.65);
  }

  .info-pill {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :global(.info-icon) {
    color: #fce69a;
  }

  .pill-divider {
    width: 1px;
    height: 18px;
    background: rgba(212, 175, 55, 0.45);
  }

  /* Actions */
  .menu-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .millionaire-btn-row {
    display: flex;
    align-items: center;
    width: 100%;
  }

  .play-lozenge-btn {
    width: 55%;
    max-width: 720px;
    margin: 0 auto;
    cursor: pointer;
    transition: transform 0.15s, filter 0.15s;
  }

  .play-lozenge-btn:hover {
    transform: translateY(-2px);
    filter: drop-shadow(0 0 24px rgba(252, 230, 154, 0.85));
  }

  .play-lozenge-btn:active {
    transform: translateY(1px);
  }

  .play-inner {
    min-height: 76px;
    padding: 12px 36px;
    justify-content: center;
    gap: 14px;
    background: linear-gradient(180deg, #1f4294 0%, #163070 48%, #0e1e4c 52%, #0a1436 100%);
  }

  .play-text {
    font-size: 22px;
    font-weight: bold;
    color: #ffffff;
    letter-spacing: 0.5px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
  }

  :global(.play-icon) {
    color: #fce69a;
    filter: drop-shadow(0 0 8px rgba(252, 230, 154, 0.8));
  }

  .menu-secondary-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .btn-versus-mode {
    background: linear-gradient(180deg, #1b387a 0%, #102146 100%);
    border: 2px solid #f59e0b;
    border-radius: 6px;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    font-size: 14px;
    font-weight: bold;
    color: #fce69a;
    padding: 10px 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);
    transition: all 0.15s;
  }

  .btn-versus-mode:hover {
    background: #254d9e;
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(245, 158, 11, 0.5);
  }

  :global(.versus-icon) {
    color: #f59e0b;
  }

  .btn-settings-sleek {
    background: #0f1c3f;
    border: 1px solid #d4af37;
    border-radius: 6px;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    font-size: 14px;
    font-weight: bold;
    color: #fce69a;
    padding: 10px 22px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.6);
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

  /* Responsive Mobile / Single Screen Fitting (ZERO Scroll, Safe-Area compliant) */
  @media (max-width: 768px), (max-height: 720px) {
    .start-menu-stage {
      height: 100vh;
      height: 100dvh;
      max-height: 100dvh;
      overflow: hidden;
      padding-top: max(10px, env(safe-area-inset-top));
      padding-bottom: max(8px, env(safe-area-inset-bottom));
      padding-left: max(6px, env(safe-area-inset-left));
      padding-right: max(6px, env(safe-area-inset-right));
      justify-content: space-between;
      box-sizing: border-box;
    }

    .millionaire-title-row {
      margin-bottom: 4px;
    }

    .title-lozenge {
      width: 96%;
      clip-path: polygon(14px 0%, calc(100% - 14px) 0%, 100% 50%, calc(100% - 14px) 100%, 14px 100%, 0% 50%);
    }

    .title-inner {
      min-height: 48px;
      padding: 6px 12px;
      clip-path: polygon(13px 0%, calc(100% - 13px) 0%, 100% 50%, calc(100% - 13px) 100%, 13px 100%, 0% 50%);
    }

    .game-title {
      font-size: 16px;
    }

    .subtitle {
      font-size: 10px;
      margin-top: 2px;
    }

    .star-gif {
      width: 20px;
      height: 20px;
    }

    .center-stage-box {
      margin: 4px 0;
    }

    .speech-plaque {
      padding: 4px 10px;
      font-size: 10px;
      margin-bottom: 4px;
      max-width: 94%;
    }

    .gold-rim-inner {
      width: 90px;
      height: 90px;
      padding: 2px;
    }

    .corner-sun {
      width: 38px;
      bottom: -8px;
      right: -8px;
    }

    .rim-glint {
      display: none;
    }

    .session-info-bar {
      padding: 4px 12px;
      font-size: 10px;
      gap: 8px;
      margin: 4px 0;
    }

    .info-pill {
      gap: 4px;
    }

    :global(.info-icon) {
      width: 14px;
      height: 14px;
    }

    .play-lozenge-btn {
      width: 88%;
      clip-path: polygon(14px 0%, calc(100% - 14px) 0%, 100% 50%, calc(100% - 14px) 100%, 14px 100%, 0% 50%);
    }

    .play-inner {
      min-height: 48px;
      padding: 6px 14px;
      gap: 8px;
      clip-path: polygon(13px 0%, calc(100% - 13px) 0%, 100% 50%, calc(100% - 13px) 100%, 13px 100%, 0% 50%);
    }

    .play-text {
      font-size: 14px;
    }

    :global(.play-icon) {
      width: 22px;
      height: 22px;
    }

    .menu-secondary-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-versus-mode {
      font-size: 11px;
      padding: 6px 12px;
    }

    .btn-settings-sleek {
      font-size: 11px;
      padding: 6px 14px;
    }

    .menu-actions {
      margin-bottom: 26px; /* Clearance for bottom mini jukebox */
    }
  }
</style>
