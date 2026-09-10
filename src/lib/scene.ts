import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getStoneTexture, terrainTexture, pineGeometry } from './materials';

export type Vec3 = [number, number, number];
export type Entity = { id: string; name: string; type: string; position: Vec3; rotation: Vec3; scale: Vec3; color: string; visible: boolean; category: string; locked?: boolean };
export type Settings = { quality: string; shadows: boolean; fog: boolean; exposure: number; grid: boolean; bloom: boolean };
export type Project = { id: number; workspace_id: string; name: string; description: string; scene_data: { entities: Entity[] }; settings: Settings; updated_at: string };
export type Asset = { id: number; name: string; type: string; category: string; color: string; description: string; sort_order: number };
export type Metrics = { fps: number; frame: number; triangles: number; calls: number; geometries: number };
export type Log = { time: string; message: string; kind: 'info' | 'success' | 'error' };

export function heightAt(x: number, z: number) {
  const d = Math.sqrt(x * x + z * z);
  return -0.45 + Math.sin(x * 0.16) * Math.cos(z * 0.12) * 1.6 + Math.sin(x * 0.44 + z * 0.24) * 0.32 + Math.max(0, d - 17) * 0.022;
}
function random(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function material(color: string, roughness = 0.88, metalness = 0.05) { return new THREE.MeshStandardMaterial({ color, roughness, metalness, map: getStoneTexture(), bumpMap: getStoneTexture(), bumpScale: 0.065 }); }
function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, position: Vec3 = [0, 0, 0]) { const m = new THREE.Mesh(geo, mat); m.position.set(...position); m.castShadow = true; m.receiveShadow = true; return m; }

function buildTerrain() {
  const g = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(190, 190, 160, 160); geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = [];
  const c = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i); const h = heightAt(x, z); positions.setY(i, h);
    const variation = (Math.sin(x * 0.48) * Math.cos(z * 0.41) + 1) / 2;
    c.set('#616047').lerp(new THREE.Color('#8b8b58'), variation * 0.8);
    if (Math.abs(x + 8 + Math.sin(z * 0.12) * 3) < 3.4) c.lerp(new THREE.Color('#575c4c'), 0.65);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
  const groundTexture = terrainTexture();
  g.add(mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: groundTexture, bumpMap: groundTexture, bumpScale: 0.22 })));
  const rand = random(27);
  const mountainMat = material('#778171');
  for (let i = 0; i < 25; i++) {
    const angle = (i / 25) * Math.PI * 2; const distance = 60 + rand() * 28; const x = Math.cos(angle) * distance, z = Math.sin(angle) * distance;
    const mountain = mesh(new THREE.SphereGeometry(1, 18, 13), mountainMat);
    const p = mountain.geometry.attributes.position;
    for (let j = 0; j < p.count; j++) { const px = p.getX(j), py = p.getY(j), pz = p.getZ(j); const noise = 1 + Math.sin(px * 11 + py * 7) * Math.cos(pz * 9) * 0.13 + Math.sin(py * 18 + pz * 7) * 0.07; p.setXYZ(j, px * noise, py * noise, pz * noise); }
    mountain.geometry.computeVertexNormals(); mountain.scale.set(14 + rand() * 13, 15 + rand() * 24, 14 + rand() * 12); mountain.position.set(x, -4, z); mountain.rotation.y = rand() * Math.PI; g.add(mountain);
  }
  const riverGeo = new THREE.PlaneGeometry(5, 150, 12, 100); riverGeo.rotateX(-Math.PI / 2);
  const rp = riverGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) { const z = rp.getZ(i); rp.setX(i, rp.getX(i) - 12 + Math.sin(z * 0.073) * 6); rp.setY(i, -0.8); }
  riverGeo.computeVertexNormals();
  g.add(mesh(riverGeo, new THREE.MeshStandardMaterial({ color: '#87a59a', metalness: 0.6, roughness: 0.22, transparent: true, opacity: 0.84 })));
  return g;
}
function buildPortal(color: string) {
  const g = new THREE.Group(); const stone = material('#545b53', 0.85, 0.22); const dark = material('#272f2b', 0.6, 0.5);
  for (let i = 0; i < 3; i++) { const base = mesh(new THREE.CylinderGeometry(5.5 - i * 0.48, 5.65 - i * 0.48, 0.34, 64), stone, [0, i * 0.32, 0]); g.add(base); }
  const ring = mesh(new THREE.TorusGeometry(3.5, 0.47, 6, 80), dark, [0, 4.9, 0]); g.add(ring);
  const rim = mesh(new THREE.TorusGeometry(3.5, 0.52, 4, 64), stone, [0, 4.9, -0.16]); g.add(rim);
  const light = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.8, roughness: 0.2 });
  g.add(mesh(new THREE.TorusGeometry(3.28, 0.055, 8, 100), light, [0, 4.9, 0.29]));
  g.add(mesh(new THREE.TorusGeometry(3.72, 0.023, 5, 90), light, [0, 4.9, 0.27]));
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    const block = mesh(new THREE.BoxGeometry(0.19, 0.42, 0.63), stone, [Math.sin(a) * 3.57, 4.9 + Math.cos(a) * 3.57, 0]); block.rotation.z = -a; g.add(block);
    if (i % 2 === 0) { const rune = mesh(new THREE.BoxGeometry(0.045, 0.19, 0.04), light, [Math.sin(a) * 3.58, 4.9 + Math.cos(a) * 3.58, 0.35]); rune.rotation.z = -a; g.add(rune); }
  }
  for (const x of [-3, 3]) { const foot = mesh(new THREE.BoxGeometry(1.3, 2.4, 1.6), stone, [x, 1.8, -0.1]); foot.rotation.z = x < 0 ? -0.17 : 0.17; g.add(foot); }
  const glow = new THREE.PointLight(color, 24, 15, 2); glow.position.set(0, 4.4, 1.2); g.add(glow);
  const diskGeo = new THREE.CircleGeometry(3.16, 80);
  const disk = mesh(diskGeo, new THREE.MeshBasicMaterial({ color: '#acdc83', transparent: true, opacity: 0.035, side: THREE.DoubleSide, depthWrite: false }), [0, 4.9, 0]);
  disk.userData.portalSurface = true; g.add(disk);
  for (let i = 0; i < 7; i++) { const step = mesh(new THREE.BoxGeometry(2.8, 0.18, 0.9), stone, [0, 0.35 - i * 0.085, 5.25 + i * 0.85]); step.rotation.y = Math.sin(i) * 0.018; g.add(step); }
  return g;
}
function buildRuins(color: string) {
  const g = new THREE.Group(); const rand = random(22); const stone = material(color);
  for (let i = 0; i < 9; i++) {
    const angle = i / 9 * Math.PI * 1.65 + 0.5; const r = 10.8 + rand() * 1.5;
    const x = Math.cos(angle) * r, z = Math.sin(angle) * r; const h = 2.9 + rand() * 5;
    const column = mesh(new THREE.BoxGeometry(0.9 + rand() * 0.6, h, 1.2), stone, [x, h / 2 + heightAt(x, z), z]); column.rotation.set(rand() * 0.045, angle, (rand() - 0.5) * 0.1); g.add(column);
    const cap = mesh(new THREE.BoxGeometry(1.75, 0.45, 1.75), stone, [x, h + heightAt(x, z), z]); cap.rotation.y = angle; g.add(cap);
    const base = mesh(new THREE.BoxGeometry(1.8, 0.4, 1.8), stone, [x, heightAt(x, z) + 0.1, z]); base.rotation.y = angle; g.add(base);
    for (let j = 0; j < 2; j++) { const rubble = mesh(new THREE.DodecahedronGeometry(0.48, 0), stone, [x + (rand() - 0.5) * 3.5, heightAt(x, z), z + (rand() - 0.5) * 3.5]); rubble.scale.set(1.6, 0.9, 1); g.add(rubble); }
  }
  const beam = mesh(new THREE.BoxGeometry(5.8, 0.8, 1.55), stone, [-8.4, 6.8, -6.3]); beam.rotation.y = -0.75; g.add(beam);
  return g;
}
function buildRocks(color: string, cluster = true) {
  const g = new THREE.Group(); const rand = random(53); const mat = material(color);
  for (let i = 0; i < (cluster ? 70 : 1); i++) {
    const a = rand() * Math.PI * 2, radius = 7 + rand() * 45; const x = cluster ? Math.cos(a) * radius : 0, z = cluster ? Math.sin(a) * radius : 0; const s = cluster ? 0.35 + rand() * 2.4 : 1.5;
    const rock = mesh(new THREE.DodecahedronGeometry(s, 0), mat, [x, cluster ? heightAt(x, z) + s * 0.13 : 0.6, z]); rock.scale.set(1 + rand(), 0.6 + rand() * 0.8, 0.8 + rand()); rock.rotation.set(rand(), rand() * 6, rand() * 0.5); g.add(rock);
  }
  return g;
}
function buildFlora(color: string, single = false) {
  const g = new THREE.Group(); const rand = random(36); const trunkMat = material('#504636'); const leafMat = new THREE.MeshStandardMaterial({ color, roughness: 1, vertexColors: true, side: THREE.DoubleSide });
  const treeCount = single ? 1 : 95;
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.22, 3.3, 5), trunkMat, treeCount);
  const leaves = new THREE.InstancedMesh(pineGeometry(), leafMat, treeCount);
  const o = new THREE.Object3D();
  for (let i = 0; i < treeCount; i++) {
    const a = rand() * Math.PI * 2, r = 15 + rand() * 36; const x = single ? 0 : Math.cos(a) * r, z = single ? 0 : Math.sin(a) * r; const h = single ? 0 : heightAt(x, z), s = 0.6 + rand() * 1.5;
    o.position.set(x, h + 1.65 * s, z); o.scale.set(s, s, s); o.rotation.set(0, rand() * Math.PI, 0); o.updateMatrix(); trunks.setMatrixAt(i, o.matrix);
    o.position.y = h + 1.2 * s; o.scale.set(s, s, s); o.updateMatrix(); leaves.setMatrixAt(i, o.matrix);
  }
  trunks.castShadow = true; leaves.castShadow = true; leaves.receiveShadow = true; g.add(trunks, leaves);
  if (!single) {
    const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.12, 0.8, 3), material('#777d48'), 1900);
    for (let i = 0; i < 1900; i++) { const x = (rand() - 0.5) * 82, z = (rand() - 0.5) * 82; const center = Math.sqrt(x * x + z * z); o.position.set(x, heightAt(x, z) + 0.2, z); o.scale.set(1, center < 6 ? 0 : 0.45 + rand(), 1); o.rotation.set(0, rand() * 6, (rand() - 0.5) * 0.3); o.updateMatrix(); grass.setMatrixAt(i, o.matrix); } g.add(grass);
  }
  return g;
}
export function buildEntity(entity: Entity): THREE.Object3D {
  let object: THREE.Object3D;
  switch (entity.type) {
    case 'terrain': object = buildTerrain(); break;
    case 'portal': object = buildPortal(entity.color); break;
    case 'ruins': object = buildRuins(entity.color); break;
    case 'rocks': object = buildRocks(entity.color); break;
    case 'rock': object = buildRocks(entity.color, false); break;
    case 'flora': object = buildFlora(entity.color); break;
    case 'tree': object = buildFlora(entity.color, true); break;
    case 'light': { const light = new THREE.PointLight(entity.color, 65, 25, 2); light.add(mesh(new THREE.SphereGeometry(0.15, 12, 8), new THREE.MeshBasicMaterial({ color: entity.color }))); object = light; break; }
    case 'sphere': object = mesh(new THREE.SphereGeometry(1.2, 32, 24), material(entity.color, 0.25, 0.5)); break;
    case 'cylinder': object = mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.5, 32), material(entity.color)); break;
    case 'plane': object = mesh(new THREE.BoxGeometry(5, 0.15, 5), material(entity.color)); break;
    default: object = mesh(new THREE.BoxGeometry(2, 2, 2), material(entity.color, 0.5, 0.1));
  }
  if (object instanceof THREE.Group) {
    const batches = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of [...object.children]) {
      if (!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh || Array.isArray(child.material) || child.material.transparent) continue;
      const items = batches.get(child.material) || []; items.push(child); batches.set(child.material, items);
    }
    for (const [mat, items] of batches) {
      if (items.length < 2) continue;
      const geometries = items.map(item => { item.updateMatrix(); return item.geometry.clone().applyMatrix4(item.matrix); });
      const combined = mergeGeometries(geometries, false);
      geometries.forEach(geometry => geometry.dispose());
      if (combined) { items.forEach(item => { object.remove(item); item.geometry.dispose(); }); object.add(mesh(combined, mat)); }
    }
  }
  applyTransform(object, entity);
  object.name = entity.name; object.userData.entityId = entity.id;
  object.traverse(child => { child.userData.entityId = entity.id; });
  return object;
}
export function applyTransform(object: THREE.Object3D, entity: Entity) { object.position.set(...entity.position); object.rotation.set(...entity.rotation.map(v => THREE.MathUtils.degToRad(v)) as Vec3); object.scale.set(...entity.scale); object.visible = entity.visible; object.name = entity.name; }
export function disposeObject(object: THREE.Object3D) { object.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => m.dispose()); } }); }
