import { marked } from 'marked';
import type { AuditReport, Finding } from '../core/types.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function inlineMarkdown(value: string): string {
  return marked.parseInline(escapeHtml(value), { async: false });
}

function findingRow(finding: Finding): string {
  const location = `${finding.file}${finding.line ? `:${finding.line}` : ''}`;
  return `<tr>
    <td><span class="severity severity-${finding.severity}">${finding.severity}</span></td>
    <td><code>${escapeHtml(finding.code)}</code></td>
    <td><code>${escapeHtml(location)}</code></td>
    <td class="deduction">-${finding.deduction}</td>
    <td>${inlineMarkdown(finding.message)}<div class="repair">${inlineMarkdown(finding.suggestion)}</div></td>
  </tr>`;
}

export function reportAsHtml(report: AuditReport): string {
  const status = report.passed ? 'PASS' : 'FAIL';
  const findings =
    report.findings.length === 0
      ? '<div class="empty">No deductions. Every checked claim matched its evidence.</div>'
      : `<div class="table-wrap"><table>
          <thead><tr><th>Severity</th><th>Code</th><th>Location</th><th>Points</th><th>Finding and repair</th></tr></thead>
          <tbody>${report.findings.map(findingRow).join('')}</tbody>
        </table></div>`;
  const commands =
    report.commandResults.length === 0
      ? '<p class="muted">Command rehearsal was not enabled.</p>'
      : `<div class="command-grid">${report.commandResults
          .map(
            (result) => `<article class="command command-${result.status}">
              <div><span>${escapeHtml(result.section)}</span><strong>${escapeHtml(result.status)}</strong></div>
              <code>${escapeHtml(result.command)}</code>
              <small>README line ${result.line} · exit ${result.exitCode ?? '—'}</small>
            </article>`,
          )
          .join('')}</div>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>README Flightcheck · ${report.score}/${report.grade}</title>
  <style>
    :root{--bg:#07101d;--panel:#0d1a2b;--line:#223855;--text:#edf4ff;--muted:#91a7c3;--cyan:#5bd7d7;--green:#63dfa6;--amber:#ffc766;--red:#ff7f87;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    *{box-sizing:border-box}html{background:var(--bg);color:var(--text)}body{margin:0;min-width:320px;background:radial-gradient(circle at 85% 0,#143655 0,transparent 32rem),var(--bg)}
    a{color:var(--cyan)}code{font-family:"Cascadia Code","SFMono-Regular",Consolas,monospace}.skip{position:absolute;left:-9999px;top:1rem}.skip:focus{left:1rem;background:var(--cyan);color:#00151b;padding:.75rem 1rem;border-radius:.5rem;z-index:2}
    main{width:min(1180px,calc(100% - 2rem));margin:0 auto;padding:4rem 0 5rem}.eyebrow{margin:0 0 1rem;color:var(--cyan);font-size:.78rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
    .hero{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(17rem,.7fr);gap:1.25rem;align-items:stretch}.hero-copy,.score-card,.panel{background:linear-gradient(145deg,rgba(18,35,56,.96),rgba(9,22,38,.96));border:1px solid var(--line);border-radius:1.25rem;box-shadow:0 1.5rem 5rem rgba(0,0,0,.2)}
    .hero-copy{padding:clamp(1.5rem,4vw,3rem)}h1{margin:0;font-size:clamp(2.5rem,7vw,5.5rem);line-height:.92;letter-spacing:-.06em;max-width:11ch}.lede{max-width:62ch;color:var(--muted);font-size:1.05rem;line-height:1.7;margin:1.5rem 0 0}.meta{display:flex;flex-wrap:wrap;gap:.65rem;margin-top:1.5rem}.meta span{border:1px solid var(--line);border-radius:999px;color:var(--muted);padding:.45rem .7rem;font-size:.8rem}
    .score-card{padding:2rem;display:flex;flex-direction:column;justify-content:space-between}.status{font-weight:850;letter-spacing:.14em;color:${report.passed ? 'var(--green)' : 'var(--red)'}}.score{font-size:clamp(4rem,10vw,7rem);font-weight:850;letter-spacing:-.08em;line-height:1}.score small{font-size:.26em;color:var(--muted);letter-spacing:0}.grade{display:flex;justify-content:space-between;align-items:end}.grade strong{font-size:2rem}.grade span{color:var(--muted);font-size:.85rem}
    .evidence{display:grid;grid-template-columns:repeat(4,1fr);gap:.8rem;margin:1.25rem 0}.metric{padding:1rem;border:1px solid var(--line);border-radius:1rem;background:rgba(8,19,33,.7)}.metric strong{display:block;font-size:1.65rem}.metric span{color:var(--muted);font-size:.78rem}
    .panel{min-width:0;padding:clamp(1rem,3vw,2rem);margin-top:1.25rem}.panel-head{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1rem}.panel h2{margin:0;font-size:1.35rem}.panel-head p,.muted{color:var(--muted);margin:0}.meta span,footer{overflow-wrap:anywhere}.table-wrap{width:100%;max-width:100%;min-width:0;overflow-x:auto;border:1px solid var(--line);border-radius:.8rem}table{border-collapse:collapse;table-layout:fixed;width:100%}th,td{overflow-wrap:anywhere;text-align:left;padding:.9rem;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase}th:nth-child(1){width:12%}th:nth-child(2){width:20%}th:nth-child(3){width:20%}th:nth-child(4){width:10%}tbody tr:last-child td{border-bottom:0}.deduction{font-weight:800;color:var(--red)}.severity{display:inline-block;border-radius:999px;padding:.25rem .5rem;font-size:.7rem;font-weight:800;text-transform:uppercase}.severity-error{color:var(--red);background:#3a1720}.severity-warning{color:var(--amber);background:#352713}.severity-notice{color:var(--cyan);background:#123238}.repair{color:var(--muted);margin-top:.5rem}.repair::before{content:"Repair · ";color:var(--cyan);font-weight:700}.empty{padding:2rem;border:1px dashed #2e7b65;border-radius:.8rem;color:var(--green)}
    .command-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}.command{border:1px solid var(--line);border-left:3px solid var(--green);border-radius:.75rem;padding:1rem;background:#081625}.command-failed,.command-rejected,.command-timed-out{border-left-color:var(--red)}.command div{display:flex;justify-content:space-between;color:var(--muted);font-size:.75rem;text-transform:uppercase}.command code{display:block;overflow-wrap:anywhere;margin:.8rem 0}.command small{color:var(--muted)}
    footer{color:var(--muted);font-size:.78rem;margin-top:1.5rem;text-align:center}
  </style>
  <style>
    @media screen and (max-width: 760px) {
      main { padding-top: 1.5rem; }
      .hero, .command-grid { grid-template-columns: 1fr; }
      .evidence { grid-template-columns: repeat(2, 1fr); }
      .table-wrap { overflow-x: visible; }
      .table-wrap table,
      .table-wrap thead,
      .table-wrap tbody,
      .table-wrap tr,
      .table-wrap th,
      .table-wrap td { display: block !important; width: 100% !important; }
      .table-wrap thead { display: none !important; }
      .table-wrap tr { border-bottom: 1px solid var(--line); }
      .table-wrap td { border: 0; padding: .65rem; overflow-wrap: anywhere; }
      .table-wrap table { font-size: .78rem; }
    }
  </style>
</head>
<body>
  <a class="skip" href="#main-content">Skip to audit report</a>
  <main id="main-content">
    <section class="hero" aria-labelledby="report-title">
      <div class="hero-copy">
        <p class="eyebrow">Preflight evidence · schema ${report.schemaVersion}</p>
        <h1 id="report-title">README Flightcheck</h1>
        <p class="lede">A transparent audit of documented commands, repository references, screenshots, and first-screen claims. Every lost point maps to evidence and a repair.</p>
        <div class="meta"><span>${escapeHtml(report.source)}</span><span>${escapeHtml(report.generatedAt)}</span><span>v${escapeHtml(report.toolVersion)}</span></div>
      </div>
      <div class="score-card" aria-label="Audit score ${report.score} out of 100, grade ${report.grade}, ${status}">
        <span class="status">${status}</span>
        <div class="score">${report.score}<small>/100</small></div>
        <div class="grade"><span>flight grade</span><strong>${report.grade}</strong></div>
      </div>
    </section>
    <section class="evidence" aria-label="Evidence counts">
      <div class="metric"><strong>${report.evidence.commandsExecuted}/${report.evidence.commandsDiscovered}</strong><span>commands rehearsed</span></div>
      <div class="metric"><strong>${report.evidence.localReferencesChecked}</strong><span>local references</span></div>
      <div class="metric"><strong>${report.evidence.externalLinksChecked}</strong><span>external links</span></div>
      <div class="metric"><strong>${report.evidence.snapshotsCompared}</strong><span>snapshot comparisons</span></div>
    </section>
    <section class="panel" aria-labelledby="ledger-title">
      <div class="panel-head"><div><p class="eyebrow">Scoring</p><h2 id="ledger-title">Deduction ledger</h2></div><p>-${report.deductionTotal} points · ${report.summary.errors} errors · ${report.summary.warnings} warnings</p></div>
      ${findings}
    </section>
    <section class="panel" aria-labelledby="commands-title">
      <div class="panel-head"><div><p class="eyebrow">Execution</p><h2 id="commands-title">Command rehearsal</h2></div><p>Shell-free · temporary copy · redacted output</p></div>
      ${commands}
    </section>
    <footer>${escapeHtml(report.repository)} · generated locally by README Flightcheck</footer>
  </main>
</body>
</html>
`;
}
