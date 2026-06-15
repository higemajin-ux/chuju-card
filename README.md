# 中受カード PWA

家庭学習向けの中学受験カードPWAです。GitHub Pages に置いて、CSV を読み込んで使う前提のシンプルな構成です。

## ファイル

- `index.html`: 画面構成
- `style.css`: 見た目
- `app.js`: CSV/JSON 読み込み、IndexedDB 保存、学習ロジック
- `sw.js`: Service Worker のキャッシュ
- `manifest.webmanifest`: PWA 設定
- `sample.csv`: cardId 対応サンプルCSV

## CSV列

```csv
cardId,subject,unit,type,question,answer,explanation,difficulty,source,check,questionImage,answerImage
```

## cardId 仕様

- `cardId` は固定IDです。
- 形式は `教科ID-教材ID-大問番号-小問番号-枝番` です。
- 教科IDは `sya = 社会`, `rika = 理科` を使います。

例:

- `sya-hw12-1-1-1`: 社会 宿題プリント12 大問1(1)の1個目
- `sya-hw12-1-1-2`: 社会 宿題プリント12 大問1(1)の2個目
- `sya-hw12-2-3-1`: 社会 宿題プリント12 大問2(3)の1個目
- `rika-hw05-3-2-1`: 理科 宿題プリント5 大問3(2)の1個目

## CSV 再読み込み時の動作

- CSV読み込み時は `cardId` を主キーとして扱います。
- 同じ `cardId` が既にある場合は、教材内容だけ更新します。
- 学習履歴は保持します。
  対象: 正誤回数、連続正解数、`status`、次回復習日など
- 新しい `cardId` は新規カードとして追加します。
- 今回のCSVに存在しない既存 `cardId` のカードは削除します。
- `cardId` 列がない旧形式CSVは読み込まず、エラーを表示します。

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

## v0.2.1 メモ

- ヘッダーと統計表示を圧縮し、iPad横画面で学習カードと操作ボタンが1画面に収まりやすいよう調整
- ルール説明を折りたたみに移動
- 表示上の「卒業」を「合格」に変更
- Service Worker のキャッシュ名を `chuju-card-v0.2.1` に更新

## v0.3 cardId メモ

- CSV主キーを `cardId` に変更
- 同じ `cardId` の再読み込みでは学習履歴を保持しつつ教材内容だけ更新
- CSVから消えた `cardId` は現在の教材セットに含まれないものとして削除
- 旧形式CSVは `cardId列がありません。新CSV形式で読み込んでください。` と表示して読み込み中止
