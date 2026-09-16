import React from 'react';
import { BadgeCheck, CalendarRange, Sparkles, UsersRound } from 'lucide-react';

const reasons = [
  { text: 'Enhance guest experience with curated film nights', icon: Sparkles },
  { text: 'Create recurring or high-profile events that boost hotel visibility', icon: CalendarRange },
  { text: 'Collaborate with a professional cinema team with proven success', icon: BadgeCheck },
  { text: 'Engage the community while promoting your venue', icon: UsersRound },
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
          {reasons.map((reason, idx) => {
            const Icon = reason.icon;
            return (
            <div key={idx} className="bg-white p-6 rounded-xl shadow-md">
              <div className="feature-icon feature-icon--light"><Icon size={21} strokeWidth={1.8} /></div>
              <p className="text-[#0D1B2A]/90 text-base">{reason.text}</p>
            </div>
          )})}
        </div>
      </div>
    </section>
  );
};

export default WhyPartner;
