import React from 'react';

const screens = [
  {
    title: 'P-20 Screen',
    image: '/p20.PNG', // Replace with your actual image path
    dimensions: '20ft wide × 11ft high',
    capacity: '500 blankets • 1,000 chairs • 3,000 standing',
    description: 'Perfect for weekly events and intimate community gatherings. Lightweight and compact for frequent setup.',
  },
  {
    title: 'E-30 Screen',
    image: '/e30.PNG', // Replace with your actual image path
    dimensions: '30ft wide × 17ft high',
    capacity: '1,500 blankets • 3,000 chairs • 9,000 standing',
    description: 'Ideal for large monthly events and high-profile screenings. More immersive with wide reach.',
  },
];

const glowStyle = {
  textShadow: '0 0 5px rgba(244, 162, 97, 0.6)',
};

const CinemaScreens = () => {
  return (
    <section className="bg-[#F1FAEE] py-20 px-6">
      <div className="max-w-7xl mx-auto text-center mb-16">
        <h2
          className="text-4xl md:text-5xl font-bold text-[#F4A261] mb-4"
          style={glowStyle}
        >
          Cinema Screen Options
        </h2>
        <p className="text-[#0D1B2A]/80 max-w-2xl mx-auto text-lg">
          Tailored for both cozy weekly shows and massive monthly experiences at La Palm Royal Beach Hotel.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
        {screens.map((screen, index) => (
          <div
            key={index}
            className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300"
          >
            <img
              src={screen.image}
              alt={screen.title}
              className="w-full h-64 object-cover"
            />
            <div className="p-6 text-left">
              <h3
                className="text-2xl font-bold text-[#F4A261] mb-2"
                style={glowStyle}
              >
                {screen.title}
              </h3>
              <p className="text-[#0D1B2A]/80 mb-1">
                <strong>Dimensions:</strong> {screen.dimensions}
              </p>
              <p className="text-[#0D1B2A]/80 mb-1">
                <strong>Capacity:</strong> {screen.capacity}
              </p>
              <p className="text-[#0D1B2A]/80">{screen.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CinemaScreens;
