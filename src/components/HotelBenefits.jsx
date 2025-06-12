import React from 'react';

const benefits = [
  "Increased foot traffic through recurring weekly events",
  "Opportunities to promote hotel services, restaurants & amenities",
  "Higher visibility on social media through shared event coverage",
  "Tailored themes for holidays, cultural nights & corporate events"
];

const glowStyle = {
  textShadow: '0 0 5px rgba(244, 162, 97, 0.6)',
};

const HotelBenefits = () => {
  return (
    <section className="bg-[#0D1B2A] py-20 px-6 text-[#F1FAEE]">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold text-[#F4A261] mb-10 text-center" style={glowStyle}>
          Benefits for Hotels & Venues
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {benefits.map((item, idx) => (
            <div key={idx} className="bg-[#1A2A3C] p-6 rounded-lg shadow-md">
              <p className="text-[#F1FAEE]/80">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HotelBenefits;
