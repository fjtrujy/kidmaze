# Kid Maze

Kid Maze is a small educational web game for children around five years old. It offers an arrow mode for learning directional commands plus harder letter and number modes for practising recognition and handwriting while guiding a nurse through a maze toward a bandage.

The project deliberately avoids a UI framework and any external recognition service. It is a static TypeScript application, so the built game can be hosted locally and does not need a backend.

## How the game works

- The maze is shown on the left in landscape orientation and above the drawing area in portrait orientation.
- The child draws `UP`, `DOWN`, `LEFT`, or `RIGHT` with a pen, finger, or mouse. The drawing may contain multiple separate strokes.
- The `↑ / ABC / 123` selector switches between **Arrow mode**, **Letter mode**, and **Number mode**. The selected mode is remembered locally.
- In Letter mode, every walkable cell receives a random letter when the level starts. Only the one or two cells immediately connected to the nurse are allowed choices and only their letters are visible; the letter under the nurse is always hidden. Recognized letters are also spoken in the selected language.
- Letter mode moves exactly one cell per recognized letter. This means the child can move one step forward or one step backward along the maze trail instead of sliding all the way to the next wall.
- Letter mode uses the complete uppercase alphabet `A` through `Z`. Neighboring choices are generated so the two visible options can never have the same letter or a model-derived confusing pair.
- Number mode follows exactly the same one-cell rules as Letter mode, but uses the digits `0` through `9`. Only adjacent digits are visible and every recognized number is spoken in the selected language.
- After one second without any new drawing, a one-second scanner animation sweeps across the drawing. The accumulated strokes are interpreted as one command when the scan finishes.
- Starting another stroke during either the idle delay or the scanner animation cancels the pending recognition and starts the timing again after that stroke finishes.
- A recognized arrow is shown briefly as a large command before the nurse moves.
- The child can switch between English and Spanish with the flag buttons. Recognized directions are both displayed and spoken in the selected language.
- The application follows Semantic Versioning. `package.json` is the single source of truth for the current `X.Y.Z` version, which is injected into the production build. Tap or click the **Kid Maze** title in the top bar to reveal the running version briefly without taking permanent screen space.
- A large full-screen button is available alongside the drawing controls on browsers that expose the Fullscreen API.
- The game always fits the current viewport without page scrolling; maze, drawing area, and controls compact automatically on shorter screens and when entering full screen.
- Touch and pen gestures are locked to the game surface, preventing viewport panning, pull-to-refresh, and pinch gestures from interrupting drawing or unexpectedly leaving full screen.
- On iPadOS, Safari reserves a downward touch gesture for leaving the Fullscreen API. Because that conflicts directly with drawing a `DOWN` arrow, Apple touch devices use the installable Home Screen web-app path instead: Share → **Add to Home Screen**. The included Web App Manifest opens Kid Maze in standalone app mode, while Chromium/Android and desktop browsers continue to use the normal Fullscreen API button.
- In Arrow mode, the nurse keeps moving in the recognized direction until it reaches a wall, the edge of the maze, or the bandage destination.
- In Arrow mode, drawing toward an adjacent wall produces a small bounce and a friendly spoken "I can't move forward" / "No puedo avanzar". There are no penalties or lives.
- Finishing a level triggers a short celebration and automatically opens the next level. Completing the whole game adds a burst of applause and animated `👏` emojis rising from the bottom of the screen.
- The arrow keys on a keyboard provide a debug control path and are not needed to play the game.

## Project structure

```text
src/
  main.ts                       Browser entry point
  styles.css                    Responsive game presentation and animations
  game/
    drawing-canvas.ts           Pointer Events input and live stroke rendering
    drawing-timing.ts           Easy-to-tune idle and scanner timing constants
    game-controller.ts          Game flow, feedback, level transitions, and controls
    i18n.ts                     English/Spanish UI and direction translations
    letter-conflicts.json       Model-derived letter pairs never shown together
    letter-mode.ts              Random A-Z letters and adjacent-choice rules
    handwriting-recognizer.ts  Lazy local ONNX handwriting classifier for letters/numbers
    letter-recognizer.ts        Geometric fallback for the original letter subset
    number-mode.ts              Random cell numbers using the same choice rules
    number-recognizer.ts        Geometric handwritten-digit fallback recognizer
    symbol-recognizer.ts        Shared point-cloud template recognition engine
    levels.ts                   Hand-authored level definitions
    maze.ts                     Grid model and move-until-blocked logic
    maze-view.ts                Maze, bandage, and nurse rendering
    sound.ts                    Small Web Audio feedback sounds
    stroke-recognizer.ts        Local four-direction arrow recognizer
    types.ts                    Shared types
public/
  models/                       Compact handwritten-symbol ONNX model
  sw.js                         Lightweight offline cache
tools/
  train-symbol-model.py         Reproducible EMNIST training/export script
```

## Run locally

Install the development dependencies once:

```sh
npm install
```

Start the development server:

```sh
npm run dev
```

Vite prints the local URL in the terminal. To use a tablet on the same network, run `npm run dev -- --host` and open the displayed network URL on the tablet.

For a production build:

```sh
npm run build
npm run preview -- --host
```

The output is written to `dist/`. The production build registers a small service worker. Once its static resources have been visited and cached, the game can continue to work without an internet connection while served from the same local origin.

## GitHub Pages

The repository includes `.github/workflows/deploy-pages.yml`. Every push to `main` runs the tests, creates the production build, and deploys `dist/` to GitHub Pages.

For the first deployment, open the repository on GitHub and select **Settings > Pages > Build and deployment > Source > GitHub Actions**. After that, pushes to `main` deploy automatically.

The Vite build uses relative asset URLs, so the game works from the project URL (`https://fjtrujy.github.io/kidmaze/`) as well as from a future custom domain without changing the build configuration. The service worker is registered relative to the deployed base path, so its offline cache stays scoped to the game instead of the whole `github.io` domain.

## Tests

Run the unit tests with:

```sh
npm test
```

The tests verify all known level solutions, blocked movement, single- and multi-stroke versions of all four arrow directions, all supported handwritten letters and digits, random adjacent-choice constraints, and rejection of simple invalid drawings.

## Adding a maze

Levels are intentionally hand-authored in `src/game/levels.ts` so their difficulty is predictable. Add another object to `LEVELS`:

```ts
{
  name: 'Example',
  grid: [
    '######',
    '#S...#',
    '####.#',
    '####E#',
    '######',
  ],
}
```

Each row must have the same width. The supported cells are:

- `#`: wall
- `.`: walkable floor
- `S`: the single nurse start cell
- `E`: the single bandage destination cell

The outer border does not have to be a wall because the maze model also treats the grid boundary as blocked, but a wall border usually looks clearer.

## Arrow recognition

`DrawingCanvas` keeps every pointer stroke visible. When a stroke finishes, it waits for `DRAWING_IDLE_BEFORE_SCAN_MS`; if there is still no input, the scanner animation starts for `DRAWING_SCAN_DURATION_MS`. Recognition runs only after that animation finishes. A new pointer-down cancels either timer and hides the scanner immediately, so a child can keep drawing the shaft and arrowhead as separate strokes without triggering a command midway through the drawing.

Both timing values live in `src/game/drawing-timing.ts`. They currently default to 1000 ms each and are intentionally centralized because they will probably need tuning after observing children use the game.

`StrokeRecognizer` works entirely in the browser. It combines the accumulated stroke points, removes points that are almost duplicates, rejects very small marks, and determines whether the drawing is predominantly horizontal or vertical. It then compares the perpendicular spread near both ends of that dominant axis.

The arrowhead normally creates much more side-to-side spread than the tail. The end with that larger spread is therefore treated as the arrow tip. This approach is independent of whether the child draws the shaft or the arrowhead first and also tolerates retracing the tip. A confidence threshold rejects marks that do not look enough like an arrow.

### Known recognizer limitations

- The recognizer treats all strokes made before a complete idle-plus-scan cycle as one drawing. Unrelated marks left in the same drawing can therefore reduce recognition confidence.
- Extremely diagonal arrows can be rejected because the game intentionally only accepts four cardinal directions.
- A very short arrowhead, or an arrowhead almost as wide at both ends of the drawing, may not provide enough geometric contrast and can return `UNKNOWN`.
- Geometry alone cannot cover every way a young child may draw an arrow. The thresholds are intentionally conservative so an uncertain drawing becomes a friendly retry instead of an incorrect command.

## Letter and number handwriting recognition

Letter and Number modes use a compact convolutional neural network trained on the EMNIST Balanced handwritten-character dataset. The browser runs the exported `public/models/kidmaze-symbols.onnx` model locally through ONNX Runtime Web's WebAssembly backend. No drawing is uploaded and recognition continues to work offline once the runtime and model have been cached.

The ML runtime is loaded lazily: opening Kid Maze in Arrow mode does not fetch ONNX Runtime, its WASM binary, or the model. They are requested only after the child switches to `ABC` or `123`. If WebAssembly/model initialization fails on a device, Kid Maze automatically falls back to the original geometric `LetterRecognizer` / `NumberRecognizer` instead of disabling those modes.

Before inference, the multi-stroke vector drawing is rasterized to a centered 28×28 grayscale image matching the EMNIST training representation. The model contains Kid Maze's 36 symbols (`0`–`9` plus uppercase `A`–`Z`) and still remains only about 250 KB.

Recognition also uses the maze context. A child never needs to distinguish all 36 classes at once: only the one or two symbols on currently reachable neighboring cells are valid. The model logits are therefore filtered to the current mode and then compared only between those visible choices, with confidence thresholds rejecting ambiguous drawings. Training evaluates every uppercase-letter pair after the final epoch and writes pairs below the configured 97% pairwise-accuracy threshold to `src/game/letter-conflicts.json`. With the current model the guarded pairs are `I/L`, `D/O`, and `U/V`, so those combinations are never presented as the two simultaneous visible choices.

The training pipeline is reproducible with:

```sh
python -m pip install torch torchvision onnx
python tools/train-symbol-model.py
```

The training dataset itself is downloaded into ignored `.cache/emnist/`; only the exported ONNX model is committed and deployed.

### Letter mode

`src/game/letter-mode.ts` assigns a random uppercase letter from `A` through `Z` to every walkable cell when a level is loaded. The assignment prevents the two neighbors around any trail cell from sharing a letter or using one of the model-derived confusing pairs, so a visible choice stays practical to distinguish. Only the neighboring cells are rendered with their letters; after a one-cell move the old hints disappear and the new neighboring choices are revealed.

The authored mazes are simple trails with at most two walkable neighbors per cell. This is what gives Letter mode its forward/backward choice without adding junction rules. If future levels introduce branches, the Letter mode rules and UI should be revisited before shipping those levels.

### Number mode

Number mode mirrors Letter mode using all ten decimal digits, `0` through `9`. A fresh random digit is assigned to each walkable cell when a level starts, neighboring options stay distinct, and a recognized digit moves the nurse exactly one cell.

Each digit is also available as a bundled bilingual speech clip (`zero` / `cero`, `one` / `uno`, and so on), so Number mode has the same spoken reinforcement as Letter mode and remains fully offline after the assets are cached.

## Language and speech

English and Spanish strings are centralized in `src/game/i18n.ts`. The selected language is remembered in local storage and defaults to the browser language on first use.

Spoken feedback does not use the browser's system text-to-speech voices. The repository contains a small set of pre-generated WAV clips under `public/audio/voice/`, so the same voice is heard on every tablet and the game still works offline. English uses Kokoro `bf_emma`; Spanish uses the MeloTTS `ES` voice at speed `1.08`, selected after an A/B comparison with the previous Kokoro Spanish voice and peak-normalized to match the listening samples. Directions, all supported Letter-mode letters, and all ten Number-mode digits are spoken after recognition. A blocked move says "I can't move forward" / "No puedo avanzar" after a short pause following the recognized direction. Web Audio is retried on each user interaction on iPadOS, and voice completion has a timeout fallback so a suspended audio context can never leave the game input locked. The final-game applause is generated locally with Web Audio, so it also works offline without another media asset.

Regenerate the voice clips with:

```sh
npm run voice:generate
```

English generation lives in `tools/generate-voice-assets.mjs` and uses `kokoro-js` only during development. Spanish generation lives in `tools/generate-spanish-voice-assets.py`; `tools/generate-spanish-voice-assets.sh` creates an ignored local Python environment on first use and installs a pinned MeloTTS revision. The wrapper uses `unidic_lite`, avoiding MeloTTS's otherwise unnecessary full Japanese dictionary download when generating Spanish. None of these generation dependencies are bundled into the browser application; only the generated WAV files are deployed.

Kokoro exposes several female English voices, so the English voice can still be changed easily. The Spanish assets intentionally use MeloTTS instead because its `ES` voice at speed `1.08` was preferred over Kokoro `ef_dora` during listening tests.

The service worker is only registered on deployed production hosts. Localhost explicitly unregisters old Kid Maze service workers and clears their caches so `vite preview` cannot get stuck serving an outdated `index.html` that references stale hashed JavaScript files.

Arrow recognition remains isolated inside `src/game/stroke-recognizer.ts`; the ML handwriting path is isolated inside `src/game/handwriting-recognizer.ts`. This keeps direction recognition independent from the letter/number classifier.
