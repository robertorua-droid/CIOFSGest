#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
const result = spawnSync('bash', ['tools/run-domain-tests.sh'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
