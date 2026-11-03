#pragma once

#include "forgedesk/result.hpp"

#include <cstdint>
#include <filesystem>
#include <map>
#include <string_view>

namespace forgedesk
{
using SettingValue = std::variant<std::string, std::int64_t, bool>;

/// Single-owner settings snapshot. Save only to an application-owned directory.
class SettingsStore
{
  public:
    [[nodiscard]] Result<void> set(std::string key, SettingValue value);
    /// Returns the fallback when the key is absent or has a different type.
    [[nodiscard]] SettingValue get(std::string_view key, SettingValue fallback) const;
    /// Loads all entries or preserves the old snapshot on error.
    [[nodiscard]] Result<void> load(const std::filesystem::path& path);
    /// Saves via a sibling staging file and retains the previous file as .bak.
    [[nodiscard]] Result<void> save(const std::filesystem::path& path) const;

  private:
    std::map<std::string, SettingValue, std::less<>> values_;
};
} // namespace forgedesk
