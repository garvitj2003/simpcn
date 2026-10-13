#!/usr/bin/env node
import { runCli } from './run.js';

const controller = new AbortController();
const cancel = () => controller.abort();
process.on('SIGINT', cancel);
process.on('SIGTERM', cancel);
try {
  process.exitCode = await runCli(process.argv.slice(2), { cwd: process.cwd(), setup: { interactive: !!process.stdin.isTTY && !!process.stderr.isTTY },
    stdout: text => { process.stdout.write(text); }, stderr: text => { process.stderr.write(text); },
    signal: controller.signal });
} finally {
  process.removeListener('SIGINT', cancel);
  process.removeListener('SIGTERM', cancel);
}
