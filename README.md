# 中受カード PWA

家庭学習向けの中学受験カードPWAです。GitHub Pages に置いて、CSV を読み込んで使う前提のシンプルな構成です。

## ファイル

- `index.html`: 画面構成
- `style.css`: 見た目
- `app.js`: CSV/JSON 読み込み、IndexedDB 保存、学習ロジック
- `sw.js`: Service Worker のキャッシュ
- `manifest.webmanifest`: PWA 設定
- `sample.csv`: サンプルCSV

## CSV列

```csv
subject,unit,type,question,answer,explanation,difficulty,source,check,questionImage,answerImage
```

## 学習ルール

- `○ わかった`: 7日後に再出題、3回連続で `graduated`
- `△ もう一回`: 3日後に再出題
- `× わからない`: 翌日に再出題

## v0.1.1 メモ

- 学習カードのボタンイベントを見直し、`答えを見る` と `次のカード` が確実に反応するよう修正
- `答えを見る` 前は `○△×` を無効化し、表示後に有効化
- 学習操作の状態を保存ステータスに表示
- Service Worker のキャッシュ名を `chuju-card-v0.1.1` に更新

## v0.2 メモ

- 学習カードを中央の主役にし、問題文と学習ボタンを iPad で押しやすい大きさに調整
- `subject / unit / difficulty / source` をカード内で小さく整理して表示
- CSV/JSON 操作を `データ管理` の折りたたみに移し、初期表示を閉じた状態に変更
- Service Worker のキャッシュ名を `chuju-card-v0.2` に更新
