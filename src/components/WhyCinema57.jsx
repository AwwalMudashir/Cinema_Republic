import React from 'react';
import { Award, Clapperboard, Megaphone, Projector } from 'lucide-react';

const reasons = [
  {
    title: 'Experience & Expertise',
    text: 'Cinema Republic is a trusted leader in open-air cinema events.',
    icon: Award,
  },
  {
    title: 'Marketing Support',
    text: 'We provide custom marketing materials including graphics, videos, and event content.',
    icon: Megaphone,
  },
  {
    title: 'Cinema Focus',
    text: 'We proudly highlight local films and support storytellers.',
    icon: Clapperboard,
  },
  {
    title: 'Quality Equipment',
    text: 'Our setups include professional-grade audio-visual equipment for the best viewer experience.',
    icon: Projector,
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
            Why Choose Us?
          </h2>

          <div className="space-y-8">
            {reasons.map((reason, idx) => {
              const Icon = reason.icon;
              return (
              <div key={idx} className="icon-copy-row">
                <div className="feature-icon feature-icon--dark"><Icon size={20} strokeWidth={1.8} /></div>
                <div>
                <h3 className="text-xl font-semibold text-[#E9C46A] mb-1">
                  {reason.title}
                </h3>
                <p className="text-[#F1FAEE]/80 text-base">{reason.text}</p>
                </div>
              </div>
            )})}
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
