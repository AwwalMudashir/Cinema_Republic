import React, { useEffect } from 'react';

const ScrollAnimation = () => {
  useEffect(() => {
    const scrollElements = document.querySelectorAll('.scroll-element');

    // Check if the element is in view (entering the viewport)
    const elementInView = (el, offset = 100) => {
      const elementTop = el.getBoundingClientRect().top;
      return (
        elementTop <=
        (window.innerHeight || document.documentElement.clientHeight) - offset
      );
    };

    // Check if the element is out of view (above the viewport)
    const elementOutOfView = (el, offset = 100) => {
      const elementBottom = el.getBoundingClientRect().bottom;
      return (
        elementBottom >
        (window.innerHeight || document.documentElement.clientHeight) + offset
      );
    };

    // Handle scroll animation
    const handleScroll = () => {
      scrollElements.forEach((el) => {
        if (elementInView(el, 100)) {
          el.classList.add('visible'); // Trigger fade-in when entering the viewport
          el.classList.remove('scrolling-up'); // Remove reverse animation when scrolling down
        } else if (elementOutOfView(el, 100)) {
          el.classList.remove('visible'); // Fade out when scrolling up
          el.classList.add('scrolling-up'); // Trigger reverse animation
        }
      });
    };

    window.addEventListener('scroll', handleScroll);

    // Run initially to apply animations on load
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return null;
};

export default ScrollAnimation;
