import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import api from '../lib/api.js';
import { formatCount, formatDate, formatDuration } from '../lib/format.js';
import { VIDEOS, getVideoGradient, getVideoId, getVideoThumbnail } from '../lib/videos.js';

function durationLabel(video) {
  if (video.durationSeconds) return formatDuration(video.durationSeconds);
  return video.duration || '0:00';
}

function viewsLabel(video) {
  if (typeof video.views === 'number') return `${formatCount(video.views)} views`;
  return video.views || '0 views';
}

function publishedLabel(video) {
  if (video.published) return video.published;
  return video.publishedAt ? formatDate(video.publishedAt) : '';
}

export default function Sidebar({ activeVideoId }) {
  const [videos, setVideos] = useState(VIDEOS);

  useEffect(() => {
    let active = true;
    api
      .get('/videos', { params: { limit: 12 } })
      .then(({ data }) => {
        if (active && data?.videos?.length) setVideos(data.videos);
      })
      .catch(() => {
        // Keep the bundled catalog when the API is unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

  const recommended = videos.filter((video) => getVideoId(video) !== activeVideoId);

  return (
    <aside className="watch-sidebar">
      <div className="sidebar-header">
        <h3>Up next</h3>
        <label className="autoplay-toggle">
          <input type="checkbox" defaultChecked />
          <span className="switch" />
          Autoplay
        </label>
      </div>

      <div className="sidebar-list">
        {recommended.map((video) => {
          const videoId = getVideoId(video);
          const thumbnail = getVideoThumbnail(video);
          return (
            <Link
              className="sidebar-card"
              key={videoId}
              to={`/watch?video=${videoId}&autoplay=1`}
              aria-label={`Play ${video.title}`}
            >
              <div className="sidebar-thumb" style={{ background: getVideoGradient(video) }}>
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={video.title}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <span className="thumb-duration">{durationLabel(video)}</span>
                <span className="thumb-play">
                  <Play size={20} fill="currentColor" />
                </span>
              </div>
              <div className="sidebar-card-copy">
                <h4>{video.title}</h4>
                <p>{video.channel}</p>
                <span>
                  {viewsLabel(video)} · {publishedLabel(video)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
