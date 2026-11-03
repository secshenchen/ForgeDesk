#pragma once

#include <compare>
#include <cstdint>
#include <string>

namespace forgedesk
{
struct Version
{
    unsigned major{};
    unsigned minor{};
    unsigned patch{};

    auto operator<=>(const Version&) const = default;
    [[nodiscard]] std::string to_string() const;
};

struct ModuleId
{
    std::string value;
    bool operator==(const ModuleId&) const = default;
};

struct TaskId
{
    std::uint64_t value{};
    auto operator<=>(const TaskId&) const = default;
};

enum class PlatformId
{
    windows,
    web,
    linux_native,
    unknown
};
} // namespace forgedesk
