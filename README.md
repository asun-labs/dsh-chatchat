# DSH ChatChat

DSH 团队智能体与群聊插件。每个 Bot 使用原生 DSH 会话，提供团队、群聊、长期记忆、原生消息与输入、文件交付和侧栏视图。独立安装使用 DSH 原生面板；在 Seal Harness 中显示为 Bot / Seal Bot。

源码仓库：[asun-labs/dsh-chatchat](https://github.com/asun-labs/dsh-chatchat)。本次仅公开源码，不发布 npm 包或独立桌面安装器。

## 开发与构建

需要 Node.js `^22.19.0 || >=24.0.0`。在本仓库执行：

```sh
npm ci
npm run build
npm run test:package
npm pack --dry-run
```

`npm ci` 根据 `package-lock.json` 安装开发依赖并通过 `prepare` 构建。`npm run build` 使用固定的 esbuild 0.25.12，生成 Client Loader 格式的 `lib/client.js`、source map 和 `office.js`。React、React DOM 与 DSH Client UI primitives 由宿主提供；`deep-view`、二维码和纯工作区地址工具打入 Client，不引入第二份 React。构建和打包脚本只读本仓库与已安装的本地依赖，不下载最新源码。

Git 仓库仅保存源码、资源、锁文件与许可证，忽略 `lib/`、`office.js` 和 `node_modules/`。npm tarball 的 `prepack` 会构建并包含运行所需的产物、源码、资源和第三方声明。`prepare` 与 `prepack` 直接运行同一个 Node 构建脚本，不相互调用，也不要求 pnpm 宿主额外提供 `npm` 可执行程序。

## 在 DSH 安装

在 DSH 的插件管理器中添加本地源码目录，或添加 Git 来源 `github:asun-labs/dsh-chatchat#<commit>`；生产使用应固定经验证的 commit。Git 来源通过 `prepare` 构建，需要包管理器能安装开发构建依赖。部分 DSH/pnpm 版本会报告待批准的 Git 构建脚本；确认来源后在 DSH 中批准该项并重试，不要关闭全局构建脚本保护。对于本地目录，先执行上述安装与构建步骤。

插件当前面向 DSH `0.2.2-rc.3` SDK，Host 服务由所选 Profile 提供。Manifest 中的 SDK 与 React peer dependencies 描述宿主边界；可选 peer 声明避免给宿主安装第二套运行时，不表示缺少必需服务也能使用对应功能。语音、浏览器、MCP 或 Computer Use 仍取决于宿主实际安装并授权的服务。

## Seal 集成与兼容

Seal 通过 Git 子模块固定本仓库的 commit，构建装配同一份源码。日常独立开发在平级仓库进行，Seal 子模块跟随审核后的提交，避免维护两份实现。

Client 默认不要求 Seal 服务。Seal 适配层使用 `dsh-chatchat/client-source` 的 `apply(ctx, integration)` 包装入口，提供导航注册、设置入口和返回办公行为的回调对象。Host 适配层调用 `createRuntime`，显式设置集成模式、身份服务和兼容数据目录。Seal 统一登录的缺失或账号 epoch 变化必须拒绝请求；独立模式无需 Seal 登录服务。

Seal 专属的工作区隔离、右栏会话绑定与轨迹扩展由其 SDK 适配补丁测试负责，不由独立插件修改 DSH 内核。

包名由 `seal-dot` / `@seal-harness/seal-dot` 改为 `dsh-chatchat`。Seal 仍使用 `DSH_HOME/seal-dot` 与已有 `seal-dot:` 浏览器存储键、协议和面板标识，保留 Bot、群聊和会话历史。独立安装默认使用 `DSH_HOME/dsh-chatchat`；显式 `config.home` 自定义目录继续有效。不会自动导入或覆盖独立 DS-Bot 的存储。

## 测试

```sh
npm test
npm run test:integration
npm run test:package
```

`npm test` 运行继承的兼容测试，历史产品差异与不可用 fixture 的逐项说明保留在 `test/profile-exclusions.json`，不算作已通过。`npm run test:integration` 运行本仓库新增的通用与集成回归；原生 SDK 测试需要对应 DSH 包，浏览器测试需要显式提供可用 Chromium，缺少的环境应单独报告。`npm run test:package` 验证实际构建依赖图、Client Loader、资源与 npm 包内容。

测试默认使用本包开发依赖，也可显式将 `DSH_HARNESS` 设为独立 SDK 安装根（其中应有 `package.json` 与所需 `node_modules`）。继承测试还支持本仓库 `dev/harness` 的单独安装；测试入口不会探测相邻 Seal checkout。SDK 路径只提供代码，不应指向真实用户资料。测试入口将 `DSH_HOME` 重定向到临时目录，测试不调用真实模型或读取用户凭据。

## 来源与许可

基于 Fei2411/DS-Bot 修改，采用 Apache-2.0；参见根 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)、上游 [LICENSE](third-party/ds-bot/LICENSE)、[NOTICE](third-party/ds-bot/NOTICE) 和 [PROVENANCE.md](third-party/ds-bot/PROVENANCE.md)。本地 mascot renderer 来源于 Seal Harness，保留其 MIT [许可证](third-party/seal-harness/LICENSE) 和 [来源说明](third-party/seal-harness/PROVENANCE.md)。头像资源及其许可范围见 [头像来源](assets/avatar-catalog/PROVENANCE.md)。保留的旧标识和来源声明不表示与其他项目共享数据或发布渠道。
