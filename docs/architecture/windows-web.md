# Windows 与 Web 双平台关系

已提供共用 UI、静态网页、可选 WebView2 宿主源码及 Wasm 验证入口。平台验证状态见 [运行指南](../development/web-and-windows.md)。

## 共用与差异

| 项目 | Windows 规划 | Web 规划 |
| --- | --- | --- |
| 应用入口 | `apps/windows/`，C++23 宿主 | `apps/web/`，静态网页入口与构建组织 |
| 核心 | 原生 C++ 库 | 经独立绑定边界接入 WebAssembly |
| 界面 | WebView2 加载本地 `ui/` 资源 | 同一 `ui/` 资源的静态构建 |
| 文件 | 经授权的原生平台服务 | 用户选择或浏览器授予范围内 |
| 系统诊断 | 后续按权限实现 | 受限或不支持，明确提示 |
| 数据 | 用户目录或显式便携目录 | 浏览器存储及用户授权文件 |
| 离线 | 本地 UI、核心和所需 Runtime | 首访后静态资源缓存，HTTPS/localhost |

共享源码不意味着共享全部系统能力。平台不支持的模块不能伪装为可用。

## Windows 宿主

WebView2 SDK 用于编译宿主，Runtime 用于实际运行，两者不可混淆。未来须检测并区分 Evergreen 在线安装、离线安装方式与 Fixed Version Runtime 的随包部署。是否具备完整离线自包含条件要在发行验收中实际核实，不能仅因为安装了 SDK 就宣称离线可运行。缺依赖时不自动下载，不生成假 EXE，不阻塞核心构建。

## Web 与 WebAssembly

Web 静态产物位于 `dist/web/`；使用相对路径，不依赖服务器 API 或远程脚本。GitHub Pages 部署由后续官方 Pages Actions 准备，并由管理员决定启用。

Emscripten 为可选工具链，未安装时不影响原生构建。C++ 与 JavaScript 的绑定放在独立适配边界，核心不含 DOM；原生线程、文件路径和浏览器存储须分别适配。第一阶段只准备并在工具允许时验证最小目标，不承诺整个桌面服务直接编译即可在浏览器运行。

## 验证边界

后续分别报告原生编译、Windows 宿主、Web 静态构建、PWA 离线与 WebAssembly 的真实结果。未安装的可选工具链标为未执行。WebView2、Emscripten 和 SQLite 依赖不得在配置时未经确认自动下载。
