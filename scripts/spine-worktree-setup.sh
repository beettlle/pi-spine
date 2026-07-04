#!/bin/bash
set -euo pipefail
# Establish stet baseline once per lane at pre-worker HEAD; persist ref for contract verify.
stet start HEAD --allow-dirty --quiet
node -e "
const fs = require('fs');
const session = JSON.parse(fs.readFileSync('.review/session.json', 'utf8'));
fs.writeFileSync('.review/spine-stet-baseline.ref', session.baseline_ref + '\n');
"
echo '{"ok":true}'
