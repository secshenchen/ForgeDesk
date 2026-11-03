#include "forgedesk/logger.hpp"

#include <array>
#include <chrono>
#include <fstream>
#include <iomanip>
#include <sstream>

namespace forgedesk
{
namespace
{
std::string record(std::string_view level, std::string_view message)
{
    using namespace std::chrono;
    const auto now = floor<seconds>(system_clock::now());
    const auto day = floor<days>(now);
    const year_month_day date{day};
    const hh_mm_ss time{now - day};
    std::ostringstream out;
    out << std::setfill('0') << std::setw(4) << int(date.year()) << '-' << std::setw(2)
        << unsigned(date.month()) << '-' << std::setw(2) << unsigned(date.day()) << 'T'
        << std::setw(2) << time.hours().count() << ':' << std::setw(2) << time.minutes().count()
        << ':' << std::setw(2) << time.seconds().count() << "Z [" << level << "] ";
    for (const char ch : message)
    {
        if (ch == '\n' || ch == '\r')
        {
            out << (ch == '\n' ? "\\n" : "\\r");
        }
        else
        {
            out << ch;
        }
    }
    out << '\n';
    return std::move(out).str();
}
} // namespace

Logger::Logger(std::filesystem::path directory, std::uintmax_t max_bytes, LogLevel minimum,
               std::ostream& console)
    : directory_(std::move(directory)), max_bytes_(max_bytes), minimum_(minimum), console_(console)
{
}

Result<void> Logger::log(LogLevel level, std::string_view message)
{
    constexpr std::array names{"TRACE", "DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"};
    const auto index = static_cast<std::size_t>(level);
    if (index >= names.size() || !directory_.is_absolute() || max_bytes_ == 0)
    {
        return Result<void>::failure({ErrorCode::invalid_argument, "Invalid log configuration"});
    }
    if (level < minimum_)
    {
        return Result<void>::success();
    }
    const auto line = record(names[index], message);
    if (line.size() > max_bytes_)
    {
        return Result<void>::failure(
            {ErrorCode::invalid_argument, "Log record exceeds size limit"});
    }

    namespace fs = std::filesystem;
    std::lock_guard lock{mutex_};
    std::error_code ec;
    fs::create_directories(directory_, ec);
    if (ec)
    {
        return Result<void>::failure(
            {ErrorCode::io, "Cannot create log directory: " + ec.message()});
    }
    const auto file = directory_ / "forgedesk.log";
    const auto archive = directory_ / "forgedesk.log.1";
    const auto status = fs::symlink_status(file, ec);
    std::uintmax_t size = 0;
    if (status.type() != fs::file_type::not_found)
    {
        if (ec || !fs::is_regular_file(status) || fs::hard_link_count(file, ec) != 1 || ec)
        {
            return Result<void>::failure({ErrorCode::io, "Log path is not a private regular file"});
        }
        size = fs::file_size(file, ec);
        if (ec)
        {
            return Result<void>::failure({ErrorCode::io, "Cannot inspect log: " + ec.message()});
        }
    }
    if (size > max_bytes_ - line.size())
    {
        const auto archived = fs::symlink_status(archive, ec);
        if (archived.type() != fs::file_type::not_found && (ec || !fs::is_regular_file(archived)))
        {
            return Result<void>::failure({ErrorCode::io, "Log archive path is unsafe"});
        }
        fs::rename(file, archive, ec);
        if (ec)
        {
            return Result<void>::failure({ErrorCode::io, "Cannot rotate log: " + ec.message()});
        }
    }
    std::ofstream stream{file, std::ios::binary | std::ios::app};
    stream << line;
    stream.close();
    if (!stream)
    {
        return Result<void>::failure({ErrorCode::io, "Cannot write log"});
    }
    console_ << line;
    console_.flush();
    if (!console_)
    {
        return Result<void>::failure({ErrorCode::io, "Cannot write console log"});
    }
    return Result<void>::success();
}
} // namespace forgedesk
