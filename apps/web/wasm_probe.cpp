#include "forgedesk/build_info.hpp"

#include <emscripten/emscripten.h>

// C ABI boundary. The returned UTF-8 version has program lifetime.
extern "C" EMSCRIPTEN_KEEPALIVE const char* forgedesk_version()
{
    return forgedesk::build_info().version.data();
}
