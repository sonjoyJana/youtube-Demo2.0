import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PhoneCall } from 'lucide-react';
import api from '../lib/api.js';
import VideoCard from '../components/VideoCard.jsx';
import { VIDEOS } from '../lib/videos.js';

export default function HomePage() {
  const [searchParams] = useSearchParams();
  const search = (searchParams.get('search') || searchParams.get('q') || '').trim();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const params = { limit: 24 };
    if (search) params.search = search;

    api
      .get('/videos', { params })
      .then(({ data }) => {
        if (!active) return;
        setVideos(data?.videos || []);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setVideos(VIDEOS);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [search]);

  return (
    <main className="home-page">
      <div className="home-header">
        <h1 className="home-title">{search ? `Search results for “${search}”` : 'YouTube'}</h1>
        <Link className="home-call-cta" to="/call">
          <PhoneCall size={18} />
          Start or join a video call
        </Link>
      </div>
      {loading ? (
        <div className="video-grid">
          {VIDEOS.map((video) => (
            <div key={video.id} className="video-card video-card-skeleton">
              <div className="video-thumb">
                <div className="skeleton" />
              </div>
              <div className="video-info">
                <div className="video-text">
                  <div className="skeleton skeleton-line" />
                  <div className="skeleton skeleton-line short" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="home-error">{error}</p>
      ) : (
        <div className="video-grid">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </main>
  );
}
