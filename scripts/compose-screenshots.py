#!/usr/bin/env python3
"""Compose the README hero screenshots.

Outputs four composites in docs/screenshots/:
  theme-dark.png / theme-light.png — ALL six portal pages in a 2x3 grid
  login-modes-dark.png / login-modes-light.png — the three login modes
  (voucher / normal / both) side by side

Inputs (uniform viewport frames):
  test-results/theme-<page>-<theme>.png   — written by tests/e2e/theme.spec.js
  test-results/mode-<mode>-<theme>.png    — captured per loginMode build
        (swap config.json loginMode -> build -> run login-modes.spec.js ->
         copy loginmode-<theme>.png to mode-<mode>-<theme>.png)

Regenerate after any visual change:
  npx playwright test theme.spec.js && npx playwright test login-modes.spec.js
  python scripts/compose-screenshots.py

All paths are spelled out literally (see the Mimosa scanner lesson in
scripts/validate-templates.js — no dynamic path assembly).
"""

import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS = os.path.join(ROOT, 'test-results')
DOCS = os.path.join(ROOT, 'docs', 'screenshots')
GUTTER = 36
# Page background per theme, so the panels sit on their own surface color
BACKGROUNDS = {'dark': (2, 6, 23), 'light': (248, 250, 252)}


def grid(panel_paths, columns, background):
    """Stitch uniform panels into a rows-x-columns grid."""
    panels = [Image.open(path).convert('RGB') for path in panel_paths]
    rows = (len(panels) + columns - 1) // columns
    panel_w, panel_h = panels[0].width, panels[0].height
    width = columns * panel_w + (columns + 1) * GUTTER
    height = rows * panel_h + (rows + 1) * GUTTER
    canvas = Image.new('RGB', (width, height), background)
    for index, panel in enumerate(panels):
        row, col = divmod(index, columns)
        canvas.paste(panel, (GUTTER + col * (panel_w + GUTTER), GUTTER + row * (panel_h + GUTTER)))
    return canvas


# theme-<page>-<theme>.png: all six pages, rows of three
PAGES_DARK = [
    os.path.join(RESULTS, 'theme-login-dark.png'),
    os.path.join(RESULTS, 'theme-status-dark.png'),
    os.path.join(RESULTS, 'theme-logout-dark.png'),
    os.path.join(RESULTS, 'theme-plans-dark.png'),
    os.path.join(RESULTS, 'theme-alogin-dark.png'),
    os.path.join(RESULTS, 'theme-expired-dark.png'),
]
PAGES_LIGHT = [
    os.path.join(RESULTS, 'theme-login-light.png'),
    os.path.join(RESULTS, 'theme-status-light.png'),
    os.path.join(RESULTS, 'theme-logout-light.png'),
    os.path.join(RESULTS, 'theme-plans-light.png'),
    os.path.join(RESULTS, 'theme-alogin-light.png'),
    os.path.join(RESULTS, 'theme-expired-light.png'),
]

# mode-<mode>-<theme>.png: the three login modes, one row
MODES_DARK = [
    os.path.join(RESULTS, 'mode-voucher-dark.png'),
    os.path.join(RESULTS, 'mode-normal-dark.png'),
    os.path.join(RESULTS, 'mode-both-dark.png'),
]
MODES_LIGHT = [
    os.path.join(RESULTS, 'mode-voucher-light.png'),
    os.path.join(RESULTS, 'mode-normal-light.png'),
    os.path.join(RESULTS, 'mode-both-light.png'),
]

JOBS = [
    ('theme-dark.png', PAGES_DARK, 3, BACKGROUNDS['dark']),
    ('theme-light.png', PAGES_LIGHT, 3, BACKGROUNDS['light']),
    ('login-modes-dark.png', MODES_DARK, 3, BACKGROUNDS['dark']),
    ('login-modes-light.png', MODES_LIGHT, 3, BACKGROUNDS['light']),
]

for name, paths, columns, background in JOBS:
    out = os.path.join(DOCS, name)
    image = grid(paths, columns, background)
    image.save(out, optimize=True)
    print(name, image.size, f"{os.path.getsize(out) / 1024:.0f} KB")
