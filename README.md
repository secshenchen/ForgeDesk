# ForgeDesk

以 **C++23 共享核心**为基础的综合技术工作平台，目标提供 Windows 10/11 独立桌面软件和 GitHub Pages 网页版，采用 [Apache-2.0](LICENSE) 开源协议。

**版本目标 v0.1.0。** 当前已建立 C++23 共享核心、基础服务和离线网页工作台。文件管理中心和数据工坊已开放首批本地操作。

## 项目目标

建立可长期维护的共享核心、可扩展模块和统一界面；提供完整 C++ 与 HTML/CSS/JavaScript 源码、测试和开发文档。Windows 版提供经授权的系统能力，Web 版遵循浏览器沙箱，不承诺与桌面版能力完全相同。本阶段只建设基础设施。

## 功能规划

下表列出功能方向。工作台用“可用”标记已开放的入口。

| 中心 | 未来方向 |
| --- | --- |
| 文件管理中心 | 已开放文件及文件夹浏览、名称和路径筛选、SHA-256 校验。批量处理待开发 |
| 数据工坊 | 已开放 UTF-8 CSV 导入、筛选、预览和 JSON 导出 |
| 磁盘实验室 | 经用户授权的磁盘分析和实验 |
| 系统诊断中心 | 系统信息与诊断 |
| 网络实验室 | 网络检查与诊断 |
| 开发者工具箱 | 开发辅助工具 |
| 文件安全中心 | 文件完整性与安全分析 |
| 文本与搜索中心 | 文本处理与检索 |
| 报告与统计中心 | 本地报告与统计 |
| 扩展与插件中心 | 扩展管理，动态插件方案后续审议 |

## 技术架构

依赖方向：`apps → modules / platform / core`，`modules → core`，`platform → core`。`ui` 通过应用层通信边界访问服务。核心不依赖任何上层模块、Windows API、WebView2 或 DOM。

| 技术 | 规划用途 | 本批状态 |
| --- | --- | --- |
| C++23、CMake ≥ 3.25 | 跨平台核心及构建 | 已建立构建目标与预设 |
| GCC/G++、GDB | Windows 原生编译和调试 | 后续验证现有工具链 |
| MSVC、Clang、Ninja | 兼容工具链与构建工具 | 后续验证，不强制全部安装 |
| HTML5/CSS3/原生 JavaScript | Windows/Web 共用界面 | 工作台已实现 |
| WebView2 | Windows 桌面宿主 | 已通过 Windows x64 编译和窗口启动验证 |
| Emscripten/WebAssembly | 共享核心的浏览器适配 | 可选验证目标已提供 |
| SQLite | 本地结构化持久化 | 仅架构选型，尚未引入依赖 |
| GitHub Actions/Pages | 自动验证和静态网页部署 | 工作流已准备，管理员按需启用 |

详见 [总体架构](docs/architecture/overview.md) 和 [ADR-0001](docs/decisions/ADR-0001-technology-stack.md)。

## Windows 版规划

可选 C++23 + WebView2 宿主加载本地 UI。构建需要 WebView2 SDK，运行需要相应 Runtime。宿主与离线部署步骤见 [网页与 Windows 工作台](docs/development/web-and-windows.md)。

## GitHub 网页版规划

运行 `node scripts/build-web.mjs` 构建到 `dist/web/`，运行 `node scripts/check-web.mjs` 检查离线资源，再用 `node scripts/serve-web.mjs` 在本机预览。PWA 缓存使用相对路径，首次加载完整资源后支持离线访问。Service Worker 需要 HTTPS 或 localhost。

## 离线设计

- 必要 HTML、CSS、JavaScript、图片和字体全部本地化，不依赖 CDN、在线字体或远程服务启动。
- Windows 版的本地功能断网可用；发布时明确 WebView2 Runtime 是否包含。
- 网页版缓存仅包含应用静态资源，不缓存私人用户文件或敏感数据。
- 用户数据默认保存在本地，不自动上传；不默认启用遥测。
- 网页缓存与本地资源检查已纳入开发流程，Windows 宿主运行条件单独验收。

## 开发环境与入门

推荐使用 VS Code 打开项目根目录。已提供共享设置与扩展建议，但不自动安装扩展。目录脚本使用 PowerShell 7；未来构建最低要求为 CMake 3.25 和经实际验证支持所需 C++23 功能的编译器。Windows 原生工具链至少选 GCC/G++ 或 MSVC 一套；Ninja 可选。GDB 用于 GCC 调试。Emscripten 和 WebView2 SDK 仅在对应目标需要时引入。

```powershell
# 在项目根目录执行；仅恢复目录，不覆盖文件、不下载依赖。
pwsh -NoProfile -File ./scripts/Initialize-Layout.ps1
git status --short
git diff --check
```

在 VS Code 的 PowerShell 终端执行以下命令。MSVC 预设需要 Visual Studio 2022 的 C++ 工具与 Windows SDK。参见 [开发指南](docs/development/getting-started.md)。

```powershell
cmake --preset windows-msvc-debug
cmake --build --preset windows-msvc-debug
ctest --preset windows-msvc-debug
./build/windows-msvc-debug/Debug/forgedesk_bootstrap.exe
```

GCC 使用 `windows-gcc-debug` 或 `windows-gcc-release`，要求 PATH 提供 `g++` 与 Ninja。

## 目录结构

当前工作区本身就是 ForgeDesk 项目根目录，无须再套一层同名文件夹。

```text
ForgeDesk/
├── apps/             # 应用组织层
│   ├── windows/
│   └── web/
├── core/
│   ├── include/forgedesk/
│   └── src/
├── modules/          # 未来业务模块；当前无业务实现
├── platform/
│   ├── windows/
│   └── web/
├── ui/
│   ├── src/
│   ├── styles/
│   └── assets/
├── database/         # 未来模式及迁移，非用户数据库存放处
├── tests/
│   ├── unit/
│   └── integration/
├── cmake/
├── scripts/
├── third_party/
├── packaging/
├── docs/
│   ├── architecture/
│   ├── development/
│   ├── modules/
│   └── decisions/
├── .github/workflows/
└── .vscode/          # 团队共享配置，不含个人路径
```

根目录另有 `LICENSE`、`NOTICE`、贡献、安全、变更记录和格式规范。`work/` 为本地过程文件，`outputs/` 为本地验收交付，不纳入源代码版本控制。Git 不追踪空目录；首次检出执行目录脚本即可恢复全部预留层级，不用大量空占位文件。

## 开发阶段

| 批次 | 交付范围 | 当前状态 |
| --- | --- | --- |
| 01 | 项目结构、许可证、文档与开发规范 | 已建立，按本批验收报告复核 |
| 02 | CMake/C++23、Bootstrap、CTest | 已建立 |
| 03 | 核心类型、平台服务接口、静态模块系统 | 已建立 |
| 04 | 日志、配置、路径与任务服务 | 已建立 |
| 05 | 共用离线 UI、双平台基础及 PWA | Web 和 Windows 宿主已验证，Wasm 待工具链验证 |
| 06 | 自动化、版本管理、发行准备 | 已建立，远程运行由仓库管理员启用 |

每批独立验收并记录工具链和测试结果。

## 参与与扩展

参见 [贡献指南](CONTRIBUTING.md)、[模块规范](docs/modules/README.md)、[安全政策](SECURITY.md)、[变更记录](CHANGELOG.md) 和 [CI 与发行](docs/development/release.md)。未来可扩展 Linux、更多模块和受控插件机制。版权主体尚待项目所有者确认，详见 [NOTICE](NOTICE)。
