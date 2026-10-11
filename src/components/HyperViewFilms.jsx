import { Play, Sparkles } from 'lucide-react';
import { hyperViewLive } from '../lib/hyperview';
import HyperViewVideo from './HyperViewVideo';
import HyperViewArtwork from './HyperViewArtwork';
import './hyperview.css';

const filmDetails = [
  ['The full experience', 'Step inside the room and see how motion, cinematic visuals and excited guests turn a screening into a shared adventure.'],
  ['Ready for take-off', 'A quick look at guests settling into the motion seats before the world on screen starts to move around them.'],
  ['Feel every moment', 'The smiles, surprise and energy are real—the kind of reactions only an experience beyond traditional cinema can create.'],
];

export default function HyperViewFilms() {
  return (
    <section className="hyperview-films" id="hyperview-live" aria-labelledby="hyperview-films-title">
      <div className="hyperview-films__inner">
        <div className="hyperview-films__heading">
          <p className="hyperview-eyebrow"><span /> Now flying in Lagos</p>
          <h2 id="hyperview-films-title">The flight has <em>begun.</em></h2>
          <p>HyperView is live and welcoming guests into a world of motion, sound and special effects. These are real moments from inside the experience.</p>
        </div>
        <div className="hyperview-films__live-note"><Sparkles size={17} aria-hidden="true" /><span>Real guests. Real reactions. A new kind of cinema experience.</span></div>
        <div className="hyperview-films__grid">
          {hyperViewLive.videos.map((video, index) => (
            <article className="hyperview-films__card" key={video.src}>
              <div className="hyperview-films__screen"><HyperViewVideo video={video} /></div>
              <div className="hyperview-films__details">
                <span className="hyperview-films__number">0{index + 1} / Live film</span>
                <h3>{filmDetails[index][0]}</h3>
                <p>{filmDetails[index][1]}</p>
                <span className="hyperview-films__duration"><Play size={13} fill="currentColor" aria-hidden="true" /> {video.duration}</span>
              </div>
            </article>
          ))}
        </div>
        <div className="hyperview-live-photos" aria-label="Photos from the live HyperView experience">
          {hyperViewLive.photos.map((photo, index) => (
            <figure className={`hyperview-live-photos__item hyperview-live-photos__item--${index + 1}`} key={photo.src}>
              <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" />
              <figcaption><span>0{index + 1}</span>{photo.title}</figcaption>
            </figure>
          ))}
        </div>
        <HyperViewArtwork />
      </div>
    </section>
  );
}
