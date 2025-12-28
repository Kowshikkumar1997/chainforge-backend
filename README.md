# ChainForge Backend

ChainForge is a backend-first blockchain infrastructure platform designed to generate, deploy, and manage standard token contracts in a deterministic and auditable way.

The system abstracts common Solidity deployment workflows into a structured backend service, enabling repeatable contract generation, public network deployment, and post-deployment interaction without requiring users to directly manage Solidity code or deployment tooling.

---

## Overview

Deploying production-grade token contracts typically requires Solidity expertise, manual configuration, and repeated deployment steps. This creates operational friction and deployment risk for early-stage teams that need reliable and reproducible blockchain infrastructure.

ChainForge addresses this by providing a backend system that programmatically generates standard token contracts (ERC20, ERC721, ERC1155), deploys them to a public blockchain, and persists deployment metadata as an auditable record.

The platform treats contract deployment as an operational event rather than a one-off script, ensuring traceability and reproducibility across deployments.

---

## Intended Users

ChainForge is intended for developers, technical founders, and early-stage teams who require reliable blockchain primitives without maintaining custom Solidity codebases.

The platform is infrastructure-focused and designed to be consumed programmatically via APIs rather than as a consumer-facing application.

---

## Supported Standards

- ERC20 (fungible tokens)
- ERC721 (non-fungible tokens)
- ERC1155 (multi-token standard)

All contracts are generated using deterministic templates and deployed using a controlled Hardhat execution environment.

---

## Architecture Overview

The backend is composed of four primary layers:

1. **Contract Generation**
   - Programmatic generation of Solidity contracts based on token type and configuration
   - Uses standardized templates with optional feature modules
   - Outputs versioned Solidity files

2. **Deployment Orchestration**
   - Deployments are executed via a spawned Hardhat runtime
   - Supports public blockchain networks (currently Sepolia)
   - Deployment results are emitted in a machine-readable format

3. **Runtime Interaction**
   - Post-deployment interactions (minting, balance queries) are handled via `ethers.js`
   - Interacts directly with deployed contracts using RPC providers
   - Does not depend on the Hardhat runtime for runtime operations

4. **Deployment Metadata Persistence**
   - Each deployment is recorded with:
     - Network
     - Contract address
     - Deployer address
     - Transaction hash
     - Timestamp
     - Verification status
   - This provides an auditable deployment history and traceability

---

## API Capabilities

The backend exposes a REST API that supports:

- Token contract generation and deployment
- Minting operations for ERC721 and ERC1155 tokens
- Balance queries for deployed contracts
- Deployment history retrieval

All interactions are performed against publicly deployed contracts on the target network.

---

## Network Support

- **Sepolia Test Network** (current)

All deployments use real transactions and gas, and are publicly verifiable via blockchain explorers.

---

## Security and Design Principles

- Clear separation between deployment-time and runtime responsibilities
- No dynamic contract mutation after deployment
- Deterministic contract generation
- Explicit environment configuration via environment variables
- Minimal surface area for runtime interactions

---

## Non-Financial Disclaimer

ChainForge is a technical infrastructure platform and does not provide financial, investment, brokerage, or advisory services.

The platform does not facilitate fundraising, token sales, or speculative activity. All generated contracts are standard technical primitives intended for development and infrastructure use.

---

## Current Status

ChainForge is an active development platform with multiple ERC20, ERC721, and ERC1155 contracts deployed and interacted with on the Sepolia test network.

The current focus is on backend stability, auditability, and infrastructure correctness rather than feature expansion.

---

## License

MIT
