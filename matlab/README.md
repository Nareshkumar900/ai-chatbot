# MATLAB Deep Learning Module
## AI Medical Doctor–Patient Management System

This module provides specialized **Deep Learning Risk Assessment & Serious Situation Detection** for the AI Medical Platform.

---

### 🧠 Model Architecture

The MATLAB Deep Learning module combines:
1. **1D Convolutional Neural Network (1D-CNN)**:
   - Captures local non-linear inter-dependencies between concurrent biomarkers (e.g., Blood Pressure, Glucose, Creatinine, Cholesterol, Triglycerides, SpO2).
   - Layers: `sequenceInputLayer` -> `convolution1dLayer` -> `batchNormalizationLayer` -> `reluLayer`.
2. **Bidirectional Long Short-Term Memory (BiLSTM)**:
   - Evaluates multi-visit temporal trajectory and historical progression.
   - Identifies acute deviations and rapid physiological deterioration patterns.
   - Layers: `bilstmLayer(64, 'OutputMode', 'last')` -> `dropoutLayer(0.25)`.
3. **Classification Head**:
   - `fullyConnectedLayer(32)` -> `reluLayer` -> `fullyConnectedLayer(3)` -> `softmaxLayer`.
   - Produces probabilities for 3 risk categories:
     - `Low Risk`
     - `Moderate Risk`
     - `High Risk`

---

### 📂 File Structure

| File | Purpose |
| :--- | :--- |
| `train_risk_classifier.m` | Trains the CNN-BiLSTM network on longitudinal clinical biomarker data and exports `trained_risk_model.mat`. |
| `predict_risk.m` | Inference function accepting JSON/struct input, standardizing features, evaluating neural risk score, and returning structured risk level and safety recommendation. |
| `matlab_service.m` | Standalone MATLAB HTTP/TCP microservice listening on port `6000` (`http://127.0.0.1:6000/predict`). |

---

### 🚀 Running the MATLAB Service

#### Option A: Running the MATLAB HTTP Microservice
Open MATLAB, navigate to this `matlab/` directory, and run:
```matlab
matlab_service(6000)
```
The service will listen on `http://127.0.0.1:6000/predict` and process incoming requests from the Node.js backend.

#### Option B: Standalone Inference via MATLAB Command Line
```matlab
result = predict_risk('{"systolicBP": 150, "diastolicBP": 95, "fastingGlucose": 180, "hba1c": 7.8}')
```

---

### 🔌 Node.js Integration

The Node.js backend (`backend/services/matlabService.js`) communicates with this module following the flow:
```
Node.js Backend
       ↓
MATLAB AI Service (HTTP / CLI)
       ↓
LSTM / CNN Model
       ↓
Prediction Result
       ↓
Node.js Backend
       ↓
Frontend UI
```

Output format returned to client:
```json
{
  "riskLevel": "Moderate Risk",
  "riskScore": 0.72,
  "recommendation": "Potential risk detected — professional medical evaluation recommended."
}
```
