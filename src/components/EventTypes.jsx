import React from 'react';

const events = [
  {
    title: 'Family Night',
    description: 'Animated classics & fun for all ages.',
    image: '/family.jpg',
  },
  {
    title: 'Date Night',
    description: 'Romantic stories under starry skies.',
    image: '/daten.avif',
  },
  {
    title: 'Holiday Specials',
    description: 'Themed screenings for every celebration.',
    image: '/holiday.avif',
  },
  {
    title: 'Cultural Screenings',
    description: 'Ghanaian stories, music, and heritage.',
    image: '/og_cultural.jpeg',
  },
  {
    title: 'Silent Cinema',
    description: 'Immersive audio through wireless headphones.',
    image: '/cultural.avif',
  },
];

const EventTypes = () => {
  return (
    <section className="w-full bg-[#0D1B2A] py-16 px-6">
      <div className="max-w-7xl mx-auto text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-[#F4A261] mb-4 [text-shadow:0_0_5px_rgba(244,162,97,0.6)]">Our Event Experiences</h2>
        <p className="text-[#F1FAEE] max-w-2xl mx-auto">
          From cozy date nights to vibrant cultural showcases — Cinema 57 curates every experience
          to make it magical.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
        {events.map((event, index) => (
          <div
            key={index}
            className="group relative rounded-lg overflow-hidden shadow-lg cursor-pointer hover:scale-105 transition-transform duration-300"
          >
            <img
              src={event.image}
              alt={event.title}
              className="w-full h-64 object-cover brightness-75 group-hover:brightness-100 transition duration-300"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-4">
              <h3 className="text-[#F4A261] text-xl font-semibold [text-shadow:0_0_5px_rgba(244,162,97,0.6)]">{event.title}</h3>
              <p className="text-[#F1FAEE] text-sm">{event.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default EventTypes;
