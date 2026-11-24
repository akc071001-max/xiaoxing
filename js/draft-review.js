const DraftReview = (() => {
  const LIMIT = 60;
  const LANG = {
    zh: {
      name:'稿件自检', intro:'在浏览器内检查，不调用 AI，也不会改动正文。下面是值得回看的位置，不是错误判定。',
      words:'英俄词数', han:'汉字', paragraphs:'段落', minutes:'估计阅读时长', minute:'{n} 分钟', short:'不到 1 分钟',
      duplicate:'与上文重复', long:'较长段落', placeholder:'待完成标记', line:'第 {n} 行',
      empty:'先写一段正文，再来检查。', clean:'没有发现重复段落、明显的待完成标记或较长段落。', limited:'这里只显示前 {n} 条提醒。',
      action:'跳到正文', close:'关闭'
    },
    en: {
      name:'Review draft', intro:'Checks run in your browser without AI or changes to the manuscript. Results are places to review, not judgments.',
      words:'English & Russian words', han:'Han characters', paragraphs:'Paragraphs', minutes:'Est. reading time', minute:'{n} min', short:'Under 1 min',
      duplicate:'Repeated passage', long:'Long paragraph', placeholder:'Unfinished marker', line:'Line {n}',
      empty:'Write some text first to review it here.', clean:'No repeated passages, unfinished markers or long paragraphs found.', limited:'Showing the first {n} suggestions.',
      action:'Jump to text', close:'Close'
    },
    ru: {
      name:'Проверка черновика', intro:'Проверка выполняется в браузере без ИИ и не меняет рукопись. Результаты отмечают места для просмотра, а не ошибки.',
      words:'Слова (англ./рус.)', han:'Китайские иероглифы', paragraphs:'Абзацы', minutes:'Примерное время чтения', minute:'{n} мин', short:'Меньше 1 мин',
      duplicate:'Повтор текста', long:'Длинный абзац', placeholder:'Отметка о доработке', line:'Строка {n}',
      empty:'Сначала напишите немного текста.', clean:'Повторы, отметки о доработке и длинные абзацы не обнаружены.', limited:'Показано не более {n} подсказок.',
      action:'Перейти к тексту', close:'Закрыть'
    }
  };
  const contentCounts = text => ({
    han: (text.match(/\p{Script=Han}/gu) || []).length,
    words: (text.match(/[\p{Script=Latin}\p{Script=Cyrillic}]+(?:[’'-][\p{Script=Latin}\p{Script=Cyrillic}]+)*/gu) || []).length
  });
  function collectParagraphs(text) {
    const rows = [];
    let start = 0, line = 1, paragraphStart = null, paragraphEnd = 0, paragraphLine = 1;
    const endParagraph = () => {
      if (paragraphStart !== null) rows.push({ start:paragraphStart, end:paragraphEnd, line:paragraphLine, text:text.slice(paragraphStart,paragraphEnd) });
      paragraphStart = null;
    };
    for (const match of text.matchAll(/\r\n?|\n|$/g)) {
      const end = match.index, value = text.slice(start,end);
      if (value.trim()) {
        if (paragraphStart === null) { paragraphStart = start; paragraphLine = line; }
        paragraphEnd = end;
      } else endParagraph();
      if (!match[0]) break;
      start = end + match[0].length;
      line++;
    }
    endParagraph();
    return rows;
  }
  const excerpt = text => {
    const concise = text.replace(/\s+/g,' ').trim();
    let cut = '';
    for (const ch of concise) {
      if (cut.length >= 120) return cut + '…';
      cut += ch;
    }
    return cut;
  };
  function analyze(value) {
    const text = String(value ?? '');
    const stats = contentCounts(text);
    const paragraphs = collectParagraphs(text);
    const issues = [], seen = new Set();
    let total = 0;
    const add = (type, row, start = row.start, end = row.end) => {
      total++;
      if (issues.length < LIMIT) issues.push({type,start,end,line:row.line,excerpt:excerpt(row.text)});
    };
    for (const row of paragraphs) {
      const normalized = row.text.trim().replace(/\s+/g,' ').toLocaleLowerCase();
      if (normalized.length >= 24 && seen.has(normalized)) add('duplicate',row);
      seen.add(normalized);
      const n=contentCounts(row.text);
      if (n.han / 420 + n.words / 185 >= 1) add('long',row);
      const breaks = row.text.matchAll(/\r\n?|\n/g);
      let nextBreak=breaks.next(), markerLine=row.line;
      for (const m of row.text.matchAll(/\[(?:TODO|TBD|TK|待补充?|待核对|уточнить|добавить)\]|\b(?:TODO|TBD)\b|待补(?:充)?|待核对/giu)) {
        while (!nextBreak.done && nextBreak.value.index < m.index) { markerLine++; nextBreak=breaks.next(); }
        add('placeholder',{...row,line:markerLine,text:m[0]+' · '+row.text.slice(Math.max(0,m.index-32),m.index+74)},row.start+m.index,row.start+m.index+m[0].length);
      }
    }
    return { ...stats, paragraphs:paragraphs.length, estimate:stats.han/360+stats.words/225, issues, total };
  }
  const ids = ['btn-review-chapter','btn-review-paper'];
  let activeEditor, source, opener;
  function i18n() { return LANG[typeof state !== 'undefined' && state.settings.lang] || LANG.zh; }
  const get=id=>document.getElementById(id);
  function refresh() {
    const c=i18n();
    ids.forEach(id=>{
      const button=get(id);
      if (button) button.textContent=c.name;
    });
    if (!get('draft-review')) return;
    get('draft-review-title').textContent=c.name;
    get('draft-review-intro').textContent=c.intro;
    get('draft-review-close').setAttribute('aria-label',c.close);
  }
  function renderReview() {
    const t=i18n(), stats=analyze(source);
    const numbers=new Intl.NumberFormat(typeof state !== 'undefined' ? state.settings.lang : 'zh');
    const statList=get('draft-review-stats'), issueList=get('draft-review-issues');
    statList.replaceChildren();
    issueList.replaceChildren();
    const time = !source.trim() ? '—' : (stats.estimate < 1 ? t.short : t.minute.replace('{n}',numbers.format(Math.ceil(stats.estimate))));
    const counts = [[t.words,numbers.format(stats.words)],[t.han,numbers.format(stats.han)],[t.paragraphs,numbers.format(stats.paragraphs)],[t.minutes,time]];
    for (const [label,value] of counts) {
      const card=document.createElement('div');
      const dt=document.createElement('dt'), dd=document.createElement('dd');
      dt.textContent=label; dd.textContent=value; card.append(dt,dd); statList.append(card);
    }
    for (const issue of stats.issues) {
      const item=document.createElement('li'), jump=document.createElement('button');
      const top=document.createElement('strong'), body=document.createElement('span');
      top.textContent=t[issue.type]+' · '+t.line.replace('{n}',numbers.format(issue.line));
      body.textContent=issue.excerpt;
      jump.type='button'; jump.className='draft-review-hit';
      jump.setAttribute('aria-label',top.textContent+' · '+t.action);
      jump.append(top,body); item.append(jump); issueList.append(item);
      jump.addEventListener('click',() => {
        if (!activeEditor || activeEditor.value !== source) {
          source=activeEditor?.value || '';
          renderReview();
          return;
        }
        const ed=activeEditor;
        get('draft-review').close('jump');
        ed.focus({preventScroll:true});
        ed.setSelectionRange(issue.start,issue.end);
        const rows=ed.value.split(/\r\n?|\n/).length;
        ed.scrollTop=Math.max(0,(ed.scrollHeight-ed.clientHeight)*(issue.line-1)/Math.max(1,rows-1));
        ed.scrollIntoView({block:'nearest',inline:'nearest'});
      });
    }
    get('draft-review-note').textContent=!source.trim() ? t.empty : !stats.issues.length ? t.clean :
      stats.total>stats.issues.length ? t.limited.replace('{n}',numbers.format(LIMIT)) : '';
  }
  function show(button,paper) {
    activeEditor=get(paper?'paper-editor':'editor');
    if (!activeEditor || activeEditor.disabled) return;
    source=activeEditor.value;
    opener=button;
    refresh();
    renderReview();
    get('draft-review').showModal();
  }
  function install() {
    const dialog=get('draft-review');
    if (!dialog || dialog.dataset.bound) return;
    dialog.dataset.bound='1';
    ids.forEach((id,i)=>get(id)?.addEventListener('click',ev=>show(ev.currentTarget,i===1)));
    get('draft-review-close').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>{if (dialog.returnValue!=='jump') opener?.focus(); dialog.returnValue='';});
    refresh();
  }
  return Object.freeze({analyze,install,refresh});
})();
