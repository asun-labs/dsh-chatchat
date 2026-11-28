# 开发与验证

[返回首页](../README.md) · [宿主加载与兼容](host-integration.md)

## 开发与构建

需要 Node.js `^22.19.0 || >=24.0.0`；正式发布打包使用 npm `11.21.3`，与线上发布流程一致。在本仓库执行：

```sh
npm ci
npm run build
npm run test:package
npm run pack:release
```

`npm ci` 根据 `package-lock.json` 安装开发依赖并通过 `prepare` 构建。`npm run build` 使用固定的 esbuild 0.25.12，生成 Client Loader 格式的 `lib/client.js`、source map 和 `office.js`。React、React DOM 与 DSH Client UI primitives 由宿主提供；`deep-view`、二维码和纯工作区地址工具打入 Client，不引入第二份 React。构建和打包脚本只读本仓库与已安装的本地依赖，不下载最新源码。

Git 仓库仅保存源码、资源、锁文件与许可证，忽略 `lib/`、`office.js`、`node_modules/` 和 `dist/`。源码开发的 `prepare` 与 `prepack` 会构建；面向用户的 `npm run pack:release` 则先构建，再把已编译 Client、Host、资源、bundle patch 和声明装入 `dist/dsh-chatchat-<version>.tgz`，同时生成 SHA-256 与 SHA-512 完整性摘要。发布包剔除全部安装/构建脚本和开发依赖，内含 `npm-shrinkwrap.json` 固定运行依赖；安装该包不执行源码编译。

线上发布使用 GitHub Actions 的 **Build and release ChatChat** 工作流，从 `main` 手动触发并输入 `package.json` 的版本号。流程校验版本与发布说明，执行构建及测试，通过后上传版本化 `.tgz`、校验文件与元数据到 GitHub Releases；已存在的版本不会被覆盖。

## 测试

```sh
npm test
npm run test:integration
npm run test:package
```

`npm test` 运行继承的兼容测试，历史产品差异与不可用 fixture 的逐项说明保留在 `test/profile-exclusions.json`，不算作已通过。`npm run test:integration` 运行本仓库新增的通用与集成回归；原生 SDK 测试需要对应 DSH 包，浏览器测试需要显式提供可用 Chromium，缺少的环境应单独报告。`npm run test:package` 验证实际构建依赖图、Client Loader、资源与 npm 包内容；`tests/release-package.test.mjs` 对真实发布 tarball 使用原生 DSH bundle/Profile 与插件管理器验证识别、启用、停用和重载，不访问真实用户目录或模型。

测试默认使用本包开发依赖，也可显式将 `DSH_HARNESS` 设为独立 SDK 安装根（其中应有 `package.json` 与所需 `node_modules`）。继承测试还支持本仓库 `dev/harness` 的单独安装；测试入口不会探测相邻 Seal checkout。SDK 路径只提供代码，不应指向真实用户资料。测试入口将 `DSH_HOME` 重定向到临时目录，测试不调用真实模型或读取用户凭据。
