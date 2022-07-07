const { network, ethers } = require('hardhat');
const { networkConfig, devChains } = require('../network.config');

const BASE_FEE = ethers.utils.parseEther("0.25");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const currentNetworkConfig = networkConfig[network.config.chainId];
  const isLocal = devChains.includes(currentNetworkConfig.name);
  if(isLocal) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    
    await deploy('VRFCoordinatorV2Mock', {
      from: deployer,
      contract: 'VRFCoordinatorV2Mock',
      args: [BASE_FEE, 1000000000],
      log: true,
    });
    log('Mocks deployed')
    log('-------------------------------------------------');
  }
}

module.exports.tags = ['all', 'mocks'];