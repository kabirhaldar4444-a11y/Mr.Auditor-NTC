import { createClient } from '@supabase/supabase-js';

// Retrieve credentials from Vite env or localStorage fallback
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('supabase_url') || '';
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key') || '';

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
  const currentUrl = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('supabase_url') || '';
  const currentKey = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key') || '';

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
  const currentUrl = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('supabase_url') || '';
  const currentKey = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key') || '';
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
