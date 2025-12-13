import pytest

# Tests for EHRRegistry.vy using Ape + pytest
# Assumptions:
# - Contract name: EHRRegistry
# - Deployed via ape
# - Accounts fixture available (accounts[0], accounts[1], ...)

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


def test_register_hospital(ehr, admin, hospital):
    ehr.register_hospital(hospital, sender=admin)
    assert ehr.hospitals(hospital) is True


def test_only_owner_can_register_hospital(ehr, hospital, patient):
    with pytest.raises(Exception):
        ehr.register_hospital(hospital, sender=patient)


def test_hospital_register_doctor(ehr, admin, hospital, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_doctor(doctor, sender=hospital)
    assert ehr.doctor_hospital(doctor) == hospital


def test_mint_record(ehr, admin, hospital, patient):
    ehr.register_hospital(hospital, sender=admin)
    ehr.mint_record(1, patient, "cid_root", sender=hospital)

    assert ehr.exists_token(1) is True
    assert ehr.ownerOf(1) == patient
    assert ehr.get_steward(1) == hospital
    assert ehr.balanceOf(patient) == 1


def test_only_hospital_can_mint(ehr, patient):
    with pytest.raises(Exception):
        ehr.mint_record(1, patient, "cid", sender=patient)


def test_delegate_hospital(ehr, admin, hospital, hospital2, patient):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_hospital(hospital2, sender=admin)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    ehr.delegate_hospital(1, hospital2, sender=patient)
    assert ehr.hospital_delegates(1, hospital2) is True


def test_grant_internal_write_by_steward(ehr, admin, hospital, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_doctor(doctor, sender=hospital)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    ehr.hospital_grant_write(1, doctor, sender=hospital)
    assert ehr.internal_write_permissions(1, doctor) is True


def test_grant_internal_write_by_delegated_hospital(ehr, admin, hospital, hospital2, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_hospital(hospital2, sender=admin)
    ehr.register_doctor(doctor, sender=hospital2)

    ehr.mint_record(1, patient, "cid", sender=hospital)
    ehr.delegate_hospital(1, hospital2, sender=patient)

    ehr.hospital_grant_write(1, doctor, sender=hospital2)
    assert ehr.internal_write_permissions(1, doctor) is True


def test_external_write_grant(ehr, admin, hospital, patient, external_writer):
    ehr.register_hospital(hospital, sender=admin)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    ehr.grant_external_write(1, external_writer, sender=patient)
    assert ehr.external_write_grants(1, external_writer) is True


def test_add_entry_internal_doctor(ehr, admin, hospital, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_doctor(doctor, sender=hospital)
    ehr.mint_record(1, patient, "cid", sender=hospital)
    ehr.hospital_grant_write(1, doctor, sender=hospital)

    tx = ehr.add_entry(1, "entry1", sender=doctor)
    assert len(tx.events) == 1
    assert tx.events[0].tokenId == 1


def test_add_entry_external_writer(ehr, admin, hospital, patient, external_writer):
    ehr.register_hospital(hospital, sender=admin)
    ehr.mint_record(1, patient, "cid", sender=hospital)
    ehr.grant_external_write(1, external_writer, sender=patient)

    tx = ehr.add_entry(1, "entry_ext", sender=external_writer)
    assert tx.events[0].author == external_writer


def test_add_entry_without_permission_should_fail(ehr, admin, hospital, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    with pytest.raises(Exception):
        ehr.add_entry(1, "fail", sender=doctor)


def test_burn_by_patient(ehr, admin, hospital, patient):
    ehr.register_hospital(hospital, sender=admin)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    ehr.burn(1, sender=patient)
    assert ehr.exists_token(1) is False


def test_non_transferable(ehr, admin, hospital, patient):
    ehr.register_hospital(hospital, sender=admin)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    with pytest.raises(Exception):
        ehr.transferFrom(patient, admin, 1, sender=patient)

def test_revoke_delegate_blocks_grant(ehr, admin, hospital, hospital2, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_hospital(hospital2, sender=admin)
    ehr.register_doctor(doctor, sender=hospital2)

    ehr.mint_record(1, patient, "cid", sender=hospital)
    ehr.delegate_hospital(1, hospital2, sender=patient)
    ehr.revoke_hospital_delegate(1, hospital2, sender=patient)

    with pytest.raises(Exception):
        ehr.hospital_grant_write(1, doctor, sender=hospital2)

def test_revoke_internal_write_blocks_entry(ehr, admin, hospital, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_doctor(doctor, sender=hospital)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    ehr.hospital_grant_write(1, doctor, sender=hospital)
    ehr.hospital_revoke_write(1, doctor, sender=hospital)

    with pytest.raises(Exception):
        ehr.add_entry(1, "fail", sender=doctor)

def test_unauthorized_hospital_cannot_grant(ehr, admin, hospital, hospital2, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_hospital(hospital2, sender=admin)
    ehr.register_doctor(doctor, sender=hospital2)

    ehr.mint_record(1, patient, "cid", sender=hospital)

    with pytest.raises(Exception):
        ehr.hospital_grant_write(1, doctor, sender=hospital2)

def test_get_role(ehr, admin, hospital, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_doctor(doctor, sender=hospital)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    assert ehr.getRole(admin) == "contract_owner"
    assert ehr.getRole(hospital) == "hospital"
    assert ehr.getRole(doctor) == "doctor"
    assert ehr.getRole(patient) == "patient"

def test_burn_by_steward_and_admin(ehr, admin, hospital, patient):
    ehr.register_hospital(hospital, sender=admin)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    ehr.burn(1, sender=hospital)
    assert ehr.exists_token(1) is False

    ehr.mint_record(2, patient, "cid2", sender=hospital)
    ehr.burn(2, sender=admin)
    assert ehr.exists_token(2) is False

def test_revoke_external_write_blocks_entry(ehr, admin, hospital, patient, external_writer):
    ehr.register_hospital(hospital, sender=admin)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    ehr.grant_external_write(1, external_writer, sender=patient)
    ehr.revoke_external_write(1, external_writer, sender=patient)

    with pytest.raises(Exception):
        ehr.add_entry(1, "fail", sender=external_writer)

def test_can_write_helper(ehr, admin, hospital, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_doctor(doctor, sender=hospital)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    assert ehr.can_write(1, doctor) is False

    ehr.hospital_grant_write(1, doctor, sender=hospital)
    assert ehr.can_write(1, doctor) is True

def test_unregistered_hospital_still_steward(ehr, admin, hospital, patient, doctor):
    ehr.register_hospital(hospital, sender=admin)
    ehr.register_doctor(doctor, sender=hospital)
    ehr.mint_record(1, patient, "cid", sender=hospital)

    ehr.unregister_hospital(hospital, sender=admin)

    # vẫn grant được vì là steward
    ehr.hospital_grant_write(1, doctor, sender=hospital)
    assert ehr.internal_write_permissions(1, doctor) is True
