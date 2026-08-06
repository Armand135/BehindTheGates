"""Trains one XGBoost regressor per prediction target and saves it under
`app/prediction/artifacts/`. Run directly (`python -m app.prediction.train`)
or via the `/prediction/train` API endpoint. Re-run whenever real historical
data replaces the synthetic generators in `data_generation.py`.
"""
import json
from pathlib import Path

import xgboost as xgb
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split

from app.prediction import data_generation as dg

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
MODEL_VERSION = "xgb-v1"


def _train_one(df, features: list[str], target_col: str, model_name: str) -> dict:
    X, y = df[features], df[target_col]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=0)

    model = xgb.XGBRegressor(
        n_estimators=200, max_depth=4, learning_rate=0.08, subsample=0.9,
        colsample_bytree=0.9, objective="reg:squarederror", random_state=0,
    )
    model.fit(X_train, y_train)
    mae = float(mean_absolute_error(y_test, model.predict(X_test)))

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    model.save_model(str(ARTIFACTS_DIR / f"{model_name}.json"))
    return {"model_name": model_name, "features": features, "target": target_col, "mae": mae, "version": MODEL_VERSION}


def train_all() -> dict:
    metadata = {"version": MODEL_VERSION, "models": []}

    eta_df = dg.generate_eta_dataset()
    metadata["models"].append(_train_one(eta_df, dg.ETA_FEATURES, "target_eta_hours", "eta"))

    congestion_df = dg.generate_congestion_dataset()
    metadata["models"].append(_train_one(congestion_df, dg.CONGESTION_FEATURES, "target_congestion_index", "congestion_index"))
    metadata["models"].append(_train_one(congestion_df, dg.CONGESTION_FEATURES, "target_wait_hours", "congestion_wait"))

    truck_df = dg.generate_truck_queue_dataset()
    metadata["models"].append(_train_one(truck_df, dg.TRUCK_QUEUE_FEATURES, "target_queue_length", "truck_queue_length"))
    metadata["models"].append(_train_one(truck_df, dg.TRUCK_QUEUE_FEATURES, "target_wait_minutes", "truck_wait_minutes"))

    crane_df = dg.generate_crane_utilization_dataset()
    metadata["models"].append(_train_one(crane_df, dg.CRANE_UTIL_FEATURES, "target_utilization_pct", "crane_utilization"))
    metadata["models"].append(_train_one(crane_df, dg.CRANE_UTIL_FEATURES, "target_completion_hours", "crane_completion"))

    (ARTIFACTS_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2))
    return metadata


if __name__ == "__main__":
    result = train_all()
    for m in result["models"]:
        print(f"{m['model_name']:22s} MAE={m['mae']:.3f}  target={m['target']}")
