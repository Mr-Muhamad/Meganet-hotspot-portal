const fs = require("fs");
const authPath = "src/js/modules/auth.js";
let content = fs.readFileSync(authPath, "utf8");

const broken = 'a3 3 0 1 1-4.24-4.24"></svg><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
const fixed = 'a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

if (content.includes(broken)) {
  content = content.replace(broken, fixed);
  fs.writeFileSync(authPath, content, "utf8");
  console.log("fixed auth.js svg");
} else {
  console.log("no broken svg found");
}
