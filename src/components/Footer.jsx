import React from 'react';

const Footer = () => {
  return (
    <footer className="px-6 py-12" style={{ backgroundColor: '#0D1B2A', color: '#E9C46A' }}>
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 text-sm">

        {/* Logo and Description */}
        <div>
          <h2 className="text-2xl font-semibold mb-3" style={{ color: '#F4A261' }}>
            Cinema 57
          </h2>
          <p style={{ color: 'rgba(233, 196, 106, 0.8)' }}>
            Experience Ghana's premier open-air cinema. Unique events. Local culture. Beach vibes.
          </p>
        </div>

        {/* Navigation */}
        <div>
          <h3 className="mb-3 font-semibold text-lg" style={{ color: '#F4A261' }}>
            Explore
          </h3>
          <ul className="space-y-2">
            {['Home', 'About', 'Events', 'Contact'].map((item) => (
              <li
                key={item}
                className="cursor-pointer transition"
                style={{ color: '#E9C46A' }}
                onMouseOver={(e) => (e.target.style.color = '#F4A261')}
                onMouseOut={(e) => (e.target.style.color = '#E9C46A')}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Contact Info */}
        <div>
          <h3 className="mb-3 font-semibold text-lg" style={{ color: '#F4A261' }}>
            Contact
          </h3>
          <ul className="space-y-2">
            <li>
              Email:{' '}
              <a
                href="mailto:events@cinema57.org"
                style={{ color: '#E9C46A' }}
                onMouseOver={(e) => (e.target.style.color = '#F4A261')}
                onMouseOut={(e) => (e.target.style.color = '#E9C46A')}
              >
                events@cinema57.org
              </a>
            </li>
            <li>
              Phone:{' '}
              <a
                href="tel:+233244741756"
                style={{ color: '#E9C46A' }}
                onMouseOver={(e) => (e.target.style.color = '#F4A261')}
                onMouseOut={(e) => (e.target.style.color = '#E9C46A')}
              >
                +233 244 741 756
              </a>
            </li>
            <li>Accra, Ghana</li>
          </ul>
        </div>

        {/* Socials */}
        <div>
          <h3 className="mb-3 font-semibold text-lg" style={{ color: '#F4A261' }}>
            Follow Us
          </h3>
          <div className="flex gap-4">
            <a
              href="https://instagram.com/cinema_57"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#E9C46A' }}
              onMouseOver={(e) => (e.target.style.color = '#F4A261')}
              onMouseOut={(e) => (e.target.style.color = '#E9C46A')}
            >
              @cinema_57
            </a>
          </div>
        </div>
      </div>

      {/* Footer Bottom */}
      <div
        className="mt-10 pt-4 text-center text-xs"
        style={{
          borderTop: '1px solid rgba(233, 196, 106, 0.3)',
          color: 'rgba(233, 196, 106, 0.7)',
        }}
      >
        &copy; {new Date().getFullYear()} Cinema 57. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
