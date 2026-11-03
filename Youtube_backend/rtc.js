import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { env } from './config/env.js';

const rooms = new Map(); // roomId -> MeetingRoom
const wss = new WebSocketServer({ noServer: true });

export const MAX_CALL_PARTICIPANTS = 5;

class MeetingRoom {
  constructor(id) {
    this.id = id;
    this.participants = new Map();
    this.locked = false;
    this.hostId = null;
    this.createdAt = Date.now();
  }

  get size() {
    return this.participants.size;
  }

  get host() {
    return this.participants.get(this.hostId) || null;
  }
}

function getRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    room = new MeetingRoom(roomId);
    rooms.set(roomId, room);
  }
  return room;
}

function removeParticipant(meeting, participant) {
  if (!participant) return;
  try {
    participant.socket.close(1000, 'left');
  } catch {
    // Ignore close errors.
  }
  meeting.participants.delete(participant.id);
}

function broadcast(meeting, payload, exceptSocket = null) {
  const message = JSON.stringify(payload);
  for (const participant of meeting.participants.values()) {
    if (participant.socket === exceptSocket) continue;
    if (participant.socket.readyState !== 1) continue;
    try {
      participant.socket.send(message);
    } catch {
      // Ignore send errors.
    }
  }
}

function sendTo(socket, payload) {
  if (socket.readyState !== 1) return;
  try {
    socket.send(JSON.stringify(payload));
  } catch {
    // Ignore send errors.
  }
}

function participantView(p) {
  if (!p) return null;
  return {
    id: p.id,
    userId: p.userId,
    name: p.name,
    isHost: Boolean(p.isHost),
    mic: Boolean(p.mic),
    cam: Boolean(p.cam),
    screen: Boolean(p.screen),
    hand: Boolean(p.hand),
    speaking: Boolean(p.speaking),
    quality: Number(p.quality || 0),
    connected: Boolean(p.connected)
  };
}

function listParticipants(meeting) {
  return Array.from(meeting.participants.values()).map((p) => participantView(p));
}

function clearMeeting(roomId) {
  const meeting = rooms.get(roomId);
  if (!meeting) return;
  for (const participant of meeting.participants.values()) {
    try {
      participant.socket.close(1012, 'room-ended');
    } catch {
      // Ignore close errors.
    }
  }
  rooms.delete(roomId);
}

function verifyUserId(token) {
  try {
    const payload = jwt.verify(String(token || ''), env.jwtSecret);
    const userId = String(payload.sub || payload.id || '');
    return userId || null;
  } catch {
    return null;
  }
}

function handleMessage(socket, participant, raw) {
  let payload;
  try {
    payload = JSON.parse(String(raw));
  } catch {
    return sendTo(socket, { t: 'error', message: 'Invalid signaling payload.' });
  }

  const meeting = participant.meeting;

  if (payload.t === 'join') {
    if (meeting.locked && participant.isHost !== true) {
      return sendTo(socket, { t: 'error', message: 'This meeting has been locked by the host.' });
    }
    if (meeting.participants.size >= MAX_CALL_PARTICIPANTS) {
      return sendTo(socket, { t: 'error', message: 'This meeting has reached the maximum number of participants.' });
    }
    if (!meeting.participants.has(participant.id)) {
      meeting.participants.set(participant.id, participant);
      if (!meeting.hostId) {
        meeting.hostId = participant.id;
        participant.isHost = true;
      }
    }
    participant.connected = true;
    participant.roomId = meeting.id;

    sendTo(socket, {
      t: 'joined',
      roomId: meeting.id,
      participants: listParticipants(meeting),
      you: {
        id: participant.id,
        isHost: participant.isHost,
        locked: meeting.locked,
        permissions: { ...(participant.permissions || {}) }
      }
    });
    broadcast(meeting, { t: 'peer-joined', participant: participantView(participant) }, socket);
    return;
  }

  if (payload.t === 'signal') {
    const target = meeting.participants.get(String(payload.to || ''));
    if (!target || target.socket !== socket) {
      return sendTo(socket, { t: 'error', message: 'Peer not found in this meeting.' });
    }
    broadcast(meeting, { t: 'signal', from: participant.id, data: payload.data || {} });
    return;
  }

  if (payload.t === 'state') {
    const next = {
      mic: payload.mic === undefined ? participant.mic : Boolean(payload.mic),
      cam: payload.cam === undefined ? participant.cam : Boolean(payload.cam),
      screen: payload.screen === undefined ? participant.screen : Boolean(payload.screen),
      hand: payload.hand === undefined ? participant.hand : Boolean(payload.hand),
      speaking: Boolean(payload.speaking),
      quality: Number.isFinite(Number(payload.quality)) ? Number(payload.quality) : participant.quality
    };
    participant.mic = next.mic;
    participant.cam = next.cam;
    participant.screen = next.screen;
    participant.hand = next.hand;
    participant.speaking = next.speaking;
    participant.quality = next.quality;
    broadcast(meeting, { t: 'state', from: participant.id, ...next });
    return;
  }

  if (payload.t === 'chat') {
    const text = String(payload.text || '').trim();
    const emoji = Boolean(payload.emoji);
    const file = payload.file ? String(payload.file) : null;
    if (!text && !emoji && !file) return;
    const message = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from: participant.id,
      fromName: participant.name,
      text,
      emoji,
      file: file || undefined,
      ts: new Date().toISOString()
    };
    broadcast(meeting, { t: 'chat', message });
    return;
  }

  if (payload.t === 'host') {
    const action = String(payload.action || '');
    const targetId = payload.targetId ? String(payload.targetId) : null;

    if (action === 'end') {
      clearMeeting(meeting.id);
      return;
    }

    if (action === 'lock') {
      meeting.locked = Boolean(payload.locked);
      broadcast(meeting, { t: 'locked', locked: meeting.locked });
      return;
    }

    if (action === 'cohost' && targetId) {
      const target = meeting.participants.get(targetId);
      if (target) {
        const wasHost = participant.isHost;
        participant.isHost = false;
        meeting.hostId = targetId;
        target.isHost = true;
        broadcast(meeting, { t: 'host', action: 'cohost', targetId, isHost: true });
        if (wasHost) broadcast(meeting, { t: 'host', action: 'cohost', targetId, isHost: false });
      }
      return;
    }

    if (action === 'permissions' && targetId) {
      const target = meeting.participants.get(targetId);
      if (target) {
        target.permissions = { ...(target.permissions || {}), ...(payload.permissions || {}) };
        broadcast(meeting, { t: 'host', action: 'permissions', targetId, permissions: target.permissions });
      }
      return;
    }

    if (action === 'mute' && targetId) {
      const target = meeting.participants.get(targetId);
      if (target) {
        target.mic = false;
        broadcast(meeting, { t: 'state', from: targetId, mic: false, cam: target.cam, screen: target.screen, hand: target.hand, speaking: false, quality: target.quality });
      }
      return;
    }

    if (action === 'remove' && targetId) {
      removeParticipant(meeting, meeting.participants.get(targetId));
      broadcast(meeting, { t: 'peer-left', id: targetId });
      return;
    }

    return sendTo(socket, { t: 'error', message: `Unsupported host action: ${action}` });
  }
}

export function attachRtc(httpServer) {
  wss.on('connection', (socket, req) => {
    let participant = null;
    const url = new URL(req.url || '', 'http://localhost');
    const token = url.searchParams.get('token') || '';
    const roomId = url.searchParams.get('room') || url.searchParams.get('roomId') || '';
    const userId = verifyUserId(token);

    const sendError = (message) => sendTo(socket, { t: 'error', message });

    if (!userId) {
      sendError('Unauthorized.');
      socket.close(4001, 'unauthorized');
      return;
    }

    const meeting = getRoom(roomId);
    participant = {
      id: `u-${userId}`,
      meeting,
      userId,
      name: `User ${String(userId).slice(-6)}`,
      isHost: false,
      locked: false,
      permissions: { canMute: true, canScreenShare: true, canChat: true },
      mic: true,
      cam: true,
      screen: false,
      hand: false,
      speaking: false,
      quality: 0,
      connected: true,
      joinedAt: Date.now()
    };
    if (meeting.participants.size === 0) {
      meeting.hostId = participant.id;
      participant.isHost = true;
    }
    participant.socket = socket;
    meeting.participants.set(participant.id, participant);

    socket.on('message', (data) => {
      try {
        handleMessage(socket, participant, data);
      } catch {
        sendError('Failed to process signaling message.');
      }
    });
    socket.on('close', () => {
      const current = meeting.participants.get(participant.id);
      if (current) {
        meeting.participants.delete(participant.id);
        if (meeting.participants.size === 0) rooms.delete(meeting.id);
        else broadcast(meeting, { t: 'peer-left', id: participant.id });
      }
    });
    socket.on('error', () => {
      // Ignore socket errors; close handler cleans up.
    });

    sendTo(socket, {
      t: 'joined',
      roomId: meeting.id,
      participants: listParticipants(meeting),
      you: {
        id: participant.id,
        isHost: participant.isHost,
        locked: meeting.locked,
        permissions: { ...(participant.permissions || {}) }
      }
    });
    broadcast(meeting, { t: 'peer-joined', participant: participantView(participant) }, socket);
  });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '', 'http://localhost');
    if (url.pathname !== '/rtc') return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  return () => {
    wss.close();
    rooms.clear();
  };
}
