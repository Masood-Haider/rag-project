# RAG Database / Corpus Directory

Place all your knowledge base documents in this directory. 
The RAG system reads and indexes every supported document found here.

### Supported File Formats:
- **Plain Text (`.txt`)**
- **Markdown (`.md`)**
- **PDF Documents (`.pdf`)**
- **JSON / CSV (`.json`, `.csv`)**

### How to use:
1. **Direct Copy/Paste:** Simply drop your files (e.g. `my_notes.txt`, `company_docs.pdf`) directly into this folder:
   `backend/data/corpus/`
2. **Via Web Dashboard:** You can also drag and drop your files directly through the React web interface at the **"Knowledge Base Documents"** tab.
3. **Re-Index:** Click **"Rebuild Index"** in the UI or call `POST /api/reindex` to chunk, embed, and store your documents into FAISS!
