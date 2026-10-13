# Tetris

A browser Tetris game with keyboard and touch controls, a held piece, upcoming-piece previews, and a saved best score.

[Play Tetris](https://williaml835.github.io/tetris.github.io/)

## Run locally

From this repository folder, run:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. No installation or build step is needed.

## Controls

| Action | Keys |
| --- | --- |
| Move left/right | Left/right arrows or A/D |
| Soft drop | Down arrow or S |
| Rotate clockwise | Up arrow, W, or X |
| Rotate counterclockwise | Z |
| Hard drop | Space |
| Hold/swap | C or Shift |
| Pause/resume | P or Escape |
| Start; resume when paused | Enter |
| Restart | Restart button |

Buttons below the board provide touch controls. The best score is stored in this browser's local storage.

## Folder guide

```text
tetris.github.io/
├── index.html                 # Website entry page
├── assets/
│   ├── js/game.js             # Game logic and controls
│   └── css/styles.css         # Layout and appearance
└── docs/maintenance.md        # Editing and publishing notes
```

The repository keeps its existing name so links remain stable. See [maintenance notes](docs/maintenance.md) for publishing and the course-notebook relocation.

## Related repositories

- [Workout Log](https://github.com/williaml835/workout-log) — workout tracking website.
- [CSE 20](https://github.com/williaml835/cse20) — Python lecture notebooks and study notes.

