import React from 'react';

const mediaItems = [
  {
    type: 'image',
    src: '/one.jpeg',
    caption: 'We brought the magic of African cinema to #AfroPark2024! From thought-provoking media workshops to screenings of films',
  },
  {
    type: 'video',
    src: '/uno.mp4',
    caption: 'Movie Night with Reel Change World AIDS Day 2024. Sponsored by the French Embassy and UNAIDS, in collaboration with Reformation Community',
  },
  {
    type: 'image',
    src: '/two.jpeg',
    caption: 'We brought the magic of African cinema to #AfroPark2024! From thought-provoking media workshops to screenings of films',
  },
  {
    type: 'video',
    src: '/dos.mp4',
    caption: '#throwback to an amazing experience at #REELCHANGE.',
  },
  {
    type: 'image',
    src: '/three.jpeg',
    caption: 'What an amazing experience speaking alongside truly amazing people in the cinema industry at this year"s @berlinalespotlightaccra ',
  },
  {
    type: 'video',
    src: '/tres.mp4',
    caption: 'Avalon Movie Night was epic!, Catch the highlights and relive the memorable moments. Stay tuned',
  },
  {
    type: 'image',
    src: '/four.jpeg',
    caption: "We couldn't have asked for a better audience. #ForTheMANDEM was an absolute success. Huge thanks to our amazing partners @afropark.creatives and @buroghana",
  },
  {
    type: 'video',
    src: '/bg_video1.mp4',
    caption: 'An Outdoor Cinema Experience at Festival of Lights. Brought to you by @cinema_57 , this cozy under-the-stars movie night features festive films ',
  },

];

const EventsGallery = () => {
  return (
    <section className="bg-[#F1FAEE] py-16 px-6">
      <div className="max-w-7xl mx-auto grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {mediaItems.map((item, idx) => (
          <div
            key={idx}
            className="overflow-hidden rounded-xl shadow-lg hover:scale-105 transition-transform duration-300 bg-white"
          >
            {item.type === 'image' ? (
              <img
                src={item.src}
                alt={`event-${idx}`}
                className="w-full h-64 object-cover"
              />
            ) : (
              <video
                src={item.src}
                controls
                className="w-full h-64 object-cover"
              />
            )}
            <div className="p-4 text-[#0D1B2A]/80 text-sm font-medium">
              {item.caption}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default EventsGallery;
