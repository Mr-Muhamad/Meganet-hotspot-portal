const fs = require("fs");
const svgPath = "src/assets/prand-title.svg";
let svg = fs.readFileSync(svgPath, "utf8");

const lightModeCSS = `
    @media (prefers-color-scheme: light) {
      :root {
        --main-color: #0f172a;
        --accent-color: #0ea5e9;
      }

      .text-luxury {
        fill: #0f172a !important;
      }

      .glow-rect {
        stop-color: #0ea5e9 !important;
      }

      rect[fill="url(#goldGrad)"] {
        fill: url(#charcoalGrad) !important;
      }
    }`;

svg = svg.replace(
  "    @media (prefers-color-scheme: dark) {",
  lightModeCSS + "\n\n    @media (prefers-color-scheme: dark) {"
);

fs.writeFileSync(svgPath, svg, "utf8");
console.log("patched prand-title.svg light mode colors to match logo.svg");
