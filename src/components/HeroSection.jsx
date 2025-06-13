import React from 'react';
import './components.css'; // Assuming you're using this for extra styles
import BlurText from '../animations/BlurText';

const HeroSection = () => {
  return (
    <div className="relative w-full h-screen overflow-hidden">

      {/* Background Video */}
      <video
        className="absolute top-0 left-0 w-full h-full object-cover"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/bg_video1.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Overlay */}
      <div className="absolute top-0 left-0 w-full h-full bg-black/50 flex flex-col justify-center items-center text-center px-6">
        <h1 className="text-4xl md:text-6xl font-bold text-[#F4A261] mb-4 drop-shadow-lg" style={{ textShadow: '0 0 5px rgba(244, 162, 97, 0.6)' }}>
          <BlurText
            text="Cinema Republic Ltd."
            delay={150}
            animateBy="words"
            direction="top"
            className="text-6xl mb-2 [text-shadow:0_0_5px_rgba(244,162,97,0.6)]"
          />

        </h1>
        <p className="text-lg md:text-xl text-[#F1FAEE] max-w-xl drop-shadow-md">
          Bringing the big screen to you. Experience movies under the stars—no theater needed.
        </p>
      </div>
    </div>
  );
};

export default HeroSection;
