import React from 'react';

const glowStyle = {
  textShadow: '0 0 5px rgba(244, 162, 97, 0.6)',
};

const PartnershipHero = () => {
  return (
    <section className="relative w-full h-screen overflow-hidden">
      <img
        src="/team.jpeg" // replace with your image
        alt="Cinema partnership event"
        className="absolute inset-0 w-full h-full object-cover z-0"
      />
      <div className="absolute inset-0 bg-black/60 z-10" />
      <div className="relative z-20 flex flex-col items-center justify-center h-full text-center px-6">
        <h1
          className="text-4xl md:text-6xl font-bold text-[#F4A261] mb-4"
          style={glowStyle}
        >
          Partner With Cinema Republic
        </h1>
        <p className="text-[#F1FAEE] text-lg md:text-xl max-w-2xl">
          Join us in creating unforgettable, culturally rooted cinema experiences for your guests and community.
        </p>
      </div>
    </section>
  );
};

export default PartnershipHero;
