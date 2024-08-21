import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const RaffleModule = buildModule("RaffleModule", (m) => {

  const vrfCoordinatorV2 = m.getParameter("vrfCoordinatorV2");
  const subscriptionId = m.getParameter("subscriptionId");
  const gasLane = m.getParameter("gasLane");
  const interval = m.getParameter("interval", 100);
  const entranceFee = m.getParameter("entranceFee", 100);
  const callbackGasLimit = m.getParameter("callbackGasLimit", 100);

  const raffle = m.contract("Raffle", [
    vrfCoordinatorV2,
    subscriptionId,
    gasLane,
    interval,
    entranceFee,
    callbackGasLimit
  ]);

  return { raffle };
});

export default RaffleModule;
