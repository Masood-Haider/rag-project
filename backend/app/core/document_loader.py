import os
import pathlib
from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class LoadedDocument:
    filename: str
    text: str
    char_count: int
    filepath: pathlib.Path

def extract_text_from_pdf(pdf_path: pathlib.Path) -> str:
    """Extract text from PDF file using pypdf if available."""
    try:
        import pypdf
        reader = pypdf.PdfReader(str(pdf_path))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(pages).strip()
    except ImportError:
        # Fallback if pypdf is not installed
        try:
            with open(pdf_path, "rb") as f:
                content = f.read().decode("latin-1", errors="ignore")
                # Basic string extraction
                clean = "".join(c for c in content if c.isprintable() or c in "\n\r\t")
                return clean[:10000]
        except Exception:
            return ""
    except Exception as e:
        print(f"Error reading PDF {pdf_path}: {e}")
        return ""

def load_document(file_path: pathlib.Path) -> Optional[LoadedDocument]:
    """Read a single document and return its text."""
    if not file_path.is_file():
        return None

    ext = file_path.suffix.lower()
    text = ""

    try:
        if ext in [".txt", ".md", ".markdown", ".csv", ".json", ".py", ".html"]:
            try:
                text = file_path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                text = file_path.read_text(encoding="latin-1", errors="replace")
        elif ext == ".pdf":
            text = extract_text_from_pdf(file_path)
        else:
            # Try reading as text
            try:
                text = file_path.read_text(encoding="utf-8")
            except Exception:
                return None
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return None

    text = text.strip()
    if not text:
        return None

    return LoadedDocument(
        filename=file_path.name,
        text=text,
        char_count=len(text),
        filepath=file_path
    )

def load_corpus(corpus_dir: pathlib.Path) -> List[LoadedDocument]:
    """Scan the corpus directory and return all valid documents."""
    if not corpus_dir.exists():
        return []

    documents: List[LoadedDocument] = []
    # Avoid reading the README.md in corpus as a course doc unless user wants it
    ignore_files = {"README.md", ".gitkeep", ".DS_Store"}

    for p in sorted(corpus_dir.iterdir()):
        if p.is_file() and p.name not in ignore_files:
            doc = load_document(p)
            if doc:
                documents.append(doc)

    return documents

