#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

fs.writeFileSync(
  path.join(__dirname, '..', 'dist', 'cli.cjs'),
  `#!/usr/bin/env node

import('./esm/cli.js');
`
);
