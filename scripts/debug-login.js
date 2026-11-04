const fs = require("fs");
const loginPath = "src/templates/login.html";
const content = fs.readFileSync(loginPath, "utf8");

const startMarker = 'placeholder="Enter password">';
const startIndex = content.indexOf(startMarker);
const segment = content.substring(startIndex, startIndex + 350);

console.log("LENGTH", segment.length);
console.log(JSON.stringify(segment));
