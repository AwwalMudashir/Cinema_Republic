import React from 'react';

const cinewavFeatures = [
  {
    title: '🎧 Personal Audio Comfort',
    text: 'Use your own headphones for superior comfort and preferred audio quality.',
  },
  {
    title: '🌐 Multilingual Playback',
    text: 'Select your language in-app. Watch comfortably in your native tongue.',
  },
  {
    title: '📲 Smart Convenience',
    text: 'Book tickets, order snacks, and even gift events — right from your phone.',
  },
];

const glowStyle = {
  textShadow: '0 0 5px rgba(244, 162, 97, 0.6)',
};

const SilentVsTraditional = () => {
  return (
    <section className="bg-gradient-to-b scroll-element from-[#0D1B2A] to-[#060F1A] text-[#F1FAEE] px-6 py-20 relative overflow-hidden">
      {/* Intro Title */}
      <div className="max-w-4xl mx-auto text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-bold text-[#F4A261] mb-4" style={glowStyle}>
          Two Ways to Experience the Magic
        </h2>
        <p className="text-[#F1FAEE]/80 max-w-xl mx-auto text-lg">
          Whether you want to feel the crowd energy or enjoy a private escape, we’ve got the perfect sound experience for you.
        </p>
      </div>

      {/* Experience Comparison */}
      <div className="grid md:grid-cols-2 gap-10 max-w-6xl mx-auto mb-20">
        {/* Traditional */}
        <div className="backdrop-blur bg-white/5 border border-[#F4A261]/30 rounded-2xl p-8 shadow-xl hover:scale-105 transition duration-300">
          <h3 className="text-2xl font-semibold text-[#F4A261] mb-4" style={glowStyle}>
            🔊 Traditional Cinema
          </h3>
          <ul className="space-y-3 text-[#F1FAEE]/90 text-base">
            <li>🎬 Audio through powerful speakers for shared reactions</li>
            <li>🌊 Ambient beachside atmosphere enhances the vibe</li>
            <li>👥 Ideal for big crowds, festivals, and public events</li>
          </ul>
        </div>

        {/* Silent */}
        <div className="backdrop-blur bg-white/5 border border-[#F4A261]/30 rounded-2xl p-8 shadow-xl hover:scale-105 transition duration-300">
          <h3 className="text-2xl font-semibold text-[#F4A261] mb-4" style={glowStyle}>
            🎧 Silent Cinema
          </h3>
          <ul className="space-y-3 text-[#F1FAEE]/90 text-base">
            <li>🔇 No noise disruptions — perfect for sensitive zones</li>
            <li>🔊 Volume control in your hands</li>
            <li>🙌 Enjoy the film without distractions</li>
          </ul>
        </div>
      </div>

      {/* Cinewav Features */}
      <div className="text-center mb-12">
        <h3 className="text-2xl font-semibold text-[#F4A261]" style={glowStyle}>
          Powered by Cinewav 🚀
        </h3>
        <p className="text-[#F1FAEE]/80 text-base text-lg mt-2">
          Cinema Republic Limited is the first in Nigeria to use Cinewav — turning your phone into your cinema speaker.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {cinewavFeatures.map((item, index) => (
          <div
            key={index}
            className="bg-[#1A2A3C]/80 backdrop-blur-sm p-6 rounded-xl shadow-lg hover:shadow-[#F4A261]/40 transition-all duration-300 border border-[#F4A261]/20"
          >
            <h4 className="text-xl text-[#F4A261] font-semibold mb-2" style={glowStyle}>
              {item.title}
            </h4>
            <p className="text-[#F1FAEE]/80  text-lg">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default SilentVsTraditional;
