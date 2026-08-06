"""Crane-to-berth work scheduling: split a berth's container moves across
its assigned cranes to minimize completion time (makespan), via CP-SAT.
"""
import math
import time

from ortools.sat.python import cp_model

from app.schemas.optimization import CraneScheduleRequest, CraneScheduleResult, CraneTask

RATE_SCALE = 100  # fixed-point precision for moves/minute


def solve_crane_schedule(req: CraneScheduleRequest) -> CraneScheduleResult:
    t0 = time.time()
    model = cp_model.CpModel()
    start_min = math.ceil(req.available_from_hours * 60)
    search_horizon_min = start_min + 48 * 60

    moves_vars = []
    finish_vars = []
    duration_vars = []

    for crane in req.cranes:
        rate_per_min_scaled = max(int(round((crane.moves_per_hour / 60) * RATE_SCALE)), 1)
        moves = model.NewIntVar(0, req.containers_to_move, f"moves_{crane.code}")
        duration = model.NewIntVar(0, search_horizon_min - start_min, f"dur_{crane.code}")
        finish = model.NewIntVar(start_min, search_horizon_min, f"finish_{crane.code}")
        model.Add(finish == start_min + duration)
        model.Add(moves * RATE_SCALE <= rate_per_min_scaled * duration)
        moves_vars.append(moves)
        finish_vars.append(finish)
        duration_vars.append(duration)

    model.Add(sum(moves_vars) == req.containers_to_move)
    makespan = model.NewIntVar(start_min, search_horizon_min, "makespan")
    model.AddMaxEquality(makespan, finish_vars)
    model.Minimize(makespan)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    status = solver.Solve(model)
    solve_time = time.time() - t0

    tasks: list[CraneTask] = []
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for crane, moves, finish in zip(req.cranes, moves_vars, finish_vars):
            m = solver.Value(moves)
            if m > 0:
                tasks.append(CraneTask(
                    crane_code=crane.code, start_hours=req.available_from_hours,
                    end_hours=round(solver.Value(finish) / 60, 2), moves=m,
                ))
        makespan_hours = round((solver.Value(makespan) - start_min) / 60, 2)
    else:
        makespan_hours = 0.0

    return CraneScheduleResult(
        solver_status=solver.StatusName(status), solve_time_seconds=round(solve_time, 3),
        makespan_hours=makespan_hours, tasks=tasks,
    )
