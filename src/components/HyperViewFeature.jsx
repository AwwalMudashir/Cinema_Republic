import { ArrowUpRight, MoveUpRight, Sparkles, Volume2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { hyperViewAssets, hyperViewLive } from '../lib/hyperview';
import HyperViewPhotoStack from './HyperViewPhotoStack';
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
          <Link className="hyperview-feature__link" to="/events#hyperview-live">
            See it in action <ArrowUpRight size={18} />
          </Link>
        </div>
        <figure className="hyperview-feature__visual">
          <div className="hyperview-feature__artwork">
            <span className="hyperview-feature__artwork-label"><span><i /> Now flying in Lagos</span></span>
            <Link className="hyperview-feature__artwork-link" to="/events#hyperview-live" aria-label="See more HyperView moments on the Events page">
              View all <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className="hyperview-feature__media">
            <HyperViewVideo video={hyperViewLive.videos[0]} autoPlayInView />
            <HyperViewPhotoStack photos={hyperViewLive.photos} />
          </div>
          <figcaption>
            <span>01 / The live HyperView experience</span>
            <Link to="/events#hyperview-live">More moments <ArrowUpRight size={13} aria-hidden="true" /></Link>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
