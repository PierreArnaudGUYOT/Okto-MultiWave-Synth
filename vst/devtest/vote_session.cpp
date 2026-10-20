// Copyright (C) 2026 Pierre Arnaud GUYOT (OktoPierre)
// SPDX-License-Identifier: GPL-3.0-or-later
// Developer check of EVALUATE SOUNDS, the listen-and-rate session of the plug-in editor. Loads the VST3 like a host (one
// thread: window messages + real-time paced audio blocks), opens the editor in an off-screen window and clicks through
// a session: EVALUATE SOUNDS, "Start at…" (the number is given by MW_START_AT instead of the typed-number window), the
// passage of the first preset plays (Beethoven and the long chord), 7 stars, modify it (a knob dragged), play the
// passage, record the change, 3 stars on the second, stop, reopen. Checks the parameters sent to the host, the audio, the ratings
// file and the file of the set of 40 sounds next to it, and saves screenshots. The files go to <outdir>\ratings (MW_VOTES_DIR): never the player's own file.
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
  // beta 0.3.4: the colours (0xRRGGBB) of some pixels of the editor window, as the screenshot shows them
  std::vector<uint32_t> pixels(const std::vector<POINT>& pts) {
    RECT rc; GetClientRect(top, &rc);
    HDC sdc = GetDC(nullptr); HDC mdc = CreateCompatibleDC(sdc);
    HBITMAP bmp = CreateCompatibleBitmap(sdc, rc.right, rc.bottom); HGDIOBJ old = SelectObject(mdc, bmp);
    SetWindowPos(top, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
    RedrawWindow(top, nullptr, nullptr, RDW_INVALIDATE | RDW_UPDATENOW | RDW_ALLCHILDREN);
    pump(); Sleep(60);
    PrintWindow(top, mdc, 2 /* PW_RENDERFULLCONTENT */);
    std::vector<uint32_t> out;
    for (const POINT& p : pts) { const COLORREF c = GetPixel(mdc, p.x, p.y); out.push_back(((uint32_t)GetRValue(c) << 16) | ((uint32_t)GetGValue(c) << 8) | GetBValue(c)); }
    SelectObject(mdc, old);
    SetWindowPos(top, HWND_NOTOPMOST, -4000, 0, 0, 0, SWP_NOSIZE | SWP_NOACTIVATE);
    DeleteObject(bmp); DeleteDC(mdc); ReleaseDC(nullptr, sdc);
    return out;
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
// kVoteCard {200, 280, 700, 262}: buttons at +18, +170 (28 high); stars at +112 (46 high); kVoteBar {190, 932, 898, 96}: buttons at +14, +44 (26 high)
static const float CARD_X = 218, CARD_Y = 280 + 170 + 14, BAR_X = 204, BAR_Y = 932 + 44 + 13;
static float starX(int n) { const float w = (700.f - 36 - 9 * 5) / 10; return 218 + (n - 1) * (w + 5) + w / 2; }
static const float STAR_Y = 280 + 112 + 23;

// the number of a preset as written in its name ("012", "502", "1000") and the rest of the name
static std::string numOf(const char* name) { const char* e = name; while (*e && *e != ' ') e++; return std::string(name, e); }
static std::string restOf(const char* name) { const char* e = name; while (*e && *e != ' ') e++; return *e ? std::string(e + 1) : std::string(name); }

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
  SetEnvironmentVariableW(L"MW_WORKAREA", L"3840x2160");   // beta 0.3.2: the window fits the screen; the tests click at 100 %, so the screen is a large one (the fit is tested below)
  SetEnvironmentVariableW(L"MW_VOTES_DIR", votesDir.c_str());   // before loading: the plug-in's C runtime copies it
  const std::wstring presetsFile = votesDir + L"\\presets.txt";   // beta 0.3.1: the library file (the stars of the browser): never the player's own file
  DeleteFileW(presetsFile.c_str());
  SetEnvironmentVariableW(L"WS_PRESETS_FILE", presetsFile.c_str());
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

  const int P1 = kFirstNew, P2 = kFirstNew + 1, P3 = kFirstNew + 2;   // the first three presets to rate (beta 0.3: 501 502 503)
  const std::string N1 = numOf(kPresets[P1].name), N2 = numOf(kPresets[P2].name), N3 = numOf(kPresets[P3].name);
  const std::string N40 = numOf(kPresets[kFirstNew + 39].name);   // the first set of 40 sounds: N1 to N40
  // the scale filter's cutoff of the oscillator a preset shows (beta 0.2: the first presets are additive: B1's cutoff, not A1's f_cutoff)
  auto cutOf = [](int k) { return kSlots[(int)kPresets[k].v[P_OSC_VIEW]].fcut; };
  const int C1 = cutOf(P1), C2 = cutOf(P2), C3 = cutOf(P3);
  const std::wstring startLbl = L"Start at…", contLbl = L"Continue at " + std::wstring(N3.begin(), N3.end());
  const std::wstring setFile = votesDir + L"\\sound " + std::wstring(N1.begin(), N1.end()) + L" to sound " + std::wstring(N40.begin(), N40.end()) + L".txt";
  DeleteFileW(setFile.c_str());
  const std::string ofAll = " / " + std::to_string(kNumNew);
  float evalX = 0, evalY = 0, cutX = 0, cutY = 0;
  check(widgetCenter(W_EVALUATE, -1, 0, evalX, evalY), "EVALUATE SOUNDS button in the layout", fmt("(%.0f, %.0f)", evalX, evalY));
  check(widgetCenter(W_KNOBM, P_F_CUTOFF, 0, cutX, cutY) || widgetCenter(W_KNOBL, P_F_CUTOFF, 0, cutX, cutY) || widgetCenter(W_KNOBS, P_F_CUTOFF, 0, cutX, cutY),
        "CUTOFF knob in the layout of A1", fmt("(%.0f, %.0f)", cutX, cutY));

  // the editor, at 100 %, in an off-screen window
  WNDCLASSW wc{}; wc.lpfnWndProc = topProc; wc.hInstance = GetModuleHandleW(nullptr); wc.lpszClassName = L"MwVoteTestTop";
  RegisterClassW(&wc);
  h.top = CreateWindowExW(WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE, wc.lpszClassName, L"vote test", WS_POPUP | WS_VISIBLE, -4000, 0, 1100, kDeviceH + kChordH, nullptr, nullptr, wc.hInstance, nullptr);
  h.view = h.ctrl->createView(ViewType::kEditor);
  IPlugViewContentScaleSupport* sc = nullptr;
  if (h.view->queryInterface(IPlugViewContentScaleSupport::iid, (void**)&sc) == kResultOk && sc) { sc->setContentScaleFactor(1.0f); sc->release(); }
  check(h.view->attached(h.top, kPlatformTypeHWND) == kResultOk, "editor attached");
  h.ed = FindWindowExW(h.top, nullptr, L"OktoMultiWaveSynthEditorWnd", nullptr);
  check(h.ed != nullptr, "editor window found");
  h.run(0.5);
  check(std::fabs(h.plain(P_MASTER) - master0) < 1e-6, "sound before the session", fmt("master %.2f dB", h.plain(P_MASTER)));

  // beta 0.3: the three folder tabs OSC1 A1 | OSC2 A2 | OSC3 B1 choose the oscillator shown (and leave the sound alone)
  std::printf("0. the folder tabs choose the oscillator shown\n");
  {
    float ob[4] = {};
    check(widgetBox(W_OSCTABS, ob), "folder tabs in the layout", fmt("(%.0f, %.0f)", ob[0], ob[1]));
    const float fy = ob[1] + 17;
    auto tab = [&](int k) { return ob[0] + k * 182 + 88; };   // tab k: x + k * 182, 176 wide
    check(h.plain(P_OSC_VIEW) == 0, "a new instance shows A1", fmt("osc_view %.0f", h.plain(P_OSC_VIEW)));
    h.shot(out + L"\\0_view_A1.png");
    h.click(tab(1), fy); h.run(0.15);
    check(h.plain(P_OSC_VIEW) == 1, "the folder tab OSC2 A2 shows A2", fmt("osc_view %.0f", h.plain(P_OSC_VIEW)));
    h.shot(out + L"\\0_view_A2.png");
    h.click(tab(2), fy); h.run(0.15);
    check(h.plain(P_OSC_VIEW) == 2, "the folder tab OSC3 B1 shows B1", fmt("osc_view %.0f", h.plain(P_OSC_VIEW)));
    h.shot(out + L"\\0_view_B1.png");
    h.click(tab(0), fy); h.run(0.15);
    check(h.plain(P_OSC_VIEW) == 0, "the folder tab OSC1 A1 shows A1", fmt("osc_view %.0f", h.plain(P_OSC_VIEW)));
  }
  std::printf("1. EVALUATE SOUNDS opens the start screen\n");
  h.click(evalX, evalY);
  h.run(0.3);
  h.shot(out + L"\\1_start.png");
  std::printf("2. Start at…: a wrong number starts nothing; then %s: the first preset with the listening rules, the passage plays\n", N1.c_str());
  SetEnvironmentVariableW(L"MW_START_AT", L"zzz");   // the typed number (the window that asks it is replaced by this variable here)
  h.click(buttonCenter({{startLbl.c_str(), true}, {L"Change file…", false}, {L"Close", false}}, 0, CARD_X), CARD_Y);
  h.resetPeak(); h.run(1.0);
  check(h.peak < 1e-4, "a number that is not in the list starts nothing", fmt("peak %.6f", h.peak));
  h.shot(out + L"\\1b_start_refused.png");
  SetEnvironmentVariableW(L"MW_START_AT", std::wstring(N1.begin(), N1.end()).c_str());
  h.click(buttonCenter({{startLbl.c_str(), true}, {L"Change file…", false}, {L"Close", false}}, 0, CARD_X), CARD_Y);
  h.run(0.12);
  check(h.plain(P_V_VOICES) == 16 && h.plain(P_V_OCT) == 0 && h.plain(P_V_GLIDE) == 0, "listening rules (16 voices, octave 0, no glide)",
        fmt("voices %.0f oct %.0f glide %.3f", h.plain(P_V_VOICES), h.plain(P_V_OCT), h.plain(P_V_GLIDE)));
  check(std::fabs(h.plain(C1) - kPresets[P1].v[C1]) < 1e-6, "the first preset is loaded", fmt("cutoff %.3f", h.plain(C1)));
  h.run(0.3); h.resetPeak(); h.run(2.0);
  check(h.peak > 0.02, "the passage of Beethoven sounds", fmt("peak %.3f", h.peak));
  h.shot(out + L"\\2_playing.png");
  h.run(4.0);   // until the end of the passage and of the chord (0.15 s lead + 5.9 s)
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
  check(has(txt, N1 + " |  7 |         | " + restOf(kPresets[P1].name)), ("ratings file written after the rating (" + N1 + " = 7)").c_str());
  check(has(txt, "Rated: 1" + ofAll), "ratings file header");
  {   // the file of the set of 40 sounds, next to it
    const std::string st = readFile(setFile);
    check(!st.empty() && has(st, "Set: sound " + N1 + " to sound " + N40 + " (40 sounds)") && has(st, "Rated: 1 / 40") && has(st, N1 + " |  7 |") && has(st, N40 + " |  - |") && !has(st, numOf(kPresets[kFirstNew + 40].name) + " |"),
          ("the set file \"sound " + N1 + " to sound " + N40 + ".txt\" is written next to the ratings file").c_str(), std::to_string(st.size()) + " bytes");
    check(has(st, "then a C minor chord"), "the files say that the passage ends with a chord");
  }
  h.shot(out + L"\\4_ask.png");
  std::printf("4. Yes, modify it: the preset exactly as designed\n");
  h.click(buttonCenter({{L"Yes, modify it", true}, {L"No, next preset", false}, {L"Stop", false}}, 0, CARD_X), CARD_Y);
  h.run(0.3);
  check(h.plain(P_V_VOICES) == kPresets[P1].v[P_V_VOICES] && h.plain(P_V_OCT) == kPresets[P1].v[P_V_OCT] &&
        std::fabs(h.plain(P_V_GLIDE) - kPresets[P1].v[P_V_GLIDE]) < 1e-6, "edit: preset 001 as designed (1 voice, octave -1, glide)",
        fmt("voices %.0f oct %.0f glide %.3f", h.plain(P_V_VOICES), h.plain(P_V_OCT), h.plain(P_V_GLIDE)));
  h.shot(out + L"\\5_edit.png");
  std::printf("5. drag the CUTOFF knob up, play the passage, record\n");
  h.drag(cutX, cutY, kPresets[P1].v[C1] > 6 ? 45 : -45);   // up raises it; down when the preset already has it wide open (beta 0.2: 12)
  h.run(0.2);
  const double cut = h.plain(C1);
  check(std::fabs(cut - kPresets[P1].v[C1]) > 0.5, "cutoff changed with the mouse", fmt("%.3f -> %.3f", kPresets[P1].v[C1], cut));
  const std::vector<std::pair<const wchar_t*, bool>> bar = {{L"▶ Play the passage", false}, {L"Keep initial settings", false}, {L"Record preset change", true}, {L"Stop", false}};
  h.click(buttonCenter(bar, 0, BAR_X), BAR_Y);
  h.run(0.4); h.resetPeak(); h.run(1.5);
  check(h.peak > 0.02, "edit: ▶ Play the passage sounds", fmt("peak %.3f", h.peak));
  h.shot(out + L"\\6_edit_changed.png");
  h.click(buttonCenter(bar, 2, BAR_X), BAR_Y);
  h.run(0.3);
  txt = readFile(votes);
  auto js = [](double v) { char b[64]; std::snprintf(b, sizeof b, "%.6f", v); std::string s = b; while (s.back() == '0') s.pop_back(); if (s.back() == '.') s.pop_back(); return s; };
  const std::string chLine = std::string("  ") + kParams[C1].key + ": " + js(kPresets[P1].v[C1]) + " -> " + js(cut);
  check(has(txt, N1 + " |  7 | yes     | ") && has(txt, name1 + "   (7 stars)") && has(txt, chLine), "change recorded in the ratings file", chLine);
  {
    // only the cutoff: nothing else differs from the preset
    const size_t a = txt.find("(7 stars)"), b = txt.find("\r\n\r\n", a);
    int n = 0; for (size_t p = txt.find("\r\n  ", a); p != std::string::npos && p < b; p = txt.find("\r\n  ", p + 2)) n++;
    check(n == 1, "the change holds only the parameter moved", std::to_string(n) + " line(s)");
  }
  check(h.plain(P_V_VOICES) == 16 && std::fabs(h.plain(C2) - kPresets[P2].v[C2]) < 1e-6, "after recording, the second preset plays");
  std::printf("6. 002: Skip to vote (the music stops), 3 stars (no question), 003 plays, Stop\n");
  h.run(1.0);
  h.click(buttonCenter({{L"Skip to vote", true}, {L"Stop", false}}, 0, CARD_X), CARD_Y);   // beta 0.3.1: the music ends at once, the rating window is there
  h.run(0.3);
  h.click(starX(3), STAR_Y);
  h.run(0.4);
  txt = readFile(votes);
  check(has(txt, N2 + " |  3 |"), (N2 + " = 3 saved").c_str());
  check(std::fabs(h.plain(C3) - kPresets[P3].v[C3]) < 1e-6 && h.plain(P_V_VOICES) == 16, "3 stars: no question, the third plays");
  h.run(1.0);
  h.click(buttonCenter({{L"Skip to vote", true}, {L"Stop", false}}, 1, CARD_X), CARD_Y);
  h.run(0.25); h.resetPeak(); h.run(0.5);
  check(std::fabs(h.plain(P_MASTER) - master0) < 1e-6, "Stop gives back the sound played before", fmt("master %.2f dB", h.plain(P_MASTER)));
  check(h.peak < 1e-4, "silence after Stop", fmt("peak %.6f", h.peak));
  std::printf("7. reopen: continues at 003\n");
  h.click(evalX, evalY);
  h.run(0.3);
  h.shot(out + L"\\7_reopen.png");
  {   // "Save as…": a copy of the ratings so far under a name of the player's choice (the window is replaced by MW_SAVEAS_PATH here)
    const std::wstring copy = votesDir + L"\\my special ratings.txt";
    DeleteFileW(copy.c_str());
    SetEnvironmentVariableW(L"MW_SAVEAS_PATH", copy.c_str());
    h.click(buttonCenter({{startLbl.c_str(), false}, {contLbl.c_str(), true}, {L"Change file…", false}, {L"Save as…", false}, {L"Show file", false}, {L"Clear all", false}, {L"Close", false}}, 3, CARD_X), CARD_Y);
    h.run(0.3);
    const std::string cp = readFile(copy), main = readFile(votes);
    check(has(cp, "Rated: 2" + ofAll) && has(cp, N1 + " |  7 | yes     |") && has(cp, N2 + " |  3 |"), "Save as…: a copy of the ratings so far under another name", std::to_string(cp.size()) + " bytes");
    check(!main.empty() && has(main, "Rated: 2" + ofAll), "the ratings file being rewritten is untouched");
    h.shot(out + L"\\7b_saved_as.png");
    SetEnvironmentVariableW(L"MW_SAVEAS_PATH", nullptr);
  }
  h.click(evalX, evalY);   // the lit button stops the session
  h.run(0.2);
  h.shot(out + L"\\8_closed.png");
  std::printf("8. CHORD MODE: the panel grows, the chord card shows, keys and pads play chords, off again\n");
  {
    float cm[2], pads[4], kb[4], plate[4];
    check(widgetCenter(W_TOGGLE, P_CHORD_MODE, 0, cm[0], cm[1]), "CHORD MODE toggle in the layout", fmt("(%.0f, %.0f)", cm[0], cm[1]));
    check(widgetBox(W_CHORDPADS, pads) && widgetBox(W_KEYBOARD, kb) && widgetBox(W_STRUMPLATE, plate), "chord pads, keyboard and strum plate in the layout");
    ViewRect vr; h.view->getSize(&vr);
    check(vr.getHeight() == kDeviceH && h.plain(P_CHORD_MODE) == 0, "chord mode off: the panel's own height", fmt("%.0f", vr.getHeight()));
    h.click(cm[0], cm[1]);
    h.run(0.3);
    h.view->getSize(&vr);
    check(h.plain(P_CHORD_MODE) == 1 && vr.getHeight() == kDeviceH, "CHORD MODE on: the chord card is under the list of the browser, the panel keeps its height (beta 0.3.3)", fmt("%.0f", vr.getHeight()));
    h.shot(out + L"\\9_chord_on.png");
    h.click(1104 + 8 + 12 + 40, 8 + 98 + (kDeviceH - 16 - 156 - 254) + 10 + 26 + 22);   // a pad of the chord card, in the browser (beta 0.3.3: x = browser + 8 + 12, y = under the list + 26)
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
    check(h.plain(P_CHORD_MODE) == 0 && vr.getHeight() == kDeviceH, "CHORD MODE off: back to the panel's height", fmt("%.0f", vr.getHeight()));
    h.shot(out + L"\\11_chord_off.png");
    {   // beta 0.3.2: while the zoom is "fit", the window is scaled to the screen (MW_WORKAREA = the size of a screen, developer tests): the whole panel, the chord card included, is on it
      SetEnvironmentVariableW(L"MW_WORKAREA", L"1366x728");
      h.ctrl->setParamNormalized(P_CHORD_MODE, 1.0); h.run(0.4);
      ViewRect v1; h.view->getSize(&v1);
      check(v1.getHeight() <= 728 - 100 && v1.getHeight() >= 500 && v1.getWidth() <= 1366 - 30, "fit: a 1366 x 728 screen shows the whole panel with the chord card", fmt("%.0f x %.0f (100 %% is 1100 x 1170)", (double)v1.getWidth(), (double)v1.getHeight()));
      h.shot(out + L"\\12_fit_1366x728_chord.png");
      h.ctrl->setParamNormalized(P_CHORD_MODE, 0.0); h.run(0.4);
      ViewRect v2; h.view->getSize(&v2);
      check(v2.getHeight() <= 728 - 100 && v2.getHeight() >= 500, "fit: the same screen with the panel alone", fmt("%.0f x %.0f", (double)v2.getWidth(), (double)v2.getHeight()));
      h.shot(out + L"\\12_fit_1366x728.png");
      SetEnvironmentVariableW(L"MW_WORKAREA", L"3840x2160");
      h.ctrl->setParamNormalized(P_CHORD_MODE, 1.0); h.run(0.4);
      h.ctrl->setParamNormalized(P_CHORD_MODE, 0.0); h.run(0.4);
      ViewRect v3; h.view->getSize(&v3);
      check(v3.getHeight() == kDeviceH && v3.getWidth() == 1100 + 420, "fit: a large screen keeps the panel at 100 % (with the browser: 1520 wide)", fmt("%.0f x %.0f", (double)v3.getWidth(), (double)v3.getHeight()));
    }
  }
  std::printf("8b. beta 0.3.4: the LFO 2 | LFO 3 tabs, the stepped SHAPE knob, TUNING ARAB / TURK (oriental colour code and pattern)\n");
  {
    const uint32_t kAccentColA = 0xffcf3d;   // the yellow of the subtractive oscillators
    auto setP = [&](int id, double plain) { h.ctrl->setParamNormalized(id, h.ctrl->plainParamToNormalized(id, plain)); h.run(0.3); };
    float lt[4], ob[4], shx = 0, shy = 0, vx = 0, vy = 0, tgx = 0, tgy = 0;
    check(widgetBox(W_LFOTABS, lt) && widgetBox(W_OSCTABS, ob), "the LFO tabs and the folder tabs are in the layout", fmt("lfotabs (%.0f, %.0f), osctabs at y %.0f", lt[0], lt[1], ob[1]));
    check(widgetCenter(W_KNOBM, P_LFO3_SHAPE, 0, shx, shy) && widgetCenter(W_KNOBM, P_V_OCT, 0, vx, vy) && widgetCenter(W_MENU, P_LFO3_TARGET, 0, tgx, tgy), "the SHAPE knob of LFO 3, the VOICE knobs and TARGET are in the layout",
          fmt("SHAPE (%.0f, %.0f), OCTAVE x %.0f", shx, shy, vx));
    check(std::fabs(shy - vy) < 0.5f, "the knobs of the LFO 2/3 and VOICE cards are on the same line", fmt("%.1f / %.1f", shy, vy));
    check(h.plain(P_LFO_VIEW) == 0, "LFO 2 is shown first", fmt("lfo_view %.0f", h.plain(P_LFO_VIEW)));
    setP(P_LFO2_AMT, 0.45); setP(P_LFO3_AMT, -0.3); setP(P_LFO2_SHAPE, 2); setP(P_LFO3_SHAPE, 3); setP(P_LFO_SHAPE, 1);
    h.shot(out + L"\\14_lfo2_tab.png");
    const float tabX = lt[0] + 6 + 60 + 29, tabY = lt[1] + 14;   // the LFO 3 tab: 58 x 22 at x 66
    h.click(tabX, tabY); h.run(0.2);
    check(h.plain(P_LFO_VIEW) == 1, "the LFO 3 tab shows LFO 3 (the parameter lfo_view)", fmt("lfo_view %.0f", h.plain(P_LFO_VIEW)));
    h.shot(out + L"\\14_lfo3_tab.png");
    const double s0 = h.plain(P_LFO3_SHAPE);
    h.click(shx, shy); h.run(0.2);   // a click without moving: the next shape
    check(h.plain(P_LFO3_SHAPE) == std::fmod(s0 + 1, 5), "a click on the SHAPE knob steps to the next of the five shapes", fmt("%.0f -> %.0f", s0, h.plain(P_LFO3_SHAPE)));
    h.drag(shx, shy, 50); h.run(0.2);   // dragged down by 50 px (24 px a step): two steps down
    check(h.plain(P_LFO3_SHAPE) == 2, "dragged down, the SHAPE knob steps down through the shapes", fmt("shape %.0f", h.plain(P_LFO3_SHAPE)));
    h.drag(shx, shy, -50); h.run(0.2);
    check(h.plain(P_LFO3_SHAPE) == 4, "dragged up, it goes to its last position (S&H)", fmt("shape %.0f", h.plain(P_LFO3_SHAPE)));
    h.click(lt[0] + 6 + 29, tabY); h.run(0.2);
    check(h.plain(P_LFO_VIEW) == 0, "the LFO 2 tab shows LFO 2 again", fmt("lfo_view %.0f", h.plain(P_LFO_VIEW)));
    // the colour code: the tab of the oscillator shown and the tab of the LFO shown are filled with the accent colour
    const POINT pA{(LONG)(ob[0] + 160), (LONG)(ob[1] + 20)}, pB{(LONG)(ob[0] + 2 * 182 + 160), (LONG)(ob[1] + 20)}, pL{(LONG)(lt[0] + 6 + 54), (LONG)(lt[1] + 12)};
    auto closeTo = [](uint32_t a, uint32_t b) { for (int s = 0; s < 24; s += 8) if (std::abs((int)((a >> s) & 255) - (int)((b >> s) & 255)) > 3) return false; return true; };
    auto hex = [](uint32_t c) { char s[16]; std::snprintf(s, sizeof s, "%06X", c); return std::string(s); };
    std::vector<uint32_t> px = h.pixels({pA, pL});
    check(closeTo(px[0], kAccentColA) && closeTo(px[1], kAccentColA), "TUNING WEST: yellow accent (oscillator tab A1, LFO 2 tab)", hex(px[0]) + " " + hex(px[1]));
    float tx = 0, ty = 0;
    check(widgetCenter(W_SEG, P_MT_MODE, 0, tx, ty), "the TUNING switch is in the layout", fmt("(%.0f, %.0f)", tx, ty));
    h.click(tx, ty); h.run(0.3);   // the middle segment: ARAB
    check(h.plain(P_MT_MODE) == 1, "a click on ARAB sets the Arabic tuning", fmt("mt_mode %.0f", h.plain(P_MT_MODE)));
    px = h.pixels({pA, pL});
    check(closeTo(px[0], kOrientA) && closeTo(px[1], kOrientA), "TUNING ARAB: terracotta accent (oscillator tab A1, LFO 2 tab)", hex(px[0]) + " " + hex(px[1]));
    h.shot(out + L"\\15_arab.png");
    h.click(lt[0] + 6 + 60 + 29, tabY); h.run(0.2);
    h.shot(out + L"\\15_arab_lfo3.png");
    h.click(lt[0] + 6 + 29, tabY); h.run(0.2);   // back to LFO 2
    setP(P_OSC_VIEW, 2);   // B1: turquoise
    px = h.pixels({pB});
    check(closeTo(px[0], kOrientB), "TUNING ARAB, additive oscillator B1 shown: turquoise accent", hex(px[0]));
    setP(P_MT_MODE, 2);
    h.shot(out + L"\\16_turk_b1.png");
    setP(P_OSC_VIEW, 0);
    h.shot(out + L"\\16_turk.png");
    setP(P_MT_MODE, 0);
    px = h.pixels({pA, pL});
    check(closeTo(px[0], kAccentColA) && closeTo(px[1], kAccentColA), "TUNING WEST again: the yellow accent is back", hex(px[0]) + " " + hex(px[1]));
    h.run(0.2);
  }
  std::printf("9. beta 0.2: the preset browser follows the preset box (the screenshot shows the browser on SuperModulation, the sound selected)\n");
  {
    float pr[4];
    check(widgetBox(W_PRESETS, pr), "the preset box in the layout");
    SetWindowPos(h.top, nullptr, -4000, 0, 1560, kDeviceH + kChordH, SWP_NOZORDER | SWP_NOACTIVATE);   // wide enough for the browser at the right
    h.run(0.3);
    for (int i = 0; i < 40; i++) { h.click(pr[0] + pr[2] - 12, pr[1] + pr[3] / 2); h.run(0.05); }   // the right arrow: out of the TOP Sounds into SuperModulation
    h.run(0.5);
    h.ctrl->setParamNormalized(P_CHORD_MODE, 1.0); h.run(0.5);   // beta 0.3.3: the chord card under the list of the browser (screenshot)
    h.shot(out + L"\\13_chord_in_browser.png");
    h.ctrl->setParamNormalized(P_CHORD_MODE, 0.0); h.run(0.4);
    {   // beta 0.3.1: the stars at the right of a row of the browser: a click on the left half of the second star rates the first row 3 / 10 (the presets file holds it)
      const float sx = 1100 + 4 + 136 + (420 - 12 - 162) - 6 - 60;   // the stars' left edge: the card x + the list x + its width - the margin - 5 stars of 12
      const std::string before = readFile(presetsFile);
      h.click(sx + 12 + 3, 8 + 98 + 11);
      h.run(0.3);
      const std::string after = readFile(presetsFile);
      check(!after.empty() && has(after, "Stars: 3\r\n") && !has(before, "Stars: 3\r\n"), "a click on the stars of a row of the browser rates the sound (the presets file says Stars: 3)", std::to_string(after.size()) + " bytes");
      h.click(sx + 12 + 3, 8 + 98 + 11);   // the same click again clears it
      h.run(0.3);
      check(!has(readFile(presetsFile), "Stars: 3\r\n"), "a second click on the same rating clears it");
      auto cnt = [](const std::string& s, const std::string& x) { int n = 0; for (size_t p = s.find(x); p != std::string::npos; p = s.find(x, p + 1)) n++; return n; };
      const int tens = cnt(readFile(presetsFile), "Stars: 10\r\n");   // (a built-in vote of 10 is in the file too)
      h.click(sx + 4 * 12 + 9, 8 + 98 + 11);   // the right half of the fifth star: 10 / 10
      h.run(0.3);
      check(cnt(readFile(presetsFile), "Stars: 10\r\n") == tens + 1, "the right half of the fifth star gives 10 / 10 (one more Stars: 10 in the file)");
    }
    h.shot(out + L"\\12_browser_followed.png");
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
