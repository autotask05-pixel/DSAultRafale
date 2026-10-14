# Problem 1: Maze with Keys and Doors

Python implementation using breadth-first search over position and key inventory.
Includes CSV input, solvable random generation, path export and browser animation.

## Requirements

- Python 3.10 or newer.
- A browser to view the animation.
- No third-party Python packages are required for desktop execution.

## Run

From this directory:

```bash
python maze.py
```

To use the sample CSV, enter the following responses, one per line:

```text
1
1
examples/sample_maze.csv
```

The responses specify one key/door type, CSV input, and the filename.
The shortest path length is **6**. The animation opens automatically.

For random generation, enter:

```text
3
2
15
42
```

This specifies three types, random generation, N=15, and seed 42.
The generated example has a shortest path of **54** steps.

Command-line options support reproducible evaluation:

```bash
python maze.py --csv examples/sample_maze.csv --types 1
python maze.py --generate 15 --types 3 --seed 42
```

To read T from standard input as specified in the problem, omit `--types`:

```bash
python maze.py --csv examples/sample_maze.csv
```

Then enter `1`. Prompts and file information are written to stderr; stdout contains
only the integer shortest path length, or -1 for a valid unsolvable maze.
Invalid input reports an error and exits with status 1.

Add `--no-browser` to save the animation without opening it.
Use `--output-dir results/demo1` to retain outputs from a separate run.

## PyCharm

Open this directory and select a Python 3.10+ project interpreter. The `.run`
directory contains three configurations:

| Configuration | Purpose |
| --- | --- |
| Maze Interactive | Prompts for CSV input or generation |
| Maze CSV Demo | Runs the supplied sample; expected result 6 |
| Maze Random Demo | Generates N=15, T=3, seed=42; expected result 54 |

Alternatively, run `maze.py` directly without arguments. Configurations use the
project interpreter and contain no machine-specific interpreter paths.

## CSV format

Supply N rows with N comma-separated cell tokens per row, without a header.
Supported tokens are `.`, `#`, `S`, `E`, `a`–`f`, `A`–`D`, `F`, and `D:E`.
For example:

```csv
S,.,a,.,A
#,#,#,#,.
.,.,.,.,E
#,#,#,#,#
#,#,#,#,#
```

**Exit/door convention:** The statement uses `E` for both the exit and the door
matching key `e`. This implementation reserves `E` for the exit and represents
that door as `D:E`. All six key types are supported with this convention.

Exactly one S and one E are required, with T distinct matching key/door types.
Repeated cells of a type and nonconsecutive types are supported. CSV whitespace
and UTF-8 BOMs are accepted. Relative paths are resolved from the directory
containing `maze.py`; absolute paths are also accepted.

## Outputs and visualization

Default output directory: `results/`.

| File | Contents |
| --- | --- |
| `shortest_path.csv` | Open path cells as `x`; special cells retain identity, e.g. `a|x`, `A|x`, `S|x`, `E|x`, `D:E|x` |
| `maze_animation.html` | Coloured grid, complete shortest path and animated traversal |
| `generated_maze.csv` | Original random maze, written in generation mode |

The animation uses white for open cells, black for walls, green for start, red
for exit, and a distinct colour for each key/door pair. Blue outlines display
the complete shortest path immediately; darker outlines track traversal.
Collected key cells become white and the inventory updates. Traversed doors
become white with an unlock check mark. Controls provide Pause/Play, Replay,
Show completed path, and animation speed adjustment.

The saved HTML is self-contained and works offline. A fresh browser URL is used
on each run. If no path exists, the CSV preserves the original grid and the
animation reports -1. The CSV shows visited cells; the animation preserves
the order of revisits. Exported CSVs can be read back without losing cell identities.
Subsequent runs replace files with the same names. Input files are protected
against overwriting by an output target.

## Random generation

A randomized DFS builds a tree of corridors. Start and exit occupy separated
corner rooms, and every generated key and door lies on their unique route.
Each key precedes its matching door; doors cannot be bypassed.

Generation requires N≥3 for T=1–2 and N≥5 for T=3–6. For even N, the final row
and column remain walls. A seed makes runs reproducible within the same runtime.
These restrictions apply to generation only. The CSV solver accepts smaller
valid grids and does not require collecting unused keys.

## Sample results

| CSV | T | Shortest path |
| --- | --- | --- |
| `examples/sample_maze.csv` | 1 | 6 |
| `examples/revisit.csv` | 1 | 4 |
| `examples/unreachable.csv` | 1 | -1 |
| `examples/six_keys.csv` | 6 | 14 |

## Algorithm and verification

The BFS state is `(row, column, key_mask)`. A door is traversable only when its
key bit is set; key pickup sets that bit permanently. Revisiting a coordinate
with a different inventory is allowed. All moves cost one, so BFS yields the
shortest legal path. Time and space are O(N²·2^T), with T≤6.

See `ANALYSIS.md` for the correctness proof, algorithm comparisons, generator
proof, complexity and corner cases.

Run the tests:

```bash
python -m unittest discover -s tests -v
```

The suite contains 14 tests, including 480 seeded generated mazes cross-checked
against an independent Dijkstra solver, sample answers, inaccessible doors,
revisits, repeated types, CSV round trips, validation and CLI behavior.
