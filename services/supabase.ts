
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://vnfqhfcwfvqdqnfdoixv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuZnFoZmN3ZnZxZHFuZmRvaXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4OTQxMTcsImV4cCI6MjA4MDQ3MDExN30.JuxMpTkqnPAYsFxwbIJeHwLNwvCJbyWhW70O4hNes80';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const getDeviceId = () => {
  let id = localStorage.getItem('tactical_radio_device_id');
  if (!id) {
    id = 'unit-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('tactical_radio_device_id', id);
  }
  return id;
};

// Verificar conexión inicial
supabase.from('locations').select('count', { count: 'exact', head: true })
  .then(({ error }) => {
    if (error) console.error("SUPABASE_OFFLINE:", error.message);
    else console.log("SUPABASE_ONLINE: Ready for tactical sync.");
  });
