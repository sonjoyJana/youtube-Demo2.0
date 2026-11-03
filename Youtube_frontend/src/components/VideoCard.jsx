import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { formatCount, formatDate, formatDuration } from '../lib/format.js';
import { getVideoGradient, getVideoId, getVideoThumbnail } from '../lib/videos.js';

function toSeconds(duration) {
  const parts = String(duration || '0:00').split(':');
  const seconds = parts.reduce((acc, part) => acc * 60 + (Number.parseInt(part, 10) || 0), 0);
  return Number.isFinite(seconds) ? seconds : 0;
}

export default function VideoCard({ video }) {
  const [imageFailed, setImageFailed] = useState(false);
  const videoId = getVideoId(video);
  const thumbnail = getVideoThumbnail(video);
  const duration = video.durationSeconds ? formatDuration(video.durationSeconds) : formatDuration(toSeconds(video.duration));
  const views = formatCount(Number(String(video.views || '0').replace(/[^0-9]/g, '')) || 0);
  const published = video.published || (video.publishedAt ? formatDate(video.publishedAt) : '');

  return (
    <Link className="video-card" to={`/watch?video=${videoId}`}>
      <div className="video-thumb" style={{ background: getVideoGradient(video) }}>
        {thumbnail && !imageFailed ? (
          <img
            src={thumbnail}
            alt={video.title}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="thumb-fallback">
            <Play size={30} fill="currentColor" />
          </span>
        )}
        <span className="thumb-badge">
          <Play size={10} style={{ marginRight: 4, verticalAlign: '-1px' }} />
          {duration}
        </span>
      </div>
      <div className="video-info">
        <span className="channel-avatar">
          <Play size={16} />
        </span>
        <div className="video-text">
          <h3>{video.title}</h3>
          <p>{video.channel}</p>
          <span>
            {views} views{published ? ` · ${published}` : ''}
          </span>
        </div>
      </div>
    </Link>
  );
}
