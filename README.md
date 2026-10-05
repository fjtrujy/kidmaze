# Kid Maze

Kid Maze is a small educational web game for children around five years old. A child draws one of four arrows and the game turns that drawing into a command that moves a nurse through a maze toward a bandage.

The project deliberately avoids a UI framework and any external recognition service. It is a static TypeScript application, so the built game can be hosted locally and does not need a backend.

## How the game works

- The maze is shown on the left in landscape orientation and above the drawing area in portrait orientation.
- The child draws `UP`, `DOWN`, `LEFT`, or `RIGHT` with a pen, finger, or mouse. The drawing may contain multiple separate strokes.
- After five seconds without any new drawing, the accumulated strokes are interpreted as one command.
- A recognized arrow is shown briefly as a large command before the nurse moves.
- The nurse keeps moving in that direction until it reaches a wall, the edge of the maze, or the bandage destination.
- Drawing toward an adjacent wall only produces a small bounce. There are no penalties or lives.
- Finishing a level triggers a short celebration and automatically opens the next level.
- The arrow keys on a keyboard provide a debug control path and are not needed to play the game.

## Project structure

```text
src/
  main.ts                       Browser entry point
  styles.css                    Responsive game presentation and animations
  game/
    drawing-canvas.ts           Pointer Events input and live stroke rendering
    game-controller.ts          Game flow, feedback, level transitions, and controls
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

`DrawingCanvas` keeps every pointer stroke visible and restarts a five-second idle timer whenever a stroke finishes. A new stroke cancels and restarts that timer. Only after five seconds of inactivity is the complete drawing passed to `StrokeRecognizer`, so a child can draw the shaft and arrowhead separately without triggering commands in between.

`StrokeRecognizer` works entirely in the browser. It combines the accumulated stroke points, removes points that are almost duplicates, rejects very small marks, and determines whether the drawing is predominantly horizontal or vertical. It then compares the perpendicular spread near both ends of that dominant axis.

The arrowhead normally creates much more side-to-side spread than the tail. The end with that larger spread is therefore treated as the arrow tip. This approach is independent of whether the child draws the shaft or the arrowhead first and also tolerates retracing the tip. A confidence threshold rejects marks that do not look enough like an arrow.

### Known recognizer limitations

- The recognizer treats all strokes made within the five-second inactivity window as one drawing. Unrelated marks left in the same drawing can therefore reduce recognition confidence.
- Extremely diagonal arrows can be rejected because the game intentionally only accepts four cardinal directions.
- A very short arrowhead, or an arrowhead almost as wide at both ends of the drawing, may not provide enough geometric contrast and can return `UNKNOWN`.
- Geometry alone cannot cover every way a young child may draw an arrow. The thresholds are intentionally conservative so an uncertain drawing becomes a friendly retry instead of an incorrect command.

These constraints are isolated inside `src/game/stroke-recognizer.ts`, so the recognizer can later be replaced or augmented without changing the maze or game controller.
