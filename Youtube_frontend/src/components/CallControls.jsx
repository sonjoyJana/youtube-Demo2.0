import { Disc, Hand, MessageSquare, Mic, MicOff, MonitorUp, PhoneOff, ShieldCheck, UserPlus, Users, Video, VideoOff } from 'lucide-react';

export default function CallControls({
  micOn,
  camOn,
  screenOn,
  handRaised,
  isHost,
  participantCount,
  chatOpen,
  participantsOpen,
  participants = [],
  self,
  recording,
  onToggleRecording,
  onToggleMic,
  onToggleCam,
  onSwitchCam,
  onShareScreen,
  onLeave,
  onEnd,
  onToggleHand,
  onToggleChat,
  onToggleParticipants,
  onInvite,
  onMuteParticipant,
  onRemoveParticipant,
  onToggleLock,
  onTransferCoHost,
  onUpdatePermissions
}) {
  return (
    <div className="call-controls-wrap">
      <div className="call-controls">
        <button type="button" className={`call-control ${micOn ? '' : 'off'}`} onClick={onToggleMic} aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}>
          {micOn ? <Mic size={20} /> : <MicOff size={20} />}
        </button>
        <button type="button" className={`call-control ${camOn ? '' : 'off'}`} onClick={onToggleCam} aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}>
          {camOn ? <Video size={20} /> : <VideoOff size={20} />}
        </button>
        <button type="button" className="call-control" onClick={onSwitchCam} aria-label="Switch camera">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
        <button type="button" className={`call-control ${screenOn ? 'active' : ''}`} onClick={onShareScreen} aria-label="Share screen">
          <MonitorUp size={20} />
        </button>
        <button type="button" className={`call-control ${handRaised ? 'active' : ''}`} onClick={onToggleHand} aria-label="Raise hand">
          <Hand size={20} />
        </button>
        <button type="button" className={`call-control ${recording ? 'active' : ''}`} onClick={onToggleRecording} aria-label={recording ? 'Stop recording' : 'Start recording'}>
          <Disc size={20} />
        </button>
        <button type="button" className="call-control" onClick={onInvite} aria-label="Invite people to this call">
          <UserPlus size={20} />
        </button>
        <button type="button" className={`call-control ${chatOpen ? 'active' : ''}`} onClick={onToggleChat} aria-label="In-call chat">
          <MessageSquare size={20} />
        </button>
        <button type="button" className={`call-control ${participantsOpen ? 'active' : ''}`} onClick={onToggleParticipants} aria-label="Participants">
          <Users size={20} />
        </button>
        {isHost ? (
          <button type="button" className="call-control danger" onClick={onEnd} aria-label="End meeting for all">
            <PhoneOff size={20} />
          </button>
        ) : (
          <button type="button" className="call-control danger" onClick={onLeave} aria-label="Leave call">
            <PhoneOff size={20} />
          </button>
        )}
      </div>

      {isHost ? (
        <div className="call-host-panel">
          <div className="call-host-head">
            <ShieldCheck size={16} /> Host controls
          </div>
          <div className="call-host-actions">
            <button type="button" className="call-host-btn" onClick={onToggleLock}>
              {self?.locked ? 'Unlock meeting' : 'Lock meeting'}
            </button>
            {participants
              .filter((participant) => participant.id !== self?.id)
              .map((participant) => (
                <div key={participant.id} className="call-host-row">
                  <span>{participant.name}</span>
                  <span className="call-host-row-actions">
                    <button type="button" className="call-host-btn" onClick={() => onMuteParticipant(participant.id)}>
                      {participant.mic ? 'Mute' : 'Unmute'}
                    </button>
                    <button type="button" className="call-host-btn" onClick={() => onTransferCoHost(participant.id)}>
                      Make co-host
                    </button>
                    <button type="button" className="call-host-btn" onClick={() => onRemoveParticipant(participant.id)}>
                      Remove
                    </button>
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
