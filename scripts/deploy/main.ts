import { network, run, ethers } from "hardhat"
import fs from 'fs'

const frontEndAbiFile = './doc/abi.json';
const frontEndContractsFile = './doc/contracts.json';
async function deploy(chainId: number) {

  let VRFCoordinatorV2Mock
    let subscriptionId
    let vrfCoordinatorAddress

    if (chainId == 31337) {
      const BASE_FEE = "1000000000000000" // 0.001 ether as base fee
    const GAS_PRICE = "50000000000" // 50 gwei 
    const WEI_PER_UNIT_LINK = "10000000000000000" // 0.01 ether per LINK

    const VRFCoordinatorV2MockFactory = await ethers.getContractFactory("VRFCoordinatorV2Mock")
        VRFCoordinatorV2Mock = await VRFCoordinatorV2MockFactory.deploy(BASE_FEE, GAS_PRICE)
        vrfCoordinatorAddress = await VRFCoordinatorV2Mock.getAddress()

        const fundAmount = "1000000000000000000"
        const transaction = await VRFCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transaction.wait(1)
        subscriptionId = transactionReceipt!.logs[0].topics[1]
        await VRFCoordinatorV2Mock.fundSubscription(subscriptionId, fundAmount)

    } else {
      subscriptionId = "588"
        vrfCoordinatorAddress = "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625"
    }

    const raffleFactory = await ethers.getContractFactory("Raffle")
    const raffle = await raffleFactory
        .deploy(
          vrfCoordinatorAddress,
          subscriptionId,
          '0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c',
          30,
          10000n,
          100000,)

          if (chainId == 31337) {
            VRFCoordinatorV2Mock!.addConsumer(subscriptionId, await raffle.getAddress())
        }
        const raffleAddress = await raffle.getAddress()
  console.log(`Raffle deployed to ${raffleAddress}`)

  console.log("Writing to front end...")
        
        const contractAddresses = JSON.parse(fs.readFileSync(frontEndContractsFile, "utf8"))
        if (chainId in contractAddresses) {
            if (!contractAddresses[network.config.chainId!].includes(raffleAddress)) {
                contractAddresses[network.config.chainId!].push(raffleAddress)
            }
        } else {
            contractAddresses[network.config.chainId!] = [raffleAddress]
        }
        fs.writeFileSync(frontEndContractsFile, JSON.stringify(contractAddresses))
        fs.writeFileSync(frontEndAbiFile, raffle!.interface.formatJson())
        console.log("Front end written!")
}
async function main() {
  await run("compile")
  const chainId = network.config.chainId || 31337

  await deploy(chainId)
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1);
})