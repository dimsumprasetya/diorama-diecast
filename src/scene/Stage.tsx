import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ITEMS, byId } from '../../shared/catalog.ts';
import type { Design, PlacedItem, PreviewCar, WallSide } from '../../shared/design.ts';
import { clampCar, clampItem, hitSurface } from '../lib/placement.ts';
import { useStore, type CameraView, type ViewState } from '../store.ts';
import { buildCar } from '../three/builders.ts';
import { buildPlaced, buildShell, dims, placeObject, wallFrame, type Dims } from '../three/diorama.ts';

/** Dipakai drag & drop dari inventori HTML ke kanvas 3D. */
export const stageRay: { current: ((clientX: number, clientY: number) => THREE.Ray | null) | null } = { current: null };

type Props = {
  design: Design;
  view: ViewState;
  interactive?: boolean;
  cameraCmd?: { view: CameraView; n: number };
};

export function Stage({ design, view, interactive = false, cameraCmd }: Props) {
  const down = useRef<[number, number]>([0, 0]);
  return (
    <div className="stage" onPointerDown={(e) => (down.current = [e.clientX, e.clientY])}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        camera={{ fov: 30, near: 0.05, far: 300, position: [4, 5, 16] }}
        onPointerMissed={(e) => {
          const moved = Math.hypot(e.clientX - down.current[0], e.clientY - down.current[1]);
          if (interactive && moved < 5) useStore.getState().select(null);
        }}
      >
        <Content design={design} view={view} interactive={interactive} cameraCmd={cameraCmd ?? { view: 'reset', n: 0 }} />
      </Canvas>
    </div>
  );
}

function Content({ design, view, interactive, cameraCmd }: Required<Props>) {
  const D = useMemo(() => dims(design), [design.size]);
  const shellKey = JSON.stringify([design.size, design.panels, design.grime, design.options]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shell = useMemo(() => buildShell(design), [shellKey]);
  useEffect(() => {
    shell.caseGroup.visible = view.showCase;
  }, [shell, view.showCase]);

  // Dinding "cutaway" ala game: dinding yang membelakangi kamera disembunyikan supaya isi box selalu terlihat
  const [cut, setCut] = useState<Record<WallSide, boolean>>({ back: false, left: false, right: false });
  const cutRef = useRef(cut);
  useFrame(({ camera }) => {
    const next = { ...cutRef.current };
    let changed = false;
    for (const side of ['back', 'left', 'right'] as WallSide[]) {
      const f = wallFrame(side, D);
      const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), f.rotY);
      const behind = camera.position.clone().sub(f.origin).dot(normal) < -0.05;
      if (behind !== next[side]) {
        next[side] = behind;
        changed = true;
      }
      shell.wallGroups[side].visible = !next[side];
    }
    if (changed) {
      cutRef.current = next;
      setCut(next);
    }
  });

  return (
    <>
      <Environment night={view.night} />
      <Lights D={D} night={view.night} led={design.options.led} />
      <primitive object={shell.group} />
      {design.items.map((it, i) => (
        <Placed key={it.uid} item={it} index={i} D={D} interactive={interactive} hidden={it.mount === 'wall' && cut[it.wall]} />
      ))}
      {view.showCars && design.cars.map((c) => <Car key={c.uid} car={c} D={D} interactive={interactive} />)}
      <mesh rotation-x={-Math.PI / 2} position-y={-D.baseThick - 0.003} receiveShadow>
        <circleGeometry args={[60, 48]} />
        <meshStandardMaterial color={view.night ? '#0a0a0a' : '#1f1d1d'} roughness={0.6} metalness={0.1} />
      </mesh>
      <CameraRig D={D} cmd={cameraCmd} autoRotate={view.autoRotate} />
      {interactive && <RayBridge />}
    </>
  );
}

function Environment({ night }: { night: boolean }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      env.dispose();
      pm.dispose();
    };
  }, [gl, scene]);
  useEffect(() => {
    scene.environmentIntensity = night ? 0.06 : 0.55;
    scene.background = new THREE.Color(night ? '#060606' : '#151414');
  }, [night, scene]);
  return null;
}

function Lights({ D, night, led }: { D: Dims; night: boolean; led: boolean }) {
  const spot = useRef<THREE.SpotLight>(null);
  useLayoutEffect(() => {
    if (spot.current) {
      spot.current.target.position.set(0, 0, -D.d * 0.15);
      spot.current.target.updateMatrixWorld();
    }
  }, [D, led, night]);
  return (
    <>
      <hemisphereLight args={[night ? '#3a4a7a' : '#ffffff', night ? '#05060a' : '#3a3a44', night ? 0.12 : 1.0]} />
      <directionalLight
        position={[D.w * 0.8, D.h * 3, D.d * 3]}
        intensity={night ? 0.12 : 2.0}
        color={night ? '#8fa6ff' : '#ffffff'}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-D.w}
        shadow-camera-right={D.w}
        shadow-camera-top={D.w}
        shadow-camera-bottom={-D.w}
        shadow-camera-near={0.5}
        shadow-camera-far={D.w * 8}
      />
      {led && (
        <spotLight
          ref={spot}
          position={[0, D.h - 0.08, D.d / 2 - 0.2]}
          angle={1.25}
          penumbra={0.9}
          intensity={night ? 26 : 6}
          distance={D.w * 2}
          decay={1.6}
          color="#ffe7c2"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0005}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------- aset

function SelectBox({ box }: { box: THREE.Box3 }) {
  const geo = useMemo(() => {
    const size = box.getSize(new THREE.Vector3());
    size.x = Math.max(size.x, 0.04);
    size.y = Math.max(size.y, 0.04);
    size.z = Math.max(size.z, 0.04);
    return new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x * 1.04, size.y * 1.04, size.z * 1.04));
  }, [box]);
  const center = useMemo(() => box.getCenter(new THREE.Vector3()), [box]);
  return (
    <lineSegments geometry={geo} position={center} renderOrder={20} raycast={() => null}>
      <lineBasicMaterial color="#e32636" depthTest={false} transparent />
    </lineSegments>
  );
}

type DragState = { a: number; b: number; moved: boolean } | null;

function useControls() {
  return useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
}

function Placed({ item, index, D, interactive, hidden }: { item: PlacedItem; index: number; D: Dims; interactive: boolean; hidden?: boolean }) {
  const obj = useMemo(() => buildPlaced(item), [item.id, item.color, item.text, item.scale]);
  const localBox = useMemo(() => new THREE.Box3().setFromObject(obj), [obj]);
  const ref = useRef<THREE.Group>(null);
  const selected = useStore((s) => s.selected === item.uid);
  const controls = useControls();
  const drag = useRef<DragState>(null);

  useLayoutEffect(() => {
    if (ref.current) placeObject(ref.current, item, D, index);
  }, [item, D, index]);

  const handlers = interactive && !hidden
    ? {
        onPointerDown(e: ThreeEvent<PointerEvent>) {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          e.stopPropagation();
          const st = useStore.getState();
          st.select(item.uid);
          const cur = st.design.items.find((x) => x.uid === item.uid);
          if (!cur) return;
          const hit = hitSurface(e.ray, st.design, cur.mount, cur.mount === 'wall' ? cur.wall : undefined);
          if (!hit) return;
          drag.current =
            cur.mount === 'floor' && hit.mount === 'floor'
              ? { a: cur.x - hit.x, b: cur.z - hit.z, moved: false }
              : cur.mount === 'wall' && hit.mount === 'wall'
                ? { a: cur.u - hit.u, b: cur.v - hit.v, moved: false }
                : null;
          if (!drag.current) return;
          st.beginGesture();
          (e.target as unknown as Element).setPointerCapture(e.pointerId);
          if (controls) controls.enabled = false;
        },
        onPointerMove(e: ThreeEvent<PointerEvent>) {
          const g = drag.current;
          if (!g) return;
          e.stopPropagation();
          const st = useStore.getState();
          st.transient((d) => {
            const i = d.items.findIndex((x) => x.uid === item.uid);
            if (i < 0) return;
            const cur = d.items[i];
            const D2 = dims(d);
            if (cur.mount === 'floor') {
              const hit = hitSurface(e.ray, d, 'floor');
              if (hit?.mount === 'floor') d.items[i] = clampItem({ ...cur, x: hit.x + g.a, z: hit.z + g.b }, D2);
            } else {
              // boleh pindah ke dinding lain
              const hit = hitSurface(e.ray, d, 'wall') ?? hitSurface(e.ray, d, 'wall', cur.wall);
              if (hit?.mount !== 'wall') return;
              if (hit.wall !== cur.wall) {
                const h = (byId(ITEMS, cur.id)?.size[1] ?? 0) * (cur.scale ?? 1);
                g.a = 0;
                g.b = -h / 2;
              }
              d.items[i] = clampItem({ ...cur, wall: hit.wall, u: hit.u + g.a, v: hit.v + g.b }, D2);
            }
          });
          g.moved = true;
        },
        onPointerUp(e: ThreeEvent<PointerEvent>) {
          const g = drag.current;
          if (!g) return;
          (e.target as unknown as Element).releasePointerCapture(e.pointerId);
          useStore.getState().endGesture(g.moved);
          drag.current = null;
          if (controls) controls.enabled = true;
        },
      }
    : {};

  return (
    <group ref={ref} visible={!hidden} {...handlers}>
      <primitive object={obj} />
      {selected && <SelectBox box={localBox} />}
    </group>
  );
}

function Car({ car, D, interactive }: { car: PreviewCar; D: Dims; interactive: boolean }) {
  const obj = useMemo(() => buildCar(car.model, car.color), [car.model, car.color]);
  const localBox = useMemo(() => new THREE.Box3().setFromObject(obj), [obj]);
  const selected = useStore((s) => s.selected === car.uid);
  const controls = useControls();
  const drag = useRef<DragState>(null);
  void D;

  const handlers = interactive
    ? {
        onPointerDown(e: ThreeEvent<PointerEvent>) {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          e.stopPropagation();
          const st = useStore.getState();
          st.select(car.uid);
          const hit = hitSurface(e.ray, st.design, 'floor');
          if (hit?.mount !== 'floor') return;
          drag.current = { a: car.x - hit.x, b: car.z - hit.z, moved: false };
          st.beginGesture();
          (e.target as unknown as Element).setPointerCapture(e.pointerId);
          if (controls) controls.enabled = false;
        },
        onPointerMove(e: ThreeEvent<PointerEvent>) {
          const g = drag.current;
          if (!g) return;
          e.stopPropagation();
          useStore.getState().transient((d) => {
            const i = d.cars.findIndex((c) => c.uid === car.uid);
            const hit = hitSurface(e.ray, d, 'floor');
            if (i >= 0 && hit?.mount === 'floor') d.cars[i] = clampCar({ ...d.cars[i], x: hit.x + g.a, z: hit.z + g.b }, dims(d));
          });
          g.moved = true;
        },
        onPointerUp(e: ThreeEvent<PointerEvent>) {
          const g = drag.current;
          if (!g) return;
          (e.target as unknown as Element).releasePointerCapture(e.pointerId);
          useStore.getState().endGesture(g.moved);
          drag.current = null;
          if (controls) controls.enabled = true;
        },
      }
    : {};

  return (
    <group position={[car.x, 0.002, car.z]} rotation-y={THREE.MathUtils.degToRad(car.rot)} {...handlers}>
      <primitive object={obj} />
      {selected && <SelectBox box={localBox} />}
    </group>
  );
}

// ---------------------------------------------------------------- kamera

const VIEW_DIR: Record<CameraView, [number, number, number]> = {
  reset: [-0.32, 0.36, 1],
  front: [0, 0.14, 1],
  top: [0, 1, 0.001],
  left: [1, 0.32, 0.38],
  right: [-1, 0.32, 0.38],
  back: [0, 0.3, 1],
};

function CameraRig({ D, cmd, autoRotate }: { D: Dims; cmd: { view: CameraView; n: number }; autoRotate: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useControls();
  const anim = useRef<{ p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; t: number } | null>(null);

  const pose = (view: CameraView) => {
    const aspect = size.width / Math.max(1, size.height);
    const vf = THREE.MathUtils.degToRad(camera.fov) / 2;
    const hf = Math.atan(Math.tan(vf) * aspect);
    const target = new THREE.Vector3(0, view === 'top' ? 0 : D.h * 0.42, view === 'top' ? 0 : 0);
    const spanW = view === 'top' ? D.w : view === 'left' || view === 'right' ? D.d * 1.6 + D.w * 0.4 : D.w;
    const spanH = view === 'top' ? D.d : D.h;
    const dist = Math.max((spanW * 0.5 * 1.35) / Math.tan(hf), (spanH * 0.5 * 1.7) / Math.tan(vf)) + D.d * 0.5;
    const dir = new THREE.Vector3(...VIEW_DIR[view]).normalize();
    return { pos: target.clone().addScaledVector(dir, dist), target };
  };

  // posisi awal, saat ukuran box berubah, dan saat ukuran layar berubah (selama user belum memutar kamera)
  const touched = useRef(false);
  useEffect(() => {
    if (touched.current && !anim.current) return;
    const { pos, target } = pose('reset');
    camera.position.copy(pos);
    controls?.target.copy(target);
    controls?.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls, D.w, D.d, size.width, size.height]);

  useEffect(() => {
    if (!cmd.n || !controls) return;
    const { pos, target } = pose(cmd.view);
    anim.current = { p0: camera.position.clone(), p1: pos, t0: controls.target.clone(), t1: target, t: 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmd.n]);

  useFrame((_, dt) => {
    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + dt / 0.7);
    const k = 1 - Math.pow(1 - a.t, 3);
    camera.position.lerpVectors(a.p0, a.p1, k);
    controls.target.lerpVectors(a.t0, a.t1, k);
    controls.update();
    if (a.t >= 1) anim.current = null;
  });

  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={D.w * 0.35}
      maxDistance={D.w * 5}
      maxPolarAngle={Math.PI * 0.5}
      autoRotate={autoRotate}
      autoRotateSpeed={0.9}
      onStart={() => {
        anim.current = null;
        touched.current = true;
      }}
    />
  );
}

function RayBridge() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const rc = new THREE.Raycaster();
    stageRay.current = (x, y) => {
      const r = gl.domElement.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
      rc.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
      return rc.ray.clone();
    };
    return () => {
      stageRay.current = null;
    };
  }, [camera, gl]);
  return null;
}
