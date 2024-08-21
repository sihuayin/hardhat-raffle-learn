import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
const LinkTokenModule = buildModule("LinkTokenModule", (m) => {

  const linkToken = m.contract("MockLinkToken", []);

  return { linkToken };
});

export default LinkTokenModule;
