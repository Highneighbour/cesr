import { expect } from "chai";
import { ethers } from "hardhat";
import { ReactiveManager, OriginPosition, DestinationHandler } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Integration Tests - End-to-End Reactive Workflow", function () {
  let reactiveManager: ReactiveManager;
  let originPosition: OriginPosition;
  let destinationHandler: DestinationHandler;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    // Deploy all contracts
    const OriginPosition = await ethers.getContractFactory("OriginPosition");
    originPosition = await OriginPosition.deploy();
    await originPosition.waitForDeployment();

    const DestinationHandler = await ethers.getContractFactory("DestinationHandler");
    destinationHandler = await DestinationHandler.deploy(owner.address);
    await destinationHandler.waitForDeployment();

    const ReactiveManager = await ethers.getContractFactory("ReactiveManager");
    reactiveManager = await ReactiveManager.deploy(
      31337,
      await originPosition.getAddress(),
      31337,
      await destinationHandler.getAddress()
    );
    await reactiveManager.waitForDeployment();

    await destinationHandler.updateReactiveManager(await reactiveManager.getAddress());
  });

  describe("Complete Reactive Workflow", function () {
    it("Should execute full workflow: create position -> threshold breach -> reactive action -> destination execution", async function () {
      // Step 1: User creates position on origin chain
      const token = "0x1234567890123456789012345678901234567890";
      const amount = ethers.parseEther("100");
      const threshold = ethers.parseEther("90");
      const actionType = "rebalance";
      const gasBudget = ethers.parseEther("0.1");

      const createTx = await originPosition.connect(user1).createPosition(
        token,
        amount,
        threshold,
        actionType,
        gasBudget
      );
      await createTx.wait();

      const positionId = 1;
      const position = await originPosition.getPosition(positionId);
      expect(position.owner).to.equal(user1.address);
      expect(position.active).to.be.true;

      // Step 2: Position value drops below threshold
      const currentValue = ethers.parseEther("85");
      const updateTx = await originPosition.connect(user1).updatePositionValue(
        positionId,
        currentValue
      );
      const updateReceipt = await updateTx.wait();

      // Verify PositionUpdate event was emitted
      const updateEvent = updateReceipt?.logs.find((log: any) => {
        try {
          const parsed = originPosition.interface.parseLog(log);
          return parsed?.name === "PositionUpdate";
        } catch {
          return false;
        }
      });
      expect(updateEvent).to.not.be.undefined;

      // Step 3: Simulate ReactiveManager receiving the event
      const eventData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "bool"],
        [currentValue, threshold, true]
      );

      const POSITION_UPDATE_TOPIC = ethers.keccak256(
        ethers.toUtf8Bytes("PositionUpdate(uint256,address,uint256,uint256,bool)")
      );

      const reactTx = await reactiveManager.react(
        31337,
        await originPosition.getAddress(),
        BigInt(POSITION_UPDATE_TOPIC),
        BigInt(positionId),
        BigInt(user1.address),
        0,
        eventData,
        0,
        user1.address
      );
      const reactReceipt = await reactTx.wait();

      // Verify ReactiveActionTriggered event
      const reactEvent = reactReceipt?.logs.find((log: any) => {
        try {
          const parsed = reactiveManager.interface.parseLog(log);
          return parsed?.name === "ReactiveActionTriggered";
        } catch {
          return false;
        }
      });
      expect(reactEvent).to.not.be.undefined;

      // Verify Callback event was emitted
      const callbackEvent = reactReceipt?.logs.find((log: any) => {
        try {
          const parsed = reactiveManager.interface.parseLog(log);
          return parsed?.name === "Callback";
        } catch {
          return false;
        }
      });
      expect(callbackEvent).to.not.be.undefined;

      // Step 4: Verify execution was recorded
      const executionId = await reactiveManager.executionCounter();
      expect(executionId).to.equal(1);

      const execution = await reactiveManager.getExecution(executionId);
      expect(execution.positionId).to.equal(positionId);
      expect(execution.success).to.be.true;

      // Step 5: Execute rebalance on destination chain
      const rebalanceTx = await destinationHandler.executeRebalance(
        positionId,
        user1.address,
        currentValue,
        threshold
      );
      const rebalanceReceipt = await rebalanceTx.wait();

      // Verify RebalanceExecuted event
      const rebalanceEvent = rebalanceReceipt?.logs.find((log: any) => {
        try {
          const parsed = destinationHandler.interface.parseLog(log);
          return parsed?.name === "RebalanceExecuted";
        } catch {
          return false;
        }
      });
      expect(rebalanceEvent).to.not.be.undefined;

      // Verify destination execution was recorded
      const destExecutionId = await destinationHandler.executionCounter();
      expect(destExecutionId).to.equal(1);

      const destExecution = await destinationHandler.getExecution(destExecutionId);
      expect(destExecution.positionId).to.equal(positionId);
      expect(destExecution.owner).to.equal(user1.address);
      expect(destExecution.success).to.be.true;
    });

    it("Should handle multiple positions independently", async function () {
      const token = "0x1234567890123456789012345678901234567890";
      const amount = ethers.parseEther("100");
      const threshold = ethers.parseEther("90");
      const actionType = "rebalance";
      const gasBudget = ethers.parseEther("0.1");

      // Create two positions
      await originPosition.connect(user1).createPosition(
        token,
        amount,
        threshold,
        actionType,
        gasBudget
      );
      await originPosition.connect(user1).createPosition(
        token,
        amount,
        threshold,
        actionType,
        gasBudget
      );

      // Trigger both positions
      const currentValue = ethers.parseEther("85");
      await originPosition.connect(user1).updatePositionValue(1, currentValue);
      await originPosition.connect(user1).updatePositionValue(2, currentValue);

      const eventData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "bool"],
        [currentValue, threshold, true]
      );

      const POSITION_UPDATE_TOPIC = ethers.keccak256(
        ethers.toUtf8Bytes("PositionUpdate(uint256,address,uint256,uint256,bool)")
      );

      // Process both positions
      await reactiveManager.react(
        31337,
        await originPosition.getAddress(),
        BigInt(POSITION_UPDATE_TOPIC),
        1,
        BigInt(user1.address),
        0,
        eventData,
        0,
        user1.address
      );

      await reactiveManager.react(
        31337,
        await originPosition.getAddress(),
        BigInt(POSITION_UPDATE_TOPIC),
        2,
        BigInt(user1.address),
        0,
        eventData,
        0,
        user1.address
      );

      // Verify both were processed
      expect(await reactiveManager.processedPositions(1)).to.be.true;
      expect(await reactiveManager.processedPositions(2)).to.be.true;
      expect(await reactiveManager.executionCounter()).to.equal(2);
    });

    it("Should measure gas consumption for reactive workflow", async function () {
      const token = "0x1234567890123456789012345678901234567890";
      const amount = ethers.parseEther("100");
      const threshold = ethers.parseEther("90");
      const actionType = "rebalance";
      const gasBudget = ethers.parseEther("0.1");

      // Create position
      const createTx = await originPosition.connect(user1).createPosition(
        token,
        amount,
        threshold,
        actionType,
        gasBudget
      );
      const createReceipt = await createTx.wait();
      const createGas = createReceipt?.gasUsed || 0n;

      console.log(`      Gas used for createPosition: ${createGas.toString()}`);

      // Update position
      const currentValue = ethers.parseEther("85");
      const updateTx = await originPosition.connect(user1).updatePositionValue(1, currentValue);
      const updateReceipt = await updateTx.wait();
      const updateGas = updateReceipt?.gasUsed || 0n;

      console.log(`      Gas used for updatePositionValue: ${updateGas.toString()}`);

      // React
      const eventData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "bool"],
        [currentValue, threshold, true]
      );

      const POSITION_UPDATE_TOPIC = ethers.keccak256(
        ethers.toUtf8Bytes("PositionUpdate(uint256,address,uint256,uint256,bool)")
      );

      const reactTx = await reactiveManager.react(
        31337,
        await originPosition.getAddress(),
        BigInt(POSITION_UPDATE_TOPIC),
        1,
        BigInt(user1.address),
        0,
        eventData,
        0,
        user1.address
      );
      const reactReceipt = await reactTx.wait();
      const reactGas = reactReceipt?.gasUsed || 0n;

      console.log(`      Gas used for react: ${reactGas.toString()}`);

      // Execute rebalance
      const rebalanceTx = await destinationHandler.executeRebalance(
        1,
        user1.address,
        currentValue,
        threshold
      );
      const rebalanceReceipt = await rebalanceTx.wait();
      const rebalanceGas = rebalanceReceipt?.gasUsed || 0n;

      console.log(`      Gas used for executeRebalance: ${rebalanceGas.toString()}`);

      const totalGas = createGas + updateGas + reactGas + rebalanceGas;
      console.log(`      Total gas used: ${totalGas.toString()}`);

      expect(totalGas).to.be.greaterThan(0);
    });
  });
});