import { createClient } from '@supabase/supabase-js';

// Retrieve credentials from Vite env or localStorage fallback
let supabaseUrl = 'https://wzsughidtvyaxqvyqaqk.supabase.co';
let supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6c3VnaGlkdHZ5YXhxdnlxYXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNDcwODYsImV4cCI6MjEwMTkyMzA4Nn0.boAp7qDwi3Oo7_ehcLMwGFnWUjIImtNcQFuhC8Sx6fk';

let supabase = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error("Failed to initialize Supabase client:", error);
  }
}

/**
 * Returns the active Supabase client instance.
 * Dynamically re-initializes if config is updated in browser settings.
 */
export const getSupabaseClient = () => {
  const currentUrl = 'https://wzsughidtvyaxqvyqaqk.supabase.co';
  const currentKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6c3VnaGlkdHZ5YXhxdnlxYXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNDcwODYsImV4cCI6MjEwMTkyMzA4Nn0.boAp7qDwi3Oo7_ehcLMwGFnWUjIImtNcQFuhC8Sx6fk';

  if (!currentUrl || !currentKey) {
    return null;
  }

  // If the client hasn't been created yet or credentials changed, recreate it
  if (!supabase || supabaseUrl !== currentUrl || supabaseAnonKey !== currentKey) {
    supabaseUrl = currentUrl;
    supabaseAnonKey = currentKey;
    try {
      supabase = createClient(supabaseUrl, supabaseAnonKey);
    } catch (error) {
      console.error("Failed to reinitialize Supabase client:", error);
      return null;
    }
  }

  return supabase;
};

/**
 * Checks if Supabase has been configured via .env or localStorage.
 */
export const isSupabaseConfigured = () => {
  const currentUrl = 'https://wzsughidtvyaxqvyqaqk.supabase.co';
  const currentKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6c3VnaGlkdHZ5YXhxdnlxYXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNDcwODYsImV4cCI6MjEwMTkyMzA4Nn0.boAp7qDwi3Oo7_ehcLMwGFnWUjIImtNcQFuhC8Sx6fk';
  return !!(currentUrl && currentKey);
};

/**
 * Save credentials to localStorage and reset the cached client instance.
 */
export const saveSupabaseCredentials = (url, key) => {
  if (url) {
    localStorage.setItem('supabase_url', url.trim());
  } else {
    localStorage.removeItem('supabase_url');
  }

  if (key) {
    localStorage.setItem('supabase_anon_key', key.trim());
  } else {
    localStorage.removeItem('supabase_anon_key');
  }

  // Clear cached client to trigger re-instantiation
  supabase = null;
};
