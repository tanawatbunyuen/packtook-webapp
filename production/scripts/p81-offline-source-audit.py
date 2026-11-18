#!/usr/bin/env python3
"""P81: conservative local source audit; never calls cloud or modifies files."""
import argparse
import pathlib
import re
import sys

TARGETS = ('recordingStatus', 'usageStatus')

def audit(source):
    wrapper = bool(re.search(r'function\s+guardedCall\s*\([^)]*\)\s*\{', source))
    lease = bool(re.search(r'function\s+guardedCall\b[\s\S]*?requirePilotLease\s*\(\s*req\s*,\s*\{\s*claimRequired\s*:\s*true\s*\}', source))
    calls = {n: bool(re.search(r'exports\.' + n + r'\s*=\s*guardedCall\s*\(\s*options\s*,', source)) for n in TARGETS}
    default_options = re.search(r'const\s+options\s*=\s*\{([^{}]*)\}', source)
    explicit_appcheck = bool(default_options and re.search(r'\benforceAppCheck\s*:\s*true\b', default_options.group(1)))
    return dict(wrapper=wrapper, pilot_lease=lease, calls=calls, appcheck_in_shared_options=explicit_appcheck)

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--source', required=True, type=pathlib.Path)
    args = p.parse_args()
    try:
        result = audit(args.source.read_text(encoding='utf-8'))
    except (OSError, UnicodeError):
        print('P81_OFFLINE_SOURCE=NOT_VERIFIABLE')
        return 2
    guarded = result['wrapper'] and result['pilot_lease'] and all(result['calls'].values())
    print('P81_REVIEW_GUARDED_CALLS=' + ('PASS' if guarded else 'FAIL'))
    print('P81_REVIEW_SHARED_OPTIONS_APPCHECK=' + ('TRUE_LITERAL' if result['appcheck_in_shared_options'] else 'NOT_PROVEN'))
    print('P81_DEPLOYED_SOURCE_MATCH=NOT_VERIFIED')
    print('P81_BACKEND_APPCHECK=NOT_PROVEN')
    print('P81_IAM_LEAST_PRIVILEGE=NOT_VERIFIED')
    print('P81_CLOUD_WRITES=0')
    print('P81_DEPLOY=0')
    print('P81_RELEASE=NO_GO_RELEASE')
    return 0 if guarded else 2

if __name__ == '__main__':
    sys.exit(main())
