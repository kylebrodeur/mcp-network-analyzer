# Python Code Generation Template

## Language Requirements

- Use Python 3.8+ with type hints
- Use `requests` library for HTTP (standard, widely available)
- Follow PEP 8 style guide
- Include proper docstrings

## Structure

```python
#!/usr/bin/env python3
"""
Usage instructions as module docstring
Include: how to run, required args, environment variables
"""

import argparse
import json
import sys
import time
from typing import Dict, List, Optional, Any
import requests

# Configuration constants
BASE_URL = '...'
RETRY_COUNT = 3
RETRY_DELAY = 1.0  # seconds

def fetch_with_retry(url: str, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
    """Fetch data with retry logic."""
    # Implementation
    pass

def export_data(auth_token: Optional[str], output_path: str) -> None:
    """Main export function."""
    # Implementation
    pass

def main() -> int:
    parser = argparse.ArgumentParser(description='...')
    parser.add_argument('--auth', help='Authentication token')
    parser.add_argument('--output', required=True, help='Output file path')
    args = parser.parse_args()
    
    export_data(args.auth, args.output)
    return 0

if __name__ == '__main__':
    sys.exit(main())
```

## Required Features

- argparse for command-line arguments
- Type hints throughout
- Retry logic with exponential backoff
- Progress logging
- Exception handling
- Support for JSON/CSV output formats
