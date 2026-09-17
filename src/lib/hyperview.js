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

export const hyperViewVideos = {
  introduction: {
    id: 'uqu2etL4tX8',
    title: 'Introducing HyperView 9D Flying Cinema',
    poster: hyperViewAssets.comingSoonPoster,
  },
  experience: {
    id: 'ew45a565jw8',
    title: 'The HyperView 9D Flying Cinema experience',
    poster: hyperViewAssets.experiencePoster,
  },
};
