# 本地验收入口

源码与普通构建步骤见开发指南。Windows 宿主可用 `forgedesk_desktop.exe --self-test` 在实际 WebView2 中执行十个入口的基本集成检查，完成后自行关闭。成功退出码为 0，失败为 1，测试结果保存在 EXE 同级的 `self-test-result.txt`。测试会在当前 WebView2 配置中登记一条测试扩展，因此请使用隔离的用户数据目录。

示例 PowerShell 命令：

```powershell
$env:WEBVIEW2_USER_DATA_FOLDER = Join-Path (Get-Location) 'build/acceptance-profile'
$p = Start-Process ./build/windows-desktop/Release/forgedesk_desktop.exe -ArgumentList '--self-test' -PassThru -Wait
$p.ExitCode
```

该检查使用运行时 File 对象验证计算和导入逻辑，检查导出 Blob 的 JSON 内容。原生文件选择对话框、系统保存对话框、不同设备的故障预测支持和干净系统安装需要额外的人工或目标机器验收。
