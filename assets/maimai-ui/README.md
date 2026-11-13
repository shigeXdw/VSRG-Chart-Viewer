# Machine UI sprites

Original viewer artwork under the project's MIT license. These PNGs are generated from the authored shapes in `tools/build-machine-sprites.cjs` and the original `assets/maimai-cabinet/menu-landscape.svg`. They are not extracted arcade assets.

The sprite set covers the circular machine menus, radial action buttons and their lettering, navigation icons, difficulty cards, settings panels, upper-screen frames, result table and scenery. Chart jackets, metadata, current settings and live statistics remain dynamic. Gameplay note artwork and the cabinet model are separate.

Buttons use concentric inner and outer edges with radial sides. Their pivot is 446 pixels from the center of a 1000-pixel circular screen. Each 236 × 124 design is rendered at 3× resolution with transparent padding. Both cabinets reuse the same images; there is no per-frame rasterization.

To rebuild, install Playwright separately and set `PLAYWRIGHT_MODULE`, `BROWSER_ENGINE` and `BROWSER_EXE` as needed, then run:

```sh
node tools/build-machine-sprites.cjs
```

Japanese button lettering uses Meiryo (or the system fallback) during the build. No font files are bundled or required at runtime. On Windows, rebuild with Meiryo available to retain the checked lettering.
