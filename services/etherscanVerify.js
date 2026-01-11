/**
 * Etherscan Verification Service
 *
 * Deterministic, compiler-accurate contract verification using
 * Solidity Standard JSON input format.
 *
 * Supported:
 * - ERC20
 * - ERC721
 * - ERC1155
 * - All ChainForge module variants
 *
 * Design principles:
 * - Exact compiler reproduction
 * - Runtime-safe artifact consumption
 * - Explicit verification lifecycle
 * - Zero mutation of build artifacts
 * - Infrastructure-grade reliability
 */

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const ETHERSCAN_API = "https://api.etherscan.io/v2/api?chainid=11155111";

/* -------------------------------------------------------------
   Helpers
------------------------------------------------------------- */

const sleep = ms => new Promise(r => setTimeout(r, ms));

function isRetryable(msg = "") {
  const m = msg.toLowerCase();
  return (
    m.includes("unable to locate contractcode") ||
    m.includes("rate limit") ||
    m.includes("temporarily") ||
    m.includes("timeout") ||
    m.includes("try again")
  );
}

/* -------------------------------------------------------------
   Artifact helpers
------------------------------------------------------------- */

function loadArtifact(artifactKey) {
  const file = path.join(process.cwd(), "artifacts-precompiled", `${artifactKey}.json`);
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function loadVerifyPayload(artifactKey) {
  const file = path.join(process.cwd(), "artifacts-precompiled", `${artifactKey}.verify.json`);
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

/* -------------------------------------------------------------
   Constructor encoding
------------------------------------------------------------- */

function encodeConstructorArgs(artifactKey, args) {
  const artifact = loadArtifact(artifactKey);
  const ctor = artifact.abi.find(i => i.type === "constructor");

  if (!ctor || !ctor.inputs || ctor.inputs.length === 0) return "";

  const types = ctor.inputs.map(i => i.type);

  return ethers.AbiCoder.defaultAbiCoder()
    .encode(types, args)
    .replace("0x", "");
}

/* -------------------------------------------------------------
   Submit verification
------------------------------------------------------------- */

async function submitVerification({ address, artifactKey, constructorArgs }) {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) throw new Error("ETHERSCAN_API_KEY is not configured");

  const payload = loadVerifyPayload(artifactKey);
  const ctorHex = encodeConstructorArgs(artifactKey, constructorArgs);

  const contractFullName = `${payload.sourceName}:${payload.contractName}`;

  const compilerVersion = payload.compilerVersion.startsWith("v")
    ? payload.compilerVersion
    : `v${payload.compilerVersion}`;

  const form = new URLSearchParams({
    apikey: apiKey,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: address,
    sourceCode: JSON.stringify(payload.standardJsonInput),
    codeformat: "solidity-standard-json-input",
    contractname: contractFullName,
    compilerversion: compilerVersion,
    constructorArguments: ctorHex,
  });

  const res = await fetch(ETHERSCAN_API, { method: "POST", body: form }).then(r => r.json());

  console.log("[etherscan] submit:", res);

  if (res.status === "1") {
    return { ok: true, guid: res.result };
  }

  const msg = String(res.result || res.message || "Unknown error");

  if (msg.toLowerCase().includes("already verified")) {
    return { ok: true, alreadyVerified: true };
  }

  return {
    ok: false,
    retryable: isRetryable(msg),
    error: msg,
  };
}

/* -------------------------------------------------------------
   Status polling
------------------------------------------------------------- */

async function checkVerificationStatus(guid) {
  const apiKey = process.env.ETHERSCAN_API_KEY;

  const url =
    `${ETHERSCAN_API}` +
    `&apikey=${apiKey}` +
    `&module=contract&action=checkverifystatus&guid=${guid}`;

  const res = await fetch(url).then(r => r.json());

  console.log("[etherscan] status:", res);

  return res;
}

/* -------------------------------------------------------------
   High-level orchestrator (no logic break)
------------------------------------------------------------- */

async function verifyOnEtherscan({ address, artifactKey, constructorArgs }) {

  let submit;

  for (let i = 0; i < 5; i++) {
    submit = await submitVerification({ address, artifactKey, constructorArgs });

    if (submit.ok) break;

    if (!submit.retryable) {
      return { success: false, status: "failed", message: submit.error };
    }

    await sleep(10000 * (i + 1));
  }

  if (submit.alreadyVerified) {
    return { success: true, status: "verified", message: "Already verified" };
  }

  if (!submit.ok) {
    return { success: false, status: "retryable", message: submit.error };
  }

  const guid = submit.guid;

  const start = Date.now();

  while (Date.now() - start < 10 * 60 * 1000) {
    await sleep(10000);

    const res = await checkVerificationStatus(guid);
    const text = String(res.result || "").toLowerCase();

    if (text.includes("pass") && text.includes("verified")) {
      return { success: true, status: "verified", guid, message: res.result };
    }

    if (text.includes("pending")) continue;

    if (text.includes("already verified")) {
      return { success: true, status: "verified", guid, message: "Already verified" };
    }

    return { success: false, status: "failed", guid, message: res.result };
  }

  return {
    success: false,
    status: "pending",
    guid,
    message: "Verification still pending",
  };
}

/* -------------------------------------------------------------
   Exports
------------------------------------------------------------- */

module.exports = {
  verifyOnEtherscan,
  submitVerification,
  checkVerificationStatus,
};
