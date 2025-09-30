import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Starting deployment...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with account: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);
  
  const network = await ethers.provider.getNetwork();
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  
  const deployOutput: any = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {},
    transactions: []
  };
  
  // Deploy OriginPosition contract
  console.log("\n📝 Deploying OriginPosition...");
  const OriginPosition = await ethers.getContractFactory("OriginPosition");
  const originPosition = await OriginPosition.deploy();
  await originPosition.waitForDeployment();
  const originPositionAddress = await originPosition.getAddress();
  console.log(`✅ OriginPosition deployed to: ${originPositionAddress}`);
  
  deployOutput.contracts.OriginPosition = originPositionAddress;
  deployOutput.transactions.push({
    contract: "OriginPosition",
    txHash: originPosition.deploymentTransaction()?.hash,
    address: originPositionAddress
  });
  
  // Deploy DestinationHandler contract (placeholder reactive manager address)
  console.log("\n📝 Deploying DestinationHandler...");
  const tempReactiveManager = deployer.address; // Will be updated after ReactiveManager deployment
  const DestinationHandler = await ethers.getContractFactory("DestinationHandler");
  const destinationHandler = await DestinationHandler.deploy(tempReactiveManager);
  await destinationHandler.waitForDeployment();
  const destinationHandlerAddress = await destinationHandler.getAddress();
  console.log(`✅ DestinationHandler deployed to: ${destinationHandlerAddress}`);
  
  deployOutput.contracts.DestinationHandler = destinationHandlerAddress;
  deployOutput.transactions.push({
    contract: "DestinationHandler",
    txHash: destinationHandler.deploymentTransaction()?.hash,
    address: destinationHandlerAddress
  });
  
  // Deploy ReactiveManager contract
  console.log("\n📝 Deploying ReactiveManager...");
  
  // Configuration for reactive manager
  const ORIGIN_CHAIN_ID = network.chainId; // Same chain for demo, change for cross-chain
  const DESTINATION_CHAIN_ID = network.chainId; // Same chain for demo
  
  const ReactiveManager = await ethers.getContractFactory("ReactiveManager");
  const reactiveManager = await ReactiveManager.deploy(
    ORIGIN_CHAIN_ID,
    originPositionAddress,
    DESTINATION_CHAIN_ID,
    destinationHandlerAddress
  );
  await reactiveManager.waitForDeployment();
  const reactiveManagerAddress = await reactiveManager.getAddress();
  console.log(`✅ ReactiveManager deployed to: ${reactiveManagerAddress}`);
  
  deployOutput.contracts.ReactiveManager = reactiveManagerAddress;
  deployOutput.transactions.push({
    contract: "ReactiveManager",
    txHash: reactiveManager.deploymentTransaction()?.hash,
    address: reactiveManagerAddress
  });
  
  // Update DestinationHandler with correct ReactiveManager address
  console.log("\n📝 Updating DestinationHandler with ReactiveManager address...");
  const updateTx = await destinationHandler.updateReactiveManager(reactiveManagerAddress);
  await updateTx.wait();
  console.log(`✅ DestinationHandler updated. Tx: ${updateTx.hash}`);
  
  deployOutput.transactions.push({
    contract: "DestinationHandler",
    action: "updateReactiveManager",
    txHash: updateTx.hash
  });
  
  // Register subscriptions
  console.log("\n📝 Registering position subscriptions...");
  try {
    const subTx = await reactiveManager.registerPositionSubscriptions();
    await subTx.wait();
    console.log(`✅ Subscriptions registered. Tx: ${subTx.hash}`);
    
    deployOutput.transactions.push({
      contract: "ReactiveManager",
      action: "registerPositionSubscriptions",
      txHash: subTx.hash
    });
  } catch (error: any) {
    console.warn(`⚠️  Subscription registration failed (may need Reactive Network): ${error.message}`);
  }
  
  // Save deployment output
  const outputDir = path.join(__dirname, "..", "deploy");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, "output.json");
  fs.writeFileSync(outputPath, JSON.stringify(deployOutput, null, 2));
  console.log(`\n💾 Deployment output saved to: ${outputPath}`);
  
  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`Network:              ${network.name} (${network.chainId})`);
  console.log(`Deployer:             ${deployer.address}`);
  console.log(`OriginPosition:       ${originPositionAddress}`);
  console.log(`DestinationHandler:   ${destinationHandlerAddress}`);
  console.log(`ReactiveManager:      ${reactiveManagerAddress}`);
  console.log("=".repeat(60));
  console.log("\n✨ Deployment completed successfully!");
  console.log("\n📝 Next steps:");
  console.log("1. Update frontend/.env with contract addresses");
  console.log("2. Fund ReactiveManager with REACT tokens for gas");
  console.log("3. Test position creation and reactive workflow");
  console.log("4. Update Supabase with contract addresses");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });