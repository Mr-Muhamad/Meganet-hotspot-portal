#!/usr/bin/env python3
"""Compose the README hero screenshots: one wide panel per theme.

Inputs : test-results/theme-{login,status,plans}-{dark,light}.png — the
         uniform viewport frames written by tests/e2e/theme.spec.js
         (regenerate with: npx playwright test theme.spec.js)
Outputs: docs/screenshots/theme-dark.png and theme-light.png — three
         screens side by side on the theme's own page background.

All paths are spelled out literally (see the Mimosa scanner lesson in
scripts/validate-templates.js — no dynamic path assembly).
"""

import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUTTER = 36
# Page background per theme, so the panels sit on their own surface color
BACKGROUNDS = {'dark': (2, 6, 23), 'light': (248, 250, 252)}

INPUTS = {
    'dark': [
        os.path.join(ROOT, 'test-results', 'theme-login-dark.png'),
        os.path.join(ROOT, 'test-results', 'theme-status-dark.png'),
        os.path.join(ROOT, 'test-results', 'theme-plans-dark.png'),
    ],
    'light': [
        os.path.join(ROOT, 'test-results', 'theme-login-light.png'),
        os.path.join(ROOT, 'test-results', 'theme-status-light.png'),
        os.path.join(ROOT, 'test-results', 'theme-plans-light.png'),
    ],
}
OUTPUTS = {
    'dark': os.path.join(ROOT, 'docs', 'screenshots', 'theme-dark.png'),
    'light': os.path.join(ROOT, 'docs', 'screenshots', 'theme-light.png'),
}

for theme in ('dark', 'light'):
    panels = [Image.open(path).convert('RGB') for path in INPUTS[theme]]
    width = sum(p.width for p in panels) + GUTTER * (len(panels) + 1)
    height = max(p.height for p in panels) + GUTTER * 2
    canvas = Image.new('RGB', (width, height), BACKGROUNDS[theme])
    x = GUTTER
    for panel in panels:
        canvas.paste(panel, (x, GUTTER))
        x += panel.width + GUTTER
    canvas.save(OUTPUTS[theme], optimize=True)
    print(theme, canvas.size, f"{os.path.getsize(OUTPUTS[theme]) / 1024:.0f} KB")
