# Production RAG System (Retrieval-Augmented Generation)

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20+%20Vite-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![FAISS](https://img.shields.io/badge/Vector%20Store-Meta%20FAISS-0081FB.svg)](https://github.com/facebookresearch/faiss)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel%20Ready-000000.svg?logo=vercel&logoColor=white)](https://vercel.com/)

A full-stack, enterprise-ready Retrieval-Augmented Generation (RAG) platform extracted and evolved from the **Week 8 Day 2 Full RAG System** curriculum.

---

## 🌟 Key Features

1. **Recursive Chunking with Boundary Overlap:**  
   Intelligently slices text along paragraph (`\n\n`), newline (`\n`), sentence (`. `), and word boundaries, carrying forward a 50-character overlap to avoid cutting critical facts in half.

2. **FAISS Dense Vector Store:**  
   Uses Meta AI's FAISS (`IndexFlatIP`, exact search) with L2-normalized 384-dimensional dense vectors (`sentence-transformers/all-MiniLM-L6-v2`), guaranteeing 100% recall.

3. **Hybrid Search (Stretch Mode):**  
   Blends semantic cosine search with TF-IDF keyword search (via `scikit-learn`), excelling at exact terms, model numbers, and numerical metrics (like `0.991`).

4. **Honest Out-of-Domain Detection:**  
   Calculates similarity confidence scores and checks against the `0.40` threshold. If an answer cannot be grounded, it flags an out-of-domain warning to prevent hallucinations.

5. **Side-by-Side Comparison:**  
   Optionally generates both **WITH RAG** (grounded context with source citations) and **WITHOUT RAG** (plain prompting) to evaluate model grounding in real time.

6. **Dedicated Knowledge Base / Database Uploader:**  
   Drag-and-drop or drop files straight into `backend/data/corpus/`. Supports `.txt`, `.md`, `.pdf`, `.csv`, and `.json` with automated one-click FAISS re-indexing.

---

## 📁 Repository Structure

```
rag-project/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py             # REST API: /query, /upload, /reindex, /documents, /stats
│   │   ├── core/
│   │   │   ├── chunker.py            # Recursive chunker (extracted from Notebook)
│   │   │   ├── document_loader.py    # Multi-format doc reader (.txt, .md, .pdf)
│   │   │   ├── embeddings.py         # Embedding service (local transformer or HF API)
│   │   │   ├── vector_store.py       # FAISS IndexFlatIP vector database
│   │   │   ├── hybrid_retriever.py   # TF-IDF keyword + semantic hybrid search
│   │   │   └── rag_engine.py         # Grounded prompt builder & DeepSeek generator
│   │   ├── schemas/
│   │   │   └── models.py             # Pydantic models & validation
│   │   ├── config.py                 # Centralized settings & environment variables
│   │   └── main.py                   # FastAPI application & CORS
│   ├── data/
│   │   ├── corpus/                   # <--- DROP ALL YOUR DATABASE / KNOWLEDGE BASE FILES HERE
│   │   │   ├── README.md
│   │   │   └── sample_course_notes.txt
│   │   └── storage/                  # Persistent FAISS indices & metadata
│   ├── Dockerfile                    # Containerization for backend hosting
│   ├── requirements.txt              # Backend dependencies
│   ├── run.py                        # One-command backend launcher
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx            # Header & system health indicator
│   │   │   ├── ChatView.jsx          # Interactive grounded Q&A with citations & honest test
│   │   │   ├── DocumentManager.jsx   # Dedicated file upload & database manager
│   │   │   ├── ChunkInspector.jsx    # Visual similarity score & chunk inspector
│   │   │   └── SettingsModal.jsx     # Hyperparameters (k, threshold, hybrid mode, HF token)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   ├── vercel.json                   # Frontend Vercel configuration
│   └── .env.example
│
├── .gitignore
├── vercel.json                       # Root Vercel configuration
└── README.md
```

---

## 🔒 Access Control: Permanent vs Temporary Files

To keep your knowledge base clean and protected in public deployments:
- **Admin Password**: Set `ADMIN_PASSWORD` in `backend/.env`.
  - When unlocked via **Admin Login** in the web dashboard, uploaded documents are saved **permanently** into `backend/data/corpus/` and indexed for all users.
  - Only the administrator can delete permanent files.
- **Guest / Visitor Mode**:
  - Anyone visiting the site without the admin password gets an **isolated, temporary session**.
  - Any files they upload are sandboxed exclusively to their browser session.
  - Other users **cannot** see, search, or access guest files.
  - When the visitor leaves or closes the tab, their temporary files are automatically wiped cleanly from the server.

---

## 🚀 Quickstart Guide

### 1. Backend Setup (FastAPI + Groq)

```bash
# Navigate to backend
cd backend

# Install dependencies
pip install -r requirements.txt

# Configure your free Groq API Key
cp .env.example .env
# Edit .env and set: GROQ_API_KEY=gsk_...

# Run the server
python run.py
```
> The API will be available at: **http://localhost:8000**  
> Interactive OpenAPI documentation at: **http://localhost:8000/docs**

---

### 2. Frontend Setup (React + Vite)

```bash
# Navigate to frontend
cd frontend

# Install packages
npm install

# Start development server
npm run dev
```
> The frontend UI will be live at: **http://localhost:5173**

---

## ⚡ Groq Free Tier Integration

This system is configured to use Groq's high-speed free tier:
- **Default Model**: `qwen/qwen3.8-27b` (Ultra-fast, zero cost)
- **Supported Free Models**: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `allam-2-7b`, `llama-3.3-70b-versatile`
- **Latency**: Sub-second responses with streaming/grounding.
- **Key Security**: `GROQ_API_KEY` is loaded from `backend/.env` and is strictly ignored in `.gitignore` so your key is never pushed to GitHub.

---

## 🌐 Deploying to Vercel & Cloud

### Frontend Deployment (Vercel)
1. Push this repository to GitHub:
   ```bash
   git add .
   git commit -m "feat: complete RAG system with FastAPI and React"
   git push origin main
   ```
2. Go to [Vercel Dashboard](https://vercel.com/new).
3. Import your GitHub repository (`rag-project`).
4. Set **Root Directory** to `frontend` (or leave default since the root `vercel.json` handles monorepo build).
5. In **Environment Variables**, set:
   - `VITE_API_URL` = `https://your-backend-service.onrender.com/api` (URL of your deployed FastAPI backend).
6. Click **Deploy**!

### Backend Deployment (Render / Railway / Fly.io / Docker)
FastAPI and FAISS can be deployed with one click using the included `Dockerfile` on:
- **Render.com** (Free Web Service with Docker runtime)
- **Railway.app** (Deploy from GitHub repo)
- **Hugging Face Spaces** (Docker space)

Set the following environment variable in your backend hosting:
- `HF_TOKEN` = Your Hugging Face access token

---

## ⚙️ Configuration & Hyperparameters

| Variable | Default | Description |
|---|---|---|
| `HF_TOKEN` | `""` | Hugging Face token for DeepSeek and API embeddings |
| `LLM_MODEL` | `deepseek-ai/DeepSeek-V3-0324` | Model used for grounded generation |
| `DEFAULT_CHUNK_SIZE` | `300` | Target character size per chunk |
| `DEFAULT_CHUNK_OVERLAP`| `50` | Overlap between adjacent chunks |
| `DEFAULT_K` | `5` | Top-k chunks retrieved per query |
| `SIMILARITY_THRESHOLD` | `0.40` | Notebook honest test out-of-domain threshold |

---

## 📚 Notebook to Production Mapping

| Notebook Cell | Production File |
|---|---|
| Cell 6 (`recursive_chunk`) | `backend/app/core/chunker.py` |
| Cell 10 (`embed`) | `backend/app/core/embeddings.py` |
| Cell 12-13 (`faiss.IndexFlatIP`) | `backend/app/core/vector_store.py` |
| Cell 15 (`retrieve` & `k`) | `backend/app/core/rag_engine.py` |
| Cell 20 (`build_prompt`) | `backend/app/core/rag_engine.py` |
| Cell 22 (DeepSeek Inference) | `backend/app/core/rag_engine.py` |
| Cell 24 (Honest Test `0.40`) | `backend/app/core/rag_engine.py` & `ChatView.jsx` |
| Cell 26 (Hybrid TF-IDF Search) | `backend/app/core/hybrid_retriever.py` |

---

## 📜 License
MIT License. Created for the RAG curriculum and portfolio deployment.

