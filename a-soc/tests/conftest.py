import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

# Suppress deprecation warnings during tests
os.environ["PYTHONWARNINGS"] = "ignore::DeprecationWarning"
