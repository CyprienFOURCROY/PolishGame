// The open world: a small city on the black grid, with characters walking its streets. Grow it by playing.
import * as THREE from 'three';
import { makeStars } from '../props.js';
import { makeHero } from '../hero.js';
import { makeCharacter } from '../character.js';
import { buildCity, loopAround } from '../city.js';
import { talkTo } from '../conversation.js';

export default {
  async build(world) {
    world.scene.fog = new THREE.Fog(0x000000, 25, 90);
    world.add(new THREE.GridHelper(200, 100, 0x888888, 0x333333), makeStars());

    buildCity(world);

    const hero = makeHero(world, 0, 0);
    world.add(hero);
    world.follow = hero;

    // who is where, what they look like, how they talk: characters.json
    const characters = await (await fetch('characters.json')).json();
    for (const [name, c] of Object.entries(characters)) {
      const npc = makeCharacter(c.accessory);
      npc.path = loopAround(c.block, { clockwise: c.clockwise });  // each one walks around its block
      npc.speed = c.speed;
      npc.position.x = npc.path[0].x;
      npc.position.z = npc.path[0].z;
      npc.target = hero;
      world.add(npc);
      world.interact(npc, () => talkTo(name, npc)); // E near them -> live conversation
    }
  },
};
