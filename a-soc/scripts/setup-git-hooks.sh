#!/bin/bash
set -euo pipefail

# A-SOC Git Hooks Setup
# Installs pre-commit hooks for secret scanning and code quality

HOOKS_DIR=".git/hooks"

echo "=== Installing git hooks ==="

# Pre-commit hook
cat > "$HOOKS_DIR/pre-commit" << 'HOOK'
#!/bin/bash
set -euo pipefail

echo "=== Pre-commit checks ==="

# Check for secrets
if command -v gitleaks &> /dev/null; then
    gitleaks detect --source . --verbose --no-git
elif command -v detect-secrets &> /dev/null; then
    detect-secrets scan --all-files
else
    echo "Warning: No secret scanner installed (gitleaks or detect-secrets)"
fi

# Check for unstaged debug statements
FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.py$' || true)
if [ -n "$FILES" ]; then
    if echo "$FILES" | xargs grep -l 'import pdb\|pdb.set_trace\|breakpoint()\|print(' 2>/dev/null; then
        echo "Error: Debug statements found. Remove pdb/breakpoint/print before committing."
        exit 1
    fi
fi
HOOK
chmod +x "$HOOKS_DIR/pre-commit"

echo "=== Git hooks installed ==="
