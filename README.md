# 🔬 MedResearch AI — Developer Guide

> RAG-powered medical research assistant · Ollama + Qdrant + MERN Stack

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Day-by-Day Setup Guide](#-day-by-day-setup-guide)
- [Data Collection Guide](#-data-collection-guide)
- [Feeding Data to the AI](#-feeding-data-to-the-ai)
- [How RAG Works in This Project](#-how-rag-works-in-this-project)
- [Running All Services](#-running-all-services)
- [API Reference](#-api-reference)
- [Improving the Model Over Time](#-improving-the-model-over-time)
- [Troubleshooting](#-troubleshooting)

---

## 🧠 Project Overview

MedResearch AI is an AI-powered research assistant for medical professionals.
It uses **RAG (Retrieval-Augmented Generation)** — meaning the AI does NOT
guess answers from memory. Instead it reads YOUR documents and answers from them.

```
Your medical PDFs  →  chunked  →  embedded  →  stored in Qdrant
User question      →  embedded  →  matched   →  top chunks injected into LLM prompt
LLM (Ollama)       →  reads context  →  gives grounded answer with sources
```

No data leaves your machine. Everything runs locally — **100% free, 100% private.**

---

## 🛠 Tech Stack

| Layer          | Technology                        | Purpose                          |
|----------------|-----------------------------------|----------------------------------|
| Embedding      | `nomic-embed-text` via Ollama     | Convert text to vectors (free)   |
| LLM            | `llama3` via Ollama               | Generate answers (free)          |
| Vector DB      | Qdrant (Docker)                   | Store and search vectors         |
| RAG Engine     | Python + FastAPI                  | Core pipeline logic              |
| API Layer      | Node.js + Express                 | Bridge frontend to Python        |
| Frontend       | React + Redux + Tailwind + Vite   | Chat UI                          |

---

## 📁 Project Structure

```
medresearch-ai/
│
├── backend-python/                  ← RAG engine
│   ├── data/
│   │   └── documents/               ← DROP YOUR PDFs HERE
│   ├── src/
│   │   ├── chunker.py               ← Split docs into 500-token chunks
│   │   ├── embedder.py              ← Convert chunks → vectors via Ollama
│   │   ├── vector_store.py          ← Store & search in Qdrant
│   │   ├── rag_pipeline.py          ← Full RAG flow (embed → search → answer)
│   │   └── api.py                   ← FastAPI server (port 8000)
│   ├── scripts/
│   │   └── index_documents.py       ← Run this to feed documents to AI
│   ├── requirements.txt
│   └── .env
│
├── backend-node/                    ← Express API bridge
│   ├── src/
│   │   ├── routes/research.js       ← POST /api/research/ask
│   │   ├── middleware/auth.js       ← JWT auth
│   │   └── server.js                ← Entry point (port 5000)
│   ├── package.json
│   └── .env
│
├── frontend/                        ← React chat UI
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
├── docker-compose.yml               ← Starts Qdrant
└── README.md
```

---

## ✅ Prerequisites

Install these before anything else:

### 1. Docker Desktop
Download from [docker.com](https://www.docker.com/products/docker-desktop/)
Used to run Qdrant vector database.

### 2. Ollama
Download from [ollama.com](https://ollama.com)
Used to run AI models locally for free.

### 3. Python 3.10+
Download from [python.org](https://www.python.org/downloads/)

### 4. Node.js 18+
Download from [nodejs.org](https://nodejs.org)

### 5. Pull the AI models (one-time setup)

```bash
# Open terminal after installing Ollama, then run:

ollama pull nomic-embed-text
# Downloads the embedding model (~270MB)

ollama pull llama3
# Downloads the LLM (~4.7GB) — takes a few minutes
```

---

## 📅 Day-by-Day Setup Guide

### Day 1 — Qdrant + Python Environment

**Goal:** Get the database running and Python environment ready.

```bash
# Step 1: Start Qdrant vector database
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

# Step 4: Verify .env file exists with correct values
# backend-python/.env should contain:
# QDRANT_URL=http://localhost:6333
# OLLAMA_URL=http://localhost:11434
# COLLECTION_NAME=medresearch
# EMBED_MODEL=nomic-embed-text
# LLM_MODEL=llama3
```

**Day 1 success check:**
- Qdrant dashboard loads at `http://localhost:6333/dashboard` ✅
- `pip install` completes without errors ✅

---

### Day 2 — Collect Data and Feed to AI

**Goal:** Add medical documents and index them into Qdrant.

```bash
# Step 1: Add your documents
# Copy PDFs or .txt files into:
# backend-python/data/documents/

# Step 2: Run the indexing script
cd backend-python
venv\Scripts\activate
python scripts/index_documents.py

# You will see output like:
# Loading: diabetes_research.pdf
#   → 87 chunks created
# Loading: cardiology_handbook.pdf
#   → 203 chunks created
# Total chunks ready: 290
# Embedding 290 chunks using nomic-embed-text...
#   Embedded 10/290
#   Embedded 20/290
# ...
# Total 290 chunks stored in Qdrant.
# Indexing complete!
```

> ⚠️ **Important:** Every time you add NEW documents, run this script again.
> Qdrant will add the new chunks without deleting the old ones.

**Day 2 success check:**
- Script completes without errors ✅
- Qdrant dashboard shows collection `medresearch` with points ✅

---

### Day 3 — Start Python RAG API

**Goal:** Get the RAG engine answering questions via HTTP.

```bash
cd backend-python
venv\Scripts\activate

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
|-----------------------------|-----------|--------------------------------------------|
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

### Recommended Starter Dataset (Day 2)

Start with 5-10 documents for testing, then grow:

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
embedder.py         → each chunk → [0.23, 0.87, 0.11, ...] (768 numbers)
   ↓
vector_store.py     → saves vector + original text + filename into Qdrant
   ↓
Qdrant collection   → ready to search
```

### Running the Indexer

```bash
# Every time you add new documents:
cd backend-python
venv\Scripts\activate
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

If you want to start fresh (e.g. changed chunking settings):

```python
# Run this in Python terminal:
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
                            embedder.py (Ollama: nomic-embed-text)
                                    ↓
                            768-dimensional vector
                                    ↓
                            vector_store.py  →  Qdrant


QUERY PHASE (real-time — every user question)
──────────────────────────────────────────────────────────
User types: "What is insulin resistance?"
                    ↓
            embedder.py → question becomes vector
                    ↓
            Qdrant cosine similarity search → top 5 matching chunks
                    ↓
            rag_pipeline.py builds prompt:
            "Context: [chunk1] [chunk2] ... Answer: What is insulin resistance?"
                    ↓
            Ollama llama3 reads context → writes grounded answer
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
# Terminal 1 — Vector Database
docker-compose up

# Terminal 2 — Python RAG Engine
cd backend-python && venv\Scripts\activate && uvicorn src.api:app --reload --port 8000

# Terminal 3 — Node.js API
cd backend-node && npm run dev

# Terminal 4 — React Frontend
cd frontend && npm run dev
```

All services and their ports:

| Service          | Port   | URL                              |
|------------------|--------|----------------------------------|
| React UI         | 5173   | http://localhost:5173            |
| Node.js API      | 5000   | http://localhost:5000            |
| Python RAG       | 8000   | http://localhost:8000            |
| Qdrant DB        | 6333   | http://localhost:6333/dashboard  |
| Ollama           | 11434  | http://localhost:11434           |

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
# Try these models (all free via Ollama):
LLM_MODEL=llama3          # default, balanced
LLM_MODEL=mistral         # faster, slightly less accurate
LLM_MODEL=meditron        # fine-tuned specifically for medical text ← best for this project
LLM_MODEL=llama3:70b      # most accurate, needs 40GB+ RAM
```

Pull the new model first:
```bash
ollama pull meditron
```

---

## 🔧 Troubleshooting

### Ollama not responding
```bash
# Check if Ollama is running
ollama list

# If not running, start it:
ollama serve
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
This is normal on first run. `nomic-embed-text` processes about 10-20 chunks
per second on most machines. 100 documents (~500 chunks) takes about 1 minute.

### LLM answer is too slow
```bash
# Switch to a faster model:
# In backend-python/.env:
LLM_MODEL=mistral

ollama pull mistral
```

### Node cannot reach Python
```bash
# Make sure Python server is running first:
uvicorn src.api:app --reload --port 8000

# Then check Node .env:
PYTHON_RAG_URL=http://localhost:8000
```

---

## 👨‍💻 Developer Notes

- Chunk size and overlap are the most impactful settings to tune
- `meditron` LLM model is purpose-built for medical text — try it in Week 2
- Qdrant stores vectors permanently in Docker volume — data survives restarts
- The more specific and high-quality your documents, the better the answers
- Always check the `sources` field in responses to verify the AI is reading your docs

---

*Built by Sohail · MedResearch AI v1.0 · Stack: Ollama + Qdrant + Python + MERN*
