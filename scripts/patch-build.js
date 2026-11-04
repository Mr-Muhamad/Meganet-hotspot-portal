const fs = require("fs");
const buildPath = "build.js";
const tempPath = process.env.TEMP + "/build.js.new";
let c = fs.readFileSync(buildPath, "utf8");
c = c.replace(
  'if (typeof statusModule !== undefined) {',
  "if (typeof statusModule !== 'undefined') {"
);
fs.writeFileSync(tempPath, c, "utf8");
fs.copyFileSync(tempPath, buildPath);
console.log("patched");
