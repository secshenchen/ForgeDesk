#pragma once

#include "forgedesk/result.hpp"

#include <filesystem>

namespace forgedesk
{
struct PathOptions
{
    std::filesystem::path install;
    std::filesystem::path user_data;
    std::filesystem::path temporary;
    std::filesystem::path experiments;
    bool portable = false;
    std::filesystem::path config;
    std::filesystem::path cache;
    std::filesystem::path logs;
};

struct AppPaths
{
    std::filesystem::path install;
    std::filesystem::path data;
    std::filesystem::path config;
    std::filesystem::path cache;
    std::filesystem::path logs;
    std::filesystem::path temporary;
    std::filesystem::path experiments;

    /// Resolves explicit absolute roots and optional overrides without performing I/O.
    static Result<AppPaths> resolve(const PathOptions& options);
};
} // namespace forgedesk
