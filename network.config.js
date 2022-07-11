const { ethers } = require("hardhat");

module.exports = {
  networkConfig: {
    // rinkeby network config
    4: {
      name: 'rinkeby',
      vrfCoordinator: '0x6168499c0cFfCaCD319c818142124B7A15E857ab',
      keyHash: '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc',
      minEntranceFee: ethers.utils.parseEther("0.01"),
      subscriptionId: 7761,
      gasLimit: 1000000,
      interval: 60, // seconds
    },
    // hardhat network config
    1337: {
      name: 'hardhat',
      keyHash: '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc',
      minEntranceFee: ethers.utils.parseEther("0.01"),
      gasLimit: 1000000,
      interval: 60, // seconds
    },
  },
  devChains: ['hardhat', 'localhost']
}