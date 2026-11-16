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
      "Zero credit. That violates the scaling rules!",
      "Check your RC time constant calculations.",
      "Subthreshold leakage is out of control!"
    ],
    sad: [
      "Not quite. Think about the physical capacitive coupling.",
      "Check your Elmore delay path sum again.",
      "Remember: velocity saturation changes the I-V curve.",
      "Re-evaluate the crosstalk impact on the victim line.",
      "Let's review this concept once more."
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
      <img src="/assets/angry_sun.png" alt="Angry Sun" class="aura-sticker right" />
      <img src="/assets/retro_fire.gif" alt="Flames" class="aura-flame right-flame" />
    </div>
  {:else if moodTier === 'sad'}
    <div class="aura-container">
      <img src="/assets/sad_taco.png" alt="Sad Taco" class="aura-sticker left-taco" />
      <img src="/assets/pngtree-d-very-sad-face-emoji-in-yellow-colour-on-transparent-background-png-image_16061301.png" alt="Sad Face" class="aura-sticker right" />
      <img src="/assets/raindrops.gif" alt="Rain" class="aura-rain" />
    </div>
  {:else if moodTier === 'happy'}
    <div class="aura-container">
      <img src="/assets/Happy_smiley_face.png" alt="Happy Face" class="aura-sticker left" />
      <img src="/assets/glitter_star.gif" alt="Sparkle" class="aura-star right" />
    </div>
  {:else if moodTier === 'ascended'}
    <div class="aura-container">
      <img src="/assets/happy_sun.png" alt="Happy Sun" class="aura-sticker left" />
      <img src="/assets/happy_sun.png" alt="Happy Sun" class="aura-sticker right mirror" />
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
    max-width: 460px;
    margin: 0 auto;
    user-select: none;
  }

  /* Ambient Aura Stickers */
  .aura-container {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 10;
  }

  .aura-sticker {
    position: absolute;
    width: 54px;
    height: 54px;
    object-fit: contain;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.7));
    animation: stickerFloat 2.5s ease-in-out infinite alternate;
  }

  .aura-sticker.left {
    top: 30px;
    left: -24px;
  }

  .aura-sticker.left-taco {
    top: 40px;
    left: -35px;
    width: 70px;
    height: 50px;
  }

  .aura-sticker.right {
    top: 30px;
    right: -24px;
  }

  .aura-sticker.mirror {
    transform: scaleX(-1);
  }

  .aura-flame {
    position: absolute;
    top: 40px;
    width: 36px;
    height: 46px;
  }

  .aura-flame.left { left: -5px; }
  .aura-flame.right-flame { right: -5px; }

  .aura-rain {
    position: absolute;
    top: 60px;
    left: 5px;
    width: 28px;
  }

  .aura-star {
    position: absolute;
    width: 30px;
    height: 30px;
  }
  .aura-star.right { top: 20px; right: 0; }
  .aura-star.top-left { top: 0px; left: 15px; }
  .aura-star.top-right { top: 0px; right: 15px; }

  /* Speech Plaque (Millionaire Style) */
  .speech-plaque {
    background: linear-gradient(180deg, #182e66 0%, #0d1a3d 100%);
    border: 2px solid #d4af37;
    border-radius: 20px;
    padding: 6px 18px;
    margin-bottom: 8px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2);
    text-align: center;
    max-width: 440px;
    z-index: 5;
  }

  .speech-text {
    font-size: 13px;
    color: #fce69a;
    font-weight: bold;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
    line-height: 1.3;
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
    padding: 3px;
    background: linear-gradient(180deg, #fff3a8 0%, #d4af37 30%, #8a6218 70%, #f7dc87 100%);
    border-radius: 12px;
    box-shadow:
      0 8px 25px rgba(0, 0, 0, 0.8),
      0 0 15px rgba(212, 175, 55, 0.3);
  }

  .gold-rim-inner {
    background: #091326;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 9px;
    padding: 4px;
    width: 170px;
    height: 170px;
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
    margin-top: 8px;
    background: linear-gradient(180deg, #101e42 0%, #091228 100%);
    border: 1px solid #d4af37;
    border-radius: 6px;
    padding: 5px 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
    z-index: 5;
  }

  .mood-bar-track {
    width: 100%;
    height: 8px;
    background: #050a16;
    border: 1px solid rgba(212, 175, 55, 0.3);
    border-radius: 3px;
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
