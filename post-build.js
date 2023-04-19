// basically "cat gen.js trailer.js > index.js" but in nodejs to be cross-platform
// called from 'yarn build', configured in package.json
// e.g.: node post-build.js trailer index <input_file_path>

var args = process.argv.slice(2);
var trailer_prefix = args[0];
var output_prefix = args[1];
var input_path = args[2];

// skipping the typescript file since it actually isn't written before the call to pipe:
// https://github.com/napi-rs/napi-rs/issues/1188
if (input_path.endsWith(".d.ts")) {
  console.log("skipping .d.ts file: " + input_path);
  return;
}

// run for .js and .d.ts
concat_files(trailer_prefix, output_prefix, input_path);
concat_files(trailer_prefix, output_prefix, input_path.replace(/\.js/, ".d.ts"));

function concat_files(trailer_prefix, output_prefix, input_path) {
  console.log(
    "trailer_prefix: '" +
      trailer_prefix +
      "' output_prefix: '" +
      output_prefix +
      "' input_path: '" +
      input_path +
      "'"
  );
  path = require("path");
  input_filename = path.basename(input_path);
  input_suffix = input_filename.substring(input_filename.indexOf("."), input_filename.length);
  output_filename = output_prefix + input_suffix;

  console.log("writing: " + output_filename);
  var fs = require("fs");
  // input to output
  var data = fs.readFileSync(input_path, "utf8");
  fs.writeFileSync(output_filename, data, { encoding: "utf8", flag: "w" });
  // trailer to output
  data = fs.readFileSync(trailer_prefix + input_suffix, "utf8");
  fs.writeFileSync(output_filename, data, { encoding: "utf8", flag: "a" });
  console.log("post-build complete");
}
