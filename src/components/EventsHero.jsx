import React from 'react';
import FuzzyText from '../animations/FuzzyText'

const glowStyle = {
  textShadow: '0 0 5px rgba(244, 162, 97, 0.6)',
};

const EventsHero = () => {
  return (
    <section className="relative w-full h-[100vh] overflow-hidden">
      <img
        src="/daten.avif" // Replace with actual image
        alt="Cinema 57 Events"
        className="absolute inset-0 w-full h-full object-cover z-0"
      />
      <div className="absolute inset-0 bg-black/60 z-10" />
      <div className="relative z-20 flex flex-col items-center justify-center mt-4 h-full text-center px-6">
        <h1
          className="text-4xl md:text-6xl font-bold text-[#F4A261] mb-4"
          style={glowStyle}
        >
          <FuzzyText
            baseIntensity={0.2}
            hoverIntensity={0.5}
            enableHover={true}
          >
            Cinema Moments That Stay With You
          </FuzzyText>
        </h1>
        <p className="text-[#F1FAEE] text-lg md:text-xl max-w-2xl">
          Relive our magical screenings across beaches, parks, and communities in Ghana.
        </p>
      </div>
    </section>
  );
};

export default EventsHero;
