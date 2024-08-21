import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
const VRFCoordinatorV2MockModule = buildModule("VRFCoordinatorV2MockModule", (m) => {

  const BASE_FEE = "250000000000000000" // 0.25 is this the premium in LINK?
  const GAS_PRICE_LINK = 1e9 // link per gas, is this the gas lane? // 0.000000001 LINK per gas
  const vrfMock = m.contract("VRFCoordinatorV2Mock", [BASE_FEE, GAS_PRICE_LINK]);

  return { vrfMock };
});

export default VRFCoordinatorV2MockModule;
