import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

# Suppress deprecation warnings during tests
os.environ["PYTHONWARNINGS"] = "ignore::DeprecationWarning"

# Set test environment variables
os.environ["WS_API_TOKEN"] = "test-token"
os.environ["HMAC_SECRET"] = "test-hmac-secret-for-integration-tests"
