# DSAultRafale

## Problem 1: Maze with Keys and Doors

Used BFS over `(row, column, key mask)` to find the shortest valid path while tracking collected keys and checking locked doors.<br>
Added CSV input/output, solvable random mazes, and an animated grid showing the path, key inventory and door openings.

![Maze shortest path with collected keys and opened doors](prob1/maze_result.png)

## Problem 2: Closest Pair of Points

Compared O(N²) brute force with O(N log N) divide-and-conquer to find the closest point pair and measure their execution times.<br>
Added point-distribution corner cases, recursion and strip-comparison animation, and a running-time-versus-N benchmark graph.

![Matching closest-pair results from both algorithms](prob2/Screenshot%20from%202026-10-14%2010-44-57.png)

![Brute-force and divide-and-conquer runtime comparison](prob2/Screenshot%20from%202026-10-14%2010-44-35.png)

<details>
<summary>Input controls and corner-case selection</summary>

![Point generation and corner-case controls](prob2/Screenshot%20from%202026-10-14%2010-40-32.png)

</details>

[Watch the Problem 2 demonstration](prob2/Screencast%20from%202026-10-14%2010-45-42.webm)

## Problem 3: Flight Route Planning with Coupons

Built a flight-route planner to find the lowest-cost journey within a maximum stop limit while choosing where to apply half-price coupons.<br>
Added manual and CSV flight input, random graph generation, a coloured route map, journey animation and marked CSV export.

![Flight route with selected coupon discounts and total cost](prob3/output%201.png)

![Lowest-cost route calculated from imported flight CSV](prob3/output%20for%20csv%20input.png)

<details>
<summary>CSV import</summary>

![Importing flight data from a CSV file](prob3/csv%20file%20input.png)

</details>

[Watch the Problem 3 demonstration](prob3/demo%20video.mp4)

## Problem 4: Exam Timetable Scheduling

Compared capacity-aware DSatur, Welsh–Powell and exact branch-and-bound to schedule conflicting exams in separate slots within the available hall capacity.<br>
Added a Streamlit dashboard with coloured conflict graphs, timetable assignments, optimality status, benchmarks, assignment replay and CSV/JSON exports.

![Conflict graph and scheduling algorithm comparison](prob4/scrnshots/Screenshot%202026-10-14%20111915.png)

![Exam timetable arranged by time slot and hall](prob4/scrnshots/Screenshot%202026-10-14%20111925.png)

![Scheduling slot counts and runtime benchmarks](prob4/scrnshots/Screenshot%202026-10-14%20112007.png)

<details>
<summary>Assignment replay, benchmark settings, methods and exported results</summary>

![Course assignment replay](prob4/scrnshots/Screenshot%202026-10-14%20111947.png)

![Benchmark configuration](prob4/scrnshots/Screenshot%202026-10-14%20112015.png)

![Generated timetable and optimality certificate](prob4/scrnshots/Screenshot%202026-10-14%20112236.png)

![Scheduling methods and lower-bound explanation](prob4/scrnshots/Screenshot%202026-10-14%20112255.png)

![Exported timetable CSV opened in Excel](prob4/scrnshots/Screenshot%202026-10-14%20112414.png)

</details>
