#!/usr/bin/env python3
"""Turn the stand-alone TriPath page into the StudyDeck-embedded one (called by update_tripath.py).

Every change is an exact-string replacement whose match count is asserted, so a new TriPath
build that moves things around fails loudly instead of silently half-patching.

usage: tripath_embed.py tripath.html embedded.html
"""
import sys

src, dst = sys.argv[1], sys.argv[2]
h = open(src, encoding='utf-8').read()
n_patches = 0


def sub(old, new, count=1, where=None):
    """Replace `old` with `new`, insisting on exactly `count` matches."""
    global h, n_patches
    got = h.count(old)
    assert got == count, 'expected %d match(es), found %d for: %r' % (count, got, old[:90])
    h = h.replace(old, new)
    n_patches += 1


# ───────────────────────── 1. <head>: host variables + fonts, before first paint ─────────────────────────
HEAD_JS = r'''<script>
/* StudyDeck embedding. TriPath runs inside StudyDeck as a same-origin frame, so it reads StudyDeck's own
   design tokens (colours, font, text size) and follows them live. Opened on its own it falls back to
   its original palette. */
(function(){
  var P=null;
  try{if(window.parent&&window.parent!==window&&window.parent.document.getElementById('tripath-iframe'))P=window.parent;}catch(e){}
  window.__sdP=P;
  if(!P)return;
  var K=['--bg','--bg2','--card','--card2','--card3','--bdr','--bdr2','--bdr3','--t','--t2','--m','--h','--p','--ptext','--on-p','--pl','--pll','--gold','--goldl','--r','--rl','--font','--font-head','--fscale'];
  window.__sdApply=function(){
    try{
      var pd=P.document,pr=pd.documentElement,cs=P.getComputedStyle(pd.body||pr),r=document.documentElement,o={};
      for(var i=0;i<K.length;i++){var v=cs.getPropertyValue(K[i]).trim();if(v){r.style.setProperty(K[i],v);o[K[i]]=v;}}
      o.light=pr.getAttribute('data-theme')==='light';
      r.style.colorScheme=o.light?'light':'dark';
      window.__sdVars=o;
    }catch(e){}
  };
  window.__sdApply();
  /* Same web fonts as StudyDeck (cached already), loaded without blocking the first paint. */
  try{
    var ls=P.document.querySelectorAll('link[href*="fonts.googleapis.com/css"]');
    for(var j=0;j<ls.length;j++){
      var l=document.createElement('link');l.rel='stylesheet';l.href=ls[j].href;l.media='print';
      l.onload=function(){this.media='all'};document.head.appendChild(l);
    }
  }catch(e){}
})();
</script>
'''
sub('<title>TriPath — Combined Revision Planner</title>\n',
    '<title>TriPath — Combined Revision Planner</title>\n' + HEAD_JS)

# the stand-alone page's own Google Fonts link (Space Grotesk / DM Sans) is no longer used
sub('<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Space+Grotesk:wght@500;600;700;800&display=swap" rel="stylesheet"/>\n', '')

# ───────────────────────── 2. head CSS: tokens instead of fixed colours ─────────────────────────
sub("html,body{height:100%;background:#04060a;", "html,body{height:100%;background:var(--bg,#04060a);")
sub("body{font-family:'DM Sans',system-ui,sans-serif;", "body{font-family:var(--font,'DM Sans'),system-ui,sans-serif;")
sub("input[type=range]{accent-color:#5b5fef;", "input[type=range]{accent-color:var(--p,#5b5fef);")
sub("select option{background:#0b1018;color:#eef2f7}", "select option{background:var(--card,#0b1018);color:var(--t,#eef2f7)}")
sub("#sp{position:fixed;inset:0;background:#04060a;", "#sp{position:fixed;inset:0;background:var(--bg,#04060a);")
sub("  background:linear-gradient(145deg,#5b5fef,#7c80f5);\n  display:flex;align-items:center;justify-content:center;font-size:32px;\n  box-shadow:0 0 50px rgba(91,95,239,.45)}",
    "  background:var(--p,#5b5fef);\n  display:flex;align-items:center;justify-content:center;font-size:32px}")
sub(".sp-name{color:#eef2f7;font-size:24px;font-weight:800;letter-spacing:-.5px;\n  font-family:'Space Grotesk',system-ui,sans-serif}",
    ".sp-name{color:var(--t,#eef2f7);font-size:24px;font-weight:650;letter-spacing:-.02em;\n  font-family:var(--font,system-ui),system-ui,sans-serif}")
sub(".sp-tagline{color:#516070;", ".sp-tagline{color:var(--m,#516070);")
sub(".sp-bar{width:150px;height:3px;background:#1a2638;", ".sp-bar{width:150px;height:3px;background:var(--bdr2,#1a2638);")
sub(".sp-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,#5b5fef,#7c80f5);",
    ".sp-fill{height:100%;border-radius:2px;background:var(--p,#5b5fef);")

# StudyDeck-style top bar, bottom bar / side rail, and page width
SD_CSS = r'''
/* ── StudyDeck chrome: same top bar, bottom bar and side rail as the rest of the app ── */
.sd-shell{--sd-rail:0px;--sd-w:560px;min-height:100vh;padding-left:var(--sd-rail);color:var(--t);font-family:var(--font),system-ui,sans-serif}
.sd-top{position:sticky;top:0;z-index:20;height:56px;display:flex;align-items:center;gap:10px;padding:0 12px 0 8px;background:var(--bg);border-bottom:1px solid var(--bdr)}
.sd-back{flex:none;width:38px;height:38px;border:0;border-radius:12px;background:none;color:var(--t);font-size:24px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}
.sd-mid{flex:1;min-width:0}
.sd-title{font-size:calc(var(--fscale,1)*17px);font-weight:650;letter-spacing:-.01em;color:var(--t);line-height:1.2}
.sd-sub{font-size:calc(var(--fscale,1)*12px);font-weight:450;color:var(--m);line-height:1.25}
.sd-days{flex:none;padding:5px 11px;border-radius:999px;border:1px solid var(--bdr2);background:var(--card);font-size:calc(var(--fscale,1)*12px);font-weight:600;white-space:nowrap}
.sd-act{flex:none;width:38px;height:38px;border-radius:12px;border:1px solid var(--bdr2);background:var(--card);color:var(--t);cursor:pointer;display:flex;align-items:center;justify-content:center}
.sd-act svg,.sd-ni svg{width:21px;height:21px}
.sd-body{width:100%;max-width:var(--sd-w);margin:0 auto;padding-bottom:78px;zoom:var(--fscale,1)}
.sd-nav{position:fixed;left:0;right:0;bottom:0;z-index:30;display:flex;height:62px;padding:6px;background:var(--bg);border-top:1px solid var(--bdr)}
.sd-ni{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:0;border-radius:12px;background:none;color:var(--h);font:inherit;font-size:calc(var(--fscale,1)*11px);font-weight:560;cursor:pointer}
.sd-ni .ic{width:52px;height:30px;border-radius:15px;display:flex;align-items:center;justify-content:center}
.sd-ni.on{color:var(--ptext)}
.sd-ni.on .ic{background:var(--pl)}
.sd-back:focus-visible,.sd-act:focus-visible,.sd-ni:focus-visible{outline:2px solid var(--ptext);outline-offset:2px}
@media (min-width:700px){.sd-shell{--sd-w:680px}}
@media (min-width:1024px),(orientation:landscape) and (max-height:520px) and (min-width:560px){
  .sd-shell{--sd-rail:84px;--sd-w:760px}
  .sd-nav{top:0;bottom:0;right:auto;width:var(--sd-rail);height:auto;padding:68px 8px 14px;flex-direction:column;justify-content:flex-start;align-items:stretch;gap:6px;border-top:0;border-right:1px solid var(--bdr);overflow-y:auto;scrollbar-width:none}
  .sd-nav::before{content:"SD";position:absolute;top:10px;left:50%;transform:translateX(-50%);width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:11px;background:var(--p);color:var(--on-p);font:700 14px/1 var(--font),system-ui,sans-serif}
  .sd-ni{flex:none;width:100%;min-height:60px;padding:8px 4px}
  .sd-top{padding-left:20px}
  .sd-body{padding-bottom:40px}
}
@media (min-width:1280px){
  .sd-shell{--sd-rail:232px}
  .sd-nav{padding:76px 12px 16px}
  .sd-nav::before{content:"StudyDeck";top:20px;left:24px;transform:none;width:auto;height:auto;justify-content:flex-start;background:none;color:var(--t);font-size:calc(var(--fscale,1)*18px);font-weight:650;letter-spacing:-.01em}
  .sd-ni{flex-direction:row;justify-content:flex-start;gap:10px;min-height:46px;padding:0 14px;font-size:calc(var(--fscale,1)*14px)}
  .sd-ni .ic{width:auto;height:auto;background:none!important}
  .sd-ni.on{background:var(--pl)}
}
'''
sub("@media (prefers-reduced-motion: reduce){ *{animation-duration:0.01ms !important;transition-duration:0.01ms !important;} }\n</style>",
    "@media (prefers-reduced-motion: reduce){ *{animation-duration:0.01ms !important;transition-duration:0.01ms !important;} }\n" + SD_CSS + "</style>")

# ───────────────────────── 3. main script: palette, fonts, contrast helper ─────────────────────────
HELPERS = r'''let C = DARK_THEME;
/* ── StudyDeck embedding: palette, fonts and text-on-colour contrast ── */
const SD_P = window.__sdP || null;
const SD_FONT = SD_P ? 'var(--font)' : "'DM Sans',sans-serif";
const SD_HEAD = SD_P ? 'var(--font)' : "'Space Grotesk',sans-serif";
function sdPalette(){
  const v = window.__sdVars || {}, light = !!v.light, d = light ? LIGHT_THEME : DARK_THEME;
  return {
    bg: v['--bg'] || d.bg, bgElevated: v['--card'] || d.bgElevated, card: v['--card'] || d.card, cardHover: v['--card2'] || d.cardHover,
    border: v['--bdr'] || d.border, borderStrong: v['--bdr2'] || d.borderStrong,
    text: v['--t'] || d.text, textDim: v['--m'] || d.textDim, textFaint: v['--h'] || d.textFaint,
    accent: v['--p'] || d.accent, accentDim: v['--pl'] || d.accentDim,
    // StudyDeck's own green is its teal accent, which would make "done" and "primary" look the same here.
    green: light ? '#1B8A4F' : '#5AD08A', amber: v['--gold'] || d.amber, red: v['--r'] || d.red, blue: light ? '#0369A1' : '#5CC0F2',
    navBg: v['--bg'] || d.navBg, headerBg: v['--bg'] || d.headerBg,
  };
}
function sdLum(hex){
  const m = /^#([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 0;
  const n = parseInt(m[1], 16), f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
  return .2126 * f(n >> 16 & 255) + .7152 * f(n >> 8 & 255) + .0722 * f(n & 255);
}
// readable text colour for a given solid fill (StudyDeck's own on-accent colour is dark on its bright dark-mode fills)
const ON = fill => sdLum(fill) > .179 ? '#04201D' : '#fff';
const ONA = (fill, a) => sdLum(fill) > .179 ? `rgba(4,32,29,${a})` : `rgba(255,255,255,${a})`;
'''
sub("let C = DARK_THEME;\n", HELPERS)

# static "indigo" brand colours -> follow the accent
sub('{id:"combined",label:"Combined Master",short:"Combined",icon:"🗂️",color:"#5b5fef",desc:',
    '{id:"combined",label:"Combined Master",short:"Combined",icon:"🗂️",get color(){return C.accent},desc:')
sub('{id:"neet",icon:"🎯",label:"NEET PG",color:"#5b5fef"}', '{id:"neet",icon:"🎯",label:"NEET PG",get color(){return C.accent}}')
sub("combined: {label:'Combined Master', icon:'🗂️', color:'#5b5fef', parser:", "combined: {label:'Combined Master', icon:'🗂️', get color(){return C.accent}, parser:")

# fonts
sub('fontFamily:"\'Space Grotesk\',sans-serif"', 'fontFamily:SD_HEAD', count=19)
sub('fontFamily:"\'DM Sans\',sans-serif"', 'fontFamily:SD_FONT', count=2)
sub('fontFamily:"\'DM Sans\',system-ui,sans-serif"', 'fontFamily:SD_FONT')

# text on coloured fills
sub("done && E('span',{style:{color:'#fff',fontSize:size*0.55", "done && E('span',{style:{color:ON(color),fontSize:size*0.55")
sub("color:value===o.value?'#fff':C.textDim,background:value===o.value?C.accent:'transparent'", "color:value===o.value?ON(C.accent):C.textDim,background:value===o.value?C.accent:'transparent'")
sub("color: primary ? '#fff' : (color||C.text),", "color: primary ? ON(color||C.accent) : (color||C.text),")
sub("color:on?'#fff':f.color,background:on?f.color:`${f.color}18`", "color:on?ON(f.color):f.color,background:on?f.color:`${f.color}18`")
sub("color:isDone(progress,ph,topic.id)?'#fff':PHASE_META[ph].color,", "color:isDone(progress,ph,topic.id)?ON(PHASE_META[ph].color):PHASE_META[ph].color,")
sub("color:on?'#fff':m.color,background:on?m.color:`${m.color}18`", "color:on?ON(m.color):m.color,background:on?m.color:`${m.color}18`")
sub("background:active?C.accent:C.bgElevated,color:active?'#fff':C.textDim}},n,", "background:active?C.accent:C.bgElevated,color:active?ON(C.accent):C.textDim}},n,")
sub("fontFamily:'inherit',color:active?'#fff':FIT_COLOR[row.fit.key]()}}", "fontFamily:'inherit',color:active?ON(C.accent):FIT_COLOR[row.fit.key]()}}")
sub("color:active?'rgba(255,255,255,.9)':C.textFaint,textTransform:'uppercase'}}, d.phase)",
    "color:active?ONA(PHASE_META[d.phase].color,.9):C.textFaint,textTransform:'uppercase'}}, d.phase)")
sub("color:active?'#fff':C.text,marginTop:2}}, short[0])", "color:active?ON(PHASE_META[d.phase].color):C.text,marginTop:2}}, short[0])")
sub("color:active?'rgba(255,255,255,.85)':C.textFaint}}, short[1])", "color:active?ONA(PHASE_META[d.phase].color,.85):C.textFaint}}, short[1])")
sub("background:active?C.accent:C.bgElevated, color:active?'#fff':C.textDim, border:", "background:active?C.accent:C.bgElevated, color:active?ON(C.accent):C.textDim, border:")

# ───────────────────────── 4. App: follow StudyDeck live, StudyDeck header / nav ─────────────────────────
sub("  const [theme, setThemeState] = useState(()=>lsGet(LS_KEYS.theme,'dark'));\n",
    "  const [theme, setThemeState] = useState(()=>lsGet(LS_KEYS.theme,'dark'));\n"
    "  const [, setSdTick] = useState(0);\n"
    "  useEffect(()=>{   // re-read StudyDeck's theme, true-black, font and text size whenever they change\n"
    "    if (!SD_P) return;\n"
    "    let last = JSON.stringify(window.__sdVars || {});\n"
    "    const sync = ()=>{ try{ window.__sdApply(); }catch(e){} const now = JSON.stringify(window.__sdVars || {}); if (now !== last){ last = now; setSdTick(t=>t+1); } };\n"
    "    window.__sdSync = sync;\n"
    "    let mo = null;\n"
    "    try{ mo = new MutationObserver(sync); mo.observe(SD_P.document.documentElement, {attributes:true, attributeFilter:['data-theme','data-amoled','data-font','style','class']}); }catch(e){}\n"
    "    return ()=>{ if (mo) mo.disconnect(); window.__sdSync = null; };\n"
    "  }, []);\n")
sub("  C = theme==='dark' ? DARK_THEME : LIGHT_THEME;\n", "  C = SD_P ? sdPalette() : (theme==='dark' ? DARK_THEME : LIGHT_THEME);\n")
sub("useEffect(()=>{ document.body.style.background = C.bg; }, [theme]);", "useEffect(()=>{ document.body.style.background = C.bg; }, [theme, C.bg]);")

ICONS = r'''const SD_SVG = {
  home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9"/>',
  plan:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/>',
  subjects:'<path d="M12 6.5c-1.6-1-3.6-1.5-5.5-1.5A3.5 3.5 0 0 0 3 8.5v9A3 3 0 0 1 6 16c1.9 0 3.9.5 5.5 1.5"/><path d="M12 6.5c1.6-1 3.6-1.5 5.5-1.5A3.5 3.5 0 0 1 21 8.5v9a3 3 0 0 0-3-1.5c-1.9 0-3.9.5-5.5 1.5"/><path d="M12 6.5v11"/>',
  progress:'<path d="M4 20V10"/><path d="M12 20V4"/><path d="M20 20v-7"/><path d="M2 20h20"/>',
  more:'<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l1.9-1.5-1.9-3.3-2.3.7a7.6 7.6 0 0 0-2.6-1.5L14 2h-4l-.5 2.4a7.6 7.6 0 0 0-2.6 1.5l-2.3-.7-1.9 3.3L4.6 10a7.7 7.7 0 0 0 0 3l-1.9 1.5 1.9 3.3 2.3-.7a7.6 7.6 0 0 0 2.6 1.5L10 22h4l.5-2.4a7.6 7.6 0 0 0 2.6-1.5l2.3.7 1.9-3.3z"/>',
  print:'<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v6H7z"/>',
};
const sdIcon = k => E('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.75,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':'true',dangerouslySetInnerHTML:{__html:SD_SVG[k]}});
function SdTop({days,onPrint}){
  const back = ()=>{ try{ SD_P.closeTriPath(); }catch(e){} };
  return E('div',{className:'sd-top'},
    E('button',{className:'sd-back',onClick:back,'aria-label':'Back to StudyDeck'},'‹'),
    E('div',{className:'sd-mid'}, E('div',{className:'sd-title'},'TriPath'), E('div',{className:'sd-sub'},'Revision Planner')),
    days>=0 && E('span',{className:'sd-days',style:{color:days<14?C.red:days<45?C.amber:C.accent}},`${days}d left`),
    onPrint && E('button',{className:'sd-act',onClick:onPrint,'aria-label':'Print plan'}, sdIcon('print')));
}
function SdNav({tab,setTab}){
  return E('nav',{className:'sd-nav','aria-label':'TriPath sections'},
    NAV_TABS.map(t=>E('button',{key:t.id,className:'sd-ni'+(tab===t.id?' on':''),onClick:()=>setTab(t.id),'aria-current':tab===t.id?'page':undefined},
      E('span',{className:'ic'}, sdIcon(t.id)), E('span',null,t.label))));
}
'''
sub("function printRanges(plan){", ICONS + "\nfunction printRanges(plan){")

# the page shell: header + body + nav
OLD_HEAD_START = "  return E('div',{style:{minHeight:'100vh',background:C.bg,color:C.text,fontFamily:SD_FONT}},\n    E('div',{style:{position:'sticky',top:0,zIndex:20,background:C.headerBg"
assert h.count(OLD_HEAD_START) == 1
i0 = h.index(OLD_HEAD_START)
OLD_HEAD_END = "E(IconButton,{icon:'⚙️',size:32,onClick:()=>setTab('more')}))),\n"
i1 = h.index(OLD_HEAD_END, i0) + len(OLD_HEAD_END)
old_head = h[i0:i1]
new_head = ("  return E('div',{className:SD_P?'sd-shell':undefined,style:SD_P?undefined:{minHeight:'100vh',background:C.bg,color:C.text,fontFamily:SD_FONT}},\n"
            "    SD_P ? E(SdTop,{days:examDaysLeft,onPrint:()=>setPrintMode(true)}) :\n"
            + old_head.split("\n", 1)[1])
h = h[:i0] + new_head + h[i1:]
n_patches += 1

sub("    storageFail && E('div',{onClick:()=>setStorageFail(false),style:{maxWidth:560,margin:'8px auto 0'",
    "    storageFail && E('div',{onClick:()=>setStorageFail(false),style:{maxWidth:SD_P?'var(--sd-w)':560,margin:'8px auto 0'")
sub("    E('div',{style:{maxWidth:560,margin:'0 auto'}},\n      tab==='home'",
    "    E('div',SD_P?{className:'sd-body'}:{style:{maxWidth:560,margin:'0 auto'}},\n      tab==='home'")
# bottom bar
OLD_NAV_START = "    E('div',{style:{position:'fixed',bottom:0,left:0,right:0,background:C.navBg"
assert h.count(OLD_NAV_START) == 1
j0 = h.index(OLD_NAV_START)
OLD_NAV_END = "color:tab===t.id?C.accent:C.textFaint,marginTop:2}},t.label)))))\n"
j1 = h.index(OLD_NAV_END, j0) + len(OLD_NAV_END)
old_nav = h[j0:j1].rstrip('\n')
assert old_nav.endswith(')))))')
new_nav = "    SD_P ? E(SdNav,{tab,setTab}) :\n" + old_nav + "\n"
h = h[:j0] + new_nav + h[j1:]
n_patches += 1

# first-run set-up (no plan yet): keep the back arrow so it is never a dead end
sub("    return E(Onboarding,{onComplete:(cfg,pl)=>{ setConfigState(cfg); setPlanState(pl); setProgressState({}); }});",
    "    const ob = E(Onboarding,{onComplete:(cfg,pl)=>{ setConfigState(cfg); setPlanState(pl); setProgressState({}); }});\n"
    "    return SD_P ? E('div',{className:'sd-shell sd-solo'}, E(SdTop,{days:-1}), ob) : ob;")
sub(".sd-back:focus-visible,", ".sd-shell.sd-solo{--sd-rail:0px}\n.sd-shell.sd-solo>:last-child{min-height:calc(100vh - 56px)!important}\n.sd-back:focus-visible,")

# Appearance setting: the theme now belongs to StudyDeck
sub("    E('div',{style:{marginBottom:20}}, E(ViewToggle,{options:[{value:'dark',label:'🌙 Dark'},{value:'light',label:'☀️ Light'}], value:theme, onChange:setTheme})),\n",
    "    SD_P\n"
    "      ? E('div',card({marginBottom:20,fontSize:12.5,lineHeight:1.6,color:C.textDim}),\n"
    "          'TriPath follows StudyDeck\\u2019s appearance \\u2014 theme, true black, font and text size. Change them in StudyDeck \\u203a Settings \\u203a Appearance.')\n"
    "      : E('div',{style:{marginBottom:20}}, E(ViewToggle,{options:[{value:'dark',label:'🌙 Dark'},{value:'light',label:'☀️ Light'}], value:theme, onChange:setTheme})),\n")

# toast sits above the bar
# (kept as is: bottom is already calc(74px + safe-area), which clears the 62px bar)


# ───────────────────────── 5. size: the spreadsheet library is fetched on first use, the app code is minified ─────────────────────────
# SheetJS (xlsx.full.min.js, 880 KB) was a third of the whole page and is only needed to import / export Excel files.
# It loads from the same CDN as StudyDeck's other libraries, is warmed up shortly after TriPath opens, and the offline
# service worker keeps a copy after the first online load.
a = h.index('<script>/* inlined: xlsx@0.18.5/dist/xlsx.full.min.js */')
b = h.index('</script>', a) + len('</script>')
assert b - a > 600000
XLSX_LOADER = r"""<script>
/* SheetJS is fetched when first needed (Excel import / export) instead of being bundled: it was a third of TriPath's size. */
(function(){
  var URL='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',p=null;
  window.__sdNeedXLSX=function(){
    if(window.XLSX)return Promise.resolve();
    if(p)return p;
    p=new Promise(function(res,rej){
      var s=document.createElement('script');s.src=URL;s.async=true;
      s.onload=function(){window.XLSX?res():rej(0)};s.onerror=function(){rej(0)};
      document.head.appendChild(s);
    }).catch(function(){p=null;throw new Error('The spreadsheet tools could not be loaded. Connect to the internet once and try again — they are kept for offline use afterwards.')});
    return p;
  };
  window.addEventListener('load',function(){setTimeout(function(){window.__sdNeedXLSX().catch(function(){})},4000)});
})();
</script>"""
h = h[:a] + XLSX_LOADER + h[b:]
n_patches += 1

sub("  return file.arrayBuffer().then(buf=>{\n    let wb;\n    try { wb = XLSX.read(buf, {type:'array'}); }",
    "  return Promise.all([file.arrayBuffer(), window.__sdNeedXLSX()]).then(([buf])=>{\n    let wb;\n    try { wb = XLSX.read(buf, {type:'array'}); }")
sub("function exportIndex(kind){\n  const builder = EXPORT_BUILDERS[kind];\n  if (!builder) return;\n",
    "function exportIndex(kind){\n  const builder = EXPORT_BUILDERS[kind];\n  if (!builder) return;\n"
    "  if (!window.XLSX){ window.__sdNeedXLSX().then(()=>exportIndex(kind), e=>tpNote(e.message)); return; }\n")
sub("function downloadTemplate(kind){\n",
    "function downloadTemplate(kind){\n  if (!window.XLSX){ window.__sdNeedXLSX().then(()=>downloadTemplate(kind), e=>tpNote(e.message)); return; }\n")
sub("const ON = fill =>", "function tpNote(m){ if (window.__tpToast) window.__tpToast(m); else alert(m); }\nconst ON = fill =>")
sub("  const [toast, setToast] = useState(null);\n",
    "  const [toast, setToast] = useState(null);\n  useEffect(()=>{ window.__tpToast = setToast; return ()=>{ window.__tpToast = null; }; }, []);\n")

# app code: whitespace / comments / dead branches removed, names inside functions shortened; the data strings are untouched
import subprocess, os
ES = os.environ.get('ESBUILD') or '/opt/npm-tools/node_modules/.bin/esbuild'   # an empty ESBUILD means "not set"
m0 = h.index('<script>\nvar useState=React.useState')
m1 = h.index('</script>', m0)
code = h[m0 + len('<script>\n'):m1]
r = subprocess.run([ES, '--loader=js', '--minify', '--target=es2019', '--charset=utf8', '--legal-comments=none'],
                   input=code.encode('utf-8'), capture_output=True)
assert r.returncode == 0, r.stderr.decode()[:600]
mini = r.stdout.decode('utf-8')
assert '</script' not in mini.lower()
print('app script %d -> %d bytes minified' % (len(code.encode()), len(mini.encode())))
h = h[:m0] + '<script>\n' + mini + h[m1:]
n_patches += 1

open(dst, 'w', encoding='utf-8').write(h)
print('patches applied: %d  ·  %s -> %s bytes' % (n_patches, len(open(src, 'rb').read()), len(h.encode('utf-8'))))
