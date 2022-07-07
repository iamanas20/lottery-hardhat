// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/KeeperCompatible.sol";

error Lottery__NotOwner();
error Lottery__NotSentToWinner();
error Lottery__LotteryUnplayable();
error Lottery__PerformUpkeepNotYetNeeded();
error Lottery__NotEnoughFundToParticipate();

/// @title A lottery contract
/// @author chain xvi
/// @notice A lottery where participants enter and after an interval a winner is picked
/// @dev This contract uses chainlink oracles for Keepers to automate the execution
/// and for VRF to get random number to pick winner
contract Lottery is VRFConsumerBaseV2, KeeperCompatibleInterface {
  address immutable i_owner;

  // lottery data
  address payable[] private s_participants;
  // mapping (address => uint256) public s_participantToAmount;
  // mapping (address => bool) s_participantToExists;
  uint256 private s_lotteryAmount;
  address private s_winner;
  bool private s_lotteryPlayable;
  uint256 private immutable i_minEntranceFee;

  // vrf data
  VRFCoordinatorV2Interface COORDINATOR;
  uint64 private immutable i_subscriptionId;
  bytes32 private i_keyHash;
  uint16 constant requestConfirmations = 3;
  uint32 private i_gasLimit;

  // keeper data
  uint256 private s_lastTimeStamp;
  uint256 private immutable i_interval;

  // events
  event LotteryEntered(address indexed participant);
  event RequestedLotteryWinner(uint256 indexed requestId);
  event PickedWinner(address indexed winner);
  event fulfillRandomWordsCalled(uint256 indexed randomNumber);

  constructor(uint64 subscriptionId, address vrfCoordinator, bytes32 keyHash, uint32 gasLimit, uint256 intervalSeconds, uint256 minEntranceFee) VRFConsumerBaseV2(vrfCoordinator) {
    COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinator);
    i_owner = msg.sender;
    i_interval = intervalSeconds;
    s_lotteryPlayable = true;
    s_lastTimeStamp = block.timestamp;
    i_keyHash = keyHash;
    i_minEntranceFee = minEntranceFee;
    i_subscriptionId = subscriptionId;
    i_gasLimit = gasLimit;
  }

  /// @notice Allows non duplicate participants to enter the lottery
  /// @dev This function checks if the lottery is playable to make sure the player enters
  /// where no previous winner is being picked by the VRF.
  /// It also checks if the minimum amount is equal or above the minimum.
  function enterLottery() payable public {
    if(!s_lotteryPlayable){
      revert Lottery__LotteryUnplayable();
    }

    if(msg.value < i_minEntranceFee){
      revert Lottery__NotEnoughFundToParticipate();
    }

    s_lotteryAmount += msg.value;
    s_participants.push(payable(msg.sender));
    emit LotteryEntered(msg.sender);
  }

  function fulfillRandomWords(uint256, /* requestId */ uint256[] memory randomWords) internal override {
    s_lotteryPlayable = true;
    uint256 randomNumber = randomWords[0] % s_participants.length;
    address payable winner = s_participants[randomNumber];
    s_winner = winner;
    s_participants = new address payable[](0);
    s_lastTimeStamp = block.timestamp;
    emit fulfillRandomWordsCalled(randomNumber);

    (bool success, ) = s_winner.call{value: address(this).balance}("");
    if(!success) {
      revert Lottery__NotSentToWinner();
    }

    emit PickedWinner(s_winner);
  }

  function checkUpkeep(bytes memory /*checkData*/) public override view returns (bool upkeepNeeded, bytes memory) {
    // returns true for the keeper to run `performUpkeep`
    // TODO: this should not return true until the time has passed
    upkeepNeeded = ((block.timestamp - s_lastTimeStamp) > i_interval) &&
      (s_participants.length > 0) &&
      (address(this).balance > 0) &&
      s_lotteryPlayable;
  }

  function performUpkeep(bytes calldata /*performData*/) external override {
    (bool upkeepNeeded,) = checkUpkeep("");
    if(!upkeepNeeded) {
      revert Lottery__PerformUpkeepNotYetNeeded();
    }

    s_lotteryPlayable = false;
    uint256 requestId = COORDINATOR.requestRandomWords(
      i_keyHash,
      i_subscriptionId,
      requestConfirmations,
      i_gasLimit,
      1
    );
    emit RequestedLotteryWinner(requestId);
  }

  /// @notice Returns the participants
  /// @return s_participants as address[]
  function getParticipants() public view returns (address payable[] memory) {
    return s_participants;
  }

  /// @notice Returns the lottery amount
  /// @return s_lotteryAmount as uint256
  function getLotteryAmount() public view returns (uint256) {
    return s_lotteryAmount;
  }

  /// @notice Returns the winner
  /// @return s_winner as address
  function getWinner() public view returns (address) {
    return s_winner;
  }

  /// @notice Returns the number of participants
  /// @return s_participants.length as uint256
  function getNumberOfParticipants() public view returns (uint256) {
    return s_participants.length;
  }

  /// @notice Returns the min entrance fee
  /// @return i_minEntranceFee as uint256
  function getMinEntranceFee() public view returns (uint256) {
    return i_minEntranceFee;
  }

  /// @notice Returns the last time stamp
  /// @return s_lastTimeStamp as uint256
  function getLastTimeStamp() public view returns (uint256) {
    return s_lastTimeStamp;
  }

  /// @notice Returns the interval
  /// @return i_interval as uint256
  function getInterval() public view returns (uint256) {
    return i_interval;
  }

  /// @notice Returns the subscriptionId
  /// @return i_subscriptionId as uint256
  function getSubscriptionId() public view returns (uint64) {
    return i_subscriptionId;
  }

  /// @notice Returns the lottery playable state
  /// @return s_lotteryPlayable as bool
  function getLotteryPlayable() public view returns (bool) {
    return s_lotteryPlayable;
  }
}