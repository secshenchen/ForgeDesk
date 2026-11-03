# Windows 发行准备

## Bootstrap 验证包

先构建并测试 `windows-msvc-release`，再执行 `pwsh -NoProfile -File ./scripts/Package-WindowsBootstrap.ps1`。该脚本核对实际程序报告的版本与配置，创建 `dist/release/ForgeDesk-<版本>-windows-x64-bootstrap.zip` 并输出 SHA-256。验收旧产物后使用新的构建输出位置或由维护者处理旧归档。

## 未来桌面发行布局

```text
ForgeDesk/
  forgedesk_desktop.exe
  ui/
    index.html
    src/
    styles/
    assets/
    platform/
  Runtime/                 # Fixed Version 部署时
  LICENSE
  NOTICE
```

UI 使用宿主构建产生的完整目录。安装目录存放 EXE、应用资源与许可。运行时配置、日志、缓存和 WebView2 用户数据位于用户数据目录，便携版按显式设置使用独立数据目录。默认安装方式将二进制置于只读程序目录，并为用户数据保留可写位置。

| 组件 | 当前归属 | 发行条件 |
| --- | --- | --- |
| ForgeDesk Bootstrap | 本项目，可生成 x64 验证包 | 匹配 MSVC 运行库 |
| ForgeDesk UI | 本项目，Node.js 构建为本地资源 | 静态资源完整 |
| WebView2 SDK 与 Loader | 可选微软 SDK | 引入时登记准确版本、许可及 Loader 分发条件 |
| Evergreen Runtime | 目标系统或独立安装 | 联网引导或架构匹配的离线 Standalone 安装 |
| Fixed Version Runtime | 未来可选的独立分发内容 | 核验再分发条件、架构、签名与版本更新 |
| SQLite、Emscripten | 可选规划或开发工具 | 当前 Windows 验证包未使用 |

未来便携版可使用已有 Evergreen 或携带 Fixed Version。安装版可检测并引导 Runtime 安装，完整离线包需准备适用 Runtime 与 VC++ 运行库并在干净 Windows 环境实际验证。当前交付为 Bootstrap 验证包及宿主构建说明。

离线部署步骤和微软官方文档见 [网页与 Windows 工作台](../../docs/development/web-and-windows.md)。
