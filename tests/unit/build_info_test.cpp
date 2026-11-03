#include "forgedesk/build_info.hpp"

#include <iostream>
#include <utility>

enum class Standard
{
    cpp23 = 23
};
static_assert(std::to_underlying(Standard::cpp23) == 23);

int main(int argc, char** argv)
{
    const auto info = forgedesk::build_info();
    if (argc != 2 || info.version != argv[1] || info.compiler.empty() || info.platform.empty() ||
        info.configuration.empty() || info.language_level < 202002L)
    {
        std::cerr << "Invalid build metadata\n";
        return 1;
    }
}
