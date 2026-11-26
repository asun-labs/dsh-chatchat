# DSH ChatChat

DSH 团队智能体与群聊插件。每个 Bot 使用原生 DSH 会话，提供团队、群聊、长期记忆、原生消息与输入、文件交付和侧栏视图。独立安装启用后直接进入完整 ChatChat 界面；点击左上角返回按钮恢复 DSH 原生界面，原生侧栏上方与插件、自动化任务并列的 ChatChat 入口可再次进入。每次启动默认进入 ChatChat。Seal Harness 的显式宿主接入保持 Bot / Seal Bot 导航。

源码仓库：[asun-labs/dsh-chatchat](https://github.com/asun-labs/dsh-chatchat)。独立预编译插件包位于本仓库的 [GitHub Releases](https://github.com/asun-labs/dsh-chatchat/releases)，不发布独立桌面安装器，也不要求 npm registry 包名已被发布。

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

## 在 DSH 安装

在 DSH 的插件管理器中添加版本化预编译包地址，例如：

```text
https://github.com/asun-labs/dsh-chatchat/releases/download/v0.1.14/dsh-chatchat-0.1.14.tgz
```

也可以先下载并核对同版本的 `.sha256`，再选择本地 `.tgz` 文件安装。包声明原生 `dsh.bundle`，安装后的启用、停用和卸载由 DSH 现有插件管理器处理，不提供第二套插件管理。没有 HMR 的 Profile 在切换启用状态后按原生提示重启；停用不会删除 Bot 数据。当前 DSH 对 tarball 来源不提供原生自动查新或一键升级：更换版本时先通过插件管理器停用并移除旧包，再安装明确的新版本 URL；按原生提示停止 Profile 或重启，保留的数据目录会继续使用。

本地源码目录和 Git 来源仍可用于插件开发，但源码安装会通过 `prepare` 构建；普通用户与 Seal 产品装配使用预编译发布包。

插件当前面向 DSH `0.2.2-rc.3` SDK，Host 服务由所选 Profile 提供。Manifest 中的 SDK 与 React peer dependencies 描述宿主边界；可选 peer 声明避免给宿主安装第二套运行时，不表示缺少必需服务也能使用对应功能。语音、浏览器、MCP 或 Computer Use 仍取决于宿主实际安装并授权的服务。

## Seal 集成与兼容

独立安装默认使用 DSH 品牌：DSH Bot、DSH Agent 和官方 DSH 鲸鱼标识。Seal Host 与 Client 适配可分别传入 `branding: 'seal'`，显示 Seal Bot、Seal Agent 与海豹标识；旧 Seal Host 的明确身份服务配置仍兼容。Client 也读取 Host roster 返回的品牌。已有默认主 Bot 可更新名称和图标；用户改名或更换头像后，对应字段不再跟随品牌默认值。数据目录、存储键、协议和会话历史不随品牌改变。

Seal 默认安装并启用固定版本的预编译包；产品构建核对安装包摘要并装配运行依赖，不使用 Git 子模块或相邻源码目录编译 ChatChat。后续启用与停用由原生 DSH bundle/Profile 选择管理。

Client 默认不要求 Seal 服务。独立激活时使用原有 ModuleLoader Client；宿主包装则使用 `dsh-chatchat/client-api` 导出的预编译 CommonJS 库，公开 `apply(ctx, integration)` 与 `inject`。该库不注册第二个 Loader 插件，也不要求 core Host 同时激活；Seal 将已编译库作为包依赖链接进自己的 Client 并传入导航、设置与返回办公回调，不读取或重编译 core 源码。Host 适配层调用 `createRuntime`，显式设置集成模式、身份服务和兼容数据目录。Seal 统一登录缺失或账号 epoch 变化必须拒绝请求；独立模式无需 Seal 登录服务。bundle 中稳定的 `seal-harness-seal-dot` 条目由 Seal 适配为本地包装入口，保留既有配置身份。

Seal 专属的工作区隔离、右栏会话绑定与轨迹扩展由其 SDK 适配补丁测试负责，不由独立插件修改 DSH 内核。

包名由 `seal-dot` / `@seal-harness/seal-dot` 改为 `dsh-chatchat`。Seal 仍使用 `DSH_HOME/seal-dot` 与已有 `seal-dot:` 浏览器存储键、协议和面板标识，保留 Bot、群聊和会话历史。独立安装默认使用 `DSH_HOME/dsh-chatchat`；显式 `config.home` 自定义目录继续有效。不会自动导入或覆盖独立 DS-Bot 的存储。

## 测试

普通新建 Bot 可填写长期职责，创建后在 Bot 设置中修改。Seal 宿主提供专家模板服务时，加号菜单显示“新建 Bot－选择从模板中创建”：从系统或个人专家选择模板，再填写名称，配置复制后独立维护，不跟随原专家更新。独立安装不显示宿主未提供的模板入口。

Bot 右侧详情集中展示角色与动态，模型、权限及工作文件夹等集中在设置；顶部使用常驻搜索框，新建分组统一从加号菜单进入。

```sh
npm test
npm run test:integration
npm run test:package
```

`npm test` 运行继承的兼容测试，历史产品差异与不可用 fixture 的逐项说明保留在 `test/profile-exclusions.json`，不算作已通过。`npm run test:integration` 运行本仓库新增的通用与集成回归；原生 SDK 测试需要对应 DSH 包，浏览器测试需要显式提供可用 Chromium，缺少的环境应单独报告。`npm run test:package` 验证实际构建依赖图、Client Loader、资源与 npm 包内容；`tests/release-package.test.mjs` 对真实发布 tarball 使用原生 DSH bundle/Profile 与插件管理器验证识别、启用、停用和重载，不访问真实用户目录或模型。

测试默认使用本包开发依赖，也可显式将 `DSH_HARNESS` 设为独立 SDK 安装根（其中应有 `package.json` 与所需 `node_modules`）。继承测试还支持本仓库 `dev/harness` 的单独安装；测试入口不会探测相邻 Seal checkout。SDK 路径只提供代码，不应指向真实用户资料。测试入口将 `DSH_HOME` 重定向到临时目录，测试不调用真实模型或读取用户凭据。

## 来源与许可

基于 Fei2411/DS-Bot 修改，采用 Apache-2.0；参见根 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)、上游 [LICENSE](third-party/ds-bot/LICENSE)、[NOTICE](third-party/ds-bot/NOTICE) 和 [PROVENANCE.md](third-party/ds-bot/PROVENANCE.md)。本地 mascot renderer 来源于 Seal Harness，保留其 MIT [许可证](third-party/seal-harness/LICENSE) 和 [来源说明](third-party/seal-harness/PROVENANCE.md)。头像资源及其许可范围见 [头像来源](assets/avatar-catalog/PROVENANCE.md)。保留的旧标识和来源声明不表示与其他项目共享数据或发布渠道。
