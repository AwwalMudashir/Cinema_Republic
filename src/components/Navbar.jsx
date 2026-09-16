import React, { useEffect, useState } from 'react';
import { Menu, Ticket, X } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import './components.css';

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Movies', to: '/movies' },
  { label: 'About', to: '/about-us' },
  { label: 'Events', to: '/events' },
  { label: 'Partnership', to: '/partnership' },
  { label: 'Contact', to: '/contact' },
];

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <nav className={`site-nav ${scrolled ? 'site-nav--scrolled' : ''}`} aria-label="Main navigation">
      <div className="site-nav__inner">
        <Link className="site-nav__logo" to="/" aria-label="Cinema Republic home"><img src="/logo.png" alt="Cinema Republic" /></Link>
        <ul className="site-nav__links">
          {navItems.map((item) => <li key={item.to}><NavLink to={item.to} end={item.to === '/'}>{item.label}</NavLink></li>)}
        </ul>
        <Link to="/movies" className="site-nav__ticket"><Ticket size={16} /> Get tickets</Link>
        <button type="button" className="site-nav__toggle" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}>
          {menuOpen ? <X size={27} /> : <Menu size={27} />}
        </button>
        <div id="mobile-navigation" className={`site-nav__mobile ${menuOpen ? 'site-nav__mobile--open' : ''}`}>
          <p>Explore Cinema Republic</p>
          <ul>
            {navItems.map((item, index) => <li key={item.to}><span>0{index + 1}</span><NavLink to={item.to} end={item.to === '/'} onClick={() => setMenuOpen(false)}>{item.label}</NavLink></li>)}
          </ul>
          <Link className="site-nav__mobile-ticket" to="/movies" onClick={() => setMenuOpen(false)}><Ticket size={18} /> Browse movies & tickets</Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
