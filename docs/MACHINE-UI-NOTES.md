# Machine UI reference study

The six user-supplied images are visual references, not bundled assets.

1. **Song card:** tall portrait card; raised DX tab at the upper left; difficulty-colored frame; large square jacket; difficulty and oversized level on one baseline; two dark blue title/artist strips; pale footer with chart designer on the left and BPM on the right. Keep metadata readable rather than merging difficulty, level and title into one label.
2. **Upper screen during play:** jacket occupies roughly the left quarter. Difficulty ribbon and level fill the upper right; title sits in a narrow navy strip; achievement dominates the lower right. Minimal secondary text, strong hierarchy, cyan scenic background.
3. **Upper screen results:** compact five-column judgment matrix fills the left three quarters; separate FAST/LATE boxes on the right. The viewer shows actual autoplay totals, not invented player judgments or scores.
4. **Difficulty selection:** circular landscape; arched difficulty heading; thin navy instruction ribbon around 35% height with a difficulty-color underline; pale central carousel band; selected card centered and larger than its neighbors; broad U-shaped difficulty-color accent below it; radial navigation and Back/Next controls at the matching cabinet buttons.
5. **After choosing a difficulty:** keep the selected song card centered, with adjacent option cards in the same carousel. The options panel should summarize current viewer settings and open a real editor. No unsupported invitation-play or multiplayer controls.
6. **Settings editor:** category tabs above the instruction ribbon; large selected cyan setting card, smaller adjacent cards; clear current value and adjustment arrows; circular navigation controls. Use the existing viewer settings and persistence rather than maintaining a second configuration.

## Motion and implementation

- Animate carousel position, scale, opacity and difficulty colors together, around 350–450 ms with easing.
- Use short cabinet-screen light wipes and eased content reveals between phases; animate the upper screen on selection changes, never on every score update.
- Keep decorative upper-screen backgrounds static to preserve the Firefox performance fix. Respect reduced-motion preferences.
- Author original scenery and interface decoration, then bake the UI graphics into PNG sprites; do not extract branded scenery, logos, characters or fonts from the references.
- Keep button navigation and keyboard equivalents; settings must write through to the existing sidebar controls so both views stay in sync.
- Keep real chart/difficulty counts instead of an artificial selection countdown or fabricated player history.

## Implemented

- Original landscape sprite shared by the round menu and upper display; tabbed difficulty cards with real jacket/title/artist/designer/BPM data.
- Ready carousel with Speed & Sound and Viewer Options cards. The settings carousel edits the existing approach speed, song speed, volume, pitch behavior, background blur/darkness, sensor visibility, combo opacity, hit effects and extra info controls.
- Cabinet buttons 6/3 select an item, 8/1 decrease/increase, 7/2 change category, and 4/5 finish/back. Keyboard equivalents appear on screen. Media-dependent settings stay unavailable when the loaded chart has no supported background media.
- PNG action buttons use concentric curved edges and radial sides, aligned to their physical cabinet button directions. Their borders and bilingual lettering are baked into the sprites.
- Upper play display prioritizes achievement; the result display shows the actual autoplay judgment totals. No arcade logos, player avatars or artwork are included in the new menu scenery.
- Focused Firefox check covered selection, settings synchronization/persistence, playback, results and return to selection. Visual proofs stayed in the temporary workspace.

The machine menu now uses the shared PNG set in `assets/maimai-ui/` for its visual surfaces. `machine.css` retains layout and animation; `machine-sprites.css` binds the artwork. Dynamic chart and playback text stays live. The generator in `tools/build-machine-sprites.cjs` reproduces the sprites without adding a browser runtime dependency.
