#include "forgedesk/app_paths.hpp"

namespace forgedesk
{
Result<AppPaths> AppPaths::resolve(const PathOptions& options)
{
    namespace fs = std::filesystem;
    const auto install = options.install.lexically_normal();
    const auto data =
        (options.portable && options.user_data.empty() ? install / "data" : options.user_data)
            .lexically_normal();
    if (!install.is_absolute() || !data.is_absolute() || data == install ||
        !options.temporary.is_absolute())
    {
        return Result<AppPaths>::failure(
            {ErrorCode::invalid_argument, "Invalid application roots"});
    }
    const auto use = [&](const fs::path& override_path, const char* name)
    { return override_path.empty() ? data / name : override_path.lexically_normal(); };
    AppPaths paths{install,
                   data,
                   use(options.config, "config"),
                   use(options.cache, "cache"),
                   use(options.logs, "logs"),
                   options.temporary.lexically_normal(),
                   use(options.experiments, "experiments")};
    for (const auto* path : {&paths.config, &paths.cache, &paths.logs, &paths.experiments})
    {
        if (!path->is_absolute() || *path == install)
        {
            return Result<AppPaths>::failure(
                {ErrorCode::invalid_argument, "Invalid directory override"});
        }
    }
    return Result<AppPaths>::success(std::move(paths));
}
} // namespace forgedesk
