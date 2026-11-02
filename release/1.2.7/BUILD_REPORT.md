# v1.2.7 Build and Qualification Report

- Baseline: reproducible official v1.2.6 source archive provided in this conversation.
- Version: v1.2.7; API v1.3.0; Actor state schema 1 (unchanged).
- Automated validation: `npm run check` (130 tests passed, JavaScript syntax validated).
- Locale parity: verified English and German.
- Reproduction: `python3 tools/package.py --output-dir <path>` from source package root.
- All three archives passed `unzip -t`; freshly extracted source independently passed 130/130 automated tests.
- Two independent provisional builds produced byte-identical archives for all three release ZIPs; final builds are independently compared again.
- Manual runtime validation in live Foundry 13.351 remains necessary (see checklist); not falsely claimed as performed.
