from __future__ import annotations

from datetime import datetime, time as dtime
from pathlib import Path

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR / "lab_occupancy_synthetic_dataset.csv"
TIMETABLE_PATH = BASE_DIR / "actual_timetable.csv"

DAY_MAP = {
    "Monday": 1,
    "Tuesday": 2,
    "Wednesday": 3,
    "Thursday": 4,
    "Friday": 5,
}

_MODEL: RandomForestClassifier | None = None
_MODEL_ACCURACY: float | None = None
_TIMETABLE: pd.DataFrame | None = None


def _parse_hhmm(value: str) -> dtime:
    return datetime.strptime(str(value).strip(), "%H:%M").time()


def _load_timetable() -> pd.DataFrame:
    global _TIMETABLE
    if _TIMETABLE is not None:
        return _TIMETABLE

    df = pd.read_csv(TIMETABLE_PATH)
    df["time_start_obj"] = df["time_start"].apply(_parse_hhmm)
    df["time_end_obj"] = df["time_end"].apply(_parse_hhmm)
    _TIMETABLE = df
    return _TIMETABLE


def get_current_period(dt: datetime | None = None) -> int | None:
    now = dt or datetime.now()
    day_name = now.strftime("%A")
    if day_name not in DAY_MAP:
        return None

    timetable = _load_timetable()
    matching_day = timetable[timetable["day"] == day_name]
    now_time = now.time().replace(second=0, microsecond=0)

    for _, row in matching_day.iterrows():
        start = row["time_start_obj"]
        end = row["time_end_obj"]
        if start <= now_time < end:
            try:
                return int(row["period"])
            except (TypeError, ValueError):
                return None
    return None


def train_model() -> tuple[RandomForestClassifier, float]:
    global _MODEL, _MODEL_ACCURACY
    if _MODEL is not None:
        return _MODEL, _MODEL_ACCURACY if _MODEL_ACCURACY is not None else 0.0

    df = pd.read_csv(DATASET_PATH)
    df["day"] = df["day"].map(DAY_MAP)
    df = df.dropna(subset=["day", "period", "lab_occupied"])

    X = df[["day", "period"]].astype(int)
    y = df["lab_occupied"].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
    )

    model = RandomForestClassifier(
        n_estimators=100,
        random_state=42,
    )
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)

    _MODEL = model
    _MODEL_ACCURACY = float(accuracy)
    return _MODEL, _MODEL_ACCURACY


def predict_occupancy_probability(day: int, period: int) -> float:
    model, _ = train_model()
    input_data = pd.DataFrame({"day": [int(day)], "period": [int(period)]})
    probability = model.predict_proba(input_data)[0][1]
    return float(max(0.0, min(1.0, probability)))


def get_current_occupancy_probability(dt: datetime | None = None) -> float:
    now = dt or datetime.now()
    day_name = now.strftime("%A")
    period = get_current_period(now)

    # Default to no occupancy when there is no schedule slot (weekends/night/gaps).
    if day_name not in DAY_MAP or period is None:
        return 0.0

    return predict_occupancy_probability(DAY_MAP[day_name], period)


def run_cli() -> None:
    _, accuracy = train_model()
    print("\nModel Accuracy:", accuracy)
    print("\nEnter a day and period to predict lab occupancy\n")

    day_input = int(input("Enter day (1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri): "))
    period_input = int(input("Enter period (1-8): "))

    probability = predict_occupancy_probability(day_input, period_input)
    prediction = 1 if probability >= 0.5 else 0

    if prediction == 1:
        print("\nPrediction: Lab will be OCCUPIED")
    else:
        print("\nPrediction: Lab will be FREE")
    print("Probability lab occupied:", round(probability * 100, 2), "%")


if __name__ == "__main__":
    run_cli()
