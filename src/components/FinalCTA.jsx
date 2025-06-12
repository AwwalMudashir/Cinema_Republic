import React from 'react';

const glowStyle = {
  textShadow: '0 0 5px rgba(244, 162, 97, 0.6)',
};

const FinalCTA = () => {
  return (
    <section className="bg-[#0D1B2A] py-20 px-6 text-center text-[#F1FAEE]">
      <div className="max-w-3xl mx-auto">
        <h2
          className="text-4xl md:text-5xl font-bold text-[#F4A261] mb-6"
          style={glowStyle}
        >
          Ready to Bring the Big Screen to Your Space?
        </h2>
        <p className="text-lg text-[#F1FAEE]/80 mb-8">
          Whether you're planning a community event, hotel activation, or special occasion, Cinema 57 is your go-to partner.
        </p>
        <a
          href="/contact"
          className="inline-block bg-[#F4A261] text-[#0D1B2A] font-semibold py-3 px-8 rounded-lg shadow-md hover:bg-[#e78e45] transition-all"
          style={{ textShadow: 'none' }}
        >
          Book a Screening
        </a>
        <p className="mt-4 text-sm text-[#F1FAEE]/60">
          Or email us directly at{' '}
          <a href="mailto:events@cinema57.org" className="underline hover:text-[#F4A261]">
            events@cinema57.org
          </a>
        </p>
      </div>
    </section>
  );
};

export default FinalCTA;
