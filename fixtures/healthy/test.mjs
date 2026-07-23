import assert from 'node:assert/strict';
import { greeting } from './lib.mjs';

assert.equal(greeting('Maintainer'), 'README ready, Maintainer.');
assert.throws(() => greeting(''), /name is required/u);
console.log('2 fixture assertions passed');
