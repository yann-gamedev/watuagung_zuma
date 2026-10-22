import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}
function forbidden(path) {
  const parts = path.toLowerCase().split("/");
  return parts.at(-1) === "claude.md" || parts.includes(".claude");
}
function checkPaths(output, context) {
  const paths = output.split("\0").filter((path) => path && forbidden(path));
  if (paths.length) throw new Error(`${context}:\n${paths.map((path) => `  ${JSON.stringify(path)}`).join("\n")}`);
}

try {
  const remote = process.argv[2];
  const knownRemote = git("remote").split(/\r?\n/).includes(remote);
  for (const line of readFileSync(0, "utf8").trim().split(/\r?\n/).filter(Boolean)) {
    const [, localSha, , remoteSha] = line.split(/\s+/);
    if (!/^[0-9a-f]{40,64}$/.test(localSha ?? "") || !/^[0-9a-f]{40,64}$/.test(remoteSha ?? "")) {
      throw new Error("Invalid pre-push input.");
    }
    if (/^0+$/.test(localSha)) continue; // Deleting a remote ref sends no files.
    // Fail closed for refs that do not point to a commit (including raw blob tags).
    const tip = git("rev-parse", "--verify", `${localSha}^{commit}`).trim();
    checkPaths(git("ls-tree", "-r", "--name-only", "-z", tip), "Forbidden files in pushed tree");
    const range = /^0+$/.test(remoteSha)
      ? [tip, ...(knownRemote ? [`--not`, `--remotes=${remote}`] : [])]
      : [`${remoteSha}..${tip}`];
    // Also catch files added then deleted before the tip; inspect merges against every parent.
    for (const commit of git("rev-list", ...range).trim().split(/\r?\n/).filter(Boolean)) {
      checkPaths(git("diff-tree", "--root", "-m", "--no-commit-id", "--no-renames", "--name-only", "-r", "-z", "--diff-filter=ACMT", commit), `Forbidden change in commit ${commit}`);
    }
  }
} catch (error) {
  console.error(`Push blocked: ${error.message}\nCLAUDE.md and .claude/ must stay local. Remove them from Git tracking; keep local copies.\nPreviously published history is not rewritten by this guard.`);
  process.exitCode = 1;
}
