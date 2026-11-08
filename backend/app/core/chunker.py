from typing import List

def recursive_chunk(text: str, chunk_size: int = 300, chunk_overlap: int = 50) -> List[str]:
    """
    Recursive Chunker extracted directly from Week 8 Day 2 RAG Notebook.
    Splits text recursively using natural separators:
    1. Blank line / Paragraph ("\\n\\n")
    2. Line break ("\\n")
    3. Sentence boundary (". ")
    4. Word boundary (" ")
    
    Appends chunk_overlap from the subsequent chunk to prevent fact splits.
    """
    if not text or not text.strip():
        return []

    separators = ["\n\n", "\n", ". ", " "]

    def _split(t: str, seps: List[str]) -> List[str]:
        if len(t) <= chunk_size:
            return [t]
        if not seps:
            step = max(1, chunk_size - chunk_overlap)
            return [t[i:i + chunk_size] for i in range(0, len(t), step)]
        
        sep = seps[0]
        parts = t.split(sep)
        # keep the separator attached to each piece, except the last one
        pieces = [p + sep if i < len(parts) - 1 else p for i, p in enumerate(parts)]
        chunks, current = [], ""
        for piece in pieces:
            if len(current) + len(piece) <= chunk_size:
                current += piece
            else:
                if current:
                    chunks.append(current)
                if len(piece) > chunk_size:
                    chunks.extend(_split(piece, seps[1:]))
                    current = ""
                else:
                    current = piece
        if current:
            chunks.append(current)
        return chunks

    raw_chunks = [c.strip() for c in _split(text, separators) if c.strip()]
    if not raw_chunks:
        return []

    # Overlap: each chunk carries the first chunk_overlap characters of the next chunk
    out = []
    for i, c in enumerate(raw_chunks):
        if i < len(raw_chunks) - 1:
            out.append(c + " " + raw_chunks[i + 1][:chunk_overlap].strip())
        else:
            out.append(c)
    return out
