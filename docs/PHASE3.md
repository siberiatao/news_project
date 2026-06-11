# Phase 3: Bilingual Intelligence Experience

Phase 3 将项目从命令行简报生成器推进为可日常使用的个人新闻情报台。

## Report

每次 `brief` 或 `run` 同时生成 Markdown 和 HTML：

- 中文标题与英文原始标题并列，便于校对和语言学习。
- 中文摘要与 English Summary 分区展示。
- 每条事件包含重要性、来源、关注理由和后续观察点。
- HTML 使用报刊式排版，支持桌面、手机和打印。
- 各栏目展示数量由 `config/interests.json` 的
  `report.maxStoriesPerSection` 控制。

## Enrichment

生成过程先构建事件聚类、按栏目精选，再进行 enrichment，避免对同一事件的多篇
重复报道或未进入日报的长尾事件反复调用模型。配置兼容模型后，模型负责输出结构化 JSON：

- `titleZh`
- `summaryZh`
- `summaryEn`
- `whyItMattersZh`
- `watchPointZh`

模型不可用时采用确定性的本地 fallback，保证日报始终可生成。

## Dashboard

`serve` 提供只读 Dashboard：

- 当前事件和原始文章总量
- 按栏目筛选的事件流
- 标题、摘要、实体的本地搜索
- 最新来源抓取状态与错误信息
- 历史 HTML 简报入口
- `/health` JSON 健康检查

Dashboard 不负责采集；它与定时任务共享 `data/news.db` 和 `data/briefs`。
这样即使 Web 服务重启，也不会影响每日采集流程。

## Next

后续重点：

1. 用户反馈标记与个性化权重学习。
2. 持续事件时间线和“正在发生”状态判断。
3. 更细的实体关系、公司和 ticker 视图。
4. 可插拔交付接口，由 Hermes/openclaw 选择 Lark、邮件或其他通道。
