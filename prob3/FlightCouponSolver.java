import java.io.*;
import java.nio.file.*;
import java.util.*;

/**
 * Core solver for the flight-with-coupons problem.
 *
 * Standard input format:
 * N M
 * K C
 * u v price       (M lines)
 *
 * The program prints the cheapest cost (or -1) and writes marked_path.csv.
 * To use a CSV graph instead: java FlightCouponSolver graph.csv K C
 * CSV rows are: u,v,price (an optional header is accepted).
 */
public class FlightCouponSolver {
    static class Flight {
        int from, to;
        long price;
        Flight(int from, int to, long price) { this.from = from; this.to = to; this.price = price; }
    }

    static class Step {
        int city, flights, coupons;
        Step(int city, int flights, int coupons) { this.city = city; this.flights = flights; this.coupons = coupons; }
    }

    static class Result {
        long cost;
        List<Integer> edgeIndexes;
        Set<Integer> couponEdges;
        Result(long cost, List<Integer> edgeIndexes, Set<Integer> couponEdges) {
            this.cost = cost; this.edgeIndexes = edgeIndexes; this.couponEdges = couponEdges;
        }
    }

    static final long INF = Long.MAX_VALUE / 4;

    /** At most K intermediate cities means at most K + 1 flights. */
    static Result solve(int n, List<Flight> flights, int maxStops, int couponCount) {
        int maxFlights = maxStops + 1;
        long[][][] dp = new long[maxFlights + 1][n + 1][couponCount + 1];
        Step[][][] parent = new Step[maxFlights + 1][n + 1][couponCount + 1];
        int[][][] parentEdge = new int[maxFlights + 1][n + 1][couponCount + 1];
        for (long[][] layer : dp) for (long[] row : layer) Arrays.fill(row, INF);
        for (int[][] layer : parentEdge) for (int[] row : layer) Arrays.fill(row, -1);
        dp[0][1][0] = 0;

        for (int usedFlights = 0; usedFlights < maxFlights; usedFlights++) {
            for (int city = 1; city <= n; city++) for (int usedCoupons = 0; usedCoupons <= couponCount; usedCoupons++) {
                if (dp[usedFlights][city][usedCoupons] == INF) continue;
                for (int edge = 0; edge < flights.size(); edge++) {
                    Flight f = flights.get(edge);
                    if (f.from != city) continue;
                    relax(dp, parent, parentEdge, usedFlights, usedCoupons, f.to, dp[usedFlights][city][usedCoupons] + f.price,
                            new Step(city, usedFlights, usedCoupons), edge);
                    if (usedCoupons < couponCount) {
                        relax(dp, parent, parentEdge, usedFlights, usedCoupons + 1, f.to,
                                dp[usedFlights][city][usedCoupons] + f.price / 2,
                                new Step(city, usedFlights, usedCoupons), edge);
                    }
                }
            }
        }

        long best = INF; Step end = null;
        for (int f = 1; f <= maxFlights; f++) for (int c = 0; c <= couponCount; c++) {
            if (dp[f][n][c] < best) { best = dp[f][n][c]; end = new Step(n, f, c); }
        }
        if (end == null) return new Result(-1, List.of(), Set.of());

        List<Integer> path = new ArrayList<>(); Set<Integer> discounted = new HashSet<>();
        for (Step cur = end; cur.flights > 0;) {
            int edge = parentEdge[cur.flights][cur.city][cur.coupons];
            Step prev = parent[cur.flights][cur.city][cur.coupons];
            path.add(edge);
            if (cur.coupons > prev.coupons) discounted.add(edge);
            cur = prev;
        }
        Collections.reverse(path);
        return new Result(best, path, discounted);
    }

    private static void relax(long[][][] dp, Step[][][] parent, int[][][] parentEdge, int flights, int coupons,
                              int to, long candidate, Step from, int edge) {
        if (candidate < dp[flights + 1][to][coupons]) {
            dp[flights + 1][to][coupons] = candidate;
            parent[flights + 1][to][coupons] = from;
            parentEdge[flights + 1][to][coupons] = edge;
        }
    }

    static void writeMarkedCsv(List<Flight> flights, Result result) throws IOException {
        try (PrintWriter out = new PrintWriter(Files.newBufferedWriter(Path.of("marked_path.csv")))) {
            out.println("from,to,price,on_path,coupon_used");
            for (int i = 0; i < flights.size(); i++) {
                Flight f = flights.get(i);
                out.printf("%d,%d,%d,%s,%s%n", f.from, f.to, f.price,
                        result.edgeIndexes.contains(i) ? "x" : "", result.couponEdges.contains(i) ? "x" : "");
            }
        }
    }

    public static void main(String[] args) throws Exception {
        Scanner in; int n, m, k, c; List<Flight> flights = new ArrayList<>();
        if (args.length == 3) {
            k = Integer.parseInt(args[1]); c = Integer.parseInt(args[2]);
            List<String> lines = Files.readAllLines(Path.of(args[0]));
            for (String line : lines) {
                String[] p = line.trim().split("\\s*,\\s*");
                if (p.length < 3 || !p[0].matches("\\d+")) continue;
                flights.add(new Flight(Integer.parseInt(p[0]), Integer.parseInt(p[1]), Long.parseLong(p[2])));
            }
            n = flights.stream().mapToInt(f -> Math.max(f.from, f.to)).max().orElse(1); m = flights.size();
        } else {
            in = new Scanner(System.in); n = in.nextInt(); m = in.nextInt(); k = in.nextInt(); c = in.nextInt();
            for (int i = 0; i < m; i++) flights.add(new Flight(in.nextInt(), in.nextInt(), in.nextLong()));
        }
        Result result = solve(n, flights, k, c);
        System.out.println(result.cost);
        writeMarkedCsv(flights, result);
    }
}
