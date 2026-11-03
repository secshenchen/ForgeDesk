#include "forgedesk/build_info.hpp"

#include "forgedesk/build_version.hpp"

namespace forgedesk
{
BuildInfo build_info() noexcept
{
#ifdef _MSVC_LANG
    constexpr long language = _MSVC_LANG;
#else
    constexpr long language = __cplusplus;
#endif
    return {FORGEDESK_VERSION, FORGEDESK_COMPILER, FORGEDESK_PLATFORM, FORGEDESK_CONFIGURATION,
            language};
}
} // namespace forgedesk
