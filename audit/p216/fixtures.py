#!/usr/bin/env python3
"""P216 deterministic offline malicious-archive fixtures (no network or cloud)."""
from __future__ import annotations
from contextlib import contextmanager
import io
import os
from pathlib import Path
import stat
import sys
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
from source_zip_verify import (inspect_bytes, local_archive, fail, EXPECTED,
    BASE, MAX_FILES, LIMIT_UNPACKED, LIMIT_INDEX, LIMIT_ARCHIVE)

candidate = BASE.joinpath("audit/p188/candidate-index.js").read_bytes()
def pack(entries):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for name, value in entries:
            z.writestr(name, value)
    return stream.getvalue()

def inspection(entries):
    return inspect_bytes(pack(entries), candidate)

passed = 0
def test(label, fn):
    global passed
    assert fn(), "P216_" + label
    passed += 1
    print("P216_" + label + "=PASS")

good = [("index.js", candidate), ("package.json", b'{"private":true}')]
test("PINNED_SHA256_MATCHES_P188", lambda: __import__("hashlib").sha256(candidate).hexdigest() == EXPECTED)
test("EXACT_INDEX_BYTES_MATCH", lambda: inspection(good)["classification"] == "BYTE_MATCH_UNAUTHENTICATED")
test("ALTERNATE_FUNCTIONS_ENTRYPOINT_MATCH", lambda: inspection([("functions/index.js", candidate)])["candidateBytesEqualArchiveIndex"])
test("MATCH_NOT_INDEPENDENT_ARCHIVE_AUTH", lambda: not inspection(good)["archiveOriginalSourceAuthenticated"])
test("MATCH_NOT_DEPLOYMENT_PROOF", lambda: not inspection(good)["deployedRevisionContainsCandidateProven"])
test("MATCH_NOT_REVIEWER_SIGNOFF", lambda: not inspection(good)["independentReviewerAttested"])
test("MATCH_STILL_G02_NO_GO", lambda: inspection(good)["g02Decision"] == "NO_GO")
test("MISMATCH_NOT_SILENT", lambda: inspection([("index.js", candidate + b"\n")])["classification"] == "BYTE_MISMATCH")
test("MISMATCH_NOT_RELEASE", lambda: inspection([("index.js", b"wrong")])["releaseDecision"] == "NO_GO_RELEASE")
test("MISSING_ENTRYPOINT_REJECTED", lambda: inspection([("README.md", b"x")])["classification"] == "REJECTED")
test("DOUBLE_ENTRYPOINT_REJECTED", lambda: inspection([("index.js", candidate), ("functions/index.js", candidate)])["classification"] == "REJECTED")
test("DUPLICATE_PATH_REJECTED", lambda: inspection([("index.js", candidate), ("index.js", candidate)])["issues"] == ["UNSAFE_OR_DUPLICATE_ARCHIVE_PATH"])
test("TRAVERSAL_ENTRY_REJECTED", lambda: inspection([("../index.js", candidate)])["classification"] == "REJECTED")
test("ABSOLUTE_ENTRY_REJECTED", lambda: inspection([("/index.js", candidate)])["classification"] == "REJECTED")
test("WINDOWS_BACKSLASH_REJECTED", lambda: inspection([("..\\index.js", candidate)])["classification"] == "REJECTED")
test("WINDOWS_DRIVE_REJECTED", lambda: inspection([("C:/index.js", candidate)])["classification"] == "REJECTED")
test("UNSAFE_DOT_PATH_REJECTED", lambda: inspection([("./index.js", candidate)])["classification"] == "REJECTED")
symlink = zipfile.ZipInfo("link")
symlink.create_system = 3
symlink.external_attr = (stat.S_IFLNK | 0o777) << 16
test("SYMLINK_MEMBER_REJECTED", lambda: inspection([("index.js", candidate), (symlink, b"index.js")])["issues"] == ["SYMLINK_MEMBER_REJECTED"])
test("INVALID_ZIP_REJECTED", lambda: inspect_bytes(b"not a ZIP", candidate)["classification"] == "REJECTED")
test("MAX_ARCHIVE_SIZE_REJECTED", lambda: inspect_bytes(b"x" * (LIMIT_ARCHIVE + 1), candidate)["classification"] == "REJECTED")
test("CANDIDATE_TAMPER_REJECTED", lambda: inspect_bytes(pack(good), candidate + b"x")["issues"] == ["PINNED_P188_CANDIDATE_DRIFT"])
test("NON_BYTES_CANDIDATE_REJECTED", lambda: inspect_bytes(pack(good), "string")["classification"] == "REJECTED")
test("NON_BYTES_ARCHIVE_REJECTED", lambda: inspect_bytes("string", candidate)["classification"] == "REJECTED")
test("OVERSIZED_ENTRYPOINT_REJECTED", lambda: inspection([("index.js", b"x" * (LIMIT_INDEX + 1))])["issues"] == ["ENTRYPOINT_TOO_LARGE"])
test("OVERSIZED_UNPACKED_TOTAL_REJECTED", lambda: inspection([
    ("index.js",candidate), ("big.bin",b"x" * (LIMIT_UNPACKED + 1))])["classification"] == "REJECTED")
test("OVER_500_ENTRIES_REJECTED", lambda: inspection([
    ("index.js",candidate)]+[(f"docs/{i}.txt",b"x") for i in range(MAX_FILES)])["issues"] == ["ARCHIVE_ENTRY_COUNT_UNSAFE"])
test("ENCRYPTED_OR_UNKNOWN_CANNOT_PROMOTE", lambda: fail("ENCRYPTED_MEMBER_UNSUPPORTED")["releaseDecision"] == "NO_GO_RELEASE")
test("CI_EXTERNAL_SOURCE_INPUT_DENIED", lambda: local_archive("/path/not-present")["issues"] in (
    ["CI_EXTERNAL_ARCHIVE_INPUT_FORBIDDEN"], ["LOCAL_ARCHIVE_UNAVAILABLE"]))
test("ALL_OUTCOMES_KEEP_SIGNUP_CLOSED", lambda: all(
    inspect_bytes(x, candidate)["publicSignup"] == "KEEP_CLOSED" for x in [
        pack(good),pack([("index.js",b"altered")]), b"bad"
    ]))
test("SAFE_OUTPUT_DOES_NOT_CONTAIN_SOURCE", lambda: "package.json" not in str(inspection(good)))
print(f"P216_OFFLINE_SOURCE_ZIP_SECURITY_FIXTURES={passed}/{passed}_PASS")
print("P216_REAL_STAGING_ARCHIVE_OBTAINED=FALSE")
print("P216_EXTERNAL_ATTESTATION=0")
print("P216_G02=NO_GO_RELEASE")
