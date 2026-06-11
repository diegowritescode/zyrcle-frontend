// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

interface IZyrcleToken {
    function mint(address to, uint256 amount) external;
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IZyrcleCertificate {
    function safeMint(address to, string memory uri) external returns (uint256);
}

/**
 * @title ZyrcleCore
 * @notice Orchestrator for the Zyrcle recycling platform. Reconstructed from
 *         the frontend ABI (`Abis.ts`). Holds references to the reward token
 *         and the certificate NFT, and is granted MINTER_ROLE on both so it can
 *         reward users and issue/sell certificates on their behalf.
 *
 *         Flows:
 *           - Resident:  depositWaste -> (verifier) verifyEvent -> reward ZYR
 *           - Collector: confirmCollection -> submitBatchDelivery
 *           - Certificates: issueCertificate (admin, milestone) OR
 *                           purchaseCertificate (user spends ZYR) <-- NEW, fixes
 *                           gaps #1 (no token charge) and #2 (mint role).
 */
contract ZyrcleCore is AccessControl {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant RATE_SETTER_ROLE = keccak256("RATE_SETTER_ROLE");

    IZyrcleToken public immutable token;
    IZyrcleCertificate public immutable certificate;

    /// @notice ZYR (base units) rewarded per unit of weight on a verified event.
    uint256 public rewardPerKg;

    /// @notice Where ZYR paid for marketplace certificates is collected.
    address public treasury;

    // --- waste events (residents) ---
    struct WasteEvent {
        address user;
        uint256 weight;
        uint256 timestamp;
        bool verified;
    }
    mapping(uint256 => WasteEvent) public events;
    uint256 public nextEventId;

    // --- collections (collectors) ---
    struct Collection {
        address collector;
        uint256 containerId;
        string containerType;
        string photoCid;
        uint256 weight;
        uint256 timestamp;
    }
    mapping(uint256 => Collection) public collections;
    mapping(uint256 => Collection) public collectionsByContainerId;
    uint256 public nextCollectionId;

    // --- batches (collector daily delivery) ---
    struct Batch {
        address collector;
        uint256[] containerIds;
        uint256 totalWeight;
        uint256 timestamp;
    }
    mapping(uint256 => Batch) public batches;
    mapping(address => mapping(uint256 => uint256)) public collectorDailyBatch;
    uint256 public nextBatchId;

    // --- marketplace certificate prices (keyed by keccak256(uri)) ---
    mapping(bytes32 => uint256) public certificatePrice;

    // --- events (logs) ---
    event WasteDeposited(address indexed user, uint256 indexed eventId, uint256 weight);
    event WasteVerified(address indexed verifier, uint256 indexed eventId, uint256 rewardTokens);
    event ContainerCollected(
        address indexed collector,
        uint256 indexed containerId,
        string containerType,
        string photoCid,
        uint256 weight,
        uint256 timestamp
    );
    event BatchDelivered(
        address indexed collector,
        uint256 indexed batchId,
        uint256[] containerIds,
        uint256 totalWeight,
        uint256 timestamp
    );
    event CertificateIssued(address indexed recipient, uint256 indexed eventId, uint256 certificateId);
    event CertificatePurchased(address indexed buyer, uint256 certificateId, uint256 price);

    constructor(address tokenAddress, address certAddress) {
        token = IZyrcleToken(tokenAddress);
        certificate = IZyrcleCertificate(certAddress);
        treasury = msg.sender;
        rewardPerKg = 1e18; // 1 ZYR per weight unit by default; tune via setRewardPerKg

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        _grantRole(RATE_SETTER_ROLE, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Residents
    // ---------------------------------------------------------------------

    /// @notice Log a waste deposit for the caller. Rewards are minted later on verification.
    function depositWaste(uint256 weight) external {
        uint256 eventId = nextEventId++;
        events[eventId] = WasteEvent({
            user: msg.sender,
            weight: weight,
            timestamp: block.timestamp,
            verified: false
        });
        emit WasteDeposited(msg.sender, eventId, weight);
    }

    /// @notice Verify a waste event and mint the corresponding ZYR reward to the depositor.
    function verifyEvent(uint256 eventId) external onlyRole(VERIFIER_ROLE) {
        WasteEvent storage e = events[eventId];
        require(e.user != address(0), "Event does not exist");
        require(!e.verified, "Already verified");

        e.verified = true;
        uint256 reward = e.weight * rewardPerKg;
        token.mint(e.user, reward);
        emit WasteVerified(msg.sender, eventId, reward);
    }

    function getEvent(uint256 eventId)
        external
        view
        returns (address user, uint256 weight, uint256 timestamp, bool verified)
    {
        WasteEvent storage e = events[eventId];
        return (e.user, e.weight, e.timestamp, e.verified);
    }

    function setRewardPerKg(uint256 newRate) external onlyRole(RATE_SETTER_ROLE) {
        rewardPerKg = newRate;
    }

    // ---------------------------------------------------------------------
    // Collectors
    // ---------------------------------------------------------------------

    /// @notice Record that `collector` emptied a container (with an IPFS photo proof).
    function confirmCollection(
        address collector,
        uint256 containerId,
        string calldata containerType,
        string calldata photoCid,
        uint256 weight
    ) external {
        Collection memory c = Collection({
            collector: collector,
            containerId: containerId,
            containerType: containerType,
            photoCid: photoCid,
            weight: weight,
            timestamp: block.timestamp
        });
        collections[nextCollectionId++] = c;
        collectionsByContainerId[containerId] = c;
        emit ContainerCollected(collector, containerId, containerType, photoCid, weight, block.timestamp);
    }

    /// @notice Bundle previously-collected containers into a daily delivery batch.
    function submitBatchDelivery(uint256[] calldata containerIds) external {
        uint256 totalWeight;
        for (uint256 i = 0; i < containerIds.length; i++) {
            totalWeight += collectionsByContainerId[containerIds[i]].weight;
        }

        uint256 batchId = nextBatchId++;
        batches[batchId] = Batch({
            collector: msg.sender,
            containerIds: containerIds,
            totalWeight: totalWeight,
            timestamp: block.timestamp
        });
        collectorDailyBatch[msg.sender][block.timestamp / 1 days] = batchId;

        emit BatchDelivered(msg.sender, batchId, containerIds, totalWeight, block.timestamp);
    }

    // ---------------------------------------------------------------------
    // Certificates
    // ---------------------------------------------------------------------

    /// @notice Admin-issued milestone certificate (no payment).
    function issueCertificate(uint256 eventId, address recipient, string calldata uri)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        uint256 certificateId = certificate.safeMint(recipient, uri);
        emit CertificateIssued(recipient, eventId, certificateId);
    }

    /// @notice Set the ZYR price for a marketplace certificate, keyed by its metadata URI.
    function setCertificatePrice(string calldata uri, uint256 price)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        certificatePrice[keccak256(bytes(uri))] = price;
    }

    /**
     * @notice Buy a certificate by spending ZYR. Fixes gap #1 (payment is now
     *         enforced on-chain) and gap #2 (mint flows through Core, which holds
     *         MINTER_ROLE). Caller must first `approve` this contract for `price`
     *         on the token.
     */
    function purchaseCertificate(string calldata uri) external returns (uint256) {
        uint256 price = certificatePrice[keccak256(bytes(uri))];
        require(price > 0, "Certificate not for sale");

        // Pulls ZYR from the buyer; reverts if balance/allowance is insufficient.
        require(token.transferFrom(msg.sender, treasury, price), "ZYR transfer failed");

        uint256 certificateId = certificate.safeMint(msg.sender, uri);
        emit CertificatePurchased(msg.sender, certificateId, price);
        return certificateId;
    }

    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        treasury = newTreasury;
    }
}
