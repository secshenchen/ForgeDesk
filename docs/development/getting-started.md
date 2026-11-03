# 开发指南

## 当前可用内容

构建提供 `forgedesk_core` 静态库、`forgedesk_bootstrap` 启动验证和 `forgedesk_tests` 单元测试。版本来自根目录 `VERSION`。

## VS Code 工作方式

在 VS Code 中选择“文件 → 打开文件夹”，打开项目根目录，而不是只打开 `ui/`。如果 `code` 命令可用，也可在根目录执行：

```powershell
code .
```

`.vscode/settings.json` 统一 UTF-8、LF、缩进和 C++ 格式配置。打开目录后可通过 CMake Tools 的 Configure Preset 选择 MSVC 或 GCC，或者在终端显式运行命令。共享配置使用可移植路径。

使用 VS Code 集成 PowerShell 终端查看实际命令和结果。当前 PATH 缺工具不代表未安装，Visual Studio Developer PowerShell 可提供已有 MSVC 环境；不要擅自修改系统 PATH 或安装依赖。

## 首次检出与检查

脚本要求 PowerShell 7（`pwsh`），使用脚本自身位置确定项目根目录。它只创建约定的缺失目录；碰到同名文件会报错，不覆盖文件。

```powershell
git status --short
git branch --show-current
pwsh -NoProfile -File ./scripts/Initialize-Layout.ps1
git diff --check
```

Git 不跟踪空目录，因此源码克隆后部分预留层级暂不出现是正常现象。运行目录脚本恢复；正式文件加入后自然由 Git 保留相应目录。不提交大量空占位文件。

`git diff --check` 不检查未跟踪文件。尚未暂存的新项目可用 `git diff --no-index --check -- /dev/null <文件>` 分别检查新文件；或在决定暂存后运行 `git diff --cached --check`。验收必须明确新文件是否实际纳入检查，不能只看空 diff。

## 工具与版本检查

未来原生构建需要 CMake ≥ 3.25、满足实际 C++23 特性的 GCC/G++、Clang 或 MSVC；Ninja 可选。Windows GCC 调试使用 GDB。Emscripten、WebView2 SDK/Runtime 与 SQLite 在对应目标需要时再引入。

```powershell
Get-Command git, cmake, gcc, g++, gdb, clang, clang++, cl, ninja, emcc -ErrorAction SilentlyContinue
git --version
# 以下仅在对应命令存在时运行；当前不声称全部可用。
cmake --version
g++ --version
gdb --version
ninja --version
```

MSVC 在 Developer PowerShell 中用 `cl` 显示版本；安装 Visual Studio 不保证安装了 C++ 组件。WebView2 Runtime 不等于 SDK，常见目录未找到也不证明机器任意位置完全不存在。记录检测范围和未执行验证。

本机环境的点时检测结果放入本批验收报告，不在可移植配置中固定机器绝对路径。

## 原生配置、构建与测试

在 VS Code 集成终端运行。若 CMake 不在 PATH，可使用 Visual Studio Developer PowerShell，或通过 `& $cmake` 和 `& $ctest` 调用 VS 安装目录中的工具。

```powershell
cmake --preset windows-msvc-debug
cmake --build --preset windows-msvc-debug
ctest --preset windows-msvc-debug
./build/windows-msvc-debug/Debug/forgedesk_bootstrap.exe

cmake --preset windows-gcc-debug
cmake --build --preset windows-gcc-debug
ctest --preset windows-gcc-debug
./build/windows-gcc-debug/forgedesk_bootstrap.exe
```

Release 将三处预设名的 `debug` 改成 `release`。MSVC 产物在对应配置子目录，Ninja 单配置产物在构建目录。Clang 可用 `cmake -S . -B build/clang -G Ninja -DCMAKE_CXX_COMPILER=clang++ -DCMAKE_BUILD_TYPE=Debug` 配置。

可选 WebView2 与 Emscripten 构建步骤见 [网页与 Windows 工作台](web-and-windows.md)。发行和 CI 见 [CI 与发行](release.md)。
