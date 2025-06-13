import React from 'react';

const VisionSection = () => {
  return (
    <section className="w-full bg-[#E0F4EA] py-16 px-6 scroll-element">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-10 items-center">

        {/* Text Section */}
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0D1B2A] mb-4">
            Our Vision
          </h2>
          <p className="text-[#0D1B2A]/80 text-lg leading-relaxed">
            <span className="text-[#F4A261] font-semibold [text-shadow:0_0_5px_rgba(244,162,97,0.6)]">
              Cinema Republic Ltd
            </span>{' '}
            envisions a future where cinema breaks beyond walls — becoming a shared cultural
            ritual under open skies. Our goal is to blend immersive entertainment with local
            storytelling and community bonding.
          </p>
          <p className="mt-4 text-[#0D1B2A]/80 text-lg leading-relaxed">
            We’re passionate about creating accessible experiences that spotlight Ghanaian
            filmmakers, uplift local venues, and redefine how audiences connect through film.
          </p>
        </div>

        {/* Image Section */}
        <div className="w-full h-64 md:h-96 bg-gray-300 rounded-lg shadow-md overflow-hidden">
          <img
            src="/og_cultural.jpeg" // Replace with your actual image
            alt="Vision for Cinema 57"
            className="w-full h-full object-cover"
          />
        </div>

      </div>
    </section>
  );
};

export default VisionSection;
