import React from 'react';

const glowStyle = {
  textShadow: '0 0 5px rgba(244, 162, 97, 0.6)',
};

const OurStory = () => {
  return (
    <section className="bg-[#E0F4EA] py-20 px-6">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">

        {/* Text Content */}
        <div>
          <h2
            className="text-4xl md:text-5xl font-bold text-[#F4A261] mb-6"
            style={glowStyle}
          >
            Our Story
          </h2>
          <p className="text-[#0D1B2A]/80 text-lg leading-relaxed">
            Cinema 57 was born from a desire to make film accessible beyond traditional theater walls.
            What began as an ambitious idea soon became a movement — a cultural experience that brings
            people together under the stars, across beaches, parks, and local communities throughout Ghana.
          </p>
          <p className="mt-4 text-[#0D1B2A]/80 text-lg leading-relaxed">
            We’re not just about movies. We’re about memories — creating spaces where families bond,
            artists shine, and stories live beyond the screen.
          </p>
        </div>

        {/* Image */}
        <div className="w-full h-96 rounded-xl overflow-hidden shadow-md">
          <img
            src="/our.jpeg" // Replace with your actual image
            alt="Our Story"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </section>
  );
};

export default OurStory;
