import { spawnSync } from "node:child_process";

// Force a standalone demo even when the dashboard contains an old API URL.
const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_DEMO_MODE: "true", NEXT_PUBLIC_API_URL: "" },
});
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
