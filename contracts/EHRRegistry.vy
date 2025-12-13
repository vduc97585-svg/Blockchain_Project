# @version ^0.4.3
"""
EHRRegistry.vy - Delegation-enabled version

Features:
- ERC-165 + ERC-721 (Metadata) compatible.
- Non-transferable (soulbound).
- Hospitals register and mint patient record tokens (owner = patient).
- Hospitals manage internal doctors.
- Patients can:
    - grant/revoke external write permission to addresses;
    - delegate/revoke hospitals for a token (so delegated hospitals can manage internal write perms).
- Steward (minting hospital) OR delegated hospital can grant/revoke internal write per token to doctor addresses.
- Doctors (with internal permission) or externally-granted addresses can add entries.
- All important actions emit events for auditability.
"""


from ethereum.ercs import IERC165

# --- Events (ERC-721 + custom)
event Transfer:
    _from: indexed(address)
    _to: indexed(address)
    _tokenId: indexed(uint256)

event Approval:
    _owner: indexed(address)
    _approved: indexed(address)
    _tokenId: indexed(uint256)

event ApprovalForAll:
    _owner: indexed(address)
    _operator: indexed(address)
    _approved: bool

event Mint:
    tokenId: uint256
    patient: address
    steward: address
    cid: String[256]

event EntryAdded:
    tokenId: uint256
    author: address
    entryCid: String[256]
    timestamp: uint256

event HospitalGranted:
    tokenId: uint256
    hospital: address
    doctor: address
    granted: bool

event HospitalDelegated:
    tokenId: uint256
    patient: address
    hospital: address
    delegated: bool

# --- Constants (interface ids)
ERC165_INTERFACE_ID: constant(bytes4) = 0x01ffc9a7
ERC721_INTERFACE_ID: constant(bytes4) = 0x80ac58cd  # ERC-721
ERC721_METADATA_INTERFACE_ID: constant(bytes4) = 0x5b5e139f  # ERC-721 metadata

# Zero address helper
ZERO_ADDR: constant(address) = 0x0000000000000000000000000000000000000000

# --- State variables

owner: public(address)                              # contract deployer / admin
name: public(String[64])
symbol: public(String[32])

# ERC-721 bookkeeping
balances: public(HashMap[address, uint256])        # owner -> balance
owners: public(HashMap[uint256, address])          # tokenId -> owner (patient)
token_exists: public(HashMap[uint256, bool])       # tokenId -> exists
token_cid: public(HashMap[uint256, String[256]])   # tokenId -> tokenURI / CID

# approvals (kept but transfers disabled)
token_approvals: public(HashMap[uint256, address])                         # tokenId -> approved address
operator_approvals: public(HashMap[address, HashMap[address, bool]])       # owner -> operator -> approved?

# Registry: hospitals and doctors
hospitals: public(HashMap[address, bool])                # registered hospitals
doctor_hospital: public(HashMap[address, address])       # doctor -> hospital address

# steward per token (hospital that minted the token)
stewards: public(HashMap[uint256, address])              # tokenId -> steward hospital

# external grants per token (patient granted external write)
external_write_grants: public(HashMap[uint256, HashMap[address, bool]])  # tokenId -> (addr -> bool)

# internal write permission per token given by steward or delegated hospital (per-doctor)
internal_write_permissions: public(HashMap[uint256, HashMap[address, bool]])  # tokenId -> doctor -> bool

# hospital delegation per token (patient delegates specific hospitals to be able to manage internal write perms)
hospital_delegates: public(HashMap[uint256, HashMap[address, bool]])  # tokenId -> hospital -> bool

# token counter
token_counter: public(uint256)

# --- Constructor
@deploy
def __init__(_name: String[64], _symbol: String[32]):
    """
    Initialize the contract.
    Deployer is admin, sets name and symbol.
    """
    self.owner = msg.sender
    self.name = _name
    self.symbol = _symbol
    self.token_counter = 0

# --- Internal assertions
@internal
def _only_owner():
    assert msg.sender == self.owner, "only contract owner"

@internal
def _only_hospital():
    assert self.hospitals[msg.sender] == True, "only registered hospital"

# --- Admin functions
@external
def register_hospital(hospital: address):
    """
    Register a hospital (only contract owner).
    """
    self._only_owner()
    assert hospital != ZERO_ADDR, "invalid hospital"
    self.hospitals[hospital] = True

@external
def unregister_hospital(hospital: address):
    """
    Unregister a hospital (only contract owner).
    """
    self._only_owner()
    self.hospitals[hospital] = False

# --- Hospital functions
@external
def register_doctor(doctor: address):
    """
    Hospital calls to register a doctor as belonging to this hospital.
    """
    self._only_hospital()
    assert doctor != ZERO_ADDR, "invalid doctor"
    self.doctor_hospital[doctor] = msg.sender

@external
def unregister_doctor(doctor: address):
    """
    Hospital can unregister doctor.
    """
    self._only_hospital()
    if self.doctor_hospital[doctor] == msg.sender:
        self.doctor_hospital[doctor] = ZERO_ADDR

# --- Patient delegation / external grant functions

@external
def delegate_hospital(tokenId: uint256, hospital: address):
    """
    Patient delegates a hospital for tokenId, allowing that hospital to manage internal write permissions for this token.
    """
    assert self.token_exists[tokenId] == True, "token not exist"
    assert msg.sender == self.owners[tokenId], "only patient"
    assert hospital != ZERO_ADDR, "invalid hospital"
    # hospital must be registered in registry (optional but recommended)
    assert self.hospitals[hospital] == True, "hospital not registered"
    self.hospital_delegates[tokenId][hospital] = True
    log HospitalDelegated(tokenId=tokenId, patient=msg.sender, hospital=hospital, delegated=True)

@external
def revoke_hospital_delegate(tokenId: uint256, hospital: address):
    """
    Patient revokes a hospital delegation.
    """
    assert self.token_exists[tokenId] == True, "token not exist"
    assert msg.sender == self.owners[tokenId], "only patient"
    self.hospital_delegates[tokenId][hospital] = False
    log HospitalDelegated(tokenId=tokenId, patient=msg.sender, hospital=hospital, delegated=False)

@external
def grant_external_write(tokenId: uint256, grantee: address):
    """
    Patient grants external address permission to write entries for a given token.
    """
    assert self.token_exists[tokenId] == True, "not exist"
    assert msg.sender == self.owners[tokenId], "only patient"
    assert grantee != ZERO_ADDR, "invalid grantee"
    self.external_write_grants[tokenId][grantee] = True

@external
def revoke_external_write(tokenId: uint256, grantee: address):
    """
    Patient revokes external write permission.
    """
    assert self.token_exists[tokenId] == True, "not exist"
    assert msg.sender == self.owners[tokenId], "only patient"
    self.external_write_grants[tokenId][grantee] = False

# --- Hospital-level internal permission management (now allowed for steward OR delegated hospitals)

@external
def hospital_grant_write(tokenId: uint256, doctor: address):
    """
    Steward (original hospital that minted token) OR a hospital delegated by patient for this token
    may grant per-token internal write permissions to a doctor address.
    """
    assert self.token_exists[tokenId] == True, "token not exist"
    assert doctor != ZERO_ADDR, "invalid doctor"
    steward: address = self.stewards[tokenId]
    # allowed if msg.sender == steward OR if hospital_delegates[tokenId][msg.sender] == True
    allowed: bool = False
    if msg.sender == steward:
        allowed = True
    else:
        if self.hospital_delegates[tokenId][msg.sender] == True:
            allowed = True
    assert allowed, "not steward or delegated hospital"
    # set permission
    self.internal_write_permissions[tokenId][doctor] = True
    log HospitalGranted(tokenId=tokenId, hospital=msg.sender, doctor=doctor, granted=True)

@external
def hospital_revoke_write(tokenId: uint256, doctor: address):
    """
    Steward or delegated hospital may revoke per-token internal write permission.
    """
    assert self.token_exists[tokenId] == True, "token not exist"
    steward: address = self.stewards[tokenId]
    allowed: bool = False
    if msg.sender == steward:
        allowed = True
    else:
        if self.hospital_delegates[tokenId][msg.sender] == True:
            allowed = True
    assert allowed, "not steward or delegated hospital"
    self.internal_write_permissions[tokenId][doctor] = False
    log HospitalGranted(tokenId=tokenId, hospital=msg.sender, doctor=doctor, granted=False)

# --- ERC-721 core (read-only) implementations

@view
@external
def balanceOf(owner_addr: address) -> uint256:
    """
    Returns number of tokens owned by owner_addr.
    """
    assert owner_addr != ZERO_ADDR, "zero address"
    return self.balances[owner_addr]

@view
@external
def ownerOf(tokenId: uint256) -> address:
    """
    Returns owner (patient) of tokenId.
    """
    assert self.token_exists[tokenId] == True, "token does not exist"
    return self.owners[tokenId]

@view
@external
def tokenURI(tokenId: uint256) -> String[256]:
    """
    Returns token metadata pointer (CID or URI).
    """
    assert self.token_exists[tokenId] == True, "token does not exist"
    return self.token_cid[tokenId]

# --- ERC-165 support
@view
@external
def supportsInterface(interface_id: bytes4) -> bool:
    """
    Advertise supported interfaces: ERC165, ERC721, ERC721Metadata
    """
    if interface_id == ERC721_INTERFACE_ID:
        return True
    if interface_id == ERC721_METADATA_INTERFACE_ID:
        return True
    if interface_id == ERC165_INTERFACE_ID:
        return True
    return False

# --- Mint / Burn (hospital mints record token; token is non-transferable)
@external
def mint_record(tokenId: uint256, patient: address, cid: String[256]):
    """
    Hospital mints a token representing a patient record.
    - only registered hospital can call
    - tokenId must not exist
    - owner set to patient
    - steward set to calling hospital
    - token_cid set (pointer to IPFS, encrypted)
    """
    self._only_hospital()
    assert patient != ZERO_ADDR, "invalid patient"
    assert self.token_exists[tokenId] == False, "token exists"
    # set ownership
    self.owners[tokenId] = patient
    self.balances[patient] += 1
    self.token_exists[tokenId] = True
    self.token_cid[tokenId] = cid
    self.stewards[tokenId] = msg.sender
    self.token_counter += 1
    # emit events
    log Mint(tokenId=tokenId, patient=patient, steward=msg.sender, cid=cid)
    log Transfer(_from=ZERO_ADDR, _to=patient, _tokenId=tokenId)

@external
def burn(tokenId: uint256):
    """
    Burn a token (optional removal). Allowed for:
    - token owner (patient)
    - steward (hospital that minted)
    - contract owner (admin)
    """
    assert self.token_exists[tokenId] == True, "not exist"
    current_owner: address = self.owners[tokenId]
    steward: address = self.stewards[tokenId]
    assert msg.sender == current_owner or msg.sender == steward or msg.sender == self.owner, "not permitted"
    # clear ownership
    self.token_exists[tokenId] = False
    if current_owner != ZERO_ADDR:
        if self.balances[current_owner] > 0:
            self.balances[current_owner] -= 1
    self.owners[tokenId] = ZERO_ADDR
    self.token_cid[tokenId] = ""
    self.stewards[tokenId] = ZERO_ADDR
    log Transfer(_from=current_owner, _to=ZERO_ADDR, _tokenId=tokenId)

# --- Approvals (kept for ERC-721 compatibility but transfers are blocked)
@external
def approve(to: address, tokenId: uint256):
    """
    Approve address to operate tokenId. Kept for compatibility.
    Note: transfers are disabled; approvals are stored but transferFrom will revert.
    """
    assert self.token_exists[tokenId] == True, "not exist"
    owner_addr: address = self.owners[tokenId]
    assert msg.sender == owner_addr or self.operator_approvals[owner_addr][msg.sender] == True, "not authorized"
    self.token_approvals[tokenId] = to
    log Approval(_owner=owner_addr, _approved=to, _tokenId=tokenId)

@view
@external
def getApproved(tokenId: uint256) -> address:
    assert self.token_exists[tokenId] == True, "not exist"
    return self.token_approvals[tokenId]

@external
def setApprovalForAll(operator: address, approved: bool):
    assert operator != msg.sender, "self operator"
    self.operator_approvals[msg.sender][operator] = approved
    log ApprovalForAll(_owner=msg.sender, _operator=operator, _approved=approved)

@view
@external
def isApprovedForAll(owner_addr: address, operator: address) -> bool:
    return self.operator_approvals[owner_addr][operator]

# --- Transfer functions: intentionally disabled / non-transferable
@external
def transferFrom(_from: address, _to: address, tokenId: uint256):
    """
    Disabled: tokens are non-transferable. Always revert.
    """
    raise "non-transferable"

@external
def safeTransferFrom(_from: address, _to: address, tokenId: uint256):
    """
    Disabled: tokens are non-transferable. Always revert.
    """
    raise "non-transferable"

@external
def safeTransferFrom_withData(_from: address, _to: address, tokenId: uint256, data: Bytes[1024]):
    """
    Disabled: tokens are non-transferable. Always revert.
    """
    raise "non-transferable"

# --- Add entry: can be called by internal doctors (who have been granted internal write per token)
# or externally granted addrs by patient
@external
def add_entry(tokenId: uint256, entryCid: String[256]):
    """
    Add an entry (IPFS CID) to the record (emitted as event).
    Allowed if:
     - msg.sender has internal_write_permissions[tokenId][msg.sender] == True, (these perms are granted by steward OR delegated hospital),
     OR
     - msg.sender is externally granted by patient for this tokenId
    """
    assert self.token_exists[tokenId] == True, "not exist"
    # internal doctor check (just check explicit per-token permission)
    is_internal: bool = self.internal_write_permissions[tokenId][msg.sender]
    # external grant check
    is_external: bool = self.external_write_grants[tokenId][msg.sender]
    assert is_internal or is_external, "no write permission"
    # Emit event as audit trail; don't store entries to save gas
    log EntryAdded(tokenId=tokenId, author=msg.sender, entryCid=entryCid, timestamp=block.timestamp)

# --- View helper
@view
@external
def can_write(tokenId: uint256, addr: address) -> bool:
    """
    Returns whether addr can write entries for tokenId.
    """
    if not self.token_exists[tokenId]:
        return False
    if self.internal_write_permissions[tokenId][addr]:
        return True
    if self.external_write_grants[tokenId][addr]:
        return True
    return False

# --- Optional helper to get steward/owner/token cid (some are public via public declarations)
@view
@external
def get_steward(tokenId: uint256) -> address:
    assert self.token_exists[tokenId] == True, "not exist"
    return self.stewards[tokenId]

@view
@external
def exists_token(tokenId: uint256) -> bool:
    return self.token_exists[tokenId]

@view
@external
def getRole(addr: address) -> String[32]:
    if addr == self.owner:
        return "contract_owner"
    if self.hospitals[addr]:
        return "hospital"
    if self.doctor_hospital[addr] != ZERO_ADDR:
        return "doctor"
    # check if patient owns ANY token
    if self.balances[addr] > 0:
        return "patient"
    return "none"