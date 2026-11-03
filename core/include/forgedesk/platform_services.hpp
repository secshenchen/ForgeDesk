#pragma once

#include "forgedesk/result.hpp"
#include "forgedesk/types.hpp"

#include <bitset>
#include <cstddef>
#include <filesystem>
#include <vector>

namespace forgedesk
{
enum class Capability
{
    file_system,
    system_information,
    network_diagnostics,
    clipboard,
    native_dialogs,
    count
};

using Capabilities = std::bitset<static_cast<std::size_t>(Capability::count)>;

enum class Directory
{
    data,
    config,
    cache,
    temporary
};

/// Platform implementations decide permission and report unsupported operations explicitly.
class IPlatformServices
{
  public:
    virtual ~IPlatformServices() = default;
    virtual PlatformId id() const noexcept = 0;
    virtual Result<std::filesystem::path> directory(Directory kind) const = 0;
    virtual Capabilities capabilities() const noexcept = 0;
    /// Read an authorized file, rejecting content larger than max_bytes.
    virtual Result<std::vector<std::byte>> read_file(const std::filesystem::path& path,
                                                     std::size_t max_bytes) = 0;
};
} // namespace forgedesk
