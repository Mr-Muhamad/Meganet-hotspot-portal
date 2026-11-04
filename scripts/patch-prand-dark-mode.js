const fs = require("fs");
const svgPath = "src/assets/prand-title.svg";
const cssPath = "src/css/components.css";

let svg = fs.readFileSync(svgPath, "utf8");

if (!svg.includes("prefers-color-scheme: dark")) {
  svg = svg.replace(
    "    :root {\n      --main-color: #2c2c2c;    /* كحلي عميق للوضع النهاري */",
    "    :root {\n      --main-color: #2c2c2c;    /* لون النص للوضع النهاري */"
  );

  const darkModeCSS = `

    @media (prefers-color-scheme: dark) {
      :root {
        --main-color: #f1f5f9;   /* نص فضي للوضع الليلي */
        --accent-color: #38bdf8; /* سماوي فاتح للمدارات */
      }

      .text-luxury {
        fill: #f1f5f9 !important;
      }

      .glow-rect {
        stop-color: #38bdf8 !important;
      }

      rect[fill="url(#goldGrad)"] {
        fill: url(#shimmerGrad) !important;
      }
    }`;

  svg = svg.replace(
    "    .letter-m {",
    darkModeCSS + "\n\n    .letter-m {"
  );

  fs.writeFileSync(svgPath, svg, "utf8");
  console.log("patched prand-title.svg with dark mode support");
} else {
  console.log("prand-title.svg already has dark mode support");
}
