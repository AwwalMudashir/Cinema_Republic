const createScreeningDate = (daysFromToday) => {
  const date = new Date();
  date.setHours(19, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);

  return {
    id: date.toISOString().slice(0, 10),
    day: new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date),
    date: new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
    }).format(date),
    full: new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(date),
  };
};

export const movies = [
  {
    slug: 'legends-of-the-coast',
    title: 'Legends of the Coast',
    tagline: 'An unforgettable story, carried by the tide.',
    synopsis:
      'A visually rich West African adventure about family, courage and the stories that bind a community together.',
    image: '/og_cultural.jpeg',
    accent: '#f4a261',
    genre: 'Drama · Adventure',
    rating: '12A',
    runtime: '2h 08m',
    language: 'English',
    status: 'Now showing',
    featured: true,
    venue: 'Cinema Republic Open-Air Cinema, Lagos',
    dates: [createScreeningDate(2), createScreeningDate(3), createScreeningDate(9)],
    times: ['7:00 PM', '9:30 PM'],
  },
  {
    slug: 'love-in-every-frame',
    title: 'Love in Every Frame',
    tagline: 'Some stories are better beneath the stars.',
    synopsis:
      'A warm, funny romance about two creatives, one impossible deadline and a Lagos night neither expected.',
    image: '/daten.avif',
    accent: '#e76f51',
    genre: 'Romance · Comedy',
    rating: 'PG-13',
    runtime: '1h 54m',
    language: 'English',
    status: 'Now showing',
    venue: 'Cinema Republic Open-Air Cinema, Lagos',
    dates: [createScreeningDate(4), createScreeningDate(10), createScreeningDate(11)],
    times: ['7:30 PM', '10:00 PM'],
  },
  {
    slug: 'little-stars-big-dreams',
    title: 'Little Stars, Big Dreams',
    tagline: 'A big-screen adventure for the whole family.',
    synopsis:
      'Four young friends turn a school holiday into a colourful adventure filled with music, imagination and heart.',
    image: '/family.jpg',
    accent: '#e9c46a',
    genre: 'Family · Animation',
    rating: 'PG',
    runtime: '1h 42m',
    language: 'English',
    status: 'Family pick',
    venue: 'Cinema Republic Open-Air Cinema, Lagos',
    dates: [createScreeningDate(5), createScreeningDate(12), createScreeningDate(13)],
    times: ['5:30 PM', '7:45 PM'],
  },
];

export const ticketTypes = [
  {
    id: 'standard',
    name: 'Standard',
    note: 'General lawn admission',
    price: 5000,
  },
  {
    id: 'premium',
    name: 'Premium lounger',
    note: 'Reserved lounger + popcorn',
    price: 8000,
  },
  {
    id: 'child',
    name: 'Child',
    note: 'Ages 4–12 · ID may be required',
    price: 3000,
  },
];

export const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);
