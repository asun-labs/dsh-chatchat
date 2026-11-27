# Seal 集成与兼容

[返回首页](../README.md) · [开发与验证](development.md)

## Seal 集成与兼容

独立安装默认使用 DSH 品牌：DSH Bot、DSH Agent 和官方 DSH 鲸鱼标识。Seal Host 与 Client 适配可分别传入 `branding: 'seal'`，显示 Seal Bot、Seal Agent 与海豹标识；旧 Seal Host 的明确身份服务配置仍兼容。Client 也读取 Host roster 返回的品牌。已有默认主 Bot 可更新名称和图标；用户改名或更换头像后，对应字段不再跟随品牌默认值。数据目录、存储键、协议和会话历史不随品牌改变。

Seal 默认安装并启用固定版本的预编译包；产品构建核对安装包摘要并装配运行依赖，不使用 Git 子模块或相邻源码目录编译 ChatChat。后续启用与停用由原生 DSH bundle/Profile 选择管理。

Client 默认不要求 Seal 服务。独立激活时使用原有 ModuleLoader Client；宿主包装则使用 `dsh-chatchat/client-api` 导出的预编译 CommonJS 库，公开 `apply(ctx, integration)` 与 `inject`。该库不注册第二个 Loader 插件，也不要求 core Host 同时激活；Seal 将已编译库作为包依赖链接进自己的 Client 并传入导航、设置与返回办公回调，不读取或重编译 core 源码。Host 适配层调用 `createRuntime`，显式设置集成模式、身份服务和兼容数据目录。Seal 统一登录缺失或账号 epoch 变化必须拒绝请求；独立模式无需 Seal 登录服务。bundle 中稳定的 `seal-harness-seal-dot` 条目由 Seal 适配为本地包装入口，保留既有配置身份。

Seal 专属的工作区隔离、右栏会话绑定与轨迹扩展由其 SDK 适配补丁测试负责，不由独立插件修改 DSH 内核。

包名由 `seal-dot` / `@seal-harness/seal-dot` 改为 `dsh-chatchat`。Seal 仍使用 `DSH_HOME/seal-dot` 与已有 `seal-dot:` 浏览器存储键、协议和面板标识，保留 Bot、群聊和会话历史。独立安装默认使用 `DSH_HOME/dsh-chatchat`；显式 `config.home` 自定义目录继续有效。不会自动导入或覆盖独立 DS-Bot 的存储。
