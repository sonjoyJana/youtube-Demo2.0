const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

const peerMap = new Map(); // peerId -> { pc, stream, makingOffer }
const speakingTimers = new Map();

function keyFor(peerId) {
  return `rtc:${peerId}`;
}

export function createPeerConnection({ localStream, onTrack, onIce, onStateChange }) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  if (localStream) {
    const sender = pc.addTrack(localStream.getAudioTrack() || localStream.getVideoTrack(), localStream);
    pc.__sender = sender;
  }
  pc.onicecandidate = (event) => {
    if (event.candidate) onIce?.(event.candidate);
  };
  pc.ontrack = (event) => {
    onTrack?.(event);
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') {
      // Let the caller decide how to handle failures.
    }
    onStateChange?.(pc);
  };
  return pc;
}

export function closePeer(peerId) {
  const key = keyFor(peerId);
  const entry = peerMap.get(key);
  if (!entry) return;
  try {
    entry.pc.close();
  } catch {
    // Ignore.
  }
  peerMap.delete(key);
}

export function getPeer(peerId) {
  return peerMap.get(keyFor(peerId)) || null;
}

export function peerIds() {
  return Array.from(peerMap.keys()).map((key) => key.replace(/^rtc:/, ''));
}

export function replaceTrack(peerId, kind, newTrack) {
  const entry = peerMap.get(keyFor(peerId));
  const sender = entry?.pc?.__sender;
  if (!sender || !newTrack) return;
  sender.replaceTrack(newTrack).catch(() => {
    // Ignore replace errors (e.g., sender not ready).
  });
}

export async function createCallPeer({ peerId, localStream, isInitiator, onTrack, onIce, onStateChange }) {
  const key = keyFor(peerId);
  const existing = peerMap.get(key);
  if (existing) return existing.pc;

  const pc = createPeerConnection({ localStream, onTrack, onIce, onStateChange });
  const entry = { pc, stream: null };
  peerMap.set(key, entry);

  if (isInitiator) {
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: Boolean(localStream?.getVideoTrack())
      });
      await pc.setLocalDescription(offer);
      return pc;
    } catch {
      return pc;
    }
  }
  return pc;
}

export function addIceCandidate(peerId, candidate) {
  const entry = peerMap.get(keyFor(peerId));
  if (!entry || !candidate) return Promise.resolve();
  return entry.pc.addIceCandidate(candidate).catch(() => {
    // Ignore stale candidates.
  });
}

export function answerCall(peerId, offer, onTrack, onIce) {
  const entry = peerMap.get(keyFor(peerId));
  if (!entry) return Promise.resolve();
  return entry.pc
    .setRemoteDescription(offer)
    .then(() => entry.pc.createAnswer())
    .then((answer) => entry.pc.setLocalDescription(answer))
    .then(() => {
      const payload = { sdp: answer.sdp, type: answer.type };
      // Caller sends via signaling; answerer returns through signaling.
      return payload;
    })
    .then((payload) => ({ payload }))
    .catch(() => null);
}

export function setRemoteDescription(peerId, description) {
  const entry = peerMap.get(keyFor(peerId));
  if (!entry) return Promise.resolve();
  return entry.pc.setRemoteDescription(description).then(() => entry.pc.createAnswer()).then((answer) => entry.pc.setLocalDescription(answer));
}

export async function createOffer(peerId, localStream, onTrack, onIce) {
  const entry = peerMap.get(keyFor(peerId));
  if (!entry) return null;
  const offer = await entry.pc.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: Boolean(localStream?.getVideoTrack())
  });
  await entry.pc.setLocalDescription(offer);
  return { sdp: offer.sdp, type: offer.type };
}

export function createAnswer(peerId) {
  const entry = peerMap.get(keyFor(peerId));
  if (!entry) return Promise.resolve(null);
  return entry.pc.createAnswer().then((answer) => {
    entry.pc.setLocalDescription(answer);
    return { sdp: answer.sdp, type: answer.type };
  });
}

export function addRemoteCandidate(peerId, candidate) {
  const entry = peerMap.get(keyFor(peerId));
  if (!entry || !candidate) return Promise.resolve();
  return entry.pc.addIceCandidate(candidate).catch(() => null);
}

export function closeAllCallPeers() {
  for (const key of Array.from(peerMap.keys())) {
    const entry = peerMap.get(key);
    if (entry) {
      try {
        entry.pc.close();
      } catch {
        // Ignore.
      }
    }
    peerMap.delete(key);
  }
}

export function cleanupSpeakingMonitor(peerId) {
  const timer = speakingTimers.get(peerId);
  if (timer) {
    clearInterval(timer);
    speakingTimers.delete(peerId);
  }
}

export function startSpeakingMonitor(stream, onSpeakingChange) {
  cleanupSpeakingMonitor('local');
  try {
    if (!stream) return () => cleanupSpeakingMonitor('local');
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return () => cleanupSpeakingMonitor('local');
    const audioContext = new AudioContextCtor();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let speaking = false;
    const interval = setInterval(() => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const value = (data[i] - 128) / 128;
        sum += value * value;
      }
      const rms = Math.sqrt(sum / data.length);
      const nextSpeaking = rms > 0.045;
      if (nextSpeaking !== speaking) {
        speaking = nextSpeaking;
        onSpeakingChange?.(nextSpeaking);
      }
    }, 250);
    return () => {
      clearInterval(interval);
      cleanupSpeakingMonitor('local');
      try {
        audioContext.close();
      } catch {
        // Ignore.
      }
    };
  } catch {
    return () => cleanupSpeakingMonitor('local');
  }
}

export function getCallStats(pc) {
  try {
    const stats = pc.getStats();
    let bytesSent = 0;
    let bytesReceived = 0;
    let packetsLost = 0;
    let jitter = 0;
    let lastTimestamp = null;
    for (const report of stats.values()) {
      if (report.type === 'outbound-rtp' || report.type === 'inbound-rtp') {
        bytesSent += Number(report.bytesSent || 0);
        bytesReceived += Number(report.bytesReceived || 0);
        jitter = Number(report.jitter || jitter);
        packetsLost += Number(report.packetsLost || 0);
      }
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        bytesSent += Number(report.bytesSent || 0);
        bytesReceived += Number(report.bytesReceived || 0);
      }
    }
    const now = Date.now();
    const duration = lastTimestamp ? (now - lastTimestamp) / 1000 : 0;
    if (duration > 0) {
      const kbps = (bytesSent * 8) / duration / 1000;
      const quality = kbps >= 1.5 ? 4 : kbps >= 0.8 ? 3 : kbps >= 0.4 ? 2 : kbps > 0 ? 1 : 0;
      return { quality, kbps, jitter, packetsLost };
    }
    return { quality: 0, kbps: 0, jitter, packetsLost };
  } catch {
    return { quality: 0, kbps: 0, jitter: 0, packetsLost: 0 };
  }
}
