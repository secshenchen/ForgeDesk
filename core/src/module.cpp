#include "forgedesk/module.hpp"

#include <algorithm>

namespace forgedesk
{
ModuleRegistry::ModuleRegistry(IPlatformServices& platform) noexcept : platform_(platform) {}

ModuleRegistry::~ModuleRegistry()
{
    for (auto it = entries_.rbegin(); it != entries_.rend(); ++it)
    {
        it->module->shutdown();
    }
}

Result<void> ModuleRegistry::register_module(std::unique_ptr<IModule> module)
{
    if (!module)
    {
        return Result<void>::failure({ErrorCode::invalid_argument, "Missing module"});
    }
    ModuleDescriptor info;
    try
    {
        info = module->descriptor();
    }
    catch (...)
    {
        return Result<void>::failure({ErrorCode::internal, "Module descriptor threw"});
    }
    if (info.id.value.empty() || info.name.empty())
    {
        return Result<void>::failure(
            {ErrorCode::invalid_argument, "Module ID and name are required"});
    }
    if (find(info.id))
    {
        return Result<void>::failure({ErrorCode::duplicate, "Module ID already registered"});
    }
    if ((info.required & ~platform_.capabilities()).any())
    {
        return Result<void>::failure(
            {ErrorCode::unsupported, "Required platform capability missing"});
    }
    auto& entry = entries_.emplace_back(Entry{std::move(info), std::move(module)});
    try
    {
        auto result = entry.module->initialize(platform_);
        if (result)
        {
            entry.info.state = ModuleState::active;
            return result;
        }
        entry.module->shutdown();
        entries_.pop_back();
        return result;
    }
    catch (...)
    {
        entry.module->shutdown();
        entries_.pop_back();
        return Result<void>::failure({ErrorCode::internal, "Module initialization threw"});
    }
}

Result<void> ModuleRegistry::unregister_module(const ModuleId& id)
{
    const auto it = std::ranges::find_if(entries_, [&](const Entry& e) { return e.info.id == id; });
    if (it == entries_.end())
    {
        return Result<void>::failure({ErrorCode::not_found, "Module ID not registered"});
    }
    it->module->shutdown();
    entries_.erase(it);
    return Result<void>::success();
}

const ModuleDescriptor* ModuleRegistry::find(const ModuleId& id) const noexcept
{
    const auto it = std::ranges::find_if(entries_, [&](const Entry& e) { return e.info.id == id; });
    return it == entries_.end() ? nullptr : &it->info;
}

std::vector<ModuleDescriptor> ModuleRegistry::list() const
{
    std::vector<ModuleDescriptor> result;
    result.reserve(entries_.size());
    for (const auto& entry : entries_)
    {
        result.push_back(entry.info);
    }
    return result;
}
} // namespace forgedesk
