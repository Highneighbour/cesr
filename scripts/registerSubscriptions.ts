import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Registering subscriptions for ReactiveManager...");
  
  // Load deployment output
  const outputPath = path.join(__dirname, "..", "deploy", "output.json");
  if (!fs.existsSync(outputPath)) {
    throw new Error("Deployment output not found. Run deploy script first.");
  }
  
  const deployOutput = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
  const reactiveManagerAddress = deployOutput.contracts.ReactiveManager;
  
  if (!reactiveManagerAddress) {
    throw new Error("ReactiveManager address not found in deployment output");
  }
  
  console.log(`ReactiveManager address: ${reactiveManagerAddress}`);
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  const ReactiveManager = await ethers.getContractFactory("ReactiveManager");
  const reactiveManager = ReactiveManager.attach(reactiveManagerAddress);
  
  console.log("\n📝 Registering position subscriptions...");
  const tx = await reactiveManager.registerPositionSubscriptions();
  const receipt = await tx.wait();
  
  console.log(`✅ Subscriptions registered successfully!`);
  console.log(`Transaction hash: ${tx.hash}`);
  console.log(`Gas used: ${receipt?.gasUsed.toString()}`);
  
  // Update deployment output
  deployOutput.transactions.push({
    contract: "ReactiveManager",
    action: "registerPositionSubscriptions",
    txHash: tx.hash,
    gasUsed: receipt?.gasUsed.toString(),
    timestamp: new Date().toISOString()
  });
  
  fs.writeFileSync(outputPath, JSON.stringify(deployOutput, null, 2));
  console.log(`\n💾 Updated deployment output: ${outputPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });