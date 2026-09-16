import React from 'react';
import { CalendarHeart, Share2, TrendingUp, UtensilsCrossed } from 'lucide-react';

const benefits = [
  { text: 'Increased foot traffic through recurring weekly events', icon: TrendingUp },
  { text: 'Opportunities to promote hotel services, restaurants & amenities', icon: UtensilsCrossed },
  { text: 'Higher visibility on social media through shared event coverage', icon: Share2 },
  { text: 'Tailored themes for holidays, cultural nights & corporate events', icon: CalendarHeart },
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
          {benefits.map((item, idx) => {
            const Icon = item.icon;
            return (
            <div key={idx} className="bg-[#1A2A3C] p-6 rounded-lg shadow-md">
              <div className="feature-icon feature-icon--dark"><Icon size={21} strokeWidth={1.8} /></div>
              <p className="text-[#F1FAEE]/80">{item.text}</p>
            </div>
          )})}
        </div>
      </div>
    </section>
  );
};

export default HotelBenefits;
