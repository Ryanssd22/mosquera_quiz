// PeerJS WebRTC P2P Networking Layer for Mosquera Quiz Versus Mode
let PeerClass = null;

async function getPeer() {
  if (PeerClass) return PeerClass;
  if (typeof window === 'undefined') return null;
  const mod = await import('peerjs');
  PeerClass = mod.Peer || mod.default?.Peer || mod.default;
  return PeerClass;
}

const ROOM_PREFIX = 'mosq-vs-';

/**
 * Generate a random 4-letter room code (A-Z, unambiguous uppercase)
 */
export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude I, O to avoid confusion
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generate a unique player ID
 */
export function generatePlayerId() {
  return 'p_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
}

/**
 * PeerManager: Handles WebRTC Peer connections for both Host and Client
 */
export class PeerManager {
  constructor({ onMessage, onPlayerConnected, onPlayerDisconnected, onError, onOpen }) {
    this.peer = null;
    this.connections = new Map(); // playerId -> DataConnection (Host side)
    this.hostConnection = null; // DataConnection to host (Client side)
    this.isHost = false;
    this.roomCode = null;
    this.playerId = null;
    this.nickname = null;
    this.onMessage = onMessage || (() => {});
    this.onPlayerConnected = onPlayerConnected || (() => {});
    this.onPlayerDisconnected = onPlayerDisconnected || (() => {});
    this.onError = onError || (() => {});
    this.onOpen = onOpen || (() => {});
  }

  /**
   * Host initializes a new game room
   */
  async createRoom(requestedCode, nickname, playerId) {
    this.isHost = true;
    this.nickname = nickname;
    this.playerId = playerId || generatePlayerId();
    this.roomCode = (requestedCode || generateRoomCode()).toUpperCase();

    const peerId = `${ROOM_PREFIX}${this.roomCode.toLowerCase()}`;
    const Peer = await getPeer();
    if (!Peer) throw new Error('PeerJS cannot be loaded in server environment');

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer(peerId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });

        this.peer.on('open', (id) => {
          this.onOpen({ id, roomCode: this.roomCode });
          resolve(this.roomCode);
        });

        this.peer.on('connection', (conn) => {
          this._handleIncomingConnection(conn);
        });

        this.peer.on('error', (err) => {
          console.error('[PeerManager Host Error]:', err);
          this.onError(err);
          // If ID is already taken, reject so caller can retry with another code
          if (err.type === 'unavailable-id') {
            reject(new Error('ROOM_CODE_TAKEN'));
          } else {
            reject(err);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Host handles client connection
   */
  _handleIncomingConnection(conn) {
    conn.on('open', () => {
      // Wait for player identification handshake
    });

    conn.on('data', (data) => {
      if (data && data.type === 'HANDSHAKE') {
        const { playerId, nickname } = data.payload;
        conn.metadata = { playerId, nickname };
        this.connections.set(playerId, conn);
        this.onPlayerConnected({ playerId, nickname });
      } else {
        this.onMessage(data, conn.metadata?.playerId);
      }
    });

    conn.on('close', () => {
      if (conn.metadata?.playerId) {
        this.connections.delete(conn.metadata.playerId);
        this.onPlayerDisconnected(conn.metadata.playerId);
      }
    });

    conn.on('error', (err) => {
      console.warn('[PeerManager Connection Error]:', err);
    });
  }

  /**
   * Client joins an existing room by 4-letter code
   */
  async joinRoom(roomCode, nickname, playerId) {
    this.isHost = false;
    this.roomCode = roomCode.toUpperCase().trim();
    this.nickname = nickname.trim();
    this.playerId = playerId || generatePlayerId();

    const hostPeerId = `${ROOM_PREFIX}${this.roomCode.toLowerCase()}`;
    const Peer = await getPeer();
    if (!Peer) throw new Error('PeerJS cannot be loaded in server environment');

    return new Promise((resolve, reject) => {
      try {
        // Client gets a random peer ID
        this.peer = new Peer({
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });

        this.peer.on('open', () => {
          const conn = this.peer.connect(hostPeerId, {
            reliable: true,
            metadata: { playerId: this.playerId, nickname: this.nickname }
          });

          this.hostConnection = conn;

          conn.on('open', () => {
            // Send handshake
            conn.send({
              type: 'HANDSHAKE',
              payload: { playerId: this.playerId, nickname: this.nickname }
            });
            this.onOpen({ roomCode: this.roomCode });
            resolve(this.roomCode);
          });

          conn.on('data', (data) => {
            this.onMessage(data);
          });

          conn.on('close', () => {
            this.onPlayerDisconnected('host');
          });

          conn.on('error', (err) => {
            console.error('[Client Conn Error]:', err);
            reject(err);
          });
        });

        this.peer.on('error', (err) => {
          console.error('[PeerManager Client Peer Error]:', err);
          this.onError(err);
          reject(err);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Broadcast message to all connected players (Host only)
   */
  broadcast(msg) {
    if (!this.isHost) return;
    for (const conn of this.connections.values()) {
      if (conn.open) {
        try {
          conn.send(msg);
        } catch (e) {
          console.warn('[Broadcast Error]:', e);
        }
      }
    }
  }

  /**
   * Send message to a specific player (Host only)
   */
  sendTo(playerId, msg) {
    if (!this.isHost) return;
    const conn = this.connections.get(playerId);
    if (conn && conn.open) {
      try {
        conn.send(msg);
      } catch (e) {
        console.warn('[SendTo Error]:', e);
      }
    }
  }

  /**
   * Send message to the host (Client only)
   */
  sendToHost(msg) {
    if (this.isHost) {
      // Local host processing
      this.onMessage(msg, this.playerId);
      return;
    }
    if (this.hostConnection && this.hostConnection.open) {
      try {
        this.hostConnection.send(msg);
      } catch (e) {
        console.warn('[SendToHost Error]:', e);
      }
    }
  }

  /**
   * Clean up and destroy peer connection
   */
  destroy() {
    try {
      if (this.hostConnection) {
        this.hostConnection.close();
      }
      for (const conn of this.connections.values()) {
        conn.close();
      }
      this.connections.clear();
      if (this.peer) {
        this.peer.destroy();
      }
    } catch (e) {
      console.warn('[Peer Destroy Error]:', e);
    }
  }
}
