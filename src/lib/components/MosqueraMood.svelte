<script>
  import Icon from '@iconify/svelte';

  let {
    happiness = 50,
    streak = 0,
    lastEvent = 'idle',
    lastMessage = ''
  } = $props();

  let moodTier = $derived.by(() => {
    if (happiness <= 20) return 'enraged';
    if (happiness <= 40) return 'sad';
    if (happiness <= 65) return 'neutral';
    if (happiness <= 85) return 'happy';
    return 'ascended';
  });

  // Use the clean, high-resolution, natural photo of Dr. Mosquera (no weird melted warping)
  const mosqueraImg = '/assets/mosquera_cutout.png';

  // Short, punchy VLSI professor remarks
  const quotes = {
    enraged: [
      "Review the lecture slides on interconnect delay!",
      "Incorrect. Recheck your boundary conditions.",
      "No?!",
      "ES TERRIBLE! ES TERRIBLE! ES TERRIBLE!",
      "If you were Ian, I would be laughing uncontrollaby right now"
    ],
    sad: [
      "Not quite. Think about the physical capacitive coupling.",
      "Check your Elmore delay path sum again.",
      "Remember: velocity saturation changes the I-V curve.",
      "Complex no?",
      "ES TERRIBLE!"
    ],
    neutral: [
      "Digital CMOS VLSI Design - Lecture Quiz",
      "Analyze the circuit parameters carefully.",
      "Select the best conceptual choice.",
      "Evaluate the design trade-offs.",
      "Next question. Focus on the core theory."
    ],
    happy: [
      "Correct! Outstanding VLSI reasoning!",
      "Precisely right. You understand the device physics!",
      "Accurate analysis of interconnect parasitics!",
      "Excellent. You have mastered this concept!",
      "Spot on! Keep this momentum going!"
    ],
    ascended: [
      "Flawless mastery of Digital CMOS VLSI Design!",
      "Outstanding! 100% precision across all device physics!",
      "Phenomenal clinical & circuit acumen!",
      "Top of the class! Perfect conceptual execution!",
      "Dr. Mosquera is thoroughly impressed!"
    ]
  };

  let currentQuote = $derived.by(() => {
    if (lastMessage) return lastMessage;
    const list = quotes[moodTier];
    const idx = (streak + Math.floor(happiness)) % list.length;
    return list[idx];
  });
</script>

<div class="mosquera-stage {moodTier} {lastEvent}">
  <!-- Ambient Mood Stickers -->
  {#if moodTier === 'enraged'}
    <div class="aura-container">
      <img src="/assets/retro_fire.gif" alt="Flames" class="aura-flame left" />
      <img src="/assets/cat.webp" alt="Confused Meme Cat" class="aura-sticker right-cat" />
      <img src="/assets/retro_fire.gif" alt="Flames" class="aura-flame right-flame" />
    </div>
  {:else if moodTier === 'sad'}
    <div class="aura-container">
      <img src="/assets/sad_taco.png" alt="Sad Taco" class="aura-sticker left-taco" />
      <img src="/assets/cat.webp" alt="Confused Meme Cat" class="aura-sticker right-cat" />
      <img src="/assets/raindrops.gif" alt="Rain" class="aura-rain" />
    </div>
  {:else if moodTier === 'happy'}
    <div class="aura-container">
      <img src="/assets/more_sun.png" alt="Happy Sun" class="aura-sticker left-sun" />
      <img src="/assets/glitter_star.gif" alt="Sparkle" class="aura-star right" />
    </div>
  {:else if moodTier === 'ascended'}
    <div class="aura-container">
      <img src="/assets/more_sun.png" alt="Happy Sun" class="aura-sticker left-sun" />
      <img src="/assets/sun.png" alt="Glorious Sun" class="aura-sticker right-sun spin-slow" />
      <img src="/assets/glitter_star.gif" alt="Star" class="aura-star top-left" />
      <img src="/assets/glitter_star.gif" alt="Star" class="aura-star top-right" />
    </div>
  {/if}

  <!-- Speech Line (Millionaire studio plaque) -->
  <div class="speech-plaque">
    <span class="speech-text">"{currentQuote}"</span>
  </div>

  <!-- Studio Hot Seat Frame: Golden Beveled Rim matching the photo style -->
  <div class="studio-portrait-frame">
    <div class="gold-rim-outer">
      <div class="gold-rim-inner">
        <div class="portrait-surface {moodTier}">
          <img
            src={mosqueraImg}
            alt="Dr. Fernando Mosquera"
            class="mosquera-photo {moodTier}"
          />
        </div>
      </div>
      <!-- Subtle corner glints -->
      <div class="rim-glint top"></div>
      <div class="rim-glint bottom"></div>
    </div>
  </div>

  <!-- Sleek Mood Bar with Gold Trim -->
  <div class="mood-bar-container">
    <div class="mood-bar-track">
      <div
        class="mood-bar-fill {moodTier}"
        style="width: {Math.max(4, Math.min(100, happiness))}%;"
      ></div>
    </div>
    <div class="mood-label-row">
      <span class="mood-title">
        {#if moodTier === 'enraged'}
          FUMING / ENRAGED
        {:else if moodTier === 'sad'}
          DISAPPOINTED
        {:else if moodTier === 'neutral'}
          FOCUSED
        {:else if moodTier === 'happy'}
          HAPPY & SATISFIED
        {:else}
          ASCENDED / MAX HAPPINESS
        {/if}
      </span>
      <span class="mood-pct">{Math.round(happiness)}%</span>
    </div>
  </div>
</div>

<style>
  .mosquera-stage {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    user-select: none;
  }

  /* Ambient Mood Stickers */
  .aura-container {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 10;
  }

  .aura-sticker {
    position: absolute;
    width: 72px;
    height: 72px;
    object-fit: contain;
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.85));
    animation: stickerFloat 2.5s ease-in-out infinite alternate;
  }

  .aura-sticker.left {
    top: 45px;
    left: -40px;
  }

  .aura-sticker.left-taco {
    top: 55px;
    left: -58px;
    width: 95px;
    height: 70px;
  }

  .aura-sticker.right-cat {
    top: 40px;
    right: -58px;
    width: 80px;
    height: 80px;
  }

  .aura-sticker.left-sun {
    top: 35px;
    left: -58px;
    width: 85px;
    height: 85px;
  }

  .aura-sticker.right-sun {
    top: 35px;
    right: -58px;
    width: 90px;
    height: 90px;
  }

  .spin-slow {
    animation: sunSpin 24s linear infinite, stickerFloat 3s ease-in-out infinite alternate;
  }

  @keyframes sunSpin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .aura-sticker.right {
    top: 45px;
    right: -40px;
  }

  .aura-sticker.mirror {
    transform: scaleX(-1);
  }

  .aura-flame {
    position: absolute;
    top: 50px;
    width: 50px;
    height: 64px;
  }

  .aura-flame.left { left: -14px; }
  .aura-flame.right-flame { right: -14px; }

  .aura-rain {
    position: absolute;
    top: 85px;
    left: -5px;
    width: 38px;
  }

  .aura-star {
    position: absolute;
    width: 40px;
    height: 40px;
  }
  .aura-star.right { top: 30px; right: -12px; }
  .aura-star.top-left { top: -6px; left: 12px; }
  .aura-star.top-right { top: -6px; right: 12px; }

  /* Speech Plaque (Millionaire Style) */
  .speech-plaque {
    background: linear-gradient(180deg, #182e66 0%, #0d1a3d 100%);
    border: 2px solid #d4af37;
    border-radius: 24px;
    padding: 10px 28px;
    margin-bottom: 10px;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.25);
    text-align: center;
    max-width: 620px;
    z-index: 5;
  }

  .speech-text {
    font-size: 16px;
    color: #fce69a;
    font-weight: bold;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
    line-height: 1.35;
  }

  /* Studio Hot Seat Frame */
  .studio-portrait-frame {
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 5;
  }

  .gold-rim-outer {
    position: relative;
    padding: 4px;
    background: linear-gradient(180deg, #fff3a8 0%, #d4af37 30%, #8a6218 70%, #f7dc87 100%);
    border-radius: 16px;
    box-shadow:
      0 10px 32px rgba(0, 0, 0, 0.9),
      0 0 24px rgba(212, 175, 55, 0.4);
  }

  .gold-rim-inner {
    background: #091326;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: 5px;
    width: 250px;
    height: 250px;
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
    position: relative;
  }

  .portrait-surface.enraged {
    background: radial-gradient(circle at 50% 40%, #5c1818 0%, #200808 100%);
  }

  .portrait-surface.sad {
    background: radial-gradient(circle at 50% 40%, #142a4a 0%, #071224 100%);
  }

  .portrait-surface.happy {
    background: radial-gradient(circle at 50% 40%, #175438 0%, #082116 100%);
  }

  .portrait-surface.ascended {
    background: radial-gradient(circle at 50% 40%, #4a1f68 0%, #1c082b 100%);
  }

  .mosquera-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease-out, filter 0.3s ease-out;
  }

  /* Natural mood micro-animations (no weird distortion) */
  .mosquera-photo.neutral {
    animation: naturalIdle 3.5s infinite ease-in-out;
  }

  .mosquera-photo.happy {
    animation: naturalHappy 1s infinite alternate ease-in-out;
    filter: drop-shadow(0 0 10px rgba(74, 222, 128, 0.5));
  }

  .mosquera-photo.sad {
    animation: naturalSad 2.5s infinite ease-in-out;
    filter: brightness(0.9) saturate(0.8) drop-shadow(0 0 8px rgba(56, 189, 248, 0.4));
  }

  .mosquera-photo.enraged {
    animation: naturalAngry 0.15s infinite alternate;
    filter: saturate(1.2) drop-shadow(0 0 12px rgba(239, 68, 68, 0.7));
  }

  .mosquera-photo.ascended {
    animation: naturalAscended 1.5s infinite alternate ease-in-out;
    filter: drop-shadow(0 0 16px rgba(250, 204, 21, 0.8));
  }

  .rim-glint {
    position: absolute;
    width: 14px;
    height: 14px;
    background: radial-gradient(circle, #ffffff 15%, #ffd700 45%, transparent 75%);
    pointer-events: none;
    filter: drop-shadow(0 0 4px #ffffff);
  }

  .rim-glint.top {
    top: -4px;
    left: 20px;
  }

  .rim-glint.bottom {
    bottom: -4px;
    right: 20px;
  }

  /* Mood Bar */
  .mood-bar-container {
    width: 100%;
    max-width: 520px;
    margin-top: 10px;
    background: linear-gradient(180deg, #101e42 0%, #091228 100%);
    border: 1px solid #d4af37;
    border-radius: 8px;
    padding: 6px 14px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.7);
    z-index: 5;
  }

  .mood-bar-track {
    width: 100%;
    height: 10px;
    background: #050a16;
    border: 1px solid rgba(212, 175, 55, 0.35);
    border-radius: 4px;
    overflow: hidden;
  }

  .mood-bar-fill {
    height: 100%;
    transition: width 0.35s ease-out;
  }

  .mood-bar-fill.enraged { background: linear-gradient(90deg, #ef4444, #dc2626); }
  .mood-bar-fill.sad { background: linear-gradient(90deg, #3b82f6, #2563eb); }
  .mood-bar-fill.neutral { background: linear-gradient(90deg, #f59e0b, #d97706); }
  .mood-bar-fill.happy { background: linear-gradient(90deg, #10b981, #059669); }
  .mood-bar-fill.ascended {
    background: linear-gradient(90deg, #f59e0b, #ec4899, #8b5cf6, #10b981);
  }

  .mood-label-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #cbd5e1;
    margin-top: 3px;
    font-weight: bold;
    letter-spacing: 0.5px;
  }

  .mood-pct {
    color: #fce69a;
  }

  @keyframes naturalIdle {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  @keyframes naturalHappy {
    0% { transform: translateY(0) scale(1); }
    100% { transform: translateY(-5px) scale(1.02); }
  }

  @keyframes naturalSad {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(3px) rotate(-1.5deg); }
  }

  @keyframes naturalAngry {
    0% { transform: translate(-1.5px, 1.5px); }
    100% { transform: translate(1.5px, -1.5px); }
  }

  @keyframes naturalAscended {
    0% { transform: scale(1) rotate(-1deg); }
    100% { transform: scale(1.04) rotate(1deg); }
  }

  @keyframes stickerFloat {
    0% { transform: translateY(0) rotate(-3deg); }
    100% { transform: translateY(-6px) rotate(3deg); }
  }
</style>
