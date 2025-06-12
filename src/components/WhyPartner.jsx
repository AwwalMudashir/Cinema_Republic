import React from 'react';

const reasons = [
  "Enhance guest experience with curated film nights",
  "Create recurring or high-profile events that boost hotel visibility",
  "Collaborate with a professional cinema team with proven success",
  "Engage the community while promoting your venue"
];

const glowStyle = {
  textShadow: '0 0 5px rgba(244, 162, 97, 0.6)',
};

const WhyPartner = () => {
  return (
    <section className="bg-[#E0F4EA] py-20 px-6 scroll-element">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-4xl font-bold text-[#F4A261] mb-10" style={glowStyle}>
          Why Partner With Us?
        </h2>
        <div className="grid md:grid-cols-2 gap-8 text-left">
          {reasons.map((reason, idx) => (
            <div key={idx} className="bg-white p-6 rounded-xl shadow-md">
              <p className="text-[#0D1B2A]/90 text-base">{reason}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyPartner;
