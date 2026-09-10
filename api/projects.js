import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const workspace = req.headers.authorization?.replace('Bearer ', '');
  if (!workspace || !/^[a-f0-9-]{36}$/i.test(workspace)) return res.status(401).json({ error: 'A valid guest workspace is required.' });
  try {
    if (req.method === 'GET') {
      let { data, error } = await supabase.from('vortex_projects').select('*').eq('workspace_id', workspace).order('updated_at', { ascending: false });
      if (error) throw error;
      if (!data.length) {
        const { data: template, error: templateError } = await supabase.from('vortex_projects').select('*').eq('workspace_id', 'template').limit(1).single();
        if (templateError) throw templateError;
        const { data: created, error: createError } = await supabase.from('vortex_projects').insert({ workspace_id: workspace, name: template.name, description: template.description, scene_data: template.scene_data, settings: template.settings }).select().single();
        if (createError) throw createError;
        data = [created];
      }
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const name = String(req.body?.name || '').trim().slice(0, 80);
      if (!name) return res.status(400).json({ error: 'Give your project a name.' });
      const { data: template, error: templateError } = await supabase.from('vortex_projects').select('scene_data,settings').eq('workspace_id', 'template').limit(1).single();
      if (templateError) throw templateError;
      const { data, error } = await supabase.from('vortex_projects').insert({ workspace_id: workspace, name, description: 'A new world, waiting to be built.', scene_data: req.body.scene_data || template.scene_data, settings: req.body.settings || template.settings }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { id, name, scene_data, settings } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Project ID is required.' });
      if (scene_data && (!Array.isArray(scene_data.entities) || scene_data.entities.length > 200)) return res.status(400).json({ error: 'Scenes support up to 200 objects.' });
      const changes = { updated_at: new Date().toISOString() };
      if (name !== undefined) { if (!String(name).trim()) return res.status(400).json({ error: 'Name cannot be empty.' }); changes.name = String(name).trim().slice(0, 80); }
      if (scene_data) changes.scene_data = scene_data;
      if (settings) changes.settings = settings;
      const { data, error } = await supabase.from('vortex_projects').update(changes).eq('id', id).eq('workspace_id', workspace).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      if (!req.body?.id) return res.status(400).json({ error: 'Project ID is required.' });
      const { error } = await supabase.from('vortex_projects').delete().eq('id', req.body.id).eq('workspace_id', workspace);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) { console.error('Project API:', error); return res.status(500).json({ error: 'Could not reach your workspace. Please try again.' }); }
}
