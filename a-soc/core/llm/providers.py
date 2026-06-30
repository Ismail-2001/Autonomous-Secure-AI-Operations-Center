import sys

import src.asoc.llm.providers as _real

sys.modules[__name__] = _real
