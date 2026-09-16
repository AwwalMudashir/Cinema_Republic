import React from 'react';
import {
  Clapperboard,
  Focus,
  Headphones,
  Languages,
  Rocket,
  SlidersHorizontal,
  Smartphone,
  UsersRound,
  Volume2,
  VolumeX,
  Waves,
} from 'lucide-react';

const traditionalFeatures = [
  { icon: Clapperboard, text: 'Audio through powerful speakers for shared reactions' },
  { icon: Waves, text: 'Ambient beachside atmosphere enhances the vibe' },
  { icon: UsersRound, text: 'Ideal for big crowds, festivals and public events' },
];

const silentFeatures = [
  { icon: VolumeX, text: 'No noise disruptions—perfect for sensitive zones' },
  { icon: SlidersHorizontal, text: 'Volume control stays in your hands' },
  { icon: Focus, text: 'Enjoy the film without distractions' },
];

const cinewavFeatures = [
  { icon: Headphones, title: 'Personal Audio Comfort', text: 'Use your own headphones for superior comfort and preferred audio quality.' },
  { icon: Languages, title: 'Multilingual Playback', text: 'Select your language in-app and watch comfortably in your native tongue.' },
  { icon: Smartphone, title: 'Smart Convenience', text: 'Book tickets, order snacks and even gift events—right from your phone.' },
];

const glowStyle = { textShadow: '0 0 5px rgba(244, 162, 97, 0.6)' };

const ExperienceCard = ({ icon, title, features }) => (
  <article className="backdrop-blur bg-white/5 border border-[#F4A261]/30 rounded-2xl p-8 shadow-xl hover:scale-[1.02] transition duration-300">
    <div className="experience-card__title">
      <div className="feature-icon feature-icon--dark">{React.createElement(icon, { size: 22, strokeWidth: 1.8 })}</div>
      <h3 className="text-2xl font-semibold text-[#F4A261]" style={glowStyle}>{title}</h3>
    </div>
    <ul className="comparison-list">
      {features.map((feature) => {
        const FeatureIcon = feature.icon;
        return <li key={feature.text}><FeatureIcon size={18} strokeWidth={1.8} /><span>{feature.text}</span></li>;
      })}
    </ul>
  </article>
);

const SilentVsTraditional = () => (
  <section className="bg-gradient-to-b scroll-element from-[#0D1B2A] to-[#060F1A] text-[#F1FAEE] px-6 py-20 relative overflow-hidden">
    <div className="max-w-4xl mx-auto text-center mb-16">
      <h2 className="text-4xl md:text-5xl font-bold text-[#F4A261] mb-4" style={glowStyle}>Two Ways to Experience the Magic</h2>
      <p className="text-[#F1FAEE]/80 max-w-xl mx-auto text-lg">Whether you want to feel the crowd energy or enjoy a private escape, we’ve got the perfect sound experience for you.</p>
    </div>

    <div className="grid md:grid-cols-2 gap-10 max-w-6xl mx-auto mb-20">
      <ExperienceCard icon={Volume2} title="Traditional Cinema" features={traditionalFeatures} />
      <ExperienceCard icon={Headphones} title="Silent Cinema" features={silentFeatures} />
    </div>

    <div className="text-center mb-12">
      <div className="cinewav-heading">
        <h3 className="text-2xl font-semibold text-[#F4A261]" style={glowStyle}>Powered by Cinewav</h3>
        <Rocket size={20} strokeWidth={1.8} />
      </div>
      <p className="text-[#F1FAEE]/80 text-lg mt-2">Cinema Republic Limited is the first in Nigeria to use Cinewav—turning your phone into your cinema speaker.</p>
    </div>

    <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
      {cinewavFeatures.map((item) => {
        const Icon = item.icon;
        return (
          <article key={item.title} className="bg-[#1A2A3C]/80 backdrop-blur-sm p-6 rounded-xl shadow-lg hover:shadow-[#F4A261]/40 transition-all duration-300 border border-[#F4A261]/20">
            <div className="feature-icon feature-icon--dark"><Icon size={22} strokeWidth={1.8} /></div>
            <h4 className="text-xl text-[#F4A261] font-semibold mb-2" style={glowStyle}>{item.title}</h4>
            <p className="text-[#F1FAEE]/80 text-base leading-relaxed">{item.text}</p>
          </article>
        );
      })}
    </div>
  </section>
);

export default SilentVsTraditional;
