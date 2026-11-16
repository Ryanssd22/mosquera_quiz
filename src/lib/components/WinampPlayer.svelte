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
  let trackTitle = $state("Kahoot Album (TyhIVDh-dVo)");
  let playerContainerId = "winamp-yt-iframe";
  let hasSeekedRandom = $state(false);

  // Generate a random start time offset between 10s and 1500s
  const initialRandomStart = Math.floor(Math.random() * 1400) + 10;

  function performRandomSeek() {
    if (player && isReady && !hasSeekedRandom) {
      try {
        const duration = player.getDuration();
        let targetSec = initialRandomStart;
        if (duration && duration > 120) {
          targetSec = Math.floor(Math.random() * (duration - 60)) + 15;
        }
        player.seekTo(targetSec, true);
        hasSeekedRandom = true;
      } catch (e) {
        console.log("Seek error:", e);
      }
    }
  }

  onMount(() => {
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
            start: initialRandomStart,
            playlist: 'TyhIVDh-dVo',
            modestbranding: 1,
            rel: 0,
            playsinline: 1
          },
          events: {
            onReady: (event) => {
              isReady = true;
              event.target.setVolume(volume);
              performRandomSeek();
              if (autoPlayOnStart) {
                try {
                  event.target.playVideo();
                } catch (e) {
                  console.log("Autoplay waiting for user gesture:", e);
                }
              }
            },
            onStateChange: (event) => {
              if (event.data === window.YT.PlayerState.PLAYING) {
                isPlaying = true;
                if (!hasSeekedRandom) {
                  performRandomSeek();
                }
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
        if (!hasSeekedRandom) {
          performRandomSeek();
        }
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
</script>

<!-- Hidden YouTube IFrame Container -->
<div class="yt-hidden-wrapper" aria-hidden="true">
  <div id={playerContainerId}></div>
</div>

<!-- Ultra-Compact Floating Jukebox Mini-Bar (Never overlaps answers) -->
<div class="mini-jukebox">
  <button class="juke-btn play-btn" class:active={isPlaying} onclick={handlePlayToggle} title={isPlaying ? "Pause" : "Play"}>
    <Icon icon={isPlaying ? "mdi:pause" : "mdi:play"} width="15" />
  </button>
  <button class="juke-btn stop-btn" onclick={handleStop} title="Stop">
    <Icon icon="mdi:stop" width="14" />
  </button>

  <div class="juke-track-pill">
    <Icon icon="mdi:music" width="13" class="juke-music-icon" />
    <span class="juke-track-text">{isPlaying ? trackTitle : 'Music Paused'}</span>
  </div>

  <button class="juke-btn mute-btn" class:muted={isMuted} onclick={handleMuteToggle} title="Mute">
    <Icon icon={isMuted ? "mdi:volume-off" : "mdi:volume-high"} width="14" />
  </button>

  <input
    type="range"
    min="0"
    max="100"
    value={volume}
    oninput={handleVolumeChange}
    class="juke-vol-slider"
    title="Volume: {volume}%"
  />
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

  /* Ultra-Compact Jukebox Bar */
  .mini-jukebox {
    position: fixed;
    bottom: 8px;
    right: 12px;
    height: 32px;
    background: rgba(10, 20, 48, 0.94);
    border: 1px solid #d4af37;
    border-radius: 16px;
    padding: 0 10px;
    display: flex;
    align-items: center;
    gap: 7px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.8), 0 0 10px rgba(212, 175, 55, 0.3);
    z-index: 9999;
    user-select: none;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    backdrop-filter: blur(6px);
  }

  .juke-btn {
    background: #182e66;
    border: 1px solid #d4af37;
    border-radius: 50%;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fce69a;
    cursor: pointer;
    padding: 0;
    transition: background 0.15s, transform 0.1s;
  }

  .juke-btn:hover {
    background: #254b9e;
    transform: scale(1.08);
  }

  .juke-btn.active {
    background: #15803d;
    border-color: #4ade80;
    color: #ffffff;
  }

  .juke-btn.muted {
    background: #7f1d1d;
    border-color: #ef4444;
    color: #f87171;
  }

  .juke-track-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    max-width: 170px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  :global(.juke-music-icon) {
    color: #fce69a;
    flex-shrink: 0;
  }

  .juke-track-text {
    font-size: 11px;
    font-weight: bold;
    color: #e2e8f0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .juke-vol-slider {
    width: 50px;
    height: 4px;
    accent-color: #fce69a;
    cursor: pointer;
  }
</style>
