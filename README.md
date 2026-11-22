# CareerPilot AI

CareerPilot AI is an AI-powered job application assistant designed to help professionals tailor their resumes honestly to job descriptions, track job applications, manage resume versions, and receive actionable resume coaching without hallucinating credentials or compromising privacy.

---

## Architecture & Tech Stack

- **Frontend**: React 19, Vite 6, Nginx Alpine, client-side DOCX (`docx.js`) and TXT export.
- **Backend**: FastAPI, Uvicorn, Python 3.11+, in-memory PDF/Word text extraction (`pypdf`, `python-docx`), rule-based keyword matcher.
- **AI Engine**: Google Gemini API (`gemini-3.1-flash-lite`) with server-side validation and ethical anti-hallucination prompt invariants.
- **Data & Privacy**: Local-first storage (`localStorage`), optional cloud sync via Supabase (PostgreSQL with Row Level Security & Auth).
- **DevOps & Containerization**: Docker, Docker Compose, Nginx SPA routing, Jenkins CI/CD, Helm, Kubernetes, and GitOps.

---

## Key Features & Modules

### 1. Tailor Resume to Job
- **Evidence-Grounded Tailoring**: Generates complete tailored resume drafts strictly based on verified facts in the active resume. Never fabricates skills, employers, metrics, or dates.
- **Unevidenced Requirements Isolation**: Relevant job requirements not found in the resume are flagged separately under "Not evidenced in your resume" for candidate confirmation rather than being fabricated.
- **Review & Diff Screen**: Side-by-side or highlighted section diffs with clear rationale for changes before applying.
- **Safe Versioning**: Accepting a draft automatically saves it as a new version without mutating or overwriting the original source resume.
- **Platform Presets**: General ATS Standard, Naukri Profile, and LinkedIn Profile.

### 2. AI Resume Coach
- **Section-Specific Recommendations**: Categorized suggestions for `headline`, `summary`, `skills`, `experience`, and `projects`.
- **Granular User Control**: Explicit Accept, Edit (customize before applying), or Reject controls for every suggestion.
- **Clarifying Questions**: Context or metric gaps are surfaced as questions for the user rather than guessed.

### 3. Resume Keyword Analyser & Comparison
- **Deterministic Technical Dictionary**: Pure rule-based comparison using curated technical terms (languages, cloud tools, frameworks).
- **Exact & Alias Matching**: Resolves punctuation-heavy terms (`.NET`, `C++`, `Node.js`) and alias groupings without false positives.

### 4. Job Application Tracker
- **Application Stages**: `Interested`, `Applied`, `Interviewing`, `Offer`, `Rejected`.
- **Search & Filter**: Real-time role and company search with status counters.
- **Zero Cloud Leakage**: Local browser storage isolation under `careerpilot_tracked_jobs`.

### 5. Named Resume Versions & Client-Side Export
- **Snapshot Management**: Save, load, rename, and delete multiple resume drafts.
- **Word (.docx) Export**: Clean single-column layout, native bullet preservation, bolded technical categories, and page-break protection.
- **100% Client-Side**: Formatted and downloaded directly from browser memory.

---

## Quick Start with Docker Compose (Recommended)

Run the entire application (frontend + backend) with a single command:

### 1. Prerequisites
- [Docker & Docker Compose](https://docs.docker.com/get-docker/) installed and running.
- (Optional) A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/).

### 2. Configure Environment (Optional)
If using AI Coach or Resume Tailoring, add your Gemini API key to `backend/.env`:
```bash
# backend/.env (ignored by Git)
GEMINI_API_KEY="your-gemini-api-key"
```

### 3. Start Containers
```bash
docker compose up --build
```

### 4. Access the Application
- **Frontend App**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`
- **API Docs (Swagger)**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/health`

To stop the containers:
```bash
docker compose down
```

---

## Running Locally Without Docker

### 1. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Automated Test Suites

Run the full end-to-end regression test suite across frontend and backend:

```bash
# Frontend regression and unit tests
cd frontend && \
npm run build && \
node test_e2e_regression.js && \
node test_tailor_tab_switch.js && \
node test_tailor.js && \
node test_ui_refinement.js && \
node test_supabase_sync.js

# Backend test suite
cd ../backend && \
./venv/bin/python tests/test_api_endpoints.py && \
./venv/bin/python tests/test_comparator.py && \
./venv/bin/python tests/test_parser.py && \
./venv/bin/python tests/test_docx_roundtrip.py && \
./venv/bin/python tests/test_ai_coach.py && \
./venv/bin/python tests/test_tailor.py
```

---

## DevOps & Cloud-Native Learning Roadmap

This project is configured as a production-grade playground for end-to-end cloud-native engineering:

- [x] **Local Containerization**: `backend/Dockerfile`, `frontend/Dockerfile` (Nginx multi-stage), `docker-compose.yml`.
- [ ] **Container Registry**: Tag and push versioned images to Docker Hub.
- [ ] **CI/CD Pipeline**: Jenkins declarative pipeline (`Jenkinsfile`) for automated test, build, and push.
- [ ] **Kubernetes Packaging**: Helm chart (`Chart.yaml`, `values.yaml`, `templates/`) with Deployments, Services, and Ingress.
- [ ] **Local Cluster Testing**: Deploy and verify on Minikube / kind.
- [ ] **GitOps Continuous Delivery**: Automated cluster synchronization with Argo CD.
- [ ] **Cloud Production**: Production rollout on Amazon EKS.

---

## License

MIT License. Built for learning and production-grade DevOps exploration.
