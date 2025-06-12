import React from 'react';
import './contact.css'

const Contact = () => {
  return (
    <section className="contact-section">
      {/* Image Side */}
      <div className="md:w-1/2 w-full h-64 md:h-auto">
        <img
          src="/contact.jpg" // Replace with your image
          alt="Cinema 57 Event"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Form Side */}
      <div className="md:w-1/2 w-full p-10 flex flex-col justify-center">
        <h2 className="text-3xl font-bold text-[#F4A261] mb-6" style={{ textShadow: '0 0 5px rgba(244, 162, 97, 0.6)' }}>
          Get In Touch
        </h2>
        <form className="space-y-4">
          <input
            type="text"
            placeholder="Your Name"
            className="w-full px-4 py-3 rounded-lg border border-[#ccc] focus:outline-none focus:ring-2 focus:ring-[#F4A261]"
          />
          <input
            type="email"
            placeholder="Your Email"
            className="w-full px-4 py-3 rounded-lg border border-[#ccc] focus:outline-none focus:ring-2 focus:ring-[#F4A261]"
          />
          <textarea
            placeholder="Your Message"
            rows="5"
            className="w-full px-4 py-3 rounded-lg border border-[#ccc] focus:outline-none focus:ring-2 focus:ring-[#F4A261]"
          ></textarea>
          <button
            type="submit"
            className="bg-[#F4A261] text-[#0D1B2A] font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-[#e78e45] transition-all"
          >
            Send Message
          </button>
        </form>
      </div>
    </section>
  );
};

export default Contact;
