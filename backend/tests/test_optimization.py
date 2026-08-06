from app.optimization import berth_allocation
from app.optimization.crane_scheduling import solve_crane_schedule
from app.schemas.optimization import (
    BerthAllocationRequest,
    BerthSpec,
    CraneScheduleRequest,
    CraneSpec,
    ShipRequest,
)


def _congested_scenario() -> BerthAllocationRequest:
    # More ships than berths arriving close together forces real contention,
    # so the optimizer has room to actually improve on FCFS.
    ships = [
        ShipRequest(id=f"s{i}", name=f"Ship{i}", size_teu=5000, eta_hours=i * 2.0, service_hours=20.0)
        for i in range(8)
    ]
    berths = [BerthSpec(code=f"B{i}", length_m=350) for i in range(2)]
    return BerthAllocationRequest(ships=ships, berths=berths, horizon_hours=200)


def test_baseline_never_double_books_a_berth():
    req = _congested_scenario()
    result = berth_allocation.solve_baseline(req)
    by_berth: dict[str, list[tuple[float, float]]] = {}
    for a in result.assignments:
        by_berth.setdefault(a.berth_code, []).append((a.start_hours, a.end_hours))
    for berth_code, windows in by_berth.items():
        windows.sort()
        for (s1, e1), (s2, e2) in zip(windows, windows[1:]):
            assert s2 >= e1 - 1e-6


def test_optimized_never_double_books_a_berth():
    req = _congested_scenario()
    result = berth_allocation.solve_optimized(req)
    assert result.solver_status in ("OPTIMAL", "FEASIBLE")
    by_berth: dict[str, list[tuple[float, float]]] = {}
    for a in result.assignments:
        by_berth.setdefault(a.berth_code, []).append((a.start_hours, a.end_hours))
    for berth_code, windows in by_berth.items():
        windows.sort()
        for (s1, e1), (s2, e2) in zip(windows, windows[1:]):
            assert s2 >= e1 - 1e-6


def test_optimized_waiting_hours_never_negative():
    req = _congested_scenario()
    result = berth_allocation.solve_optimized(req)
    for a in result.assignments:
        assert a.waiting_hours >= 0


def test_optimized_is_at_least_as_good_as_baseline_when_congested():
    req = _congested_scenario()
    comparison = berth_allocation.compare(req)
    assert comparison.optimized.total_waiting_hours <= comparison.baseline.total_waiting_hours + 0.05
    assert comparison.waiting_hours_reduction_pct >= -1.0


def test_ship_incompatible_with_all_berths_is_skipped_not_crashed():
    req = BerthAllocationRequest(
        ships=[ShipRequest(id="huge", name="Huge Ship", size_teu=50000, eta_hours=0, service_hours=10)],
        berths=[BerthSpec(code="B1", length_m=300)],
        horizon_hours=48,
    )
    baseline = berth_allocation.solve_baseline(req)
    optimized = berth_allocation.solve_optimized(req)
    assert baseline.assignments == []
    assert optimized.assignments == []


def test_crane_schedule_splits_moves_across_cranes_and_conserves_total():
    req = CraneScheduleRequest(
        berth_code="B1",
        cranes=[CraneSpec(code="QC1", moves_per_hour=30), CraneSpec(code="QC2", moves_per_hour=20)],
        containers_to_move=1000,
        available_from_hours=0,
    )
    result = solve_crane_schedule(req)
    assert result.solver_status in ("OPTIMAL", "FEASIBLE")
    assert sum(t.moves for t in result.tasks) == 1000
    # Faster crane should be assigned proportionally more moves.
    by_crane = {t.crane_code: t.moves for t in result.tasks}
    assert by_crane["QC1"] > by_crane["QC2"]
