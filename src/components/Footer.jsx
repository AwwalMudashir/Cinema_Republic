import React from 'react';

// Inline CSS for responsive footer
const footerStyles = `
.responsive-footer {
  padding: 3rem 1.5rem;
  background-color: #0D1B2A;
  color: #E9C46A;
}
.responsive-footer-main {
  max-width: 80rem;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.5rem;
  font-size: 0.95rem;
}
.responsive-footer h2 {
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: #F4A261;
}
.responsive-footer h3 {
  margin-bottom: 0.75rem;
  font-weight: 600;
  font-size: 1.125rem;
  color: #F4A261;
}
.responsive-footer ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.responsive-footer li, .responsive-footer a {
  color: #E9C46A;
  transition: color 0.2s;
  margin-bottom: 0.5rem;
  cursor: pointer;
  text-decoration: none;
  font-size: 1em;
}
.responsive-footer li:hover, .responsive-footer a:hover {
  color: #F4A261;
}
.responsive-footer .footer-socials {
  display: flex;
  gap: 1rem;
}
.responsive-footer-bottom {
  margin-top: 2.5rem;
  padding-top: 1rem;
  text-align: center;
  font-size: 0.85rem;
  border-top: 1px solid rgba(233, 196, 106, 0.3);
  color: rgba(233, 196, 106, 0.7);
}

/* Responsive grid for footer columns */
@media (min-width: 600px) {
  .responsive-footer-main {
    grid-template-columns: 1fr 1fr;
  }
}
@media (min-width: 900px) {
  .responsive-footer-main {
    grid-template-columns: 1fr 1fr 1fr 1fr;
  }
}
`;

const Footer = () => {
  return (
    <>
      <style>{footerStyles}</style>
      <footer className="responsive-footer">
        <div className="responsive-footer-main">
          {/* Logo and Description */}
          <div>
            <h2>Cinema Republic Ltd.</h2>
            <p style={{ color: 'rgba(233, 196, 106, 0.8)' }}>
              Experience Ghana&apos;s premier open-air cinema. Unique events. Local culture. Beach vibes.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3>Explore</h3>
            <ul>
              {['Home', 'About', 'Events', 'Contact'].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3>Contact</h3>
            <ul>
              <li>
                Email:{' '}
                <a
                  href="mailto:events@cinema57.org"
                >
                  events@cinema57.org
                </a>
              </li>
              <li>
                Phone:{' '}
                <a
                  href="tel:+233244741756"
                >
                  +233 244 741 756
                </a>
              </li>
              <li>Accra, Ghana</li>
            </ul>
          </div>

          {/* Socials */}
          <div>
            <h3>Follow Us</h3>
            <div className="footer-socials">
              <a
                href="https://instagram.com/cinema_57"
                target="_blank"
                rel="noopener noreferrer"
              >

                @cinema_57
              </a>
            </div>
          </div>
        </div>

        <div className="responsive-footer-bottom">
          &copy; {new Date().getFullYear()} Cinema Republic Ltd. All rights reserved.
        </div>
      </footer>
    </>
  );
};

export default Footer;