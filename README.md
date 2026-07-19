# 🔬 MedResearch AI — Developer Guide

> RAG-powered medical research assistant · Ollama (on VPS) + Qdrant + Python + Node.js + React

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Architecture Diagram](#-architecture-diagram)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [VPS Ollama Setup](#-vps-ollama-setup-critical-read-this-first)
- [Day-by-Day Setup Guide](#-day-by-day-setup-guide)
- [Data Collection Guide](#-data-collection-guide)
- [Feeding Data to the AI](#-feeding-data-to-the-ai)
- [How RAG Works in This Project](#-how-rag-works-in-this-project)
- [Running All Services](#-running-all-services)
- [Environment Variables Reference](#-environment-variables-reference)
- [API Reference](#-api-reference)
- [Improving the Model Over Time](#-improving-the-model-over-time)
- [Troubleshooting](#-troubleshooting)

---

## 🧠 Project Overview

MedResearch AI is an AI-powered research assistant for medical professionals.
It uses **RAG (Retrieval-Augmented Generation)** — meaning the AI does NOT
guess answers from memory. Instead it reads YOUR documents and answers from them.

```
Your medical PDFs  →  chunked  →  embedded (via VPS Ollama)  →  stored in Qdrant
User question      →  embedded  →  matched                   →  top chunks injected into LLM prompt
LLM (Ollama VPS)   →  reads context  →  gives grounded answer with sources
```

> **Key difference from typical setups:** Ollama runs on your **VPS server**, NOT on your local machine.
> Your local machine only runs Qdrant (via Docker), the Python RAG service, the Node.js API bridge, and the React frontend.

---

## 🗺 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      YOUR LOCAL MACHINE                          │
│                                                                  │
│  ┌──────────────┐   /api/research/ask   ┌───────────────────┐   │
│  │   React UI   │──────────────────────▶│  Node.js API      │   │
│  │  (port 5173) │                       │  (port 5000)      │   │
│  └──────────────┘                       └────────┬──────────┘   │
│                                                  │ /query        │
│                                         ┌────────▼──────────┐   │
│                                         │  Python FastAPI   │   │
│                                         │  RAG Engine       │   │
│                                         │  (port 8000)      │   │
│                                         └─────┬──────┬──────┘   │
│                                               │      │           │
│                                        Qdrant │      │ HTTP      │
│                                      ┌────────▼──┐   │           │
│                                      │  Qdrant   │   │           │
│                                      │  (Docker) │   │           │
│                                      │  port 6333│   │           │
│                                      └───────────┘   │           │
└──────────────────────────────────────────────────────┼──────────┘
                                                        │ HTTP calls
                                                        │ to OLLAMA_URL
                                                        ▼
                                         ┌──────────────────────────┐
                                         │        YOUR VPS          │
                                         │                          │
                                         │  Ollama (port 11434)     │
                                         │  ├── nomic-embed-text    │
                                         │  └── llama3              │
                                         └──────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer          | Technology                        | Runs On       | Purpose                          |
|----------------|-----------------------------------|---------------|----------------------------------|
| Embedding      | `nomic-embed-text` via Ollama     | **VPS**       | Convert text to vectors          |
| LLM            | `llama3` via Ollama               | **VPS**       | Generate answers                 |
| Vector DB      | Qdrant (Docker)                   | Local         | Store and search vectors         |
| RAG Engine     | Python + FastAPI                  | Local         | Core pipeline logic              |
| API Layer      | Node.js + Express                 | Local         | Bridge frontend to Python        |
| Frontend       | React + Redux + Tailwind + Vite   | Local         | Chat UI                          |

---

## 📁 Project Structure

```
medresearch-ai/
│
├── backend-python/                  ← RAG engine (runs locally)
│   ├── data/
│   │   └── documents/               ← DROP YOUR PDFs HERE
│   ├── src/
│   │   ├── chunker.py               ← Split docs into 500-token chunks
│   │   ├── embedder.py              ← Sends chunks to VPS Ollama via HTTP
│   │   ├── vector_store.py          ← Store & search in Qdrant
│   │   ├── rag_pipeline.py          ← Full RAG flow (embed → search → LLM on VPS)
│   │   └── api.py                   ← FastAPI server (port 8000)
│   ├── scripts/
│   │   └── index_documents.py       ← Run this to feed documents to AI
│   ├── requirements.txt
│   └── .env                         ← ⚠️ Set OLLAMA_URL to your VPS here
│
├── backend-node/                    ← Express API bridge (runs locally)
│   ├── src/
│   │   ├── routes/research.js       ← POST /api/research/ask
│   │   ├── middleware/auth.js       ← JWT auth (optional)
│   │   └── server.js                ← Entry point (port 5000)
│   ├── package.json
│   └── .env
│
├── frontend/                        ← React chat UI (runs locally)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatBox.jsx          ← Main chat interface
│   │   │   └── SourceCard.jsx       ← Shows source document per answer
│   │   ├── pages/Research.jsx       ← Main page
│   │   ├── store/
│   │   │   ├── store.js             ← Redux store
│   │   │   └── researchSlice.js     ← Redux state + API calls
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css                ← Tailwind base styles
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── docker-compose.yml               ← Starts Qdrant (locally)
└── README.md
```

---

## ✅ Prerequisites

### On Your Local Machine

| Tool           | Version   | Link                                        | Used For                  |
|----------------|-----------|---------------------------------------------|---------------------------|
| Docker Desktop | Latest    | https://www.docker.com/products/docker-desktop/ | Run Qdrant locally     |
| Python         | 3.10+     | https://www.python.org/downloads/           | RAG engine                |
| Node.js        | 18+       | https://nodejs.org                          | Express API bridge        |

> ⚠️ **Do NOT install Ollama on your local machine.** Ollama runs on the VPS.

### On Your VPS

| Tool    | Required | Notes                                         |
|---------|----------|-----------------------------------------------|
| Ollama  | ✅ Yes   | Must be installed and running on port 11434   |
| llama3  | ✅ Yes   | Pull this model on the VPS                    |
| nomic-embed-text | ✅ Yes | Pull this embedding model on the VPS |

---

## 🖥 VPS Ollama Setup — **Critical: Read This First**

Your Ollama instance runs on the VPS. This section explains how to set it up and expose it so your local Python service can call it.

### Step 1 — Install Ollama on VPS

SSH into your VPS and run:

```bash
# Install Ollama (Linux VPS)
curl -fsSL https://ollama.com/install.sh | sh

# Pull the required models (only needs to be done once)
ollama pull nomic-embed-text   # ~270MB — embedding model
ollama pull llama3              # ~4.7GB — LLM model
```

### Step 2 — Expose Ollama on the VPS (Required!)

By default, Ollama only listens on `127.0.0.1:11434` (loopback).
You must configure it to listen on all interfaces so your local machine can reach it:

```bash
# Option A — Using systemd (recommended for persistent setup)
sudo systemctl edit ollama

# Add this content:
[Service]
Environment="OLLAMA_HOST=0.0.0.0"

# Save and restart
sudo systemctl restart ollama

# Verify it's listening on all interfaces
ss -tlnp | grep 11434
# Should show: 0.0.0.0:11434
```

```bash
# Option B — Quick test (non-persistent, for development)
OLLAMA_HOST=0.0.0.0 ollama serve
```

### Step 3 — Open VPS Firewall Port

```bash
# Allow port 11434 from your IP only (recommended — more secure)
sudo ufw allow from YOUR_LOCAL_IP to any port 11434

# OR allow from anywhere (simpler but less secure)
sudo ufw allow 11434

sudo ufw reload
```

> 🔒 **Security Tip:** Only allow connections from your local machine's IP. Don't expose Ollama publicly — it has no authentication by default.

### Step 4 — Verify VPS Ollama Is Reachable

From your **local machine**:

```bash
# Replace YOUR_VPS_IP with your actual VPS IP address
curl http://YOUR_VPS_IP:11434/api/tags

# Should return a JSON list of installed models
# Example: {"models":[{"name":"llama3:latest",...}, {"name":"nomic-embed-text:latest",...}]}
```

### Step 5 — Set OLLAMA_URL in your local .env

```bash
# backend-python/.env
OLLAMA_URL=http://YOUR_VPS_IP:11434
```

---

## 📅 Day-by-Day Setup Guide

### Day 1 — Qdrant + Python Environment

**Goal:** Get the vector database running and Python environment ready.

```bash
# Step 1: Start Qdrant vector database (local Docker)
cd medresearch-ai
docker-compose up -d

# Verify Qdrant is running:
# Open browser → http://localhost:6333/dashboard
# You should see the Qdrant UI

# Step 2: Create Python virtual environment
cd backend-python
python -m venv venv

# Activate it (Windows):
venv\Scripts\activate

# Activate it (Mac/Linux):
source venv/bin/activate

# Step 3: Install Python dependencies
pip install -r requirements.txt

# Step 4: Configure your VPS Ollama URL
# Edit backend-python/.env and set:
# OLLAMA_URL=http://YOUR_VPS_IP:11434

# Step 5: Test VPS connection
python -c "import requests; r = requests.get('http://YOUR_VPS_IP:11434/api/tags'); print(r.json())"
# Should print a list of models
```

**Day 1 success check:**
- Qdrant dashboard loads at `http://localhost:6333/dashboard` ✅
- `pip install` completes without errors ✅
- VPS Ollama responds to the test request ✅

---

### Day 2 — Collect Data and Feed to AI

**Goal:** Add medical documents and index them into Qdrant using the VPS Ollama embedding model.

```bash
# Step 1: Add your documents
# Copy PDFs or .txt files into:
# backend-python/data/documents/

# Step 2: Run the indexing script
cd backend-python
venv\Scripts\activate   # (Windows) or: source venv/bin/activate
python scripts/index_documents.py

# You will see output like:
# === Step 1: Loading and chunking documents ===
# Loading: diabetes_research.pdf
#   → 87 chunks created
# ...
# === Step 2: Embedding chunks with Ollama ===
# Embedding 290 chunks using nomic-embed-text @ http://YOUR_VPS_IP:11434...
#   Embedded 10/290
# ...
# === Step 3: Storing vectors in Qdrant ===
# Total 290 chunks stored in Qdrant.
# Indexing complete!
```

> ⚠️ **Important:** Every time you add NEW documents, run this script again.
> Qdrant will add the new chunks without deleting the old ones.

**Day 2 success check:**
- Script completes without errors ✅
- Output shows the VPS Ollama URL being used for embeddings ✅
- Qdrant dashboard shows collection `medresearch` with points ✅

---

### Day 3 — Start Python RAG API

**Goal:** Get the RAG engine answering questions via HTTP.

```bash
cd backend-python
venv\Scripts\activate   # (Windows) or: source venv/bin/activate

# Start the FastAPI server
uvicorn src.api:app --reload --port 8000

# You should see:
# INFO: Uvicorn running on http://0.0.0.0:8000
```

**Test it directly from browser or terminal:**

```bash
# Health check
curl http://localhost:8000/health

# Ask a question
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What are symptoms of diabetes?", "top_k": 5}'
```

**Day 3 success check:**
- Health endpoint returns `{"status":"ok"}` ✅
- Query endpoint returns an answer with sources ✅
- No "Cannot reach Ollama" errors ✅

---

### Day 4 — Start Node.js API

**Goal:** Run the Express server that connects React to Python.

```bash
cd backend-node
npm install
npm run dev

# You should see:
# Node server running on http://localhost:5000
# Python RAG service expected at http://localhost:8000
```

**Test the Node bridge:**

```bash
# Check both services are connected
curl http://localhost:5000/api/research/health

# Should return:
# { "node": "ok", "python": "ok" }
```

**Day 4 success check:**
- Node server starts on port 5000 ✅
- Health check shows both node and python as ok ✅

---

### Day 5 — Start React Frontend

**Goal:** Launch the chat UI and test the full flow end-to-end.

```bash
cd frontend
npm install
npm run dev

# Vite will start on http://localhost:5173
```

Open `http://localhost:5173` in your browser.
Type a medical question and press Enter or click Ask.

**Day 5 success check:**
- UI loads with chat interface ✅
- Question gets an answer with source document names shown ✅
- The answer is grounded in YOUR documents, not hallucinated ✅

---

### Day 6 — Polish and Deploy

```bash
# Build React for production
cd frontend
npm run build
# Output goes to frontend/dist/

# Deploy Python to Railway or Render (free tier)
# Deploy frontend/dist to Vercel (free)
# Keep Qdrant on a VPS or use Qdrant Cloud free tier
```

---

## 📂 Data Collection Guide

### What Types of Documents Work Best

| Document Type               | Quality   | Notes                                      |
|-----------------------------|-----------|---------------------------------------------|
| Medical research papers PDF | Excellent | Use PubMed, PMC, WHO publications          |
| Clinical guidelines PDF     | Excellent | CDC, NIH, NICE guidelines work very well   |
| Textbook chapters (text)    | Excellent | Drug references, anatomy, pharmacology     |
| Hospital protocols (PDF)    | Good      | Standard operating procedures              |
| Case study reports          | Good      | Great for diagnosis-related questions      |
| Wikipedia medical articles  | Average   | Good for general definitions only          |

### Free Sources to Download Medical PDFs

```
PubMed Central (Free Full Text)
→ https://www.ncbi.nlm.nih.gov/pmc/

WHO Publications
→ https://www.who.int/publications

CDC Guidelines
→ https://www.cdc.gov/library/

NIH Resources
→ https://www.nih.gov/health-information

OpenDOAR Medical Repositories
→ https://v2.sherpa.ac.uk/opendoar/
```

### Document Naming Convention

Name your files clearly so source citations make sense in answers:

```
✅ Good naming:
   diabetes_type2_management_2024.pdf
   cardiology_heart_failure_guidelines.pdf
   pharmacology_antibiotics_reference.txt

❌ Bad naming:
   document1.pdf
   scan001.pdf
   untitled.pdf
```

### Recommended Starter Dataset

Start with 5–10 documents for testing, then grow:

```
Week 1:  5-10 documents   → test basic Q&A
Week 2:  20-30 documents  → better coverage
Week 3:  50+ documents    → production quality
Month 2: 100+ documents   → specialty coverage
```

---

## 🤖 Feeding Data to the AI

### The Indexing Pipeline (What Happens Internally)

```
Your PDF
   ↓
chunker.py          → splits into 500-token pieces with 50-token overlap
   ↓
embedder.py         → HTTP POST to VPS Ollama /api/embeddings
                       each chunk → [0.23, 0.87, 0.11, ...] (768 numbers)
   ↓
vector_store.py     → saves vector + original text + filename into Qdrant
   ↓
Qdrant collection   → ready to search
```

### Running the Indexer

```bash
# Every time you add new documents:
cd backend-python
venv\Scripts\activate   # or: source venv/bin/activate
python scripts/index_documents.py
```

### Checking What Is Indexed

```bash
# See how many documents are in Qdrant
curl http://localhost:6333/collections/medresearch

# Look at the "points_count" field in the response
# Each point = one chunk from your documents
```

### Deleting and Re-indexing Everything

If you want to start fresh (e.g., changed chunking settings):

```python
# Run this in Python terminal (with venv activated):
from qdrant_client import QdrantClient
client = QdrantClient(url="http://localhost:6333")
client.delete_collection("medresearch")
print("Collection deleted. Run index_documents.py to re-index.")
```

Then run `python scripts/index_documents.py` again.

---

## ⚙️ How RAG Works in This Project

```
INDEXING PHASE (offline — run once per batch of documents)
──────────────────────────────────────────────────────────
PDF / TXT  →  chunker.py  →  500-token chunks
                                    ↓
                        HTTP POST to VPS Ollama (nomic-embed-text)
                                    ↓
                            768-dimensional vector
                                    ↓
                            vector_store.py  →  Qdrant (local)


QUERY PHASE (real-time — every user question)
──────────────────────────────────────────────────────────
User types: "What is insulin resistance?"
                    ↓
            HTTP POST to VPS Ollama → question becomes vector
                    ↓
            Qdrant cosine similarity search → top 5 matching chunks
                    ↓
            rag_pipeline.py builds prompt:
            "Context: [chunk1] [chunk2] ... Answer: What is insulin resistance?"
                    ↓
            HTTP POST to VPS Ollama (llama3) → reads context → writes grounded answer
                    ↓
            Response: answer text + source filenames
```

### Why 500 Token Chunks?

- Too small (< 100 tokens): loses context, answers feel incomplete
- Too large (> 1000 tokens): buries the relevant sentence, confuses LLM
- 500 tokens with 50 overlap: sweet spot for medical text

---

## 🚀 Running All Services

Open **4 separate terminals** and run one command in each:

```bash
# Terminal 1 — Vector Database (local Docker)
docker-compose up

# Terminal 2 — Python RAG Engine (local, connects to VPS Ollama)
cd backend-python && venv\Scripts\activate && uvicorn src.api:app --reload --port 8000

# Terminal 3 — Node.js API (local)
cd backend-node && npm run dev

# Terminal 4 — React Frontend (local)
cd frontend && npm run dev
```

All services and their locations:

| Service          | Location  | Port   | URL                              |
|------------------|-----------|--------|----------------------------------|
| React UI         | Local     | 5173   | http://localhost:5173            |
| Node.js API      | Local     | 5000   | http://localhost:5000            |
| Python RAG       | Local     | 8000   | http://localhost:8000            |
| Qdrant DB        | Local     | 6333   | http://localhost:6333/dashboard  |
| Ollama           | **VPS**   | 11434  | http://YOUR_VPS_IP:11434         |

---

## 🔑 Environment Variables Reference

### `backend-python/.env`

| Variable          | Example Value                  | Description                                    |
|-------------------|--------------------------------|------------------------------------------------|
| `QDRANT_URL`      | `http://localhost:6333`        | Local Qdrant instance (via Docker)             |
| `OLLAMA_URL`      | `http://123.45.67.89:11434`    | **Your VPS IP** where Ollama is running        |
| `EMBED_MODEL`     | `nomic-embed-text`             | Embedding model (must be pulled on VPS)        |
| `LLM_MODEL`       | `llama3`                       | LLM model (must be pulled on VPS)              |
| `COLLECTION_NAME` | `medresearch`                  | Qdrant collection name                         |

### `backend-node/.env`

| Variable         | Example Value               | Description                            |
|------------------|-----------------------------|----------------------------------------|
| `PORT`           | `5000`                      | Express server port                    |
| `PYTHON_RAG_URL` | `http://localhost:8000`     | Local Python FastAPI service URL       |
| `JWT_SECRET`     | `your_secret_here`          | JWT signing secret (change this!)      |
| `MONGO_URI`      | `mongodb://localhost:27017` | MongoDB URI (if used)                  |

---

## 📡 API Reference

### Python FastAPI (port 8000)

#### `GET /health`
```json
{ "status": "ok", "service": "medresearch-python" }
```

#### `POST /query`
```json
// Request
{ "question": "What are symptoms of Type 2 diabetes?", "top_k": 5 }

// Response
{
  "answer": "Type 2 diabetes symptoms include frequent urination...",
  "sources": ["diabetes_guidelines_2024.pdf", "endocrinology_handbook.pdf"]
}
```

**Error responses:**

| Code | Meaning                                                      |
|------|--------------------------------------------------------------|
| 400  | Empty question                                               |
| 503  | Cannot reach Ollama on VPS — check `OLLAMA_URL` in `.env`   |
| 504  | Ollama on VPS timed out — model may still be loading         |

### Node.js Express (port 5000)

#### `GET /api/research/health`
```json
{ "node": "ok", "python": "ok" }
```

#### `POST /api/research/ask`
```json
// Request
{ "question": "What is the recommended dosage of metformin?" }

// Response
{
  "answer": "The standard starting dose of metformin is 500mg...",
  "sources": ["pharmacology_reference.pdf"]
}
```

---

## 📈 Improving the Model Over Time

The AI gets better purely by adding more documents. No retraining needed.

### Week-by-Week Improvement Plan

```
Week 1 — Foundation
  → Add 10 general medical PDFs (WHO, CDC guidelines)
  → Test with basic symptom and disease questions
  → Goal: AI answers from documents, not from memory

Week 2 — Specialty Coverage
  → Add 20 documents per specialty (cardiology, diabetes, oncology)
  → Test edge case questions
  → Goal: AI handles specialty questions accurately

Week 3 — Quality Refinement
  → Remove any documents that gave wrong answers (check sources)
  → Add higher quality papers from PubMed Central
  → Adjust chunk size if needed (try 400 or 600)
  → Goal: Consistent, cited answers

Month 2 — Scale Up
  → 100+ documents across all major specialties
  → Add drug reference guides
  → Add clinical case studies
  → Goal: Production-ready assistant
```

### Tuning the Chunk Size

Edit `backend-python/src/chunker.py`:

```python
CHUNK_SIZE = 500    # increase to 600-700 for long-form research papers
CHUNK_OVERLAP = 50  # increase to 100 for better context continuity
```

After changing: delete collection → re-index → test again.

### Switching to a Better LLM (Free)

Edit `backend-python/.env`:

```env
# Try these models (all free via Ollama — must be pulled on VPS):
LLM_MODEL=llama3          # default, balanced
LLM_MODEL=mistral         # faster, slightly less accurate
LLM_MODEL=meditron        # fine-tuned specifically for medical text ← best for this project
LLM_MODEL=llama3:70b      # most accurate, needs 40GB+ RAM on VPS
```

Pull the new model on your VPS first:
```bash
# SSH into VPS, then:
ollama pull meditron
```

---

## 🔧 Troubleshooting

### Cannot reach Ollama on VPS

```bash
# 1. Check Ollama is running on VPS (SSH in first)
ollama list

# 2. Check it's listening on all interfaces (not just localhost)
ss -tlnp | grep 11434
# Should show 0.0.0.0:11434, NOT 127.0.0.1:11434

# 3. If it shows 127.0.0.1, configure OLLAMA_HOST:
sudo systemctl edit ollama
# Add: Environment="OLLAMA_HOST=0.0.0.0"
sudo systemctl restart ollama

# 4. Check firewall allows port 11434
sudo ufw status

# 5. Test from your local machine:
curl http://YOUR_VPS_IP:11434/api/tags
```

### Qdrant connection refused

```bash
# Check Docker is running, then:
docker-compose up -d

# Check container status:
docker ps
```

### Python ModuleNotFoundError

```bash
# Make sure virtual environment is activated:
venv\Scripts\activate   # Windows
source venv/bin/activate  # Mac/Linux

# Then reinstall:
pip install -r requirements.txt
```

### Embedding is slow

This is expected — the request travels from your machine to the VPS and back.
On a typical VPS connection, embedding 100 chunks takes 2–5 minutes.

```bash
# Check VPS response time
curl -w "\nTime: %{time_total}s\n" http://YOUR_VPS_IP:11434/api/tags
```

### LLM answer is too slow

```bash
# Switch to a faster model on VPS:
# SSH into VPS, then:
ollama pull mistral

# Then in backend-python/.env:
LLM_MODEL=mistral
```

### Node cannot reach Python

```bash
# Make sure Python server is running first:
uvicorn src.api:app --reload --port 8000

# Then check Node .env:
PYTHON_RAG_URL=http://localhost:8000
```

### "No relevant documents found" on every query

```bash
# No documents are indexed yet. Run:
cd backend-python
venv\Scripts\activate
python scripts/index_documents.py
```

---

## 👨‍💻 Developer Notes

- **VPS Ollama is the key architecture decision** — the Python service sends HTTP requests to your VPS; no local GPU needed
- Chunk size and overlap are the most impactful settings to tune
- `meditron` LLM model is purpose-built for medical text — try it in Week 2 (pull on VPS)
- Qdrant stores vectors permanently in Docker volume — data survives restarts
- The more specific and high-quality your documents, the better the answers
- Always check the `sources` field in responses to verify the AI is reading your docs

---

*Built by Sohail · MedResearch AI v1.1 · Stack: Ollama (VPS) + Qdrant + Python + MERN*
