import { expect } from "chai";
import { ethers } from "hardhat";
import { OriginPosition } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("OriginPosition", function () {
  let originPosition: OriginPosition;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const OriginPosition = await ethers.getContractFactory("OriginPosition");
    originPosition = await OriginPosition.deploy();
    await originPosition.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await originPosition.owner()).to.equal(owner.address);
    });

    it("Should initialize position counter to 0", async function () {
      expect(await originPosition.positionCounter()).to.equal(0);
    });
  });

  describe("Position Creation", function () {
    it("Should create a position successfully", async function () {
      const token = "0x1234567890123456789012345678901234567890";
      const amount = ethers.parseEther("100");
      const threshold = ethers.parseEther("90");
      const actionType = "rebalance";
      const gasBudget = ethers.parseEther("0.1");

      await expect(
        originPosition.connect(user1).createPosition(
          token,
          amount,
          threshold,
          actionType,
          gasBudget
        )
      )
        .to.emit(originPosition, "PositionCreated")
        .withArgs(1, user1.address, token, amount, threshold, actionType, gasBudget);

      const position = await originPosition.getPosition(1);
      expect(position.owner).to.equal(user1.address);
      expect(position.token).to.equal(token);
      expect(position.amount).to.equal(amount);
      expect(position.threshold).to.equal(threshold);
      expect(position.active).to.be.true;
    });

    it("Should increment position counter", async function () {
      const token = "0x1234567890123456789012345678901234567890";
      const amount = ethers.parseEther("100");
      const threshold = ethers.parseEther("90");
      const actionType = "rebalance";
      const gasBudget = ethers.parseEther("0.1");

      await originPosition.connect(user1).createPosition(
        token,
        amount,
        threshold,
        actionType,
        gasBudget
      );

      expect(await originPosition.positionCounter()).to.equal(1);

      await originPosition.connect(user2).createPosition(
        token,
        amount,
        threshold,
        actionType,
        gasBudget
      );

      expect(await originPosition.positionCounter()).to.equal(2);
    });

    it("Should revert with invalid parameters", async function () {
      const token = ethers.ZeroAddress;
      const amount = ethers.parseEther("100");
      const threshold = ethers.parseEther("90");
      const actionType = "rebalance";
      const gasBudget = ethers.parseEther("0.1");

      await expect(
        originPosition.createPosition(token, amount, threshold, actionType, gasBudget)
      ).to.be.revertedWith("Invalid token address");

      const validToken = "0x1234567890123456789012345678901234567890";
      await expect(
        originPosition.createPosition(validToken, 0, threshold, actionType, gasBudget)
      ).to.be.revertedWith("Amount must be positive");

      await expect(
        originPosition.createPosition(validToken, amount, 0, actionType, gasBudget)
      ).to.be.revertedWith("Threshold must be positive");

      await expect(
        originPosition.createPosition(validToken, amount, threshold, actionType, 0)
      ).to.be.revertedWith("Gas budget must be positive");
    });
  });

  describe("Position Updates", function () {
    let positionId: number;

    beforeEach(async function () {
      const token = "0x1234567890123456789012345678901234567890";
      const amount = ethers.parseEther("100");
      const threshold = ethers.parseEther("90");
      const actionType = "rebalance";
      const gasBudget = ethers.parseEther("0.1");

      await originPosition.connect(user1).createPosition(
        token,
        amount,
        threshold,
        actionType,
        gasBudget
      );
      positionId = 1;
    });

    it("Should update position value and emit event", async function () {
      const currentValue = ethers.parseEther("85");
      const position = await originPosition.getPosition(positionId);

      await expect(
        originPosition.connect(user1).updatePositionValue(positionId, currentValue)
      )
        .to.emit(originPosition, "PositionUpdate")
        .withArgs(positionId, user1.address, currentValue, position.threshold, true);
    });

    it("Should detect threshold breach", async function () {
      const currentValue = ethers.parseEther("85"); // Below threshold of 90
      const position = await originPosition.getPosition(positionId);

      const tx = await originPosition.connect(user1).updatePositionValue(positionId, currentValue);
      const receipt = await tx.wait();

      const event = receipt?.logs.find((log: any) => {
        try {
          return originPosition.interface.parseLog(log)?.name === "PositionUpdate";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;
    });

    it("Should allow owner to update position", async function () {
      const currentValue = ethers.parseEther("95");

      await expect(
        originPosition.connect(owner).updatePositionValue(positionId, currentValue)
      ).to.not.be.reverted;
    });

    it("Should revert when unauthorized user tries to update", async function () {
      const currentValue = ethers.parseEther("95");

      await expect(
        originPosition.connect(user2).updatePositionValue(positionId, currentValue)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Position Closure", function () {
    it("Should close position successfully", async function () {
      const token = "0x1234567890123456789012345678901234567890";
      const amount = ethers.parseEther("100");
      const threshold = ethers.parseEther("90");
      const actionType = "rebalance";
      const gasBudget = ethers.parseEther("0.1");

      await originPosition.connect(user1).createPosition(
        token,
        amount,
        threshold,
        actionType,
        gasBudget
      );

      await expect(originPosition.connect(user1).closePosition(1))
        .to.emit(originPosition, "PositionClosed")
        .withArgs(1, user1.address);

      const position = await originPosition.getPosition(1);
      expect(position.active).to.be.false;
    });

    it("Should revert when non-owner tries to close", async function () {
      const token = "0x1234567890123456789012345678901234567890";
      const amount = ethers.parseEther("100");
      const threshold = ethers.parseEther("90");
      const actionType = "rebalance";
      const gasBudget = ethers.parseEther("0.1");

      await originPosition.connect(user1).createPosition(
        token,
        amount,
        threshold,
        actionType,
        gasBudget
      );

      await expect(
        originPosition.connect(user2).closePosition(1)
      ).to.be.revertedWith("Not position owner");
    });
  });

  describe("Pause/Unpause", function () {
    it("Should pause and unpause contract", async function () {
      await originPosition.pause();
      
      const token = "0x1234567890123456789012345678901234567890";
      const amount = ethers.parseEther("100");
      const threshold = ethers.parseEther("90");
      const actionType = "rebalance";
      const gasBudget = ethers.parseEther("0.1");

      await expect(
        originPosition.createPosition(token, amount, threshold, actionType, gasBudget)
      ).to.be.reverted;

      await originPosition.unpause();

      await expect(
        originPosition.createPosition(token, amount, threshold, actionType, gasBudget)
      ).to.not.be.reverted;
    });
  });
});