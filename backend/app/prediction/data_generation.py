"""Synthesizes labeled training data from domain formulas (queueing theory,
travel-time physics) plus noise, standing in for historical AIS/TOS/gate
data until a real feed is connected. Each `generate_*` function returns a
pandas DataFrame with feature columns and one or more `target_*` columns,
so swapping in real historical data later is a drop-in replacement.
"""
import numpy as np
import pandas as pd

ETA_FEATURES = ["distance_nm", "reported_speed_knots", "weather_delay_factor", "port_congestion_index"]
CONGESTION_FEATURES = ["ships_in_queue", "avg_service_hours", "berths_available", "hour_of_day"]
TRUCK_QUEUE_FEATURES = ["trucks_per_hour", "gate_lanes", "avg_processing_minutes", "hour_of_day"]
CRANE_UTIL_FEATURES = ["containers_to_move", "cranes_assigned", "ship_size_teu"]


def generate_eta_dataset(n: int = 4000, seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    distance_nm = rng.uniform(50, 8000, n)
    speed = rng.uniform(10, 24, n)
    weather = rng.uniform(0.9, 1.4, n)
    congestion = rng.uniform(0, 1, n)

    base_hours = distance_nm / speed
    eta_hours = base_hours * weather * (1 + 0.15 * congestion) + rng.normal(0, 1.5, n)
    eta_hours = np.clip(eta_hours, 1, None)

    return pd.DataFrame({
        "distance_nm": distance_nm, "reported_speed_knots": speed,
        "weather_delay_factor": weather, "port_congestion_index": congestion,
        "target_eta_hours": eta_hours,
    })


def generate_congestion_dataset(n: int = 4000, seed: int = 11) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    ships_in_queue = rng.integers(0, 12, n)
    avg_service_hours = rng.uniform(10, 40, n)
    berths_available = rng.integers(1, 6, n)
    hour_of_day = rng.integers(0, 24, n)

    utilization_pressure = (ships_in_queue * avg_service_hours) / (berths_available * 24)
    congestion_index = 1 - np.exp(-utilization_pressure)
    congestion_index = np.clip(congestion_index + rng.normal(0, 0.05, n), 0, 1)
    expected_wait_hours = np.clip(
        congestion_index * avg_service_hours * np.clip(ships_in_queue / berths_available, 0.1, None)
        + rng.normal(0, 1.0, n), 0, None,
    )

    return pd.DataFrame({
        "ships_in_queue": ships_in_queue, "avg_service_hours": avg_service_hours,
        "berths_available": berths_available, "hour_of_day": hour_of_day,
        "target_congestion_index": congestion_index, "target_wait_hours": expected_wait_hours,
    })


def generate_truck_queue_dataset(n: int = 4000, seed: int = 13) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    trucks_per_hour = rng.uniform(2, 60, n)
    gate_lanes = rng.integers(1, 8, n)
    avg_processing_minutes = rng.uniform(4, 20, n)
    hour_of_day = rng.integers(0, 24, n)

    service_rate_per_hour = gate_lanes * (60 / avg_processing_minutes)
    rho = np.clip(trucks_per_hour / service_rate_per_hour, 0.01, 0.98)
    expected_queue_length = np.clip(
        rho ** 2 / (1 - rho) * gate_lanes + rng.normal(0, 1.0, n), 0, None,
    )
    expected_wait_minutes = np.clip(
        (expected_queue_length / np.maximum(trucks_per_hour, 0.1)) * 60 + rng.normal(0, 1.0, n), 0, None,
    )

    return pd.DataFrame({
        "trucks_per_hour": trucks_per_hour, "gate_lanes": gate_lanes,
        "avg_processing_minutes": avg_processing_minutes, "hour_of_day": hour_of_day,
        "target_queue_length": expected_queue_length, "target_wait_minutes": expected_wait_minutes,
    })


def generate_crane_utilization_dataset(n: int = 4000, seed: int = 17) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    containers_to_move = rng.integers(200, 6000, n)
    cranes_assigned = rng.integers(1, 5, n)
    ship_size_teu = rng.integers(800, 16000, n)

    rate_per_crane = rng.uniform(22, 32, n)
    combined_rate = cranes_assigned * rate_per_crane
    completion_hours = np.clip(containers_to_move / combined_rate + rng.normal(0, 0.5, n), 0.25, None)
    utilization_pct = np.clip(
        60 + (containers_to_move / (ship_size_teu + 1)) * 100 + rng.normal(0, 5, n), 10, 100,
    )

    return pd.DataFrame({
        "containers_to_move": containers_to_move, "cranes_assigned": cranes_assigned,
        "ship_size_teu": ship_size_teu,
        "target_utilization_pct": utilization_pct, "target_completion_hours": completion_hours,
    })
