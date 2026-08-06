from app.simulation.layout import load_layout
from app.simulation.replay import replay_state
from app.simulation.runner import PortSimulation


def _run(duration_hours: float = 72.0, seed: int = 1) -> PortSimulation:
    layout = load_layout("default_port")
    sim = PortSimulation(
        layout=layout, seed=seed, ship_arrival_rate_per_day=4.0,
        truck_arrival_rate_per_hour=15.0, run_id="test-run",
    )
    sim.run_batch(duration_hours)
    return sim


def test_simulation_produces_events_and_ships():
    sim = _run()
    assert len(sim.event_log) > 0
    assert len(sim.state.ships) > 0
    event_types = {e.event_type for e in sim.event_log}
    assert "ship_arrival" in event_types
    assert "truck_arrival" in event_types


def test_ships_only_berth_at_compatible_berths():
    sim = _run()
    for ship in sim.state.ships.values():
        if ship.assigned_berth_code:
            berth = sim.state.berths[ship.assigned_berth_code]
            required_length = 80 + ship.size_teu * 0.02
            assert berth.length_m >= required_length


def test_berth_never_double_booked_at_any_instant():
    """Two ships assigned to the same berth must not have overlapping
    [berthed_hours, atd_hours) windows."""
    sim = _run(duration_hours=200.0)
    by_berth: dict[str, list[tuple[float, float]]] = {}
    for ship in sim.state.ships.values():
        if ship.assigned_berth_code and ship.berthed_hours is not None:
            end = ship.atd_hours if ship.atd_hours is not None else float("inf")
            by_berth.setdefault(ship.assigned_berth_code, []).append((ship.berthed_hours, end))

    for berth_code, windows in by_berth.items():
        windows.sort()
        for (s1, e1), (s2, e2) in zip(windows, windows[1:]):
            assert s2 >= e1 - 1e-6, f"overlap on {berth_code}: ({s1},{e1}) vs ({s2},{e2})"


def test_kpis_are_within_expected_ranges():
    sim = _run()
    kpis = sim.state.compute_kpis()
    assert 0 <= kpis["berth_occupancy_pct"] <= 100
    assert 0 <= kpis["avg_crane_utilization_pct"] <= 100
    assert 0 <= kpis["yard_utilization_pct"] <= 100
    assert kpis["ships_in_port"] >= 0


def test_replay_matches_live_kpis_at_final_time():
    sim = _run()
    live_kpis = sim.state.compute_kpis()

    layout = load_layout("default_port")
    replayed_state, last_time = replay_state(layout, sim.event_log, run_id="test-run")
    replayed_kpis = replayed_state.compute_kpis()

    assert replayed_kpis["ships_in_port"] == live_kpis["ships_in_port"]
    assert replayed_kpis["berth_occupancy_pct"] == live_kpis["berth_occupancy_pct"]


def test_deterministic_with_same_seed():
    sim_a = _run(seed=99)
    sim_b = _run(seed=99)
    assert len(sim_a.event_log) == len(sim_b.event_log)
    assert [e.event_type for e in sim_a.event_log] == [e.event_type for e in sim_b.event_log]
