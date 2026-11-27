# README 展示素材

`../media/hero.svg` 与英文版 `../media/hero.en.svg` 是本仓库原创的矢量横幅，使用系统字体，不依赖远程资源。

`../media/team.jpg` 与 `../media/create-bot.jpg` 是产品文档展示图：使用现有 `TeamSidebar`、`DetailsDrawer` 与 `CreateBot` 组件，配虚构的角色和群聊数据。它们不是真实模型运行或端到端验证的证据。第三方头像沿用 [资源来源声明](../../assets/avatar-catalog/PROVENANCE.md)。未接入 DSH Host 的消息渲染等 primitives 在预览中不可用，若场景意外使用会抛错，不提供模拟的原生聊天界面。

更新界面后，在仓库根目录运行：

```sh
node docs/readme/preview.mjs
```

打开终端输出的本机地址，画布尺寸为 **1200 × 1194**，用完整页面截图保留全部内容：

- `/?scene=team`：团队侧栏与角色详情。
- `/?scene=create`：新建 Bot 表单。
- `/?scene=team&lang=en` 与 `/?scene=create&lang=en`：对应的英文组件、演示数据与说明，保存为 `team.en.jpg` 与 `create-bot.en.jpg`。

从浏览器保存对应 JPEG，更新 `docs/media/` 内的展示图。预览仅绑定回环地址，所有数据驻留内存，不加载真实用户目录，不调用模型，不保存配置。结束后停止预览进程。服务也可用于检查本仓库 Markdown 渲染后的临时 HTML；临时页面不得提交。
