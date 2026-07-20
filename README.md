# 🔬 MedResearch AI — Enterprise RAG Platform

> **High-Performance RAG Platform for Medical Research**  
> Powered by **FastEmbed ONNX** (local embeddings) + **Qdrant** (hybrid dense/sparse vector store) + **Cross-Encoder Reranking** + **Groq LLaMA 3.3 70B** (generation) + **MongoDB** (session history) + **React UI**.

---

## 🚀 Key Architectural Upgrades (v2.0)
MedResearch AI has been fully upgraded from a slow VPS-based Ollama setup to a highly optimized hybrid edge-cloud architecture:
*   **Edge-Fast Embeddings**: Migrated from VPS Ollama HTTP queries to **local FastEmbed (ONNX)** with batch streaming (batch size 32). This runs locally on a standard 8GB CPU setup with zero network lag and extremely low RAM footprint.
*   **Qdrant Hybrid Retrieval**: Dense vector search (768-dim Nomics) is fused with sparse **BM25 keyword search** using **Reciprocal Rank Fusion (RRF)** for optimal medical term lookup.
*   **Neural Reranking**: Integrates a local **Cross-Encoder Reranker** (`ms-marco-MiniLM-L-6-v2`) to filter and grade the top 20 candidate chunks down to the top 5 most relevant contexts.
*   **Ultra-Fast Medical LLM**: Powered by **Groq Cloud API** (`llama-3.3-70b-versatile`) for instant, high-grade clinical reasoning.
*   **Irrelevance Guardrails**: Auto-classifies out-of-scope questions using reranker logit thresholds (threshold `-4.5`) to respond exactly with: `"Sorry, I am not trained for that purpose."`
*   **Local Chat History (MongoDB)**: Chat sessions, dynamic titles, and citation metadata are persisted in a local MongoDB database.
*   **Collapsible Sidebar UI**: A Gemini-inspired modern dashboard featuring collapsible session history drawer, custom markdown rendering, and text area layout.

---

## 🗺 System Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │                   VITE FRONTEND (PORT 5173)            │
                    │   Collapsible Sidebar (History)  ·  Centered Gemini UI │
                    └───────────────────────────┬────────────────────────────┘
                                                │ REST API
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │                  NODE.JS EXPRESS (PORT 5000)           │
                    │   Chat Session Manager  ·  MongoDB Persisted Logs      │
                    └─────────────────────┬───────────────────┬──────────────┘
                                          │ /query            │ Mongoose
                                          ▼                   ▼
┌───────────────────────────────────────────────────┐   ┌────────────────────┐
│              PYTHON FASTAPI ENGINE (PORT 8000)     │   │  LOCAL MONGODB     │
│                                                   │   │  (Port 27017)      │
│  1. FastEmbed ONNX (Local Nomic v1.5 Embedder)    │   │  Chat collections  │
│  2. BM25 Sparse Search + Qdrant Dense Search       │   └────────────────────┘
│  3. Reciprocal Rank Fusion (RRF)                  │
│  4. Cross-Encoder Reranking (Local ONNX)          │
└──────┬──────────────────────┬─────────────────────┘
       │                      │
       │ Vector Search        │ HTTP (70B Generation)
       ▼                      ▼
┌───────────────────┐   ┌───────────────────────────┐
│   LOCAL QDRANT    │   │        GROQ CLOUD         │
│   (Port 6333)     │   │   llama-3.3-70b-versatile │
└───────────────────┘   └───────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Component | Running Location | Description |
| :--- | :--- | :--- | :--- |
| **Embeddings** | `nomic-embed-text-v1.5` (768d) | Local (FastEmbed ONNX) | Fast CPU embeddings, RAM-safe batching |
| **Vector DB** | `Qdrant` | Local (Docker) | Vector database with HNSW indexing |
| **Keyword Index**| `BM25 Okapi` | Local (In-memory) | Sparse keyword matching |
| **Reranking** | `ms-marco-MiniLM-L-6-v2` | Local (FastEmbed Cross-Encoder) | Re-scores candidates for precision |
| **LLM Engine** | `LLaMA 3.3 70B` | Groq Cloud API | Generates medical answers |
| **History DB** | `MongoDB` | Local | Persists chat sessions & metadata |
| **Backends** | Python (FastAPI) + Node.js (Express) | Local | Core RAG pipeline + Chat managers |
| **Frontend** | React + Redux Toolkit + Tailwind | Local | Center-aligned Gemini-style chat |

---

## 📁 Repository Structure

```
medresearch-ai/
├── backend-python/               ← Core RAG Logic (FastAPI)
│   ├── data/documents/           ← Document drop zone (PDF, TXT, DOCX)
│   ├── scripts/
│   │   ├── index_documents.py    ← Recreate index script
│   │   └── add_documents.py      ← Incremental documents indexer
│   ├── src/
│   │   ├── api.py                ← RAG API endpoints (port 8000)
│   │   ├── chunker.py            ← Chunker with page tracking
│   │   ├── embedder.py           ← Local FastEmbed engine
│   │   ├── hybrid_search.py      ← Vector + BM25 + RRF
│   │   ├── reranker.py           ← Cross-encoder implementation
│   │   └── vector_store.py       ← Qdrant index configuration
│   └── requirements.txt
│
├── backend-node/                 ← API & Database Bridge (Express)
│   ├── src/
│   │   ├── models/Chat.js        ← MongoDB Chat model
│   │   ├── routes/research.js    ← Chat APIs & Python interface
│   │   └── server.js             ← Express app (port 5000)
│   └── package.json
│
└── frontend/                     ← Gemini-style UI (React)
    ├── src/
    │   ├── components/ChatBox.jsx ← Centered chat interface with markdown
    │   ├── pages/Research.jsx     ← Layout with collapsible history panel
    │   └── store/researchSlice.js ← Redux state for history & queries
    └── package.json
```

---

## ⚙️ Setup and Installation

### 1. Prerequisites
Ensure you have the following installed on your local Windows system:
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/) (For running Qdrant)
*   [MongoDB Community Server](https://www.mongodb.com/try/download/community) (For saving chat sessions locally)
*   [Python 3.10+](https://www.python.org/downloads/)
*   [Node.js 18+](https://nodejs.org/)

---

### 2. Startup Databases
Ensure Docker Desktop is open and run the following commands:

```powershell
# 1. Start Qdrant Container
docker run -d --name qdrant -p 6333:6333 -v "${PWD}/qdrant_storage:/qdrant/storage" qdrant/qdrant

# 2. Verify MongoDB is active
# Default local URI is mongodb://localhost:27017
Test-NetConnection -ComputerName 127.0.0.1 -Port 27017
```

---

### 3. Setup Python Backend
1. Navigate to the Python directory:
   ```powershell
   cd backend-python
   ```
2. Create and activate a virtual environment:
   ```powershell
   python -m venv venv
   venv\Scripts\activate
   ```
3. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```
4. Create a `.env` file containing your **Groq API Key**:
   ```env
   QDRANT_URL=http://localhost:6333
   COLLECTION_NAME=medresearch
   GROQ_API_KEY=your_groq_api_key_here
   GROQ_MODEL=llama-3.3-70b-versatile
   EMBED_MODEL=nomic-ai/nomic-embed-text-v1.5
   EMBED_BATCH_SIZE=32
   RERANKER_MODEL=Xenova/ms-marco-MiniLM-L-6-v2
   HYBRID_CANDIDATE_COUNT=20
   RERANKER_TOP_K=5
   ```

---

### 4. Setup Node Backend
1. Navigate to the Node directory:
   ```powershell
   cd ../backend-node
   ```
2. Install dependencies:
   ```powershell
   npm install
   ```
3. Create a `.env` file:
   ```env
   PORT=5000
   PYTHON_RAG_URL=http://localhost:8000
   MONGO_URI=mongodb://localhost:27017/medresearch
   JWT_SECRET=your_jwt_secret_here
   ```

---

### 5. Setup Frontend
1. Navigate to the frontend directory:
   ```powershell
   cd ../frontend
   ```
2. Install dependencies:
   ```powershell
   npm install
   ```

---

## 📈 Indexing Your Documents

### A. Incremental Mode (Recommended)
Automatically checks the database, finds only new documents in `backend-python/data/documents/`, embeds them, and appends them to your collection without recreating it.
```powershell
cd backend-python
venv\Scripts\activate
python scripts/add_documents.py
```

### B. Full Re-index Mode
Wipes the entire vector store clean and rebuilds all vectors from scratch.
```powershell
python scripts/index_documents.py
```

---

## 🚀 Running the Platform

Open **3 separate terminals** (keep databases running) and run:

### Terminal 1 — Python API
```powershell
cd backend-python
venv\Scripts\activate
uvicorn src.api:app --reload --port 8000
```

### Terminal 2 — Node.js Session Server
```powershell
cd backend-node
npm run dev
```

### Terminal 3 — Vite Frontend UI
```powershell
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 🔬 How the v2.0 RAG Pipeline Works

When you submit a question:
1.  **Local Query Embedding**: The question is embedded using Nomic-embed-text ONNX directly on your CPU.
2.  **Hybrid Retreival**:
    *   *Dense Search*: Queries Qdrant to find matching semantic vector chunks.
    *   *Sparse Search*: Queries the in-memory BM25 index for keyword matches.
    *   *Reciprocal Rank Fusion*: Merges both results into a unified score.
3.  **Cross-Encoder Reranking**: The top 20 candidate contexts are rescored using the cross-encoder model.
4.  **Guardrail Check**: If the best candidate score is below `-4.5`, the question is flagged as out of scope. The pipeline immediately short-circuits to `"Sorry, I am not trained for that purpose."` (No Groq API call is made, saving tokens).
5.  **Context Injection**: Top 5 context blocks are built into a structured clinical prompt and sent to Groq's high-speed LLaMA 3.3 70B model.
6.  **Formatting and Sources**: The response is rendered on the UI using Markdown parser, and references are returned under a dedicated sources container.

---

*Developed by Sohail · MedResearch AI v2.0*
