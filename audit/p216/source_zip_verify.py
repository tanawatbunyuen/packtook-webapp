#!/usr/bin/env python3
"""P216: offline only; inspect protected archive locally, never upload to CI.
Comparing a ZIP's index.js bytes with P188 is not deployment or reviewer proof.
"""
from __future__ import annotations
import hashlib
import io
import json
import os
from pathlib import Path
import re
import stat
import sys
import zipfile

BASE = Path(__file__).resolve().parents[2]
EXPECTED = "c599056ccc227ffbf76fd9d582ecbd3cec1bf516437e72b0d097ac2e07a3978b"
ALLOWED_INDEX = {"index.js", "functions/index.js"}
LIMIT_ARCHIVE = 16 * 1024 * 1024
LIMIT_UNPACKED = 32 * 1024 * 1024
LIMIT_INDEX = 2 * 1024 * 1024
MAX_FILES = 500

def fail(code):
    return {
        "schema": "packtook-p216-source-archive-byte-verifier-v1",
        "classification": "REJECTED",
        "issues": [code],
        "candidateBytesEqualArchiveIndex": False,
        "archiveOriginalSourceAuthenticated": False,
        "deployedRevisionContainsCandidateProven": False,
        "independentReviewerAttested": False,
        "g02Decision": "NO_GO",
        "releaseDecision": "NO_GO_RELEASE",
        "deployDecision": "NO_GO_DEPLOY",
        "publicSignup": "KEEP_CLOSED",
    }

def safe_name(name):
    if not isinstance(name, str) or "\x00" in name or "\\" in name:
        return False
    if name.startswith("/") or re.match(r"^[a-zA-Z]:", name):
        return False
    segments = name.rstrip("/").split("/")
    return bool(segments) and all(x not in ("", ".", "..") for x in segments)

def inspect_bytes(content, candidate):
    """Only package contents; not source provenance or Cloud Build authentication."""
    if not isinstance(content, bytes) or len(content) > LIMIT_ARCHIVE:
        return fail("ARCHIVE_TOO_LARGE_OR_INVALID")
    if not isinstance(candidate, bytes):
        return fail("CANDIDATE_BYTES_INVALID")
    if hashlib.sha256(candidate).hexdigest() != EXPECTED:
        return fail("PINNED_P188_CANDIDATE_DRIFT")
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            infos = archive.infolist()
            if not infos or len(infos) > MAX_FILES:
                return fail("ARCHIVE_ENTRY_COUNT_UNSAFE")
            seen = set()
            unpacked = 0
            indexes = []
            for info in infos:
                name = info.filename
                if not safe_name(name) or name in seen:
                    return fail("UNSAFE_OR_DUPLICATE_ARCHIVE_PATH")
                seen.add(name)
                if info.flag_bits & 1:
                    return fail("ENCRYPTED_MEMBER_UNSUPPORTED")
                if info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                    return fail("ARCHIVE_COMPRESSION_UNSUPPORTED")
                if info.create_system == 3:
                    mode = info.external_attr >> 16
                    if stat.S_ISLNK(mode):
                        return fail("SYMLINK_MEMBER_REJECTED")
                    if stat.S_IFMT(mode) and not (stat.S_ISREG(mode) or stat.S_ISDIR(mode)):
                        return fail("UNSAFE_ENTRY_TYPE")
                if info.file_size < 0 or info.file_size > LIMIT_UNPACKED:
                    return fail("UNSAFE_MEMBER_SIZE")
                unpacked += info.file_size
                if unpacked > LIMIT_UNPACKED:
                    return fail("ARCHIVE_UNPACKED_SIZE_EXCEEDED")
                if not info.is_dir() and name in ALLOWED_INDEX:
                    indexes.append(info)
            if len(indexes) != 1:
                return fail("EXACTLY_ONE_ENTRYPOINT_REQUIRED")
            index = indexes[0]
            if index.file_size > LIMIT_INDEX:
                return fail("ENTRYPOINT_TOO_LARGE")
            # Read only the entrypoint, bounded; do not extract other files.
            with archive.open(index, "r") as src:
                source = src.read(LIMIT_INDEX + 1)
            if len(source) != index.file_size or len(source) > LIMIT_INDEX:
                return fail("ENTRYPOINT_SIZE_MISMATCH")
    except (zipfile.BadZipFile, RuntimeError, OSError, EOFError, ValueError,
            NotImplementedError, OverflowError):
        return fail("MALFORMED_OR_UNSUPPORTED_ZIP")
    equal = source == candidate
    return {
        "schema": "packtook-p216-source-archive-byte-verifier-v1",
        "classification": "BYTE_MATCH_UNAUTHENTICATED" if equal else "BYTE_MISMATCH",
        "issues": [] if equal else ["ENTRYPOINT_BYTES_DIFFER_FROM_P188_CANDIDATE"],
        "candidateBytesEqualArchiveIndex": equal,
        "archiveOriginalSourceAuthenticated": False,
        "deployedRevisionContainsCandidateProven": False,
        "independentReviewerAttested": False,
        "g02Decision": "NO_GO",
        "releaseDecision": "NO_GO_RELEASE",
        "deployDecision": "NO_GO_DEPLOY",
        "publicSignup": "KEEP_CLOSED",
    }

def local_archive(path):
    # No cloud transfer and no external archives in CI.
    if os.environ.get("CI") == "true" or os.environ.get("GITHUB_ACTIONS") == "true":
        return fail("CI_EXTERNAL_ARCHIVE_INPUT_FORBIDDEN")
    try:
        f = Path(path)
        if f.is_symlink() or not f.is_file() or f.stat().st_size > LIMIT_ARCHIVE:
            return fail("UNTRUSTED_LOCAL_ARCHIVE")
        candidate = BASE.joinpath("audit/p188/candidate-index.js").read_bytes()
        return inspect_bytes(f.read_bytes(), candidate)
    except (OSError, ValueError):
        return fail("LOCAL_ARCHIVE_UNAVAILABLE")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        r = fail("LOCAL_ZIP_PATH_REQUIRED")
    else:
        r = local_archive(sys.argv[1])
    # Never print archive source/paths, ZIP metadata or secret contents.
    print(json.dumps(r, sort_keys=True))
    print("P216_G02=NO_GO_RELEASE")
    if r["classification"] == "REJECTED":
        sys.exit(1)
