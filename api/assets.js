import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const { data, error } = await supabase.from('vortex_assets').select('*').order('sort_order', { ascending: true });
    if (error) throw error;
    return res.status(200).json(data);
  } catch (error) { console.error('Asset API:', error); return res.status(500).json({ error: 'Could not load the asset library. Please try again.' }); }
}
