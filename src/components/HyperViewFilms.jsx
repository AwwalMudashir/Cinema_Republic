import { ArrowUpRight } from 'lucide-react';
import { hyperViewVideos } from '../lib/hyperview';
import HyperViewVideo from './HyperViewVideo';
import HyperViewArtwork from './HyperViewArtwork';
import './hyperview.css';

const films = [
  {
    number: '01',
    heading: 'The introduction',
    description: 'Meet HyperView: a 9D flying cinema that brings motion, sound and special effects into the story.',
    video: hyperViewVideos.introduction,
  },
  {
    number: '02',
    heading: 'The experience',
    description: 'See what it feels like when the adventure moves beyond the screen and takes you along for the ride.',
    video: hyperViewVideos.experience,
  },
];

export default function HyperViewFilms() {
  return (
    <section className="hyperview-films" aria-labelledby="hyperview-films-title">
      <div className="hyperview-films__inner">
        <div className="hyperview-films__heading">
          <p className="hyperview-eyebrow"><span /> HyperView 9D Flying Cinema</p>
          <h2 id="hyperview-films-title">See it. <em>Feel it.</em></h2>
          <p>Take a look inside the immersive flying cinema experience from the Cinema Republic family.</p>
        </div>
        <div className="hyperview-films__grid">
          {films.map(({ number, heading, description, video }) => (
            <article className="hyperview-films__card" key={video.id}>
              <div className="hyperview-films__screen"><HyperViewVideo video={video} /></div>
              <div className="hyperview-films__details">
                <span className="hyperview-films__number">{number} / Film</span>
                <h3>{heading}</h3>
                <p>{description}</p>
                <a href={`https://www.youtube.com/shorts/${video.id}`} target="_blank" rel="noopener noreferrer">
                  Watch on YouTube <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
        </div>
        <HyperViewArtwork />
      </div>
    </section>
  );
}
