import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

export interface SnapshotOptions {
  baselinePath?: string;
  maxDiffRatio?: number;
  outputPath: string;
  threshold?: number;
  timeoutMs?: number;
  url: string;
}

export interface SnapshotResult {
  baselinePath?: string;
  diffPixels: number;
  diffRatio: number;
  dimensionsMatch: boolean;
  matches: boolean;
  outputPath: string;
  url: string;
}

function validateSnapshotUrl(value: string): URL {
  const url = new URL(value);
  if (!['file:', 'http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Unsupported snapshot protocol: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new Error('Snapshot URL must not contain credentials.');
  }
  return url;
}

export async function captureSnapshot(options: SnapshotOptions): Promise<SnapshotResult> {
  const url = validateSnapshotUrl(options.url);
  const threshold = options.threshold ?? 0.1;
  const maxDiffRatio = options.maxDiffRatio ?? 0.005;
  await mkdir(path.dirname(path.resolve(options.outputPath)), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      colorScheme: 'light',
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
      viewport: { height: 900, width: 1440 },
    });
    await page.goto(url.toString(), {
      timeout: options.timeoutMs ?? 30_000,
      waitUntil: 'networkidle',
    });
    await page.addStyleTag({
      content:
        '*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}',
    });
    await page.evaluate(async () => document.fonts.ready);
    const latestBuffer = await page.screenshot({
      animations: 'disabled',
      fullPage: true,
      path: options.outputPath,
      type: 'png',
    });

    if (!options.baselinePath) {
      return {
        diffPixels: 0,
        diffRatio: 0,
        dimensionsMatch: true,
        matches: true,
        outputPath: options.outputPath,
        url: url.toString(),
      };
    }

    const baseline = PNG.sync.read(await readFile(options.baselinePath));
    const latest = PNG.sync.read(latestBuffer);
    if (baseline.width !== latest.width || baseline.height !== latest.height) {
      return {
        baselinePath: options.baselinePath,
        diffPixels: Math.max(baseline.width * baseline.height, latest.width * latest.height),
        diffRatio: 1,
        dimensionsMatch: false,
        matches: false,
        outputPath: options.outputPath,
        url: url.toString(),
      };
    }

    const diff = new PNG({ height: latest.height, width: latest.width });
    const diffPixels = pixelmatch(
      baseline.data,
      latest.data,
      diff.data,
      latest.width,
      latest.height,
      { threshold },
    );
    const diffRatio = diffPixels / (latest.width * latest.height);
    return {
      baselinePath: options.baselinePath,
      diffPixels,
      diffRatio,
      dimensionsMatch: true,
      matches: diffRatio <= maxDiffRatio,
      outputPath: options.outputPath,
      url: url.toString(),
    };
  } finally {
    await browser.close();
  }
}
