import React, { useState,useEffect } from 'react';
import './contact.css';
import Notification from '../components/Notification';
import emailjs from '@emailjs/browser';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });

  const [notification, setNotification] = useState({
    isVisible: false,
    type: 'success',
    message: ''
  });

  const showNotification = (type, message) => {
    setNotification({
      isVisible: true,
      type,
      message
    });
  };

  const hideNotification = () => {
    setNotification(prev => ({ ...prev, isVisible: false }));
  };

  function initializeEmailJS(){
     emailjs.init("zGUCuE-JqjWSe1bi0"); 
  }

  useEffect(() => {
    initializeEmailJS();
  }, []);

  function sendEmail(e) {
    e.preventDefault();
    
    // Basic form validation
    if (!formData.name || !formData.email || !formData.message) {
      showNotification('error', 'Please fill in all fields before sending.');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      showNotification('error', 'Please enter a valid email address.');
      return;
    }

    emailjs.send("service_iq74xmt", "template_ju85c1o", formData).then(function() {
      showNotification('success', 'Message sent successfully! We\'ll get back to you soon.');
      // Reset form
      setFormData({ name: '', email: '', message: '' });
    }, function(error) {
      showNotification('error', 'Failed to send message. Please try again or contact us directly.');
      console.error('EmailJS Error:', error);
    });
  }

  return (
    <>
      <Notification
        isVisible={notification.isVisible}
        type={notification.type}
        message={notification.message}
        onClose={hideNotification}
        duration={6000}
      />
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
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-3 rounded-lg border border-[#ccc] focus:outline-none focus:ring-2 focus:ring-[#F4A261]"
          />
          <input
            type="email"
            placeholder="Your Email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-3 rounded-lg border border-[#ccc] focus:outline-none focus:ring-2 focus:ring-[#F4A261]"
          />
          <textarea
            placeholder="Your Message"
            rows="5"
            className="w-full px-4 py-3 rounded-lg border border-[#ccc] focus:outline-none focus:ring-2 focus:ring-[#F4A261]"
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          ></textarea>
          <button
            type="submit"
            className="bg-[#F4A261] cursor-pointer text-[#0D1B2A] font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-[#e78e45] transition-all"
            onClick={sendEmail}
          >
            Send Message
          </button>
        </form>
      </div>
    </section>
    </>
  );
};

export default Contact;
