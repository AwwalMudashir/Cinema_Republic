import React from 'react';

const team = [
  {
    name: 'Martin Mensah',
    role: 'Operations Manager',
    image: '/martin.PNG',
  },
  {
    name: 'Albert Sarpong',
    role: 'Gen. Manager',
    image: '/albert.PNG',
  },
  {
    name: 'Emmanuel Amon',
    role: 'Photography Team Lead',
    image: '/emma.PNG',
  },
  {
    name: 'Kobby Omari',
    role: 'Videography Team Lead',
    image: '/kobby.PNG',
  },
];

const glowStyle = {
  textShadow: '0 0 5px rgba(244, 162, 97, 0.6)',
};

const MeetTheTeam = () => {
  return (
    <section className="bg-[#F1FAEE] py-20 px-6 scroll-element">
      <div className="max-w-7xl mx-auto text-center mb-14">
        <h2
          className="text-4xl md:text-5xl font-bold text-[#F4A261]"
          style={glowStyle}
        >
          Meet the Team
        </h2>
        <p className="text-[#0D1B2A]/80 mt-4 max-w-xl mx-auto text-lg">
          The passionate people bringing open-air cinema to life.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 max-w-6xl mx-auto">
        {team.map((member, idx) => (
          <div
            key={idx}
            className="bg-white p-4 rounded-xl shadow-md hover:shadow-lg transition text-center"
          >
            <div className="w-full h-60 overflow-hidden rounded-lg mb-4">
              <img
                src={member.image}
                alt={member.name}
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-lg font-semibold text-[#0D1B2A]">{member.name}</h3>
            <p className="text-[#0D1B2A]/70 text-sm">{member.role}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default MeetTheTeam;
