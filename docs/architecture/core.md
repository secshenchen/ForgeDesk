# 核心层

批次 03 已实现基础类型与平台、模块接口。基础服务由批次 04 接入。

## 职责与布局

`core/include/forgedesk/` 保存公开头文件，`core/src/` 保存实现。未来构建为 `forgedesk_core`，可供原生应用链接，并为 WebAssembly 保留可编译边界。

核心不包含 Windows API、WebView2、浏览器、DOM 或具体界面依赖；不直接操作用户文件。优先使用 C++23 标准库，公共头文件不泄露第三方实现。平台特有能力由注入接口调用。

## 计划接口

| 接口 | 责任及约束 |
| --- | --- |
| `Version` | 描述版本，不依赖界面字符串 |
| `Error` | 明确错误码和可读说明，不把失败默认为成功 |
| `Result<T>` / `Result<void>` | 表达值或失败，正确支持无返回值操作 |
| `ModuleId` / `TaskId` / `PlatformId` | 明确标识语义，避免混用 |
| `IPlatformServices` | 声明平台、目录、能力和文件访问接口，不实现平台 API |
| `ModuleDescriptor` / `IModule` / `ModuleRegistry` | 静态注册、能力检查和受控生命周期 |

接口分别位于 `types.hpp`、`result.hpp`、`platform_services.hpp` 和 `module.hpp`。先检查 `Result<T>` 的布尔状态，再用 `value()` 或 `error()` 访问对应对象。非活动分支返回空指针。指针依赖结果对象的生命周期。`Result<void>` 成功时没有值，失败时保留错误码和说明。

## 服务边界

日志、配置与路径服务的目录由平台或应用提供，不把 Windows 已知目录查找混入核心。任何持久化 I/O 都须在已授权服务边界内，核心算法不随意打开用户文件。任务管理使用有限线程及协作取消；线程功能在 WebAssembly 上的可用性须由平台适配，不强迫 Web 构建启用原生线程。

## 公共契约与验证

接口文档应说明所有权、前置条件、错误、线程安全和生命周期。CTest 的 `core.contracts` 覆盖结果分支、版本、重复 ID、查询注销、初始化回滚和能力拒绝。
