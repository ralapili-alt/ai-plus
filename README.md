# AI +1

一个从 Obsidian 自动同步并发布到 GitHub Pages 的个人知识站。

## 日常使用

1. 使用 Obsidian 打开当前文件夹。
2. 在 `content/` 中创建或修改 Markdown。
3. 两小时同步任务会自动检查并推送更新。

## 本地预览

```bash
npm run build
npm start
```

打开 `http://127.0.0.1:4173`。

只有 `content/` 中的 Markdown 会发布到网站。

## 连接 GitHub

新建 GitHub 仓库后运行：

```bash
scripts/connect-github.sh https://github.com/USER/REPO.git
```

这个脚本会完成三件事：

1. 连接远程仓库并推送 `main` 分支。
2. 触发 GitHub Actions 发布网站。
3. 安装 macOS 每 2 小时自动同步任务。
