# 中受カード PWA v0.1

家庭内利用向けの中学受験用一問一答カードPWAです。
iPad Safariで使うことを想定しています。

## 方針

- GitHub Pagesに置くのはアプリ本体のみ
- 教材PDF、教材CSV、本番画像、学習履歴はGitHubに置かない
- CSVと画像はiPad側で手動読み込み
- 外部ライブラリなし
- v0.1では画像表示は未実装。CSV内の `questionImage` / `answerImage` は保存のみ

## ファイル

- `index.html`：画面
- `style.css`：見た目
- `app.js`：アプリ処理、IndexedDB、CSV/JSON入出力
- `manifest.webmanifest`：PWA設定
- `sw.js`：Service Worker。本体ファイルをキャッシュ
- `sample.csv`：動作確認用CSV
- `README.md`：この説明

## CSV列

```csv
subject,unit,type,question,answer,explanation,difficulty,source,check,questionImage,answerImage
```

## 復習ルール

- ○：7日後
- △：3日後
- ×：翌日
- ○3回連続で `status` を `graduated` にする

## GitHub Pagesへの公開

このリポジトリをGitHub Pagesで公開すれば、iPad Safariで開けます。
教材データはアップロードせず、iPad側でCSVを読み込んでください。

## 注意

IndexedDB保存なので、Safariのサイトデータ削除、履歴削除、容量不足などで学習履歴が消える可能性があります。
定期的にJSONバックアップを書き出してください。
