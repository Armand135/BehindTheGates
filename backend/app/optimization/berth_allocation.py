"""Berth allocation: a CP-SAT model (optimized) vs. a first-come-first-served
greedy baseline (mirrors the simulation engine's default policy). Both
operate over the same `ShipRequest`/`BerthSpec` input so results are
directly comparable.
"""
import math
import time

from ortools.sat.python import cp_model

from app.schemas.optimization import (
    BerthAllocationRequest,
    BerthAllocationResult,
    BerthAssignment,
    BerthComparisonResult,
)

MIN_BERTH_MARGIN_M = 80.0
LENGTH_PER_TEU_M = 0.02


def _required_length(size_teu: int) -> float:
    return MIN_BERTH_MARGIN_M + size_teu * LENGTH_PER_TEU_M


def _eligible_berths(ship, berths):
    return [b for b in berths if b.length_m >= _required_length(ship.size_teu)]


def solve_baseline(req: BerthAllocationRequest) -> BerthAllocationResult:
    """Greedy FCFS: sort ships by ETA, assign the first free compatible berth."""
    t0 = time.time()
    ships_sorted = sorted(req.ships, key=lambda s: s.eta_hours)
    berth_free_at = {b.code: 0.0 for b in req.berths}
    assignments: list[BerthAssignment] = []

    for ship in ships_sorted:
        eligible = _eligible_berths(ship, req.berths)
        if not eligible:
            continue
        berth = min(eligible, key=lambda b: berth_free_at[b.code])
        start = max(ship.eta_hours, berth_free_at[berth.code])
        end = start + ship.service_hours
        berth_free_at[berth.code] = end
        assignments.append(BerthAssignment(
            ship_id=ship.id, ship_name=ship.name, berth_code=berth.code,
            start_hours=round(start, 2), end_hours=round(end, 2),
            waiting_hours=round(start - ship.eta_hours, 2),
        ))

    total_wait = sum(a.waiting_hours for a in assignments)
    makespan = max((a.end_hours for a in assignments), default=0.0)
    return BerthAllocationResult(
        strategy="baseline", solver_status="HEURISTIC", solve_time_seconds=time.time() - t0,
        total_waiting_hours=round(total_wait, 2), makespan_hours=round(makespan, 2),
        assignments=assignments,
    )


def solve_optimized(req: BerthAllocationRequest) -> BerthAllocationResult:
    """CP-SAT: minimize total waiting time subject to berth compatibility
    and no-overlap per berth, using optional intervals per (ship, berth)."""
    t0 = time.time()
    model = cp_model.CpModel()
    # CP-SAT needs an integer time unit; seconds (rather than minutes) keep
    # rounding noise from the float hour inputs well under a minute, so it
    # doesn't show up as spurious sub-minute "waiting hours" in the output.
    TIME_SCALE = 3600
    horizon_units = int(req.horizon_hours * TIME_SCALE)

    presence = {}
    intervals_by_berth: dict[str, list] = {b.code: [] for b in req.berths}
    starts = {}
    ends = {}
    waits = {}

    for ship in req.ships:
        eligible = _eligible_berths(ship, req.berths)
        if not eligible:
            continue
        # Round up so the integer CP-SAT model never lets a ship start (or
        # occupy a berth for) less time than the float inputs actually
        # require -- rounding down here previously produced tiny negative
        # "waiting hours" when a start time fell inside the truncated gap
        # between the rounded and true ETA.
        duration_units = math.ceil(ship.service_hours * TIME_SCALE)
        eta_units = math.ceil(ship.eta_hours * TIME_SCALE)
        ship_presence_vars = []

        for berth in eligible:
            p = model.NewBoolVar(f"p_{ship.id}_{berth.code}")
            start = model.NewIntVar(eta_units, horizon_units, f"s_{ship.id}_{berth.code}")
            end = model.NewIntVar(eta_units, horizon_units + duration_units, f"e_{ship.id}_{berth.code}")
            interval = model.NewOptionalIntervalVar(start, duration_units, end, p, f"iv_{ship.id}_{berth.code}")
            intervals_by_berth[berth.code].append(interval)
            presence[(ship.id, berth.code)] = p
            starts[(ship.id, berth.code)] = start
            ends[(ship.id, berth.code)] = end
            ship_presence_vars.append(p)

        model.AddExactlyOne(ship_presence_vars)

        wait = model.NewIntVar(0, horizon_units, f"wait_{ship.id}")
        chosen_start = model.NewIntVar(eta_units, horizon_units, f"cs_{ship.id}")
        for berth in eligible:
            key = (ship.id, berth.code)
            model.Add(chosen_start == starts[key]).OnlyEnforceIf(presence[key])
        model.Add(wait == chosen_start - eta_units)
        waits[ship.id] = wait

    for berth in req.berths:
        model.AddNoOverlap(intervals_by_berth[berth.code])

    if waits:
        model.Minimize(sum(waits.values()))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10.0
    solver.parameters.num_search_workers = 8
    status = solver.Solve(model)
    solve_time = time.time() - t0

    assignments: list[BerthAssignment] = []
    max_end = 0.0
    total_wait = 0.0
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for ship in req.ships:
            eligible = _eligible_berths(ship, req.berths)
            for berth in eligible:
                key = (ship.id, berth.code)
                if key in presence and solver.Value(presence[key]):
                    s = solver.Value(starts[key]) / TIME_SCALE
                    e = solver.Value(ends[key]) / TIME_SCALE
                    w = max(s - ship.eta_hours, 0.0)
                    assignments.append(BerthAssignment(
                        ship_id=ship.id, ship_name=ship.name, berth_code=berth.code,
                        start_hours=round(s, 2), end_hours=round(e, 2), waiting_hours=round(w, 2),
                    ))
                    max_end = max(max_end, e)
                    total_wait += w

    return BerthAllocationResult(
        strategy="optimized", solver_status=solver.StatusName(status),
        solve_time_seconds=round(solve_time, 3), total_waiting_hours=round(total_wait, 2),
        makespan_hours=round(max_end, 2), assignments=assignments,
    )


def compare(req: BerthAllocationRequest) -> BerthComparisonResult:
    baseline = solve_baseline(req)
    optimized = solve_optimized(req)

    def pct_reduction(before: float, after: float) -> float:
        if before <= 0:
            return 0.0
        return round((before - after) / before * 100, 1)

    return BerthComparisonResult(
        baseline=baseline,
        optimized=optimized,
        waiting_hours_reduction_pct=pct_reduction(baseline.total_waiting_hours, optimized.total_waiting_hours),
        makespan_reduction_pct=pct_reduction(baseline.makespan_hours, optimized.makespan_hours),
    )
