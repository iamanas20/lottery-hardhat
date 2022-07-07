const { assert, expect } = require('chai');
const { getNamedAccounts, network, ethers, deployments } = require('hardhat');
const { networkConfig, devChains } = require('../../network.config');

!devChains.includes(network.name) ? describe.skip :
describe('Lottery', function() {
  const currentNetworkConfig = networkConfig[network.config.chainId];
  let lotteryContract, vrfCoordinatorV2Mock, deployer, interval, participant;
  const enterValue = ethers.utils.parseEther('0.01');
  beforeEach(async function() {
    deployer = (await getNamedAccounts()).deployer;
    participant = (await getNamedAccounts()).participant;
    // run deployment
    await deployments.fixture(['all']);
    // get deployed contracts and mocks
    vrfCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock');
    lotteryContract = await ethers.getContract('Lottery');
    interval = await lotteryContract.getInterval();
  });

  describe('constructor', function() {
    it('sets the entrance fee correctly.', async function() {
      const minEntranceFee = await lotteryContract.getMinEntranceFee();
      assert.equal(ethers.utils.formatEther(minEntranceFee), ethers.utils.formatEther(currentNetworkConfig.minEntranceFee));
    });

    it('sets the interval correctly.', async function() {
      assert.equal(interval, currentNetworkConfig.interval);
    });

    it('the lottery starts as playable.', async function() {
      const lotteryPlayable = await lotteryContract.getLotteryPlayable();
      assert.isTrue(lotteryPlayable);
    });
  });

  describe('enterLottery', function() {
    it('if the value is less than the minimum entrance fee, it will be reverted', async function() {
      await expect(lotteryContract.enterLottery()).to.be.revertedWith('Lottery__NotEnoughFundToParticipate');
    })

    it('if the lottery is entered, it will add to the amount of the Lottery contract', async function() {
      const startingLotteryBalance = await ethers.provider.getBalance(lotteryContract.address);
      await lotteryContract.enterLottery({
        value: enterValue,
      });
      const afterEntranceLotteryBalance = await ethers.provider.getBalance(lotteryContract.address);
      assert.equal(afterEntranceLotteryBalance.toString(), startingLotteryBalance.add(enterValue).toString());
    })

    it('if the lottery is entered, it will add participant to the participants array', async function() {
      const participantsBefore = await lotteryContract.getParticipants();
      assert.isFalse(participantsBefore.includes(deployer));

      await lotteryContract.enterLottery({
        value: enterValue,
      });

      const participantsAfter = await lotteryContract.getParticipants();
      assert.isTrue(participantsAfter.includes(deployer));
    });

    it('lottery participants are not duplicate.', async function() {
      await lotteryContract.enterLottery({
        value: enterValue,
      });

      await expect(lotteryContract.enterLottery({value: enterValue})).to.be.reverted;
    });

    it('lottery entrance will emit LotteryEntered event.', async function() {
      await expect(
        lotteryContract.enterLottery({
          value: enterValue
        })
      )
      .to
      .emit(
        lotteryContract,
        'LotteryEntered'
      )
    });

    it('lottery entrance will register participant in the LotteryEntered event.', async function() {
      await expect(
        lotteryContract.enterLottery({
          value: enterValue
        })
      )
      .to
      .emit(
        lotteryContract,
        'LotteryEntered'
      )
      .withArgs(deployer);
    });

    it('entrance to lottery will not be allowed if the lottery is not playable.', async function() {
      await lotteryContract.enterLottery({
        value: enterValue
      });
      
      // we need to increase time manually and call the performUpkeep function
      // which in turn will call checkUpkeep which will return true because time is gone by
      
      // travel in time
      await network.provider.send('evm_increaseTime', [interval.toNumber() + 1]);
      // mine an empy block
      await network.provider.send('evm_mine', []);
      
      await lotteryContract.performUpkeep('0x00');
      await expect(lotteryContract.enterLottery({
        value: enterValue
      })).to.be.revertedWith('Lottery__LotteryUnplayable');
    });
  });
  
  // pretend to be a chainlink keeper
  describe('checkUpkeep', function() {
    it("returns false if interval time didn't pass.", async function () {
      await lotteryContract.enterLottery({
        value: enterValue
      });

      const { upkeepNeeded } = await lotteryContract.callStatic.checkUpkeep('0x00')
      assert.isFalse(upkeepNeeded);
    });
    
    it("returns false if no one participated, but interval time has passed.", async function () {
      // travel in time
      await network.provider.send('evm_increaseTime', [interval.toNumber() + 1]);
      // mine an empy block
      await network.provider.send('evm_mine', []);

      const { upkeepNeeded } = await lotteryContract.callStatic.checkUpkeep('0x00');
      assert.isFalse(upkeepNeeded);
    });
    
    it("returns true if lottery was entered and interval time passed.", async function () {
      await lotteryContract.enterLottery({
        value: enterValue
      });
      // travel in time
      await network.provider.send('evm_increaseTime', [interval.toNumber() + 1]);
      // mine an empy block
      await network.provider.send('evm_mine', []);

      const { upkeepNeeded } = await lotteryContract.callStatic.checkUpkeep('0x00');
      assert.isTrue(upkeepNeeded);
    });
  })

  // pretend to be a chainlink keeper
  describe('performUpkeep', function() {
    it('should throw error if checkUpkeep is false.', async function() {
      await expect(lotteryContract.performUpkeep('0x')).to.be.revertedWith('Lottery__PerformUpkeepNotYetNeeded');
    })
    it('should set the lottery playable to false', async function() {
      await lotteryContract.enterLottery({
        value: enterValue
      });
      // travel in time
      await network.provider.send('evm_increaseTime', [interval.toNumber() + 1]);
      // mine an empy block
      await network.provider.send('evm_mine', []);

      await lotteryContract.performUpkeep('0x');
      const lotteryPlayable = await lotteryContract.getLotteryPlayable();
      assert.isFalse(lotteryPlayable);
    })
    it('should emit RequestedLotteryWinner event', async function() {
      await lotteryContract.enterLottery({
        value: enterValue
      });
      // travel in time
      await network.provider.send('evm_increaseTime', [interval.toNumber() + 1]);
      // mine an empy block
      await network.provider.send('evm_mine', []);

      await expect(lotteryContract.performUpkeep('0x')).to.emit(lotteryContract, 'RequestedLotteryWinner');
    })
  });

  describe('fulfillRandomWords', function() {
    beforeEach(async () => {
      await lotteryContract.enterLottery({ value: enterValue })
      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
      await network.provider.request({ method: "evm_mine", params: [] })
    })
    
    it('if there is no requestId, the coordinator function fulfillRandomWords will revert', async function () {
      await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, lotteryContract.address)).to.be.revertedWith('nonexistent request');
    });
    
    it('picks a random winner from the participants array', async function() {
      const participantsBeforePickingWinner = await lotteryContract.getParticipants();
      await new Promise(async (resolve, reject) => {
        lotteryContract.once('PickedWinner', async function() {
          try {
            // winner is picked and in the array
            const winner = await lotteryContract.getWinner();
            assert.include(participantsBeforePickingWinner, winner);
            // array is empty 
            const participants = await lotteryContract.getParticipants();
            assert.lengthOf(participants, 0);
            // lottery is playable
            const lotteryPlayable = await lotteryContract.getLotteryPlayable();
            assert.isTrue(lotteryPlayable);
            // money sent out to winner
            const contractBalance = await ethers.provider.getBalance(lotteryContract.address);
            assert.equal(ethers.utils.formatEther(contractBalance), 0);
          } catch (e) {
            reject(e)
          }
          resolve();
        })
        // mock's fulfillRandomWords
        const tx = await lotteryContract.performUpkeep('0x');
        const txReceipt = await tx.wait(1);
        const requestId = txReceipt.events.find(e => e.event === 'RequestedLotteryWinner').args.requestId;
        await vrfCoordinatorV2Mock.fulfillRandomWords(
          requestId, lotteryContract.address
        );
      });
    })
  });
})
