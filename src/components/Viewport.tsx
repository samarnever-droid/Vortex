import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildEntity, applyTransform, disposeObject, heightAt } from '../lib/scene';
import type { Entity, Settings, Metrics, Vec3 } from '../lib/scene';

export type ViewportHandle = { focus: () => void; reset: () => void; screenshot: () => void; view: (axis: string) => void };
type Props = { entities: Entity[]; selected: string | null; settings: Settings; playing: boolean; tool: string; wireframe: boolean; onSelect: (id: string | null) => void; onTransform: (id: string, changes: Partial<Entity>) => void; onMetrics: (metrics: Metrics) => void };

const Viewport = forwardRef<ViewportHandle, Props>(function Viewport(props, ref) {
  const container = useRef<HTMLDivElement>(null);
  const current = useRef(props); current.current = props;
  const engine = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; transform: TransformControls; objects: Map<string, { object: THREE.Object3D; type: string; color: string }>; composer: EffectComposer; bloom: UnrealBloomPass; grid: THREE.GridHelper; sun: THREE.DirectionalLight } | null>(null);
  const [error, setError] = useState('');
  useImperativeHandle(ref, () => ({
    focus: () => { const e = engine.current; if (!e) return; const obj = e.objects.get(current.current.selected || '')?.object; if (obj) { const box = new THREE.Box3().setFromObject(obj); const target = box.getCenter(new THREE.Vector3()); const size = Math.min(35, Math.max(5, box.getSize(new THREE.Vector3()).length())); e.controls.target.copy(target); e.camera.position.copy(target).add(new THREE.Vector3(size * 0.75, size * 0.5, size)); } },
    reset: () => { const e = engine.current; if (e) { e.camera.position.set(20, 12.5, 27); e.controls.target.set(0, 3, 0); } },
    screenshot: () => { const e = engine.current; if (!e) return; e.composer.render(); const a = document.createElement('a'); a.download = 'vortex-viewport.png'; a.href = e.renderer.domElement.toDataURL('image/png'); a.click(); },
    view: (axis: string) => { const e = engine.current; if (!e) return; const t = e.controls.target; const d = e.camera.position.distanceTo(t); e.camera.position.copy(t).add(axis === 'x' ? new THREE.Vector3(d, 0, 0) : axis === 'y' ? new THREE.Vector3(0, d, 0.01) : new THREE.Vector3(0, 0, d)); },
  }));
  useEffect(() => {
    const host = container.current; if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }); }
    catch { setError('WebGL is unavailable. Enable hardware acceleration in your browser to open the 3D viewport.'); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true; renderer.info.autoReset = false; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25; host.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#b8bfad'); scene.fog = new THREE.FogExp2('#b7bfad', 0.013);
    const camera = new THREE.PerspectiveCamera(46, host.clientWidth / host.clientHeight, 0.1, 350); camera.position.set(20, 12.5, 27);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.07; controls.target.set(0, 3, 0); controls.minDistance = 2; controls.maxDistance = 110; controls.maxPolarAngle = Math.PI * 0.48;
    const ambient = new THREE.HemisphereLight('#d9e5df', '#454531', 2.0); scene.add(ambient);
    const sun = new THREE.DirectionalLight('#ffebcf', 2.6); sun.position.set(-22, 35, 14); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 0.5, far: 120 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.08; scene.add(sun);
    const fill = new THREE.DirectionalLight('#b9d3cd', 0.6); fill.position.set(20, 12, -25); scene.add(fill);
    const grid = new THREE.GridHelper(120, 120, '#bbc97b', '#6c7960'); grid.position.y = 0.08; grid.visible = false; (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.3; scene.add(grid);
    const transform = new TransformControls(camera, renderer.domElement); transform.setSize(0.7); scene.add(transform.getHelper());
    transform.addEventListener('dragging-changed', event => { controls.enabled = !event.value; });
    transform.addEventListener('mouseUp', () => {
      const obj = transform.object; if (!obj) return;
      current.current.onTransform(obj.userData.entityId, { position: obj.position.toArray() as Vec3, rotation: [THREE.MathUtils.radToDeg(obj.rotation.x), THREE.MathUtils.radToDeg(obj.rotation.y), THREE.MathUtils.radToDeg(obj.rotation.z)], scale: obj.scale.toArray() as Vec3 });
    });
    const renderTarget = new THREE.WebGLRenderTarget(host.clientWidth, host.clientHeight, { type: THREE.UnsignedByteType, depthBuffer: true });
    const composer = new EffectComposer(renderer, renderTarget); composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(host.clientWidth, host.clientHeight), 0.3, 0.5, 1.25); composer.addPass(bloom); composer.addPass(new OutputPass());
    const objects = new Map<string, { object: THREE.Object3D; type: string; color: string }>();
    engine.current = { renderer, scene, camera, controls, transform, objects, composer, bloom, grid, sun };
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let pointerStart = [0, 0];
    const down = (event: PointerEvent) => { pointerStart = [event.clientX, event.clientY]; };
    const up = (event: PointerEvent) => {
      if (current.current.playing || transform.dragging || transform.axis || Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 4 || event.button !== 0) return;
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(Array.from(objects.values()).filter(v => v.object.visible).map(v => v.object), true).filter(hit => hit.object.visible);
      if (hits.length) current.current.onSelect(hits[0].object.userData.entityId);
    };
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointerup', up);
    const keys = new Set<string>();
    const keydown = (e: KeyboardEvent) => { if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return; keys.add(e.code); if (current.current.playing && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); };
    const keyup = (e: KeyboardEvent) => keys.delete(e.code); const blur = () => keys.clear();
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
    let frame = 0; let last = performance.now(); let lastMetrics = last; let frames = 0; let wasPlaying = false; let savedPosition = camera.position.clone(); let savedTarget = controls.target.clone();
    const animate = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.06); last = now;
      const p = current.current;
      if (p.playing && !wasPlaying) { savedPosition = camera.position.clone(); savedTarget = controls.target.clone(); camera.position.set(2, 2.2, 15); controls.target.set(0, 3, 0); transform.detach(); }
      if (!p.playing && wasPlaying) { camera.position.copy(savedPosition); controls.target.copy(savedTarget); const entity = p.entities.find(v => v.id === p.selected); const obj = objects.get(p.selected || '')?.object; if (obj && !entity?.locked && p.tool !== 'select') transform.attach(obj); }
      wasPlaying = p.playing;
      if (p.playing) {
        const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize(); const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)); const move = new THREE.Vector3();
        if (keys.has('KeyW') || keys.has('ArrowUp')) move.add(forward); if (keys.has('KeyS') || keys.has('ArrowDown')) move.sub(forward); if (keys.has('KeyD') || keys.has('ArrowRight')) move.add(right); if (keys.has('KeyA') || keys.has('ArrowLeft')) move.sub(right);
        move.normalize().multiplyScalar(delta * (keys.has('ShiftLeft') ? 15 : 6)); camera.position.add(move); controls.target.add(move); camera.position.y = Math.max(camera.position.y, heightAt(camera.position.x, camera.position.z) + 1.7);
      }
      controls.update();
      renderer.info.reset();
      if (transform.dragging) renderer.shadowMap.needsUpdate = true;
      if (p.settings.bloom && p.settings.quality !== 'Performance') composer.render(); else renderer.render(scene, camera);
      frames++;
      if (now - lastMetrics > 1000) { const elapsed = now - lastMetrics; p.onMetrics({ fps: Math.round(frames * 1000 / elapsed), frame: Math.round(elapsed / frames * 10) / 10, triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, geometries: renderer.info.memory.geometries }); frames = 0; lastMetrics = now; }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const resize = new ResizeObserver(() => { if (!host.clientWidth || !host.clientHeight) return; renderer.setSize(host.clientWidth, host.clientHeight); composer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); }); resize.observe(host);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up); transform.dispose(); controls.dispose(); objects.forEach(v => disposeObject(v.object)); composer.dispose(); renderer.dispose(); host.removeChild(renderer.domElement); engine.current = null; };
  }, []);
  useEffect(() => {
    const e = engine.current; if (!e) return; const ids = new Set(props.entities.map(item => item.id));
    e.renderer.shadowMap.needsUpdate = true;
    for (const [id, value] of e.objects) { if (!ids.has(id)) { if (e.transform.object === value.object) e.transform.detach(); e.scene.remove(value.object); disposeObject(value.object); e.objects.delete(id); } }
    for (const entity of props.entities) { let old = e.objects.get(entity.id); if (old && (old.type !== entity.type || old.color !== entity.color)) { e.scene.remove(old.object); disposeObject(old.object); e.objects.delete(entity.id); old = undefined; }
      if (!old) { const object = buildEntity(entity); e.objects.set(entity.id, { object, type: entity.type, color: entity.color }); e.scene.add(object); } else applyTransform(old.object, entity);
    }
    const selected = e.objects.get(props.selected || '')?.object; const entity = props.entities.find(i => i.id === props.selected);
    if (selected && !entity?.locked && !props.playing && props.tool !== 'select') { e.transform.attach(selected); e.transform.setMode(props.tool as 'translate' | 'rotate' | 'scale'); } else e.transform.detach();
    e.objects.forEach(({ object }) => object.traverse(child => { if (child instanceof THREE.Mesh) { (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => { if ('wireframe' in m) (m as THREE.MeshStandardMaterial).wireframe = props.wireframe; }); } }));
  }, [props.entities, props.selected, props.tool, props.playing, props.wireframe]);
  useEffect(() => { const e = engine.current; if (!e) return; e.renderer.toneMappingExposure = props.settings.exposure; e.renderer.shadowMap.enabled = props.settings.shadows; e.renderer.shadowMap.needsUpdate = true; e.sun.castShadow = props.settings.shadows; e.scene.fog = props.settings.fog ? new THREE.FogExp2('#b7bfad', 0.013) : null; e.grid.visible = props.settings.grid; const ratio = Math.min(devicePixelRatio, props.settings.quality === 'Ultra' ? 2 : props.settings.quality === 'Performance' ? 1 : 1.5); e.renderer.setPixelRatio(ratio); e.composer.setPixelRatio(ratio); }, [props.settings]);
  return <div className="webgl-viewport" ref={container}>{error && <div className="webgl-error"><strong>3D viewport unavailable</strong><p>{error}</p></div>}</div>;
});
export default Viewport;
