import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import BlurText from '../animations/BlurText';
import './components.css';

const HeroSection = () => (
  <section className="home-hero relative w-full h-screen min-h-[680px] overflow-hidden">
    <video className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline>
      <source src="/bg_video1.mp4" type="video/mp4" />
      Your browser does not support the video tag.
    </video>
    <div className="home-hero__overlay absolute inset-0 flex flex-col justify-center items-center text-center px-6">
      <p className="home-hero__kicker">Open-air cinema · Nigeria</p>
      <h1 className="text-4xl md:text-6xl font-bold text-[#F4A261] mb-4 drop-shadow-lg">
        <BlurText text="Cinema Republic Ltd." delay={150} animateBy="words" direction="top" className="text-5xl md:text-7xl mb-2 [text-shadow:0_0_5px_rgba(244,162,97,0.6)]" />
      </h1>
      <p className="text-base md:text-xl text-[#F1FAEE] max-w-2xl drop-shadow-md">
        Bringing the big screen to you. Experience movies under the stars—no theatre needed.
      </p>
      <div className="home-hero__actions">
        <Link to="/events" className="home-hero__button home-hero__button--primary">Explore our experiences <ArrowRight size={18} /></Link>
      </div>
      <a href="#hyperview-feature-title" className="home-hero__scroll" aria-label="Discover HyperView 9D Flying Cinema"><span /> Discover HyperView 9D</a>
    </div>
  </section>
);

export default HeroSection;
