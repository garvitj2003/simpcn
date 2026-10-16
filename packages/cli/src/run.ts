import pc from 'picocolors';
import { renderPlan, renderMigrationSummary, renderResult } from './output.js';
import path from 'node:path';
import { loadEnvironment } from './environment.js';
import { initializeProject, type InitOptions } from './init.js';
import { prepareMigration, checkRemotePlan, migrateProject, type StorageAdapter, type MigrationResult } from '@simpcn/core';
import { S3StorageAdapter, resolveS3Target } from '@simpcn/storage-s3';
import { HELP, parseArguments } from './args.js';
import { loadConfig, findConfig, type Config } from './config.js';
import { version } from './version.js';

export interface CliContext {
  cwd: string;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  signal?: AbortSignal;
  setup?: InitOptions;
  createAdapter?: (config: Config) => StorageAdapter & { close?: () => void };
}
export async function runCli(args: string[], context: CliContext): Promise<number> {
  let json = args.includes('--json');
  let phase: 'config' | 'execute' = 'config';
  let adapter: (StorageAdapter & { close?: () => void }) | undefined;
  const output = (value: unknown) => context.stdout(JSON.stringify(value, null, 2) + '\n');
  try {
    const { command, flags } = parseArguments(args);
    json = !!flags.json;
    if (flags.help || !command && !flags.version) { context.stdout(HELP); return 0; }
    if (flags.version) { context.stdout(`${version}\n`); return 0; }
    if (command === 'init') {
      const result = await initializeProject(flags, context.cwd, { ...context.setup, signal: context.signal });
      if (json) output({ command: 'init', success: true, ...result });
      else {
        context.stdout(`\n${pc.green('✓ Setup complete')}\n${pc.dim('Config:')} ${pc.bold(pc.cyan(result.config))}\n${pc.dim('Framework:')} ${pc.cyan(result.framework)}\n`);
        if (result.warnings.length) {
          context.stdout(`\n${pc.bold(pc.yellow('Finish configuration'))}\n`);
          for (const warning of result.warnings) {
            // Keep the instruction readable while highlighting fields and filenames.
            const highlighted = warning.replace(/storage\.endpoint|publicBaseUrl|simpcn\.config\.ts|@simpcn\/vite|simpcn\(\)/g,
              value => pc.bold(pc.cyan(value)));
            context.stdout(`  ${pc.yellow('›')} ${highlighted}\n`);
          }
        }
        context.stdout(`\n${pc.bold(pc.cyan('Next steps'))}\n  Add credentials to ${pc.bold(pc.cyan('.env.local'))}\n  ${pc.green('simpcn plan')}\n  ${pc.green('simpcn migrate')}\n\n`);
      }
      return 0;
    }
    const filename = flags.config ? path.resolve(context.cwd, flags.config) : await findConfig(context.cwd);
    await loadEnvironment(filename ? path.dirname(filename) : context.cwd);
    const config = await loadConfig(flags, context.cwd);
    const target = resolveS3Target(config.storage);
    phase = 'execute';
    if (!json) context.stderr(`\n${pc.bold(pc.cyan(`simpcn ${command}`))}${command === 'plan' ? pc.dim(' · dry run') : ''}\n${pc.dim(config.root)} → ${target.bucket}${target.prefix ? `/${target.prefix}` : ''}\n${pc.dim(target.service)}\n\n`);
    const options = { ...config, target, signal: context.signal };
    const makeAdapter = () => context.createAdapter ? context.createAdapter(config) : new S3StorageAdapter({
      ...config.storage, forcePathStyle: config.storage.provider === 'minio',
    });
    if (command === 'plan') {
      const prepared = await prepareMigration(options);
      const local = { added: prepared.diff.added.length, modified: prepared.diff.modified.length,
        unchanged: prepared.diff.unchanged.length, removed: prepared.diff.removed.length,
        proposedUploadBytes: [...prepared.diff.added, ...prepared.diff.modified.map(a => a.current)].reduce((n, a) => n + a.size, 0) };
      let remote;
      if (flags['check-remote']) {
        adapter = makeAdapter();
        remote = await checkRemotePlan(prepared.plan, { ...options, adapter, overwrite: flags.overwrite });
      }
      const success = !remote?.some(a => ['conflict', 'failed', 'cancelled'].includes(a.decision));
      const remoteUploadBytes = remote?.filter(a => a.decision === 'upload' || a.decision === 'replace').reduce((n, a) => n + a.action.asset.size, 0);
      if (json) output({ command, dryRun: true, success, target, summary: { ...local, remoteUploadBytes },
        actions: prepared.plan, remote });
      else {
        context.stdout(renderPlan(local, prepared.plan, remote, remoteUploadBytes));
      }
      return context.signal?.aborted ? 130 : success ? 0 : 1;
    }
    adapter = makeAdapter();
    const migrated = await migrateProject({ ...options, adapter, overwrite: flags.overwrite,
      onResult: json ? undefined : (result: MigrationResult) => {
        context.stderr(renderResult(result));
      } });
    const summary = { uploaded: 0, skipped: 0, removed: 0, failed: 0, cancelled: 0,
      replaced: 0, uploadedBytes: 0 };
    for (const result of migrated.report.results) {
      summary[result.status]++;
      if (result.replaced) summary.replaced++;
      if (result.status === 'uploaded') summary.uploadedBytes += result.action.asset.size;
    }
    if (json) output({ command, success: migrated.report.success, target, summary, results: migrated.report.results });
    else {
      context.stdout(renderMigrationSummary(summary, migrated.report.success));
    }
    return context.signal?.aborted ? 130 : migrated.report.success ? 0 : 1;
  } catch (error) {
    const cancelled = context.signal?.aborted || error instanceof Error && ['ExitPromptError', 'AbortPromptError'].includes(error.name);
    const code = cancelled ? 130 : phase === 'config' ? 2 : 1;
    const message = cancelled ? 'Setup cancelled.' : error instanceof Error ? error.message : 'Command failed';
    if (json) output({ success: false, error: message, exitCode: code });
    else context.stderr(`${pc.red('Error:')} ${message}\n`);
    return code;
  } finally { adapter?.close?.(); }
}
