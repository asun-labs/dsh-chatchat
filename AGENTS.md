# DSH ChatChat

- 独立 DSH 插件源码。先运行 `git status --short`，保护已有修改。
- 所有生产导入必须在包内或声明的依赖中；不得依赖相邻 Seal checkout 的源码、工具链或 node_modules。
- Seal 专属导航和认证由宿主适配提供；集成模式身份缺失时必须拒绝请求，不可静默退回无认证模式。
- 保留 Bot/群聊原生会话、输入与文件交付实现，不以简化列表替代。
- 保留旧 Seal 数据目录、浏览器存储键与协议标识的兼容，测试不得读写真实用户数据。
- 保留 LICENSE、NOTICE、第三方来源与头像 provenance。不得提交 node_modules、lib、覆盖率、测试产物或凭据。
- 同区域回归覆盖行为边界，构建、测试、打包内容检查应可在独立目录执行；DSH 运行测试允许通过显式 DSH_HARNESS 指定 SDK 安装根。
- 提交、推送、公开和发布仅按用户已有明确授权执行；本任务授权 GitHub 独立源码仓库，不包含 npm / Release 发布。
