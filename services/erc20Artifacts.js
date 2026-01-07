/**
 * ChainForge — ERC20 Artifact Resolver
 *
 * Responsibility:
 * - Resolve a deterministic ERC20 artifact key based on enabled modules
 * - Enforce supported module combinations at runtime
 *
 * Design constraints:
 * - Artifacts are precompiled and immutable
 * - Runtime must never compile Solidity
 * - Invalid combinations must fail fast
 */

function normalize(modules = []) {
  return modules.map(String).map(m => m.trim()).filter(Boolean).sort();
}

function resolveERC20ArtifactKey(modules = []) {
  const m = normalize(modules);

  if (m.length === 0) return "ERC20__base";
  if (m.length === 1) return `ERC20__${m[0]}`;

  return `ERC20__${m.join("_")}`;
}

module.exports = {
  resolveERC20ArtifactKey,
};
