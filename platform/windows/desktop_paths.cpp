#include "desktop_paths.hpp"

#include <ShlObj.h>
#include <Windows.h>
#include <memory>

namespace forgedesk::windows
{
Result<std::filesystem::path> webview_profile()
{
    PWSTR raw = nullptr;
    const auto status = SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &raw);
    const std::unique_ptr<wchar_t, decltype(&CoTaskMemFree)> folder{raw, CoTaskMemFree};
    if (FAILED(status) || !folder)
    {
        return Result<std::filesystem::path>::failure(
            {ErrorCode::io, "Cannot locate LocalAppData for the WebView2 profile"});
    }
    return Result<std::filesystem::path>::success(std::filesystem::path{folder.get()} /
                                                  L"ForgeDesk" / L"WebView2");
}
} // namespace forgedesk::windows
