#include "forgedesk/types.hpp"

namespace forgedesk
{
std::string Version::to_string() const
{
    return std::to_string(major) + "." + std::to_string(minor) + "." + std::to_string(patch);
}
} // namespace forgedesk
