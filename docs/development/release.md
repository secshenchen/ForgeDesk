# CI 与发行

## 本地验收

```powershell
cmake --preset windows-msvc-release
cmake --build --preset windows-msvc-release
ctest --preset windows-msvc-release
./build/windows-msvc-release/Release/forgedesk_bootstrap.exe
node scripts/build-web.mjs
node scripts/check-web.mjs
git diff --check
```

格式检查使用 clang-format 18 和项目配置。可选浏览器测试及安装 SDK 后的 Windows、WebAssembly 步骤见 [网页与 Windows 工作台](web-and-windows.md)。

## GitHub Actions

| 工作流 | 行为 |
| --- | --- |
| `ci.yml` | Windows MSVC Debug、Ubuntu GCC Release、CTest、格式检查、网页资源及 Chrome 离线测试 |
| `web-build.yml` | 手动构建并上传 Pages 产物。管理员选择 deploy 后，使用官方 Pages Actions 和 github-pages 环境部署 |
| `release.yml` | 手动或版本标签触发，构建 Bootstrap zip 和静态 Web tar.gz，保留为 Actions 构建产物 |

默认工作流权限为只读。仅选择 Pages 部署时，由依赖构建结果的部署任务请求 pages 和 id-token 写权限。仓库管理员需先选用 GitHub Actions 发布源并配置环境保护。产物不提交回源码分支。参见 [GitHub Pages 工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 版本和发布步骤

根目录 VERSION 保存 `major.minor.patch`。CMake 读取它生成核心版本，Bootstrap 显示相同值，网页构建生成版本模块，发行脚本校验版本和标签。发布标签使用 `v<版本>`，例如 `v0.1.0`。

1. 更新 VERSION、CHANGELOG 与文档中的发行状态。
2. 完成本地原生与 Web 验收，再检查远程 CI 结果。
3. 核对归档内容、哈希、许可证、已验证的平台与依赖要求。
4. 由维护者创建与 VERSION 一致的标签。工作流产物核验完成后，再由维护者决定公开发布及部署。

## 常见问题

- 找不到 CMake 时，从 Visual Studio Developer PowerShell 或已安装工具位置调用 CMake、CTest。
- GCC 预设需要 Ninja 与 g++。特性编译失败时核查编译器和标准库版本。
- WebView2 SDK 缺失时可先构建原生核心。Runtime 安装目录只提供运行依赖。
- 页面直接双击或未建立安全上下文时，使用本机预览服务验证 Service Worker。
- 离线资源检查发现多余旧产物时，先核对 `dist/web/` 内容，使用干净的构建工作区重建。
- 发行 zip 已存在时，核对已有文件并明确处理旧归档，再重新打包。
