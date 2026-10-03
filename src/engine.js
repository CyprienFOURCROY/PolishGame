// The "world": renderer, follow camera, input, dialogs and interactions.
// A scene is { build(world) } (+ audioDir, voices for scripted dialogs)  (see scenes/store.js).
import * as THREE from 'three';
import { say } from './dialog.js';

const CAMERA_DISTANCE = 10.8;  // third-person orbit around the hero
const MOUSE_SENSITIVITY = 0.003;
const TALK_RANGE = 2.5;
const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

export function createWorld() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
  const prompt = document.getElementById('prompt');

  // keys = currently held, pressed = went down this frame
  const input = { keys: {}, pressed: new Set() };
  addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT'].includes(e.target.tagName)) return; // typing / using a panel control
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    input.keys[e.code] = true;
  });
  addEventListener('keyup', (e) => (input.keys[e.code] = false));

  // Click = capture the mouse and orbit the camera around the hero; Esc = release it (camera stays locked).
  const view = { yaw: 0, pitch: 0.55 };
  renderer.domElement.addEventListener('click', () => !world.busy && renderer.domElement.requestPointerLock());
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    view.yaw -= e.movementX * MOUSE_SENSITIVITY;
    view.pitch = THREE.MathUtils.clamp(view.pitch + e.movementY * MOUSE_SENSITIVITY, 0.1, 1.4);
  });
  const cameraOffset = () => new THREE.Vector3(
    Math.sin(view.yaw) * Math.cos(view.pitch), Math.sin(view.pitch), Math.cos(view.yaw) * Math.cos(view.pitch),
  ).multiplyScalar(CAMERA_DISTANCE);

  let current = null;
  const updaters = new Set(), interactables = [], talkers = {};

  const world = {
    scene, input,
    view,            // camera angles; arrows move relative to view.yaw
    colliders: [],   // boxes {minX,maxX,minZ,maxZ} the hero can't enter
    follow: null,    // object the camera follows
    busy: false,     // true during a dialog (hero is frozen)

    // Add objects to the scene; any object with update(dt) gets called every frame.
    add(...objects) {
      for (const o of objects) {
        scene.add(o);
        if (o.update) updaters.add(o.update);
      }
    },

    // say('Stewardess', 'Rozmowa1'): text from <audioDir>/transcription.json, audio from <audioDir>/<voice folder>/<key>.mp3
    // The speaker's mouth moves if registered in world.talkers.
    talkers,
    async say(speaker, key) {
      const npc = talkers[speaker];
      if (npc) npc.talking = true;
      await say(speaker, current.text[speaker][key], `${current.audioDir}/${current.voices[speaker]}/${key}.mp3`);
      if (npc) npc.talking = false;
    },
    async play(lines) { for (const [speaker, key] of lines) await world.say(speaker, key); },

    // Press E near `object` to run `run`: either lines [[speaker, key], ...] or an async function.
    interact(object, run) { interactables.push({ object, run }); },

    async load(def) {
      current = def;
      scene.clear();
      scene.fog = null;
      scene.background = new THREE.Color(0x000000);
      updaters.clear(); interactables.length = 0; world.colliders.length = 0;
      for (const k in talkers) delete talkers[k];
      if (def.audioDir) current.text = await (await fetch(`${def.audioDir}/transcription.json`)).json(); // scripted scenes only
      await def.build(world);
      camera.position.copy(world.follow.position).add(cameraOffset()); // start on the hero, no fly-in
    },
  };

  function updateInteraction() {
    const near = !world.busy && world.follow &&
      interactables.find((i) => i.object.position.distanceTo(world.follow.position) < TALK_RANGE);
    prompt.textContent = near ? 'E — talk' : '';
    if (near && input.pressed.has('KeyE')) {
      world.busy = true;
      const run = Array.isArray(near.run) ? () => world.play(near.run) : near.run;
      run().finally(() => (world.busy = false));
    }
  }

  function updateCamera(dt) {
    if (!world.follow) return;
    const target = world.follow.position;
    camera.position.lerp(target.clone().add(cameraOffset()), 1 - Math.exp(-10 * dt));
    camera.lookAt(target.x, target.y + 1, target.z);
  }

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    updaters.forEach((u) => u(dt));
    updateInteraction();
    updateCamera(dt);
    input.pressed.clear();
    renderer.render(scene, camera);
  });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  return world;
}
