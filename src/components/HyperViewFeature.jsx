import { ArrowUpRight, MoveUpRight, Sparkles, Volume2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { hyperViewAssets, hyperViewVideos } from '../lib/hyperview';
import HyperViewVideo from './HyperViewVideo';
import './hyperview.css';

export default function HyperViewFeature() {
  return (
    <section className="hyperview-feature" aria-labelledby="hyperview-feature-title">
      <div className="hyperview-feature__inner">
        <div className="hyperview-feature__copy">
          <p className="hyperview-eyebrow"><span /> From the Cinema Republic family</p>
          <img className="hyperview-feature__logo" src={hyperViewAssets.lightLogo} alt="HyperView Cinema Republic" />
          <h2 id="hyperview-feature-title">Cinema you can <em>feel.</em></h2>
          <p className="hyperview-feature__description">
            Meet HyperView 9D Flying Cinema: an immersive motion experience that makes you
            feel like you’re flying through the adventure, not simply watching it unfold.
          </p>
          <div className="hyperview-feature__signals" aria-label="Experience features">
            <span><MoveUpRight size={16} /> Motion</span>
            <span><Volume2 size={16} /> Sound</span>
            <span><Sparkles size={16} /> Special effects</span>
          </div>
          <Link className="hyperview-feature__link" to="/partnership">
            Explore HyperView <ArrowUpRight size={18} />
          </Link>
        </div>
        <figure className="hyperview-feature__visual">
          <Link className="hyperview-feature__artwork" to="/events" aria-label="Explore the HyperView posters and flyers on the Events page">
            <span className="hyperview-feature__artwork-label">The world of HyperView <ArrowUpRight size={15} aria-hidden="true" /></span>
            <span className="hyperview-feature__artwork-strip">
              <img src={hyperViewAssets.flightPoster} alt="" loading="lazy" decoding="async" />
              <img src={hyperViewAssets.skiesPoster} alt="" loading="lazy" decoding="async" />
              <img src={hyperViewAssets.experiencePoster} alt="" loading="lazy" decoding="async" />
            </span>
          </Link>
          <HyperViewVideo video={hyperViewVideos.introduction} />
          <figcaption>
            <span>01 / Meet HyperView 9D</span>
            <a href={`https://www.youtube.com/shorts/${hyperViewVideos.introduction.id}`} target="_blank" rel="noopener noreferrer">
              Watch on YouTube <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
