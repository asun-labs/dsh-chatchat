# 宿主加载与兼容

[返回首页](../README.md) · [开发与验证](development.md)

## 独立插件

DSH ChatChat 独立维护、构建和发布。默认通过 DSH 原生插件管理器安装、启停和卸载，其他产品也可以加载同一个预编译插件包。包名和发布身份固定为 DSH ChatChat。

## 宿主适配

普通安装使用 ModuleLoader Client。需要嵌入自有界面的宿主可使用 `dsh-chatchat/client-api` 导出的预编译 CommonJS 库，公开入口为 `apply(ctx, integration)` 与 `inject`。该入口不注册第二个 Loader 插件，也不要求 core Host 同时激活；宿主提供导航、设置、返回等回调，不读取或重新编译插件源码。

Host 通过 `createRuntime` 接入。需要统一认证的宿主应显式提供集成模式与身份服务；身份缺失或账号 epoch 变化时拒绝请求。独立安装无需其他产品的认证服务。专家模板等可选能力由宿主提供，没有服务时不显示对应入口。

Seal 在 `createRuntime(ctx, config)` 和 Client 的 `apply(ctx, integration)` 中显式传入 `branding: 'seal'`，为默认主 Bot 和 Agent 入口启用 Seal 的名称及图标。未指定时使用 DSH。Host 的会话列表快照也会携带品牌，供 Client 同步。

宿主负责自己的工作区隔离、右栏会话绑定和 SDK 扩展；插件保持原生 DSH 会话与输入机制。Seal 等产品可以作为加载方，而不是插件的品牌或发布主体。

## 既有安装兼容

默认数据目录为 `DSH_HOME/dsh-chatchat`；显式 `config.home` 继续有效。旧宿主可以继续传入自己的兼容目录。已有 Bot、群聊、记忆、会话和用户自定义名称、头像不因宿主加载而丢失。

历史 `seal-dot` 数据目录、浏览器存储键、协议及 `seal-harness-seal-dot` bundle 标识保留为兼容接口。已有主 Bot 的默认名称与头像、默认团队工作区标题会在启动时跟随宿主品牌更新。用户自定义的名称与头像保留原值。

不自动导入或覆盖独立 DS-Bot 的存储。
