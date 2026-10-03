import { createWorld } from './engine.js';
import world_ from './scenes/world.js';
import { initPanel } from './panel.js';
import { initMusic } from './music.js';

const world = createWorld();
initPanel();
initMusic();
world.load(world_); // other scenes (e.g. scenes/store.js) can be loaded the same way
