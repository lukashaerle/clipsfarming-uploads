"""Build the self-contained listening page for the voice test.

    python -I build_page.py spec.json out.html

spec.json:
  title, lead, pending (optional notice), roles {key: name},
  dialogs: [{title, note?, cast: [[role_key, voice_text]], audio: mp3 path, timeline: json path}]
  groups:  [{title, note?, items: [{label, sub?, file: wav or mp3 path, bad?: true}]}]
  notes:   [html strings]
All audio is embedded as base64, so the page works as a single file.
"""
import base64
import html
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import vtlib  # noqa: E402

CSS = """
:root{--bg:#f5f2ea;--card:#fffdf8;--ink:#1f1b16;--muted:#6f675b;--line:#e3dccf;--soft:#efe9dc;
--H:#e06a1b;--P:#2b6bd6;--O:#8a48c9;--bad:#b8431f;--on:#fff3d6}
@media (prefers-color-scheme:dark){:root{--bg:#16140f;--card:#211e17;--ink:#f3eee4;--muted:#a69d8e;--line:#39342a;--soft:#2a261d;--on:#3b3320}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{max-width:800px;margin:0 auto;padding:28px 16px 64px}
h1{font-size:30px;line-height:1.15;margin:0 0 8px;letter-spacing:-.02em}
h2{font-size:20px;margin:36px 0 6px;letter-spacing:-.01em}
p{margin:0 0 10px}
.lead{color:var(--muted);font-size:17px;max-width:62ch}
.pending{margin:16px 0 0;padding:12px 14px;border:1px dashed var(--bad);border-radius:12px;color:var(--bad);background:transparent}
.note{color:var(--muted);font-size:14.5px;max-width:68ch}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin:14px 0}
.card h3{margin:0 0 8px;font-size:17px}
audio{width:100%;height:40px;margin:6px 0 2px}
.cast{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
.chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:3px 10px 3px 8px;font-size:13px;background:var(--soft)}
.dot{width:9px;height:9px;border-radius:50%;flex:none}
.k-H .dot,.k-H .who{--c:var(--H)}.k-P .dot,.k-P .who{--c:var(--P)}.k-O .dot,.k-O .who{--c:var(--O)}
.dot{background:var(--c)}
.lines{list-style:none;margin:10px 0 0;padding:0}
.line{display:grid;grid-template-columns:132px 1fr;gap:10px;padding:6px 8px;border-radius:9px;cursor:pointer;align-items:baseline}
.line:hover{background:var(--soft)}
.line.on{background:var(--on)}
.who{color:var(--c);font-weight:650;font-size:13.5px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:10px;margin-top:10px}
.item{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:11px 12px 8px}
.item b{display:block;font-size:15px}
.item span{display:block;color:var(--muted);font-size:13px;min-height:19px}
.item.bad{border-color:var(--bad)}
.item.bad b{color:var(--bad)}
ul.notes{padding-left:20px;margin:8px 0 0}
ul.notes li{margin:0 0 7px;max-width:70ch}
@media (max-width:520px){.line{grid-template-columns:1fr;gap:0}}
"""

JS = """
document.querySelectorAll('.dialog').forEach(function(d){
  var a=d.querySelector('audio'), lines=[].slice.call(d.querySelectorAll('.line'));
  function upd(){var t=a.currentTime, live=!a.paused&&!a.ended;
    lines.forEach(function(l){l.classList.toggle('on', live && t>=+l.dataset.s-0.06 && t<+l.dataset.e+0.14);});}
  function loop(){upd(); if(!a.paused&&!a.ended) requestAnimationFrame(loop);}
  a.addEventListener('play',loop); a.addEventListener('pause',upd); a.addEventListener('ended',upd);
  lines.forEach(function(l){l.addEventListener('click',function(){a.currentTime=+l.dataset.s; a.play();});});
});
document.addEventListener('play',function(e){
  [].forEach.call(document.querySelectorAll('audio'),function(x){if(x!==e.target) x.pause();});
},true);
"""


def b64(path):
    with open(path, "rb") as fh:
        return base64.b64encode(fh.read()).decode("ascii")


def sample_mp3_b64(path, tmpdir):
    if path.lower().endswith(".mp3"):
        return b64(path)
    x = vtlib.fade_edges(vtlib.normalize(vtlib.trim(vtlib.load_audio(path))))
    tmp = os.path.join(tmpdir, "s.mp3")
    vtlib.save_mp3(tmp, x, bitrate=96000)
    return b64(tmp)


def main():
    spec_path, out_path = sys.argv[1:3]
    with open(spec_path, encoding="utf-8") as fh:
        spec = json.load(fh)
    e = html.escape
    roles = spec["roles"]
    out = []
    out.append('<!doctype html><html lang="de"><head><meta charset="utf-8">')
    out.append('<meta name="viewport" content="width=device-width, initial-scale=1">')
    out.append("<title>%s</title><style>%s</style></head><body><main>" % (e(spec["title"]), CSS))
    out.append("<h1>%s</h1><p class='lead'>%s</p>" % (e(spec["title"]), e(spec["lead"])))
    if spec.get("pending"):
        out.append("<p class='pending'>%s</p>" % e(spec["pending"]))
    with tempfile.TemporaryDirectory() as tmpdir:
        if spec.get("dialogs"):
            out.append("<h2>%s</h2>" % e(spec.get("dialogs_title", "Der Dialog")))
            if spec.get("dialogs_note"):
                out.append("<p class='note'>%s</p>" % e(spec["dialogs_note"]))
        for d in spec.get("dialogs", []):
            with open(d["timeline"], encoding="utf-8") as fh:
                tl = json.load(fh)
            out.append("<section class='card dialog'><h3>%s</h3>" % e(d["title"]))
            if d.get("note"):
                out.append("<p class='note'>%s</p>" % e(d["note"]))
            out.append("<div class='cast'>")
            for key, voice in d["cast"]:
                out.append("<span class='chip k-%s'><i class='dot'></i>%s: %s</span>" % (e(key), e(roles[key]), e(voice)))
            out.append("</div>")
            out.append("<audio controls preload='auto' src='data:audio/mpeg;base64,%s'></audio>" % b64(d["audio"]))
            out.append("<ol class='lines'>")
            for ln in tl["lines"]:
                out.append("<li class='line k-%s' data-s='%s' data-e='%s'><span class='who'>%s</span><span>%s</span></li>"
                           % (e(ln["who"]), ln["start"], ln["end"], e(roles[ln["who"]]), e(ln["text"])))
            out.append("</ol></section>")
        for g in spec.get("groups", []):
            out.append("<h2>%s</h2>" % e(g["title"]))
            if g.get("note"):
                out.append("<p class='note'>%s</p>" % e(g["note"]))
            out.append("<div class='grid'>")
            for it in g["items"]:
                out.append("<div class='item%s'><b>%s</b><span>%s</span>" % (" bad" if it.get("bad") else "", e(it["label"]), e(it.get("sub", ""))))
                out.append("<audio controls preload='metadata' src='data:audio/mpeg;base64,%s'></audio></div>" % sample_mp3_b64(it["file"], tmpdir))
            out.append("</div>")
    if spec.get("notes"):
        out.append("<h2>%s</h2><ul class='notes'>" % e(spec.get("notes_title", "Was der Test gezeigt hat")))
        for n in spec["notes"]:
            out.append("<li>%s</li>" % n)
        out.append("</ul>")
    out.append("</main><script>%s</script></body></html>" % JS)
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out))
    print(out_path, round(os.path.getsize(out_path) / 1e6, 2), "MB")


if __name__ == "__main__":
    main()
