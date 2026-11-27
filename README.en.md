# DSH ChatChat

English · [简体中文](README.md)

Team agents and group chat for DeepSeek Harness (DSH) and Seal Harness. Each bot runs in a native DSH session with its own responsibilities, conversation, and long-term memory. Teams can work in group chats, exchange files, and inspect activity in the sidebar.

## Install in DSH

1. Open [GitHub Releases](https://github.com/asun-labs/dsh-chatchat/releases) and choose a versioned `dsh-chatchat-*.tgz` package.
2. In the DSH plugin manager, add the release asset URL or install the downloaded file. The release includes checksums.
3. Enable ChatChat. The standalone plugin opens the ChatChat interface. Use the back button to return to DSH and the sidebar entry to reopen ChatChat.

ChatChat targets the DSH `0.2.2-rc.3` SDK. Browser, voice, MCP, and computer use features depend on the services installed and authorized in the host. To upgrade a tarball installation, disable and remove the old package, add the new version, and follow the host's restart prompt. Bot data is retained.

## Create a team

Create a bot and give it a standing responsibility. You can later update its role, model, permissions, and workspace in its settings. Add bots to groups for shared conversations, and use the details pane to see their roles and activity. Seal hosts that provide expert templates can also create bots from those templates.

Seal Harness embeds a pinned prebuilt package and uses its own branding and navigation. Existing Seal Bot data and session history remain compatible. Integration details are in the [Chinese README](README.md).

## Develop and package

Use Node.js `^22.19.0 || >=24.0.0`. Official release builds use npm `11.21.3`.

```sh
npm ci
npm run build
npm run test:integration
npm run test:package
npm run pack:release
```

The release command creates a prebuilt tarball and SHA-256 and SHA-512 checksums. The package uses the host's React runtime. Integration tests use temporary data and can take an explicit SDK root through `DSH_HARNESS`.

## License

Based on Fei2411's DS-Bot and distributed under [Apache-2.0](LICENSE). See [NOTICE](NOTICE), the [DS-Bot provenance](third-party/ds-bot/PROVENANCE.md), and the [avatar provenance](assets/avatar-catalog/PROVENANCE.md).
