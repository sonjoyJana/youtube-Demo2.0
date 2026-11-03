import { useEffect, useRef } from 'react';

export default function VideoPlayer({ src, poster, title, autoplay = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    video.load();
    if (!autoplay) return undefined;

    let cancelled = false;
    const play = () => {
      if (cancelled) return;
      const promise = video.play();
      if (promise?.catch) promise.catch(() => {});
    };

    if (video.readyState >= 2) play();
    else video.addEventListener('loadeddata', play, { once: true });

    return () => {
      cancelled = true;
      video.removeEventListener('loadeddata', play);
    };
  }, [src, autoplay]);

  if (!src) {
    return (
      <div className="video-unavailable">
        <p>This video is not available.</p>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      key={src}
      className="youtube-player"
      src={src}
      poster={poster || undefined}
      title={title}
      controls
      playsInline
      preload="metadata"
    />
  );
}
