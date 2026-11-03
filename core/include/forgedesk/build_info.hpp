#pragma once

#include <string_view>

namespace forgedesk
{
struct BuildInfo
{
    std::string_view version;
    std::string_view compiler;
    std::string_view platform;
    std::string_view configuration;
    long language_level;
};

/// Returns build metadata with program lifetime.
[[nodiscard]] BuildInfo build_info() noexcept;
} // namespace forgedesk
