#!/bin/bash
set -euo pipefail
# Establish stet baseline once per lane at pre-worker HEAD
stet start HEAD --allow-dirty --quiet
echo '{"ok":true}'
