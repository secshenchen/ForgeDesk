#pragma once

#include "forgedesk/platform_services.hpp"

#include <list>
#include <memory>

namespace forgedesk
{
enum class ModuleState
{
    inactive,
    active
};

struct ModuleDescriptor
{
    ModuleId id;
    std::string name;
    Version version;
    std::string description;
    Capabilities required;
    ModuleState state = ModuleState::inactive;
};

class IModule
{
  public:
    virtual ~IModule() = default;
    virtual ModuleDescriptor descriptor() const = 0;
    virtual Result<void> initialize(IPlatformServices& platform) = 0;
    /// Releases resources even after a partial or failed initialize call.
    virtual void shutdown() noexcept = 0;
};

/// Single-owner-thread registry. The platform outlives it. Callbacks may not reenter it.
class ModuleRegistry
{
  public:
    explicit ModuleRegistry(IPlatformServices& platform) noexcept;
    ~ModuleRegistry();
    ModuleRegistry(const ModuleRegistry&) = delete;
    ModuleRegistry& operator=(const ModuleRegistry&) = delete;

    /// Takes ownership and initializes the module. Failure leaves no entry.
    [[nodiscard]] Result<void> register_module(std::unique_ptr<IModule> module);
    [[nodiscard]] Result<void> unregister_module(const ModuleId& id);
    /// The pointer remains valid until this entry is unregistered or the registry is destroyed.
    [[nodiscard]] const ModuleDescriptor* find(const ModuleId& id) const noexcept;
    [[nodiscard]] std::vector<ModuleDescriptor> list() const;

  private:
    struct Entry
    {
        ModuleDescriptor info;
        std::unique_ptr<IModule> module;
    };
    IPlatformServices& platform_;
    std::list<Entry> entries_;
};
} // namespace forgedesk
