import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Mic, MicOff, Share2, Video, VideoOff, MonitorUp, PhoneOff, Hand, Users, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { TOKEN_KEY } from '../lib/api.js';
import {
  addIceCandidate,
  addRemoteCandidate,
  closeAllCallPeers,
  closePeer,
  createAnswer,
  createCallPeer,
  createOffer,
  getCallStats,
  replaceTrack,
  startSpeakingMonitor,
  cleanupSpeakingMonitor
} from '../lib/rtc.js';
import CallParticipantTile from '../components/CallParticipantTile.jsx';
import CallControls from '../components/CallControls.jsx';
import CallChat from '../components/CallChat.jsx';
import Modal from '../components/Modal.jsx';

function getMediaErrorMessage(error) {
  const name = String(error?.name || '');
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Microphone or camera permission was denied. Please allow access in your browser and retry.';
  }
  if (name === 'NotFoundError') {
    return 'No camera or microphone was found on this device.';
  }
  if (name === 'NotReadableError') {
    return 'Your camera or microphone is already in use by another application.';
  }
  return 'Failed to access camera/microphone. Please check permissions and try again.';
}

export default function CallPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paramRoom = String(searchParams.get('room') || '');
  const [generatedRoom] = useState(() => Math.random().toString(36).slice(2, 8).toUpperCase());
  const roomId = paramRoom || generatedRoom;
  const { user } = useAuth();
  const toast = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const inviteUrl = `${window.location.origin}/call?room=${encodeURIComponent(roomId)}`;

  useEffect(() => {
    if (paramRoom) return;
    navigate(`/call?room=${generatedRoom}`, { replace: true });
  }, [generatedRoom, navigate, paramRoom]);

  const token = useRef('');
  try {
    token.current = localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    token.current = '';
  }

  const [phase, setPhase] = useState('joining');
  const [error, setError] = useState('');
  const [participants, setParticipants] = useState([]);
  const [self, setSelf] = useState({ id: '', isHost: false, locked: false, permissions: {} });
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [callSeconds, setCallSeconds] = useState(0);
  const [speaking, setSpeaking] = useState({});
  const [qualities, setQualities] = useState({});
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef(null);

  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const pcsRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const socketRef = useRef(null);
  const localSpeakingRef = useRef(false);
  const micOnRef = useRef(true);
  const camOnRef = useRef(true);
  const screenOnRef = useRef(false);
  const handRef = useRef(false);
  const selfQualityRef = useRef(0);
  const durationTimerRef = useRef(null);
  const statsTimerRef = useRef(null);
  const callCleanupRef = useRef(() => {});

  const [streams, setStreams] = useState({});

  const sendState = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(
        JSON.stringify({
          t: 'state',
          mic: micOnRef.current,
          cam: camOnRef.current,
          screen: screenOnRef.current,
          hand: handRef.current,
          speaking: localSpeakingRef.current,
          quality: selfQualityRef.current
        })
      );
    } catch {
      // Ignore send errors.
    }
  }, []);

  const sendSignal = useCallback((to, data) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ t: 'signal', to, data }));
  }, []);

  const sendHostAction = useCallback((action, targetId, extra = {}) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ t: 'host', action, targetId: targetId || undefined, ...extra }));
  }, []);

  const sendChat = useCallback((payload) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ t: 'chat', ...payload }));
  }, []);

  async function copyText(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch {
      toast.error('Could not copy automatically. Select the text and copy it manually.');
    }
  }

  async function shareInviteLink() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my video call',
          text: `Join my video call on YouTube. Room: ${roomId}`,
          url: inviteUrl
        });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    await copyText(inviteUrl, 'Call invite link copied.');
  }

  const setupPeer = useCallback(
    async (participant, isInitiatorOverride) => {
      const peerId = participant?.id;
      if (!peerId || peerId === self.id) return;
      const existing = pcsRef.current.get(peerId);
      if (existing) return;
      const pc = createCallPeer({
        peerId,
        localStream: localStreamRef.current,
        isInitiator: isInitiatorOverride ?? self.isHost,
        onTrack: (event) => {
          const stream = event.streams?.[0];
          if (stream) {
            remoteStreamsRef.current.set(peerId, stream);
            setStreams((current) => ({ ...current, [peerId]: stream }));
          }
        },
        onIce: (candidate) => {
          void addRemoteCandidate(peerId, candidate);
        },
        onStateChange: () => {}
      });
      pcsRef.current.set(peerId, pc);
      if (isInitiatorOverride ?? self.isHost) {
        const offer = await createOffer(peerId, localStreamRef.current, null, null);
        if (offer) sendSignal(peerId, offer);
      }
    },
    [self.id, self.isHost, sendSignal]
  );

  const selfRef = useRef(self);
  selfRef.current = self;

  const handleMessage = useCallback(
    (event) => {
      let msg;
      try {
        msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data || '{}');
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;

      if (msg.t === 'joined') {
        setParticipants(Array.isArray(msg.participants) ? msg.participants : []);
        setSelf({
          id: msg.you?.id || '',
          isHost: Boolean(msg.you?.isHost),
          locked: Boolean(msg.you?.locked),
          permissions: msg.you?.permissions || {}
        });
        for (const participant of Array.isArray(msg.participants) ? msg.participants : []) {
          if (participant.id === msg.you?.id) continue;
          void setupPeer(participant, participant.id !== selfRef.current.id && !selfRef.current.isHost);
        }
        setPhase('ready');
        return;
      }

      if (msg.t === 'peer-joined') {
        setParticipants((current) => {
          const next = current.filter((item) => item.id !== msg.participant?.id);
          return next.concat([msg.participant].filter(Boolean));
        });
        if (msg.participant?.id) void setupPeer(msg.participant, !selfRef.current.isHost);
        return;
      }

      if (msg.t === 'peer-left') {
        setParticipants((current) => current.filter((item) => item.id !== msg.id));
        closePeer(msg.id);
        remoteStreamsRef.current.delete(msg.id);
        setStreams((current) => {
          const next = { ...current };
          delete next[msg.id];
          return next;
        });
        return;
      }

      if (msg.t === 'signal') {
        const from = String(msg.from || '');
        const data = msg.data || {};
        if (from === selfRef.current.id) return;
        if (data.sdp && data.type) {
          const entry = pcsRef.current.get(from);
          if (!entry) return;
          void (async () => {
            try {
              await entry.pc.setRemoteDescription({ sdp: data.sdp, type: data.type });
              const answer = await entry.pc.createAnswer();
              await entry.pc.setLocalDescription(answer);
              sendSignal(from, { sdp: answer.sdp, type: answer.type });
            } catch {
              // Ignore negotiation errors.
            }
          })();
          return;
        }
        if (data.candidate) {
          void addRemoteCandidate(from, data.candidate);
        }
        return;
      }

      if (msg.t === 'state') {
        const from = String(msg.from || '');
        setParticipants((current) => current.map((item) => (item.id === from ? { ...item, ...msg } : item)));
        if (from === self.id) return;
        setSpeaking((current) => ({ ...current, [from]: Boolean(msg.speaking) }));
        return;
      }

      if (msg.t === 'chat') {
        if (msg.message) {
          setMessages((current) => [...current.slice(-199), msg.message]);
        }
        return;
      }

      if (msg.t === 'locked') {
        setSelf((current) => ({ ...current, locked: Boolean(msg.locked) }));
        return;
      }

      if (msg.t === 'error') {
        setError(String(msg.message || 'Call error.'));
        setPhase('error');
      }
    },
    [self.id, sendSignal, setupPeer]
  );

  const handleMessageRef = useRef(handleMessage);
  handleMessageRef.current = handleMessage;

  useEffect(() => {
    let disposed = false;

    const cleanup = () => {
      disposed = true;
      const socket = socketRef.current;
      if (socket) {
        try {
          socket.close();
        } catch {
          // Ignore.
        }
      }
      closeAllCallPeers();
      cleanupSpeakingMonitor('local');
      const stream = localStreamRef.current;
      stream?.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore.
        }
      });
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // Ignore.
          }
        });
        screenStreamRef.current = null;
      }
      clearInterval(durationTimerRef.current);
      clearInterval(statsTimerRef.current);
    };

    callCleanupRef.current = cleanup;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
        });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        micOnRef.current = true;
        camOnRef.current = true;
        setMicOn(true);
        setCamOn(true);
        setPhase('ready');
        startSpeakingMonitor(localStreamRef.current, (nextSpeaking) => {
          localSpeakingRef.current = nextSpeaking;
          setLocalSpeaking(nextSpeaking);
          sendState();
        });

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsBase = (import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.host}`).replace(/\/$/, '');
        const socket = new WebSocket(`${wsBase}/rtc?room=${encodeURIComponent(roomId)}&token=${encodeURIComponent(token.current)}`);
        socketRef.current = socket;
        socket.onopen = () => {
          socket.send(JSON.stringify({ t: 'join', roomId }));
        };
        socket.onmessage = (event) => {
          handleMessageRef.current(event);
        };
        socket.onclose = () => {
          if (!disposed) {
            setError('Connection to the call server was lost.');
            setPhase('error');
          }
        };
        socket.onerror = () => {
          if (!disposed) {
            setError('WebSocket connection failed.');
            setPhase('error');
          }
        };
      } catch (requestError) {
        if (!disposed) {
          setError(getMediaErrorMessage(requestError));
          setPhase('error');
        }
      }
    }

    if (roomId) {
      void init();
    } else {
      setError('No meeting room was specified.');
      setPhase('error');
    }

    return () => {
      disposed = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    if (phase !== 'ready') return undefined;
    durationTimerRef.current = window.setInterval(() => {
      setCallSeconds((value) => value + 1);
    }, 1000);
    statsTimerRef.current = window.setInterval(() => {
      for (const [peerId, entry] of pcsRef.current.entries()) {
        const stats = getCallStats(entry);
        selfQualityRef.current = stats.quality;
        setQualities((current) => ({ ...current, [peerId]: stats }));
        const socket = socketRef.current;
        if (socket && socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(
              JSON.stringify({
                t: 'state',
                mic: micOnRef.current,
                cam: camOnRef.current,
                screen: screenOnRef.current,
                hand: handRef.current,
                speaking: localSpeakingRef.current,
                quality: stats.quality
              })
            );
          } catch {
            // Ignore.
          }
        }
      }
    }, 3000);
    return () => {
      clearInterval(durationTimerRef.current);
      clearInterval(statsTimerRef.current);
    };
  }, [phase]);

  useEffect(
    () => () => {
      callCleanupRef.current();
    },
    []
  );

  const toggleMic = useCallback(() => {
    const next = !micOnRef.current;
    micOnRef.current = next;
    setMicOn(next);
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    sendState();
  }, [sendState]);

  const toggleCam = useCallback(() => {
    const next = !camOnRef.current;
    camOnRef.current = next;
    setCamOn(next);
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    sendState();
  }, [sendState]);

  const switchCamera = useCallback(async () => {
    if (screenOnRef.current) return;
    const facing = camOnRef.current ? 'user' : 'environment';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing } } });
      const track = stream.getVideoTracks()[0];
      if (track) {
        for (const [peerId, entry] of pcsRef.current.entries()) {
          const sender = entry.pc?.__sender;
          if (sender) void sender.replaceTrack(track);
        }
        stream.getTracks().forEach((item) => {
          if (item !== track) item.stop();
        });
      }
    } catch {
      // Ignore camera switch failures.
    }
  }, []);

  const shareScreen = useCallback(async () => {
    if (screenOnRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = stream;
      setScreenOn(true);
      screenOnRef.current = true;
      for (const [peerId, entry] of pcsRef.current.entries()) {
        const sender = entry.pc?.__sender;
        const track = stream.getVideoTracks()[0];
        if (sender && track) void sender.replaceTrack(track);
      }
      stream.getVideoTracks()[0]?.addEventListener?.('ended', () => {
        screenOnRef.current = false;
        setScreenOn(false);
        const local = localStreamRef.current;
        for (const [peerId, entry] of pcsRef.current.entries()) {
          const sender = entry.pc?.__sender;
          if (sender && local) void sender.replaceTrack(local.getVideoTracks()[0]);
        }
      });
    } catch {
      // User may have cancelled the picker.
    }
  }, []);

  const toggleHand = useCallback(() => {
    const next = !handRef.current;
    handRef.current = next;
    setHandRaised(next);
    sendState();
  }, [sendState]);

  const toggleRecording = useCallback(() => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    const stream = localStreamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') return;
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `youtube-call-${roomId}.webm`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    };
    recorderRef.current = recorder;
    recorder.start(1000);
    setRecording(true);
  }, [recording, roomId]);

  const sendChatMessage = useCallback(
    (text, isEmoji = false) => {
      const value = String(text || '').trim();
      if (!value) return;
      sendChat({ text: isEmoji ? '' : value, emoji: isEmoji });
      setDraft('');
    },
    [sendChat]
  );

  const sendChatFile = useCallback(
    async (dataUrl) => {
      sendChat({ file: dataUrl, text: '' });
    },
    [sendChat]
  );

  const leaveCall = useCallback(() => {
    const socket = socketRef.current;
    if (selfRef.current.isHost && socket) {
      try {
        socket.send(JSON.stringify({ t: 'host', action: 'end' }));
      } catch {
        // Ignore.
      }
    }
    callCleanupRef.current();
    navigate('/');
  }, [navigate]);

  const endCall = leaveCall;

  const muteParticipant = useCallback((targetId) => {
    sendHostAction('mute', targetId);
  }, [sendHostAction]);

  const removeParticipant = useCallback((targetId) => {
    sendHostAction('remove', targetId);
  }, [sendHostAction]);

  const toggleLock = useCallback(() => {
    sendHostAction('lock', null, { locked: !selfRef.current.locked });
  }, [sendHostAction]);

  const transferCoHost = useCallback((targetId) => {
    sendHostAction('cohost', targetId);
  }, [sendHostAction]);

  const updatePermissions = useCallback((targetId, permissions) => {
    sendHostAction('permissions', targetId, { permissions });
  }, [sendHostAction]);

  const localSpeakingNow = Boolean(localSpeaking);
  const selfView = participants.find((p) => p.id === self.id) || {
    id: self.id,
    name: user?.name || user?.username || 'You',
    isHost: self.isHost,
    mic: micOn,
    cam: camOn,
    screen: screenOn,
    hand: handRaised,
    speaking: localSpeakingNow,
    quality: selfQualityRef.current,
    connected: true
  };

  const remoteParticipants = participants.filter((p) => p.id !== self.id);

  if (phase === 'error') {
    return (
      <main className="call-page">
        <div className="call-error">
          <h2>Call unavailable</h2>
          <p>{error}</p>
          <button type="button" className="call-primary-btn" onClick={() => navigate('/')}>
            Back to videos
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="call-page">
      <div className="call-stage">
        <div className="call-video-grid">
          {selfView && (
            <CallParticipantTile
              participant={selfView}
              stream={localStreamRef.current}
              isLocal
              speaking={localSpeakingNow}
              micOn={micOn}
              camOn={camOn}
              connected
            />
          )}
          {remoteParticipants.map((participant) => (
            <CallParticipantTile
              key={participant.id}
              participant={participant}
              stream={streams[participant.id] || null}
              isLocal={false}
              speaking={Boolean(speaking[participant.id])}
              micOn={participant.mic}
              camOn={participant.cam}
              connected={Boolean(participant.connected)}
            />
          ))}
        </div>

        <div className="call-side">
          {chatOpen ? (
            <CallChat
              messages={messages}
              draft={draft}
              onDraftChange={setDraft}
              onSendText={(text) => sendChatMessage(text, /^\p{Extended_Pictographic}$/u.test(String(text || '')))}
              onSendFile={async (dataUrl) => {
                sendChat({ file: dataUrl, text: '' });
              }}
              onClose={() => setChatOpen(false)}
            />
          ) : null}
          {participantsOpen ? (
            <div className="call-participants-panel">
              <strong>Participants ({participants.length})</strong>
              <ul>
                {participants.map((participant) => (
                  <li key={participant.id}>
                    <span>{participant.name}</span>
                    <span>{participant.isHost ? 'Host' : participant.permissions?.canMute === false ? 'Restricted' : 'Participant'}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <div className="call-info">
        <span>Room {roomId}</span>
        <span>Duration {String(Math.floor(callSeconds / 60)).padStart(2, '0')}:{String(callSeconds % 60).padStart(2, '0')}</span>
        {self.isHost ? <span className="call-host-badge">Host</span> : null}
        {self.locked ? <span className="call-lock-badge">Locked</span> : null}
      </div>

      <CallControls
        micOn={micOn}
        camOn={camOn}
        screenOn={screenOn}
        handRaised={handRaised}
        isHost={self.isHost}
        participantCount={participants.length}
        chatOpen={chatOpen}
        participantsOpen={participantsOpen}
        participants={participants}
        self={self}
        recording={recording}
        onToggleRecording={toggleRecording}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onSwitchCam={() => void switchCamera()}
        onShareScreen={() => void shareScreen()}
        onLeave={leaveCall}
        onEnd={endCall}
        onToggleHand={toggleHand}
        onToggleChat={() => setChatOpen((value) => !value)}
        onToggleParticipants={() => setParticipantsOpen((value) => !value)}
        onInvite={() => setInviteOpen(true)}
        onMuteParticipant={muteParticipant}
        onRemoveParticipant={removeParticipant}
        onToggleLock={toggleLock}
        onTransferCoHost={transferCoHost}
        onUpdatePermissions={updatePermissions}
      />

      {inviteOpen ? (
        <Modal
          title="Invite people to this call"
          subtitle="Share this link with anyone you want to join the room."
          onClose={() => setInviteOpen(false)}
          footer={
            <>
              <button type="button" className="secondary-button" onClick={() => setInviteOpen(false)}>
                Done
              </button>
              <button type="button" className="primary-button" onClick={() => void shareInviteLink()}>
                <Share2 size={16} /> Share invite
              </button>
            </>
          }
        >
          <label className="field">
            <span className="field-label">Call link</span>
            <input readOnly value={inviteUrl} onFocus={(event) => event.target.select()} />
          </label>
          <div className="call-invite-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void copyText(inviteUrl, 'Call invite link copied.')}
            >
              <Copy size={16} /> Copy link
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void copyText(roomId, 'Room code copied.')}
            >
              <Copy size={16} /> Copy room code
            </button>
          </div>
          <p className="call-invite-note">
            Anyone with this link can join room <strong>{roomId}</strong>. Use host controls to lock the meeting or
            remove participants.
          </p>
        </Modal>
      ) : null}
    </main>
  );
}
