import type { Project, Asset } from './scene';
const workspace = () => {
  let value = localStorage.getItem('vortex-workspace');
  if (!value) { value = crypto.randomUUID(); localStorage.setItem('vortex-workspace', value); }
  return value;
};
export async function request<T>(resource: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/${resource}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workspace()}` }, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
  return result;
}
export const getProjects = () => request<Project[]>('projects');
export const getAssets = () => request<Asset[]>('assets');
