cmake_minimum_required(VERSION 3.25)
file(STRINGS "${CMAKE_CURRENT_SOURCE_DIR}/VERSION" FORGEDESK_VERSION LIMIT_COUNT 1)
project(ForgeDesk VERSION "${FORGEDESK_VERSION}" LANGUAGES CXX)
set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/VERSION")

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
get_property(multi_config GLOBAL PROPERTY GENERATOR_IS_MULTI_CONFIG)
if(NOT multi_config AND NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Debug CACHE STRING "Build configuration" FORCE)
endif()

include(CTest)
configure_file(cmake/build_version.hpp.in generated/forgedesk/build_version.hpp @ONLY)

add_library(forgedesk_core STATIC
    core/src/build_info.cpp core/src/types.cpp core/src/module.cpp
    core/src/app_paths.cpp core/src/logger.cpp core/src/settings_store.cpp)
if(NOT EMSCRIPTEN)
    find_package(Threads REQUIRED)
    target_sources(forgedesk_core PRIVATE core/src/task_manager.cpp)
    target_link_libraries(forgedesk_core PUBLIC Threads::Threads)
endif()
target_compile_features(forgedesk_core PUBLIC cxx_std_23)
target_include_directories(forgedesk_core PUBLIC core/include PRIVATE "${CMAKE_CURRENT_BINARY_DIR}/generated")
target_compile_definitions(forgedesk_core PRIVATE
    "FORGEDESK_COMPILER=\"${CMAKE_CXX_COMPILER_ID} ${CMAKE_CXX_COMPILER_VERSION}\""
    "FORGEDESK_PLATFORM=\"${CMAKE_SYSTEM_NAME}\""
    "FORGEDESK_CONFIGURATION=\"$<CONFIG>\"")

add_executable(forgedesk_bootstrap apps/windows/bootstrap.cpp)
target_link_libraries(forgedesk_bootstrap PRIVATE forgedesk_core)

include(cmake/WebView2Host.cmake)
if(EMSCRIPTEN)
    add_executable(forgedesk_wasm_probe apps/web/wasm_probe.cpp)
    target_link_libraries(forgedesk_wasm_probe PRIVATE forgedesk_core)
    target_link_options(forgedesk_wasm_probe PRIVATE --no-entry
        "-sMODULARIZE=1" "-sEXPORT_ES6=1" "-sEXPORTED_RUNTIME_METHODS=UTF8ToString")
    set_target_properties(forgedesk_wasm_probe PROPERTIES SUFFIX ".mjs")
endif()

if(BUILD_TESTING)
    add_executable(forgedesk_tests tests/unit/build_info_test.cpp)
    target_link_libraries(forgedesk_tests PRIVATE forgedesk_core)
    add_test(NAME core.build_info COMMAND forgedesk_tests "${PROJECT_VERSION}")
    add_executable(forgedesk_core_tests tests/unit/core_test.cpp)
    target_link_libraries(forgedesk_core_tests PRIVATE forgedesk_core)
    add_test(NAME core.contracts COMMAND forgedesk_core_tests)
    if(NOT EMSCRIPTEN)
        add_executable(forgedesk_service_tests tests/unit/services_test.cpp)
        target_link_libraries(forgedesk_service_tests PRIVATE forgedesk_core)
        add_test(NAME core.services COMMAND forgedesk_service_tests)
        set_tests_properties(core.services PROPERTIES TIMEOUT 20)
    endif()
    add_test(NAME bootstrap.metadata COMMAND "${CMAKE_COMMAND}"
        "-DPROGRAM=$<TARGET_FILE:forgedesk_bootstrap>" "-DVERSION=${PROJECT_VERSION}"
        "-DCONFIG=$<CONFIG>" -P "${CMAKE_CURRENT_SOURCE_DIR}/tests/integration/bootstrap.cmake")
endif()
