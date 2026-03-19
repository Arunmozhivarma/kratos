import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

# ----------------------------------
# 1. Load Dataset
# ----------------------------------

df = pd.read_csv("lab_occupancy_synthetic_dataset.csv")

# ----------------------------------
# 2. Encode Day Column
# ----------------------------------

day_map = {
    "Monday": 1,
    "Tuesday": 2,
    "Wednesday": 3,
    "Thursday": 4,
    "Friday": 5
}

df["day"] = df["day"].map(day_map)

# ----------------------------------
# 3. Select Features and Target
# ----------------------------------

X = df[["day", "period"]]
y = df["lab_occupied"]

# ----------------------------------
# 4. Train/Test Split
# ----------------------------------

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

# ----------------------------------
# 5. Train Model
# ----------------------------------

model = RandomForestClassifier(
    n_estimators=100,
    random_state=42
)

model.fit(X_train, y_train)

# ----------------------------------
# 6. Evaluate Model
# ----------------------------------

predictions = model.predict(X_test)

accuracy = accuracy_score(y_test, predictions)

print("\nModel Accuracy:", accuracy)

# ----------------------------------
# 7. User Input for Prediction
# ----------------------------------

print("\nEnter a day and period to predict lab occupancy\n")

day_input = int(input("Enter day (1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri): "))
period_input = int(input("Enter period (1-8): "))

# Create dataframe to avoid sklearn warning
input_data = pd.DataFrame({
    "day": [day_input],
    "period": [period_input]
})

# ----------------------------------
# 8. Predict
# ----------------------------------

prediction = model.predict(input_data)

probability = model.predict_proba(input_data)

# ----------------------------------
# 9. Output Result
# ----------------------------------

if prediction[0] == 1:
    print("\nPrediction: Lab will be OCCUPIED")
else:
    print("\nPrediction: Lab will be FREE")

print("Probability lab occupied:", round(probability[0][1] * 100, 2), "%")