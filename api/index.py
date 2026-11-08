import os
import sys
from pathlib import Path

# Add root and backend to python path for Vercel Serverless
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"

if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app

# Export app for Vercel Python runtime
handler = app

