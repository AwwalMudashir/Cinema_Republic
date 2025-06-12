import React from 'react';

const PartnershipCTA = () => {
  return (
    <section className="bg-[#F1FAEE] py-20 px-6 text-center">
      <h2
        className="text-3xl md:text-4xl font-bold text-[#F4A261] mb-4"
        style={{ textShadow: '0 0 5px rgba(244, 162, 97, 0.6)' }}
      >
        Ready to Host Your First Outdoor Cinema Experience?
      </h2>
      <p className="text-[#0D1B2A]/80 text-lg mb-6">
        Let’s build something magical together. We’ll bring the screen. You bring the space.
      </p>
      <a
        href="/contact"
        className="inline-block bg-[#F4A261] text-[#0D1B2A] font-semibold py-3 px-8 rounded-lg shadow-md hover:bg-[#e78e45] transition-all"
      >
        Start a Partnership
      </a>
    </section>
  );
};

export default PartnershipCTA;
