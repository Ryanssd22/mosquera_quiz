<script>
  import Icon from '@iconify/svelte';
  import { playClick } from '#lib/audio/soundFx.js';

  let {
    isOpen = false,
    allTopics = [],
    selectedTopics = [],
    questionLimit = 0, // 0 = all
    hasTimeLimit = false,
    timeLimitSeconds = 20,
    sfxEnabled = true,
    sfxVolume = 70,
    questionsJson = '',
    onSave = () => {},
    onClose = () => {}
  } = $props();

  let activeTab = $state('general'); // 'general' | 'json'
  let localTopics = $state([]);
  let localQuestionLimit = $state(0);
  let localHasTimeLimit = $state(false);
  let localTimeLimitSeconds = $state(20);
  let localSfxEnabled = $state(true);
  let localSfxVolume = $state(70);
  let localJsonText = $state('');
  let jsonError = $state('');
  let jsonSuccess = $state('');

  $effect(() => {
    if (isOpen) {
      localTopics = [...selectedTopics];
      localQuestionLimit = questionLimit;
      localHasTimeLimit = hasTimeLimit;
      localTimeLimitSeconds = timeLimitSeconds;
      localSfxEnabled = sfxEnabled;
      localSfxVolume = sfxVolume;
      localJsonText = questionsJson;
      jsonError = '';
      jsonSuccess = '';
    }
  });

  function toggleTopic(topic) {
    playClick();
    if (localTopics.includes(topic)) {
      if (localTopics.length > 1) {
        localTopics = localTopics.filter(t => t !== topic);
      }
    } else {
      localTopics = [...localTopics, topic];
    }
  }

  function selectAllTopics() {
    playClick();
    localTopics = [...allTopics];
  }

  function handleSave() {
    playClick();
    let validatedQuestions = null;

    if (activeTab === 'json' || localJsonText !== questionsJson) {
      try {
        const parsed = JSON.parse(localJsonText);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          jsonError = "JSON must be a non-empty array of question objects.";
          return;
        }
        for (let i = 0; i < parsed.length; i++) {
          const q = parsed[i];
          if (!q.question || !Array.isArray(q.options) || q.options.length < 2 || q.correctIndex === undefined) {
            jsonError = `Question #${i + 1} is missing required fields (question, options, correctIndex).`;
            return;
          }
        }
        validatedQuestions = parsed;
        jsonSuccess = "Valid JSON questions loaded successfully.";
      } catch (e) {
        jsonError = "Invalid JSON syntax: " + e.message;
        return;
      }
    }

    onSave({
      selectedTopics: localTopics,
      questionLimit: localQuestionLimit,
      hasTimeLimit: localHasTimeLimit,
      timeLimitSeconds: localTimeLimitSeconds,
      sfxEnabled: localSfxEnabled,
      sfxVolume: localSfxVolume,
      customQuestions: validatedQuestions
    });
    onClose();
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      localJsonText = event.target.result;
      jsonError = '';
      jsonSuccess = `Loaded ${file.name}. Click 'Apply' to confirm.`;
    };
    reader.readAsText(file);
  }
</script>

{#if isOpen}
  <div
    class="modal-backdrop"
    onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}
    role="button"
    tabindex="0"
    aria-label="Close dialog backdrop"
  >
    <div
      class="modal-window"
      role="region"
      aria-label="Settings modal dialog"
    >
      <!-- Title Bar -->
      <div class="modal-titlebar">
        <div class="title-left">
          <Icon icon="mdi:cog" width="16" />
          <span class="title-text">Study Preferences & Topics</span>
        </div>
        <button class="win-btn-close" onclick={onClose} title="Close">
          <Icon icon="mdi:close" width="14" />
        </button>
      </div>

      <!-- Tab Strip -->
      <div class="tab-strip">
        <button
          class="tab-btn"
          class:active={activeTab === 'general'}
          onclick={() => { playClick(); activeTab = 'general'; }}
        >
          General Settings
        </button>
        <button
          class="tab-btn"
          class:active={activeTab === 'json'}
          onclick={() => { playClick(); activeTab = 'json'; }}
        >
          Custom Questions (JSON)
        </button>
      </div>

      <!-- Tab Content Area -->
      <div class="tab-content">
        {#if activeTab === 'general'}
          <!-- Topics Selection -->
          <fieldset class="win-fieldset">
            <legend class="win-legend">Select Study Topics</legend>
            <div class="fieldset-desc">
              Choose which topics are included in your study session. You can switch topics anytime during the quiz.
            </div>
            <div class="topic-list">
              {#each allTopics as topic}
                <label class="topic-label">
                  <input
                    type="checkbox"
                    checked={localTopics.includes(topic)}
                    onchange={() => toggleTopic(topic)}
                  />
                  <span class="topic-name">{topic}</span>
                </label>
              {/each}
            </div>
            <div class="topic-buttons">
              <button class="win-btn-small" onclick={selectAllTopics}>Select All Topics</button>
            </div>
          </fieldset>

          <!-- Question Count & Time Limit -->
          <div class="settings-grid">
            <fieldset class="win-fieldset">
              <legend class="win-legend">Session Length</legend>
              <label class="radio-row">
                <input
                  type="radio"
                  name="limit"
                  checked={localQuestionLimit === 0}
                  onchange={() => { localQuestionLimit = 0; }}
                />
                <span>All Questions in Topic</span>
              </label>
              <label class="radio-row">
                <input
                  type="radio"
                  name="limit"
                  checked={localQuestionLimit === 5}
                  onchange={() => { localQuestionLimit = 5; }}
                />
                <span>5 Questions</span>
              </label>
              <label class="radio-row">
                <input
                  type="radio"
                  name="limit"
                  checked={localQuestionLimit === 10}
                  onchange={() => { localQuestionLimit = 10; }}
                />
                <span>10 Questions</span>
              </label>
            </fieldset>

            <fieldset class="win-fieldset">
              <legend class="win-legend">Timer</legend>
              <label class="checkbox-row">
                <input
                  type="checkbox"
                  bind:checked={localHasTimeLimit}
                />
                <span>Enable Countdown Timer</span>
              </label>
              {#if localHasTimeLimit}
                <div class="timer-select-row">
                  <span>Seconds per question:</span>
                  <select bind:value={localTimeLimitSeconds} class="win-select">
                    <option value={10}>10 Seconds</option>
                    <option value={15}>15 Seconds</option>
                    <option value={20}>20 Seconds</option>
                    <option value={30}>30 Seconds</option>
                  </select>
                </div>
              {/if}
            </fieldset>
          </div>

          <!-- Sound FX -->
          <fieldset class="win-fieldset">
            <legend class="win-legend">Sound Effects</legend>
            <div class="sound-row">
              <label class="checkbox-row">
                <input type="checkbox" bind:checked={localSfxEnabled} />
                <span>Enable Audio Effects</span>
              </label>
              {#if localSfxEnabled}
                <div class="slider-row">
                  <span>Volume:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    bind:value={localSfxVolume}
                    class="win-slider"
                  />
                  <span>{localSfxVolume}%</span>
                </div>
              {/if}
            </div>
          </fieldset>

        {:else if activeTab === 'json'}
          <!-- Custom JSON Editor -->
          <fieldset class="win-fieldset json-fieldset">
            <legend class="win-legend">Questions Data (JSON)</legend>
            <div class="fieldset-desc">
              Paste or upload questions in JSON format.
            </div>

            <div class="file-upload-bar">
              <label class="upload-btn-label win-btn-small">
                <Icon icon="mdi:folder-open" width="14" />
                <span>Upload .JSON File</span>
                <input type="file" accept=".json" onchange={handleFileUpload} style="display:none;" />
              </label>
            </div>

            <textarea
              class="json-textarea"
              bind:value={localJsonText}
              placeholder="Paste JSON array here..."
              spellcheck="false"
            ></textarea>

            {#if jsonError}
              <div class="alert-error">
                <Icon icon="mdi:alert-circle" width="14" />
                <span>{jsonError}</span>
              </div>
            {/if}
            {#if jsonSuccess}
              <div class="alert-success">
                <Icon icon="mdi:check-circle" width="14" />
                <span>{jsonSuccess}</span>
              </div>
            {/if}
          </fieldset>
        {/if}
      </div>

      <!-- Dialog Footer Buttons -->
      <div class="modal-footer">
        <button class="win-btn-primary" onclick={handleSave}>Save</button>
        <button class="win-btn-secondary" onclick={onClose}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 16px;
    font-family: 'Comic Sans MS', 'Comic Sans', cursive, sans-serif;
  }

  .modal-window {
    width: 100%;
    max-width: 660px;
    background: #1e293b;
    border: 2px solid #475569;
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    color: #f1f5f9;
  }

  .modal-titlebar {
    background: #0f172a;
    color: #f8fafc;
    font-size: 13px;
    font-weight: bold;
    padding: 8px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #334155;
  }

  .title-left {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #38bdf8;
  }

  .win-btn-close {
    background: #334155;
    border: 1px solid #64748b;
    color: #cbd5e1;
    border-radius: 4px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .win-btn-close:hover {
    background: #475569;
    color: #ffffff;
  }

  /* Tab Strip */
  .tab-strip {
    display: flex;
    padding: 8px 12px 0 12px;
    gap: 6px;
    border-bottom: 1px solid #334155;
    background: #1e293b;
  }

  .tab-btn {
    background: #0f172a;
    border: 1px solid #334155;
    border-bottom: none;
    color: #94a3b8;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    font-size: 12px;
    font-weight: bold;
    padding: 6px 14px;
    cursor: pointer;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    margin-bottom: -1px;
  }

  .tab-btn.active {
    background: #1e293b;
    border-color: #475569;
    border-bottom: 1px solid #1e293b;
    color: #38bdf8;
  }

  /* Content */
  .tab-content {
    padding: 14px;
    background: #0f172a;
    margin: 10px;
    border-radius: 6px;
    border: 1px solid #334155;
    overflow-y: auto;
    flex: 1;
  }

  .win-fieldset {
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 10px 14px 12px;
    margin-bottom: 12px;
  }

  .win-legend {
    font-size: 12px;
    font-weight: bold;
    color: #38bdf8;
    padding: 0 6px;
  }

  .fieldset-desc {
    font-size: 11px;
    color: #94a3b8;
    margin-bottom: 10px;
  }

  .topic-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 140px;
    overflow-y: auto;
    border: 1px solid #1e293b;
    border-radius: 4px;
    padding: 8px;
    background: #090d16;
  }

  .topic-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    cursor: pointer;
    color: #e2e8f0;
  }

  .topic-buttons {
    margin-top: 10px;
  }

  .settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .radio-row, .checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    margin-bottom: 6px;
    cursor: pointer;
    color: #cbd5e1;
  }

  .timer-select-row {
    margin-top: 6px;
    font-size: 11px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: #94a3b8;
  }

  .win-select {
    font-family: 'Comic Sans MS', cursive, sans-serif;
    font-size: 12px;
    padding: 4px;
    border: 1px solid #475569;
    border-radius: 4px;
    background: #1e293b;
    color: #f1f5f9;
  }

  .sound-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: #94a3b8;
  }

  .win-slider {
    flex: 1;
    max-width: 160px;
  }

  /* JSON Tab */
  .file-upload-bar {
    margin-bottom: 10px;
  }

  .upload-btn-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }

  .json-textarea {
    width: 100%;
    height: 220px;
    font-family: monospace;
    font-size: 11px;
    border: 1px solid #334155;
    border-radius: 4px;
    padding: 8px;
    box-sizing: border-box;
    white-space: pre;
    background: #090d16;
    color: #e2e8f0;
  }

  .alert-error {
    color: #f87171;
    font-size: 12px;
    margin-top: 8px;
    background: #450a0a;
    padding: 6px 10px;
    border: 1px solid #ef4444;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .alert-success {
    color: #4ade80;
    font-size: 12px;
    margin-top: 8px;
    background: #052e16;
    padding: 6px 10px;
    border: 1px solid #22c55e;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Footer */
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 10px 14px;
    background: #1e293b;
    border-top: 1px solid #334155;
  }

  .win-btn-primary, .win-btn-secondary, .win-btn-small {
    font-family: 'Comic Sans MS', cursive, sans-serif;
    font-size: 12px;
    font-weight: bold;
    padding: 6px 16px;
    border-radius: 4px;
    cursor: pointer;
  }

  .win-btn-primary {
    background: #2563eb;
    border: 1px solid #3b82f6;
    color: #ffffff;
  }

  .win-btn-secondary, .win-btn-small {
    background: #334155;
    border: 1px solid #475569;
    color: #e2e8f0;
  }

  .win-btn-primary:hover { background: #1d4ed8; }
  .win-btn-secondary:hover, .win-btn-small:hover { background: #475569; }
</style>
