import React from 'react';

const AboutCinema57 = () => {
  return (
    <section className="w-full bg-[#F1FAEE] py-16 px-6 scroll-element">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-10 items-center">

        {/* Text Section */}
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0D1B2A] mb-4">
            Our Premier Open-Air Cinema
          </h2>
          <p className="text-[#0D1B2A]/80 text-lg leading-relaxed">
            <span className="text-[#F4A261] font-semibold [text-shadow:0_0_5px_rgba(244,162,97,0.6)]">Cinema Republic Ltd.</span> brings the magic of movies to open skies —
            offering immersive cinema experiences. From serene beachfronts to
            vibrant community spaces, we specialize in creating unique moments under the stars.
          </p>
          <p className="mt-4 text-[#0D1B2A]/80 text-lg leading-relaxed">
            Whether you're out with the family, on a date, or exploring local culture,
            our events offer something truly special. Discover the next generation of
            cinema without walls — just vibes, stories, and sea breeze.
          </p>
        </div>

        {/* Image Placeholder */}
        <div className="w-full h-64 md:h-96 bg-gray-300 rounded-lg shadow-md overflow-hidden">
          {/* Replace with your image or video */}
          <img
            src="/img1.jpg"
            alt="Cinema Republic at the beach"
            className="w-full h-full object-cover"
          />
        </div>

      </div>
    </section>
  );
};

export default AboutCinema57;
