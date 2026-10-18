// Copyright (C) 2026 Pierre Arnaud GUYOT (OktoPierre)
// SPDX-License-Identifier: GPL-3.0-or-later
// Developer check of EVALUATE SOUNDS, the listen-and-rate session of the plug-in editor. Loads the VST3 like a host (one
// thread: window messages + real-time paced audio blocks), opens the editor in an off-screen window and clicks through
// a session: EVALUATE SOUNDS, start, the passage of preset 001 plays, 7 stars, modify it (a knob dragged), play the
// passage, record the change, 3 stars on 002, stop, reopen. Checks the parameters sent to the host, the audio, the ratings
// file, and saves screenshots. The ratings file goes to <outdir>\ratings (MW_VOTES_DIR): never the player's own file.
//   x86_64-w64-mingw32-clang++ -std=c++17 -O2 -static -municode -DUNICODE -D_UNICODE -DNOMINMAX -I vst/external -I vst/src
//     vst/devtest/vote_session.cpp vst/src/iids.cpp vst/external/pluginterfaces/base/funknown.cpp -o vote_session.exe
//     -lgdiplus -lgdi32 -luser32 -lole32 -luuid
//   vote_session.exe <path\to\OktoMultiWaveSynth.vst3 dll> <outdir>
#include <windows.h>
#include <algorithm>
namespace Gdiplus { using std::min; using std::max; }
#include <gdiplus.h>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>
#include <thread>
#include <vector>
#include "pluginterfaces/base/ipluginbase.h"
#include "pluginterfaces/gui/iplugview.h"
#include "pluginterfaces/gui/iplugviewcontentscalesupport.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/ivstcomponent.h"
#include "pluginterfaces/vst/ivsteditcontroller.h"
#include "pluginterfaces/vst/ivstevents.h"
#include "pluginterfaces/vst/ivstmessage.h"
#include "pluginterfaces/vst/ivstparameterchanges.h"
#include "generated/spec.h"

using namespace Steinberg;
using namespace Steinberg::Vst;
namespace G = Gdiplus;
using namespace ws;

static int gFails = 0;
static void check(bool ok, const char* what, const std::string& detail = {}) {
  std::printf("  [%s] %s%s%s\n", ok ? "PASS" : "FAIL", what, detail.empty() ? "" : "  -- ", detail.c_str());
  if (!ok) gFails++;
  std::fflush(stdout);   // nothing lost if a run is stopped
}
static std::string fmt(const char* f, double a, double b = 0, double c = 0) { char s[256]; std::snprintf(s, sizeof s, f, a, b, c); return s; }

// ------------------------------------------------------------------ host objects
struct Handler final : public IComponentHandler, public IComponentHandler2 {
  std::vector<std::pair<ParamID, double>> pending;
  int edits = 0, open = 0, badNesting = 0;
  tresult PLUGIN_API beginEdit(ParamID) override { open++; return kResultOk; }
  tresult PLUGIN_API performEdit(ParamID id, ParamValue v) override { if (open <= 0) badNesting++; pending.push_back({id, v}); edits++; return kResultOk; }
  tresult PLUGIN_API endEdit(ParamID) override { open--; return kResultOk; }
  tresult PLUGIN_API restartComponent(int32) override { return kResultOk; }
  tresult PLUGIN_API setDirty(TBool) override { return kResultOk; }
  tresult PLUGIN_API requestOpenEditor(FIDString) override { return kResultFalse; }
  tresult PLUGIN_API startGroupEdit() override { return kResultOk; }
  tresult PLUGIN_API finishGroupEdit() override { return kResultOk; }
  tresult PLUGIN_API queryInterface(const TUID iid, void** obj) override {
    if (FUnknownPrivate::iidEqual(iid, IComponentHandler::iid) || FUnknownPrivate::iidEqual(iid, FUnknown::iid)) { *obj = static_cast<IComponentHandler*>(this); return kResultOk; }
    if (FUnknownPrivate::iidEqual(iid, IComponentHandler2::iid)) { *obj = static_cast<IComponentHandler2*>(this); return kResultOk; }
    *obj = nullptr; return kNoInterface;
  }
  uint32 PLUGIN_API addRef() override { return 1; }
  uint32 PLUGIN_API release() override { return 1; }
};
struct Queue final : public IParamValueQueue {
  ParamID id = 0; std::vector<std::pair<int32, ParamValue>> pts;
  ParamID PLUGIN_API getParameterId() override { return id; }
  int32 PLUGIN_API getPointCount() override { return (int32)pts.size(); }
  tresult PLUGIN_API getPoint(int32 i, int32& off, ParamValue& v) override {
    if (i < 0 || i >= (int32)pts.size()) return kResultFalse;
    off = pts[i].first; v = pts[i].second; return kResultOk;
  }
  tresult PLUGIN_API addPoint(int32 off, ParamValue v, int32& i) override { i = (int32)pts.size(); pts.push_back({off, v}); return kResultOk; }
  tresult PLUGIN_API queryInterface(const TUID, void** obj) override { *obj = nullptr; return kNoInterface; }
  uint32 PLUGIN_API addRef() override { return 1; }
  uint32 PLUGIN_API release() override { return 1; }
};
struct Changes final : public IParameterChanges {
  std::vector<Queue> qs = std::vector<Queue>(512); int32 used = 0;
  void clear() { for (int32 i = 0; i < used; i++) qs[i].pts.clear(); used = 0; }
  void add(ParamID id, double v) {   // the last value of a parameter wins (block start)
    for (int32 i = 0; i < used; i++) if (qs[i].id == id) { qs[i].pts.assign(1, {0, v}); return; }
    if (used < (int32)qs.size()) { qs[used].id = id; qs[used].pts.assign(1, {0, v}); used++; }
  }
  int32 PLUGIN_API getParameterCount() override { return used; }
  IParamValueQueue* PLUGIN_API getParameterData(int32 i) override { return i >= 0 && i < used ? &qs[i] : nullptr; }
  IParamValueQueue* PLUGIN_API addParameterData(const ParamID& id, int32& i) override { add(id, 0); i = used - 1; return &qs[i]; }
  tresult PLUGIN_API queryInterface(const TUID, void** obj) override { *obj = nullptr; return kNoInterface; }
  uint32 PLUGIN_API addRef() override { return 1; }
  uint32 PLUGIN_API release() override { return 1; }
};
struct Events final : public IEventList {
  int32 PLUGIN_API getEventCount() override { return 0; }
  tresult PLUGIN_API getEvent(int32, Event&) override { return kResultFalse; }
  tresult PLUGIN_API addEvent(Event&) override { return kResultFalse; }
  tresult PLUGIN_API queryInterface(const TUID, void** obj) override { *obj = nullptr; return kNoInterface; }
  uint32 PLUGIN_API addRef() override { return 1; }
  uint32 PLUGIN_API release() override { return 1; }
};

// ------------------------------------------------------------------ the host
static const int SR = 48000, BLOCK = 512;
struct Host {
  IComponent* comp = nullptr; IAudioProcessor* proc = nullptr; IEditController* ctrl = nullptr; IPlugView* view = nullptr;
  Handler handler; Changes changes; Events events;
  std::vector<float> L = std::vector<float>(BLOCK), Rr = std::vector<float>(BLOCK);
  HWND top = nullptr, ed = nullptr;
  float peak = 0;   // since the last resetPeak()
  bool badSample = false;

  void block() {
    changes.clear();
    for (auto& p : handler.pending) changes.add(p.first, p.second);
    handler.pending.clear();
    ProcessData d{};
    d.processMode = kRealtime; d.symbolicSampleSize = kSample32; d.numSamples = BLOCK;
    AudioBusBuffers out{}; float* ch[2] = {L.data(), Rr.data()};
    out.numChannels = 2; out.channelBuffers32 = ch;
    d.numOutputs = 1; d.outputs = &out; d.inputParameterChanges = &changes; d.inputEvents = &events;
    proc->process(d);
    for (int i = 0; i < BLOCK; i++) {
      if (!std::isfinite(L[i]) || !std::isfinite(Rr[i])) badSample = true;
      peak = std::max(peak, std::max(std::fabs(L[i]), std::fabs(Rr[i])));
    }
  }
  void pump() { MSG m; while (PeekMessageW(&m, nullptr, 0, 0, PM_REMOVE)) { TranslateMessage(&m); DispatchMessageW(&m); } }
  // runs the host for s seconds of audio, paced to the wall clock like a real audio device
  void run(double s) {
    const auto t0 = std::chrono::steady_clock::now();
    const int n = (int)std::ceil(s * SR / BLOCK);
    for (int k = 0; k < n; k++) {
      pump();
      block();
      const double due = (k + 1) * (double)BLOCK / SR, now = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
      if (due > now) std::this_thread::sleep_for(std::chrono::duration<double>(due - now));
    }
    pump();
  }
  void resetPeak() { peak = 0; }
  double plain(int id) { return ctrl->normalizedParamToPlain(id, ctrl->getParamNormalized(id)); }
  void click(float x, float y) {
    const LPARAM p = MAKELPARAM((int)std::lround(x), (int)std::lround(y));
    SendMessageW(ed, WM_MOUSEMOVE, 0, p);
    SendMessageW(ed, WM_LBUTTONDOWN, MK_LBUTTON, p);
    SendMessageW(ed, WM_LBUTTONUP, 0, p);
    pump();
  }
  void drag(float x, float y, float dy) {
    SendMessageW(ed, WM_MOUSEMOVE, 0, MAKELPARAM((int)x, (int)y));
    SendMessageW(ed, WM_LBUTTONDOWN, MK_LBUTTON, MAKELPARAM((int)x, (int)y));
    for (int k = 1; k <= 10; k++) SendMessageW(ed, WM_MOUSEMOVE, MK_LBUTTON, MAKELPARAM((int)x, (int)std::lround(y + dy * k / 10)));
    SendMessageW(ed, WM_LBUTTONUP, 0, MAKELPARAM((int)x, (int)std::lround(y + dy)));
    pump();
  }
  void shot(const std::wstring& file) {
    RECT rc; GetClientRect(top, &rc);
    HDC sdc = GetDC(nullptr); HDC mdc = CreateCompatibleDC(sdc);
    HBITMAP bmp = CreateCompatibleBitmap(sdc, rc.right, rc.bottom); HGDIOBJ old = SelectObject(mdc, bmp);
    // an off-screen window is not repainted: shown on screen for an instant, fully repainted, captured, hidden again
    SetWindowPos(top, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
    RedrawWindow(top, nullptr, nullptr, RDW_INVALIDATE | RDW_UPDATENOW | RDW_ALLCHILDREN);
    pump(); Sleep(60);
    PrintWindow(top, mdc, 2 /* PW_RENDERFULLCONTENT */);
    SelectObject(mdc, old);
    SetWindowPos(top, HWND_NOTOPMOST, -4000, 0, 0, 0, SWP_NOSIZE | SWP_NOACTIVATE);
    {
      G::Bitmap b(bmp, nullptr);
      UINT num = 0, size = 0; G::GetImageEncodersSize(&num, &size);
      std::vector<char> buf(size); auto* enc = (G::ImageCodecInfo*)buf.data(); G::GetImageEncoders(num, size, enc);
      for (UINT i = 0; i < num; i++) if (std::wcscmp(enc[i].MimeType, L"image/png") == 0) { const G::Status stt = b.Save(file.c_str(), &enc[i].Clsid, nullptr); if (stt != G::Ok) std::printf("  (screenshot %ls not saved: GDI+ status %d, %ldx%ld)\n", file.c_str(), (int)stt, rc.right, rc.bottom); }
    }
    DeleteObject(bmp); DeleteDC(mdc); ReleaseDC(nullptr, sdc);
  }
};

// the rating window's buttons, laid out as the editor does (Segoe UI 12 px, bold = main, 24 px padding, 8 px gaps)
static float buttonCenter(const std::vector<std::pair<const wchar_t*, bool>>& row, size_t which, float x0) {
  HDC dc = GetDC(nullptr);
  float x = x0, c = 0;
  {
    G::Graphics g(dc);
    g.SetSmoothingMode(G::SmoothingModeAntiAlias); g.SetTextRenderingHint(G::TextRenderingHintAntiAlias); g.SetPixelOffsetMode(G::PixelOffsetModeHalf);
    G::FontFamily fam(L"Segoe UI");
    for (size_t i = 0; i < row.size(); i++) {
      G::Font f(&fam, 12, row[i].second ? G::FontStyleBold : G::FontStyleRegular, G::UnitPixel);
      G::RectF bound; G::StringFormat sf; sf.SetFormatFlags(G::StringFormatFlagsNoWrap);
      g.MeasureString(row[i].first, -1, &f, G::PointF(0, 0), &sf, &bound);
      const float w = bound.Width + 24;
      if (i == which) c = x + w / 2;
      x += w + 8;
    }
  }
  ReleaseDC(nullptr, dc);
  return c;
}
// kVoteCard {200, 280, 700, 262}: buttons at +18, +170 (28 high); stars at +112 (46 high); kVoteBar {190, 748, 898, 96}: buttons at +14, +44 (26 high)
static const float CARD_X = 218, CARD_Y = 280 + 170 + 14, BAR_X = 204, BAR_Y = 748 + 44 + 13;
static float starX(int n) { const float w = (700.f - 36 - 9 * 5) / 10; return 218 + (n - 1) * (w + 5) + w / 2; }
static const float STAR_Y = 280 + 112 + 23;

static std::string readFile(const std::wstring& p) {
  FILE* f = _wfopen(p.c_str(), L"rb"); if (!f) return "";
  std::string s; char b[4096]; size_t n; while ((n = std::fread(b, 1, sizeof b, f)) > 0) s.append(b, n); std::fclose(f); return s;
}
static bool has(const std::string& s, const std::string& x) { return s.find(x) != std::string::npos; }

// the centre of the first widget of a type / of a parameter (in a section shown for the oscillator `view`)
static bool widgetCenter(int type, int param, int view, float& cx, float& cy) {
  for (int s = 0; s < kNumSections; s++) {
    const SectionDef& sd = kSections[s];
    if (sd.view >= 0 && sd.view != view) continue;
    for (int k = 0; k < sd.numWidgets; k++) {
      const WidgetDef& w = kWidgets[sd.firstWidget + k];
      if (w.type != type || w.param != param) continue;
      cx = sd.x + w.x + w.w / 2; cy = sd.y + w.y + w.h / 2;
      return true;
    }
  }
  return false;
}

// the box of the first widget of a type (any parameter) in a section shown for every oscillator
static bool widgetBox(int type, float* b) {
  for (int s = 0; s < kNumSections; s++) {
    const SectionDef& sd = kSections[s];
    for (int k = 0; k < sd.numWidgets; k++) {
      const WidgetDef& w = kWidgets[sd.firstWidget + k];
      if (w.type != type) continue;
      b[0] = sd.x + w.x; b[1] = sd.y + w.y; b[2] = w.w; b[3] = w.h;
      return true;
    }
  }
  return false;
}

static LRESULT CALLBACK topProc(HWND h, UINT m, WPARAM w, LPARAM l) { return DefWindowProcW(h, m, w, l); }

int wmain(int argc, wchar_t** argv) {
  if (argc < 3) { std::printf("usage: vote_session.exe <plugin dll> <outdir>\n"); return 2; }
  const std::wstring dll = argv[1], out = argv[2], votesDir = out + L"\\ratings", votes = votesDir + L"\\okto-multiwave-ratings.txt";
  CreateDirectoryW(out.c_str(), nullptr); CreateDirectoryW(votesDir.c_str(), nullptr);
  DeleteFileW(votes.c_str());
  DeleteFileW((votesDir + L"\\ratings-location.txt").c_str());
  SetEnvironmentVariableW(L"MW_VOTES_DIR", votesDir.c_str());   // before loading: the plug-in's C runtime copies it
  G::GdiplusStartupInput gi; ULONG_PTR gt; G::GdiplusStartup(&gt, &gi, nullptr);
  SetProcessDPIAware();

  HMODULE mod = LoadLibraryW(dll.c_str());
  if (!mod) { std::printf("cannot load %ls\n", dll.c_str()); return 2; }
  auto getFactory = (IPluginFactory * (PLUGIN_API*)())GetProcAddress(mod, "GetPluginFactory");
  auto initDll = (bool (*)())GetProcAddress(mod, "InitDll");
  if (initDll) initDll();
  IPluginFactory* fac = getFactory();
  PClassInfo ci0, ci1; fac->getClassInfo(0, &ci0); fac->getClassInfo(1, &ci1);
  Host h;
  fac->createInstance(ci0.cid, IComponent::iid, (void**)&h.comp);
  fac->createInstance(ci1.cid, IEditController::iid, (void**)&h.ctrl);
  h.comp->initialize(nullptr); h.ctrl->initialize(nullptr);
  h.comp->queryInterface(IAudioProcessor::iid, (void**)&h.proc);
  IConnectionPoint *cpA = nullptr, *cpB = nullptr;
  h.comp->queryInterface(IConnectionPoint::iid, (void**)&cpA); h.ctrl->queryInterface(IConnectionPoint::iid, (void**)&cpB);
  cpA->connect(cpB); cpB->connect(cpA);
  h.ctrl->setComponentHandler(&h.handler);
  SpeakerArrangement st = SpeakerArr::kStereo;
  h.proc->setBusArrangements(nullptr, 0, &st, 1);
  ProcessSetup ps{kRealtime, kSample32, BLOCK, (SampleRate)SR};
  h.proc->setupProcessing(ps);
  h.comp->setActive(true); h.proc->setProcessing(true);

  // the sound before the session: a distinctive MASTER level, as set by host automation
  const double master0 = -7.5;
  h.ctrl->setParamNormalized(P_MASTER, h.ctrl->plainParamToNormalized(P_MASTER, master0));
  h.changes.clear(); h.handler.pending.push_back({P_MASTER, h.ctrl->plainParamToNormalized(P_MASTER, master0)});

  const int P1 = kFirstNew, P2 = kFirstNew + 1, P3 = kFirstNew + 2;   // presets 001 002 003
  float evalX = 0, evalY = 0, cutX = 0, cutY = 0;
  check(widgetCenter(W_EVALUATE, -1, 0, evalX, evalY), "EVALUATE SOUNDS button in the layout", fmt("(%.0f, %.0f)", evalX, evalY));
  check(widgetCenter(W_KNOBM, P_F_CUTOFF, 0, cutX, cutY) || widgetCenter(W_KNOBL, P_F_CUTOFF, 0, cutX, cutY) || widgetCenter(W_KNOBS, P_F_CUTOFF, 0, cutX, cutY),
        "CUTOFF knob in the layout of A1", fmt("(%.0f, %.0f)", cutX, cutY));

  // the editor, at 100 %, in an off-screen window
  WNDCLASSW wc{}; wc.lpfnWndProc = topProc; wc.hInstance = GetModuleHandleW(nullptr); wc.lpszClassName = L"MwVoteTestTop";
  RegisterClassW(&wc);
  h.top = CreateWindowExW(WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE, wc.lpszClassName, L"vote test", WS_POPUP | WS_VISIBLE, -4000, 0, 1100, 980, nullptr, nullptr, wc.hInstance, nullptr);
  h.view = h.ctrl->createView(ViewType::kEditor);
  IPlugViewContentScaleSupport* sc = nullptr;
  if (h.view->queryInterface(IPlugViewContentScaleSupport::iid, (void**)&sc) == kResultOk && sc) { sc->setContentScaleFactor(1.0f); sc->release(); }
  check(h.view->attached(h.top, kPlatformTypeHWND) == kResultOk, "editor attached");
  h.ed = FindWindowExW(h.top, nullptr, L"OktoMultiWaveSynthEditorWnd", nullptr);
  check(h.ed != nullptr, "editor window found");
  h.run(0.5);
  check(std::fabs(h.plain(P_MASTER) - master0) < 1e-6, "sound before the session", fmt("master %.2f dB", h.plain(P_MASTER)));

  std::printf("1. EVALUATE SOUNDS opens the start screen\n");
  h.click(evalX, evalY);
  h.run(0.3);
  h.shot(out + L"\\1_start.png");
  std::printf("2. Start at 001: preset 001 with the listening rules, the passage plays\n");
  h.click(buttonCenter({{L"Start at 001", true}, {L"Change file…", false}, {L"Close", false}}, 0, CARD_X), CARD_Y);
  h.run(0.12);
  check(h.plain(P_V_VOICES) == 16 && h.plain(P_V_OCT) == 0 && h.plain(P_V_GLIDE) == 0, "listening rules (16 voices, octave 0, no glide)",
        fmt("voices %.0f oct %.0f glide %.3f", h.plain(P_V_VOICES), h.plain(P_V_OCT), h.plain(P_V_GLIDE)));
  check(std::fabs(h.plain(P_F_CUTOFF) - kPresets[P1].v[P_F_CUTOFF]) < 1e-6, "preset 001 loaded", fmt("cutoff %.3f", h.plain(P_F_CUTOFF)));
  h.run(0.3); h.resetPeak(); h.run(2.0);
  check(h.peak > 0.02, "the passage of Beethoven sounds", fmt("peak %.3f", h.peak));
  h.shot(out + L"\\2_playing.png");
  h.run(3.4);   // until the end of the passage (0.15 s lead + 4.9 s)
  h.shot(out + L"\\3_rate.png");
  std::printf("3. 7 stars: saved at once, asks to modify\n");
  h.click(starX(7), STAR_Y);
  h.run(0.3);
  std::string txt = readFile(votes);
  if (txt.empty()) {   // the plug-in did not use the test folder: stop before it writes the player's own ratings file
    check(false, "ratings file in the test folder (MW_VOTES_DIR)", "not found: stopping");
    return 1;
  }
  const std::string name1 = std::string(kPresets[P1].name);
  check(has(txt, "001 |  7 |         | " + name1.substr(4)), "ratings file written after the rating (001 = 7)");
  check(has(txt, "Rated: 1 / 200"), "ratings file header");
  h.shot(out + L"\\4_ask.png");
  std::printf("4. Yes, modify it: the preset exactly as designed\n");
  h.click(buttonCenter({{L"Yes, modify it", true}, {L"No, next preset", false}, {L"Stop", false}}, 0, CARD_X), CARD_Y);
  h.run(0.3);
  check(h.plain(P_V_VOICES) == kPresets[P1].v[P_V_VOICES] && h.plain(P_V_OCT) == kPresets[P1].v[P_V_OCT] &&
        std::fabs(h.plain(P_V_GLIDE) - kPresets[P1].v[P_V_GLIDE]) < 1e-6, "edit: preset 001 as designed (1 voice, octave -1, glide)",
        fmt("voices %.0f oct %.0f glide %.3f", h.plain(P_V_VOICES), h.plain(P_V_OCT), h.plain(P_V_GLIDE)));
  h.shot(out + L"\\5_edit.png");
  std::printf("5. drag the CUTOFF knob up, play the passage, record\n");
  h.drag(cutX, cutY, -45);
  h.run(0.2);
  const double cut = h.plain(P_F_CUTOFF);
  check(cut > kPresets[P1].v[P_F_CUTOFF] + 0.5, "cutoff changed with the mouse", fmt("%.3f -> %.3f", kPresets[P1].v[P_F_CUTOFF], cut));
  const std::vector<std::pair<const wchar_t*, bool>> bar = {{L"▶ Play the passage", false}, {L"Keep initial settings", false}, {L"Record preset change", true}, {L"Stop", false}};
  h.click(buttonCenter(bar, 0, BAR_X), BAR_Y);
  h.run(0.4); h.resetPeak(); h.run(1.5);
  check(h.peak > 0.02, "edit: ▶ Play the passage sounds", fmt("peak %.3f", h.peak));
  h.shot(out + L"\\6_edit_changed.png");
  h.click(buttonCenter(bar, 2, BAR_X), BAR_Y);
  h.run(0.3);
  txt = readFile(votes);
  auto js = [](double v) { char b[64]; std::snprintf(b, sizeof b, "%.6f", v); std::string s = b; while (s.back() == '0') s.pop_back(); if (s.back() == '.') s.pop_back(); return s; };
  const std::string chLine = "  f_cutoff: " + js(kPresets[P1].v[P_F_CUTOFF]) + " -> " + js(cut);
  check(has(txt, "001 |  7 | yes     | ") && has(txt, name1 + "   (7 stars)") && has(txt, chLine), "change recorded in the ratings file", chLine);
  {
    // only the cutoff: nothing else differs from the preset
    const size_t a = txt.find("(7 stars)"), b = txt.find("\r\n\r\n", a);
    int n = 0; for (size_t p = txt.find("\r\n  ", a); p != std::string::npos && p < b; p = txt.find("\r\n  ", p + 2)) n++;
    check(n == 1, "the change holds only the parameter moved", std::to_string(n) + " line(s)");
  }
  check(h.plain(P_V_VOICES) == 16 && std::fabs(h.plain(P_F_CUTOFF) - kPresets[P2].v[P_F_CUTOFF]) < 1e-6, "after recording, preset 002 plays");
  std::printf("6. 002: 3 stars (no question), 003 plays, Stop\n");
  h.run(5.4);
  h.click(starX(3), STAR_Y);
  h.run(0.4);
  txt = readFile(votes);
  check(has(txt, "002 |  3 |"), "002 = 3 saved");
  check(std::fabs(h.plain(P_F_CUTOFF) - kPresets[P3].v[P_F_CUTOFF]) < 1e-6 && h.plain(P_V_VOICES) == 16, "3 stars: no question, 003 plays");
  h.run(1.0);
  h.click(buttonCenter({{L"Stop", false}}, 0, CARD_X), CARD_Y);
  h.run(0.25); h.resetPeak(); h.run(0.5);
  check(std::fabs(h.plain(P_MASTER) - master0) < 1e-6, "Stop gives back the sound played before", fmt("master %.2f dB", h.plain(P_MASTER)));
  check(h.peak < 1e-4, "silence after Stop", fmt("peak %.6f", h.peak));
  std::printf("7. reopen: continues at 003\n");
  h.click(evalX, evalY);
  h.run(0.3);
  h.shot(out + L"\\7_reopen.png");
  h.click(evalX, evalY);   // the lit button stops the session
  h.run(0.2);
  h.shot(out + L"\\8_closed.png");
  std::printf("8. CHORD MODE: the panel grows, the chord card shows, keys and pads play chords, off again\n");
  {
    float cm[2], pads[4], kb[4], plate[4];
    check(widgetCenter(W_TOGGLE, P_CHORD_MODE, 0, cm[0], cm[1]), "CHORD MODE toggle in the layout", fmt("(%.0f, %.0f)", cm[0], cm[1]));
    check(widgetBox(W_CHORDPADS, pads) && widgetBox(W_KEYBOARD, kb) && widgetBox(W_STRUMPLATE, plate), "chord pads, keyboard and strum plate in the layout");
    ViewRect vr; h.view->getSize(&vr);
    check(vr.getHeight() == 860 && h.plain(P_CHORD_MODE) == 0, "chord mode off: panel 1100 x 860", fmt("%.0f", vr.getHeight()));
    h.click(cm[0], cm[1]);
    h.run(0.3);
    h.view->getSize(&vr);
    check(h.plain(P_CHORD_MODE) == 1 && vr.getHeight() == 980, "CHORD MODE on: the panel grows to 980", fmt("%.0f", vr.getHeight()));
    h.shot(out + L"\\9_chord_on.png");
    h.click(pads[0] + 40, pads[1] + 22);   // a pad of the chord card
    h.run(0.2);
    const double type1 = h.plain(P_CHORD_TYPE);
    {   // a key held with the mouse: a chord sounds
      const LPARAM kp = MAKELPARAM((int)(kb[0] + kb[2] * 0.45f), (int)(kb[1] + kb[3] * 0.8f));
      SendMessageW(h.ed, WM_MOUSEMOVE, 0, kp);
      SendMessageW(h.ed, WM_LBUTTONDOWN, MK_LBUTTON, kp);
      h.resetPeak(); h.run(0.6);
      check(h.peak > 0.02, "a key plays a chord", fmt("chord type %.0f, peak %.3f", type1, h.peak));
      h.shot(out + L"\\10_chord_key.png");
      SendMessageW(h.ed, WM_LBUTTONUP, 0, kp);
      h.run(0.3);
    }
    h.click(cm[0], cm[1]);
    h.run(0.3);
    h.view->getSize(&vr);
    check(h.plain(P_CHORD_MODE) == 0 && vr.getHeight() == 860, "CHORD MODE off: back to 860", fmt("%.0f", vr.getHeight()));
    h.shot(out + L"\\11_chord_off.png");
  }
  check(!h.badSample, "no NaN or infinite sample");
  check(h.handler.badNesting == 0, "every performEdit inside beginEdit/endEdit", std::to_string(h.handler.edits) + " edits");

  h.view->removed(); h.view->release();
  DestroyWindow(h.top);
  h.proc->setProcessing(false); h.comp->setActive(false);
  cpA->disconnect(cpB); cpB->disconnect(cpA); cpA->release(); cpB->release();
  h.ctrl->setComponentHandler(nullptr);
  h.proc->release(); h.ctrl->terminate(); h.comp->terminate(); h.ctrl->release(); h.comp->release();
  std::printf("\nratings file:\n%s\n", readFile(votes).substr(0, 1400).c_str());
  std::printf(gFails ? "%d FAILED\n" : "ALL PASS\n", gFails);
  return gFails ? 1 : 0;
}
