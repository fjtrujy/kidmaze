# Kid Maze

Kid Maze is a small educational web game for children around five years old. A child draws one of four arrows and the game turns that drawing into a command that moves a nurse through a maze toward a bandage.

The project deliberately avoids a UI framework and any external recognition service. It is a static TypeScript application, so the built game can be hosted locally and does not need a backend.

## How the game works

- The maze is shown on the left in landscape orientation and above the drawing area in portrait orientation.
- The child draws `UP`, `DOWN`, `LEFT`, or `RIGHT` with a pen, finger, or mouse. The drawing may contain multiple separate strokes.
- After two seconds without any new drawing, a two-second scanner animation sweeps across the drawing. The accumulated strokes are interpreted as one command when the scan finishes.
- Starting another stroke during either the idle delay or the scanner animation cancels the pending recognition and starts the timing again after that stroke finishes.
- A recognized arrow is shown briefly as a large command before the nurse moves.
- The child can switch between English and Spanish with the flag buttons. Recognized directions are both displayed and spoken in the selected language.
- The nurse keeps moving in that direction until it reaches a wall, the edge of the maze, or the bandage destination.
- Drawing toward an adjacent wall produces a small bounce and a friendly spoken "no, no". There are no penalties or lives.
- Finishing a level triggers a short celebration and automatically opens the next level.
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
    levels.ts                   Hand-authored level definitions
    maze.ts                     Grid model and move-until-blocked logic
    maze-view.ts                Maze, bandage, and nurse rendering
    sound.ts                    Small Web Audio feedback sounds
    stroke-recognizer.ts        Local four-direction arrow recognizer
    types.ts                    Shared types
public/
  sw.js                         Lightweight offline cache
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

The tests verify all known level solutions, blocked movement, single- and multi-stroke versions of all four arrow directions, and rejection of simple invalid drawings.

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

Both timing values live in `src/game/drawing-timing.ts`. They currently default to 2000 ms each and are intentionally centralized because they will probably need tuning after observing children use the game.

`StrokeRecognizer` works entirely in the browser. It combines the accumulated stroke points, removes points that are almost duplicates, rejects very small marks, and determines whether the drawing is predominantly horizontal or vertical. It then compares the perpendicular spread near both ends of that dominant axis.

The arrowhead normally creates much more side-to-side spread than the tail. The end with that larger spread is therefore treated as the arrow tip. This approach is independent of whether the child draws the shaft or the arrowhead first and also tolerates retracing the tip. A confidence threshold rejects marks that do not look enough like an arrow.

### Known recognizer limitations

- The recognizer treats all strokes made before a complete idle-plus-scan cycle as one drawing. Unrelated marks left in the same drawing can therefore reduce recognition confidence.
- Extremely diagonal arrows can be rejected because the game intentionally only accepts four cardinal directions.
- A very short arrowhead, or an arrowhead almost as wide at both ends of the drawing, may not provide enough geometric contrast and can return `UNKNOWN`.
- Geometry alone cannot cover every way a young child may draw an arrow. The thresholds are intentionally conservative so an uncertain drawing becomes a friendly retry instead of an incorrect command.

## Language and speech

English and Spanish strings are centralized in `src/game/i18n.ts`. The selected language is remembered in local storage and defaults to the browser language on first use. Direction feedback uses the browser's Web Speech API, so the exact voice depends on the device and installed browser voices. Muting sound also disables and cancels speech.

These constraints are isolated inside `src/game/stroke-recognizer.ts`, so the recognizer can later be replaced or augmented without changing the maze or game controller.
