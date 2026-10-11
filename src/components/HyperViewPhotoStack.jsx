import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import './hyperview.css';

export default function HyperViewPhotoStack({ photos }) {
  const [activePhoto, setActivePhoto] = useState(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!activePhoto) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setActivePhoto(null);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [activePhoto]);

  return (
    <>
      <div className="hyperview-photo-stack" aria-label="Photos from the live HyperView experience">
        {photos.map((photo, index) => (
          <button
            className="hyperview-photo-stack__item"
            type="button"
            key={photo.src}
            onClick={() => setActivePhoto(photo)}
            aria-label={`View larger image: ${photo.title}`}
          >
            <img src={photo.src} alt="" loading="lazy" decoding="async" />
            <span aria-hidden="true">0{index + 1}</span>
          </button>
        ))}
      </div>

      {activePhoto && (
        <div
          className="hyperview-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={activePhoto.title}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActivePhoto(null);
          }}
        >
          <div className="hyperview-lightbox__content">
            <button ref={closeButtonRef} type="button" onClick={() => setActivePhoto(null)} aria-label="Close enlarged photo">
              <X size={23} aria-hidden="true" />
            </button>
            <img src={activePhoto.src} alt={activePhoto.alt} />
            <p>{activePhoto.title}</p>
          </div>
        </div>
      )}
    </>
  );
}
