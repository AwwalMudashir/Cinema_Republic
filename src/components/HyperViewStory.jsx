import { ArrowUpRight, MoveUpRight, Sparkles, Volume2 } from 'lucide-react';
import { createElement } from 'react';
import { Link } from 'react-router-dom';
import { hyperViewAssets } from '../lib/hyperview';
import './hyperview.css';

const sensations = [
  { icon: MoveUpRight, title: 'Feel the movement', description: 'Motion draws you into every climb, turn and dive.' },
  { icon: Volume2, title: 'Hear the world', description: 'Cinematic sound brings the adventure closer.' },
  { icon: Sparkles, title: 'Beyond the screen', description: 'Special effects make the story feel all around you.' },
];

export default function HyperViewStory() {
  return (
    <section className="hyperview-story" aria-labelledby="hyperview-story-title">
      <div className="hyperview-story__inner">
        <div className="hyperview-story__heading">
          <div>
            <p className="hyperview-eyebrow"><span /> Another world of Cinema Republic</p>
            <h2 id="hyperview-story-title">Introducing <em>HyperView.</em></h2>
          </div>
          <img src={hyperViewAssets.darkLogo} alt="HyperView Cinema Republic" loading="lazy" />
        </div>
        <div className="hyperview-story__body">
          <div className="hyperview-story__copy">
            <p className="hyperview-story__lead">More than a movie. A flight into the story.</p>
            <p>
              HyperView 9D Flying Cinema is an immersive motion experience that makes you feel
              like you’re actually flying through the adventure, rather than simply watching a movie.
              It combines cinematic visuals, motion, sound and special effects to put you right in
              the action and create an experience beyond traditional cinema.
            </p>
            <div className="hyperview-story__sensations">
              {sensations.map(({ icon, title, description }) => (
                <div className="hyperview-story__sensation" key={title}>
                  <span className="hyperview-story__icon">{createElement(icon, { size: 20, 'aria-hidden': true })}</span>
                  <div><h3>{title}</h3><p>{description}</p></div>
                </div>
              ))}
            </div>
            <Link className="hyperview-story__link" to="/contact">
              Enquire about HyperView <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="hyperview-story__gallery" aria-label="HyperView promotional artwork">
            <figure className="hyperview-story__image hyperview-story__image--main">
              <img
                src={hyperViewAssets.experiencePoster}
                alt="HyperView promotional artwork showing a guest preparing for the flying cinema experience"
                loading="lazy"
              />
            </figure>
            <figure className="hyperview-story__image hyperview-story__image--accent">
              <img
                src={hyperViewAssets.comingSoonPoster}
                alt="HyperView promotional artwork showing guests seated for an immersive flying cinema experience"
                loading="lazy"
              />
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
