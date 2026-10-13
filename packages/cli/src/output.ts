import pc from 'picocolors';
import type { MigrationAction, MigrationResult, RemotePlanAction } from '@simpcn/core';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${Number(value.toFixed(1))} ${units[unit]}`;
}

function label(value: string): string {
  const color = ['upload', 'uploaded'].includes(value) ? pc.green
    : ['replace', 'replaced', 'removed', 'cancelled'].includes(value) ? pc.yellow
    : ['conflict', 'failed'].includes(value) ? pc.red : pc.dim;
  return color(value.padEnd(10));
}

function row(status: string, key: string, detail?: string): string {
  return `  ${label(status)} ${key}${detail ? `\n             ${detail}` : ''}\n`;
}

function counts(values: [number, string, (value: string) => string][]): string {
  return values.filter(([count]) => count > 0).map(([count, name, color]) => color(`${count} ${name}`)).join(pc.dim(' · '));
}

export function renderPlan(local: { added: number; modified: number; unchanged: number; removed: number; proposedUploadBytes: number },
  actions: MigrationAction[], remote?: RemotePlanAction[], remoteUploadBytes?: number): string {
  const summary = counts([[local.added, 'added', pc.green], [local.modified, 'modified', pc.yellow],
    [local.unchanged, 'unchanged', pc.dim], [local.removed, 'removed locally', pc.yellow]]);
  let text = `${pc.bold('Local')}  ${summary || pc.dim('No assets')}\n`;
  if (remote) {
    const total = (decision: RemotePlanAction['decision']) => remote.filter(a => a.decision === decision).length;
    text += `${pc.bold('Remote')} ${counts([[total('upload'), 'upload', pc.green], [total('replace'), 'replace', pc.yellow],
      [total('skip'), 'matched', pc.dim], [total('report-removed'), 'removed locally', pc.yellow],
      [total('conflict'), 'conflict', pc.red], [total('failed'), 'failed', pc.red],
      [total('cancelled'), 'cancelled', pc.yellow]]) || pc.dim('No assets')}\n`;
    text += `${pc.dim('Proposed transfer')} ${formatBytes(remoteUploadBytes ?? 0)}\n\n`;
    for (const action of remote) {
      if (action.decision === 'skip') continue;
      const issue = ['conflict', 'failed', 'cancelled'].includes(action.decision);
      text += row(action.decision === 'report-removed' ? 'removed' : action.decision, action.key, issue ? action.reason : undefined);
    }
  } else {
    text += `${pc.dim('Proposed transfer')} ${formatBytes(local.proposedUploadBytes)}\n\n`;
    for (const action of actions) {
      if (action.type !== 'skip') text += row(action.type === 'report-removed' ? 'removed' : action.type, action.asset.relativePath);
    }
    text += `${pc.dim('Remote unchecked · run simpcn plan --check-remote')}\n`;
  }
  if (local.removed) text += `${pc.dim('Removed locally; remote objects are kept.')}\n`;
  if (remote ? remote.some(a => a.decision === 'replace') : local.modified > 0) {
    text += `${pc.yellow('Replacing existing keys requires CDN cache review.')}\n`;
  }
  return text + `${pc.dim('Dry run · no changes made.')}\n`;
}

export function renderResult(result: MigrationResult): string {
  // Successful unchanged objects are counted once in the final summary.
  if (result.status === 'skipped') return '';
  return row(result.replaced && result.status === 'uploaded' ? 'replaced' : result.status, result.key, result.error);
}

export function renderMigrationSummary(summary: { uploaded: number; skipped: number; removed: number; failed: number;
  cancelled: number; replaced: number; uploadedBytes: number }, success: boolean): string {
  const status = success ? pc.green('✓ Migration complete') : summary.failed ? pc.red('✗ Migration incomplete') : pc.yellow('Migration cancelled');
  let text = `\n${pc.bold(status)}\n${counts([[summary.uploaded, 'uploaded', pc.green], [summary.skipped, 'skipped', pc.dim],
    [summary.removed, 'removed locally', pc.yellow], [summary.failed, 'failed', pc.red], [summary.cancelled, 'cancelled', pc.yellow]]) || pc.dim('No assets')} · ${formatBytes(summary.uploadedBytes)} uploaded\n`;
  if (summary.removed) text += `${pc.dim('Remote objects are kept.')}\n`;
  if (summary.replaced) text += `${pc.yellow(`${summary.replaced} existing keys replaced; review CDN caches.`)}\n`;
  return text;
}
