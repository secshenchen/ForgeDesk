# 网页与 Windows 工作台

## 网页运行

使用 Node.js 22 或更新版本的 PowerShell 终端执行：

```powershell
node scripts/build-web.mjs
node scripts/check-web.mjs
node scripts/serve-web.mjs
```

打开 `http://localhost:4173/ForgeDesk/`。预览以 Pages 仓库子路径运行。所有资源位于 `dist/web/`，无需 npm 包或服务器 API。使用浏览器访问并等待“工作台资源已缓存”，在开发者工具设为离线后刷新。首次访问须能取到全部应用文件。直接双击 HTML 无法启用完整 PWA，Service Worker 需要 HTTPS 或 localhost。

缓存通过产物内容哈希区分修订。安装阶段预取静态清单，任一资源失败时保留原工作版本。新版本等待旧页面关闭后接管，并仅清理当前应用作用域的旧缓存。用户文件、临时下载、任意查询和其他站点数据不进入预缓存。浏览器可按自身存储策略回收缓存。

界面支持功能中心导航与检索、主题、设置、版本、平台能力提示和日志状态入口。文件管理中心可读取用户明确选择的文件或文件夹，在本地筛选相对路径，逐个计算 SHA-256。校验需要安全上下文，单文件上限为 32 MiB。文件不会上传，离开中心即清除选中列表。文件夹选择取决于浏览器支持。

可选浏览器验证：

```powershell
node tests/integration/web-smoke.mjs "<本地 Chromium 或 Edge 可执行文件路径>"
```

该脚本使用隔离浏览器配置和本地预览，检查导航、主题、窄窗口、缓存和服务器关闭后的离线重载。

## Windows WebView2 宿主

默认原生构建包含 Bootstrap、核心和测试。构建桌面宿主需要 MSVC 兼容工具链、Node.js 与官方 SDK。由开发者准备经过核验、已解包的 Microsoft.Web.WebView2 NuGet 包。宿主目标检查头文件和匹配架构的静态 Loader，缺失会给出明确错误。

```powershell
cmake -S . -B build/windows-desktop -G "Visual Studio 17 2022" -A x64 `
  -DFORGEDESK_WINDOWS_HOST=ON "-DFORGEDESK_WEBVIEW2_SDK=<已解包 SDK 目录>"
cmake --build build/windows-desktop --config Release --target forgedesk_desktop_ui
./build/windows-desktop/Release/forgedesk_desktop.exe
```

保持生成的 ui 目录与 EXE 同级。WebView2 用虚拟 HTTPS 主机映射本地资源，在用户 LocalAppData 的 ForgeDesk 目录保存浏览器配置。宿主限制导航、弹窗和权限请求。应用入口可发出固定的系统和卷诊断请求，其他消息会被忽略。

磁盘实验室读取带盘符的 Windows 固定卷容量。故障预测由存储驱动提供，权限不足或设备不支持时显示不可用。系统诊断中心读取 Windows 原生处理器架构、逻辑处理器数、物理内存与运行时长。

SDK 用于编译，Runtime 用于运行。Evergreen 在线引导程序需要网络，离线机器使用同架构的 Evergreen Standalone 安装包，安装后运行宿主。Fixed Version 部署把经许可分发的匹配架构 Runtime 解包在 EXE 同级 `Runtime/`，其中直接包含 `msedgewebview2.exe`。应用方负责固定版本的补丁和更新。部署方式及 Windows 版本相关权限要求以 [微软 WebView2 部署文档](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution) 为准。

## WebAssembly 验证目标

在已配置的 Emscripten 环境运行：

```powershell
emcmake cmake -S . -B build/wasm -DBUILD_TESTING=OFF
cmake --build build/wasm --target forgedesk_wasm_probe
```

目标生成 `forgedesk_wasm_probe.mjs` 与 Wasm 文件。用模块默认导出的工厂初始化，再调用 `module.UTF8ToString(module._forgedesk_version())` 获取核心版本。Wasm 目标是独立的 C ABI 验证，当前网页发布不依赖此工具链。
