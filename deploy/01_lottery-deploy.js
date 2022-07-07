const { network, ethers } = require('hardhat');
const { networkConfig, devChains } = require('../network.config.js');
const { verify } = require('../utils/verify');

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  
  const currentNetworkConfig = networkConfig[network.config.chainId];
  const isLocal = devChains.includes(currentNetworkConfig.name);

  let vrfCoordinatorAddr;
  let subscriptionId;
  if(isLocal) {
    const VRFCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock');
    vrfCoordinatorAddr = VRFCoordinatorV2Mock.address;
    // create subscription
    const txResp = await VRFCoordinatorV2Mock.createSubscription();
    const txReceipt = await txResp.wait(1);
    subscriptionId = txReceipt.events.find(e => e.event === 'SubscriptionCreated').args.subId; // contract event usage

    // fund subscription
    await VRFCoordinatorV2Mock.fundSubscription(subscriptionId, ethers.utils.parseEther('20'));
  } else {
    vrfCoordinatorAddr = currentNetworkConfig.vrfCoordinator;
    subscriptionId = currentNetworkConfig.subscriptionId;
  }

  const keyHash = currentNetworkConfig.keyHash;
  const minEntranceFee = currentNetworkConfig.minEntranceFee;
  const gasLimit = currentNetworkConfig.gasLimit;
  const intervalSeconds = currentNetworkConfig.interval;

  const args = [
    subscriptionId,
    vrfCoordinatorAddr,
    keyHash,
    gasLimit,
    intervalSeconds,
    minEntranceFee
  ];

  const lotteryContract = await deploy('Lottery', {
    from: deployer,
    contract: 'Lottery',
    args,
    log: true,
    waitConfirmations: network.config.blockConfirmations,
  });

  if(!isLocal) {
    await verify(lotteryContract.address, args);
  }

  log('-------------------------------------------------')
}

module.exports.tags = ['all', 'Lottery'];