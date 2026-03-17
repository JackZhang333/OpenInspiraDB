# InspiraDB V1-A (Core)

这是根据 `PRD.md` 落地的第一版可运行内核实现，目标是先跑通 V1-A 主链路：

- 文件夹/单图导入
- 严格去重 (md5)
- 入库复制与缩略图占位生成
- 分析任务队列（并发 3、超时、自动重试、重启恢复）
- mock AI 生成 caption/tags/embedding
- 中文关键词搜索 + 标签 AND 筛选
- 详情读取
- 编辑描述与标签
- 删除与重新分析

## 快速使用

```bash
npm start -- import-file /path/to/a.jpg
npm start -- import-folder /path/to/folder
npm start -- search 现代 极简 --tags=海报,品牌
npm start -- detail 1
npm start -- update-caption 1 这是一张偏极简风格的品牌海报参考图
npm start -- update-tags 1 海报,极简,品牌
npm start -- reanalyze 1
npm start -- retry 3
npm start -- delete 1
```

数据库与素材默认落在：

- `data/inspiradb.sqlite`
- `data/library/`
- `data/thumbnails/`

## 说明

- 当前是 V1-A：AI 为 mock 服务，缩略图为占位复制。
- 为兼容 PRD 的人工优先规则：
  - 人工描述生效后，AI 重跑不会覆盖该生效描述。
  - 人工标签保存后，生效标签源固定为 `user`。
