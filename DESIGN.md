# Design

World: a pocket Anh–Việt dictionary. Ivory bible paper, two-colour print (ink + oxblood), every word laid out as a dictionary entry. Today's routine is the book's thumb index.

## Color (tokens in `src/index.css`)

| Token | Light | Dark | Job |
|---|---|---|---|
| `--paper` | `#f4efe4` | `#1a1815` | ground |
| `--paper-2` | `#ebe4d5` | `#26231e` | tab board, hover, pressed |
| `--rule` | `#d9d0bf` | `#3a352d` | hairlines, input borders |
| `--ink` | `#1c1a17` | `#ece4d4` | text, primary buttons |
| `--ink-2` / `--ink-3` | `#4a453d` / `#6b6255` | `#c9bfad` / `#a39886` | secondary / tertiary text |
| `--red` | `#9b2226` | `#e0736a` | second ink: sense numbers, POS, labels, current tab, focus, selection |
| `--ok` / `--bad` / `--amber` | green / oxblood / ochre | lighter variants | answer states and grade labels only |

Dark mode follows `prefers-color-scheme` ("the same book under a lamp"). No other hues.

## Type

- Source Serif 4 (self-hosted, variable): English: headwords, examples, collocations, headings, numbers.
- Be Vietnam Pro 400–700: Vietnamese UI and meanings.
- Headword 44px (38px phone), tracking −0.02em. Small caps-style labels: 11px uppercase, 0.08em tracking, oxblood.

## Entry anatomy

Headword + speak button → IPA + italic POS abbreviation (`n.`, `v.`) → numbered sense (`1` in oxblood) → English definition (serif) → other meanings → dotted rule → italic example (tap to hear) + Vietnamese translation → `Cụm hay gặp` with the headword as `~` → `Họ từ`.

## Signature: thumb-index rail

Fixed at the content column's right edge on routine screens (Ôn tập, Học mới, Luyện viết, Đọc). Vertical tabs; the current step extends and turns oxblood; finished steps are struck through in oxblood with a check.

## Layout and components

- Max width 720px. Sticky top bar (wordmark, desktop tabs, avatar). Phones: bottom nav (Hôm nay, Ôn tập, Từ vựng, Cài đặt) and a fixed action bar above it.
- Buttons: 1.5px ink outline; primary = solid ink. Radius 10–12px. No shadows except the floating gloss.
- Lists are ruled rows, not cards. Progress = 3px rule with a tabular count.
- Icons: lucide-react, one stroke weight. No emoji.
- Motion: 0.15–0.4s exponential ease-out on width/background only; disabled under reduced motion.
