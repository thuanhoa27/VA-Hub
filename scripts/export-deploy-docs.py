"""
export-deploy-docs.py — sinh DEPLOY_Huong_dan_trien_khai.docx va .pdf tu DEPLOY.md

Chay:  python scripts/export-deploy-docs.py
Can:   pandoc  +  xelatex  (khong co tren may Windows mac dinh — xem muc CACH CHAY)

VI SAO CAN SCRIPT NAY CHU KHONG CONVERT TAY
-------------------------------------------
2 ban .docx/.pdf se CU DAN so voi DEPLOY.md. Co script thi sinh lai la 1 lenh,
khong ai phai nho lai 6 tham so cua pandoc. Va 3 phep xu ly duoi day deu la thu
da phai sua sau khi nhin ban render that:

1. THAY EMOJI BANG CHU. Sandbox/may khong co font emoji -> ✅❌⚠️ thanh o vuong
   den trong PDF. Doi thanh [OK] / [X] / [!].

2. GAN DO RONG TY LE CHO BANG. Pandoc suy do rong cot tu SO GACH NGANG o dong
   separator. Viet |---|---| = "khong xac dinh" -> LaTeX dung tabular co dinh va
   chu dai TRAN sang cot ben canh (da thay: "0003_pipeline.sq3 bang Pipeline").
   Script tinh ty le tu do dai noi dung that -> LaTeX dung p{...} va tu wrap.

3. FONT. mainfont=DejaVu Sans, monofont=Liberation Mono.
   - DejaVu Sans Mono THIEU chu Viet co dau (U+1EAF ắ, U+1EE7 ủ...) -> mat chu
     trong khoi code co comment tieng Viet.
   - Liberation Mono co ca chu Viet VA ky tu ke khung (U+2500) cua so do kien truc.
   Doi font khac thi kiem lai ca 2 dieu kien nay.

LUU Y: PDF sinh bang xelatex, KHONG bang LibreOffice. LibreOffice convert docx ->
pdf lam MAT cot thu 2 cua nhung bang khong khai do rong (da thay: bang dem so
dong chi con ten bang, mat het con so).
"""
import io
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'DEPLOY.md'
BUILD = ROOT / '.tmp' / 'docs'
OUT_DOCX = ROOT / 'DEPLOY_Huong_dan_trien_khai.docx'
OUT_PDF = ROOT / 'DEPLOY_Huong_dan_trien_khai.pdf'

EMOJI = {
    '✅ ': '[OK] ', '❌ ': '[X] ', '⚠️ ': '[!] ', '⚠️': '[!]',
    '✅': '[OK]', '❌': '[X]', '🎉': '(xong)', '✱': '*', '✓': 'v', '✗': 'x',
}

META = """---
title: "Hướng dẫn deploy BrandHunt Web App — v2"
subtitle: "Kèm tab Pipeline (VA Distribution Performance) · OnPoint Ecommerce"
date: "29/07/2026"
lang: vi
---

"""

DASH_TOTAL = 78  # tong so gach ngang tren 1 dong separator


def cells(line):
    return [c.strip() for c in line.strip().strip('|').split('|')]


def is_sep(line):
    return bool(re.fullmatch(r'\|(\s*:?-{2,}:?\s*\|)+', line.strip()))


def longest_word(s):
    """Tu dai nhat = phan KHONG ngat dong duoc. Cot hep hon tu nay se bi tran chu."""
    return max((len(w) for w in re.split(r'[\s/]+', s) if w), default=1)


def set_table_widths(text):
    """Ghi lai dong separator cua moi bang theo ty le do dai noi dung that.

    Chi lay ty le la CHUA DU: bang '14 bang chia 2 nhom' co 1 cot dai kinh khung
    (11 ten bang) lam cac cot con lai tut xuong ~4% -> chu 'BrandHunt' khong ngat
    dong duoc nen tran de len cot ben canh ('Brandmarket_kpi'). Nen moi cot con co
    san nho nhat = tu dai nhat trong cot do.
    """
    src = text.split('\n')
    out, i, fixed = [], 0, 0
    while i < len(src):
        line = src[i]
        if line.strip().startswith('|') and i + 1 < len(src) and is_sep(src[i + 1]):
            block = [line]
            j = i + 1
            while j < len(src) and src[j].strip().startswith('|'):
                block.append(src[j])
                j += 1
            ncol = len(cells(block[0]))
            widths = [len(c) for c in cells(block[0])]
            floors = [longest_word(c) for c in cells(block[0])]
            for row in block[2:]:
                rc = cells(row)
                for k in range(min(ncol, len(rc))):
                    widths[k] = max(widths[k], len(rc[k]))
                    floors[k] = max(floors[k], longest_word(rc[k]))
            total = sum(widths) or ncol
            # san nho nhat: tu dai nhat + 1, nhung khong de 1 cot chiem qua 28
            floors = [min(f + 1, 28) for f in floors]
            dash = [max(round(w / total * DASH_TOTAL), f) for w, f in zip(widths, floors)]
            # neu vuot tong, cat bot o nhung cot dang rong hon san cua no
            over = sum(dash) - DASH_TOTAL
            while over > 0:
                slack = [(d - f, k) for k, (d, f) in enumerate(zip(dash, floors)) if d > f]
                if not slack:
                    break
                _, k = max(slack)
                dash[k] -= 1
                over -= 1
            block[1] = '|' + '|'.join('-' * d for d in dash) + '|'
            out.extend(block)
            fixed += 1
            i = j
            continue
        out.append(line)
        i += 1
    print(f'  bang da gan do rong ty le: {fixed}')
    return '\n'.join(out)


def check_long_code_lines(text):
    """Dong code > 84 ky tu se tran ra ngoai le trong PDF (verbatim khong wrap)."""
    inb, bad = False, []
    for n, line in enumerate(text.split('\n'), 1):
        if line.startswith('```'):
            inb = not inb
            continue
        if inb and len(line) > 84:
            bad.append((n, len(line)))
    if bad:
        print('  [!] dong code qua dai, se tran le trong PDF — nen ngat dong trong DEPLOY.md:')
        for n, ln in bad:
            print(f'      DEPLOY.md:{n}  ({ln} ky tu)')
    return not bad


def need(tool):
    if shutil.which(tool) is None:
        sys.exit(f'[export-docs] thieu `{tool}`. Xem muc CACH CHAY o dau file.')


def main():
    need('pandoc')
    need('xelatex')
    BUILD.mkdir(parents=True, exist_ok=True)

    text = io.open(SRC, encoding='utf-8').read()
    check_long_code_lines(text)

    for k, v in EMOJI.items():
        text = text.replace(k, v)
    text = text.replace('- [ ] ', '- ( ) ')           # checkbox -> khong thanh list la trong Word
    text = META + text.split('\n', 1)[1].lstrip('\n')  # bo H1, thay bang metadata block
    text = set_table_widths(text)

    doc = BUILD / 'doc.md'
    io.open(doc, 'w', encoding='utf-8', newline='\n').write(text)

    common = ['--toc', '--toc-depth=2']
    subprocess.run(['pandoc', str(doc), '-o', str(OUT_DOCX), '--standalone', *common], check=True)
    subprocess.run([
        'pandoc', str(doc), '-o', str(OUT_PDF), '--pdf-engine=xelatex', *common,
        '-V', 'geometry:margin=2cm',
        '-V', 'mainfont=DejaVu Sans',
        '-V', 'monofont=Liberation Mono',
        '-V', 'fontsize=10pt',
        '-V', 'colorlinks=true',
        '-V', 'linkcolor=RoyalBlue',
        '-V', 'urlcolor=RoyalBlue',
    ], check=True)

    for f in (OUT_DOCX, OUT_PDF):
        print(f'  OK  {f.relative_to(ROOT)}  ({f.stat().st_size // 1024} KB)')
    print('\nKiem lai bang mat truoc khi gui: mo PDF, xem bang co bi tran cot khong.')


if __name__ == '__main__':
    main()
