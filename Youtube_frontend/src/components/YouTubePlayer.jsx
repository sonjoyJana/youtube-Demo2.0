export default function YouTubePlayer({ youtubeId, title, autoplay = false }) {
  if (!youtubeId) {
    return (
      <div className="video-unavailable">
        <p>This YouTube video is not available.</p>
      </div>
    );
  }

  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    enablejsapi: '1',
    iv_load_policy: '3',
    origin: window.location.origin
  });
  if (autoplay) params.set('autoplay', '1');

  return (
    <iframe
      key={youtubeId}
      className="youtube-player"
      src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?${params.toString()}`}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      loading={autoplay ? 'eager' : 'lazy'}
      allowFullScreen
    />
  );
}
