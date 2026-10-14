"""Shortest path in a maze with persistent keys, CSV export and animation."""

import argparse
import csv
import json
import random
import sys
import webbrowser
from collections import deque
from pathlib import Path

KEYS = "abcdef"
PROJECT_DIR = Path(__file__).resolve().parent
COLORS = ["#f5b041", "#5dade2", "#af7ac5", "#48c9b0", "#ec70a3", "#a3cb38"]


def door_key(cell):
    if cell == "D:E":
        return "e"
    return cell.lower() if cell in {"A", "B", "C", "D", "F"} else None


def validate(grid, t):
    if not 1 <= t <= 6:
        raise ValueError("T must be between 1 and 6.")
    n = len(grid)
    if not n or any(len(row) != n for row in grid):
        raise ValueError("The CSV must contain a nonempty square grid.")
    allowed = set(".#SEabcdefABCDF") | {"D:E"}
    starts, exits, keys, doors = [], [], set(), set()
    for r, row in enumerate(grid):
        for c, cell in enumerate(row):
            if cell not in allowed:
                raise ValueError(f"Invalid cell {cell!r} at row {r + 1}, column {c + 1}.")
            if cell == "S":
                starts.append((r, c))
            elif cell == "E":
                exits.append((r, c))
            elif cell in KEYS:
                keys.add(cell)
            key = door_key(cell)
            if key is not None:
                doors.add(key)
    if len(starts) != 1 or len(exits) != 1:
        raise ValueError("Exactly one S and one E are required.")
    if keys != doors or len(keys) != t:
        raise ValueError(f"Expected {t} distinct matching key/door types.")
    return starts[0], exits[0]


def normalize_cell(cell):
    cell = cell.strip().removesuffix("|x")
    return "." if cell == "x" else cell


def read_csv(filename):
    with open(filename, newline="", encoding="utf-8-sig") as file:
        return [[normalize_cell(cell)
                 for cell in row] for row in csv.reader(file)]


def generate(n, t, seed=None):
    """Build a corridor tree with separated endpoints and mandatory key/door pairs."""
    if not 1 <= t <= 6:
        raise ValueError("T must be between 1 and 6.")
    side = (n + 1) // 2
    if n < 3 or 2 * side * side - 1 < 2 * t + 2:
        minimum = 3 if t <= 2 else 5
        raise ValueError(f"Use N >= {minimum} for {t} types in random corridor mode.")
    rng = random.Random(seed)
    rooms = [(r, c) for r in range(0, n, 2) for c in range(0, n, 2)]
    last = 2 * (side - 1)
    corners = [(0, 0), (0, last), (last, 0), (last, last)]

    # Room coordinates are two cells apart; unopened connectors stay walls.
    # Randomized iterative DFS adds one edge per new room, forming a tree.
    for _ in range(32):
        graph = {room: [] for room in rooms}
        root = rng.choice(corners)
        stack, visited = [root], {root}
        while stack:
            r, c = stack[-1]
            options = [(r + dr, c + dc) for dr, dc in
                       ((-2, 0), (2, 0), (0, -2), (0, 2))
                       if 0 <= r + dr < n and 0 <= c + dc < n
                       and (r + dr, c + dc) not in visited]
            if not options:
                stack.pop()
                continue
            neighbor = rng.choice(options)
            graph[(r, c)].append(neighbor)
            graph[neighbor].append((r, c))
            visited.add(neighbor)
            stack.append(neighbor)

        # Every pair of distinct corners is physically separated. Choose a
        # longest corner-to-corner route that has room for all special cells.
        candidates = []
        for i, start in enumerate(corners):
            queue, parent = deque([start]), {start: None}
            while queue:
                room = queue.popleft()
                for neighbor in graph[room]:
                    if neighbor not in parent:
                        parent[neighbor] = room
                        queue.append(neighbor)
            for end in corners[i + 1:]:
                room_route, room = [], end
                while room is not None:
                    room_route.append(room)
                    room = parent[room]
                room_route.reverse()
                if 2 * len(room_route) - 1 >= 2 * t + 2:
                    candidates.append(room_route)
        if candidates:
            longest = max(map(len, candidates))
            room_route = rng.choice([route for route in candidates if len(route) == longest])
            if rng.choice([False, True]):
                room_route.reverse()
            break
    else:
        # Bounded fallback: a snake through spaced rooms also forms a tree.
        # This guarantees termination even for a tiny grid with six types.
        room_route = [(r, c) for r in range(0, n, 2)
                      for c in (range(0, n, 2) if (r // 2) % 2 == 0
                                else range(last, -1, -2))]
        if rng.choice([False, True]):
            room_route.reverse()
        graph = {room: [] for room in rooms}
        for first, second in zip(room_route, room_route[1:]):
            graph[first].append(second)
            graph[second].append(first)

    grid = [["#"] * n for _ in range(n)]
    for r, c in rooms:
        grid[r][c] = "."
        for nr, nc in graph[(r, c)]:
            grid[(r + nr) // 2][(c + nc) // 2] = "."
    route = [room_route[0]]
    for (r, c), (nr, nc) in zip(room_route, room_route[1:]):
        route.extend([((r + nr) // 2, (c + nc) // 2), (nr, nc)])

    # A tree has exactly one simple S-to-E route, so doors cannot be bypassed.
    positions = sorted(rng.sample(range(1, len(route) - 1), 2 * t))
    types = list(KEYS[:t])
    rng.shuffle(types)
    for i, key in enumerate(types):
        r, c = route[positions[2 * i]]
        grid[r][c] = key
        r, c = route[positions[2 * i + 1]]
        grid[r][c] = "D:E" if key == "e" else key.upper()
    r, c = route[0]
    grid[r][c] = "S"
    r, c = route[-1]
    grid[r][c] = "E"
    return grid


def shortest_path(grid, t):
    """BFS on (row, column, key mask): O(N*N*2**T) time and space."""
    start, end = validate(grid, t)
    types = sorted({cell for row in grid for cell in row if cell in KEYS})
    bits = {key: 1 << i for i, key in enumerate(types)}
    initial = (*start, 0)
    queue = deque([initial])
    parent = {initial: None}
    n = len(grid)
    while queue:
        state = queue.popleft()
        r, c, mask = state
        if (r, c) == end:
            path = []
            while state is not None:
                path.append(state)
                state = parent[state]
            return path[::-1]
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nr, nc = r + dr, c + dc
            if not (0 <= nr < n and 0 <= nc < n):
                continue
            cell = grid[nr][nc]
            if cell == "#":
                continue
            key = door_key(cell)
            if key is not None and not mask & bits[key]:
                continue
            next_mask = mask | bits[cell] if cell in bits else mask
            next_state = (nr, nc, next_mask)
            if next_state not in parent:
                parent[next_state] = state
                queue.append(next_state)
    return []


def write_csv(filename, grid, path=()):
    visited = {(r, c) for r, c, _ in path}
    with open(filename, "w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        for r, row in enumerate(grid):
            writer.writerow([
                ("x" if cell == "." else cell + "|x")
                if (r, c) in visited else cell
                for c, cell in enumerate(row)
            ])


def visualization_html(grid, path):
    data = json.dumps({"grid": grid, "path": path, "colors": COLORS})
    return """<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Maze with Keys and Doors</title>
<style>
body{font:16px system-ui;margin:24px;color:#17202a;background:#f4f6f7}
.layout{display:flex;gap:24px;flex-wrap:wrap}canvas{background:white;
max-width:100%;height:auto;border:1px solid #aaa}button{padding:8px 16px;
margin:8px 8px 8px 0;cursor:pointer}.keys span{display:inline-block;
padding:8px 12px;margin:4px;border-radius:6px}#status{min-height:48px}
</style></head><body><h2>Maze with Keys and Doors</h2>
<p>White: open · Black: wall · Green: start · Red: exit<br>
Each key and matching door share a colour. Blue outlines show the complete shortest path.</p>
<div class="layout"><canvas id="maze"></canvas><div>
<h3>Key inventory</h3><div id="keys" class="keys"></div>
<p id="status"></p><button id="play">Pause</button>
<button id="replay">Replay</button><button id="complete">Show completed path</button><br>
<label>Step delay <input id="speed" type="range" min="50" max="1000"
value="250"> ms</label></div></div><script>
const data = __DATA__;
const {grid,path,colors}=data, n=grid.length;
const canvas=document.getElementById('maze'), ctx=canvas.getContext('2d');
const size=Math.max(6,Math.min(48,Math.floor(720/n)));
canvas.width=canvas.height=n*size;
const status=document.getElementById('status'), inventory=document.getElementById('keys');
const play=document.getElementById('play'), speed=document.getElementById('speed');
let index=-1, timer=null, paused=false, held=new Set(), picked=new Set(),
opened=new Set(), trail=[], visited=new Set();
const id=(r,c)=>r+','+c;
const solution=new Set(path.map(([r,c])=>id(r,c)));
const door=cell=>cell==='D:E'?'e':('ABCDF'.includes(cell)&&cell.length===1?cell.toLowerCase():null);
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){
    const cell=grid[r][c], pos=id(r,c), key=door(cell);
    let color='white', text='';
    if(cell==='#')color='black';
    else if(cell==='S'){color='#2ecc71';text='S';}
    else if(cell==='E'){color='#e74c3c';text='E';}
    else if('abcdef'.includes(cell)&&cell.length===1){
      if(!picked.has(pos)){color=colors['abcdef'.indexOf(cell)];text=cell;}
    }else if(key){
      if(opened.has(pos))text='✓';
      else{color=colors['abcdef'.indexOf(key)];text=key.toUpperCase();}
    }
    ctx.fillStyle=color;ctx.fillRect(c*size,r*size,size,size);
    ctx.strokeStyle='#aaa';ctx.lineWidth=.5;ctx.strokeRect(c*size,r*size,size,size);
    if(solution.has(pos)){
      ctx.strokeStyle=visited.has(pos)?'#1565c0':'#64b5f6';ctx.lineWidth=3;
      ctx.strokeRect(c*size+size*.12,r*size+size*.12,size*.76,size*.76);
    }
    if(size>=16){ctx.fillStyle='#17202a';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font='bold '+Math.floor(size*.4)+'px system-ui';
      ctx.fillText(text,(c+.5)*size,(r+.5)*size);}
  }
  if(trail.length){const [r,c]=trail[trail.length-1];ctx.beginPath();
    ctx.arc((c+.5)*size,(r+.5)*size,size*.14,0,Math.PI*2);
    ctx.fillStyle='#1565c0';ctx.fill();}
  inventory.replaceChildren();
  for(const key of [...held].sort()){
    const badge=document.createElement('span');badge.textContent=key;
    badge.style.background=colors['abcdef'.indexOf(key)];inventory.append(badge);
  }
  if(!held.size)inventory.textContent='Empty';
}
function step(){
  timer=null;if(paused)return;
  if(index+1>=path.length){play.textContent='Finished';play.disabled=true;return;}
  index++;const [r,c]=path[index], cell=grid[r][c], pos=id(r,c), key=door(cell);
  let event='';
  if('abcdef'.includes(cell)&&cell.length===1&&!picked.has(pos)){
    picked.add(pos);held.add(cell);event=' — picked up key '+cell;
  }else if(key&&!opened.has(pos)){opened.add(pos);event=' — unlocked door '+key.toUpperCase();}
  trail.push([r,c]);visited.add(pos);draw();
  status.textContent='Step '+index+' / '+(path.length-1)+event;
  if(index===path.length-1){play.textContent='Finished';play.disabled=true;}
  else timer=setTimeout(step,Number(speed.value)*(event?3:1));
}
function replay(){
  clearTimeout(timer);index=-1;paused=false;held.clear();picked.clear();opened.clear();
  trail=[];visited.clear();play.disabled=!path.length;play.textContent='Pause';draw();
  status.textContent=path.length?'Shortest path: '+(path.length-1)+' steps':'No path exists (-1)';
  if(path.length)timer=setTimeout(step,500);
}
play.onclick=()=>{paused=!paused;play.textContent=paused?'Play':'Pause';
  clearTimeout(timer);if(!paused)step();};
document.getElementById('replay').onclick=replay;replay();
document.getElementById('complete').onclick=()=>{
  clearTimeout(timer);paused=false;
  while(index+1<path.length){step();clearTimeout(timer);}
};
</script></body></html>""".replace("__DATA__", data)


def show_visualization(html, filename):
    # Notebook environments already provide IPython; desktop uses a browser.
    try:
        from IPython import get_ipython
        if get_ipython() is not None:
            from IPython.display import HTML, display
            display(HTML(html))
            return
    except ImportError:
        pass
    file = Path(filename).resolve()
    webbrowser.open(file.as_uri() + "?run=" + str(file.stat().st_mtime_ns), new=2)


def prompt(message):
    # Keep stdout reserved for the integer result, including redirected runs.
    print(message, end="", file=sys.stderr, flush=True)
    return input().strip()


def main(argv=None):
    parser = argparse.ArgumentParser(description="Solve and animate a maze with keys.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--csv", help="CSV filename; relative paths use the project folder")
    group.add_argument("--generate", type=int, metavar="N", help="Generate an NxN maze")
    parser.add_argument("--types", type=int, help="T; if omitted, read T from stdin")
    parser.add_argument("--seed", type=int, help="Reproducible random generation")
    parser.add_argument("--output-dir", default="results")
    parser.add_argument("--no-browser", action="store_true", help="Save animation without opening it")
    if argv is None and "ipykernel" in sys.modules:
        argv = []  # Ignore notebook kernel arguments.
    args = parser.parse_args(argv)
    try:
        t = args.types if args.types is not None else int(prompt("Key/door types T (1-6): "))
        if not 1 <= t <= 6:
            raise ValueError("T must be between 1 and 6.")
        source = None
        if args.csv is None and args.generate is None:
            choice = prompt("1 = CSV input, 2 = random maze [2]: ") or "2"
            if choice == "1":
                args.csv = prompt("CSV filename [examples/sample_maze.csv]: ") or "examples/sample_maze.csv"
            elif choice == "2":
                args.generate = int(prompt("Grid size N [15]: ") or "15")
                if args.seed is None:
                    value = prompt("Random seed (blank for random): ")
                    args.seed = int(value) if value else None
            else:
                raise ValueError("Choose 1 or 2.")
        if args.csv is not None:
            source = Path(args.csv).expanduser()
            source = (PROJECT_DIR / source).resolve() if not source.is_absolute() else source.resolve()
            grid = read_csv(source)
        else:
            grid = generate(args.generate, t, args.seed)
        path = shortest_path(grid, t)
        folder = Path(args.output_dir).expanduser()
        folder = (PROJECT_DIR / folder).resolve() if not folder.is_absolute() else folder.resolve()
        names = ["shortest_path.csv", "maze_animation.html"]
        if source is None:
            names.append("generated_maze.csv")
        if source is not None and source in {folder / name for name in names}:
            raise ValueError("The input file must differ from the output files.")
        folder.mkdir(parents=True, exist_ok=True)
        write_csv(folder / "shortest_path.csv", grid, path)
        if source is None:
            write_csv(folder / "generated_maze.csv", grid)
        html = visualization_html(grid, path)
        animation = folder / "maze_animation.html"
        animation.write_text(html, encoding="utf-8")
        print(len(path) - 1 if path else -1)
        print("Saved in " + str(folder) + ": " + ", ".join(names), file=sys.stderr)
        if not args.no_browser:
            show_visualization(html, animation)
        return 0
    except (ValueError, OSError, EOFError, csv.Error) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    if "ipykernel" in sys.modules:
        main()
    else:
        raise SystemExit(main())
