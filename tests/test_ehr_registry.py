import pytest
import ape


# ----------------------------
# Helpers / Constants
# ----------------------------
ZERO_ADDR = "0x0000000000000000000000000000000000000000"


def _addr(x) -> str:
    return str(x).lower()


def b4(hexstr: str) -> bytes:
    """
    Convert '0x........' or '........' (8 hex chars) to bytes4.
    """
    s = hexstr.lower().replace("0x", "")
    s = s.zfill(8)
    return bytes.fromhex(s)


def assert_event_bool(value, expected: bool):
    """
    Ape/Vyper event decoding may yield bool-like fields as 0/1 integers.
    This helper normalizes to Python bool before asserting.
    """
    assert bool(value) is expected


ERC165_ID = b4("01ffc9a7")
ERC721_ID = b4("80ac58cd")
ERC721_METADATA_ID = b4("5b5e139f")
UNKNOWN_ID = b4("ffffffff")


# ----------------------------
# Fixtures
# ----------------------------
@pytest.fixture
def admin(accounts):
    return accounts[0]


@pytest.fixture
def hospital(accounts):
    return accounts[1]


@pytest.fixture
def hospital2(accounts):
    return accounts[2]


@pytest.fixture
def patient(accounts):
    return accounts[3]


@pytest.fixture
def doctor(accounts):
    return accounts[4]


@pytest.fixture
def external_writer(accounts):
    return accounts[5]


@pytest.fixture
def ehr(admin, project):
    # deploy contract
    return admin.deploy(project.EHRRegistry, "EHR Registry", "EHR")


# ----------------------------
# Common setup helper
# ----------------------------
def _setup_hospital_and_mint(ehr, admin, hospital, patient, token_id=1, cid="cid_root"):
    ehr.register_hospital(hospital, sender=admin)
    receipt = ehr.mint_record(token_id, patient, cid, sender=hospital)
    return receipt


# ============================================================
# ERC-165 + ERC-721 (core + metadata) compliance tests
# ============================================================
def test_erc721_metadata_name_symbol(ehr):
    assert ehr.name() == "EHR Registry"
    assert ehr.symbol() == "EHR"


def test_erc165_supports_interface(ehr):
    assert ehr.supportsInterface(ERC165_ID) is True
    assert ehr.supportsInterface(ERC721_ID) is True
    assert ehr.supportsInterface(ERC721_METADATA_ID) is True
    assert ehr.supportsInterface(UNKNOWN_ID) is False


def test_balanceOf_zero_address_reverts(ehr):
    with ape.reverts("zero address"):
        ehr.balanceOf(ZERO_ADDR)


def test_ownerOf_nonexistent_reverts(ehr):
    with ape.reverts("token does not exist"):
        ehr.ownerOf(999)


def test_tokenURI_nonexistent_reverts(ehr):
    with ape.reverts("token does not exist"):
        ehr.tokenURI(999)


def test_mint_emits_erc721_transfer_and_mint_event(ehr, admin, hospital, patient):
    receipt = _setup_hospital_and_mint(ehr, admin, hospital, patient, token_id=1, cid="cid_root")

    # ERC-721 state
    assert ehr.exists_token(1) is True
    assert ehr.ownerOf(1) == patient
    assert ehr.balanceOf(patient) == 1
    assert ehr.tokenURI(1) == "cid_root"
    assert ehr.get_steward(1) == hospital

    # Custom Mint event
    mint_logs = ehr.Mint.from_receipt(receipt)
    assert len(mint_logs) == 1
    assert mint_logs[0].tokenId == 1
    assert mint_logs[0].patient == patient
    assert mint_logs[0].steward == hospital
    assert mint_logs[0].cid == "cid_root"

    # ERC-721 Transfer event: from ZERO -> patient
    transfer_logs = ehr.Transfer.from_receipt(receipt)
    assert len(transfer_logs) == 1
    assert _addr(transfer_logs[0]._from) == ZERO_ADDR.lower()
    assert _addr(transfer_logs[0]._to) == _addr(patient)
    assert transfer_logs[0]._tokenId == 1


def test_burn_emits_erc721_transfer_to_zero(ehr, admin, hospital, patient):
    _setup_hospital_and_mint(ehr, admin, hospital, patient, token_id=1, cid="cid_root")

    receipt = ehr.burn(1, sender=patient)

    assert ehr.exists_token(1) is False
    assert ehr.balanceOf(patient) == 0

    transfer_logs = ehr.Transfer.from_receipt(receipt)
    assert len(transfer_logs) == 1
    assert _addr(transfer_logs[0]._from) == _addr(patient)
    assert _addr(transfer_logs[0]._to) == ZERO_ADDR.lower()
    assert transfer_logs[0]._tokenId == 1


def test_non_transferable_all_transfer_methods_revert(ehr, admin, hospital, patient):
    _setup_hospital_and_mint(ehr, admin, hospital, patient, token_id=1, cid="cid_root")

    with ape.reverts("non-transferable"):
        ehr.transferFrom(patient, admin, 1, sender=patient)

    with ape.reverts("non-transferable"):
        ehr.safeTransferFrom(patient, admin, 1, sender=patient)

    with ape.reverts("non-transferable"):
        ehr.safeTransferFrom_withData(patient, admin, 1, b"1234", sender=patient)


def test_approve_and_getApproved_works_even_if_soulbound(ehr, admin, hospital, patient):
    _setup_hospital_and_mint(ehr, admin, hospital, patient, token_id=1, cid="cid_root")

    receipt = ehr.approve(admin, 1, sender=patient)

    assert ehr.getApproved(1) == admin

    approval_logs = ehr.Approval.from_receipt(receipt)
    assert len(approval_logs) == 1
    assert approval_logs[0]._owner == patient
    assert approval_logs[0]._approved == admin
    assert approval_logs[0]._tokenId == 1

    # Approve does NOT enable transfer (still reverts)
    with ape.reverts("non-transferable"):
        ehr.transferFrom(patient, admin, 1, sender=admin)


def test_setApprovalForAll_and_isApprovedForAll(ehr, admin, hospital, patient, doctor):
    _setup_hospital_and_mint(ehr, admin, hospital, patient, token_id=1, cid="cid_root")

    # cannot set self as operator
    with ape.reverts("self operator"):
        ehr.setApprovalForAll(patient, True, sender=patient)

    receipt = ehr.setApprovalForAll(admin, True, sender=patient)
    assert ehr.isApprovedForAll(patient, admin) is True

    logs = ehr.ApprovalForAll.from_receipt(receipt)
    assert len(logs) == 1
    assert logs[0]._owner == patient
    assert logs[0]._operator == admin
    assert_event_bool(logs[0]._approved, True)

    # operator can approve on behalf of owner
    receipt2 = ehr.approve(doctor, 1, sender=admin)
    assert ehr.getApproved(1) == doctor

    logs2 = ehr.Approval.from_receipt(receipt2)
    assert len(logs2) == 1
    assert logs2[0]._owner == patient
    assert logs2[0]._approved == doctor
    assert logs2[0]._tokenId == 1


# ============================================================
# Access control: admin / hospital / doctor / patient
# ============================================================
def test_only_owner_can_register_hospital(ehr, hospital, patient):
    with ape.reverts("only contract owner"):
        ehr.register_hospital(hospital, sender=patient)


def test_register_hospital_and_unregister(ehr, admin, hospital):
    ehr.register_hospital(hospital, sender=admin)
    assert ehr.hospitals(hospital) is True

    ehr.unregister_hospital(hospital, sender=admin)
    assert ehr.hospitals(hospital) is False


def test_register_hospital_zero_address_reverts(ehr, admin):
    with ape.reverts("invalid hospital"):
        ehr.register_hospital(ZERO_ADDR, sender=admin)


def test_only_registered_hospital_can_register_doctor(ehr, admin, hospital, doctor, patient):
    # not registered hospital -> cannot call register_doctor
    with ape.reverts("only registered hospital"):
        ehr.register_doctor(doctor, sender=hospital)

    ehr.register_hospital(hospital, sender=admin)
    ehr.register_doctor(doctor, sender=hospital)
    assert ehr.doctor_hospital(doctor) == hospital

    # non-hospital cannot call unregister_doctor
    with ape.reverts("only registered hospital"):
        ehr.unregister_doctor(doctor, sender=patient)


def test_register_doctor_zero_address_reverts(ehr, admin, hospital):
    ehr.register_hospital(hospital, sender=admin)
    with ape.reverts("invalid doctor"):
        ehr.register_doctor(ZERO_ADDR, sender=hospital)


def test_only_registered_hospital_can_mint(ehr, patient):
    with ape.reverts("only registered hospital"):
        ehr.mint_record(1, patient, "cid", sender=patient)


def test_mint_requires_nonzero_patient(ehr, admin, hospital):
    ehr.register_hospital(hospital, sender=admin)
    with ape.reverts("invalid patient"):
        ehr.mint_record(1, ZERO_ADDR, "cid", sender=hospital)


def test_mint_same_tokenId_reverts(ehr, admin, hospital, patient):
    ehr.register_hospital(hospital, sender=admin)
    ehr.mint_record(1, patient, "cid1", sender=hospital)
    with ape.reverts("token exists"):
        ehr.mint_record(1, patient, "cid2", sender=hospital)


# ============================================================
# Delegation + internal/external write permissions + add_entry
# ============================================================
def test_delegate_requires_patient_and_registered_hospital(ehr, admin, hospital, hospital2, patient):
    ehr.register_hospital(hospital, sender=admin)
    # mint by hospital
    ehr.mint_record(1, patient, "cid", sender=hospital)

    # only patient
    with ape.reverts("only patient"):
        ehr.delegate_hospital(1, hospital, sender=hospital)

    # hospital must be registered
    with ape.reverts("hospital not registered"):
        ehr.delegate_hospital(1, hospital2, sender=patient)

    # register then delegate ok
    ehr.register_hospital(hospital2, sender=admin)
    receipt = ehr.delegate_hospital(1, hospital2, sender=patient)
    assert ehr.hospital_delegates(1, hospital2) is True

    logs = ehr.HospitalDelegated.from_receipt(receipt)
    assert len(logs) == 1
    assert logs[0].tokenId == 1
    assert logs[0].patient == patient
    assert logs[0].hospital == hospital2
    assert_event_bool(logs[0].delegated, True)


def test_revoke_delegate_emits_event_and_blocks_future_grants(ehr, admin, hospital, hospital2, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_hospital(hospital2, sender=admin)

    ehr.register_doctor(doctor, sender=hospital2)

    ehr.mint_record(1, patient, "cid", sender=hospital)
    ehr.delegate_hospital(1, hospital2, sender=patient)

    receipt = ehr.revoke_hospital_delegate(1, hospital2, sender=patient)
    assert ehr.hospital_delegates(1, hospital2) is False

    logs = ehr.HospitalDelegated.from_receipt(receipt)
    assert len(logs) == 1
    assert_event_bool(logs[0].delegated, False)

    with ape.reverts("not steward or delegated hospital"):
        ehr.hospital_grant_write(1, doctor, sender=hospital2)


def test_steward_can_grant_and_revoke_internal_write(ehr, admin, hospital, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_doctor(doctor, sender=hospital)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    receipt = ehr.hospital_grant_write(1, doctor, sender=hospital)
    assert ehr.internal_write_permissions(1, doctor) is True

    logs = ehr.HospitalGranted.from_receipt(receipt)
    assert len(logs) == 1
    assert logs[0].tokenId == 1
    assert logs[0].hospital == hospital
    assert logs[0].doctor == doctor
    assert_event_bool(logs[0].granted, True)

    receipt2 = ehr.hospital_revoke_write(1, doctor, sender=hospital)
    assert ehr.internal_write_permissions(1, doctor) is False

    logs2 = ehr.HospitalGranted.from_receipt(receipt2)
    assert len(logs2) == 1
    assert_event_bool(logs2[0].granted, False)


def test_delegated_hospital_can_grant_internal_write(ehr, admin, hospital, hospital2, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_hospital(hospital2, sender=admin)

    # doctor belongs to hospital2
    ehr.register_doctor(doctor, sender=hospital2)

    ehr.mint_record(1, patient, "cid", sender=hospital)

    ehr.delegate_hospital(1, hospital2, sender=patient)
    ehr.hospital_grant_write(1, doctor, sender=hospital2)

    assert ehr.internal_write_permissions(1, doctor) is True


def test_unauthorized_hospital_cannot_grant(ehr, admin, hospital, hospital2, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_hospital(hospital2, sender=admin)
    ehr.register_doctor(doctor, sender=hospital2)

    ehr.mint_record(1, patient, "cid", sender=hospital)

    with ape.reverts("not steward or delegated hospital"):
        ehr.hospital_grant_write(1, doctor, sender=hospital2)


def test_external_write_grant_and_revoke(ehr, admin, hospital, patient, external_writer):
    ehr.register_hospital(hospital, sender=admin)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    ehr.grant_external_write(1, external_writer, sender=patient)
    assert ehr.external_write_grants(1, external_writer) is True

    ehr.revoke_external_write(1, external_writer, sender=patient)
    assert ehr.external_write_grants(1, external_writer) is False


def test_external_write_only_patient(ehr, admin, hospital, patient, external_writer):
    ehr.register_hospital(hospital, sender=admin)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    with ape.reverts("only patient"):
        ehr.grant_external_write(1, external_writer, sender=hospital)

    with ape.reverts("only patient"):
        ehr.revoke_external_write(1, external_writer, sender=hospital)


def test_grant_external_write_invalid_grantee_reverts(ehr, admin, hospital, patient):
    ehr.register_hospital(hospital, sender=admin)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    with ape.reverts("invalid grantee"):
        ehr.grant_external_write(1, ZERO_ADDR, sender=patient)


def test_add_entry_internal_permission_emits_event(ehr, admin, hospital, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_doctor(doctor, sender=hospital)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    ehr.hospital_grant_write(1, doctor, sender=hospital)
    receipt = ehr.add_entry(1, "entry1", sender=doctor)

    logs = ehr.EntryAdded.from_receipt(receipt)
    assert len(logs) == 1
    assert logs[0].tokenId == 1
    assert logs[0].author == doctor
    assert logs[0].entryCid == "entry1"
    assert logs[0].timestamp > 0


def test_add_entry_external_permission_emits_event(ehr, admin, hospital, patient, external_writer):
    ehr.register_hospital(hospital, sender=admin)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    ehr.grant_external_write(1, external_writer, sender=patient)
    receipt = ehr.add_entry(1, "entry_ext", sender=external_writer)

    logs = ehr.EntryAdded.from_receipt(receipt)
    assert len(logs) == 1
    assert logs[0].tokenId == 1
    assert logs[0].author == external_writer
    assert logs[0].entryCid == "entry_ext"


def test_add_entry_without_permission_reverts(ehr, admin, hospital, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    with ape.reverts("no write permission"):
        ehr.add_entry(1, "fail", sender=doctor)


def test_revoke_internal_write_blocks_entry(ehr, admin, hospital, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_doctor(doctor, sender=hospital)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    ehr.hospital_grant_write(1, doctor, sender=hospital)
    ehr.hospital_revoke_write(1, doctor, sender=hospital)

    with ape.reverts("no write permission"):
        ehr.add_entry(1, "fail", sender=doctor)


def test_revoke_external_write_blocks_entry(ehr, admin, hospital, patient, external_writer):
    ehr.register_hospital(hospital, sender=admin)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    ehr.grant_external_write(1, external_writer, sender=patient)
    ehr.revoke_external_write(1, external_writer, sender=patient)

    with ape.reverts("no write permission"):
        ehr.add_entry(1, "fail", sender=external_writer)


def test_can_write_view_helper(ehr, admin, hospital, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_doctor(doctor, sender=hospital)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    assert ehr.can_write(1, doctor) is False
    ehr.hospital_grant_write(1, doctor, sender=hospital)
    assert ehr.can_write(1, doctor) is True


# ============================================================
# Burn permissions + token_counter + roles
# ============================================================
def test_burn_by_patient_steward_admin(ehr, admin, hospital, patient):
    ehr.register_hospital(hospital, sender=admin)

    ehr.mint_record(1, patient, "cid1", sender=hospital)
    receipt1 = ehr.burn(1, sender=patient)
    assert ehr.exists_token(1) is False
    assert len(ehr.Transfer.from_receipt(receipt1)) == 1

    ehr.mint_record(2, patient, "cid2", sender=hospital)
    receipt2 = ehr.burn(2, sender=hospital)
    assert ehr.exists_token(2) is False
    assert len(ehr.Transfer.from_receipt(receipt2)) == 1

    ehr.mint_record(3, patient, "cid3", sender=hospital)
    receipt3 = ehr.burn(3, sender=admin)
    assert ehr.exists_token(3) is False
    assert len(ehr.Transfer.from_receipt(receipt3)) == 1


def test_burn_not_permitted_reverts(ehr, admin, hospital, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    with ape.reverts("not permitted"):
        ehr.burn(1, sender=doctor)


def test_token_counter_increments(ehr, admin, hospital, patient):
    ehr.register_hospital(hospital, sender=admin)
    assert ehr.token_counter() == 0

    ehr.mint_record(1, patient, "cid1", sender=hospital)
    assert ehr.token_counter() == 1

    ehr.mint_record(2, patient, "cid2", sender=hospital)
    assert ehr.token_counter() == 2


def test_getRole_matches_contract_logic(ehr, admin, hospital, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_doctor(doctor, sender=hospital)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    assert ehr.getRole(admin) == "contract_owner"
    assert ehr.getRole(hospital) == "hospital"
    assert ehr.getRole(doctor) == "doctor"
    assert ehr.getRole(patient) == "patient"

    # burn last token => patient becomes "none" (because balances[addr] == 0)
    ehr.burn(1, sender=patient)
    assert ehr.getRole(patient) == "none"


def test_unregistered_hospital_still_steward_can_grant(ehr, admin, hospital, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_doctor(doctor, sender=hospital)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    # unregister hospital in registry, but it remains steward for tokenId=1
    ehr.unregister_hospital(hospital, sender=admin)

    ehr.hospital_grant_write(1, doctor, sender=hospital)
    assert ehr.internal_write_permissions(1, doctor) is True
