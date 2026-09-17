import { useState } from 'react';
import { Play } from 'lucide-react';
import './hyperview.css';

export default function HyperViewVideo({ video }) {
  const [isPlaying, setIsPlaying] = useState(false);

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
