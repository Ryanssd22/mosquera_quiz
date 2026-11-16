<script>
  import { onMount } from 'svelte';
  import Icon from '@iconify/svelte';
  import { playClick } from '#lib/audio/soundFx.js';

  let { autoPlayOnStart = true } = $props();

  let player = $state(null);
  let isReady = $state(false);
  let isPlaying = $state(false);
  let volume = $state(65);
  let isMuted = $state(false);
  let isMinimized = $state(false);
  let trackTitle = $state("Dr. Mosquera - Kahoot Theme (TyhIVDh-dVo)");
  let playerContainerId = "winamp-yt-iframe";

  onMount(() => {
    // Check if YouTube API is already loaded or inject it
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (window.YT && window.YT.Player) {
        player = new window.YT.Player(playerContainerId, {
          height: '1',
          width: '1',
          videoId: 'TyhIVDh-dVo',
          playerVars: {
            autoplay: autoPlayOnStart ? 1 : 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            loop: 1,
            playlist: 'TyhIVDh-dVo',
            modestbranding: 1,
            rel: 0,
            playsinline: 1
          },
          events: {
            onReady: (event) => {
              isReady = true;
              event.target.setVolume(volume);
              if (autoPlayOnStart) {
                try {
                  event.target.playVideo();
                } catch (e) {
                  console.log("Autoplay waiting for user gesture:", e);
                }
              }
            },
            onStateChange: (event) => {
              // 1 = PLAYING, 2 = PAUSED, 0 = ENDED
              if (event.data === window.YT.PlayerState.PLAYING) {
                isPlaying = true;
              } else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
                isPlaying = false;
              }
            }
          }
        });
      } else {
        setTimeout(initPlayer, 200);
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (player && player.destroy) {
        player.destroy();
      }
    };
  });

  export function playMusic() {
    if (player && isReady) {
      try {
        player.playVideo();
        isPlaying = true;
      } catch (e) {
        console.error("YouTube play error:", e);
      }
    }
  }

  export function pauseMusic() {
    if (player && isReady) {
      try {
        player.pauseVideo();
        isPlaying = false;
      } catch (e) {
        console.error("YouTube pause error:", e);
      }
    }
  }

  export function stopMusic() {
    if (player && isReady) {
      try {
        player.stopVideo();
        isPlaying = false;
      } catch (e) {
        console.error("YouTube stop error:", e);
      }
    }
  }

  function handlePlayToggle() {
    playClick();
    if (isPlaying) {
      pauseMusic();
    } else {
      playMusic();
    }
  }

  function handleStop() {
    playClick();
    stopMusic();
  }

  function handleMuteToggle() {
    playClick();
    if (!player || !isReady) return;
    if (isMuted) {
      player.unMute();
      isMuted = false;
    } else {
      player.mute();
      isMuted = true;
    }
  }

  function handleVolumeChange(e) {
    const val = parseInt(e.target.value, 10);
    volume = val;
    if (player && isReady) {
      player.setVolume(val);
      if (val > 0 && isMuted) {
        player.unMute();
        isMuted = false;
      }
    }
  }

  function toggleMinimize() {
    playClick();
    isMinimized = !isMinimized;
  }
</script>

<!-- Hidden YouTube IFrame Container (100% Client-Side Audio Playback) -->
<div class="yt-hidden-wrapper" aria-hidden="true">
  <div id={playerContainerId}></div>
</div>

<div class="winamp-container" class:minimized={isMinimized}>
  <!-- Winamp Title Bar -->
  <div
    class="winamp-titlebar"
    onclick={toggleMinimize}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleMinimize(); }}
    role="button"
    tabindex="0"
  >
    <div class="titlebar-left">
      <Icon icon="mdi:lightning-bolt" width="14" class="winamp-bolt" />
      <span class="winamp-title-text">WINAMP 2.91 - [Dr. Mosquera Jukebox]</span>
    </div>
    <div class="titlebar-buttons">
      <button class="winamp-btn-tiny" onclick={(e) => { e.stopPropagation(); toggleMinimize(); }} title="Toggle View">
        <Icon icon={isMinimized ? "mdi:chevron-up" : "mdi:chevron-down"} width="12" />
      </button>
    </div>
  </div>

  {#if !isMinimized}
    <div class="winamp-body">
      <!-- Main LCD Display -->
      <div class="winamp-lcd">
        <div class="lcd-top-row">
          <span class="lcd-kbps">128 KBPS</span>
          <span class="lcd-khz">44 KHZ</span>
          <span class="lcd-stereo">STEREO</span>
          <span class="lcd-yt-badge">YOUTUBE CLIENT AUDIO</span>
        </div>
        <div class="lcd-marquee-wrapper">
          <div class="lcd-marquee" class:scrolling={isPlaying}>
            {isPlaying ? `NOW PLAYING: ${trackTitle}` : `PAUSED: ${trackTitle}`}
          </div>
        </div>
        <div class="lcd-bottom-row">
          <div class="lcd-visualizer">
            {#if isPlaying}
              <img src="/assets/winamp_eq.gif" alt="Equalizer" class="eq-gif" />
            {:else}
              <div class="eq-paused">PAUSED</div>
            {/if}
          </div>
          <div class="lcd-status-light" class:active={isPlaying}>
            {isPlaying ? 'PLAY' : 'READY'}
          </div>
        </div>
      </div>

      <!-- Controls Panel -->
      <div class="winamp-controls">
        <button class="winamp-button" class:active={isPlaying} onclick={handlePlayToggle} title={isPlaying ? "Pause" : "Play"}>
          <Icon icon={isPlaying ? "mdi:pause" : "mdi:play"} width="13" />
          <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
        </button>
        <button class="winamp-button" onclick={handleStop} title="Stop">
          <Icon icon="mdi:stop" width="13" />
          <span>STOP</span>
        </button>
        <button class="winamp-button mute-btn" class:muted={isMuted} onclick={handleMuteToggle} title="Mute">
          <Icon icon={isMuted ? "mdi:volume-off" : "mdi:volume-high"} width="13" />
          <span>{isMuted ? 'MUTED' : 'VOL'}</span>
        </button>

        <div class="volume-box">
          <span class="vol-label">VOL:</span>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            oninput={handleVolumeChange}
            class="vol-slider"
          />
          <span class="vol-value">{volume}%</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .yt-hidden-wrapper {
    position: absolute;
    width: 1px;
    height: 1px;
    left: -9999px;
    top: -9999px;
    opacity: 0.01;
    overflow: hidden;
    pointer-events: none;
  }

  .winamp-container {
    font-family: 'Comic Sans MS', 'Comic Sans', cursive, sans-serif;
    width: 320px;
    background: #1e2638;
    border: 2px solid #334155;
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7);
    user-select: none;
    z-index: 1000;
  }

  .winamp-container.minimized {
    width: 250px;
  }

  .winamp-titlebar {
    background: #0f172a;
    color: #f1f5f9;
    font-size: 11px;
    font-weight: bold;
    padding: 5px 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    border-bottom: 1px solid #334155;
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
  }

  .titlebar-left {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  :global(.winamp-bolt) {
    color: #facc15;
  }

  .winamp-btn-tiny {
    background: #334155;
    color: #e2e8f0;
    border: 1px solid #475569;
    border-radius: 3px;
    padding: 2px 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .winamp-body {
    padding: 8px;
    background: #111827;
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 4px;
  }

  /* LCD Display */
  .winamp-lcd {
    background: #061208;
    border: 1px solid #166534;
    border-radius: 4px;
    padding: 6px;
    color: #4ade80;
    margin-bottom: 8px;
  }

  .lcd-top-row {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #22c55e;
    border-bottom: 1px solid #14532d;
    padding-bottom: 3px;
    margin-bottom: 4px;
    font-family: monospace;
  }

  .lcd-yt-badge {
    color: #facc15;
    font-weight: bold;
  }

  .lcd-marquee-wrapper {
    overflow: hidden;
    white-space: nowrap;
    height: 18px;
    background: #022c11;
    border: 1px solid #14532d;
    border-radius: 2px;
    margin-bottom: 4px;
  }

  .lcd-marquee {
    display: inline-block;
    font-size: 11px;
    font-weight: bold;
    color: #86efac;
    text-shadow: 0 0 4px #22c55e;
    padding-left: 6px;
  }

  .lcd-marquee.scrolling {
    animation: winampScroll 16s linear infinite;
  }

  @keyframes winampScroll {
    0% { transform: translateX(100%); }
    100% { transform: translateX(-100%); }
  }

  .lcd-bottom-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 18px;
  }

  .lcd-visualizer {
    height: 16px;
    display: flex;
    align-items: center;
  }

  .eq-gif {
    height: 16px;
    image-rendering: pixelated;
  }

  .eq-paused {
    font-size: 10px;
    color: #15803d;
    font-family: monospace;
  }

  .lcd-status-light {
    font-size: 10px;
    font-weight: bold;
    color: #475569;
  }

  .lcd-status-light.active {
    color: #4ade80;
    text-shadow: 0 0 6px #22c55e;
  }

  /* Controls Panel */
  .winamp-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .winamp-button {
    background: #1e293b;
    color: #e2e8f0;
    border: 1px solid #475569;
    border-radius: 4px;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    font-size: 11px;
    font-weight: bold;
    padding: 4px 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: background 0.15s, border-color 0.15s;
  }

  .winamp-button:hover {
    background: #334155;
    border-color: #64748b;
  }

  .winamp-button.active {
    background: #0f766e;
    border-color: #14b8a6;
    color: #ffffff;
  }

  .winamp-button.muted {
    background: #7f1d1d;
    border-color: #ef4444;
    color: #fef2f2;
  }

  .volume-box {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
  }

  .vol-label {
    color: #cbd5e1;
    font-size: 10px;
    font-weight: bold;
  }

  .vol-slider {
    width: 60px;
    height: 5px;
    accent-color: #22c55e;
    cursor: pointer;
  }

  .vol-value {
    color: #86efac;
    font-size: 10px;
    font-family: monospace;
    width: 28px;
    text-align: right;
  }
</style>
