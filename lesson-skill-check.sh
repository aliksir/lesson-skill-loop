#!/bin/bash
# lesson-skill-check.sh — 教訓⇔スキル フィードバックループ
#
# 教訓ファイル（lessons/*.md）のタグパターンを分析し、
# スキル化候補の提案・既存スキルとの差分検出・スキル健全性チェックを行う。
#
# 使い方:
#   bash lesson-skill-check.sh [lessons_dir]           # タグ分析+スキル化候補
#   bash lesson-skill-check.sh --sync [lessons_dir]    # 既存スキルとの差分分析
#   bash lesson-skill-check.sh --health [lessons_dir]  # スキル健全性チェック
#   bash lesson-skill-check.sh --map [lessons_dir]     # スキル⇔教訓トレーサビリティマップ（詳細本文付き）
#   bash lesson-skill-check.sh --all [lessons_dir]     # 全部実行
#
# EvoSkill論文（arxiv:2603.02766）の「失敗→スキル発見→改善」を実装。

set -uo pipefail

# --- 引数解析 ---
MODE="analyze"
LESSONS_DIR=""

for arg in "$@"; do
    case "$arg" in
        --sync)   MODE="sync" ;;
        --health) MODE="health" ;;
        --map)    MODE="map" ;;
        --all)    MODE="all" ;;
        *)        LESSONS_DIR="$arg" ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LESSONS_DIR="${LESSON_SKILL_LESSONS_DIR:-${LESSONS_DIR:-$SCRIPT_DIR/examples/lessons}}"
SKILLS_DIR="${LESSON_SKILL_SKILLS_DIR:-${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}}"

if [ ! -d "$LESSONS_DIR" ]; then
    echo "教訓ディレクトリが見つかりません: $LESSONS_DIR" >&2
    exit 0
fi

# --- 共通関数 ---

# 教訓ファイルからタグを抽出してカウント
get_tags() {
    grep -ohE '\[[a-zA-Z0-9_-]+\]' "$LESSONS_DIR"/*.md 2>/dev/null | sort | uniq -c | sort -rn
}

# 教訓ファイルから特定タグの見出し行を全件抽出
get_lesson_headings_for_tag() {
    local tag="$1"
    grep -hF "### " "$LESSONS_DIR"/*.md 2>/dev/null | grep -F "$tag" || true
}

# 教訓ファイルから特定タグのセクション全文を抽出（見出し+本文）
get_lesson_sections_for_tag() {
    local tag="$1"
    local in_section=0
    local section_num=0

    for f in "$LESSONS_DIR"/*.md; do
        [ ! -f "$f" ] && continue
        while IFS= read -r line; do
            # ### で始まる見出し行
            if echo "$line" | grep -qE '^###\s'; then
                if echo "$line" | grep -qF "$tag"; then
                    in_section=1
                    section_num=$((section_num + 1))
                    echo ""
                    echo "   ${section_num}. $(echo "$line" | sed 's/^### //')"
                else
                    in_section=0
                fi
                continue
            fi
            # ## で始まる上位見出し → セクション終了
            if echo "$line" | grep -qE '^##\s'; then
                in_section=0
                continue
            fi
            # セクション内の本文行を出力
            if [ "$in_section" = "1" ] && [ -n "$line" ]; then
                echo "      ${line}"
            fi
        done < "$f"
    done
}

# スキルのSKILL.mdからチェック項目を抽出（ - [ ] で始まる行）
get_skill_items() {
    local skill_path="$1"
    grep -E '^\s*- \[[ x]\]' "$skill_path" 2>/dev/null | sed 's/^\s*- \[[ x]\] //' || true
}

# --- モード1: タグ分析+スキル化候補（既存機能） ---

do_analyze() {
    local THRESHOLD=3

    echo "📊 教訓タグ分析（閾値: ${THRESHOLD}回以上）"
    echo "================================================"

    local tags
    tags=$(get_tags)

    if [ -z "$tags" ]; then
        echo "  タグなし（教訓ファイルが空）"
        return
    fi

    echo ""
    echo "タグ出現回数:"
    echo "$tags" | while read count tag; do
        printf "  %3d回  %s\n" "$count" "$tag"
    done

    echo ""
    echo "================================================"

    local candidates
    candidates=$(echo "$tags" | awk -v t="$THRESHOLD" '$1 >= t { print $0 }')

    if [ -z "$candidates" ]; then
        echo "✅ スキル化候補なし（全タグが${THRESHOLD}回未満）"
        return
    fi

    echo "🔔 スキル化候補（${THRESHOLD}回以上出現）:"
    echo ""
    echo "$candidates" | while read count tag; do
        local tag_clean
        tag_clean=$(echo "$tag" | tr -d '[]')
        echo "  📌 ${tag} (${count}回)"
        get_lesson_headings_for_tag "${tag}" | head -3 | while read line; do
            echo "     └ ${line}"
        done
        echo ""
    done

    echo "💡 提案: 上記タグに共通するパターンをスキル化すると、同種の問題を予防できる可能性があります。"
    echo "   → /skill-creator で検討してください。"
}

# --- モード2: 既存スキルとの差分分析 ---

do_sync() {
    echo "🔄 スキル⇔教訓 差分分析"
    echo "================================================"

    # *-checklist スキルを探す（教訓ベースのスキル）
    local found_skills=0

    for skill_dir in "$SKILLS_DIR"/*-checklist; do
        [ ! -d "$skill_dir" ] && continue
        local skill_file="$skill_dir/SKILL.md"
        [ ! -f "$skill_file" ] && continue

        found_skills=$((found_skills + 1))
        local skill_name
        skill_name=$(basename "$skill_dir")
        local tag_name
        tag_name=$(echo "$skill_name" | sed 's/-checklist//')

        echo ""
        echo "📋 スキル: ${skill_name}"
        echo "   対応タグ: [${tag_name}]"

        # スキルのチェック項目数
        local skill_items
        skill_items=$(get_skill_items "$skill_file")
        local skill_count
        skill_count=$(echo "$skill_items" | grep -c '.' || echo "0")
        echo "   チェック項目数: ${skill_count}"

        # 教訓の該当エントリ数
        local lesson_headings
        lesson_headings=$(get_lesson_headings_for_tag "[${tag_name}]")
        local lesson_count
        lesson_count=$(echo "$lesson_headings" | grep -c '.' || echo "0")
        echo "   教訓エントリ数: ${lesson_count}"

        # 教訓の各エントリが、スキルに反映されているか簡易チェック
        # 教訓の見出しからキーワードを抽出し、スキルに含まれるか確認
        local unreflected=0
        local unreflected_list=""

        echo "$lesson_headings" | while IFS= read -r heading; do
            [ -z "$heading" ] && continue
            # 見出しから主要キーワードを抽出（### 以降、タグを除去）
            local keywords
            keywords=$(echo "$heading" | sed 's/^###\s*//' | sed 's/`\[[^]]*\]`//g' | sed 's/（.*）//' | tr -s ' ')
            # スキル内にキーワードの一部が含まれるか（2単語以上の一致）
            local words
            words=$(echo "$keywords" | tr ' 　・' '\n' | grep -E '.{2,}' | head -3)
            local matched=0
            for w in $words; do
                if grep -qF "$w" "$skill_file" 2>/dev/null; then
                    matched=1
                    break
                fi
            done
            if [ "$matched" = "0" ] && [ -n "$keywords" ]; then
                echo "   ⚠️ 未反映の可能性: ${heading}"
            fi
        done

        # スキルの最終更新日
        local last_modified
        last_modified=$(date -r "$skill_file" "+%Y-%m-%d" 2>/dev/null || echo "不明")
        echo "   最終更新: ${last_modified}"
        echo "   ---"
    done

    if [ "$found_skills" = "0" ]; then
        echo ""
        echo "  教訓ベースのスキル（*-checklist）が見つかりません。"
        echo "  先に --analyze でスキル化候補を確認してください。"
    fi
}

# --- モード3: スキル健全性チェック ---

do_health() {
    echo "🏥 スキル健全性チェック"
    echo "================================================"

    local total=0
    local healthy=0
    local stale=0
    local orphan=0

    for skill_dir in "$SKILLS_DIR"/*-checklist; do
        [ ! -d "$skill_dir" ] && continue
        local skill_file="$skill_dir/SKILL.md"
        [ ! -f "$skill_file" ] && continue

        total=$((total + 1))
        local skill_name
        skill_name=$(basename "$skill_dir")
        local tag_name
        tag_name=$(echo "$skill_name" | sed 's/-checklist//')

        # 教訓タグの出現回数
        local tag_count
        tag_count=$(grep -ohE "\[${tag_name}\]" "$LESSONS_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')

        # チェック項目数
        local item_count
        item_count=$(get_skill_items "$skill_file" | grep -c '.' || echo "0")

        # 最終更新からの日数
        local last_epoch
        last_epoch=$(date -r "$skill_file" +%s 2>/dev/null || echo "0")
        local now_epoch
        now_epoch=$(date +%s)
        local days_old=$(( (now_epoch - last_epoch) / 86400 ))

        # 判定
        local status="✅"
        local note=""
        if [ "$tag_count" -lt 3 ]; then
            status="⚠️"
            note="教訓が3件未満（${tag_count}件）→ スキル化の根拠が薄い"
            orphan=$((orphan + 1))
        elif [ "$days_old" -gt 30 ]; then
            status="🔄"
            note="30日以上未更新（${days_old}日）→ 最新の教訓が反映されていない可能性"
            stale=$((stale + 1))
        else
            healthy=$((healthy + 1))
        fi

        printf "  %s %-25s  項目:%2d  教訓:%2d  更新:%d日前" "$status" "$skill_name" "$item_count" "$tag_count" "$days_old"
        [ -n "$note" ] && printf "  (%s)" "$note"
        echo ""
    done

    echo ""
    echo "================================================"
    echo "合計: ${total}スキル（✅健全:${healthy} / 🔄要更新:${stale} / ⚠️根拠薄:${orphan}）"

    if [ "$total" = "0" ]; then
        echo "  教訓ベースのスキル（*-checklist）がありません。"
    fi
}

# --- モード4: トレーサビリティマップ ---

do_map() {
    echo "📗 スキル⇔教訓 トレーサビリティマップ"
    echo "================================================"

    local THRESHOLD=3

    # --- スキル化済みの教訓 ---
    local found_skills=0
    local skilled_tags=""

    for skill_dir in "$SKILLS_DIR"/*-checklist; do
        [ ! -d "$skill_dir" ] && continue
        local skill_file="$skill_dir/SKILL.md"
        [ ! -f "$skill_file" ] && continue

        found_skills=$((found_skills + 1))
        local skill_name
        skill_name=$(basename "$skill_dir")
        local tag_name
        tag_name=$(echo "$skill_name" | sed 's/-checklist//')
        skilled_tags="${skilled_tags} ${tag_name}"

        local skill_count
        skill_count=$(get_skill_items "$skill_file" | grep -c '.' || echo "0")

        echo ""
        echo "📋 ${skill_name} (${skill_count}項目)"
        echo "   根拠教訓:"

        get_lesson_sections_for_tag "[${tag_name}]"

        echo ""
    done

    if [ "$found_skills" = "0" ]; then
        echo ""
        echo "  スキル化済みの教訓はありません。"
    fi

    # --- 未スキル化の教訓候補 ---
    echo ""
    echo "================================================"
    echo "🔮 未スキル化の教訓（${THRESHOLD}回以上、候補）:"
    echo ""

    local tags
    tags=$(get_tags)
    local has_candidates=0

    echo "$tags" | while read count tag; do
        [ "$count" -lt "$THRESHOLD" ] && continue
        local tag_clean
        tag_clean=$(echo "$tag" | tr -d '[]')
        # 既にスキル化済みのタグはスキップ
        if echo " $skilled_tags " | grep -qF " ${tag_clean} "; then
            continue
        fi
        has_candidates=1
        echo "  📌 ${tag} (${count}回) → 「${tag_clean}-checklist」として検討？"
        get_lesson_sections_for_tag "${tag}" | head -20
        echo ""
    done

    echo ""
    echo "💬 判断ポイント:"
    echo "   「これは別スキルにしたい」「このスキル名を変えたい」等あれば指示してください。"
    echo "   → /skill-creator で作成できます。"
}

# --- 実行 ---

case "$MODE" in
    analyze) do_analyze ;;
    sync)    do_sync ;;
    health)  do_health ;;
    map)     do_map ;;
    all)
        do_analyze
        echo ""
        echo ""
        do_sync
        echo ""
        echo ""
        do_health
        echo ""
        echo ""
        do_map
        ;;
esac

exit 0
