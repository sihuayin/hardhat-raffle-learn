import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import { ignition, ethers  }from "hardhat"
import { assert, expect } from "chai"
import { Raffle, VRFCoordinatorV2Mock } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Random Number Consumer Unit Tests", async function () {
  let raffle: Raffle
  let raffleEntranceFee: number
  let interval: number
  let vrfCoordinatorV2Mock: unknown
  async function deployAutomationCounterFixture() {
    const [deployer] = await ethers.getSigners()
    const BASE_FEE = "1000000000000000" // 0.001 ether as base fee
    const GAS_PRICE = "50000000000" // 50 gwei 
    const WEI_PER_UNIT_LINK = "10000000000000000" // 0.01 ether per LINK


    const VRFCoordinatorV2_5MockFactory = await ethers.getContractFactory(
      "VRFCoordinatorV2_5Mock"
    )
    const VRFCoordinatorV2_5Mock = await VRFCoordinatorV2_5MockFactory.deploy(
        BASE_FEE,
        GAS_PRICE,
        WEI_PER_UNIT_LINK
    )

    const fundAmount = "100000000000000000000"
    const transaction = await VRFCoordinatorV2_5Mock.createSubscription()
    const transactionReceipt = await transaction.wait(1)
    const subscriptionId = transactionReceipt!.logs[0].args[0];

    await VRFCoordinatorV2_5Mock.fundSubscription(subscriptionId, fundAmount)

    const vrfCoordinatorAddress = await VRFCoordinatorV2_5Mock.getAddress()
    console.log('subscriptionId', subscriptionId)
    const raffleFactory = await ethers.getContractFactory("Raffle")
    const raffle = await raffleFactory
    .connect(deployer)
        .deploy(
          vrfCoordinatorAddress,
          subscriptionId,
          '0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c',
          30,
          10000n,
          100000,)

  await VRFCoordinatorV2_5Mock.addConsumer(subscriptionId, await raffle.getAddress())
  const raffleEntranceFee = await raffle.getEntranceFee()
  const interval = await raffle.getInterval()

    return { raffle, raffleEntranceFee, interval, VRFCoordinatorV2_5Mock, raffleFactory }
  }

  beforeEach(async () => {
    const object = await helpers.loadFixture(
      deployAutomationCounterFixture
    )
    raffle = object.raffle;
    raffleEntranceFee = Number(object.raffleEntranceFee);
    interval = Number(object.interval);
    vrfCoordinatorV2Mock = object.VRFCoordinatorV2_5Mock
  })

  describe("constructor", function() {
    it("intitiallizes the raffle correctly", async () => {
        const raffleState = (await raffle.getRaffleState()).toString()
        assert.equal(raffleState, "0")
        assert.equal(
            interval.toString(),
            "30"
        )
    })
  })

  describe("enterRaffle", function() {
    it("reverts when you don't pay enough", async () => {
      await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
        raffle,
          "Raffle__SendMoreToEnterRaffle"
      )
    })


    it("emits event on enter", async () => {
      await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
          raffle,
          "RaffleEnter"
      )
    })

    it("doesn't allow entrance when raffle is calculating", async () => {
      await raffle.enterRaffle({ value: raffleEntranceFee })
      // 指定链的时间
      // await network.provider.send("evm_increaseTime", [interval + 1])
      await helpers.time.increase(Number(interval) + 1);
      // await network.provider.request({ method: "evm_mine", params: [] })
      // 增加区块的产生数量
      await helpers.mine();
      // we pretend to be a keeper for a second
      await raffle.performUpkeep("0x")
      await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWithCustomError(
        raffle,
          "Raffle__RaffleNotOpen"
      )
    })
  })

  describe("checkUpkeep", function() {
    it("returns false if people haven't sent any ETH", async () => {
      // await network.provider.send("evm_increaseTime", [interval + 1])
      await helpers.time.increase(Number(interval) + 1);
      // await network.provider.request({ method: "evm_mine", params: [] })
      // 增加区块的产生数量
      await helpers.mine();
      const { upkeepNeeded } = await raffle.checkUpkeep("0x")
      assert(!upkeepNeeded)
    })

    it("returns false if raffle isn't open", async () => {
      await raffle.enterRaffle({ value: raffleEntranceFee })
      await helpers.time.increase(Number(interval) + 1);
      // await network.provider.request({ method: "evm_mine", params: [] })
      // 增加区块的产生数量
      await helpers.mine();
      await raffle.performUpkeep("0x")
      const raffleState = await raffle.getRaffleState()
      const { upkeepNeeded } = await raffle.checkUpkeep("0x")
      assert.equal(raffleState.toString() == "1", upkeepNeeded == false)
    })

    it("returns false if enough time hasn't passed", async () => {
      await raffle.enterRaffle({ value: raffleEntranceFee })
      await helpers.time.increase(Number(interval) - 10);
      // await network.provider.request({ method: "evm_mine", params: [] })
      // 增加区块的产生数量
      // await helpers.mine();
      const { upkeepNeeded } = await raffle.checkUpkeep("0x")
      assert.equal(upkeepNeeded, false)
    })

    it("returns true if enough time has passed, has players, eth, and is open", async () => {
      await raffle.enterRaffle({ value: raffleEntranceFee })
      await helpers.time.increase(Number(interval) + 10);
      // await network.provider.request({ method: "evm_mine", params: [] })
      // 增加区块的产生数量
      await helpers.mine();
      const { upkeepNeeded } = await raffle.checkUpkeep("0x")
      assert(upkeepNeeded)
    })
  })

  describe("performUpkeep", function() {
    it("can only run if checkupkeep is true", async () => {
      await raffle.enterRaffle({ value: raffleEntranceFee })
      await helpers.time.increase(Number(interval) + 1);
      // await network.provider.request({ method: "evm_mine", params: [] })
      // 增加区块的产生数量
      await helpers.mine();
      const tx = await raffle.performUpkeep("0x")
      assert(tx)
    })

    it("reverts if checkup is false", async () => {
      await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(
        raffle,
          "Raffle__UpkeepNotNeeded"
      )
    })

    it("updates the raffle state and emits a requestId", async () => {
      // Too many asserts in this test!
      await raffle.enterRaffle({ value: raffleEntranceFee })
      await helpers.time.increase(Number(interval) + 1);
      // await network.provider.request({ method: "evm_mine", params: [] })
      // 增加区块的产生数量
      await helpers.mine();
      const txResponse = await raffle.performUpkeep("0x")
      const txReceipt = await txResponse.wait(1)
      const raffleState = await raffle.getRaffleState()
      const requestId = txReceipt!.logs![1].topics[0]
      assert(Number(requestId) > 0)
      assert(Number(raffleState) == 1)
    })
  })

  describe("fulfillRandomWords", function() {
    beforeEach(async () => {
      await raffle.enterRaffle({ value: raffleEntranceFee })
      await helpers.time.increase(Number(interval) + 40);
      console.log('tim --> add ', Number(interval) + 40)
      // await network.provider.request({ method: "evm_mine", params: [] })
      // 增加区块的产生数量
      await helpers.mine();
    })

    it("can only be called after performupkeep", async () => {
      (vrfCoordinatorV2Mock as VRFCoordinatorV2Mock).fulfillRandomWords(0, await raffle.getAddress())
      await expect(
          (vrfCoordinatorV2Mock as VRFCoordinatorV2Mock).fulfillRandomWords(0, await raffle.getAddress())
      ).to.be.reverted
      await expect(
          (vrfCoordinatorV2Mock as VRFCoordinatorV2Mock).fulfillRandomWords(1, await raffle.getAddress())
      ).to.be.reverted
    })

    it("Should successfully request a random number", async function () {
      // await helpers.time.increase(Number(interval) + 1);
      await expect(raffle.performUpkeep("0x")).to.emit(
        vrfCoordinatorV2Mock,
          "RandomWordsRequested"
      )
    })

    it("Should successfully request a random number and get a result", async function () {
      
      await raffle.performUpkeep("0x")
      const requestId = await raffle.s_requestId()

      // simulate callback from the oracle network
      await expect(
        (vrfCoordinatorV2Mock as VRFCoordinatorV2Mock).fulfillRandomWords(
              requestId,
              await raffle.getAddress()
          )
      ).to.emit(vrfCoordinatorV2Mock, "RandomWordsFulfilled")

  })

    it("picks a winner, resets, and sends money", async () => {
      // const {raffle: raffleFactory} = await helpers.loadFixture(
      //   deployAutomationCounterFixture
      // )
      const accounts = await ethers.getSigners()
      const additionalEntrances = 3
      const startingIndex = 2
      for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
          let raffleNew = raffle.connect(accounts[i])
          await raffleNew.enterRaffle({ value: raffleEntranceFee })
      }
      const startingTimeStamp = await raffle.getLastTimeStamp()
      // await helpers.time.increase(Number(interval) + 1);

      await new Promise<void>(async (resolve, reject) => {
        // console.log('-->', raffle.getEvent('WinnerPicked'))
        raffle.once(raffle.getEvent('WinnerPicked'), async () => {
          console.log("WinnerPicked event fired!")
          try {
            const recentWinner = await raffle.getRecentWinner()
            const raffleState = await raffle.getRaffleState()
            const winnerBalance = await accounts[2].provider.getBalance(accounts[2].address)
            const endingTimeStamp = await raffle.getLastTimeStamp()
            await expect(raffle.getPlayer(0)).to.be.reverted
            assert.equal(recentWinner.toString(), accounts[2].address)
            assert.equal(raffleState, 0n)
            assert.equal(
                winnerBalance.toString(),
                '' + (startingBalance + ((BigInt(raffleEntranceFee) * BigInt(additionalEntrances)) + BigInt(raffleEntranceFee)))

            )
            assert(endingTimeStamp > startingTimeStamp)
            resolve()
          } catch (e) {
            reject(e)
          }
          
        })

        const tx = await raffle.performUpkeep("0x")
        const txReceipt = await tx.wait(1)
  
        // const requestId = txReceipt!.logs![1].topics[1]
        const requestId = await raffle.s_requestId();
        console.log('requestId', requestId)
        const startingBalance = await accounts[2].provider.getBalance(accounts[2].address)
        await (vrfCoordinatorV2Mock as VRFCoordinatorV2Mock).fulfillRandomWords(
          requestId,
          await raffle.getAddress()
        )
      })


    })
  })
})