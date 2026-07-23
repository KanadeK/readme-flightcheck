# README Flightcheck

README Flightcheck 是一个本地优先的 README 质量门：解析安装、运行、测试和示例代码块；在隔离副本里真实演练获准命令；检查链接与截图；并解释评分中的每一项扣分。

当前检出从公开项目合同、依赖策略、架构边界和自动质量门开始。各功能层按独立里程碑提交，确保 v0.1.0 发布前每一层都能依据合同审查。

## 产品边界

- 默认只在本地处理仓库内容。
- 命令执行需要显式开启，使用允许列表、不经过 shell，并且只作用于临时仓库副本。
- 网络链接检查和浏览器快照均需显式开启。
- 通过评分不能替代人工安全审查。

## 开发

需要 Node.js 22 或 24，以及 npm 11。

```sh
npm ci
npm run verify
```

参见[架构](docs/ARCHITECTURE.md)、[隐私与安全](docs/PRIVACY_AND_SECURITY.md)和[公开仓库抽样](docs/COMPETITOR_SCAN.md)。

## 许可证

[MIT](LICENSE)
