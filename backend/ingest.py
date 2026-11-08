"""
CLI Document Ingestion Utility for RAG System.

Usage:
    python ingest.py                    # Ingests and indexes all files in backend/data/corpus
    python ingest.py path/to/document.pdf # Copies file into corpus and re-indexes
    python ingest.py path/to/folder/      # Copies all docs from folder into corpus and re-indexes
"""

import sys
import os
import shutil
import pathlib
import time

# Ensure backend directory is in path
backend_dir = pathlib.Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import settings
from app.core.document_loader import load_corpus
from app.core.rag_engine import rag_engine
from app.core.vector_store import vector_store

def ingest_from_source(source_path: str = None):
    print("=" * 65)
    print("  RAG System Knowledge Base Ingestion Utility")
    print("=" * 65)

    corpus_dir = settings.CORPUS_DIR
    corpus_dir.mkdir(parents=True, exist_ok=True)

    if source_path:
        src = pathlib.Path(source_path).resolve()
        if not src.exists():
            print(f"[Error]: Source path '{src}' does not exist.")
            sys.exit(1)

        if src.is_file():
            dest = corpus_dir / src.name
            shutil.copy2(src, dest)
            print(f"[Copied File]: {src.name} -> {corpus_dir}")
        elif src.is_dir():
            count = 0
            for item in src.iterdir():
                if item.is_file() and item.suffix.lower() in [".txt", ".md", ".pdf", ".csv", ".json"]:
                    shutil.copy2(item, corpus_dir / item.name)
                    count += 1
            print(f"[Copied Folder]: {count} files copied from {src} -> {corpus_dir}")

    # Inspect corpus
    docs = load_corpus(corpus_dir)
    print(f"\nScanning Corpus Directory: {corpus_dir}")
    print(f"Found {len(docs)} valid documents for ingestion:")
    for d in docs:
        print(f"  - {d.filename:<30} ({d.char_count:,} characters)")

    if not docs:
        print("\n[Warning]: No documents found in corpus directory. Add files to backend/data/corpus/")
        return

    # Trigger indexing
    print("\nStarting Recursive Chunking & FAISS Vector Indexing...")
    start_time = time.time()
    result = rag_engine.reindex_all()
    elapsed = time.time() - start_time

    print(f"\n[Result]: {result.get('message')}")
    print(f"Total Documents : {result.get('total_docs')}")
    print(f"Total Chunks    : {result.get('total_chunks')}")
    print(f"Vector Dimension: {result.get('dimension', 384)}")
    print(f"Storage File    : {vector_store.index_file}")
    print(f"Time Taken      : {elapsed:.2f} seconds")

    # Run quick verification search
    print("\n" + "-" * 65)
    print("Running Verification Retrieval Test...")
    test_hits = rag_engine.retrieve_chunks("What is precision?", k=2)
    if test_hits:
        print(f"Test Query: 'What is precision?'")
        print(f"Top Hit Score: {test_hits[0]['score']:.3f} | Source: {test_hits[0]['source']}")
        print(f"Snippet: {test_hits[0]['chunk'][:120]}...")
        print("[SUCCESS]: Vector store is loaded, active, and verified!")
    print("=" * 65)

if __name__ == "__main__":
    src_arg = sys.argv[1] if len(sys.argv) > 1 else None
    ingest_from_source(src_arg)
