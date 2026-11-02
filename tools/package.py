#!/usr/bin/env python3
"""Create deterministic install and source ZIP archives for Runyth Garb & Grime."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import zipfile

FIXED_TIMESTAMP = (2026, 8, 8, 0, 0, 0)
EXCLUDED_NAMES = {".git", "node_modules", "__pycache__", "dist", "garb-and-grime.bak", "tests.bak"}


def iter_files(root: Path):
  for path in sorted(root.rglob("*"), key=lambda value: value.as_posix()):
    if not path.is_file():
      continue
    if any(part in EXCLUDED_NAMES for part in path.parts):
      continue
    if path.suffix in {".pyc", ".zip"}:
      continue
    yield path



def iter_runtime_files(root: Path):
  excluded_top_level = {"README.md", "CHANGELOG.md", "docs"}
  for path in iter_files(root):
    relative = path.relative_to(root)
    if relative.parts and relative.parts[0] in excluded_top_level:
      continue
    yield path

def write_zip(output: Path, entries: list[tuple[Path, str]]) -> None:
  output.parent.mkdir(parents=True, exist_ok=True)
  with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for source, archive_name in sorted(entries, key=lambda entry: entry[1]):
      info = zipfile.ZipInfo(archive_name, FIXED_TIMESTAMP)
      info.compress_type = zipfile.ZIP_DEFLATED
      info.external_attr = (0o100644 & 0xFFFF) << 16
      archive.writestr(info, source.read_bytes())


def sha256(path: Path) -> str:
  digest = hashlib.sha256()
  with path.open("rb") as stream:
    for block in iter(lambda: stream.read(1024 * 1024), b""):
      digest.update(block)
  return digest.hexdigest()


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument("--output-dir", type=Path, default=Path.cwd() / "dist")
  args = parser.parse_args()

  source_root = Path(__file__).resolve().parent.parent
  module_root = source_root / "."
  manifest = json.loads((module_root / "module.json").read_text(encoding="utf-8"))
  version = manifest["version"]

  install_zip = args.output_dir / f"runyth-garb-and-grime-v{version}.zip"
  source_zip = args.output_dir / f"garb-and-grime-source-v{version}.zip"
  docs_zip = args.output_dir / f"garb-and-grime-documentation-v{version}.zip"

  install_entries = [
    (path, f"runyth-garb-and-grime/{path.relative_to(module_root).as_posix()}")
    for path in iter_runtime_files(module_root)
  ]
  source_entries = [
    (path, f"garb-and-grime-source/{path.relative_to(source_root).as_posix()}")
    for path in iter_files(source_root)
  ]
  write_zip(install_zip, install_entries)
  write_zip(source_zip, source_entries)

  artifact_checksum_file = args.output_dir / "ARTIFACT_SHA256SUMS.txt"
  artifact_checksum_file.write_text(
    f"{sha256(install_zip)}  {install_zip.name}\n{sha256(source_zip)}  {source_zip.name}\n",
    encoding="utf-8"
  )
  docs_root_name = f"runyth-garb-and-grime-v{version}-documentation"
  docs_entries: list[tuple[Path, str]] = []
  for source in [source_root / "BUILDING.md", module_root / "README.md", module_root / "CHANGELOG.md"]:
    docs_entries.append((source, f"{docs_root_name}/{source.name}"))
  for directory, prefix in [(module_root / "docs", "docs"), (source_root / "release" / version, "release")]:
    for source in iter_files(directory):
      docs_entries.append((source, f"{docs_root_name}/{prefix}/{source.relative_to(directory).as_posix()}"))
  docs_entries.append((artifact_checksum_file, f"{docs_root_name}/ARTIFACT_SHA256SUMS.txt"))
  write_zip(docs_zip, docs_entries)

  checksum_file = args.output_dir / "SHA256SUMS.txt"
  checksum_file.write_text(
    f"{sha256(install_zip)}  {install_zip.name}\n"
    f"{sha256(source_zip)}  {source_zip.name}\n"
    f"{sha256(docs_zip)}  {docs_zip.name}\n",
    encoding="utf-8"
  )
  print(install_zip)
  print(source_zip)
  print(docs_zip)
  print(checksum_file)


if __name__ == "__main__":
  main()
