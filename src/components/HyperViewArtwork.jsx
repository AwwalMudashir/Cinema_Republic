import { ArrowUpRight } from 'lucide-react';
import { hyperViewAssets } from '../lib/hyperview';
import './hyperview.css';

const artwork = [
  {
    src: hyperViewAssets.flightPoster,
    title: 'Fly across the world',
    alt: 'HyperView artwork of guests flying above mountains and a coastal city',
    format: 'poster',
  },
  {
    src: hyperViewAssets.skiesPoster,
    title: 'Take to the skies',
    alt: 'HyperView artwork of guests soaring through clouds beneath a rainbow',
    format: 'poster',
  },
  {
    src: hyperViewAssets.comingSoonPoster,
    title: 'A new way to fly',
    alt: 'HyperView promotional flyer showing guests in flying cinema seats',
    format: 'flyer',
  },
  {
    src: hyperViewAssets.readyToFlyPoster,
    title: 'Get ready to fly',
    alt: 'HyperView flyer with a guest preparing for the flying cinema experience',
    format: 'flyer',
  },
  {
    src: hyperViewAssets.experiencePoster,
    title: 'Your adventure awaits',
    alt: 'HyperView flyer showing a guest fastening their seatbelt for the experience',
    format: 'flyer',
  },
  {
    src: hyperViewAssets.visitorGuide,
    title: 'Visitor information',
    alt: 'HyperView visitor-instructions flyer; open the full-size image to read the instructions',
    format: 'flyer',
  },
];

export default function HyperViewArtwork() {
  return (
    <div className="hyperview-artwork" aria-labelledby="hyperview-artwork-title">
      <div className="hyperview-artwork__heading">
        <div>
          <p className="hyperview-eyebrow"><span /> The world of HyperView</p>
          <h3 id="hyperview-artwork-title">A glimpse of the <em>adventure.</em></h3>
        </div>
        <p>Explore the artwork behind the flying cinema experience. Select an image to see it in full.</p>
      </div>
      <div className="hyperview-artwork__posters">
        {artwork.filter((item) => item.format === 'poster').map((item) => <ArtworkCard key={item.src} item={item} />)}
      </div>
      <div className="hyperview-artwork__flyers">
        {artwork.filter((item) => item.format === 'flyer').map((item) => <ArtworkCard key={item.src} item={item} />)}
      </div>
    </div>
  );
}

function ArtworkCard({ item }) {
  return (
    <a className={`hyperview-artwork__card hyperview-artwork__card--${item.format}`} href={item.src} target="_blank" rel="noopener noreferrer" aria-label={`View full-size HyperView artwork: ${item.title}`}>
      <img src={item.src} alt={item.alt} loading="lazy" decoding="async" />
      <span className="hyperview-artwork__caption">
        <span>{item.title}</span>
        <ArrowUpRight size={18} aria-hidden="true" />
      </span>
    </a>
  );
}
