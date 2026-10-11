import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import './hyperview.css';

export default function HyperViewVideo({ video, autoPlayInView = false }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!video.src || !autoPlayInView || !element) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        element.pause();
        return;
      }

      element.muted = false;
      element.play()
        .then(() => setAutoplayBlocked(false))
        .catch(() => setAutoplayBlocked(true));
    }, { threshold: 0.45 });

    observer.observe(element);
    return () => observer.disconnect();
  }, [autoPlayInView, video.src]);

  const playWithSound = async () => {
    const element = videoRef.current;
    if (!element) return;
    element.muted = false;
    try {
      await element.play();
      setAutoplayBlocked(false);
    } catch {
      setAutoplayBlocked(true);
    }
  };

  if (video.src) {
    return (
      <div className="hyperview-video">
        <video
          ref={videoRef}
          src={video.src}
          poster={video.poster}
          title={video.title}
          controls
          playsInline
          preload="metadata"
        >
          Your browser does not support HTML video.
        </video>
        {autoplayBlocked && (
          <button className="hyperview-video__sound-start" type="button" onClick={playWithSound}>
            <Play size={18} fill="currentColor" aria-hidden="true" />
            Play with sound
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="hyperview-video">
      {isPlaying ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&playsinline=1&rel=0`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button
          className="hyperview-video__trigger"
          type="button"
          onClick={() => setIsPlaying(true)}
          aria-label={`Play ${video.title}`}
        >
          <img src={video.poster} alt="" loading="lazy" />
          <span className="hyperview-video__shade" aria-hidden="true" />
          <span className="hyperview-video__play" aria-hidden="true"><Play size={26} fill="currentColor" /></span>
          <span className="hyperview-video__prompt" aria-hidden="true">Watch film <span>↗</span></span>
        </button>
      )}
    </div>
  );
}
