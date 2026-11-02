# v1.2.8 Build and Qualification Report

- Baseline: v1.2.7 source ZIP.
- Patch: v1.2.8; public API 1.3.0, Actor-state schema 1 unchanged.
- Automated validation: see TEST_RESULTS.txt for the full `node tools/check.mjs` output.
- Fresh extraction validation: see EXTRACTED_SOURCE_TEST_RESULTS.txt.
- Reproduction: `python3 tools/package.py --output-dir <absolute-output-directory>` from the extracted source root.
- Independent build determinism and archive integrity: see FINAL_QUALIFICATION.txt.
- Runtime Foundry V13.351 / D&D5e 5.3.3 browser/manual testing was **not** performed.
