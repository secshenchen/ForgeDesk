#include "forgedesk/build_info.hpp"

#include <iostream>

int main()
{
    const auto info = forgedesk::build_info();
    std::cout << "ForgeDesk Bootstrap\n"
              << "Version: " << info.version << '\n'
              << "Compiler: " << info.compiler << '\n'
              << "Standard: C++23 (" << info.language_level << ")\n"
              << "Build: " << info.configuration << '\n'
              << "Platform: " << info.platform << '\n';
    return std::cout ? 0 : 1;
}
