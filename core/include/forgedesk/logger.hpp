#pragma once

#include "forgedesk/result.hpp"

#include <cstdint>
#include <filesystem>
#include <mutex>
#include <ostream>
#include <string_view>

namespace forgedesk
{
enum class LogLevel
{
    trace,
    debug,
    info,
    warning,
    error,
    critical
};

/// One instance owns a log directory. The console stream must outlive the logger.
class Logger
{
  public:
    Logger(std::filesystem::path directory, std::uintmax_t max_bytes, LogLevel minimum,
           std::ostream& console);
    /// Writes a UTF-8 message as one record. Keeps the current log and one archive.
    [[nodiscard]] Result<void> log(LogLevel level, std::string_view message);

  private:
    std::filesystem::path directory_;
    std::uintmax_t max_bytes_;
    LogLevel minimum_;
    std::ostream& console_;
    std::mutex mutex_;
};
} // namespace forgedesk
