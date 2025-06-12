import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react'; // or Heroicons
import { Link, useNavigate } from 'react-router-dom';
import './components.css'

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = () => setMenuOpen(!menuOpen);

  const navigate = useNavigate();

  return (
    <nav
      className={`fixed w-full top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#0D1B2A] shadow-md' : 'bg-transparent'
        }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo */}
        <div
          className="text-[#F4A261] font-bold text-2xl tracking-wider cursor-pointer"
          style={{ textShadow: '0 0 8px rgba(244, 162, 97, 0.8), 0 0 15px rgba(244, 162, 97, 0.4)' }}
          onClick={() => navigate('/')}
        >
          <img src="/logo.png" alt="nope" className="h-12 w-auto object-contain" />
        </div>

        {/* Links - Desktop */}
        <ul className="navbar-links">
          <li
            className="text-[#F4A261] hover:text-white transition cursor-pointer"
            style={{ textShadow: '0 0 5px rgba(244, 162, 97, 0.6)' }}
          >
            <Link to={'/'}>
              Home
            </Link>
          </li>
          <li
            className="text-[#F4A261] hover:text-white transition cursor-pointer"
            style={{ textShadow: '0 0 5px rgba(244, 162, 97, 0.6)' }}
          >
            <Link to={'/about-us'}>
              About
            </Link>
          </li>
          <li
            className="text-[#F4A261] hover:text-white transition cursor-pointer"
            style={{ textShadow: '0 0 5px rgba(244, 162, 97, 0.6)' }}
          >
            <Link to={'/events'}>

              Events
            </Link>
          </li>
          <li
            className="text-[#F4A261] hover:text-white transition cursor-pointer"
            style={{ textShadow: '0 0 5px rgba(244, 162, 97, 0.6)' }}
          >
            <Link to={'/partnership'}>

              Partnership
            </Link>
          </li>
          <li
            className="text-[#F4A261] hover:text-white transition cursor-pointer"
            style={{ textShadow: '0 0 5px rgba(244, 162, 97, 0.6)' }}
          >
            <Link to={'/contact'}>

              Contact
            </Link>
          </li>
        </ul>

        {/* Hamburger - Mobile */}
        <div
          className="md:hidden text-[#E9C46A] z-50 cursor-pointer"
          onClick={toggleMenu}
          style={{ textShadow: '0 0 8px rgba(233, 196, 106, 0.8)' }}
        >
          {menuOpen ? <X size={28} /> : <Menu size={28} />}
        </div>

        {/* Mobile Menu */}
        <div
          className={`absolute top-0 left-0 w-full h-screen bg-[#0D1B2A] flex flex-col items-center justify-center gap-10 text-xl font-medium transform transition-transform duration-300 ${menuOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
        >
          <li
            onClick={toggleMenu}
            className="text-[#E9C46A] hover:text-[#F4A261] cursor-pointer"
            style={{ textShadow: '0 0 8px rgba(233, 196, 106, 0.8)' }}
          >
            <Link to={'/'}>

              Home
            </Link>
          </li>
          <li
            onClick={toggleMenu}
            className="text-[#E9C46A] hover:text-[#F4A261] cursor-pointer"
            style={{ textShadow: '0 0 8px rgba(233, 196, 106, 0.8)' }}
          >
            <Link to={'/about-us'}>
              About
            </Link>
          </li>
          <li
            onClick={toggleMenu}
            className="text-[#E9C46A] hover:text-[#F4A261] cursor-pointer"
            style={{ textShadow: '0 0 8px rgba(233, 196, 106, 0.8)' }}
          >
            <Link to={'/events'}>

              Events
            </Link>
          </li>
          <li
            onClick={toggleMenu}
            className="text-[#E9C46A] hover:text-[#F4A261] cursor-pointer"
            style={{ textShadow: '0 0 8px rgba(233, 196, 106, 0.8)' }}
          >
            <Link to={'/partnership'}>

              Partnership
            </Link>
          </li>
          <li
            onClick={toggleMenu}
            className="text-[#E9C46A] hover:text-[#F4A261] cursor-pointer"
            style={{ textShadow: '0 0 8px rgba(233, 196, 106, 0.8)' }}
          >
            <Link to={'/contact'}>

              Contact
            </Link>
          </li>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;