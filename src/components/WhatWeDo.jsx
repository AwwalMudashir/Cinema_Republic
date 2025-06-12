import React from 'react';
import { motion } from 'framer-motion';

const services = [
  {
    icon: '🎬',
    title: 'Open-Air Screenings',
    text: 'We host outdoor cinema experiences in stunning public and private spaces across Ghana.',
  },
  {
    icon: '🎧',
    title: 'Silent Cinema (Cinewav)',
    text: 'Guests enjoy personal audio through their phones, powered by Cinewav’s groundbreaking tech.',
  },
  {
    icon: '🎟️',
    title: 'Event Partnerships',
    text: 'We partner with venues, festivals, and brands to create unforgettable cinematic events.',
  },
  {
    icon: '📽️',
    title: 'Cultural & Educational Films',
    text: 'Cinema 57 showcases Ghanaian culture and supports the next generation of filmmakers.',
  },
];

const glowStyle = {
  textShadow: '0 0 5px rgba(244, 162, 97, 0.6)',
};

const WhatWeDo = () => {
  return (
    <section className="bg-[#E0F4EA] py-20 px-6">
      <div className="max-w-7xl mx-auto text-center mb-14">
        <h2
          className="text-4xl md:text-5xl font-bold text-[#F4A261]"
          style={glowStyle}
        >
          What We Do
        </h2>
        <p className="text-[#0D1B2A]/80 mt-4 max-w-2xl mx-auto text-lg">
          From community screenings to luxury partnerships, our goal is to make unforgettable film moments accessible everywhere.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
        {services.map((service, idx) => {
          const slideInDirection = idx % 2 === 0 ? -100 : 100; // Alternate left/right

          return (
            <motion.div
              key={idx}
              className="bg-white rounded-xl p-6 shadow-md"
              initial={{ opacity: 0, x: slideInDirection }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <div className="text-4xl mb-3">{service.icon}</div>
              <h3 className="text-xl font-semibold text-[#0D1B2A] mb-2">{service.title}</h3>
              <p className="text-[#0D1B2A]/80">{service.text}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default WhatWeDo;
