import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, copyFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const guard = resolve("scripts/check-private-files.mjs");
const dir = mkdtempSync(join(tmpdir(), "private-files-test-"));
const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const commit = () => { git("add", "."); git("commit", "-qm", "fixture"); return git("rev-parse", "HEAD"); };
const put = (name) => { mkdirSync(join(dir, name, ".."), { recursive: true }); writeFileSync(join(dir, name), "fixture\n"); };
const zero = "0".repeat(40);
const run = (tip, base, expected) => {
  const result = spawnSync(process.execPath, [guard, "origin"], {
    cwd: dir, encoding: "utf8", input: `refs/heads/test ${tip} refs/heads/test ${base}\n`,
  });
  assert.equal(result.status, expected, result.stderr);
};
try {
  git("init", "-q"); git("config", "user.name", "Test"); git("config", "user.email", "test@example.invalid");
  git("config", "commit.gpgsign", "false"); git("config", "core.hooksPath", "disabled-hooks");
  put("README.md"); const initial = commit();
  git("remote", "add", "origin", "https://example.invalid/test.git");
  git("update-ref", "refs/remotes/origin/main", initial);
  put("PRODUCT.md"); put("nested/README.md"); const safe = commit();
  run(safe, initial, 0); run(safe, zero, 0);
  for (const name of ["CLAUDE.md", "backend/claude.MD", "nested/.ClAuDe/settings.json", "nested/.claude/private file.txt"]) {
    git("reset", "--hard", safe); put(name); const bad = commit();
    run(bad, safe, 1); run(bad, zero, 1);
    git("rm", "--", name); const removed = commit();
    run(removed, safe, 1); // Add then delete is still blocked in outgoing history.
    run(removed, bad, 0); // Cleaning up an already-published file is allowed.
  }
  run(zero, safe, 0);
  // Existing forbidden files are caught even if the new commit only changes an allowed file.
  git("reset", "--hard", safe); put("CLAUDE.md"); const oldBad = commit();
  put("another.md"); run(commit(), oldBad, 1);
  // Exercise the actual Git hook without contacting any remote.
  mkdirSync(join(dir, ".githooks")); mkdirSync(join(dir, "scripts"));
  copyFileSync(resolve(".githooks/pre-push"), join(dir, ".githooks/pre-push"));
  copyFileSync(guard, join(dir, "scripts/check-private-files.mjs"));
  chmodSync(join(dir, ".githooks/pre-push"), 0o755);
  git("config", "core.hooksPath", ".githooks");
  const input = join(dir, "hook-input");
  writeFileSync(input, `refs/heads/test ${git("rev-parse", "HEAD")} refs/heads/test ${oldBad}\n`);
  const hook = spawnSync("git", ["hook", "run", "--to-stdin", input, "pre-push", "--", "origin"], { cwd: dir, encoding: "utf8" });
  assert.notEqual(hook.status, 0);
  assert.match(hook.stderr, /Push blocked/);
  console.log("PASS: allowed Markdown, nested/case variants, new branches, outgoing history, cleanup, ref deletion.");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
