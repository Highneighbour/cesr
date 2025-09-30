import { expect } from "chai";
import { ethers } from "hardhat";
import { ReactiveManager, OriginPosition, DestinationHandler } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ReactiveManager", function () {
  let reactiveManager: ReactiveManager;
  let originPosition: OriginPosition;
  let destinationHandler: DestinationHandler;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    // Deploy OriginPosition
    const OriginPosition = await ethers.getContractFactory("OriginPosition");
    originPosition = await OriginPosition.deploy();
    await originPosition.waitForDeployment();

    // Deploy DestinationHandler with temporary address
    const DestinationHandler = await ethers.getContractFactory("DestinationHandler");
    destinationHandler = await DestinationHandler.deploy(owner.address);
    await destinationHandler.waitForDeployment();

    // Deploy ReactiveManager
    const originChainId = 31337;
    const destinationChainId = 31337;
    const ReactiveManager = await ethers.getContractFactory("ReactiveManager");
    reactiveManager = await ReactiveManager.deploy(
      originChainId,
      await originPosition.getAddress(),
      destinationChainId,
      await destinationHandler.getAddress()
    );
    await reactiveManager.waitForDeployment();

    // Update DestinationHandler with ReactiveManager address
    await destinationHandler.updateReactiveManager(await reactiveManager.getAddress());
  });

  describe("Deployment", function () {
    it("Should set correct origin and destination addresses", async function () {
      expect(await reactiveManager.originContract()).to.equal(await originPosition.getAddress());
      expect(await reactiveManager.destinationHandler()).to.equal(await destinationHandler.getAddress());
    });

    it("Should set correct chain IDs", async function () {
      expect(await reactiveManager.originChainId()).to.equal(31337);
      expect(await reactiveManager.destinationChainId()).to.equal(31337);
    });
  });

  describe("Subscription Registration", function () {
    it("Should register position subscriptions", async function () {
      await expect(reactiveManager.registerPositionSubscriptions())
        .to.emit(reactiveManager, "SubscriptionsRegistered")
        .withArgs(2);
    });

    it("Should only allow owner to register subscriptions", async function () {
      await expect(
        reactiveManager.connect(user1).registerPositionSubscriptions()
      ).to.be.reverted;
    });
  });

  describe("React Function", function () {
    it("Should process PositionUpdate event", async function () {
      const positionId = 1;
      const ownerAddress = user1.address;
      const currentValue = ethers.parseEther("85");
      const threshold = ethers.parseEther("90");
      const shouldTrigger = true;

      // Encode event data
      const eventData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "bool"],
        [currentValue, threshold, shouldTrigger]
      );

      const POSITION_UPDATE_TOPIC = ethers.keccak256(
        ethers.toUtf8Bytes("PositionUpdate(uint256,address,uint256,uint256,bool)")
      );

      // Simulate react call
      await expect(
        reactiveManager.react(
          31337, // chain_id
          await originPosition.getAddress(), // contract
          BigInt(POSITION_UPDATE_TOPIC), // topic_0
          BigInt(positionId), // topic_1 (positionId)
          BigInt(ownerAddress), // topic_2 (owner)
          0, // topic_3
          eventData, // data
          0, // origin_vm_index
          ownerAddress // sender
        )
      )
        .to.emit(reactiveManager, "ReactiveActionTriggered");
    });

    it("Should only process position once", async function () {
      const positionId = 1;
      const ownerAddress = user1.address;
      const currentValue = ethers.parseEther("85");
      const threshold = ethers.parseEther("90");
      const shouldTrigger = true;

      const eventData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "bool"],
        [currentValue, threshold, shouldTrigger]
      );

      const POSITION_UPDATE_TOPIC = ethers.keccak256(
        ethers.toUtf8Bytes("PositionUpdate(uint256,address,uint256,uint256,bool)")
      );

      // First call should trigger
      await reactiveManager.react(
        31337,
        await originPosition.getAddress(),
        BigInt(POSITION_UPDATE_TOPIC),
        BigInt(positionId),
        BigInt(ownerAddress),
        0,
        eventData,
        0,
        ownerAddress
      );

      expect(await reactiveManager.processedPositions(positionId)).to.be.true;

      // Second call should not trigger (already processed)
      await expect(
        reactiveManager.react(
          31337,
          await originPosition.getAddress(),
          BigInt(POSITION_UPDATE_TOPIC),
          BigInt(positionId),
          BigInt(ownerAddress),
          0,
          eventData,
          0,
          ownerAddress
        )
      ).to.not.emit(reactiveManager, "ReactiveActionTriggered");
    });

    it("Should handle PositionCreated event", async function () {
      const positionId = 1;
      const ownerAddress = user1.address;
      const tokenAddress = "0x1234567890123456789012345678901234567890";
      
      const eventData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "string", "uint256"],
        [ethers.parseEther("100"), ethers.parseEther("90"), "rebalance", ethers.parseEther("0.1")]
      );

      const POSITION_CREATED_TOPIC = ethers.keccak256(
        ethers.toUtf8Bytes("PositionCreated(uint256,address,address,uint256,uint256,string,uint256)")
      );

      await expect(
        reactiveManager.react(
          31337,
          await originPosition.getAddress(),
          BigInt(POSITION_CREATED_TOPIC),
          BigInt(positionId),
          BigInt(ownerAddress),
          BigInt(tokenAddress),
          eventData,
          0,
          ownerAddress
        )
      )
        .to.emit(reactiveManager, "PositionProcessed")
        .withArgs(positionId, ownerAddress, "rebalance");
    });
  });

  describe("Administrative Functions", function () {
    it("Should update destination handler", async function () {
      const newHandler = user1.address;
      const newChainId = 999;

      await reactiveManager.updateDestinationHandler(newChainId, newHandler);

      expect(await reactiveManager.destinationHandler()).to.equal(newHandler);
      expect(await reactiveManager.destinationChainId()).to.equal(newChainId);
    });

    it("Should reset position processing status", async function () {
      const positionId = 1;
      
      // Process position first
      const eventData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "bool"],
        [ethers.parseEther("85"), ethers.parseEther("90"), true]
      );

      const POSITION_UPDATE_TOPIC = ethers.keccak256(
        ethers.toUtf8Bytes("PositionUpdate(uint256,address,uint256,uint256,bool)")
      );

      await reactiveManager.react(
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

      expect(await reactiveManager.processedPositions(positionId)).to.be.true;

      // Reset
      await reactiveManager.resetPosition(positionId);
      expect(await reactiveManager.processedPositions(positionId)).to.be.false;
    });

    it("Should pause and unpause", async function () {
      await reactiveManager.pause();

      const eventData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "bool"],
        [ethers.parseEther("85"), ethers.parseEther("90"), true]
      );

      const POSITION_UPDATE_TOPIC = ethers.keccak256(
        ethers.toUtf8Bytes("PositionUpdate(uint256,address,uint256,uint256,bool)")
      );

      await expect(
        reactiveManager.react(
          31337,
          await originPosition.getAddress(),
          BigInt(POSITION_UPDATE_TOPIC),
          1,
          BigInt(user1.address),
          0,
          eventData,
          0,
          user1.address
        )
      ).to.be.reverted;

      await reactiveManager.unpause();

      await expect(
        reactiveManager.react(
          31337,
          await originPosition.getAddress(),
          BigInt(POSITION_UPDATE_TOPIC),
          1,
          BigInt(user1.address),
          0,
          eventData,
          0,
          user1.address
        )
      ).to.not.be.reverted;
    });
  });
});