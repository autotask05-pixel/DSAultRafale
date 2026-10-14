import contextlib
import heapq
import io
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import maze


def reference_distance(grid):
    """Independent Dijkstra with fixed alphabet masks for cross-checking BFS."""
    n = len(grid)
    start = next((r, c) for r in range(n) for c in range(n) if grid[r][c] == 'S')
    queue = [(0, *start, 0)]
    distances = {(*start, 0): 0}
    while queue:
        distance, r, c, mask = heapq.heappop(queue)
        if distance != distances[(r, c, mask)]:
            continue
        if grid[r][c] == 'E':
            return distance
        for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if nr < 0 or nc < 0 or nr >= n or nc >= n:
                continue
            cell = grid[nr][nc]
            if cell == '#':
                continue
            key = 'e' if cell == 'D:E' else cell.lower() if cell in {'A', 'B', 'C', 'D', 'F'} else None
            if key is not None and not (mask & (1 << (ord(key) - ord('a')))):
                continue
            new_mask = mask | (1 << (ord(cell) - ord('a'))) if cell in 'abcdef' else mask
            state = (nr, nc, new_mask)
            if distance + 1 < distances.get(state, float('inf')):
                distances[state] = distance + 1
                heapq.heappush(queue, (distance + 1, *state))
    return -1


class MazeTests(unittest.TestCase):
    def check_path(self, grid, path):
        self.assertTrue(path)
        types = sorted({cell for row in grid for cell in row if cell in maze.KEYS})
        bits = {key: 1 << i for i, key in enumerate(types)}
        held, expected_mask, previous = set(), 0, None
        for r, c, mask in path:
            if previous is not None:
                self.assertEqual(abs(r - previous[0]) + abs(c - previous[1]), 1)
            cell = grid[r][c]
            self.assertNotEqual(cell, '#')
            key = maze.door_key(cell)
            if key is not None:
                self.assertIn(key, held)
            if cell in maze.KEYS:
                held.add(cell)
                expected_mask |= bits[cell]
            self.assertEqual(mask, expected_mask)
            previous = r, c
        self.assertEqual(grid[path[0][0]][path[0][1]], 'S')
        self.assertEqual(grid[path[-1][0]][path[-1][1]], 'E')

    def test_examples_and_reference(self):
        for name, t, answer in [('sample_maze', 1, 6), ('revisit', 1, 4),
                                ('unreachable', 1, -1), ('six_keys', 6, 14)]:
            with self.subTest(name=name):
                grid = maze.read_csv(ROOT / 'examples' / (name + '.csv'))
                path = maze.shortest_path(grid, t)
                self.assertEqual(len(path) - 1 if path else -1, answer)
                self.assertEqual(reference_distance(grid), answer)
                if path:
                    self.check_path(grid, path)

    def test_revisit_with_new_mask(self):
        path = maze.shortest_path(maze.read_csv(ROOT / 'examples/revisit.csv'), 1)
        self.assertEqual(path[0][:2], path[2][:2])
        self.assertNotEqual(path[0][2], path[2][2])

    def test_adjacent_exit_without_collecting_key(self):
        grid = [list('SE.'), list('###'), list('aA.')]
        self.assertEqual(len(maze.shortest_path(grid, 1)) - 1, 1)

    def test_key_behind_its_own_door(self):
        grid = [list('SAa'), list('###'), list('E..')]
        self.assertEqual(maze.shortest_path(grid, 1), [])

    def test_nonconsecutive_types(self):
        grid = [list('SbBfF'), list('####.'), list('....E'), list('#####'), list('#####')]
        path = maze.shortest_path(grid, 2)
        self.assertEqual(len(path) - 1, 6)
        self.check_path(grid, path)

    def test_repeated_types(self):
        grid = [list('SaaA'), list('###A'), list('###E'), list('####')]
        path = maze.shortest_path(grid, 1)
        self.assertEqual(len(path) - 1, 5)
        self.check_path(grid, path)

    def test_all_generated_types_sizes_and_seeds(self):
        for t in range(1, 7):
            minimum = 3 if t <= 2 else 5
            for n in sorted({minimum, minimum + 1, 7, 15}):
                for seed in range(20):
                    with self.subTest(t=t, n=n, seed=seed):
                        grid = maze.generate(n, t, seed)
                        self.assertEqual(grid, maze.generate(n, t, seed))
                        self.assertEqual(sum(cell in maze.KEYS for row in grid for cell in row), t)
                        self.assertEqual(sum(maze.door_key(cell) is not None for row in grid for cell in row), t)
                        path = maze.shortest_path(grid, t)
                        self.check_path(grid, path)
                        self.assertEqual(len(path) - 1, reference_distance(grid))
                        sr, sc, _ = path[0]
                        er, ec, _ = path[-1]
                        self.assertGreaterEqual(abs(sr - er) + abs(sc - ec), n - 2)
                        self.assertGreaterEqual(len(path) - 1, 2 * t + 1)
                        self.assertEqual(path[-1][2], (1 << t) - 1)
                        route_cells = {grid[r][c] for r, c, _ in path}
                        self.assertTrue(set(maze.KEYS[:t]).issubset(route_cells))
                        self.assertEqual(sum(maze.door_key(grid[r][c]) is not None
                                             for r, c, _ in path), t)

    def test_generated_doors_cannot_be_bypassed(self):
        grid = maze.generate(15, 3, 42)
        path = maze.shortest_path(grid, 3)
        self.assertGreater(len(path) - 1, 1)
        self.assertEqual(path[-1][2], 7)
        # Each door is a bottleneck: replacing any door by a wall disconnects E.
        for r, row in enumerate(grid):
            for c, cell in enumerate(row):
                if maze.door_key(cell) is not None:
                    blocked = [list(line) for line in grid]
                    blocked[r][c] = '#'
                    self.assertEqual(reference_distance(blocked), -1)

    def test_invalid_input(self):
        invalid = [([], 1), ([['S']], 1), ([list('SE')], 1),
                   ([list('SXE'), list('aA.'), list('...')], 1),
                   ([list('SSE'), list('aA.'), list('...')], 1),
                   ([list('S.E'), list('aB.'), list('...')], 1),
                   ([list('S.E'), list('aA.'), list('...')], 2),
                   ([list('S.E'), list('aA.'), list('...')], 0),
                   ([list('S.E'), list('aA.'), list('...')], 7)]
        for grid, t in invalid:
            with self.subTest(grid=grid, t=t), self.assertRaises(ValueError):
                maze.shortest_path(grid, t)
        for n, t in [(1, 1), (2, 1), (2, 6), (3, 3), (4, 6), (5, 0), (5, 7)]:
            with self.assertRaises(ValueError):
                maze.generate(n, t)

    def test_csv_bom_spaces_and_roundtrip(self):
        grid = maze.read_csv(ROOT / 'examples/six_keys.csv')
        path = maze.shortest_path(grid, 6)
        with tempfile.TemporaryDirectory(dir=ROOT / 'tests') as directory:
            output = Path(directory) / 'path.csv'
            maze.write_csv(output, grid, path)
            self.assertEqual(maze.read_csv(output), grid)
            self.assertIn('D:E|x', output.read_text())
            maze.write_csv(output, grid)
            self.assertEqual(maze.read_csv(output), grid)
            output.write_text('\ufeff S , A , E\na , # , #\n . , # , .\n', encoding='utf-8')
            self.assertEqual(len(maze.shortest_path(maze.read_csv(output), 1)) - 1, 4)
            output.write_text('S,xjunk,E\na,A,.\n.,.,.\n')
            with self.assertRaises(ValueError):
                maze.shortest_path(maze.read_csv(output), 1)

    def test_cli_stdout_and_outputs(self):
        with tempfile.TemporaryDirectory(dir=ROOT / 'tests') as directory:
            result = subprocess.run(
                [sys.executable, str(ROOT / 'maze.py'), '--csv', 'examples/sample_maze.csv',
                 '--output-dir', directory, '--no-browser'], input='1\n',
                text=True, capture_output=True, cwd=directory
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout, '6\n')
            self.assertTrue((Path(directory) / 'shortest_path.csv').exists())
            self.assertTrue((Path(directory) / 'maze_animation.html').exists())

    def test_cli_unreachable_and_errors(self):
        with tempfile.TemporaryDirectory(dir=ROOT / 'tests') as directory:
            for filename, t, code, stdout in [('unreachable', '1', 0, '-1\n'),
                                               ('sample_maze', '7', 1, '')]:
                result = subprocess.run(
                    [sys.executable, str(ROOT / 'maze.py'), '--csv', f'examples/{filename}.csv',
                     '--types', t, '--output-dir', directory, '--no-browser'],
                    text=True, capture_output=True
                )
                self.assertEqual(result.returncode, code, result.stderr)
                self.assertEqual(result.stdout, stdout)

    def test_interactive_mode_and_source_protection(self):
        with tempfile.TemporaryDirectory(dir=ROOT / 'tests') as directory:
            with patch('builtins.input', side_effect=['1', '1', '']), \
                    contextlib.redirect_stdout(io.StringIO()) as out, \
                    contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(maze.main(['--output-dir', directory, '--no-browser']), 0)
                self.assertEqual(out.getvalue(), '6\n')
            source = Path(directory) / 'shortest_path.csv'
            before = source.read_bytes()
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(maze.main(['--csv', str(source), '--types', '1',
                                            '--output-dir', directory, '--no-browser']), 1)
            self.assertEqual(source.read_bytes(), before)

    def test_portable_run_configurations(self):
        files = list((ROOT / '.run').glob('*.xml'))
        self.assertEqual(len(files), 3)
        for file in files:
            configuration = ET.parse(file).getroot().find('configuration')
            options = {item.attrib['name']: item.attrib['value']
                       for item in configuration.findall('option')}
            self.assertEqual(options['SCRIPT_NAME'], '$PROJECT_DIR$/maze.py')
            self.assertEqual(options['SDK_HOME'], '')
            self.assertEqual(options['IS_MODULE_SDK'], 'true')


if __name__ == '__main__':
    unittest.main()
