from __future__ import annotations

import argparse
import json

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split

from main import DATASET_PATH, DAY_MAP


def compute_metrics(test_size: float = 0.2, random_state: int = 42) -> dict:
    df = pd.read_csv(DATASET_PATH)
    df["day"] = df["day"].map(DAY_MAP)
    df = df.dropna(subset=["day", "period", "lab_occupied"])

    X = df[["day", "period"]].astype(int)
    y = df["lab_occupied"].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
    )

    model = RandomForestClassifier(
        n_estimators=100,
        random_state=random_state,
    )
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    tn, fp, fn, tp = confusion_matrix(y_test, y_pred, labels=[0, 1]).ravel()

    return {
        "samples_total": int(len(y)),
        "samples_train": int(len(y_train)),
        "samples_test": int(len(y_test)),
        "class_counts": {
            "free_0": int((y == 0).sum()),
            "occupied_1": int((y == 1).sum()),
        },
        "config": {
            "test_size": float(test_size),
            "random_state": int(random_state),
            "n_estimators": 100,
        },
        "metrics": {
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "precision": float(precision_score(y_test, y_pred, zero_division=0)),
            "recall": float(recall_score(y_test, y_pred, zero_division=0)),
            "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        },
        "confusion_matrix": {
            "tn": int(tn),
            "fp": int(fp),
            "fn": int(fn),
            "tp": int(tp),
        },
    }


def print_human_report(report: dict) -> None:
    print("ML Model Evaluation")
    print("===================")
    print(f"Dataset path      : {DATASET_PATH}")
    print(f"Total samples     : {report['samples_total']}")
    print(f"Train/Test split  : {report['samples_train']}/{report['samples_test']}")
    print(
        "Class counts      : "
        f"free= {report['class_counts']['free_0']}, "
        f"occupied= {report['class_counts']['occupied_1']}"
    )
    print(
        "Config            : "
        f"test_size={report['config']['test_size']}, "
        f"random_state={report['config']['random_state']}, "
        f"n_estimators={report['config']['n_estimators']}"
    )
    print("")
    print("Scores")
    print("------")
    print(f"Accuracy          : {report['metrics']['accuracy']:.4f}")
    print(f"Precision         : {report['metrics']['precision']:.4f}")
    print(f"Recall            : {report['metrics']['recall']:.4f}")
    print(f"F1                : {report['metrics']['f1']:.4f}")
    print("")
    print("Confusion Matrix (actual rows x predicted cols)")
    print("------------------------------------------------")
    print(
        "               pred=0   pred=1\n"
        f"actual=0 (free)   {report['confusion_matrix']['tn']:>4}     {report['confusion_matrix']['fp']:>4}\n"
        f"actual=1 (occ)    {report['confusion_matrix']['fn']:>4}     {report['confusion_matrix']['tp']:>4}"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate occupancy model with accuracy/precision/recall/F1."
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help="Fraction of samples held for test split (default: 0.2).",
    )
    parser.add_argument(
        "--random-state",
        type=int,
        default=42,
        help="Seed for repeatable split/model results (default: 42).",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print report as JSON instead of human-readable text.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    report = compute_metrics(test_size=args.test_size, random_state=args.random_state)
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print_human_report(report)


if __name__ == "__main__":
    main()
