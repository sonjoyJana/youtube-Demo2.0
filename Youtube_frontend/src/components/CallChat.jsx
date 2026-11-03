import { useEffect, useRef, useState } from 'react';
import { FileText, Send, Smile } from 'lucide-react';

export const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🔥'];

export default function CallChat({ messages, draft, onDraftChange, onSendText, onSendFile, onClose }) {
  const listRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
    onSendFile(dataUrl);
  }

  return (
    <div className="call-chat">
      <div className="call-chat-head">
        <strong>In-call chat</strong>
        <button type="button" className="call-chat-close" onClick={onClose} aria-label="Close chat">
          ✕
        </button>
      </div>
      <div className="call-chat-list" ref={listRef}>
        {messages.length === 0 ? (
          <p className="call-chat-empty">Say hi 👋 Start the conversation.</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="call-chat-item">
              <span className="call-chat-meta">
                {message.fromName || 'Participant'} · {new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {message.file ? (
                <a className="call-chat-file" href={message.file} target="_blank" rel="noreferrer">
                  <FileText size={14} /> Shared file
                </a>
              ) : (
                <p className="call-chat-text">{message.text}</p>
              )}
            </div>
          ))
        )}
      </div>
      <div className="call-chat-emoji-row">
        {QUICK_EMOJIS.map((emoji) => (
          <button key={emoji} type="button" className="call-chat-emoji" onClick={() => onSendText(emoji)}>
            {emoji}
          </button>
        ))}
      </div>
      <div className="call-chat-input-row">
        <input
          className="call-chat-input"
          placeholder="Type a message…"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSendText(draft);
          }}
        />
        <button type="button" className="call-chat-send" onClick={() => onSendText(draft)} aria-label="Send message">
          <Send size={16} />
        </button>
        <button type="button" className="call-chat-file-btn" onClick={() => fileInputRef.current?.click()} aria-label="Share file">
          <FileText size={16} />
        </button>
        <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
      </div>
    </div>
  );
}
