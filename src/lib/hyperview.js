const brandRoot = '/Hyperview - Brand assets/Hyperview - Brand assets';

export const hyperViewAssets = {
  lightLogo: encodeURI(`${brandRoot}/Logo/Logos/Logo - 01.png`),
  darkLogo: encodeURI(`${brandRoot}/Logo/Logos/Logo - 02.png`),
  flightPoster: encodeURI(`${brandRoot}/Creative assets/poster-a.jpeg`),
  skiesPoster: encodeURI(`${brandRoot}/Creative assets/poster-b.jpeg`),
  experiencePoster: encodeURI(`${brandRoot}/Creative assets/Hpyerview Flyer - 03 copy.jpg`),
  comingSoonPoster: encodeURI(`${brandRoot}/Creative assets/Hpyerview Flyer - 01.jpg`),
  readyToFlyPoster: encodeURI(`${brandRoot}/Creative assets/Hpyerview Flyer - 03.jpg`),
  visitorGuide: encodeURI(`${brandRoot}/Creative assets/Hyperview Flyer - 02.jpg`),
};

const liveRoot = '/9d-cinema';

export const hyperViewLive = {
  photos: [
    {
      src: `${liveRoot}/9D-pic1.jpeg`,
      alt: 'Guests inside HyperView watching an immersive flying-cinema sequence',
      title: 'Inside the adventure',
    },
    {
      src: `${liveRoot}/9D-pic2.jpeg`,
      alt: 'HyperView guests seated together in the motion cinema',
      title: 'Ready for take-off',
    },
    {
      src: `${liveRoot}/9D-pic3.jpeg`,
      alt: 'Guests reacting during the live HyperView 9D experience',
      title: 'Real reactions',
    },
  ],
  videos: [
    {
      src: `${liveRoot}/9d-vid1.mp4`,
      title: 'Inside the live HyperView 9D experience',
      poster: `${liveRoot}/9D-pic3.jpeg`,
      duration: '1:02',
    },
    {
      src: `${liveRoot}/9d-vid2.mp4`,
      title: 'Guests taking flight at HyperView',
      poster: `${liveRoot}/9D-pic2.jpeg`,
      duration: '0:11',
    },
    {
      src: `${liveRoot}/9d-vid3.mp4`,
      title: 'The HyperView motion-cinema experience',
      poster: `${liveRoot}/9D-pic1.jpeg`,
      duration: '0:15',
    },
  ],
};
