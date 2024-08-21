import { ignition, ethers  }from "hardhat"
import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import { Raffle } from "./typechain-types"
import { assert, expect } from "chai"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import RaffleModule from "./ignition/modules/Raffle";
import VRFCoordinatorV2MockModule from './ignition/modules/mocks/VRFCoordinatorV2Mock'
import LinkTokenModule from './ignition/modules/mocks/LinkToken';
import { Contract } from "ethers";

const FUND_AMOUNT = "1000000000000000000000"

describe("Raffle Unit Tests",function () {
  let raffle: Contract
  let interval: number
  let raffleEntranceFee: BigInt
  let player: SignerWithAddress

  const BASE_FEE = "1000000000000000" // 0.001 ether as base fee
  const GAS_PRICE = "50000000000" // 50 gwei 
  const WEI_PER_UNIT_LINK = "10000000000000000" // 0.01 ether per LINK

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

    const fundAmount = "1000000000000000000"
    const transaction = await VRFCoordinatorV2_5Mock.createSubscription()
    const transactionReceipt = await transaction.wait(1)
    const subscriptionId = transactionReceipt!.logs[0].topics[1]
    await VRFCoordinatorV2_5Mock.fundSubscription(subscriptionId, fundAmount)

    const vrfCoordinatorAddress = await VRFCoordinatorV2_5Mock.getAddress()

    const raffleFactory = await ethers.getContractFactory("Raffle")
    const raffle = await raffleFactory
        .connect(deployer)
        .deploy(
          vrfCoordinatorAddress,
          subscriptionId,
          '0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c',
          30,
          10000n,
          100,)

  await VRFCoordinatorV2_5Mock.addConsumer(subscriptionId, await raffle.getAddress())

    return { raffle }
}



  beforeEach(async () => {
    const [deployer, second] = await ethers.getSigners();
    const VRFCoordinatorV2_5MockFactory = await ethers.getContractFactory(
      "VRFCoordinatorV2_5Mock"
  )

  const VRFCoordinatorV2_5Mock = await VRFCoordinatorV2_5MockFactory.deploy(
    BASE_FEE,
    GAS_PRICE,
    WEI_PER_UNIT_LINK
)


const fundAmount =  "1000000000000000000"
const transaction = await VRFCoordinatorV2_5Mock.createSubscription()
const transactionReceipt = await transaction.wait(1)
const subscriptionId = transactionReceipt!.logs[0].topics[1]
await VRFCoordinatorV2_5Mock.fundSubscription(subscriptionId, fundAmount)
const vrfCoordinatorAddress = await VRFCoordinatorV2_5Mock.getAddress();
    const object = await ignition.deploy(RaffleModule, {
      parameters: {
        RaffleModule: {
          vrfCoordinatorV2: vrfCoordinatorAddress,
          subscriptionId: subscriptionId,
          gasLane: '0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c',
          interval: 30,
          entranceFee: 10000n,
          callbackGasLimit: 100,
        }
      }
    })
    raffle = object.raffle;
    raffle =  raffle.connect(second) as Contract
    player = second
    interval = await raffle.getInterval()
    raffleEntranceFee = await raffle.getEntranceFee()
  })
  describe("constructor", function() {
    it("intitiallizes the raffle correctly", async () => {
     
      
      // 对比state
      const raffleState = (await raffle.getRaffleState()).toString()
      assert.equal(raffleState, "0")

      // 对比合约约定的值
      assert.equal(raffleEntranceFee, 10000n);

      // 对比interval
      assert.equal(interval, 30);
    });
  });

  describe("enterRaffle", function() {
    it("reverts when you don't pay enough", async () => {
      await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
        raffle,
          "Raffle__SendMoreToEnterRaffle"
      )
    })

    it("records player when they enter", async () => {
      await raffle.enterRaffle({ value: raffleEntranceFee })
     
      const contractPlayer = await raffle.getPlayer(0)
      assert.equal(player.address, contractPlayer)
    })

    it("emits event on enter", async () => {
      await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
          raffle,
          "RaffleEnter"
      )
    })

    it("doesn't allow entrance when raffle is calculating", async () => {
      const { raffle } = await helpers.loadFixture(
        deployAutomationCounterFixture
    )
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
});