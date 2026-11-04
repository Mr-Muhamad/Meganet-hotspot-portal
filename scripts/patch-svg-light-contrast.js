const fs = require("fs");
const logoPath = "src/assets/logo.svg";
const prandPath = "src/assets/prand-title.svg";

let logo = fs.readFileSync(logoPath, "utf8");
logo = logo.replace(/--main-color: #0f172a;/, "--main-color: #0b1220;");
logo = logo.replace(/--accent-color: #0ea5e9;/, "--accent-color: #38bdf8;");
logo = logo.replace(/--text-color: #0f172a;/, "--text-color: #0b1220;");
fs.writeFileSync(logoPath, logo, "utf8");
console.log("patched logo.svg light mode colors");

let prand = fs.readFileSync(prandPath, "utf8");

if (!prand.includes("patch-svg-light-contrast.js")) {
  const lightBlock = `    @media (prefers-color-scheme: light) {
      :root {
        --main-color: #0b1220;
        --accent-color: #38bdf8;
      }

      .text-luxury {
        fill: #0b1220 !important;
      }

      .glow-rect {
        stop-color: #38bdf8 !important;
      }

      rect[fill="url(#goldGrad)"] {
        fill: url(#charcoalGrad) !important;
      }

      text, tspan {
        fill: #0b1220 !important;
      }

      tspan {
        fill: #38bdf8 !important;
      }
    }`;

  prand = prand.replace(
    "    @media (prefers-color-scheme: dark) {",
    lightBlock + "\n\n    @media (prefers-color-scheme: dark) {"
  );
  fs.writeFileSync(prandPath, prand, "utf8");
  console.log("patched prand-title.svg light mode colors");
} else {
  console.log("prand-title.svg already patched");
}
