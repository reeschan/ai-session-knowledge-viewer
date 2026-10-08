process.loadEnvFile(".env.local");

import { listLogs } from "../lib/logs";

async function main() {
  const logs = await listLogs();
  console.log(`count: ${logs.length}`);
  const first = logs.slice(0, 3).map(({ finalResponse: _finalResponse, ...rest }) => rest);
  console.log(JSON.stringify(first, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
