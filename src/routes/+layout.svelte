<script>
  import { onMount } from 'svelte';
  import WinampPlayer from '#lib/components/WinampPlayer.svelte';

  let { children } = $props();
  let winampComponent = $state(null);

  onMount(() => {
    // Attempt auto-playback on first user interaction anywhere on the screen
    const triggerAudio = () => {
      if (winampComponent && winampComponent.playMusic) {
        winampComponent.playMusic();
      }
      window.removeEventListener('pointerdown', triggerAudio);
      window.removeEventListener('keydown', triggerAudio);
    };

    window.addEventListener('pointerdown', triggerAudio, { once: true });
    window.addEventListener('keydown', triggerAudio, { once: true });

    return () => {
      window.removeEventListener('pointerdown', triggerAudio);
      window.removeEventListener('keydown', triggerAudio);
    };
  });
</script>

<div class="retro-body">
  <!-- Docked Winamp Client YouTube Player -->
  <div class="winamp-dock">
    <WinampPlayer bind:this={winampComponent} autoPlayOnStart={true} />
  </div>

  <main class="page-container">
    {@render children()}
  </main>
</div>

<style>
  :global(*), :global(*::before), :global(*::after) {
    box-sizing: border-box;
    font-family: 'Comic Sans MS', 'Comic Sans', 'BBH Bogle', 'Gotham', cursive, sans-serif !important;
  }

  :global(:root) {
    --mood-bg-color: #0c1836;
    --mood-dot-color-1: rgba(80, 140, 255, 0.36);
    --mood-dot-color-2: rgba(255, 215, 0, 0.25);
  }

  :global(body) {
    margin: 0;
    padding: 0;
    background-color: var(--mood-bg-color, #0c1836);
    background-image:
      radial-gradient(circle at 50% 40%, rgba(27, 54, 118, 0.85) 0%, rgba(13, 26, 60, 0.95) 55%, rgba(6, 11, 24, 1) 100%),
      radial-gradient(circle, var(--mood-dot-color-1, rgba(80, 140, 255, 0.36)) 2.2px, transparent 2.2px),
      radial-gradient(circle, var(--mood-dot-color-2, rgba(255, 215, 0, 0.25)) 1.8px, transparent 1.8px);
    background-size: 100% 100%, 36px 36px, 18px 18px;
    background-position: 0 0, 0 0, 18px 18px;
    animation: tackyDotSway 7s ease-in-out infinite alternate;
    transition: background-color 0.8s ease;
    min-height: 100vh;
    color: #ffffff;
    overflow-x: hidden;
  }

  @keyframes tackyDotSway {
    0% {
      background-position: 0 0, 0px 0px, 18px 18px;
    }
    50% {
      background-position: 0 0, 18px 14px, 36px 32px;
    }
    100% {
      background-position: 0 0, 0px 0px, 18px 18px;
    }
  }

  .retro-body {
    position: relative;
    min-height: 100vh;
    min-height: 100dvh;
    width: 100vw;
    max-width: 100%;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-x: hidden;
  }

  .winamp-dock {
    position: fixed;
    bottom: 8px;
    right: 12px;
    z-index: 9000;
  }

  .page-container {
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
    padding: 0;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
  }

  @media (max-width: 768px) {
    .winamp-dock {
      position: fixed;
      bottom: 4px;
      right: 4px;
    }
  }
</style>
