import React from 'react';
import TrueFocus from '../animations/TrueFocus'

const glowStyle = {
  textShadow: '0 0 5px rgba(244, 162, 97, 0.6)',
};

const AboutHero = () => {
  return (
    <section className="relative w-full h-screen overflow-hidden ">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src="/img1.jpg" // Replace with your actual image path
          alt="Cinema 57 screening"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40 "></div> {/* Overlay */}
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-6">
        <h1
          className="text-4xl md:text-6xl font-bold text-[#F4A261] mb-4"
          style={glowStyle}
        >
          <TrueFocus
            sentence="Cinema Without Walls."
            manualMode={false}
            blurAmount={5}
            borderColor="white"
            animationDuration={1}
            pauseBetweenAnimations={1}
          />

        </h1>
        <p className="text-[#F1FAEE] text-lg md:text-xl max-w-2xl">
          We're redefining entertainment across Ghana — one open sky, one local story, one unforgettable screening at a time.
        </p>
      </div>
    </section>
  );
};

export default AboutHero;
