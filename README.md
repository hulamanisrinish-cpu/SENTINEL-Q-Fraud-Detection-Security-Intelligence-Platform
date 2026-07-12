# SENTINEL-Q — AI-Driven Correlation of Cybersecurity Telemetry & Transactional Behaviour

**FinSpark'26 · Problem Statement 2**

A correlation engine that joins transaction behavior and security telemetry on session/customer ID, producing one explainable composite risk score, and separately flags cryptographic posture exposure — surfaced through a SOC-analyst dashboard.

---

## Problem

Banks run fraud detection and cybersecurity monitoring as separate systems. A session with both a suspicious login *and* an unusual transaction — the highest-risk combination, and the actual signature of account-takeover fraud — gets scored twice, weakly, by two systems that never talk to each other. Separately, most institutions have no visibility into which internal services are still relying on classical (non-quantum-safe) cryptography for data with long confidentiality lifetimes.

## Solution

SENTINEL-Q correlates transaction behavior and security telemetry to produce:
- **Composite risk scores** combining fraud, telemetry, and quantum posture signals
- **Explainable AI** with SHAP feature attribution for analyst decision-making
- **Cryptographic posture monitoring** to flag quantum-vulnerable systems
- **SOC analyst dashboard** for alert triage and investigation

---

## Features

- **Correlation Engine**: Joins transaction and telemetry data on session ID
- **Multi-Dimensional Scoring**: 
  - Fraud score (amount z-score, velocity, new payee)
  - Telemetry score (IP reputation, geo mismatch, device fingerprint, failed auth)
  - Quantum posture score (cipher suite × data sensitivity)
- **ML Classification**: XGBoost classifier with 99% accuracy on synthetic data
- **SHAP Explainability**: Per-alert feature attribution for analyst understanding
- **Configurable Thresholds**: Live weight editing without redeployment
- **Dark SOC Dashboard**: Professional analyst interface with real-time updates

---

## Tech Stack

- **Backend**: Python 3.11 + Flask + SQLite
- **ML**: XGBoost + scikit-learn + SHAP
- **Frontend**: React + TypeScript + Tailwind CSS + Vite
- **Data**: SQLite (hackathon scale), PostgreSQL (production roadmap)

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- pip and npm

### Backend Setup

```bash
cd sentinel-q

# Install Python dependencies
pip install -r backend/requirements.txt

# Start Flask backend
cd backend
python app.py
```

Backend runs on `http://127.0.0.1:5000`

### Frontend Setup

```bash
cd sentinel-q/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs on `http://localhost:3000`

---

## Project Structure

```
sentinel-q/
├── sentinel_q.db            # SQLite database
├── scoring_engine.py         # Risk scoring engine
├── backend/
│   ├── app.py               # Flask API endpoints
│   └── requirements.txt     # Python dependencies
└── frontend/
    ├── src/
    │   ├── components/      # React components
    │   │   ├── AlertQueue.tsx
    │   │   ├── AlertDetail.tsx
    │   │   ├── CryptoPosture.tsx
    │   │   ├── ConfigPanel.tsx
    │   │   ├── BottomNav.tsx
    │   │   ├── CoverPage.tsx
    │   │   └── ThreeBackground.tsx
    │   ├── App.tsx
    │   ├── main.tsx
    │   └── index.css
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── tsconfig.json
```

---

## API Endpoints

### Alerts
- `GET /api/alerts` - Get all alerts (optional: `?risk_band=HIGH&limit=50`)
- `GET /api/alerts/{id}` - Get alert details with full evidence
- `POST /api/alerts/{id}/verdict` - Submit analyst verdict (false_positive/escalated)

### Crypto Posture
- `GET /api/crypto-posture/summary` - Get cryptographic posture summary

### Configuration
- `GET /api/config` - Get current scoring configuration
- `PUT /api/config` - Update scoring weights and thresholds

### Stats
- `GET /api/stats` - Get system statistics

### Simulation
- `POST /api/simulate` - Simulate a new transaction for demo purposes
