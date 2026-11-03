option(FORGEDESK_WINDOWS_HOST "Build the optional Windows WebView2 desktop host" OFF)
set(FORGEDESK_WEBVIEW2_SDK "" CACHE PATH "Extracted Microsoft.Web.WebView2 NuGet package directory")
if(NOT FORGEDESK_WINDOWS_HOST)
    return()
endif()
if(NOT WIN32 OR NOT MSVC)
    message(FATAL_ERROR "The WebView2 host requires a Windows MSVC-compatible toolchain")
endif()
if(CMAKE_VS_PLATFORM_NAME STREQUAL "ARM64" OR CMAKE_CXX_COMPILER_ARCHITECTURE_ID STREQUAL "ARM64")
    set(webview_arch arm64)
elseif(CMAKE_SIZEOF_VOID_P EQUAL 8)
    set(webview_arch x64)
else()
    set(webview_arch x86)
endif()
set(webview_native "${FORGEDESK_WEBVIEW2_SDK}/build/native")
set(webview_loader "${webview_native}/${webview_arch}/WebView2LoaderStatic.lib")
if(NOT FORGEDESK_WEBVIEW2_SDK OR NOT EXISTS "${webview_native}/include/WebView2.h"
    OR NOT EXISTS "${webview_loader}")
    message(FATAL_ERROR "WebView2 SDK missing. Set FORGEDESK_WEBVIEW2_SDK to an extracted official SDK package.")
endif()
find_program(FORGEDESK_NODE node REQUIRED)
add_executable(forgedesk_desktop WIN32 apps/windows/desktop.cpp platform/windows/desktop_paths.cpp)
target_compile_definitions(forgedesk_desktop PRIVATE UNICODE _UNICODE NOMINMAX)
target_include_directories(forgedesk_desktop PRIVATE "${webview_native}/include" platform/windows)
target_link_libraries(forgedesk_desktop PRIVATE forgedesk_core "${webview_loader}"
    ole32 shell32 shlwapi version uuid)
add_custom_target(forgedesk_desktop_ui ALL
    COMMAND "${FORGEDESK_NODE}" "${CMAKE_CURRENT_SOURCE_DIR}/scripts/build-web.mjs"
        --desktop "$<TARGET_FILE_DIR:forgedesk_desktop>/ui"
    DEPENDS forgedesk_desktop
    VERBATIM)
