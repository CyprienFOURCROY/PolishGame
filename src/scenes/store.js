// Scene 1: a flat black world with a store. The stewardess and a passenger are inside.
import * as THREE from 'three';
import { box, makeStars } from '../props.js';
import { makeHero } from '../hero.js';
import { makeCharacter } from '../character.js';

const WALL_HEIGHT = 2;

export default {
  audioDir: 'Audio/Plane',
  voices: { hero: 'Hero', Stewardess: 'Stewardess', Passenger: 'PassengerInThePlane' }, // speaker -> folder

  build(world) {
    world.scene.fog = new THREE.Fog(0x000000, 25, 90);
    world.add(new THREE.GridHelper(200, 100, 0x888888, 0x333333), makeStars());

    // store: x -6..6, z -12..-2, open top, door gap in the front wall (x -1.2..1.2)
    const wall = (minX, maxX, minZ, maxZ) => {
      world.add(box([maxX - minX, WALL_HEIGHT, maxZ - minZ], [(minX + maxX) / 2, WALL_HEIGHT / 2, (minZ + maxZ) / 2]));
      world.colliders.push({ minX, maxX, minZ, maxZ });
    };
    wall(-6.2, 6.2, -12.2, -12);   // back
    wall(-6.2, -6, -12, -2);       // left
    wall(6, 6.2, -12, -2);         // right
    wall(-6, -1.2, -2.2, -2);      // front, left of the door
    wall(1.2, 6, -2.2, -2);        // front, right of the door

    const hero = makeHero(world, 0, 6);
    const stewardess = makeCharacter();
    const passenger = makeCharacter();
    stewardess.position.x = -2.5; stewardess.position.z = -5;
    passenger.position.x = 3;     passenger.position.z = -9;
    stewardess.target = passenger.target = hero;
    world.add(hero, stewardess, passenger);
    world.follow = hero;
    world.talkers.Stewardess = stewardess;
    world.talkers.Passenger = passenger;

    // Texts live in Audio/Plane/transcription.json. The passenger only speaks if you go to him.
    world.interact(stewardess, [
      ['Stewardess', 'Rozmowa1'], ['hero', 'Rozmowa1'],
      ['Stewardess', 'Rozmowa2'], ['hero', 'Rozmowa2'],
      ['Stewardess', 'Rozmowa3'],
    ]);
    world.interact(passenger, [['Passenger', 'Rozmowa1']]);
  },
};
