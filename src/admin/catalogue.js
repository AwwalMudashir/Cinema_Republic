import { supabase } from '../lib/supabase';

export function assertResult({ data, error }) {
  if (error) {
    const messages = {
      SOLD_SCREENING_DETAILS_IMMUTABLE: 'This screening has paid orders, so its movie, venue and times cannot be changed. Cancel it and create a new screening if the event must move.',
      CANCELLED_SCREENING_CANNOT_REOPEN: 'A cancelled screening cannot be reopened. Create a new screening instead.',
      CAPACITY_BELOW_RESERVED: 'Capacity cannot be lower than the number of paid or currently reserved tickets.',
      TICKET_TYPE_SCREENING_IMMUTABLE: 'A ticket tier cannot be moved to another screening.',
    };
    const code = Object.keys(messages).find((key) => error.message.includes(key));
    throw new Error(code ? messages[code] : error.message);
  }
  return data;
}

export function nairaToKobo(value) {
  const trimmed = String(value).trim();
  if (!/^\d{1,7}(?:\.\d{1,2})?$/u.test(trimmed)) {
    throw new Error('Enter a valid Naira amount (up to two decimal places).');
  }
  const [whole, fraction = ''] = trimmed.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function toLagosInput(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('sv-SE', { timeZone: 'Africa/Lagos', hour12: false })
    .slice(0, 16).replace(' ', 'T');
}

export function fromLagosInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(value)) throw new Error('Enter all date and time fields.');
  const date = new Date(`${value}:00+01:00`);
  if (Number.isNaN(date.getTime()) || toLagosInput(date.toISOString()) !== value) {
    throw new Error('Enter a valid Lagos date and time.');
  }
  return date.toISOString();
}

export async function uploadPoster(movieId, file) {
  if (!file) return null;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    throw new Error('Use a JPG, PNG or WebP poster under 5 MB.');
  }
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
  const path = `movies/${movieId}/${crypto.randomUUID()}.${extension}`;
  assertResult(await supabase.storage.from('movie-posters').upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type,
  }));
  return path;
}
