// testGenerate.js (project root)
const path = require('path');
const fs = require('fs');
const { generateERC20Contract, generateERC721Contract, generateERC1155Contract } = require('./utils/generateSolidityContract');

const genDir = path.join(__dirname, 'generated_contracts');
if (!fs.existsSync(genDir)) fs.mkdirSync(genDir);

console.log('Generating sample contracts...');

const erc20 = generateERC20Contract({
  tokenName: 'TestToken',
  tokenSymbol: 'TTK',
  initialSupply: 1000,
  modules: ['burnable'] // burnable supported safely
});
console.log('Generated ERC20 files:', erc20);

const erc721 = generateERC721Contract({
  tokenName: 'TestNFT',
  tokenSymbol: 'TNFT',
});
console.log('Generated ERC721 files:', erc721);

const erc1155 = generateERC1155Contract({
  tokenName: 'TestMultiToken',
  baseURI: 'https://token-cdn-domain/{id}.json'
});
console.log('Generated ERC1155 files:', erc1155);

console.log('Done — generated_contracts now contains the .sol files.');
