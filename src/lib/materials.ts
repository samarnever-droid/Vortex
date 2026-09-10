import * as THREE from 'three';
let stoneTexture: THREE.CanvasTexture | null = null;
export function getStoneTexture() {
  if (stoneTexture) return stoneTexture;
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
  const context = canvas.getContext('2d')!; const image = context.createImageData(256, 256);
  let seed = 28; const rand = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const i = (y * 256 + x) * 4; const n = 155 + rand() * 62 + Math.sin(x * 0.19 + Math.sin(y * 0.11) * 3) * 9 + Math.cos(y * 0.15) * 7; image.data[i] = n; image.data[i + 1] = n + 2; image.data[i + 2] = n - 4; image.data[i + 3] = 255; }
  context.putImageData(image, 0, 0);
  for (let i = 0; i < 140; i++) { const x = rand() * 256, y = rand() * 256; context.fillStyle = `rgba(30,36,26,${0.04 + rand() * 0.12})`; context.beginPath(); context.ellipse(x, y, rand() * 8 + 1, rand() * 3 + 0.5, rand() * 6, 0, Math.PI * 2); context.fill(); }
  stoneTexture = new THREE.CanvasTexture(canvas); stoneTexture.wrapS = stoneTexture.wrapT = THREE.RepeatWrapping; stoneTexture.colorSpace = THREE.SRGBColorSpace; stoneTexture.anisotropy = 4;
  return stoneTexture;
}
export function terrainTexture() {
  const texture = getStoneTexture().clone(); texture.repeat.set(42, 42); texture.needsUpdate = true; return texture;
}
export function pineGeometry() {
  const positions: number[] = []; const colors: number[] = []; const color = new THREE.Color();
  let seed = 13; const rand = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
  function triangle(a: number[], b: number[], c: number[]) { positions.push(...a, ...b, ...c); const light = 0.55 + rand() * 0.5; color.setRGB(light * 0.72, light, light * 0.6); for (let k = 0; k < 3; k++) colors.push(color.r, color.g, color.b); }
  for (let tier = 0; tier < 11; tier++) {
    const y = tier * 0.34; const radius = 1.45 * (1 - tier / 12); const count = 16;
    for (let i = 0; i < count; i++) {
      const a = (i / count + tier * 0.031) * Math.PI * 2, b = a + Math.PI * 2 / count;
      const r = radius * (0.82 + rand() * 0.36); const nextR = radius * (0.72 + rand() * 0.35);
      triangle([Math.sin(a) * r, y - rand() * 0.25, Math.cos(a) * r], [Math.sin(b) * nextR, y + rand() * 0.07, Math.cos(b) * nextR], [Math.sin(a + 0.2) * radius * 0.16, y + 0.92, Math.cos(a + 0.2) * radius * 0.16]);
      if (i % 2 === 0) triangle([Math.sin(a) * r, y - 0.05, Math.cos(a) * r], [Math.sin(a + 0.16) * r * 0.78, y - 0.33, Math.cos(a + 0.16) * r * 0.78], [0, y + 0.58, 0]);
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals(); return geometry;
}
