import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://rhkmjgwoxmmbzbrrcnmy.supabase.co';
export const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_74v4dPsz2r4Hmj6263mboA_Z0e_HsYF';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
