import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

import { buildDigest } from "../lib/digest";

const USAGE = "Usage: npm run digest -- --period daily|weekly [--now <ISO datetime>]";

function fail(message: string): never {
  console.error(`${message}\n${USAGE}`);
  process.exit(1);
}

function option(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const period = option(argv, "--period");
  if (period !== "daily" && period !== "weekly") fail("--period must be daily or weekly");

  const nowArg = option(argv, "--now");
  const now = nowArg === undefined ? new Date() : new Date(nowArg);
  if (argv.includes("--now") && (nowArg === undefined || Number.isNaN(now.getTime()))) fail("--now must be a valid date");

  process.stdout.write(await buildDigest({ period, now }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
