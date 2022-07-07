const { network, ethers, getNamedAccounts } = require('hardhat');
const { assert } = require('chai');
const { devChains } = require('../../network.config');

devChains.includes(network.name) ?
describe.skip :
describe('Lottery', function() {
  let lotteryContract, deployer;
  const enterValue = ethers.utils.parseEther('0.01');
  beforeEach(async function() {
    deployer = (await getNamedAccounts()).deployer;
    // get deployed contract
    lotteryContract = await ethers.getContract('Lottery', deployer);
  });

  describe('fulfillRandomWords', function() {
    it('picks a random winner from the participants array using live chainlink VRF and Keepers Oracles', async function() {
      await new Promise(async (resolve, reject) => {
        const timestamp = await lotteryContract.getLastTimeStamp();
        lotteryContract.once('PickedWinner', async function() {
          try {
            // time has moved
            const endingTimestamp = await lotteryContract.getLastTimeStamp();
            assert.isTrue(endingTimestamp > timestamp, "time has moved");
            // // array is empty
            const participants = await lotteryContract.getParticipants();
            assert.lengthOf(participants, 0, "participants array is empty now");
            // // lottery is playable
            const lotteryPlayable = await lotteryContract.getLotteryPlayable();
            assert.isTrue(lotteryPlayable, "lottery is playable");
            // contract doesn't have money
            const contractBalance = await ethers.provider.getBalance(lotteryContract.address);
            assert.equal(ethers.utils.formatEther(contractBalance), 0, "contract doesn't have money");
            resolve();
          } catch (e) {
            reject(e)
          }
        })
        
        await lotteryContract.enterLottery({ value: enterValue })
      });
    })
  });
});