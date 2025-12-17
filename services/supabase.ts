
import { createClient } from 'https://jspm.dev/@supabase/supabase-js';

// Credenciales proporcionadas por el usuario
const supabaseUrl = 'https://vnfqhfcwfvqdqnfdoixv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuZnFoZmN3ZnZxZHFuZmRvaXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4OTQxMTcsImV4cCI6MjA4MDQ3MDExN30.JuxMpTkqnPAYsFxwbIJeHwLNwvCJbyWhW70O4hNes80';

// Exportamos el cliente inicializado con las credenciales
export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

if (!supabase) {
  console.error("CRITICAL: Supabase credentials missing or invalid.");
}

// Helper para generar o recuperar un ID único para este dispositivo
export const getDeviceId = () => {
  let id = localStorage.getItem('tactical_radio_device_id');
  if (!id) {
    id = 'unit-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('tactical_radio_device_id', id);
  }
  return id;
};
