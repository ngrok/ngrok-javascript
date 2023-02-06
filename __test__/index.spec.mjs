import test from 'ava'

import { NgrokSessionBuilder } from '../index.js'

test('make sessionbuilder', (t) => {
  var builder = new NgrokSessionBuilder();
  t.truthy(builder);
})
