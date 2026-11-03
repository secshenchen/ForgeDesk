#pragma once

#include "forgedesk/result.hpp"

#include <filesystem>

namespace forgedesk::windows
{
/// Returns the current user's private WebView2 profile path.
Result<std::filesystem::path> webview_profile();
} // namespace forgedesk::windows
