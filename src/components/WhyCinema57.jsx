import React from 'react';

const reasons = [
  {
    title: 'Experience & Expertise',
    text: 'Cinema 57 is a trusted leader in open-air cinema events across Ghana.',
  },
  {
    title: 'Marketing Support',
    text: 'We provide custom marketing materials including graphics, videos, and event content.',
  },
  {
    title: 'Ghanaian Cinema Focus',
    text: 'We proudly highlight local films and support Ghanaian storytellers.',
  },
  {
    title: 'Quality Equipment',
    text: 'Our setups include professional-grade audio-visual equipment for the best viewer experience.',
  },
];

const glowStyle = {
  textShadow: '0 0 5px rgba(244, 162, 97, 0.6)',
};

const WhyCinema57 = () => {
  return (
    <section className="bg-[#0D1B2A] py-20 px-6 scroll-element">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">

        {/* Text Section */}
        <div>
          <h2
            className="text-4xl md:text-5xl font-bold text-[#F4A261] mb-10"
            style={glowStyle}
          >
            Why Choose Cinema 57?
          </h2>

          <div className="space-y-8">
            {reasons.map((reason, idx) => (
              <div key={idx}>
                <h3 className="text-xl font-semibold text-[#E9C46A] mb-1">
                  {reason.title}
                </h3>
                <p className="text-[#F1FAEE]/80 text-base">{reason.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Image Section */}
        <div className="w-full h-96 rounded-xl overflow-hidden shadow-lg border border-[#F4A261]/30">
          <img
            src="/why.PNG"
            alt="Cinema 57 event"
            className="w-full h-full object-cover"
          />
        </div>

      </div>
    </section>
  );
};

export default WhyCinema57;
