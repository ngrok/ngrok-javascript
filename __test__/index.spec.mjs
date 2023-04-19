import test from "ava";

import { NgrokSessionBuilder } from "../index.js";

test("smoke", (t) => {
  var builder = new NgrokSessionBuilder();
  t.truthy(builder);
});
