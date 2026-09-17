import React from 'react';
import { ArrowUpRight, Instagram, Mail, MapPin, Phone, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { hyperViewAssets } from '../lib/hyperview';

const Footer = () => (
  <footer className="site-footer">
    <div className="site-footer__banner">
      <div><span><Ticket size={19} /> Tickets are going digital</span><h2>Your next movie night starts here.</h2></div>
      <Link to="/movies">See upcoming movies <ArrowUpRight size={18} /></Link>
    </div>
    <div className="site-footer__main">
      <div className="site-footer__brand"><img src="/logo.png" alt="Cinema Republic" /><p>Unforgettable stories, open skies and the easy rhythm of a Lagos night.</p>
        <div className="site-footer__family"><span>Also from Cinema Republic</span><Link to="/partnership" aria-label="Discover HyperView 9D Flying Cinema"><img src={hyperViewAssets.lightLogo} alt="HyperView" loading="lazy" /></Link></div>
      </div>
      <div><h3>Explore</h3><ul><li><Link to="/">Home</Link></li><li><Link to="/movies">Movies & tickets</Link></li><li><Link to="/events">Experiences</Link></li><li><Link to="/about-us">Our story</Link></li></ul></div>
      <div><h3>Plan with us</h3><ul><li><Link to="/partnership">Partnerships</Link></li><li><Link to="/contact">Host a screening</Link></li><li><Link to="/contact">Get in touch</Link></li></ul></div>
      <div><h3>Find us</h3><ul className="site-footer__contact"><li><MapPin size={16} /><span>Lagos, Nigeria</span></li><li><Phone size={16} /><a href="tel:+2347036478493">+234 703 647 8493</a></li><li><Mail size={16} /><a href="mailto:events@cinema57.org">events@cinema57.org</a></li><li><Instagram size={16} /><a href="https://www.instagram.com/cinemarepublic_naija/" target="_blank" rel="noopener noreferrer">@cinemarepublic_naija</a></li></ul></div>
    </div>
    <div className="site-footer__bottom"><span>© {new Date().getFullYear()} Cinema Republic Ltd.</span><span>Stories feel bigger under the stars.</span></div>
  </footer>
);

export default Footer;
