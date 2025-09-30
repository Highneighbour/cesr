import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const REACTIVE_MAINNET_RPC = process.env.REACTIVE_MAINNET_RPC || "https://kopli-rpc.rkt.ink";
const LASNA_TESTNET_RPC = process.env.LASNA_TESTNET_RPC || "https://lasna-rpc.rkt.ink";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    "reactive-mainnet": {
      url: REACTIVE_MAINNET_RPC,
      chainId: 1597,
      accounts: [PRIVATE_KEY],
      gasPrice: 1000000000,
    },
    "lasna-testnet": {
      url: LASNA_TESTNET_RPC,
      chainId: 3441006,
      accounts: [PRIVATE_KEY],
      gasPrice: 1000000000,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      "reactive-mainnet": ETHERSCAN_API_KEY,
      "lasna-testnet": ETHERSCAN_API_KEY,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./tests",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;