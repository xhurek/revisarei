import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fbgkvhtbquxacakahbno.supabase.co';
const supabaseAnonKey = 'sb_publishable_MytZR7jdwuZ4KYqMpk1V9Q_Mj6aS4gi';

// Initialize the Supabase client
// We will use this to query our PostgreSQL database
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Generates a standard RFC-4122 compliant UUID (v4 format).
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Converts any string ID (like Firestore alphanumeric IDs) into a deterministic, valid UUID.
 * If already a valid UUID, returns it unchanged.
 */
export function toValidUUID(input?: string | null): string {
  if (!input) return generateUUID();
  
  const trimmed = String(input).trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  // Pure fast 32-bit deterministic hash (FNV-1a / Murmur hybrid)
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x12345678, h4 = 0x87654321;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 3812015801);
    h4 = Math.imul(h4 ^ ch, 2718281829);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hex = (
    (h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h3 >>> 0).toString(16).padStart(8, '0') +
    (h4 >>> 0).toString(16).padStart(8, '0')
  );

  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    '4' + hex.substring(13, 16),
    'a' + hex.substring(17, 20),
    hex.substring(20, 32)
  ].join('-');
}
