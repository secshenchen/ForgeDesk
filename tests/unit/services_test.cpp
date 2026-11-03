#include "forgedesk/app_paths.hpp"
#include "forgedesk/logger.hpp"
#include "forgedesk/settings_store.hpp"
#include "forgedesk/task_manager.hpp"

#include <fstream>
#include <future>
#include <iostream>
#include <sstream>

using namespace forgedesk;
using namespace std::chrono_literals;
namespace fs = std::filesystem;

namespace
{
bool test_storage(const fs::path& root)
{
    const auto paths = AppPaths::resolve(
        {root / "app", root / "data", root / "temp", root / "experiments", false});
    const auto portable = AppPaths::resolve({root / "app", {}, root / "temp", {}, true});
    if (!paths || !portable || paths.value()->experiments != root / "experiments" ||
        portable.value()->data != root / "app" / "data" ||
        AppPaths::resolve({"relative", {}, {}, {}, false}))
    {
        return false;
    }
    std::ostringstream console;
    Logger logger{paths.value()->logs, 110, LogLevel::info, console};
    if (!logger.log(LogLevel::debug, "filtered") ||
        !logger.log(LogLevel::info, std::string(58, 'a')) ||
        !logger.log(LogLevel::warning, std::string(58, 'b')) ||
        !logger.log(LogLevel::error, std::string(58, 'c')) ||
        console.str().find("filtered") != std::string::npos ||
        console.str().find("WARNING") == std::string::npos ||
        fs::file_size(paths.value()->logs / "forgedesk.log") > 110 ||
        !fs::is_regular_file(paths.value()->logs / "forgedesk.log.1"))
    {
        return false;
    }

    SettingsStore settings;
    const auto path = root / "settings.conf";
    if (!settings.set("title", std::string{"a\\b\nc"}) || !settings.set("jobs", std::int64_t{3}) ||
        !settings.set("offline", true) || !settings.save(path) ||
        !settings.set("jobs", std::int64_t{4}) || !settings.save(path))
    {
        return false;
    }
    SettingsStore loaded;
    if (!loaded.load(path) ||
        loaded.get("title", std::string{}) != SettingValue{std::string{"a\\b\nc"}} ||
        loaded.get("offline", false) != SettingValue{true} ||
        loaded.get("missing", std::int64_t{9}) != SettingValue{std::int64_t{9}} ||
        loaded.get("jobs", std::int64_t{0}) != SettingValue{std::int64_t{4}})
    {
        return false;
    }
    auto backup = path;
    backup += ".bak";
    if (!loaded.load(backup) ||
        loaded.get("jobs", std::int64_t{0}) != SettingValue{std::int64_t{3}})
    {
        return false;
    }
    if (!settings.set("jobs", std::int64_t{5}) || !settings.save(path) || !loaded.load(backup) ||
        loaded.get("jobs", std::int64_t{0}) != SettingValue{std::int64_t{4}})
    {
        return false;
    }
    std::ofstream{root / "invalid.conf"} << "jobs=i:2\njobs=i:3\n";
    return !loaded.load(root / "invalid.conf") &&
           loaded.get("jobs", std::int64_t{0}) == SettingValue{std::int64_t{4}};
}

bool test_tasks()
{
    std::promise<void> first_started;
    std::promise<void> second_started;
    std::promise<void> release;
    std::promise<void> running;
    std::promise<void> stopping;
    auto signal = stopping.get_future();
    const auto gate = release.get_future().share();
    TaskManager manager{2, 4};
    const auto first = manager.submit(
        [&](TaskContext& context)
        {
            context.report_progress(25);
            first_started.set_value();
            gate.wait();
            return Result<void>::success();
        });
    const auto second = manager.submit(
        [&](TaskContext&) -> Result<void>
        {
            second_started.set_value();
            gate.wait();
            throw std::runtime_error("fixture");
        });
    const bool concurrent = first_started.get_future().wait_for(3s) == std::future_status::ready &&
                            second_started.get_future().wait_for(3s) == std::future_status::ready;
    const auto progress = first ? manager.snapshot(*first.value())
                                : Result<TaskSnapshot>::failure({ErrorCode::internal, "No task"});
    const auto queued = manager.submit([](TaskContext&) { return Result<void>::success(); });
    const bool cancelled = queued && manager.cancel(*queued.value());
    release.set_value();
    if (!concurrent || !first || !second || !cancelled || !progress ||
        progress.value()->state != TaskState::running || progress.value()->progress != 25)
    {
        return false;
    }
    const auto a = manager.wait(*first.value(), 3s);
    const auto b = manager.wait(*second.value(), 3s);
    const auto c = manager.wait(*queued.value(), 3s);
    const auto task = manager.submit(
        [&](TaskContext& context)
        {
            std::stop_callback on_stop(context.stop, [&] { stopping.set_value(); });
            running.set_value();
            signal.wait();
            return Result<void>::success();
        });
    if (!task || running.get_future().wait_for(3s) != std::future_status::ready)
    {
        return false;
    }
    manager.shutdown();
    const auto d = manager.wait(*task.value(), 3s);
    return a && a.value()->state == TaskState::succeeded && a.value()->progress == 100 && b &&
           b.value()->state == TaskState::failed && b.value()->error && c &&
           c.value()->state == TaskState::cancelled && d &&
           d.value()->state == TaskState::cancelled &&
           !manager.submit([](TaskContext&) { return Result<void>::success(); });
}
} // namespace

int main()
{
    const auto root = fs::current_path() / "Testing" / "ForgeDesk" /
                      std::to_string(std::chrono::system_clock::now().time_since_epoch().count());
    fs::create_directories(root);
    if (!test_storage(root) || !test_tasks())
    {
        std::cerr << "Foundation service contracts failed\n";
        return 1;
    }
}
