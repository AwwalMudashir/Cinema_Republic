import React from 'react';

const glowStyle = {
  textShadow: '0 0 5px rgba(244, 162, 97, 0.6)',
};

const partners = [
  {
    name: 'La Palm Royal Beach Hotel',
    logo: '/c57.PNG',
  },
  {
    name: 'Cinewav',
    logo: '/cinemawav.PNG',
  },
];

const CurrentPartners = () => {
  return (
    <section className="bg-[#F1FAEE] py-16 px-6">
      <div className="max-w-6xl mx-auto text-center mb-10">
        <h2
          className="text-3xl md:text-4xl font-bold text-[#F4A261]"
          style={glowStyle}
        >
          Our Current Partners
        </h2>
      </div>

      <div className="flex flex-wrap justify-center items-center gap-10">
        {partners.map((partner, idx) => (
          <div
            key={idx}
            className="flex items-center justify-center  hover:brightness-110 transition"
          >
            <img
              src={partner.logo}
              alt={partner.name}
              className="h-48 w-96"
            />
          </div>
        ))}
      </div>
    </section>
  );
};

export default CurrentPartners;
