#include "forgedesk/module.hpp"

#include <iostream>

using namespace forgedesk;

namespace
{
struct Platform final : IPlatformServices
{
    PlatformId id() const noexcept override
    {
        return PlatformId::windows;
    }
    Result<std::filesystem::path> directory(Directory) const override
    {
        return Result<std::filesystem::path>::failure({ErrorCode::unsupported, "No directory"});
    }
    Capabilities capabilities() const noexcept override
    {
        return {};
    }
    Result<std::vector<std::byte>> read_file(const std::filesystem::path&, std::size_t) override
    {
        return Result<std::vector<std::byte>>::failure({ErrorCode::unsupported, "No file access"});
    }
};

struct Module final : IModule
{
    ModuleDescriptor info{{"fixture"}, "Fixture", {1, 2, 3}, "Test only", {}};
    int& starts;
    int& stops;
    bool fail;

    Module(int& start_count, int& stop_count, bool should_fail = false)
        : starts(start_count), stops(stop_count), fail(should_fail)
    {
    }

    ModuleDescriptor descriptor() const override
    {
        return info;
    }
    Result<void> initialize(IPlatformServices&) override
    {
        ++starts;
        if (fail)
        {
            return Result<void>::failure({ErrorCode::internal, "Initialization failed"});
        }
        return Result<void>::success();
    }
    void shutdown() noexcept override
    {
        ++stops;
    }
};

bool test_registry()
{
    Platform platform;
    int starts = 0;
    int stops = 0;
    ModuleRegistry registry{platform};
    auto requires_files = std::make_unique<Module>(starts, stops);
    requires_files->info.required.set(static_cast<std::size_t>(Capability::file_system));
    const auto unsupported = registry.register_module(std::move(requires_files));
    if (unsupported || unsupported.error()->code != ErrorCode::unsupported || starts != 0)
    {
        return false;
    }
    const auto failed = registry.register_module(std::make_unique<Module>(starts, stops, true));
    if (failed || starts != 1 || stops != 1 || registry.find({"fixture"}))
    {
        return false;
    }
    if (!registry.register_module(std::make_unique<Module>(starts, stops)))
    {
        return false;
    }
    const auto duplicate = registry.register_module(std::make_unique<Module>(starts, stops));
    const auto* found = registry.find({"fixture"});
    if (duplicate || duplicate.error()->code != ErrorCode::duplicate || starts != 2 || !found ||
        found->state != ModuleState::active || registry.list().size() != 1)
    {
        return false;
    }
    return registry.unregister_module({"fixture"}) && !registry.find({"fixture"}) &&
           !registry.unregister_module({"fixture"}) && stops == 2;
}
} // namespace

int main()
{
    const auto success = Result<int>::success(42);
    const auto failure = Result<int>::failure({ErrorCode::not_found, "Missing"});
    if (!(Version{1, 2, 3} < Version{1, 3, 0}) || Version{1, 2, 3}.to_string() != "1.2.3" ||
        !success || *success.value() != 42 || success.error() || failure || failure.value() ||
        failure.error()->message != "Missing" || !Result<void>::success() || !test_registry())
    {
        std::cerr << "Core contracts failed\n";
        return 1;
    }
}
