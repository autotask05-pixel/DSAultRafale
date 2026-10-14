# Problem 1 analysis

## Why position alone is insufficient

A cell can first be reached without key a and later with key a. The second arrival
can pass door A; the first cannot. A visited set containing only (row, column)
would incorrectly discard the second arrival. `examples/revisit.csv` needs the
route S → a → S → A → E, length 4, and exposes this mistake.

## State graph and transitions

A state is `(row, column, mask)`. Assign compact bit positions 0 through T-1 to
the key types present in the grid. A bit is set exactly when that key is held.
The initial state is the start cell with mask 0. For each of four adjacent cells:

1. Reject an out-of-bounds cell or wall.
2. If it is a door, require its key bit in the current mask before entering.
3. If it is a key, OR its bit into the mask.
4. Enqueue the resulting state only if it has never been discovered.

A parent dictionary serves as both the visited set and the predecessor map.
BFS uses a deque and marks a state on enqueue. The first dequeued state at E is
the answer; its parent chain yields a path. Distance is the number of edges,
which is `len(path) - 1`. All masks at E are acceptable: collecting all keys is
not a separate objective. Exhausting the queue means no route exists.

Repeated keys of one type are idempotent: OR-ing a bit twice has no additional
effect. Entering a door never clears any bit. Returning to the same coordinate
with more keys is allowed. Physically opened doors need not be in the solver's
state, because retaining their keys permits every future traversal; the renderer
separately tracks doors visited for the visual unlock effect.

## Correctness proof

**State invariant.** Each queued state represents a legal walk from S whose
collected key types are precisely the bits of its mask. It holds initially.
Every transition checks walls/bounds and requires a matching key before door
entry; it then sets a key bit when applicable. Thus the invariant is preserved.

**Completeness.** Every legal walk maps to a sequence of these transitions.
States with identical position and mask have identical legal continuations.
Discarding a duplicate state therefore removes no possible future continuation.
BFS examines every reachable state unless it already finds an exit.

**Shortest-path optimality.** Every state-graph edge costs exactly one move.
BFS processes states in nondecreasing distance from the initial state. The first
discovery of a state uses a shortest route to that state, and its parent chain
records that route. Consequently the first dequeued exit state has minimum
distance among every exit position/mask state, hence among all legal S-to-E walks.
If none is reachable, completeness establishes that -1 is correct.

## Complexity and scope of the optimality claim

There are at most V = N²·2^T states and at most 4V directed transitions. Bounds,
cell checks, and bit operations are constant time since T ≤ 6. With expected
constant-time Python dictionary lookup, BFS takes O(N²·2^T) time and space;
queue and parent map are the main memory costs. For T ≤ 6 this is at most 64
mask possibilities per coordinate. Many theoretical states are unreachable.

The BFS result is provably shortest, and BFS takes O(V+E) on its reachable state
graph. This does not claim a universal lower bound of N²·2^T for every possible
maze algorithm; additional structure or heuristics can reduce explored states.
Python tuple/dictionary overhead can become significant for very large N. There
is no N bound in the statement, so worst-case memory should be stated explicitly.
Path reconstruction takes O(L), where L is the number of path states.

Validation/generation and CSV exports take O(N²). Generated HTML holds O(N²+L)
data. The browser redraws the grid at each animation step, taking O(L·N²) total
rendering work. This visualization cost is separate from the BFS complexity.

## Comparative analysis

| Method | Shortest path guaranteed? | Comparison |
| --- | --- | --- |
| BFS with coordinate-only visited set | No | Cannot distinguish different inventories; fails the revisit example |
| DFS/backtracking | Not with first-found route | Can find a legal route but not necessarily the shortest; exhaustive path enumeration can grow exponentially |
| Dijkstra on the same states | Yes | Handles weighted movement, but heap overhead gives O((V+E) log V); unnecessary for unit-cost steps |
| A* on the same states with Manhattan distance | Yes with correct distance updates and admissible/consistent heuristic | Can explore fewer states in some mazes; worst-case benefit is not guaranteed and adds heap overhead |
| BFS with key mask (chosen) | Yes | Simple O(V+E) traversal for unit-cost movement and directly reconstructs the route |

Manhattan distance remains a lower bound in the presence of walls/doors because
these obstacles cannot shorten the required number of unit grid moves. Ordinary
bidirectional BFS is harder here: reversing a key pickup needs inventory-aware
predecessor rules and the exit can have any mask. It is not needed for T ≤ 6.
Dominance pruning is another possible optimization: a state at the same cell
with a superset of keys at no greater distance dominates another state. Checking
such relationships adds complexity, so this implementation uses exact states.

## Guaranteed-solvable generator

Start with walls. Place rooms at even row/column coordinates; neighboring rooms
are two cells apart. Randomized iterative DFS connects each newly visited room
to one previous room by clearing the intervening connector. The resulting room
graph is connected and acyclic; subdividing its edges into physical cells retains
that tree property. Wall separators prevent accidental connections between corridors.

Consider routes between the four corner rooms and select a longest one that has
at least 2T+2 physical cells. Distinct corner rooms are separated by at least
2·(ceil(N/2)-1) Manhattan steps, which is at least N-2. Retry up to 32 times if
the corner routes are too short. A fallback chain snakes through all spaced rooms
and guarantees enough room; the retries are bounded, so generation terminates.
For even N, the last physical row and column remain walls.

Choose 2T interior route positions in increasing order and put each key before
its matching door. Put S and E at the endpoints. Following the route is legal.
The physical corridor graph is a tree, so it has exactly one simple S-to-E route;
every placed door lies on that route and cannot be bypassed by another corridor.
Thus every solution visits every placed key/door pair. Detours into branches
cannot shorten the unique route. Exactly one key and door of each type are placed.

There are M=ceil(N/2)² rooms, and a full fallback route has 2M-1 physical cells.
Generation requires N≥3 and 2M-1≥2T+2: N≥3 for T=1–2, N≥5 for T=3–6.
These additional size restrictions apply only to this corridor generator, not to
the CSV solver. A seed reproduces the maze within the same runtime. This is not
a uniform sampler of maze trees. Each attempt and the four corner traversals
take O(N²); the fixed retry limit preserves O(N²) generation time and space.

## Corner cases and input decisions

| Case | Behavior |
| --- | --- |
| T=1 and T=6 | Supported; six-key sample includes the explicit D:E door |
| Nonconsecutive types, such as b and f | Compact mask assignment supports them |
| Door encountered before its key | Transition rejected until the key is held |
| Key hidden behind its own only accessible door | May be unreachable; solver returns -1 |
| Need to backtrack after collecting a key | Revisiting with the new mask is allowed |
| Already collected key encountered again | Inventory unchanged; move still costs one |
| Already traversed door encountered again | Allowed with retained key |
| Repeated key/door cells of the same type | Supported; T counts distinct types |
| Exit reachable without all keys | Return the shortest route without forcing pickups |
| Disconnected exit or irrelevant keys | Correctly handle either a route or -1 |
| Several equally short routes | Any shortest route is accepted; fixed neighbor order makes selection deterministic |
| Adjacent S and E in a CSV | Distance 1 if the grid otherwise meets the input rules; generated endpoints are separated |
| S and E coincident / N=1 | Impossible under one-symbol-per-cell input; rejected by validation |
| Border cells / walls around S | Bounds checked; empty queue returns -1 |
| Empty/ragged/non-square CSV, bad token | Clear validation error rather than searching an invalid maze |
| Missing/repeated S or E | Clear validation error |
| Wrong T or unmatched type sets | Clear validation error under this project's strict matching-type policy |
| BOM/whitespace | Accepted and normalized |
| Path CSV loaded again | x and token\|x normalize back to original cells |
| No route | Unmodified output CSV; HTML shows no route |
| Revisited cell in output | CSV marks membership; animation preserves ordered visits |
| Random grid too small for spaced corridors | Reject with the minimum N; the CSV solver is unaffected |
| Missing/unwritable file | Report the filesystem error, exit status 1 |

The original statement reserves E as exit while listing A–F as doors. There is
no unambiguous representation of door E in that alphabet. This project explicitly
uses D:E for that door and documents it in both source and README. A judge-provided
alternative convention would require adapting the input parser.

## Verification

The unittest suite checks exact sample answers, legal path transitions and masks,
unreachable cases, repeated keys/doors, nonconsecutive types, input errors, output
round trips, generation with all T values and multiple seeds, stdout and exit
behavior, XML run configuration validity, and a separate Dijkstra implementation
for comparative shortest-distance checks. Browser controls are embedded in one
HTML file; opening the sample is the presentation check for the evaluator.
