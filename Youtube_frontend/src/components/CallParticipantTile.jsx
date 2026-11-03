import { useEffect, useRef } from 'react';
import { Hand, Mic, MicOff, Video, VideoOff } from 'lucide-react';

export default function CallParticipantTile({ participant, stream, isLocal, speaking, micOn, camOn, connected }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
    }
  }, [stream]);

  const showVideo = Boolean((isLocal ? camOn : participant.cam) && connected);

  return (
    <div className={`call-tile ${speaking ? 'speaking' : ''} ${connected ? '' : 'disconnected'}`}>
      {showVideo ? (
        <video ref={videoRef} autoPlay playsInline muted={Boolean(isLocal)} className="call-tile-video" />
      ) : (
        <div className="call-tile-avatar" aria-hidden="true">
          {(participant.name || 'G').slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="call-tile-overlay">
        <span className="call-tile-name">
          {participant.name}
          {participant.isHost ? ' · Host' : ''}
          {participant.hand ? ' · ✋' : ''}
        </span>
        <span className="call-tile-badges">
          {micOn ? <Mic size={12} /> : <MicOff size={12} />}
          {camOn || participant.screen ? <Video size={12} /> : <VideoOff size={12} />}
          {participant.hand ? <Hand size={12} /> : null}
        </span>
      </div>
    </div>
  );
}
