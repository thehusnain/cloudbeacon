# CARNAGE

CAN Attack Reconstruction and Network Graph Evidence

CARNAGE is a forensic analysis platform designed for investigating cyberattacks against automotive Controller Area Network (CAN) systems. The project focuses on analyzing recorded CAN traffic logs to detect suspicious activity, verify evidence integrity, reconstruct the sequence of events, and generate a structured forensic report that investigators can trust.

In simple terms, CARNAGE helps answer the question: “What happened on the vehicle network, and can we prove it?”

## Project Overview

Modern vehicles rely on the CAN bus to allow electronic control units (ECUs) such as the engine control unit, brakes, airbags, and infotainment systems to exchange messages. While efficient for vehicle operation, the CAN protocol was not designed with security in mind. As a result, malicious or abnormal messages can be injected into the network without obvious signs of compromise.

Traditional vehicle black box logs are normally focused on safety events such as airbag deployment, hard braking, or crash-related telemetry. These logs do not capture the kind of indicators needed for cybersecurity investigation. In many cases, the evidence is incomplete, difficult to validate, and not suitable for forensic analysis.

CARNAGE addresses this gap by processing stored CAN logs as forensic evidence rather than simple diagnostic data. It rebuilds the timeline of suspicious behavior, checks whether the evidence has been modified, and produces a clear report that can be used by investigators, analysts, and security researchers.

## Problem Statement

Vehicle networks are vulnerable to several forms of malicious activity, including denial-of-service attacks, fuzzing, spoofing, and replay-based manipulation. However, most vehicles do not maintain reliable security logs that can serve as evidence.

The main problems include:

- CAN traffic is difficult to distinguish from benign traffic because the same network is used for both routine vehicle operations and attack-related activity.
- Recorded logs often lack trustable timestamps and provenance information.
- Data can be altered, manipulated, or replayed without obvious indication.
- Different manufacturers and diagnostic tools store data in different formats, making cross-vehicle investigation difficult.
- Access to CAN data is often limited by locked diagnostic ports and by the fact that volatile data disappears when the vehicle powers down.
- Existing black box systems focus on safety events, not cybersecurity events.

As a result, when a vehicle is compromised, there may be little reliable evidence left behind to determine how the attack occurred or whether it actually happened.

## Solution

CARNAGE reconstructs forensic timelines from CAN logs and identifies suspicious events based on abnormal traffic behavior. The system is designed to work on existing CAN log recordings without requiring the physical vehicle to be present.

The project combines several core capabilities:

1. Log ingestion and parsing
   - Reads CAN logs captured in formats such as ASC, PCAP, CSV, and BLF.
   - Converts raw traffic into a structured dataset suitable for analysis.

2. Attack-pattern detection
   - Detects anomalies in message frequency, timing gaps, identifier behavior, and signal patterns.
   - Identifies common attack behaviors such as denial-of-service, fuzzing, spoofing, and replay-like manipulation.

3. Evidence integrity protection
   - Generates SHA-256 hashes for imported log files.
   - Records a chain-of-custody trail for all actions applied to the evidence.
   - Alerts investigators if any file or record has been tampered with.

4. Timeline reconstruction
   - Aligns suspicious events with time references to create a coherent forensic timeline.
   - Presents the sequence of activities in a readable and auditable form.

5. Automated forensic reporting
   - Aggregates flagged events, integrity results, timestamps, and analysis findings into a structured report.
   - Produces a clear output suitable for investigation and legal or technical review.

## Core Features

- CAN log ingestion from multiple common formats
- Automated anomaly detection using statistical and machine learning techniques
- Rule-based detection for known attack patterns
- SHA-256-based tamper detection and evidence integrity validation
- Timeline reconstruction for forensic investigation
- Chain-of-custody tracking for evidence handling
- Structured PDF report generation
- Web-based dashboard for investigators
- Case-based storage for logs, events, and findings

## Technology Stack

The project is designed around a modern forensic and analytical stack:

- Python — primary backend and data-processing language
- Pandas and NumPy — CAN log parsing and analysis
- python-can / can-utils style parsing — support for ASC, PCAP, CSV, and BLF data
- Scikit-learn — machine learning-based anomaly detection
- Isolation Forest — abnormal frequency and timing detection
- Rule-based detection engine — identification of known malicious traffic patterns
- SHA-256 and hashlib — integrity and tamper verification
- FastAPI — backend API service
- React.js — front-end forensic dashboard
- Tailwind CSS — modern UI styling
- PostgreSQL — persistent storage for cases, logs, and evidence records
- ReportLab — automated forensic report generation
- Docker — deployment and environment consistency
- Git and GitHub — version control and collaboration

## Expected System Workflow

CARNAGE is designed to work as a full investigation pipeline:

1. Evidence intake
   - The investigator uploads a CAN log file.
   - The system records a hash and logs the intake record.

2. Data processing
   - Log files are parsed and normalized into structured CAN frames.
   - Relevant metadata and timing information are extracted.

3. Detection and analysis
   - The system detects suspicious message frequency, timing anomalies, identifier abnormalities, and known attack patterns.
   - Events are classified and assigned severity or confidence indicators.

4. Reconstruction
   - The analysis engine arranges findings into one consistent timeline.
   - Events are correlated to help identify the probable start and progression of an attack.

5. Reporting
   - A structured forensic report is generated, combining detection results, integrity verification, and timeline details.

## Supported Data Sources

The system is intended to work with publicly available and research-oriented datasets, including:

- Car Hacking Dataset
- OTIDS
- Survival Analysis Dataset

These datasets allow the project to be developed and evaluated without requiring direct access to physical vehicle hardware.

## Repository Structure

This repository is expected to evolve into a full application with the following general structure:

```text
carnage/
├── backend/
│   ├── api/
│   ├── core/
│   ├── models/
│   ├── services/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
├── database/
│   └── schema/
├── docs/
│   └── reports/
├── notebooks/
│   └── analysis/
├── tests/
├── docker/
├── .gitignore
├── LICENSE
├── README.md
└── docker-compose.yml
```

## Getting Started

This repository currently provides the project foundation and documentation. The full implementation will be added as the system is developed.

### Prerequisites

- Python 3.10 or later
- Node.js 18+
- PostgreSQL
- Docker (optional, for deployment)
- Git

### Installation

1. Clone the repository

```bash
git clone https://github.com/<your-username>/carnage.git
cd carnage
```

2. Create a Python virtual environment

```bash
python -m venv .venv
source .venv/bin/activate
```

3. Install backend dependencies

```bash
pip install -r backend/requirements.txt
```

4. Install front-end dependencies

```bash
cd frontend
npm install
```

5. Start the backend

```bash
cd backend
uvicorn app.main:app --reload
```

6. Start the front-end

```bash
cd frontend
npm run dev
```

## Use Cases

CARNAGE is intended for:

- Cybersecurity investigation of in-vehicle networks
- Post-event forensic analysis of CAN traffic
- Research on automotive attack detection and anomaly analysis
- Security validation of vehicle telemetry logs
- Evidence reporting in legal, engineering, or research contexts

## Project Goals

The main goals of the project are to:

- create a reliable forensic workflow for CAN traffic analysis
- detect suspicious behavior from recorded vehicle logs
- preserve and verify evidence integrity
- reconstruct the chronological sequence of attack events
- generate clear, actionable forensic reports
- make automotive security investigation more accessible and consistent across different vehicles and data sources

## Research and Evaluation

The project uses public CAN datasets to validate detection performance and demonstrate that the analysis engine can identify abnormal traffic patterns and attack scenarios without requiring physical vehicle access.

This not only improves reproducibility, but also supports strong evaluation of the system’s detection capabilities.

## Roadmap

The project is planned in phases:

- Phase 1: Literature review and CAN attack pattern analysis
- Phase 2: Data ingestion and preprocessing pipeline
- Phase 3: Detection engine for anomalies and attack behavior
- Phase 4: Hashing, chain-of-custody, and evidence integrity tracking
- Phase 5: Timeline reconstruction and forensic analysis
- Phase 6: Front-end dashboard and case management
- Phase 7: Automated PDF report generation
- Phase 8: Testing, validation, and documentation

## Licensing

This project is licensed under the MIT License. See the `LICENSE` file for details.

## Acknowledgements

This project is built for automotive cybersecurity research and digital forensic analysis. It draws inspiration from the need for better evidence handling, network anomaly detection, and practical cybersecurity tools in connected vehicle environments.

## Conclusion

CARNAGE is designed to bring forensic rigor to automotive cybersecurity analysis. By combining CAN log processing, integrity validation, anomaly detection, and structured reporting, it offers a practical foundation for investigating attacks on modern vehicle systems. The result is a tool that transforms raw network data into trustworthy investigative evidence.

---

Developed as part of the Final Year Project (FYP) proposal for CARNAGE.
