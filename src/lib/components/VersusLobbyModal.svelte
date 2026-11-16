<!-- Versus Lobby Modal: Host or Join a 4-Letter Code Room (P2P WebRTC) -->
<script>
  import { onMount } from 'svelte';
  import Icon from '@iconify/svelte';
  import { PeerManager, generateRoomCode, generatePlayerId } from '#lib/multiplayer/peerManager.js';
  import { VersusHostEngine } from '#lib/multiplayer/versusHostEngine.js';
  import { playClick, playWrong } from '#lib/audio/soundFx.js';

  let {
    isOpen = false,
    allTopics = [],
    onClose = () => {},
    onStartVersus = () => {}
  } = $props();

  // Mode: 'select' | 'host' | 'join' | 'lobby'
  let lobbyTab = $state('host'); // 'host' or 'join'
  let isConnecting = $state(false);
  let errorMessage = $state('');

  // Player identity
  let nickname = $state('');
  let playerId = $state('');

  // Host configuration
  let roomCode = $state('');
  let questionCount = $state(10);
  let timeLimitSeconds = $state(20);
  let selectedTopics = $state([]);

  // Connected state
  let isHost = $state(false);
  let peerManager = $state(null);
  let hostEngine = $state(null);
  let playersList = $state([]); // [{ id, nickname, isConnected, isHost }]
  let isInLobby = $state(false);

  // Question count options
  const questionCountOptions = [5, 10, 15, 20, 25, 30, 50, 'All'];
  const timeLimitOptions = [10, 15, 20, 30];

  onMount(() => {
    // Load saved nickname or default
    if (typeof localStorage !== 'undefined') {
      nickname = localStorage.getItem('mosq_player_name') || `Player_${Math.floor(100 + Math.random() * 900)}`;
      playerId = localStorage.getItem('mosq_player_id') || generatePlayerId();
      localStorage.setItem('mosq_player_id', playerId);
    } else {
      playerId = generatePlayerId();
      nickname = `Player_${Math.floor(100 + Math.random() * 900)}`;
    }

    selectedTopics = [...allTopics];
    roomCode = generateRoomCode();

    // Check for existing session in sessionStorage to allow seamless reconnection if tab was reloaded
    if (typeof sessionStorage !== 'undefined') {
      const saved = sessionStorage.getItem('mosq_vs_session');
      if (saved) {
        try {
          const session = JSON.parse(saved);
          if (session && session.roomCode) {
            console.log('[VersusLobby] Found saved session:', session);
          }
        } catch (e) {}
      }
    }
  });

  // Watch allTopics to initialize selectedTopics if empty
  $effect(() => {
    if (selectedTopics.length === 0 && allTopics.length > 0) {
      selectedTopics = [...allTopics];
    }
  });

  function toggleTopic(topic) {
    playClick();
    if (selectedTopics.includes(topic)) {
      if (selectedTopics.length > 1) {
        selectedTopics = selectedTopics.filter(t => t !== topic);
      }
    } else {
      selectedTopics = [...selectedTopics, topic];
    }
  }

  function selectAllTopics() {
    playClick();
    selectedTopics = [...allTopics];
  }

  function handleSaveNickname() {
    if (typeof localStorage !== 'undefined' && nickname.trim()) {
      localStorage.setItem('mosq_player_name', nickname.trim());
    }
  }

  // --- HOST A GAME ---
  async function handleCreateRoom() {
    if (!nickname.trim()) {
      errorMessage = 'Please enter a nickname.';
      playWrong();
      return;
    }
    handleSaveNickname();

    isConnecting = true;
    errorMessage = '';
    isHost = true;

    // Pick room code
    const code = (roomCode.trim() || generateRoomCode()).toUpperCase();
    roomCode = code;

    const pm = new PeerManager({
      onMessage: (data, senderId) => {
        if (!data) return;
        if (data.type === 'SUBMIT_ANSWER' && hostEngine) {
          hostEngine.handlePlayerAnswer(senderId, data.payload?.optionIndex);
        }
      },
      onPlayerConnected: ({ playerId: pId, nickname: pNick }) => {
        if (hostEngine) {
          hostEngine.addClientPlayer(pId, pNick);
        }
      },
      onPlayerDisconnected: (pId) => {
        if (hostEngine) {
          hostEngine.removePlayer(pId);
        }
      },
      onError: (err) => {
        console.error('[Host Peer Error]:', err);
        if (err.message === 'ROOM_CODE_TAKEN') {
          errorMessage = `Room code "${code}" is already in use. Generating a new one...`;
          roomCode = generateRoomCode();
        } else {
          errorMessage = 'Network connection error: ' + (err.message || 'Check internet connection');
        }
        isConnecting = false;
        playWrong();
      }
    });

    try {
      await pm.createRoom(code, nickname, playerId);
      peerManager = pm;

      // Initialize Host Game Engine
      const engine = new VersusHostEngine({
        peerManager: pm,
        onStateChange: (statePayload) => {
          if (statePayload.players) {
            playersList = statePayload.players;
          }
          if (statePayload.state === 'question' && isInLobby) {
            // Match has started!
            launchVersusMatch(statePayload);
          }
        }
      });

      const actualQCount = questionCount === 'All' ? 999 : questionCount;
      engine.updateConfig({
        questionCount: actualQCount,
        timeLimitSeconds,
        selectedTopics
      });

      engine.addHostPlayer(playerId, nickname);
      hostEngine = engine;

      isInLobby = true;
      isConnecting = false;

      // Save session
      saveSession({ roomCode: code, isHost: true, playerId, nickname });
    } catch (e) {
      console.error('[Host Init Failed]:', e);
      errorMessage = 'Could not create room: ' + e.message;
      isConnecting = false;
      playWrong();
      if (pm) pm.destroy();
    }
  }

  // --- JOIN A GAME ---
  async function handleJoinRoom() {
    if (!nickname.trim()) {
      errorMessage = 'Please enter a nickname.';
      playWrong();
      return;
    }
    if (!roomCode.trim() || roomCode.trim().length !== 4) {
      errorMessage = 'Room code must be exactly 4 letters.';
      playWrong();
      return;
    }
    handleSaveNickname();

    isConnecting = true;
    errorMessage = '';
    isHost = false;

    const code = roomCode.trim().toUpperCase();

    const pm = new PeerManager({
      onMessage: (data) => {
        if (!data) return;
        if (data.type === 'LOBBY_UPDATE') {
          playersList = data.payload?.players || [];
        } else if (data.type === 'QUESTION_START') {
          // Game has started!
          launchVersusMatch(data.payload);
        } else if (data.type === 'ERROR') {
          errorMessage = data.payload?.message || 'Error from host.';
          playWrong();
        }
      },
      onPlayerDisconnected: (who) => {
        if (who === 'host') {
          errorMessage = 'Host has disconnected.';
          isInLobby = false;
          playWrong();
        }
      },
      onError: (err) => {
        console.error('[Client Join Error]:', err);
        errorMessage = 'Could not connect to room. Check code or ensure host is online.';
        isConnecting = false;
        playWrong();
      }
    });

    try {
      await pm.joinRoom(code, nickname, playerId);
      peerManager = pm;
      isInLobby = true;
      isConnecting = false;

      // Save session
      saveSession({ roomCode: code, isHost: false, playerId, nickname });
    } catch (e) {
      console.error('[Client Join Failed]:', e);
      errorMessage = 'Failed to connect: ' + (e.message || 'Room not found.');
      isConnecting = false;
      playWrong();
      if (pm) pm.destroy();
    }
  }

  // Start the match (Host only)
  function handleHostStartMatch() {
    if (!isHost || !hostEngine) return;
    playClick();

    const actualQCount = questionCount === 'All' ? 999 : questionCount;
    hostEngine.updateConfig({
      questionCount: actualQCount,
      timeLimitSeconds,
      selectedTopics
    });

    hostEngine.startGame();
  }

  function launchVersusMatch(initialPayload) {
    onStartVersus({
      isHost,
      peerManager,
      hostEngine,
      roomCode: roomCode.toUpperCase(),
      playerId,
      nickname,
      initialPayload,
      playersList
    });
    onClose();
  }

  function saveSession(data) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('mosq_vs_session', JSON.stringify(data));
    }
  }

  function handleCancelLobby() {
    playClick();
    if (peerManager) {
      peerManager.destroy();
      peerManager = null;
    }
    if (hostEngine) {
      hostEngine.destroy();
      hostEngine = null;
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('mosq_vs_session');
    }
    isInLobby = false;
    isConnecting = false;
    errorMessage = '';
  }

  function handleModalClose() {
    handleCancelLobby();
    onClose();
  }

  function copyCode() {
    playClick();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(roomCode.toUpperCase());
    }
  }
</script>

{#if isOpen}
  <div
    class="modal-backdrop"
    onclick={handleModalClose}
    onkeydown={(e) => { if (e.key === 'Escape') handleModalClose(); }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div
      class="modal-container"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="document"
      tabindex="0"
    >
      
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-title-box">
          <Icon icon="mdi:sword-cross" width="26" class="header-icon" />
          <h2 class="modal-title">VERSUS MODE (P2P MULTIPLAYER)</h2>
        </div>
        <button class="btn-close" onclick={handleModalClose} aria-label="Close">
          <Icon icon="mdi:close" width="22" />
        </button>
      </div>

      <!-- Error Banner -->
      {#if errorMessage}
        <div class="error-banner">
          <Icon icon="mdi:alert-circle" width="18" />
          <span>{errorMessage}</span>
        </div>
      {/if}

      <!-- Screen 1: NOT IN LOBBY YET (Host or Join Setup) -->
      {#if !isInLobby}
        <!-- Tab Selector: Host vs Join -->
        <div class="lobby-tabs">
          <button
            class="tab-btn {lobbyTab === 'host' ? 'active' : ''}"
            onclick={() => { playClick(); lobbyTab = 'host'; errorMessage = ''; }}
          >
            <Icon icon="mdi:crown" width="18" />
            <span>HOST A ROOM</span>
          </button>
          <button
            class="tab-btn {lobbyTab === 'join' ? 'active' : ''}"
            onclick={() => { playClick(); lobbyTab = 'join'; errorMessage = ''; }}
          >
            <Icon icon="mdi:account-multiple-plus" width="18" />
            <span>JOIN A ROOM</span>
          </button>
        </div>

        <div class="modal-body">
          <!-- Nickname input (shared) -->
          <div class="form-group">
            <label class="form-label" for="player-nick">
              <Icon icon="mdi:account" width="16" />
              <span>Your Player Nickname:</span>
            </label>
            <input
              id="player-nick"
              type="text"
              class="text-input"
              bind:value={nickname}
              maxlength="16"
              placeholder="e.g. CMOS_Master"
            />
          </div>

          {#if lobbyTab === 'host'}
            <!-- HOST CONFIGURATION -->
            <div class="form-group">
              <label class="form-label" for="room-code-input">
                <Icon icon="mdi:key" width="16" />
                <span>Room Code (4 Letters):</span>
              </label>
              <div class="code-input-row">
                <input
                  id="room-code-input"
                  type="text"
                  class="code-input"
                  bind:value={roomCode}
                  maxlength="4"
                  placeholder="CODE"
                  style="text-transform: uppercase;"
                />
                <button
                  type="button"
                  class="btn-rand-code"
                  onclick={() => { playClick(); roomCode = generateRoomCode(); }}
                  title="Generate Random Code"
                >
                  <Icon icon="mdi:dice-5" width="20" />
                  <span>Random</span>
                </button>
              </div>
            </div>

            <!-- Question Count -->
            <div class="form-group">
              <label class="form-label">
                <Icon icon="mdi:format-list-numbered" width="16" />
                <span>Number of Questions:</span>
              </label>
              <div class="chips-row">
                {#each questionCountOptions as count}
                  <button
                    type="button"
                    class="chip-btn {questionCount === count ? 'selected' : ''}"
                    onclick={() => { playClick(); questionCount = count; }}
                  >
                    {count}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Time Limit -->
            <div class="form-group">
              <label class="form-label">
                <Icon icon="mdi:timer-outline" width="16" />
                <span>Time per Question:</span>
              </label>
              <div class="chips-row">
                {#each timeLimitOptions as secs}
                  <button
                    type="button"
                    class="chip-btn {timeLimitSeconds === secs ? 'selected' : ''}"
                    onclick={() => { playClick(); timeLimitSeconds = secs; }}
                  >
                    {secs}s
                  </button>
                {/each}
              </div>
            </div>

            <!-- Topics Selector -->
            <div class="form-group">
              <div class="label-with-action">
                <label class="form-label">
                  <Icon icon="mdi:book-open-page-variant" width="16" />
                  <span>Exam Topics ({selectedTopics.length}/{allTopics.length}):</span>
                </label>
                <button type="button" class="btn-text-action" onclick={selectAllTopics}>
                  Select All
                </button>
              </div>
              <div class="topics-grid">
                {#each allTopics as topic}
                  <button
                    type="button"
                    class="topic-toggle {selectedTopics.includes(topic) ? 'checked' : ''}"
                    onclick={() => toggleTopic(topic)}
                  >
                    <span class="topic-check">{selectedTopics.includes(topic) ? '✓' : ''}</span>
                    <span class="topic-title">{topic}</span>
                  </button>
                {/each}
              </div>
            </div>

            <div class="modal-footer">
              <button
                class="btn-primary-action"
                disabled={isConnecting}
                onclick={handleCreateRoom}
              >
                {#if isConnecting}
                  <Icon icon="mdi:loading" class="spin" width="20" />
                  <span>CREATING ROOM...</span>
                {:else}
                  <Icon icon="mdi:check-bold" width="20" />
                  <span>CREATE ROOM & HOST</span>
                {/if}
              </button>
            </div>

          {:else}
            <!-- JOIN ROOM CONFIGURATION -->
            <div class="form-group">
              <label class="form-label" for="join-code">
                <Icon icon="mdi:key" width="16" />
                <span>Enter 4-Letter Room Code:</span>
              </label>
              <input
                id="join-code"
                type="text"
                class="code-input large"
                bind:value={roomCode}
                maxlength="4"
                placeholder="ABCD"
                style="text-transform: uppercase;"
                oninput={(e) => { roomCode = e.target.value.toUpperCase(); }}
              />
              <p class="field-hint">Ask the host for their 4-letter room code.</p>
            </div>

            <div class="modal-footer">
              <button
                class="btn-primary-action"
                disabled={isConnecting || roomCode.trim().length !== 4}
                onclick={handleJoinRoom}
              >
                {#if isConnecting}
                  <Icon icon="mdi:loading" class="spin" width="20" />
                  <span>CONNECTING...</span>
                {:else}
                  <Icon icon="mdi:login" width="20" />
                  <span>JOIN ROOM</span>
                {/if}
              </button>
            </div>
          {/if}
        </div>

      {:else}
        <!-- Screen 2: IN WAITING LOBBY -->
        <div class="lobby-room-stage">
          <!-- Room Code Card -->
          <div class="room-code-card">
            <span class="room-code-label">ROOM CODE:</span>
            <div class="room-code-display-row">
              <span class="huge-code">{roomCode}</span>
              <button class="btn-copy-code" onclick={copyCode} title="Copy Code">
                <Icon icon="mdi:content-copy" width="20" />
              </button>
            </div>
            <p class="room-code-hint">Tell players to enter this 4-letter code on their phone!</p>
          </div>

          <!-- Players Roster -->
          <div class="players-roster-box">
            <div class="roster-header">
              <div class="roster-title">
                <Icon icon="mdi:account-group" width="20" />
                <span>CONNECTED PLAYERS ({playersList.length}/12)</span>
              </div>
              <span class="live-pulse-badge">● LIVE P2P</span>
            </div>

            <div class="players-list-scroll">
              {#each playersList as p}
                <div class="player-tag-pill {p.id === playerId ? 'is-you' : ''}">
                  <Icon icon={p.isHost ? 'mdi:crown' : 'mdi:account'} width="18" class="player-icon {p.isHost ? 'crown-icon' : ''}" />
                  <span class="player-name">{p.nickname}</span>
                  {#if p.id === playerId}
                    <span class="badge-you">(You)</span>
                  {/if}
                  {#if p.isHost}
                    <span class="badge-host">HOST</span>
                  {/if}
                </div>
              {/each}
              {#if playersList.length === 0}
                <div class="waiting-prompt">
                  <Icon icon="mdi:loading" class="spin" width="24" />
                  <span>Waiting for players to join...</span>
                </div>
              {/if}
            </div>
          </div>

          <!-- Lobby Action Buttons -->
          <div class="lobby-footer">
            <button class="btn-cancel-lobby" onclick={handleCancelLobby}>
              <Icon icon="mdi:arrow-left" width="18" />
              <span>Leave Room</span>
            </button>

            {#if isHost}
              <button
                class="btn-start-match"
                disabled={playersList.length < 1}
                onclick={handleHostStartMatch}
              >
                <Icon icon="mdi:play" width="24" />
                <span>START MATCH NOW ({playersList.length})</span>
              </button>
            {:else}
              <div class="client-waiting-box">
                <Icon icon="mdi:clock-outline" width="20" class="spin" />
                <span>Waiting for host to start match...</span>
              </div>
            {/if}
          </div>
        </div>
      {/if}

    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(4, 9, 24, 0.88);
    backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .modal-container {
    width: 100%;
    max-width: 680px;
    max-height: 92vh;
    background: linear-gradient(180deg, #112046 0%, #09132b 100%);
    border: 2px solid #d4af37;
    border-radius: 18px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.9), 0 0 30px rgba(212, 175, 55, 0.35);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    user-select: none;
    font-family: 'Comic Sans MS', cursive, sans-serif;
  }

  /* Header */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    background: linear-gradient(180deg, #1b336e 0%, #12224d 100%);
    border-bottom: 2px solid #d4af37;
  }

  .header-title-box {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  :global(.header-icon) {
    color: #fce69a;
  }

  .modal-title {
    margin: 0;
    font-size: 19px;
    font-weight: bold;
    color: #fce69a;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
    letter-spacing: 0.5px;
  }

  .btn-close {
    background: transparent;
    border: none;
    color: #cbd5e1;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
  }

  .btn-close:hover {
    background: rgba(239, 68, 68, 0.25);
    color: #ef4444;
  }

  /* Error Banner */
  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(220, 38, 38, 0.25);
    border-left: 4px solid #ef4444;
    padding: 10px 16px;
    color: #fca5a5;
    font-size: 13px;
    font-weight: bold;
  }

  /* Tabs */
  .lobby-tabs {
    display: flex;
    background: #09132b;
    border-bottom: 1px solid rgba(212, 175, 55, 0.3);
  }

  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    border-bottom: 3px solid transparent;
    transition: all 0.2s;
  }

  .tab-btn.active {
    color: #fce69a;
    background: rgba(27, 51, 110, 0.4);
    border-bottom: 3px solid #d4af37;
  }

  /* Modal Body */
  .modal-body {
    padding: 18px 22px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: bold;
    color: #cbd5e1;
  }

  .label-with-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .btn-text-action {
    background: transparent;
    border: none;
    color: #fce69a;
    font-size: 12px;
    font-weight: bold;
    cursor: pointer;
    text-decoration: underline;
  }

  .text-input {
    background: #060c1d;
    border: 1px solid #3b82f6;
    border-radius: 8px;
    padding: 10px 14px;
    color: #ffffff;
    font-size: 15px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
  }

  .text-input:focus {
    border-color: #d4af37;
    box-shadow: 0 0 10px rgba(212, 175, 55, 0.4);
  }

  .code-input-row {
    display: flex;
    gap: 10px;
  }

  .code-input {
    background: #060c1d;
    border: 2px solid #d4af37;
    border-radius: 8px;
    padding: 10px 14px;
    color: #fce69a;
    font-size: 20px;
    font-weight: bold;
    letter-spacing: 4px;
    text-align: center;
    outline: none;
    flex: 1;
  }

  .code-input.large {
    font-size: 26px;
    padding: 14px;
    letter-spacing: 8px;
  }

  .btn-rand-code {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #19336d;
    border: 1px solid #d4af37;
    border-radius: 8px;
    color: #fce69a;
    font-weight: bold;
    padding: 0 16px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-rand-code:hover {
    background: #254999;
  }

  .field-hint {
    margin: 4px 0 0 0;
    font-size: 12px;
    color: #94a3b8;
  }

  .chips-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip-btn {
    background: #081126;
    border: 1px solid rgba(212, 175, 55, 0.4);
    border-radius: 6px;
    padding: 8px 16px;
    color: #cbd5e1;
    font-size: 13px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.15s;
  }

  .chip-btn.selected {
    background: linear-gradient(180deg, #d4af37 0%, #aa841e 100%);
    color: #060c1d;
    border-color: #fff3a8;
    box-shadow: 0 0 10px rgba(212, 175, 55, 0.6);
  }

  /* Topics Grid */
  .topics-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
    max-height: 180px;
    overflow-y: auto;
    background: #060c1d;
    border: 1px solid rgba(212, 175, 55, 0.3);
    border-radius: 8px;
    padding: 8px;
  }

  .topic-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #0c1836;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 8px 10px;
    cursor: pointer;
    text-align: left;
    color: #94a3b8;
    transition: all 0.15s;
  }

  .topic-toggle.checked {
    background: rgba(30, 64, 175, 0.35);
    border-color: #3b82f6;
    color: #ffffff;
  }

  .topic-check {
    width: 18px;
    height: 18px;
    border: 1px solid #d4af37;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
    color: #fce69a;
  }

  .topic-title {
    font-size: 12px;
    line-height: 1.3;
  }

  /* Modal Footer */
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }

  .btn-primary-action {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
    border: 2px solid #93c5fd;
    border-radius: 10px;
    color: #ffffff;
    font-size: 16px;
    font-weight: bold;
    padding: 14px;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(37, 99, 235, 0.5);
    transition: transform 0.15s, filter 0.15s;
  }

  .btn-primary-action:hover:not(:disabled) {
    transform: translateY(-2px);
    filter: brightness(1.1);
  }

  .btn-primary-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Screen 2: Waiting Lobby */
  .lobby-room-stage {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .room-code-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: linear-gradient(180deg, #182e66 0%, #0d1a3d 100%);
    border: 2px solid #d4af37;
    border-radius: 14px;
    padding: 16px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6);
  }

  .room-code-label {
    font-size: 12px;
    letter-spacing: 2px;
    color: #93c5fd;
    font-weight: bold;
  }

  .room-code-display-row {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 6px 0;
  }

  .huge-code {
    font-size: 42px;
    font-weight: bold;
    letter-spacing: 8px;
    color: #fce69a;
    text-shadow: 0 0 16px rgba(252, 230, 154, 0.7);
  }

  .btn-copy-code {
    background: #09132b;
    border: 1px solid #d4af37;
    border-radius: 8px;
    color: #fce69a;
    padding: 8px 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-copy-code:hover {
    background: #18336d;
  }

  .room-code-hint {
    margin: 4px 0 0 0;
    font-size: 13px;
    color: #cbd5e1;
    text-align: center;
  }

  /* Players Roster */
  .players-roster-box {
    background: #060c1d;
    border: 1px solid rgba(212, 175, 55, 0.4);
    border-radius: 12px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .roster-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 8px;
  }

  .roster-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: bold;
    color: #fce69a;
  }

  .live-pulse-badge {
    font-size: 11px;
    font-weight: bold;
    color: #4ade80;
    animation: livePulse 2s infinite ease-in-out;
  }

  @keyframes livePulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .players-list-scroll {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    min-height: 80px;
    max-height: 180px;
    overflow-y: auto;
    align-items: flex-start;
  }

  .player-tag-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #0f1c3f;
    border: 1px solid #3b82f6;
    border-radius: 20px;
    padding: 6px 14px;
    color: #ffffff;
    font-size: 13px;
    font-weight: bold;
  }

  .player-tag-pill.is-you {
    border-color: #d4af37;
    background: linear-gradient(180deg, #1b3570 0%, #102146 100%);
  }

  :global(.crown-icon) {
    color: #fce69a !important;
  }

  .badge-you {
    color: #fce69a;
    font-size: 11px;
  }

  .badge-host {
    background: #d4af37;
    color: #060c1d;
    font-size: 10px;
    font-weight: bold;
    padding: 1px 6px;
    border-radius: 10px;
  }

  .waiting-prompt {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: #94a3b8;
    font-size: 14px;
    padding: 20px 0;
  }

  /* Lobby Footer */
  .lobby-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .btn-cancel-lobby {
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: 1px solid #64748b;
    border-radius: 8px;
    color: #cbd5e1;
    padding: 12px 18px;
    font-size: 13px;
    font-weight: bold;
    cursor: pointer;
  }

  .btn-cancel-lobby:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
    color: #ef4444;
  }

  .btn-start-match {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: linear-gradient(180deg, #16a34a 0%, #15803d 100%);
    border: 2px solid #86efac;
    border-radius: 10px;
    color: #ffffff;
    font-size: 16px;
    font-weight: bold;
    padding: 14px;
    cursor: pointer;
    box-shadow: 0 4px 18px rgba(22, 163, 74, 0.6);
    transition: transform 0.15s;
  }

  .btn-start-match:hover {
    transform: translateY(-2px);
    filter: brightness(1.1);
  }

  .client-waiting-box {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: #0c1836;
    border: 1px dashed #d4af37;
    border-radius: 10px;
    padding: 14px;
    color: #fce69a;
    font-size: 14px;
    font-weight: bold;
  }

  :global(.spin) {
    animation: spin 1.2s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (max-width: 600px) {
    .modal-container {
      max-height: 98vh;
      border-radius: 12px;
    }
    .huge-code {
      font-size: 32px;
      letter-spacing: 5px;
    }
    .modal-body {
      padding: 12px 14px;
      gap: 12px;
    }
    .chips-row {
      gap: 6px;
    }
    .chip-btn {
      padding: 6px 10px;
      font-size: 12px;
    }
  }
</style>