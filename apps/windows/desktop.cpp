#include "desktop_paths.hpp"

#include <WebView2.h>
#include <Windows.h>
#include <wrl.h>

#include <filesystem>
#include <memory>
#include <string_view>

namespace
{
namespace fs = std::filesystem;
using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;
constexpr auto host = L"forgedesk.example";
constexpr auto origin = L"https://forgedesk.example/";
constexpr auto home = L"https://forgedesk.example/index.html";

struct Apartment
{
    HRESULT status = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    ~Apartment()
    {
        if (SUCCEEDED(status))
        {
            CoUninitialize();
        }
    }
};

class Desktop : public std::enable_shared_from_this<Desktop>
{
  public:
    HWND window = nullptr;
    bool failed = false;
    fs::path assets;
    ComPtr<ICoreWebView2Controller> controller;

    HRESULT fail(const wchar_t* message, HRESULT status)
    {
        failed = true;
        MessageBoxW(window, message, L"ForgeDesk", MB_ICONERROR | MB_OK);
        if (window)
        {
            DestroyWindow(window);
        }
        return status;
    }

    void resize() const
    {
        if (controller && window)
        {
            RECT bounds{};
            if (GetClientRect(window, &bounds))
            {
                controller->put_Bounds(bounds);
            }
        }
    }

    HRESULT configure(ICoreWebView2Controller* view_controller)
    {
        controller = view_controller;
        ComPtr<ICoreWebView2> view;
        ComPtr<ICoreWebView2_3> local_view;
        ComPtr<ICoreWebView2Settings> settings;
        if (FAILED(controller->get_CoreWebView2(&view)) || FAILED(view.As(&local_view)) ||
            FAILED(view->get_Settings(&settings)) ||
            FAILED(local_view->SetVirtualHostNameToFolderMapping(
                host, assets.c_str(), COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_DENY)) ||
            FAILED(settings->put_IsWebMessageEnabled(FALSE)) ||
            FAILED(settings->put_AreHostObjectsAllowed(FALSE)) ||
            FAILED(settings->put_AreDevToolsEnabled(FALSE)) ||
            FAILED(settings->put_AreDefaultContextMenusEnabled(FALSE)))
        {
            return fail(L"Cannot configure the local WebView2 workspace.", E_FAIL);
        }
        EventRegistrationToken navigation{}, popup{}, permission{};
        auto allow_local = Callback<ICoreWebView2NavigationStartingEventHandler>(
            [](ICoreWebView2*, ICoreWebView2NavigationStartingEventArgs* args) -> HRESULT
            {
                LPWSTR raw = nullptr;
                const auto status = args->get_Uri(&raw);
                const std::unique_ptr<wchar_t, decltype(&CoTaskMemFree)> uri{raw, CoTaskMemFree};
                const bool allowed =
                    SUCCEEDED(status) && uri && std::wstring_view{uri.get()}.starts_with(origin);
                return args->put_Cancel(!allowed);
            });
        auto block_popup = Callback<ICoreWebView2NewWindowRequestedEventHandler>(
            [](ICoreWebView2*, ICoreWebView2NewWindowRequestedEventArgs* args) -> HRESULT
            { return args->put_Handled(TRUE); });
        auto deny_permission = Callback<ICoreWebView2PermissionRequestedEventHandler>(
            [](ICoreWebView2*, ICoreWebView2PermissionRequestedEventArgs* args) -> HRESULT
            { return args->put_State(COREWEBVIEW2_PERMISSION_STATE_DENY); });
        if (FAILED(view->add_NavigationStarting(allow_local.Get(), &navigation)) ||
            FAILED(view->add_NewWindowRequested(block_popup.Get(), &popup)) ||
            FAILED(view->add_PermissionRequested(deny_permission.Get(), &permission)) ||
            FAILED(view->Navigate(home)))
        {
            return fail(L"Cannot start the local ForgeDesk UI.", E_FAIL);
        }
        resize();
        return S_OK;
    }

    void start(const fs::path& executable)
    {
        const auto install = executable.parent_path();
        assets = install / L"ui";
        std::error_code ec;
        if (!fs::is_regular_file(assets / L"index.html", ec))
        {
            fail(L"Missing local ui/index.html beside the ForgeDesk executable.", E_FAIL);
            return;
        }
        const auto profile = forgedesk::windows::webview_profile();
        if (!profile)
        {
            fail(L"Cannot locate the WebView2 user data folder.", E_FAIL);
            return;
        }
        const auto fixed = install / L"Runtime";
        const auto* runtime =
            fs::is_regular_file(fixed / L"msedgewebview2.exe", ec) ? fixed.c_str() : nullptr;
        LPWSTR version = nullptr;
        const auto available = GetAvailableCoreWebView2BrowserVersionString(runtime, &version);
        const std::unique_ptr<wchar_t, decltype(&CoTaskMemFree)> runtime_version{version,
                                                                                 CoTaskMemFree};
        if (FAILED(available) || !runtime_version)
        {
            fail(L"WebView2 Runtime is unavailable. See the ForgeDesk offline deployment guide.",
                 E_FAIL);
            return;
        }
        const auto weak = weak_from_this();
        const auto status = CreateCoreWebView2EnvironmentWithOptions(
            runtime, profile.value()->c_str(), nullptr,
            Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
                [weak](HRESULT result, ICoreWebView2Environment* environment) -> HRESULT
                {
                    const auto self = weak.lock();
                    if (!self || !self->window)
                        return S_OK;
                    if (FAILED(result) || !environment)
                    {
                        return self->fail(L"WebView2 environment creation failed.", E_FAIL);
                    }
                    const auto created = environment->CreateCoreWebView2Controller(
                        self->window,
                        Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                            [weak](HRESULT status, ICoreWebView2Controller* controller) -> HRESULT
                            {
                                const auto owner = weak.lock();
                                if (!owner || !owner->window)
                                    return S_OK;
                                if (FAILED(status) || !controller)
                                {
                                    return owner->fail(L"WebView2 controller creation failed.",
                                                       E_FAIL);
                                }
                                return owner->configure(controller);
                            })
                            .Get());
                    return FAILED(created)
                               ? self->fail(L"Cannot request WebView2 controller.", created)
                               : S_OK;
                })
                .Get());
        if (FAILED(status))
        {
            fail(L"Cannot request the WebView2 environment.", status);
        }
    }
};

LRESULT CALLBACK window_proc(HWND window, UINT message, WPARAM wparam, LPARAM lparam)
{
    if (message == WM_NCCREATE)
    {
        const auto* create = reinterpret_cast<const CREATESTRUCTW*>(lparam);
        SetWindowLongPtrW(window, GWLP_USERDATA,
                          reinterpret_cast<LONG_PTR>(create->lpCreateParams));
    }
    auto* desktop = reinterpret_cast<Desktop*>(GetWindowLongPtrW(window, GWLP_USERDATA));
    if (desktop && message == WM_SIZE)
    {
        desktop->resize();
    }
    if (desktop && message == WM_DESTROY)
    {
        if (desktop->controller)
        {
            desktop->controller->Close();
            desktop->controller.Reset();
        }
        desktop->window = nullptr;
        PostQuitMessage(desktop->failed ? 1 : 0);
        return 0;
    }
    return DefWindowProcW(window, message, wparam, lparam);
}
} // namespace

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int show)
{
    Apartment apartment;
    if (FAILED(apartment.status))
    {
        MessageBoxW(nullptr, L"Cannot initialize COM.", L"ForgeDesk", MB_ICONERROR);
        return 1;
    }
    std::wstring executable(32768, L'\0');
    const auto size =
        GetModuleFileNameW(nullptr, executable.data(), static_cast<DWORD>(executable.size()));
    if (size == 0 || size >= executable.size())
    {
        return 1;
    }
    executable.resize(size);
    constexpr auto class_name = L"ForgeDeskWindow";
    WNDCLASSW window_class{};
    window_class.hInstance = instance;
    window_class.lpszClassName = class_name;
    window_class.lpfnWndProc = window_proc;
    window_class.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    if (!RegisterClassW(&window_class))
    {
        return 1;
    }
    const auto desktop = std::make_shared<Desktop>();
    desktop->window =
        CreateWindowExW(0, class_name, L"ForgeDesk", WS_OVERLAPPEDWINDOW, CW_USEDEFAULT,
                        CW_USEDEFAULT, 1160, 800, nullptr, nullptr, instance, desktop.get());
    if (!desktop->window)
    {
        return 1;
    }
    ShowWindow(desktop->window, show);
    desktop->start(fs::path{executable});
    MSG message{};
    while (true)
    {
        const auto result = GetMessageW(&message, nullptr, 0, 0);
        if (result <= 0)
        {
            return result < 0 ? 1 : static_cast<int>(message.wParam);
        }
        TranslateMessage(&message);
        DispatchMessageW(&message);
    }
}
