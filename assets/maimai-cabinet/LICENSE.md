# DX cabinet model

Original work **maimaiDX Style Model** by **藍玉CiAN (Cyanarisu)**.

- [Original model and author attribution](https://makerworld.com/en/models/1126413-maimaidx-style-model)
- [Author profile](https://makerworld.com/en/@Cyanarisu)
- [Creative Commons Attribution–NonCommercial–ShareAlike 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/)
- [Full license terms](https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.en)

The geometry in `mesh.js` is adapted from the user-supplied `mai.3mf`, which identifies this model and author in its metadata. The model data and these adaptations are distributed under CC BY-NC-SA 4.0. Attribution, noncommercial use and ShareAlike apply to this asset. The viewer's MIT license does not replace the model's license.

The adaptation extracts the cabinet body, one reusable button ring, center console and foot. Coordinates are converted to a Y-up view, stored at full float32 precision with crease-aware shading normals, grouped for runtime materials, compressed, and assembled for browser rendering. The printing layout, slicing settings, preview photographs and promotional artwork are omitted. The viewer supplies the screen content, materials and lighting.

The viewer uses small procedurally generated light-falloff textures with its own material shaders; it does not include a physically baked scattering shell. A shared 256 × 128 button lookup approximates a dense strip of nine recessed LEDs, their diffuser wall, and outward illumination on nearby plastic. This is precomputed modeled lighting rather than a ray-traced light bake.

`menu-landscape.svg` is original viewer artwork, independent of the cabinet model, and is covered by the project's MIT license.

To reproduce the asset, run this command from the repository root (NumPy and trimesh required):

```sh
python tools/convert-maimai-cabinet.py path/to/mai.3mf
```
