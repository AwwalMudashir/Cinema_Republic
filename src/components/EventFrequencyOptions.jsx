import React from 'react';

const glowStyle = {
  textShadow: '0 0 5px rgba(244, 162, 97, 0.6)',
};

const EventFrequencyOptions = () => {
  return (
    <section className="bg-[#E0F4EA] py-20 px-6">
      <div className="max-w-6xl mx-auto text-center mb-12">
        <h2
          className="text-4xl md:text-5xl font-bold text-[#F4A261] mb-4"
          style={glowStyle}
        >
          Weekly vs Monthly Events
        </h2>
        <p className="text-[#0D1B2A]/80 max-w-2xl mx-auto text-lg">
          Choose the rhythm that fits your audience and goals — consistent buzz or big cinematic moments.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {/* Weekly */}
        <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-lg transition">
          <h3 className="text-2xl font-semibold text-[#0D1B2A] mb-4">📅 Weekly Events</h3>
          <p className="text-[#0D1B2A]/80 text-base leading-relaxed">
            Weekly screenings create a regular attraction that boosts foot traffic and guest engagement.
            They offer consistent opportunities to showcase the hotel’s amenities, restaurant, and services.
            Ideal for guests who love routine and new visitors looking for something fun every week.
          </p>
        </div>

        {/* Monthly */}
        <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-lg transition">
          <h3 className="text-2xl font-semibold text-[#0D1B2A] mb-4">🌟 Monthly Events</h3>
          <p className="text-[#0D1B2A]/80 text-base leading-relaxed">
            Monthly events allow for bigger, high-impact experiences. These feel special, attract larger crowds,
            and can be heavily promoted with themed visuals, trailers, and guest excitement.
            Great for creating hype and delivering a cinematic "event" feel.
          </p>
        </div>
      </div>
    </section>
  );
};

export default EventFrequencyOptions;
