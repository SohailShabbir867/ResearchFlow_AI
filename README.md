# 🔬 ResearchFlow AI

**ResearchFlow AI** is an intelligent, multidisciplinary AI research assistant powered by a hybrid RAG (Retrieval-Augmented Generation) pipeline. Upload your documents and ask questions — it retrieves the most relevant passages from your knowledge base, enriches answers with live web intelligence, and synthesizes expert-level responses via Groq's LLM.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔀 **Hybrid Search** | BM25 keyword + BGE-base-v1.5 vector search fused with RRF |
| ♻️ **Live Web Fusion** | Parallel DuckDuckGo web search enriches every answer |
| 🧠 **Cross-Encoder Reranking** | ms-marco-MiniLM-L-6-v2 picks the best chunks |
| 💬 **Conversation Memory** | Context-aware follow-up questions |
| 📄 **Multi-format Docs** | Upload PDF, DOCX, TXT, MD |
| 🎨 **Answer Styles** | short / technical / detailed / code |
| 🔒 **Auth & RBAC** | JWT auth, email verification, admin role |
| 🌙 **Dark Mode** | Full light/dark theme support |

---

## 🏗️ Architecture

```
Frontend (React + Redux)
    │
    ├── REST (auth, chat history, docs)  →  Node.js Backend (Express + MongoDB)
    │                                           │
    └── SSE streaming (AI responses)   →       └── Proxies to Python RAG service
                                                            │
                                                            ├── Qdrant (vector DB)
                                                            ├── BGE-base embedder (ONNX)
                                                            ├── BM25 index (rank_bm25)
                                                            ├── Cross-encoder reranker
                                                            ├── DuckDuckGo web search
                                                            └── Groq LLM (AsyncGroq)
```

---

## 🗂️ Project Structure

```
medresearch-ai/
├── frontend/                         # React + Vite SPA
│   ├── src/
│   │   ├── pages/                    # Research, Login, SignUp, Admin pages
│   │   ├── components/layout/        # Sidebar, AdminSidebar
│   │   ├── store/                    # Redux slices (auth, research)
│   │   └── context/ThemeContext.jsx  # Dark/light mode
│   └── index.html
├── backend-node/                     # Express API server
│   ├── src/
│   │   ├── server.js                 # Entry point, MongoDB connection
│   │   ├── routes/                   # auth.js, research.js
│   │   ├── models/                   # User, Chat, Document, Notification
│   │   └── utils/email.js            # Email notifications
│   └── package.json
├── backend-python/                   # FastAPI RAG service
│   ├── src/
│   │   ├── api.py                    # FastAPI endpoints
│   │   ├── rag_pipeline.py           # Core RAG logic, system prompts, intent classifier
│   │   ├── vector_store.py           # Qdrant client (singleton)
│   │   ├── hybrid_search.py          # BM25 + vector hybrid search
│   │   ├── embedder.py               # BGE-base-v1.5 (ONNX, cached)
│   │   ├── reranker.py               # Cross-encoder reranker
│   │   ├── chunker.py                # Semantic document chunking
│   │   └── web_search.py             # DuckDuckGo search
│   ├── scripts/
│   │   ├── index_documents.py        # Full re-index script
│   │   └── add_documents.py          # Incremental add documents
│   └── requirements.txt
├── docker-compose.yml                # Qdrant + MongoDB services
└── README.md
```

---

## 🚀 Quick Start

### 1. Prerequisites

- Node.js ≥ 18
- Python ≥ 3.10
- Docker Desktop (for Qdrant + MongoDB)

### 2. Start services

```bash
docker-compose up -d
```

### 3. Backend Node

```bash
cd backend-node
npm install
cp .env.example .env  # Fill in MONGO_URI, GROQ_API_KEY, JWT_SECRET, etc.
node src/server.js
```

### 4. Backend Python

```bash
cd backend-python
pip install -r requirements.txt
cp .env.example .env  # Fill in GROQ_API_KEY, QDRANT_URL
uvicorn src.api:app --reload --port 8000
```

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🔧 Environment Variables

### backend-node/.env
```env
MONGO_URI=mongodb://localhost:27017/researchflow
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173
PYTHON_RAG_URL=http://localhost:8000
EMAIL_USER=your@gmail.com
EMAIL_APP_PASSWORD=your_app_password
EMAIL_FROM=your@gmail.com
```

### backend-python/.env
```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
QDRANT_URL=http://localhost:6333
COLLECTION_NAME=researchflow
```

---

## 📚 Indexing Documents

Place PDFs, DOCXs, TXTs, or MD files in `backend-python/data/documents/`, then run:

```bash
cd backend-python
python scripts/index_documents.py
```

To add documents incrementally without re-indexing everything:

```bash
python scripts/add_documents.py
```

---

## 📡 API Endpoints (Python RAG)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Service status & config |
| GET | `/documents` | List indexed documents |
| POST | `/query` | Synchronous RAG query |
| POST | `/stream` | Streaming SSE RAG query |
| POST | `/upload` | Upload & index a document |
| DELETE | `/documents/{source}` | Remove a document |
| GET | `/settings` | Get runtime thresholds |
| POST | `/settings` | Update runtime thresholds |
| POST | `/rebuild-index` | Rebuild BM25 keyword index |

---

## 🧑‍💻 Tech Stack

**Frontend**: React 18, Redux Toolkit, Vite, Lucide Icons, Tailwind CSS  
**Backend Node**: Express 4, Mongoose, Nodemailer, JWT  
**Backend Python**: FastAPI, Groq (AsyncGroq), Qdrant, rank-bm25, sentence-transformers, cross-encoders  
**Infrastructure**: Docker, MongoDB 7, Qdrant

---

<sub>Maintained with ❤️ by **Sohail Shabbir** · ResearchFlow AI v1.1</sub>
