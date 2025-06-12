import React from 'react';

const Footer = () => {
  return (
    <footer
      style={{
        padding: '3rem 1.5rem',
        backgroundColor: '#0D1B2A',
        color: '#E9C46A',
      }}
    >
      <div
        style={{
          maxWidth: '80rem',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: '2.5rem',
          fontSize: '0.875rem',
        }}
      >
        {/* Logo and Description */}
        <div>
          <h2
            style={{
              fontSize: '2rem',
              fontWeight: 600,
              marginBottom: '0.75rem',
              color: '#F4A261',
            }}
          >
            Cinema 57
          </h2>
          <p style={{ color: 'rgba(233, 196, 106, 0.8)' }}>
            Experience Ghana&apos;s premier open-air cinema. Unique events. Local culture. Beach vibes.
          </p>
        </div>

        {/* Navigation */}
        <div>
          <h3
            style={{
              marginBottom: '0.75rem',
              fontWeight: 600,
              fontSize: '1.125rem',
              color: '#F4A261',
            }}
          >
            Explore
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {['Home', 'About', 'Events', 'Contact'].map((item) => (
              <li
                key={item}
                style={{
                  cursor: 'pointer',
                  transition: 'color 0.2s',
                  color: '#E9C46A',
                  marginBottom: '0.5rem',
                }}
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
          <h3
            style={{
              marginBottom: '0.75rem',
              fontWeight: 600,
              fontSize: '1.125rem',
              color: '#F4A261',
            }}
          >
            Contact
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li>
              Email:{' '}
              <a
                href="mailto:events@cinema57.org"
                style={{ color: '#E9C46A', transition: 'color 0.2s' }}
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
                style={{ color: '#E9C46A', transition: 'color 0.2s' }}
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
          <h3
            style={{
              marginBottom: '0.75rem',
              fontWeight: 600,
              fontSize: '1.125rem',
              color: '#F4A261',
            }}
          >
            Follow Us
          </h3>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <a
              href="https://instagram.com/cinema_57"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#E9C46A', transition: 'color 0.2s' }}
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
        style={{
          marginTop: '2.5rem',
          paddingTop: '1rem',
          textAlign: 'center',
          fontSize: '0.75rem',
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
