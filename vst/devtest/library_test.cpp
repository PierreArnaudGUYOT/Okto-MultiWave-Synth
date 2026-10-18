// Copyright (C) 2026 Pierre Arnaud GUYOT (OktoPierre)
// SPDX-License-Identifier: GPL-3.0-or-later
// Developer check of the PRESET LIBRARY (vst/src/bank.h) without any window: the presets file, the adjusted / deleted factory
// presets, the user bank, the lists, EXPORT / IMPORT with its backup, the file read again after another instance changed it
// (the readers look every 500 ms, the edits always look first), and the guard against writing over a file read cut (16 MB).
// The presets file goes to <outdir>\lib (WS_PRESETS_FILE): never the player's own file.
//   x86_64-w64-mingw32-clang++ -std=c++17 -O2 -static -municode -DUNICODE -D_UNICODE -DNOMINMAX -I vst/src
//     vst/devtest/library_test.cpp -o library_test.exe -lshell32 -lole32
//   library_test.exe <outdir>
#include <windows.h>
#include <chrono>
#include <cstdio>
#include <string>
#include <thread>
#include "bank.h"
using namespace ws;

static int gFails = 0;
static void check(bool ok, const char* what, const std::string& detail = {}) {
  std::printf("  [%s] %s%s%s\n", ok ? "PASS" : "FAIL", what, detail.empty() ? "" : "  -- ", detail.c_str());
  if (!ok) gFails++;
  std::fflush(stdout);
}
static std::string u8(const std::wstring& w) {
  const int n = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), nullptr, 0, nullptr, nullptr);
  std::string s(n, '\0'); WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), &s[0], n, nullptr, nullptr); return s;
}
static std::string readAll(const std::wstring& p) { bool f = false; return readTextFile(p, f); }
static bool has(const std::string& s, const std::string& x) { return s.find(x) != std::string::npos; }
static void sleepMs(int ms) { std::this_thread::sleep_for(std::chrono::milliseconds(ms)); }

int wmain(int argc, wchar_t** argv) {
  if (argc < 2) { std::printf("usage: library_test.exe <outdir>\n"); return 2; }
  const std::wstring out = argv[1], dir = out + L"\\lib", file = dir + L"\\OKTOMULTIWAVE presets.txt", exported = out + L"\\exported presets.txt";
  CreateDirectoryW(out.c_str(), nullptr); CreateDirectoryW(dir.c_str(), nullptr);
  DeleteFileW(file.c_str()); DeleteFileW(exported.c_str());
  SetEnvironmentVariableW(L"WS_PRESETS_FILE", file.c_str());
  Library& lib = Library::get();

  std::printf("1. no file: the built-in presets\n");
  const int kA = kFirstNew + 4, kB = kFirstNew + 9;   // two new presets
  check(lib.name(kA) == kPresets[kA].name && !lib.adjusted(kA) && !lib.deleted(kA) && lib.bank().empty(), "names are the built-in ones, nothing adjusted or deleted");
  {
    const auto lists = lib.lists();
    size_t total = 0; for (size_t i = 1; i < lists.size(); i++) total += lists[i].second.size();
    check(lists.size() == 1 + kNumCategories && (int)lists[0].second.size() == kNumTop && (int)total == kNumPresets,
          "TOP Sounds + the categories hold every preset", std::to_string(lists.size()) + " lists, " + std::to_string(total) + " in the categories");
  }

  std::printf("2. SAVE PRESET: a factory preset adjusted and renamed\n");
  double v[kNumParams]; lib.values(kA, v);
  v[P_F_CUTOFF] = 6.2; v[P_AMP_R] = 0.77;
  std::wstring e = lib.adjust(kA, "My adjusted sound", v);
  check(e.empty(), "adjust() writes the file", u8(e));
  std::string txt = readAll(file);
  check(has(txt, "Preset: My adjusted sound") && has(txt, std::string("Factory: ") + kPresets[kA].name) && has(txt, "Adjusted: yes") && has(txt, "  f_cutoff: 6.2   (") &&
        has(txt, "  amp_r: 0.77   ("), "the file shows the preset, its built-in name, 'Adjusted: yes' and the changed parameters");
  double w[kNumParams]; lib.values(kA, w);
  check(lib.name(kA) == "My adjusted sound" && lib.adjusted(kA) && std::fabs(w[P_F_CUTOFF] - 6.2) < 1e-9 && lib.find("My adjusted sound") == kA && lib.find(kPresets[kA].name) == kA,
        "the library gives the adjusted name and values; both names find the preset");
  check(!has(txt, "chord_") && !has(txt, "bend") && !has(txt, "modwheel"), "the chord keyboard's settings and the wheels are not in the file");
  e = lib.restore(kA);
  check(e.empty() && lib.name(kA) == kPresets[kA].name && !lib.adjusted(kA), "RESTORE brings the built-in preset back", u8(e));

  std::printf("3. DELETE and back; the user bank\n");
  e = lib.setDeleted(kB, true);
  check(e.empty() && lib.deleted(kB) && has(readAll(file), "Deleted: yes"), "a deleted preset is marked in the file", u8(e));
  lib.setDeleted(kB, false);
  check(!lib.deleted(kB), "and shown again");
  BankPreset bp; bp.section = bankSectionOf("Pad"); bp.name = "Bank pad"; bp.from = kPresets[kA].name;
  lib.values(kB, bp.v);
  e = lib.putUser(bp);
  check(e.empty() && lib.bank().size() == 1 && lib.bank()[0].name == "Bank pad" && has(readAll(file), "######## USER BANK"), "putUser() adds a sound to the user bank", u8(e));
  e = lib.removeUser(bp.section, "Bank pad");
  check(e.empty() && lib.bank().empty(), "removeUser() deletes it", u8(e));

  std::printf("4. the lists: a preset to TOP Sounds, another moved to a category\n");
  e = lib.setTop(kA, true);
  check(e.empty() && lib.inTop(kA) && (int)lib.lists()[0].second.size() == kNumTop + 1, "setTop adds a preset to TOP Sounds", u8(e));
  lib.setTop(kA, false);
  const int cat0 = lib.categoryOf(kB), target = cat0 == 1 ? 2 : 1;
  e = lib.moveToCategory(kB, target);
  check(e.empty() && lib.categoryOf(kB) == target, "moveToCategory moves a preset to another category", u8(e));
  lib.moveToCategory(kB, cat0);
  check(lib.categoryOf(kB) == cat0, "and back to its own");

  std::printf("5. another instance changes the file: the readers look every 500 ms, the edits always look first\n");
  {
    e = lib.adjust(kA, "Instance one", v);
    check(e.empty(), "preset adjusted as 'Instance one'", u8(e));
    // another instance renames it: the file is changed behind the library's back
    std::string other = readAll(file);
    size_t pos = other.find("Preset: Instance one");
    check(pos != std::string::npos, "the file names it");
    other.replace(pos, std::string("Preset: Instance one").size(), "Preset: Instance two");
    writeTextFile(file, other);
    // an edit looks at the file first: the change of the other instance is not lost
    e = lib.setDeleted(kB, true);
    const std::string after = readAll(file);
    check(e.empty() && has(after, "Preset: Instance two") && has(after, "Deleted: yes"), "an edit made at once keeps the other instance's change", u8(e));
    lib.setDeleted(kB, false);
    // another external change, then a reader after 650 ms
    std::string again = readAll(file);
    pos = again.find("Preset: Instance two");
    again.replace(pos, std::string("Preset: Instance two").size(), "Preset: Instance three");
    writeTextFile(file, again);
    sleepMs(650);
    check(lib.name(kA) == "Instance three", "a reader sees an external change after 500 ms", lib.name(kA));
    lib.restore(kA);
  }

  std::printf("6. EXPORT, and IMPORT with its backup copy\n");
  e = lib.adjust(kA, "Before export", v);
  e = lib.exportTo(exported);
  check(e.empty() && has(readAll(exported), "Preset: Before export"), "EXPORT writes a copy of the presets file", u8(e));
  lib.restore(kA);
  std::wstring backup;
  e = lib.importFrom(exported, backup);
  check(e.empty() && lib.name(kA) == "Before export" && !backup.empty() && fileExists(backup), "IMPORT replaces the library and keeps the old file as a backup", u8(e) + " " + u8(backup));
  writeTextFile(out + L"\\not a presets file.txt", "hello\r\nworld\r\n");
  e = lib.importFrom(out + L"\\not a presets file.txt", backup);
  check(!e.empty() && lib.name(kA) == "Before export", "a file without a Preset: line is refused, the library is unchanged", u8(e));
  lib.restore(kA);

  std::printf("7. a presets file longer than 16 MB is never written over\n");
  {
    std::string big = readAll(file);
    big += "\r\n######## USER BANK ########\r\n== Chords ==\r\n";
    const std::string filler(1 << 20, 'x');
    while (big.size() < (17u << 20)) big += "# " + filler + "\r\n";
    writeTextFile(file, big);
    lib.refresh();
    e = lib.adjust(kA, "Must not be written", v);
    check(!e.empty() && has(u8(e), "16 MB"), "an edit is refused with a clear message", u8(e));
    check(readAll(file).size() >= (16u << 20) && lib.name(kA) == kPresets[kA].name, "the file is as it was, the library keeps the built-in presets");
    DeleteFileW(file.c_str());
    lib.refresh();
    e = lib.adjust(kA, "Now it works", v);
    check(e.empty() && lib.name(kA) == "Now it works", "after the big file is gone an edit works again", u8(e));
    lib.restore(kA);
  }

  std::printf(gFails ? "\n%d FAILED\n" : "\nALL PASS\n", gFails);
  return gFails ? 1 : 0;
}
