import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Bookmark, ChevronDown, Download, Share2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatCount, formatDate } from '../lib/format.js';
import { getVideo, getVideoThumbnail } from '../lib/videos.js';
import api, { getErrorMessage } from '../lib/api.js';
import Avatar from '../components/Avatar.jsx';
import Sidebar from '../components/Sidebar.jsx';
import CommentSection from '../components/CommentSection.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';
import YouTubePlayer from '../components/YouTubePlayer.jsx';

export default function WatchPage() {
  const toast = useToast();
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const videoId = getVideo(searchParams.get('video')).id;
  const shouldAutoplay = searchParams.get('autoplay') === '1';
  const [remoteVideo, setRemoteVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(`/videos/${videoId}`)
      .then(({ data }) => {
        if (!active) return;
        setRemoteVideo(data?.video || null);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [videoId]);

  useEffect(() => {
    document.title = `${getVideo(videoId).title} - YouTube`;
    setLiked(false);
    setDisliked(false);
    setSaved(false);
    setSubscribed(false);
    setDescriptionOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [videoId]);

  useEffect(() => {
    if (location.hash === '#comments') {
      const timer = window.setTimeout(() => {
        document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [location.hash, location.search]);

  function handleLike() {
    setLiked((current) => !current);
    if (disliked) setDisliked(false);
  }

  function handleDislike() {
    setDisliked((current) => !current);
    if (liked) setLiked(false);
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Video link copied to clipboard.');
    } catch {
      toast.info('Copy this page URL from your browser to share.');
    }
  }

  const video = { ...getVideo(videoId), ...(remoteVideo || {}) };
  const videoTitle = video.title || getVideo(videoId).title;
  const viewCount = typeof video.views === 'number' ? formatCount(video.views) : video.views;
  const publishedLabel =
    video.published || (video.publishedAt ? formatDate(video.publishedAt) : '');
  const tags = Array.isArray(video.tags) ? video.tags : [];
  const sourceType = video.sourceType || (video.youtubeId ? 'youtube' : 'local');
  const isYouTube = sourceType === 'youtube';
  const downloadInfo = video.download || {};
  const canDownload =
    typeof video.canDownload === 'boolean'
      ? video.canDownload
      : !isYouTube && Boolean(video.streamUrl);
  const showDownload = !isYouTube && !video.locked;
  const downloadRemaining = Number.isFinite(downloadInfo.remaining) ? downloadInfo.remaining : null;

  async function handleDownload() {
    if (!user) {
      toast.info('Sign in to download videos and track your plan limits.');
      return;
    }
    if (!canDownload) {
      if (downloadInfo.daily && downloadInfo.daily.remaining <= 0) {
        toast.info(
          `Daily download limit reached (${downloadInfo.daily.limit}). Try again tomorrow or upgrade your plan.`
        );
      } else if (downloadInfo.monthly && downloadInfo.monthly.remaining <= 0) {
        toast.info(
          `Monthly download limit reached (${downloadInfo.monthly.limit}). Upgrade your plan for more downloads.`
        );
      } else {
        toast.info('This video is not downloadable on your current plan.');
      }
      return;
    }

    try {
      const { data } = await api.post(`/videos/${encodeURIComponent(video.id)}/download`);
      const token = data?.downloadToken;
      if (!token) throw new Error('Download token missing.');
      const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
      const url = `${apiBase}/videos/${encodeURIComponent(video.id)}/download?token=${encodeURIComponent(token)}`;
      const link = document.createElement('a');
      link.href = url;
      link.download = `${videoTitle || 'video'}.mp4`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      const remaining = data?.download?.remaining;
      toast.success(
        typeof remaining === 'number'
          ? `Download started. ${remaining} download${remaining === 1 ? '' : 's'} left.`
          : 'Download started.'
      );
      if (data?.download) {
        setRemoteVideo((current) =>
          current ? { ...current, canDownload: data.download.allowed, download: data.download } : current
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to start the download.'));
    }
  }

  if (loading) {
    return (
      <main className="watch-page">
        <div className="watch-primary">
          <div className="video-frame video-frame-loading">
            <div className="player-spinner" />
            <p>Loading the video player…</p>
          </div>
          <div className="watch-meta-row">
            <div className="channel-row">
              <div className="channel-skeleton" />
              <div className="channel-skeleton" />
            </div>
          </div>
        </div>
        <Sidebar activeVideoId={videoId} />
      </main>
    );
  }

  return (
    <main className="watch-page">
      <div className="watch-primary">
        <div className="video-frame">
          {isYouTube ? (
            <YouTubePlayer
              key={video.youtubeId}
              youtubeId={video.youtubeId}
              title={videoTitle}
              autoplay={shouldAutoplay}
            />
          ) : (
            <VideoPlayer
              key={video.id}
              src={video.streamUrl}
              poster={getVideoThumbnail(video)}
              title={videoTitle}
              autoplay={shouldAutoplay}
            />
          )}
        </div>

        <h1 className="watch-title">{videoTitle}</h1>

        <div className="watch-meta-row">
          <div className="channel-row">
            <Avatar name={video.channel} src={video.channelAvatar} size={40} />
            <div className="channel-copy">
              <strong>{video.channel}</strong>
              <span>{video.subscribers}</span>
            </div>
            <button
              type="button"
              className={`subscribe-button ${subscribed ? 'subscribed' : ''}`}
              onClick={() => setSubscribed((current) => !current)}
            >
              {subscribed ? 'Subscribed' : 'Subscribe'}
            </button>
          </div>

          <div className="watch-actions">
            <div className="action-pill split-pill">
              <button
                type="button"
                className={liked ? 'active' : ''}
                onClick={handleLike}
                aria-pressed={liked}
              >
                <ThumbsUp size={19} fill={liked ? 'currentColor' : 'none'} />
                {formatCount(video.likes || 0)}
              </button>
              <span className="pill-divider" />
              <button
                type="button"
                className={disliked ? 'active' : ''}
                onClick={handleDislike}
                aria-pressed={disliked}
                aria-label="Dislike"
              >
                <ThumbsDown size={19} fill={disliked ? 'currentColor' : 'none'} />
              </button>
            </div>
            <button type="button" className="action-pill" onClick={handleShare}>
              <Share2 size={19} />
              Share
            </button>
            {showDownload ? (
              <button
                type="button"
                className={`action-pill ${canDownload ? '' : 'muted'}`}
                onClick={() => void handleDownload()}
                title={
                  !user
                    ? 'Sign in to download videos'
                    : !canDownload
                      ? 'Download limit reached or unavailable'
                      : typeof downloadRemaining === 'number'
                        ? `${downloadRemaining} download${downloadRemaining === 1 ? '' : 's'} left today`
                        : 'Download video'
                }
              >
                <Download size={19} />
                Download
              </button>
            ) : null}
            <button
              type="button"
              className={`action-pill ${saved ? 'active' : ''}`}
              onClick={() => setSaved((current) => !current)}
            >
              <Bookmark size={19} fill={saved ? 'currentColor' : 'none'} />
              Save
            </button>
          </div>
        </div>

        <div
          className={`video-description ${descriptionOpen ? 'expanded' : ''}`}
          onClick={() => setDescriptionOpen((current) => !current)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') setDescriptionOpen((current) => !current);
          }}
        >
          <div className="description-stats">
            {viewCount} views{publishedLabel ? ` · ${publishedLabel}` : ''}
          </div>
          <p>{video.description}</p>
          <div className="description-tags">
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <span className="description-toggle">
            {descriptionOpen ? 'Show less' : 'Show more'}
            <ChevronDown size={16} className={descriptionOpen ? 'rotated' : ''} />
          </span>
        </div>

        <div id="comments">
          <CommentSection videoId={video.id} key={video.id} />
        </div>
      </div>

      <Sidebar activeVideoId={video.id} />
    </main>
  );
}
