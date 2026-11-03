#include "forgedesk/settings_store.hpp"

#include <algorithm>
#include <charconv>
#include <fstream>
#include <sstream>

namespace forgedesk
{
namespace
{
namespace fs = std::filesystem;
constexpr std::size_t max_bytes = 1024 * 1024;

Result<void> io(std::string message)
{
    return Result<void>::failure({ErrorCode::io, std::move(message)});
}

bool valid_key(std::string_view key)
{
    return !key.empty() && std::ranges::all_of(key,
                                               [](char ch)
                                               {
                                                   return (ch >= 'a' && ch <= 'z') ||
                                                          (ch >= 'A' && ch <= 'Z') ||
                                                          (ch >= '0' && ch <= '9') || ch == '.' ||
                                                          ch == '_' || ch == '-';
                                               });
}

bool valid_utf8(std::string_view text)
{
    for (std::size_t i = 0; i < text.size();)
    {
        const auto lead = static_cast<unsigned char>(text[i++]);
        if (lead < 0x80)
        {
            if (lead == 0)
            {
                return false;
            }
            continue;
        }
        if (lead < 0xc2 || lead > 0xf4)
        {
            return false;
        }
        const unsigned length = lead < 0xe0 ? 1 : lead < 0xf0 ? 2 : 3;
        unsigned scalar = lead & (0x7fU >> (length + 1));
        for (unsigned j = 0; j < length; ++j)
        {
            if (i == text.size())
            {
                return false;
            }
            const auto byte = static_cast<unsigned char>(text[i++]);
            if ((byte & 0xc0) != 0x80)
            {
                return false;
            }
            scalar = (scalar << 6) | (byte & 0x3f);
        }
        if ((length == 2 && scalar < 0x800) || (length == 3 && scalar < 0x10000) ||
            (scalar >= 0xd800 && scalar <= 0xdfff) || scalar > 0x10ffff)
        {
            return false;
        }
    }
    return true;
}

std::optional<SettingValue> decode(std::string_view text)
{
    if (text.starts_with("s:"))
    {
        std::string result;
        for (std::size_t i = 2; i < text.size(); ++i)
        {
            char ch = text[i];
            if (ch == '\\')
            {
                if (++i == text.size())
                {
                    return std::nullopt;
                }
                switch (text[i])
                {
                case '\\':
                    ch = '\\';
                    break;
                case 'n':
                    ch = '\n';
                    break;
                case 'r':
                    ch = '\r';
                    break;
                case 't':
                    ch = '\t';
                    break;
                default:
                    return std::nullopt;
                }
            }
            result += ch;
        }
        return SettingValue{std::move(result)};
    }
    if (text.starts_with("i:"))
    {
        std::int64_t value{};
        const auto end = text.data() + text.size();
        const auto parsed = std::from_chars(text.data() + 2, end, value);
        if (parsed.ec == std::errc{} && parsed.ptr == end)
        {
            return SettingValue{value};
        }
    }
    if (text == "b:true" || text == "b:false")
    {
        return SettingValue{text == "b:true"};
    }
    return std::nullopt;
}

void encode(std::ostream& out, const SettingValue& value)
{
    if (const auto* text = std::get_if<std::string>(&value))
    {
        out << "s:";
        for (char ch : *text)
        {
            switch (ch)
            {
            case '\\':
                out << "\\\\";
                break;
            case '\n':
                out << "\\n";
                break;
            case '\r':
                out << "\\r";
                break;
            case '\t':
                out << "\\t";
                break;
            default:
                out << ch;
                break;
            }
        }
    }
    else if (const auto* number = std::get_if<std::int64_t>(&value))
    {
        out << "i:" << std::to_string(*number);
    }
    else
    {
        out << (std::get<bool>(value) ? "b:true" : "b:false");
    }
}

bool regular_or_absent(const fs::path& path, bool& exists)
{
    std::error_code ec;
    const auto status = fs::symlink_status(path, ec);
    exists = fs::exists(status);
    return (!ec && fs::is_regular_file(status)) || status.type() == fs::file_type::not_found;
}
} // namespace

Result<void> SettingsStore::set(std::string key, SettingValue value)
{
    const auto* text = std::get_if<std::string>(&value);
    if (!valid_key(key) || (text && !valid_utf8(*text)))
    {
        return Result<void>::failure({ErrorCode::invalid_argument, "Invalid setting key or UTF-8"});
    }
    values_.insert_or_assign(std::move(key), std::move(value));
    return Result<void>::success();
}

SettingValue SettingsStore::get(std::string_view key, SettingValue fallback) const
{
    const auto it = values_.find(key);
    return it != values_.end() && it->second.index() == fallback.index() ? it->second
                                                                         : std::move(fallback);
}

Result<void> SettingsStore::load(const fs::path& path)
{
    bool exists = false;
    std::error_code ec;
    if (!regular_or_absent(path, exists) || !exists)
    {
        return io("Settings file missing or not a regular file");
    }
    const auto size = fs::file_size(path, ec);
    if (ec || size > max_bytes)
    {
        return io("Cannot read settings file or size exceeds limit");
    }
    std::string bytes(static_cast<std::size_t>(size), '\0');
    std::ifstream in{path, std::ios::binary};
    if (!in.read(bytes.data(), static_cast<std::streamsize>(size)) ||
        in.peek() != std::char_traits<char>::eof() || in.bad())
    {
        return io("Settings file read failed or changed");
    }
    if (!valid_utf8(bytes) || bytes.starts_with("\xef\xbb\xbf"))
    {
        return Result<void>::failure({ErrorCode::malformed, "Settings require UTF-8 without BOM"});
    }
    decltype(values_) loaded;
    std::istringstream lines{std::move(bytes)};
    std::string line;
    std::size_t number = 0;
    while (std::getline(lines, line))
    {
        ++number;
        if (!line.empty() && line.back() == '\r')
        {
            line.pop_back();
        }
        if (line.empty() || line.starts_with('#'))
        {
            continue;
        }
        const auto equals = line.find('=');
        const auto key = line.substr(0, equals);
        auto value = equals == std::string::npos
                         ? std::nullopt
                         : decode(std::string_view{line}.substr(equals + 1));
        if (!valid_key(key) || !value || !loaded.try_emplace(key, std::move(*value)).second)
        {
            return Result<void>::failure(
                {ErrorCode::malformed,
                 "Invalid or duplicate setting at line " + std::to_string(number)});
        }
    }
    values_.swap(loaded);
    return Result<void>::success();
}

Result<void> SettingsStore::save(const fs::path& path) const
{
    if (!path.is_absolute() || !path.has_filename())
    {
        return Result<void>::failure(
            {ErrorCode::invalid_argument, "Use an absolute settings path"});
    }
    std::ostringstream out;
    for (const auto& [key, value] : values_)
    {
        out << key << '=';
        encode(out, value);
        out << '\n';
    }
    const auto bytes = std::move(out).str();
    if (bytes.size() > max_bytes)
    {
        return Result<void>::failure({ErrorCode::invalid_argument, "Settings exceed size limit"});
    }
    auto staged = path;
    staged += ".new";
    auto backup = path;
    backup += ".bak";
    bool original_exists = false;
    bool stage_exists = false;
    bool backup_exists = false;
    if (!regular_or_absent(path, original_exists) || !regular_or_absent(staged, stage_exists) ||
        stage_exists || !regular_or_absent(backup, backup_exists))
    {
        return io("Settings paths are unsafe or a staging file already exists");
    }
    std::ofstream stream{staged, std::ios::binary};
    stream << bytes;
    stream.close();
    if (!stream)
    {
        return io("Cannot write staged settings");
    }
    std::error_code ec;
    if (original_exists)
    {
        auto backup_staged = backup;
        backup_staged += ".new";
        bool backup_staged_exists = false;
        if (!regular_or_absent(backup_staged, backup_staged_exists) || backup_staged_exists)
        {
            return io("Backup staging path is unsafe or already exists");
        }
        fs::copy_file(path, backup_staged, fs::copy_options::none, ec);
        if (!ec)
        {
            fs::rename(backup_staged, backup, ec);
        }
        if (ec)
        {
            return io("Cannot back up settings: " + ec.message());
        }
    }
    fs::rename(staged, path, ec);
    if (ec)
    {
        return io("Cannot replace settings: " + ec.message());
    }
    return Result<void>::success();
}
} // namespace forgedesk
