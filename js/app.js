'use strict';
/* ============================================================
   晓星 XIAOXING · 全风格小说创作台 — 核心逻辑
   数据存储：IndexedDB（fallback localStorage）
   AI 接入：OpenAI 兼容 /chat/completions 接口（流式 SSE）
   联网学习：Wikipedia API（作家文风）
   英语词典：dictionaryapi.dev + Datamuse
   ============================================================ */

/* ---------------- 工具函数 ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const now = () => Date.now();
function fmtTime(ts) { if (!ts) return '—'; const d = new Date(ts); const p = n => String(n).padStart(2, '0'); return `${p(d.getHours())}:${p(d.getMinutes())}`; }
function fmtDate(ts) { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function fmtNum(n) { n = Number(n) || 0; if (n >= 10000) return (n / 10000).toFixed(1) + '万'; return String(n); }
const CJK_RE = /[\u2E80-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF\u3400-\u4DBF]/g;
function countCJK(s) { return (s.match(CJK_RE) || []).length; }
function countLatin(s) { return (s.replace(CJK_RE, ' ').match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length; }
function countWords(s) { return countCJK(s) + countLatin(s); }
function download(filename, text, mime) {
  const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
async function copyText(t2) {
  try { await navigator.clipboard.writeText(t2); toast(t('toast.copied'), 'ok'); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = t2; document.body.appendChild(ta);
    ta.select(); try { document.execCommand('copy'); toast(t('toast.copied'), 'ok'); } catch (e2) { toast(t('toast.copyFail'), 'err'); }
    ta.remove();
  }
}
function toast(msg, type, ms) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + (type || 'info');
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms || 2600);
}

/* ---------------- 国际化 ---------------- */
const I18N = {
  zh: {
    'brand.sub': 'ALL-GENRE NOVEL STUDIO',
    'btn.langTitle': '切换界面语言 / Switch language',
    'btn.backup': '⛁ 备份', 'btn.backupTitle': '备份与导出',
    'btn.ai': '⚙ AI 模型', 'btn.aiTitle': 'AI 模型接入设置',
    'btn.profileTitle': '个人档案（头像 / 昵称）',
    'profile.default': '未设置昵称',
    'nav.chapters': '章节', 'nav.outline': '大纲', 'nav.characters': '角色', 'nav.style': '文风', 'nav.world': '设定', 'nav.memories': '记忆',
    'btn.dict': '📖 词典', 'btn.dictTitle': '英语词典（选中正文后打开自动查词）',
    'btn.focus': '⛶ 专注', 'btn.focusExit': '⛶ 退出专注',
    'btn.aiToggle': '✦ AI 引擎',
    'status.draft': '草稿', 'status.revising': '修订中', 'status.done': '定稿',
    'ai.title': '✦ 剧情引擎', 'ai.clearTitle': '清空对话',
    'ai.ctx': '上下文注入 · 记忆范围',
    'ctx.outline': '大纲', 'ctx.chars': '角色卡', 'ctx.world': '世界观设定', 'ctx.mem': '记忆库', 'ctx.chatHistory': '对话历史', 'ctx.prev': '前文章节',
    'chip.continue': '▶ 续写本章', 'chip.plot': '⛨ 推演剧情', 'chip.brainstorm': '✦ 头脑风暴', 'chip.polish': '✎ 润色选中',
    'chip.extract': '◬ 提取记忆', 'chip.outline': '◈ 生成大纲', 'chip.style': '✧ 文风诊断',
    'ai.send': '发送', 'ai.stop': '■ 停止',
    'lib.title': '◈ 书库管理', 'lib.new': '＋ 新建小说',
    'novel.title': '书名', 'novel.descLabel': '简介（AI 与记忆系统自动引用）',
    'style.audience': '用户群体', 'style.genres': '类型（可多选）', 'style.length': '篇幅', 'style.pov': '视角', 'style.tone': '基调',
    'style.lang': '写作语言', 'style.authors': '参考作家（推荐）', 'style.learn': '⛁ 联网学习文风',
    'aiset.title': '⚙ AI 模型接入', 'aiset.list': '已接入模型', 'aiset.add': '＋ 添加模型', 'aiset.accent': '界面主题色',
    'aiset.config': '模型配置', 'aiset.preset': '预设（快速填充）', 'aiset.name': '显示名称',
    'aiset.base': 'API 地址（Base URL，通常以 /v1 结尾）', 'aiset.path': '接口路径（默认 /chat/completions）', 'aiset.key': 'API Key', 'aiset.model': '模型名称',
    'aiset.temp': '温度（创造性）', 'aiset.maxtok': '最大输出 tokens', 'aiset.test': '测试连接', 'aiset.save': '保存并启用',
    'aiset.help': '<b>如何接入？</b><p>只要兼容 OpenAI 接口格式即可。云端模型填 API 地址 + Key；本地开源模型（Ollama / LM Studio / vLLM / llama.cpp）填本地地址，Key 留空。</p><p><b>已内置免费模型</b>：Pollinations AI（无需 Key、无需注册，首次打开即可用）。免费额度有限，高峰时段可能变慢或限流；追求稳定高速，请在预设里选择 DeepSeek / Kimi 等并填入自己的 Key（几块钱可用很久）。</p><p>Ollama 需允许跨域：环境变量 <code>OLLAMA_ORIGINS=*</code> 后重启；或运行项目里的 <code>node proxy.mjs</code> 代理转发，Base URL 填 <code>http://localhost:8787/v1</code>。</p><p>云端模型若被浏览器 CORS 拦截，也可用代理：<code>node proxy.mjs 8787 https://api.deepseek.com</code>。</p>',
    'backup.title': '⛁ 备份与导出', 'backup.desc': '数据保存在本机浏览器（IndexedDB），清理浏览器数据会丢失，建议定期备份。单章与全书均无字数上限。',
    'backup.txt': '导出当前小说 TXT', 'backup.txtSub': '所有章节按顺序合并为纯文本文件',
    'backup.json': '备份全部数据 JSON', 'backup.jsonSub': '书库、章节、大纲、角色、设定、记忆、对话',
    'backup.import': '导入备份 JSON', 'backup.importSub': '将覆盖当前全部数据', 'backup.importBtn': '导入',
    'backup.wipe': '清除全部数据', 'backup.wipeSub': '不可恢复！', 'backup.wipeBtn': '清除',
    'backup.backupBtn': '备份',
    'note.title': '标题', 'note.content': '内容', 'note.cat': '分类',
    'cat.plot': '情节', 'cat.char': '人物', 'cat.foreshadow': '伏笔', 'cat.world': '世界', 'cat.other': '其他',
    'char.title': '♜ 角色卡', 'char.name': '姓名', 'char.role': '身份 / 定位', 'char.appearance': '外貌', 'char.personality': '性格',
    'char.background': '背景', 'char.relations': '人物关系', 'char.notes': '备注 / 伏笔',
    'profile.title': '👤 个人档案', 'profile.nick': '昵称', 'profile.upload': '📷 上传头像', 'profile.clear': '恢复默认', 'profile.pick': '选择头像',
    'dict.title': '📖 词典', 'dict.search': '查询',
    'dict.ph': '输入英文单词…（选中正文后打开自动查词）',
    'common.save': '保存', 'common.cancel': '取消', 'common.close': '关闭', 'common.confirm': '确定', 'common.delete': '删除', 'common.export': '导出',
    'w.title': '标题', 'w.genre': '类型', 'w.audience': '用户群体', 'w.length': '篇幅', 'w.pov': '视角', 'w.tone': '基调', 'w.lang': '写作语言', 'w.authors': '参考作家',
    'w.edit': '✎ 编辑风格表格', 'w.synopsis': '全书梗概 · SYNOPSIS', 'w.world': '世界观 · WORLDVIEW', 'w.custom': '自定义条目', 'w.addSec': '＋ 添加条目',
    'w.authorLib': '作家文风库 · AUTHOR STYLE LAB', 'w.authorTip': '点击作家切换参考；「联网学习」将抓取维基百科词条研究其写作特点，并随上下文注入 AI。',
    'w.learn': '⛁ 联网学习文风', 'w.learnSel': '⛁ 联网学习文风（已选 {n} 位）', 'w.builtin': '内置技法', 'w.wiki': '联网学习（维基百科）',
    'w.learnOk': '文风学习完成：{ok}/{n} 位成功', 'w.learnFail': '文风学习：全部失败（请检查网络）', 'w.learnPartial': '文风学习完成：{ok} 成功 / {fail} 失败',
    'stat.words': '中文 {a} · 英文词 {b}', 'stat.pos': '行 {a} · 列 {b}', 'stat.chars': '字符 {a}', 'stat.wordsChip': '字',
    'dict.loading': '查询中…', 'dict.notfound': '未找到该单词的定义。请检查拼写，或换个词试试。',
    'dict.errNet': '词典请求失败：可能是网络问题（该接口需联网）。', 'dict.syn': '近义词 / 同义词', 'dict.src': '数据来源：dictionaryapi.dev · Datamuse',
    'toast.welcome': '欢迎来到晓星 XIAOXING！先「新建小说」，再到右上「⚙ AI 模型」接入你的模型。',
    'toast.saved': '已保存', 'toast.savedOk': '已保存', 'toast.needNovel': '请先新建小说', 'toast.needNovelSel': '请先选择小说',
    'toast.noChapters': '暂无章节', 'toast.txtOk': '已导出 TXT', 'toast.backupOk': '备份完成', 'toast.importOk': '导入完成',
    'toast.importFail': '导入失败：', 'toast.wiped': '已清除全部数据', 'toast.chapterDel': '章节已删除',
    'toast.chapterFromNode': '已从大纲节点创建章节，可继续编辑', 'toast.outlineDel': '大纲节点已删除',
    'toast.charSaved': '角色已保存', 'toast.memSaved': '已保存', 'toast.novelSaved': '小说已保存', 'toast.novelDel': '小说已删除',
    'toast.needTitle': '请输入书名', 'toast.needNodeTitle': '请输入标题', 'toast.needContent': '内容不能为空', 'toast.needName': '请输入姓名',
    'toast.noAI': '尚未配置 AI 模型，请先接入', 'toast.aiBusy': 'AI 正在生成中…',
    'toast.needChapter': '请先创建并打开一个章节', 'toast.needChapterOpen': '请先打开一个章节',
    'toast.nothingPolish': '没有可润色的文字', 'toast.inserted': '已插入章节', 'toast.memAdded': '已存入 {n} 条记忆',
    'toast.copied': '已复制到剪贴板', 'toast.copyFail': '复制失败', 'toast.chatClear': '对话已清空',
    'toast.providerSaved': '模型已保存并启用', 'toast.providerDel': '已删除模型配置', 'toast.providerFill': '请填写 API 地址与模型名称',
    'toast.providerPick': '先在左侧选择一个模型，或直接点「保存并启用」', 'toast.profileSaved': '个人档案已保存',
    'toast.avatarTooBig': '图片过大，请选择 2MB 以内的图片', 'toast.avatarBad': '无法读取该图片',
    'toast.dictNeedWord': '请输入要查询的英文单词', 'toast.memDeleted': '记忆条目已删除',
    'toast.learnBusy': '正在联网学习文风，请稍候…',
    'toast.langHint': '界面语言已切换', 'toast.nickSave': '昵称已保存',
    'empty.panel': '请先点击顶部书名<br/>新建 / 选择一本小说。',
    'empty.chapters': '暂无章节<br/>点击右上「＋ 新章节」开始写作，<br/>或先到「大纲」构思剧情。',
    'empty.outline': '还没有大纲。<br/>点击右上「＋ 新卷」创建分卷，<br/>再在卷下添加章节情节节点。<br/><br/>AI 剧情引擎会自动引用大纲。',
    'empty.chars': '还没有角色卡。<br/>创建角色卡后，AI 会自动记住人物设定，<br/>写作时保持人设一致。',
    'empty.mem': '暂无记忆条目。<br/>手动添加，或用 AI 引擎的「◬ 提取记忆」自动生成。',
    'empty.chat': '✦ 剧情引擎已就绪（免费模型已自动接通）<br/>用上方快捷指令续写 / 推演剧情，<br/>或直接与 AI 讨论、让它记住设定。',
    'empty.lib': '星海寂静，尚无小说。点击下方「＋ 新建小说」开始创作。',
    'empty.volKids': '暂无节点，点下方「＋ 节点」添加。',
    'editor.placeholder.zh': '全新章节，从这里开始你的宇宙……（Ctrl+S 保存 · 右侧 ✦ 召唤 AI 引擎）',
    'editor.placeholder.en': 'A new chapter begins here… (Ctrl+S to save · ✦ AI engine on the right)',
    'editor.noChapter': '没有打开的章节。在左侧「章节」面板新建一章，或点击顶部书名从书库选择小说。',
    'ai.inputPh': '与 AI 讨论剧情、让它记住设定、或直接下指令…（Ctrl+Enter 发送）',
    'ai.modelNone': '未配置模型', 'ai.you': '你', 'ai.engine': '✦ 引擎',
    'novel.new': '新建小说', 'novel.edit': '编辑小说',
    'confirm.delChapter': '删除该章节？正文将不可恢复。', 'confirm.delOutline': '删除该大纲节点？其下子节点将一并删除。',
    'confirm.delChar': '删除该角色卡？', 'confirm.delMem': '删除该记忆条目？',
    'confirm.delNovel': '删除小说《{t}》及其全部章节、大纲、角色、设定、记忆？此操作不可恢复。',
    'confirm.delProvider': '删除该模型配置？',
    'confirm.wipe': '清除全部数据？所有小说、章节、大纲、角色、记忆都将永久删除，不可恢复！',
    'confirm.import': '导入将覆盖当前全部数据（书库 / 章节 / 大纲 / 角色 / 记忆 / 对话）。确认导入？',
    'dict.provOk': '✓ 连接成功：', 'dict.provFail': '连接失败：',
    'learn.fetching': '正在学习 {name} 的文风…', 'learn.noSel': '请先在上方选择参考作家',
    'w.noAuthors': '尚未选择参考作家。点击上方作家标签选择，再联网学习其写作技法。',
    'novel.legacyGenre': '未分类',
    'terms.title': '📜 用户须知 · 用户守则',
    'terms.noticeTitle': '一、用户须知',
    'terms.notice': '<ul><li><b>数据本地存储</b>：你的小说、大纲、角色、记忆全部保存在你自己浏览器的 IndexedDB 中，本工具不收集、不上传任何创作内容。清除浏览器数据会导致作品丢失，请定期使用「⛁ 备份」导出。</li><li><b>AI 接入</b>：AI 剧情引擎需自行接入模型（云端 API 或本地开源模型）。API Key 仅保存在本机，只在请求你配置的接口时发送给对应服务商。</li><li><b>联网功能</b>：「作家文风学习」「英语词典」会访问公开接口（维基百科、词典服务），仅用于查询，不涉及上传你的内容。</li><li><b>内容责任</b>：本工具免费提供、不作任何担保；由 AI 生成的内容请自行审核其准确性、版权与合规性，创作者对最终发布的内容负全部责任。</li><li><b>未成年人</b>：请在监护人指导下使用。</li></ul>',
    'terms.rulesTitle': '二、用户守则',
    'terms.rules': '<ul><li>不得生成或传播违法内容：包括但不限于淫秽色情、暴力恐怖、煽动仇恨与歧视、侵犯他人隐私、诈骗与虚假信息、危害国家安全的内容。</li><li>尊重知识产权：参考作家是学习其<b>写作技法</b>，严禁抄袭、洗稿或未经授权转载他人作品。</li><li>遵守所接入 AI 服务商的使用条款及当地法律法规。</li><li>不得滥用联网功能与他人接口（恶意爬取、批量攻击等）。</li><li>友善创作：不得利用工具制作针对真实人物的侮辱、诽谤或深度伪造内容。</li><li>违反守则者自行承担全部法律责任；晓星保留拒绝提供服务并追究责任的权利。</li></ul>',
    'terms.version': '版本 2025-01 · 晓星 XIAOXING',
    'terms.agreeLabel': '我已阅读并同意以上全部内容',
    'terms.agreeBtn': '同意并进入',
    'terms.declineBtn': '不同意',
    'terms.declined': '未同意用户须知与守则将无法使用。',
    'profile.terms': '📜 用户须知',
    'btn.vip': '💎 会员', 'btn.vipTitle': '会员中心（试运营·不收费）',
    'btn.feedback': '💬 反馈', 'btn.feedbackTitle': '意见反馈',
    'co.label': '📋 本章大纲',
    'co.gen': '⚡ 联网生成正文', 'co.again': '🔄 重新生成',
    'co.ph': '输入本章大纲：本章要发生什么、出现哪些人物、埋什么伏笔…… 输入后点「⚡ 联网生成正文」',
    'co.needChapter': '请先创建并打开一个章节', 'co.needOutline': '请先在「本章大纲」输入内容',
    'co.confirmOverwrite': '本章已有正文，生成将覆盖现有内容。是否继续？',
    'co.done': '✓ 生成完成，不满意可点「🔄 重新生成」', 'co.cancelled': '已取消生成',
    'co.running': '生成中…',
    'gp.title': '⚡ 联网生成正文',
    'gp.search': '正在搜索作家', 'gp.style': '正在学习作家文风', 'gp.draft': '正在拟写正文', 'gp.write': '正在输出正文',
    'gp.cancelTitle': '取消生成',
    'au.label': '自定义作家', 'au.ph': '输入你喜欢的作家名字，联网搜索添加…',
    'au.search': '🔍 搜索添加', 'au.needName': '请输入作家名字', 'au.searching': '正在联网搜索…',
    'au.notfound': '未找到该作家，换个名字试试', 'au.added': '已添加并选为参考：{name}', 'au.fail': '搜索失败：请检查网络后重试',
    'au.custom': '自定义', 'au.del': '删除该自定义作家？',
    'fb.title': '💬 意见反馈', 'fb.label': '问题或建议',
    'fb.ph': '请描述您遇到的问题或建议…', 'fb.hint': '我们会认真阅读每一条反馈。',
    'fb.send': '提交反馈', 'fb.thanks': '感谢您的反馈', 'fb.fail': '反馈提交失败，请稍后再试', 'fb.needMsg': '请先填写反馈内容',
    'vip.title': '💎 会员中心', 'vip.notice': '试运营 · 不收费',
    'vip.free': '免费体验版', 'vip.freePrice': '¥0 · 试运营', 'vip.currentBtn': '当前方案',
    'vip.f1': '内置免费 AI 模型', 'vip.f2': '全部创作功能', 'vip.f3': '数据本地保存',
    'vip.pro': '专业创作版', 'vip.proPrice': '¥0 · 试运营',
    'vip.p1': '更优质的大模型', 'vip.p2': '更长上下文记忆', 'vip.p3': '更快生成速度',
    'vip.flag': '旗舰版', 'vip.flagPrice': '¥0 · 试运营',
    'vip.l1': '全部专业版权益', 'vip.l2': '优先接入新模型', 'vip.l3': '专属客服支持',
    'vip.btn': '暂未开放', 'vip.btnToast': '试运营期间不收费，敬请期待',
    'vip.foot': '试运营期间所有方案均不收费，敬请期待正式上线。',
    'btn.settings': '⚙ 设置', 'btn.settingsTitle': '设置中心',
    'co.layout': '布局', 'co.layoutToggleTitle': '切换布局：上下 / 左右分屏',
    'set.title': '⚙ 设置', 'set.ui': '界面设置', 'set.font': '正文字号', 'set.layout': '界面样式',
    'set.stack': '小框大纲 · 大框正文', 'set.split': '一半大纲 · 一半正文',
    'set.aipanel': 'AI 引擎面板', 'set.on': '开', 'set.off': '关', 'set.accent': '主题色',
    'set.account': '个人账户', 'set.editProfile': '编辑头像 / 昵称',
    'set.lang': '语言 Language',
    'set.general': '通用', 'set.backup': '⛁ 备份与导出', 'set.ai': '⚙ AI 模型接入',
    'set.feedback': '💬 问题反馈', 'set.terms': '📜 用户须知',
    'set.about': '版本更新', 'set.version': '当前版本', 'set.check': '检查更新',
    'set.upToDate': '已是最新版本（{v}）', 'set.updateFound': '发现新版本 {v}，请按 Ctrl+F5 刷新页面获取',
    'set.updateFail': '检查失败：请检查网络后重试',
    'co.gen': '🚀 开始创作', 'co.chapterTitle': 'AI 起章节名（依据本章大纲）',
    'novel.title': '书名（可留空，稍后由大纲推理）', 'novel.titlePh': '可留空（待定）…',
    'novel.titleSuggest': '✨ 智能起书名', 'novel.titleSuggestHint': '书名可先空着，写下简介后让 AI 从大纲推理多个候选书名，你来挑选',
    'novel.pending': '书名待定',
    'style.narrative': '写法', 'style.dialogue': '对话为主', 'style.balanced': '对话叙述均衡', 'style.narrativeMode': '叙述为主',
    'storage.title': '💾 存储权限请求',
    'storage.desc': '<p>晓星需要把您的<b>小说、大纲、角色、记忆</b>等作品数据保存在<b>您自己设备的浏览器存储</b>中（IndexedDB），用于自动保存与下次继续创作。数据不会上传到任何服务器。</p><p>同意后作品会自动保存；拒绝则本次创作内容<b>不会保存</b>，关闭页面后可能丢失。</p>',
    'storage.allow': '同意并存储', 'storage.deny': '拒绝',
    'storage.warn': '⚠ 您未授权本地存储：当前作品不会被保存，关闭页面将丢失。可在「⚙ 设置 → 存储权限」重新授权。',
    'set.storage': '💾 存储权限', 'set.storageState': '存储状态',
    'set.storageOk': '已授权（作品自动保存到本机）', 'set.storageNo': '未授权（内容不会保存）',
    'set.bg': '页面背景', 'set.pet': '创作小助手',
    'asst.title': '🛸 创作小助手', 'asst.petTitle': '点我，找创作小助手', 'asst.hide': '🙈 隐藏小助手',
    'asst.a1': '＋ 新建小说', 'asst.a2': '🚀 开始创作', 'asst.a3': '✨ 智能起名', 'asst.a4': '⚙ 打开设置', 'asst.a5': '💬 我要反馈',
    'asst.guide': '<h3>🚀 三步开始创作</h3><ul><li><b>第一步 · 建小说</b>：点「＋ 新建小说」，选好风格表格；书名可以先不填，以后让 AI 帮你起。</li><li><b>第二步 · 写大纲</b>：新建章节，在「📋 本章大纲」框里用大白话写下这一章要发生什么。</li><li><b>第三步 · 开始创作</b>：点「🚀 开始创作」，晓星会自动联网学习文风、拟写细纲并把正文流式写进下面的大框。不满意就点「🔄 重新生成」。</li></ul><h3>💡 常见问题</h3><ul><li><b>正文写到哪了？</b>直接出现在大纲下方的大白框里，并自动保存在您的电脑上。</li><li><b>想并排看大纲和正文？</b>点大纲栏右上角的「⇋」按钮，或「⚙ 设置 → 界面样式」选「一半大纲 · 一半正文」。</li><li><b>AI 写得不像我？</b>到「设定 → 作家文风库」选参考作家；或「设定 → 我的文风」贴上自己写的 500 字，AI 就学你的习惯。</li><li><b>想换字体、背景、主题色？</b>都在「⚙ 设置」里，背景还有太阳系 / 银河系 / 星球可选。</li><li><b>怕数据丢？</b>「⚙ 设置 → 备份与导出」随时导出备份文件。</li><li><b>还有问题？</b>「⚙ 设置 → 问题反馈」，我们会认真看每一条。</li></ul>',
    'toast.titlesGen': '正在生成候选名…', 'toast.titlesEmpty': '未能生成候选名，请重试',
    'toast.titleApplied': '已采用该名称', 'toast.titleNeedInput': '请先填写简介或本章大纲',
    'toast.planChanged': '试运营期间免费开通成功：{p}',
    'toast.storageOk': '已授权本地存储，作品将自动保存到您的设备', 'toast.storageNo': '已拒绝存储：内容仅在本次会话内有效',
    'vip.freeBtn': '当前方案',
    'vip.searchTitle': '🔍 全网搜索 AI 模型', 'vip.searchPh': '输入关键词搜索全网模型（如 deepseek / qwen / llama…）',
    'vip.searchBtn': '搜索', 'vip.searching': '正在全网搜索模型…', 'vip.searchFail': '模型搜索失败，请稍后重试',
    'vip.searchEmpty': '未找到匹配的模型', 'vip.copy': '复制模型名', 'vip.copied': '已复制模型名',
    'aiset.compare': '模型适配对比（已适配主流 AI）',
    'aiset.stFree': '免费 · 免密钥 · 已适配', 'aiset.stFreeTier': '有免费额度 · 需 Key · 已适配',
    'aiset.stPaid': '付费 · 需 Key · 已适配（会员可协助接入）',
    'aiset.auto': '自动切换备用模型（当前模型失败时自动换下一个可用模型）',
    'w.myStyle': '我的文风（可选）', 'w.styleModeAuthor': '使用作家文风', 'w.styleModeMine': '使用我的文风',
    'w.styleSample': '把我的 500 字文风样本贴在这里，AI 会学习你的句式节奏、用词习惯与对话风格',
    'w.styleSamplePh': '粘贴一段你自己的文字（500 字以内）…',
    'toast.styleSaved': '文风设置已保存', 'toast.orCopied': '已复制模型名',
    'sp.pickTip': '点击下方作家即可选为参考（可多选，选中后再点一次取消）。「联网学习」会抓取维基百科研究其写作技法；找不到喜欢的作家？用搜索框全网添加。',
    'sp.mineTip': '把你的 500 字文风样本贴在下面：AI 将学习你的句式节奏、用词习惯与对话风格，之后生成的内容会更像你本人写的。',
    'sp.filterPh': '筛选作家…'
  },
  en: {
    'brand.sub': 'ALL-GENRE NOVEL STUDIO',
    'btn.langTitle': 'Switch language / 切换语言',
    'btn.backup': '⛁ Backup', 'btn.backupTitle': 'Backup & Export',
    'btn.ai': '⚙ AI Models', 'btn.aiTitle': 'AI model settings',
    'btn.profileTitle': 'Profile (avatar / nickname)',
    'profile.default': 'No nickname',
    'nav.chapters': 'Chapters', 'nav.outline': 'Outline', 'nav.characters': 'Characters', 'nav.style': 'Style', 'nav.world': 'World', 'nav.memories': 'Memory',
    'btn.dict': '📖 Dictionary', 'btn.dictTitle': 'English dictionary (opens with selected text)',
    'btn.focus': '⛶ Focus', 'btn.focusExit': '⛶ Exit focus',
    'btn.aiToggle': '✦ AI Engine',
    'status.draft': 'Draft', 'status.revising': 'Revising', 'status.done': 'Final',
    'ai.title': '✦ Story Engine', 'ai.clearTitle': 'Clear chat',
    'ai.ctx': 'Context · Memory scope',
    'ctx.outline': 'Outline', 'ctx.chars': 'Characters', 'ctx.world': 'World', 'ctx.mem': 'Memory', 'ctx.chatHistory': 'Chat history', 'ctx.prev': 'Prev chapters',
    'chip.continue': '▶ Continue', 'chip.plot': '⛨ Plot ideas', 'chip.brainstorm': '✦ Brainstorm', 'chip.polish': '✎ Polish',
    'chip.extract': '◬ Extract memory', 'chip.outline': '◈ Draft outline', 'chip.style': '✧ Style check',
    'ai.send': 'Send', 'ai.stop': '■ Stop',
    'lib.title': '◈ Library', 'lib.new': '＋ New Novel',
    'novel.title': 'Title', 'novel.descLabel': 'Synopsis (auto-referenced by AI & memory)',
    'style.audience': 'Audience', 'style.genres': 'Genres (multi)', 'style.length': 'Length', 'style.pov': 'POV', 'style.tone': 'Tone',
    'style.lang': 'Language', 'style.authors': 'Reference authors (recommended)', 'style.learn': '⛁ Learn styles online',
    'aiset.title': '⚙ AI Model Access', 'aiset.list': 'Connected models', 'aiset.add': '＋ Add model', 'aiset.accent': 'Accent color',
    'aiset.config': 'Model config', 'aiset.preset': 'Preset (quick fill)', 'aiset.name': 'Display name',
    'aiset.base': 'Base URL (usually ends with /v1)', 'aiset.path': 'API path (default /chat/completions)', 'aiset.key': 'API Key', 'aiset.model': 'Model name',
    'aiset.temp': 'Temperature', 'aiset.maxtok': 'Max output tokens', 'aiset.test': 'Test connection', 'aiset.save': 'Save & enable',
    'aiset.help': '<b>How to connect?</b><p>Any OpenAI-compatible API works. Cloud models need a Base URL + API key; local open-source models (Ollama / LM Studio / vLLM / llama.cpp) need only the local address, key left empty.</p><p><b>Free model built in</b>: Pollinations AI — no key, no signup, works out of the box. Free quota is limited and may throttle at peak hours; for speed and stability, pick DeepSeek / Kimi from the presets and add your own key.</p><p>Ollama needs CORS enabled: set <code>OLLAMA_ORIGINS=*</code> and restart; or run <code>node proxy.mjs</code> and use Base URL <code>http://localhost:8787/v1</code>.</p><p>If a cloud API is blocked by the browser CORS policy, use the proxy too: <code>node proxy.mjs 8787 https://api.deepseek.com</code>.</p>',
    'backup.title': '⛁ Backup & Export', 'backup.desc': 'All data is stored in your local browser (IndexedDB). Clearing browser data erases it — back up regularly. No word limit per chapter or per book.',
    'backup.txt': 'Export current novel as TXT', 'backup.txtSub': 'All chapters merged in order as plain text',
    'backup.json': 'Back up all data as JSON', 'backup.jsonSub': 'Library, chapters, outline, characters, world, memory, chats',
    'backup.import': 'Import JSON backup', 'backup.importSub': 'Will overwrite all current data', 'backup.importBtn': 'Import',
    'backup.wipe': 'Wipe all data', 'backup.wipeSub': 'Cannot be undone!', 'backup.wipeBtn': 'Wipe',
    'backup.backupBtn': 'Back up',
    'note.title': 'Title', 'note.content': 'Content', 'note.cat': 'Category',
    'cat.plot': 'Plot', 'cat.char': 'Character', 'cat.foreshadow': 'Foreshadow', 'cat.world': 'World', 'cat.other': 'Other',
    'char.title': '♜ Character Card', 'char.name': 'Name', 'char.role': 'Role', 'char.appearance': 'Appearance', 'char.personality': 'Personality',
    'char.background': 'Background', 'char.relations': 'Relations', 'char.notes': 'Notes / foreshadowing',
    'profile.title': '👤 Profile', 'profile.nick': 'Nickname', 'profile.upload': '📷 Upload avatar', 'profile.clear': 'Reset default', 'profile.pick': 'Pick an avatar',
    'dict.title': '📖 Dictionary', 'dict.search': 'Search',
    'dict.ph': 'Type an English word… (opens with selected text)',
    'common.save': 'Save', 'common.cancel': 'Cancel', 'common.close': 'Close', 'common.confirm': 'OK', 'common.delete': 'Delete', 'common.export': 'Export',
    'w.title': 'Title', 'w.genre': 'Genres', 'w.audience': 'Audience', 'w.length': 'Length', 'w.pov': 'POV', 'w.tone': 'Tone', 'w.lang': 'Language', 'w.authors': 'Authors',
    'w.edit': '✎ Edit style table', 'w.synopsis': 'SYNOPSIS', 'w.world': 'WORLDVIEW', 'w.custom': 'Custom sections', 'w.addSec': '＋ Add section',
    'w.authorLib': 'AUTHOR STYLE LAB', 'w.authorTip': 'Click an author to toggle reference. “Learn styles online” fetches Wikipedia entries to study their craft; the notes are injected into the AI context.',
    'w.learn': '⛁ Learn styles online', 'w.learnSel': '⛁ Learn styles online ({n} selected)', 'w.builtin': 'Built-in craft notes', 'w.wiki': 'Online study (Wikipedia)',
    'w.learnOk': 'Style learning done: {ok}/{n} succeeded', 'w.learnFail': 'Style learning failed (check network)', 'w.learnPartial': 'Style learning: {ok} ok / {fail} failed',
    'stat.words': 'CJK {a} · EN words {b}', 'stat.pos': 'Ln {a} · Col {b}', 'stat.chars': 'Chars {a}', 'stat.wordsChip': 'words',
    'dict.loading': 'Looking up…', 'dict.notfound': 'No definition found. Check the spelling or try another word.',
    'dict.errNet': 'Dictionary request failed — network issue? (This API needs internet.)', 'dict.syn': 'Synonyms', 'dict.src': 'Source: dictionaryapi.dev · Datamuse',
    'toast.welcome': 'Welcome to XIAOXING! Create a novel first, then connect your model via “⚙ AI Models”.',
    'toast.saved': 'Saved', 'toast.savedOk': 'Saved', 'toast.needNovel': 'Create a novel first', 'toast.needNovelSel': 'Select a novel first',
    'toast.noChapters': 'No chapters yet', 'toast.txtOk': 'TXT exported', 'toast.backupOk': 'Backup done', 'toast.importOk': 'Import done',
    'toast.importFail': 'Import failed: ', 'toast.wiped': 'All data cleared', 'toast.chapterDel': 'Chapter deleted',
    'toast.chapterFromNode': 'Chapter created from outline node', 'toast.outlineDel': 'Outline node deleted',
    'toast.charSaved': 'Character saved', 'toast.memSaved': 'Saved', 'toast.novelSaved': 'Novel saved', 'toast.novelDel': 'Novel deleted',
    'toast.needTitle': 'Enter a title', 'toast.needNodeTitle': 'Enter a title', 'toast.needContent': 'Content required', 'toast.needName': 'Enter a name',
    'toast.noAI': 'No AI model configured', 'toast.aiBusy': 'AI is generating…',
    'toast.needChapter': 'Create and open a chapter first', 'toast.needChapterOpen': 'Open a chapter first',
    'toast.nothingPolish': 'Nothing to polish', 'toast.inserted': 'Inserted into chapter', 'toast.memAdded': '{n} memories saved',
    'toast.copied': 'Copied to clipboard', 'toast.copyFail': 'Copy failed', 'toast.chatClear': 'Chat cleared',
    'toast.providerSaved': 'Model saved & enabled', 'toast.providerDel': 'Model config deleted', 'toast.providerFill': 'Fill in Base URL and model name',
    'toast.providerPick': 'Select a model on the left, or just click “Save & enable”', 'toast.profileSaved': 'Profile saved',
    'toast.avatarTooBig': 'Image too large (max 2MB)', 'toast.avatarBad': 'Cannot read this image',
    'toast.dictNeedWord': 'Type an English word to look up', 'toast.memDeleted': 'Memory entry deleted',
    'toast.learnBusy': 'Learning styles online, please wait…',
    'toast.langHint': 'Interface language switched', 'toast.nickSave': 'Nickname saved',
    'empty.panel': 'Click the title on top<br/>to create / select a novel.',
    'empty.chapters': 'No chapters yet.<br/>Click “＋ New Chapter” to start writing,<br/>or plan in “Outline” first.',
    'empty.outline': 'No outline yet.<br/>Click “＋ New Volume” to create volumes,<br/>then add chapter nodes.<br/><br/>The AI engine references the outline automatically.',
    'empty.chars': 'No character cards.<br/>AI remembers character settings automatically<br/>to keep them consistent.',
    'empty.mem': 'No memory entries.<br/>Add manually, or use “◬ Extract memory” in the AI engine.',
    'empty.chat': '✦ Story engine ready (free model auto-connected)<br/>Continue / plot via the quick actions above,<br/>or just talk to the AI.',
    'empty.lib': 'The galaxy is quiet — no novels yet. Click “＋ New Novel” below.',
    'empty.volKids': 'No nodes. Click “＋ Node” below.',
    'editor.placeholder.zh': 'A new chapter begins here… (Ctrl+S to save · ✦ AI engine on the right)',
    'editor.placeholder.en': 'A new chapter begins here… (Ctrl+S to save · ✦ AI engine on the right)',
    'editor.noChapter': 'No chapter open. Create one in the “Chapters” panel, or pick a novel from the top title.',
    'ai.inputPh': 'Discuss the plot, let it memorize settings, or give commands… (Ctrl+Enter to send)',
    'ai.modelNone': 'No model configured', 'ai.you': 'You', 'ai.engine': '✦ Engine',
    'novel.new': 'New Novel', 'novel.edit': 'Edit Novel',
    'confirm.delChapter': 'Delete this chapter? Its text cannot be recovered.',
    'confirm.delOutline': 'Delete this outline node? Its children will be deleted too.',
    'confirm.delChar': 'Delete this character card?', 'confirm.delMem': 'Delete this memory entry?',
    'confirm.delNovel': 'Delete “{t}” and all its chapters, outline, characters, world & memories? This cannot be undone.',
    'confirm.delProvider': 'Delete this model config?',
    'confirm.wipe': 'Wipe ALL data? Every novel, chapter, outline, character and memory will be permanently deleted!',
    'confirm.import': 'Importing will overwrite all current data (library / chapters / outline / characters / memory / chats). Continue?',
    'dict.provOk': '✓ Connected: ', 'dict.provFail': 'Connection failed: ',
    'learn.fetching': 'Studying {name}…', 'learn.noSel': 'Select reference authors above first',
    'w.noAuthors': 'No reference authors selected. Click the author chips above, then learn their craft online.',
    'novel.legacyGenre': 'Uncategorized',
    'terms.title': '📜 User Notice & Code of Conduct',
    'terms.noticeTitle': 'I. User Notice',
    'terms.notice': '<ul><li><b>Local storage</b>: your novels, outlines, characters and memories are stored only in your own browser (IndexedDB). This tool does not collect or upload any of your content. Clearing browser data erases your work — back up regularly via “⛁ Backup”.</li><li><b>AI access</b>: the AI engine requires you to connect your own model (cloud API or local open-source model). Your API key stays on this device and is only sent to the endpoint you configure.</li><li><b>Online features</b>: “Learn styles online” and the English dictionary query public APIs (Wikipedia, dictionary services) for lookup only; none of your content is uploaded.</li><li><b>Responsibility</b>: this tool is free and provided without warranty. Review AI-generated content for accuracy, copyright and compliance; you are fully responsible for what you publish.</li><li><b>Minors</b>: use under guardian supervision.</li></ul>',
    'terms.rulesTitle': 'II. Code of Conduct',
    'terms.rules': '<ul><li>Do not generate or spread illegal content, including but not limited to: pornography, violence & terror, hate speech & discrimination, privacy violations, fraud & disinformation, or content endangering national security.</li><li>Respect intellectual property: reference authors are for learning <b>craft</b> only. Plagiarism, rewording others\' works, or republishing others\' works without permission is forbidden.</li><li>Comply with the terms of your AI provider and local laws.</li><li>Do not abuse the online features or third-party APIs (scraping, bulk attacks, etc.).</li><li>Create with respect: do not produce defamatory, insulting or deepfake content targeting real people.</li><li>Violators bear full legal responsibility; XIAOXING reserves the right to refuse service and pursue liability.</li></ul>',
    'terms.version': 'Version 2025-01 · XIAOXING',
    'terms.agreeLabel': 'I have read and agree to all of the above',
    'terms.agreeBtn': 'Agree & Enter',
    'terms.declineBtn': 'Decline',
    'terms.declined': 'You must agree to the notice & code of conduct to continue.',
    'profile.terms': '📜 User Notice',
    'btn.vip': '💎 VIP', 'btn.vipTitle': 'Membership (beta · free)',
    'btn.feedback': '💬 Feedback', 'btn.feedbackTitle': 'Feedback',
    'co.label': '📋 Chapter Outline',
    'co.gen': '⚡ Generate Online', 'co.again': '🔄 Regenerate',
    'co.ph': 'Type the chapter outline: what happens, which characters appear, what foreshadowing to plant… then click “⚡ Generate Online”',
    'co.needChapter': 'Create and open a chapter first', 'co.needOutline': 'Fill in the chapter outline first',
    'co.confirmOverwrite': 'This chapter already has content. Generating will overwrite it. Continue?',
    'co.done': '✓ Done — click “🔄 Regenerate” if not satisfied', 'co.cancelled': 'Generation cancelled',
    'co.running': 'Generating…',
    'gp.title': '⚡ Online Generation',
    'gp.search': 'Searching authors', 'gp.style': 'Studying author styles', 'gp.draft': 'Drafting the chapter', 'gp.write': 'Writing the chapter',
    'gp.cancelTitle': 'Cancel',
    'au.label': 'Custom authors', 'au.ph': 'Type an author name to search & add online…',
    'au.search': '🔍 Search & Add', 'au.needName': 'Enter an author name', 'au.searching': 'Searching online…',
    'au.notfound': 'Author not found — try another name', 'au.added': 'Added as reference: {name}', 'au.fail': 'Search failed — check network and retry',
    'au.custom': 'Custom', 'au.del': 'Delete this custom author?',
    'fb.title': '💬 Feedback', 'fb.label': 'Issue or suggestion',
    'fb.ph': 'Describe the issue or your suggestion…', 'fb.hint': 'We read every piece of feedback.',
    'fb.send': 'Submit', 'fb.thanks': 'Thank you for your feedback', 'fb.fail': 'Failed to submit, try again later', 'fb.needMsg': 'Please write something first',
    'vip.title': '💎 Membership', 'vip.notice': 'Beta · Free',
    'vip.free': 'Free', 'vip.freePrice': '¥0 · beta', 'vip.currentBtn': 'Current plan',
    'vip.f1': 'Built-in free AI model', 'vip.f2': 'All creative features', 'vip.f3': 'Local data storage',
    'vip.pro': 'Pro', 'vip.proPrice': '¥0 · beta',
    'vip.p1': 'Better LLMs', 'vip.p2': 'Longer context memory', 'vip.p3': 'Faster generation',
    'vip.flag': 'Flagship', 'vip.flagPrice': '¥0 · beta',
    'vip.l1': 'All Pro benefits', 'vip.l2': 'Early access to new models', 'vip.l3': 'Dedicated support',
    'vip.btn': 'Coming soon', 'vip.btnToast': 'Free during beta — stay tuned',
    'vip.foot': 'All plans are free during the beta period.',
    'btn.settings': '⚙ Settings', 'btn.settingsTitle': 'Settings',
    'co.layout': 'Layout', 'co.layoutToggleTitle': 'Toggle layout: stacked / split',
    'set.title': '⚙ Settings', 'set.ui': 'Interface', 'set.font': 'Font size', 'set.layout': 'Layout',
    'set.stack': 'Compact outline · Full text', 'set.split': 'Half outline · Half text',
    'set.aipanel': 'AI Engine panel', 'set.on': 'On', 'set.off': 'Off', 'set.accent': 'Accent',
    'set.account': 'Account', 'set.editProfile': 'Edit avatar & nickname',
    'set.lang': 'Language',
    'set.general': 'General', 'set.backup': '⛁ Backup & Export', 'set.ai': '⚙ AI Models',
    'set.feedback': '💬 Feedback', 'set.terms': '📜 User Notice',
    'set.about': 'Version', 'set.version': 'Current version', 'set.check': 'Check update',
    'set.upToDate': 'Up to date ({v})', 'set.updateFound': 'New version {v} available — press Ctrl+F5',
    'set.updateFail': 'Update check failed — check network',
    'co.gen': '🚀 Start Writing', 'co.chapterTitle': 'AI chapter title (from this chapter outline)',
    'novel.title': 'Title (optional — AI can infer later)', 'novel.titlePh': 'Leave blank (TBD)…',
    'novel.titleSuggest': '✨ AI Title Ideas', 'novel.titleSuggestHint': 'Leave the title blank — write a synopsis, then let AI infer several candidates for you to pick.',
    'novel.pending': 'Untitled',
    'style.narrative': 'Narration', 'style.dialogue': 'Dialogue-first', 'style.balanced': 'Balanced', 'style.narrativeMode': 'Narrative-first',
    'storage.title': '💾 Storage Permission',
    'storage.desc': '<p>XIAOXING needs to save your <b>novels, outlines, characters and memories</b> in <b>your own device\'s browser storage</b> (IndexedDB) for autosave and future sessions. Nothing is uploaded to any server.</p><p>If you agree, your work autosaves. If you decline, <b>nothing will be saved</b> and it may be lost when you close the page.</p>',
    'storage.allow': 'Allow & Save', 'storage.deny': 'Decline',
    'storage.warn': '⚠ Local storage not authorized: your work will NOT be saved. Re-authorize in “⚙ Settings → Storage”.',
    'set.storage': '💾 Storage', 'set.storageState': 'Storage status',
    'set.storageOk': 'Authorized (autosaves locally)', 'set.storageNo': 'Not authorized (nothing saved)',
    'set.bg': 'Background', 'set.pet': 'Writing buddy',
    'asst.title': '🛸 Writing Buddy', 'asst.petTitle': 'Click me — open the buddy', 'asst.hide': '🙈 Hide buddy',
    'asst.a1': '＋ New novel', 'asst.a2': '🚀 Start writing', 'asst.a3': '✨ AI titles', 'asst.a4': '⚙ Settings', 'asst.a5': '💬 Feedback',
    'asst.guide': '<h3>🚀 Three steps to start</h3><ul><li><b>Step 1 · Create a novel</b>: click “＋ New Novel” and pick the style table. The title can wait — AI will suggest one later.</li><li><b>Step 2 · Write the outline</b>: open a chapter and describe in plain words what happens in the “📋 Chapter Outline” box.</li><li><b>Step 3 · Start writing</b>: click “🚀 Start Writing”. XIAOXING studies styles online, drafts a plan and streams the text into the big box below. Not happy? Click “🔄 Regenerate”.</li></ul><h3>💡 FAQ</h3><ul><li><b>Where does my text go?</b> Straight into the big box below the outline, autosaved on your device.</li><li><b>Want outline and text side by side?</b> Click “⇋” on the outline bar, or “⚙ Settings → Layout → Half outline · Half text”.</li><li><b>AI doesn\'t sound like me?</b> “World → Author Style Lab” to pick reference authors, or paste your own 500-word sample in “World → My Style”.</li><li><b>Font, background, theme color?</b> All in “⚙ Settings” — backgrounds include Solar System, Galaxy and Planet views.</li><li><b>Worried about losing data?</b> “⚙ Settings → Backup & Export” anytime.</li><li><b>Still stuck?</b> “⚙ Settings → Feedback” — we read every message.</li></ul>',
    'toast.titlesGen': 'Generating title ideas…', 'toast.titlesEmpty': 'No titles generated — try again',
    'toast.titleApplied': 'Title applied', 'toast.titleNeedInput': 'Fill in the synopsis or chapter outline first',
    'toast.planChanged': 'Free upgrade during beta: {p}',
    'toast.storageOk': 'Storage authorized — your work autosaves on this device', 'toast.storageNo': 'Storage declined: content lasts this session only',
    'vip.freeBtn': 'Current plan',
    'vip.searchTitle': '🔍 Search AI models worldwide', 'vip.searchPh': 'Type a keyword (deepseek / qwen / llama…)',
    'vip.searchBtn': 'Search', 'vip.searching': 'Searching models…', 'vip.searchFail': 'Model search failed — try later',
    'vip.searchEmpty': 'No matching models', 'vip.copy': 'Copy model ID', 'vip.copied': 'Model ID copied',
    'aiset.compare': 'Model compatibility (mainstream AIs adapted)',
    'aiset.stFree': 'Free · no key · adapted', 'aiset.stFreeTier': 'Free tier · needs key · adapted',
    'aiset.stPaid': 'Paid · needs key · adapted (VIP assists)',
    'aiset.auto': 'Auto-switch backup models (on failure, try the next available model)',
    'w.myStyle': 'My Style (optional)', 'w.styleModeAuthor': 'Use author styles', 'w.styleModeMine': 'Use my style',
    'w.styleSample': 'Paste a sample of your own writing (≤500 characters) — AI learns your rhythm, word choices and dialogue style',
    'w.styleSamplePh': 'Paste your own text (≤500 chars)…',
    'toast.styleSaved': 'Style setting saved', 'toast.orCopied': 'Model ID copied',
    'sp.pickTip': 'Click an author to add them as a reference (click again to remove). “Learn styles online” fetches Wikipedia to study their craft. Can\'t find your favorite? Use the search box to add any author from the web.',
    'sp.mineTip': 'Paste a sample of your own writing (≤500 characters): the AI will learn your rhythm, word choices and dialogue style, so the output sounds more like you.',
    'sp.filterPh': 'Filter authors…'
  }
};
function t(k, vars) {
  const dict = I18N[state.settings.lang] || I18N.zh;
  let s = dict[k] !== undefined ? dict[k] : (I18N.zh[k] !== undefined ? I18N.zh[k] : k);
  if (vars) for (const key of Object.keys(vars)) s = s.split('{' + key + '}').join(vars[key]);
  return s;
}
function applyI18n() {
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  $$('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  $('#ai-input').placeholder = t('ai.inputPh');
  $('#btn-focus').textContent = t(document.body.classList.contains('focus-mode') ? 'btn.focusExit' : 'btn.focus');
  renderEditorPlaceholder();
  if (state.module === 'world' && curNovel()) renderPanel();
}

/* ---------------- 常量 ---------------- */
const GENRES = ['科幻', '玄幻', '奇幻', '都市', '悬疑', '推理', '恐怖', '历史', '军事', '武侠', '仙侠', '修真', '游戏', '体育', '轻小说', '同人', '言情', '无限流', '克苏鲁', '赛博朋克', '废土', '太空歌剧', '蒸汽朋克', '群像', '单元剧'];
const PALETTE = ['#00e0ff', '#7c5cff', '#ff4fd8', '#3ddc97', '#ffb454', '#4da6ff'];
const ACCENTS = { cyan: '#00e0ff', magenta: '#ff4fd8', green: '#3ddc97', gold: '#ffb454' };
const AVATAR_PRESETS = [
  ['✨', 'linear-gradient(135deg,#00e0ff,#7c5cff)'], ['⭐', 'linear-gradient(135deg,#ffb454,#ff4fd8)'],
  ['🌙', 'linear-gradient(135deg,#7c5cff,#2a1e5c)'], ['☄️', 'linear-gradient(135deg,#4da6ff,#00e0ff)'],
  ['🪐', 'linear-gradient(135deg,#ff9a5c,#7c5cff)'], ['🚀', 'linear-gradient(135deg,#ff4fd8,#7c5cff)'],
  ['🐉', 'linear-gradient(135deg,#3ddc97,#00e0ff)'], ['📖', 'linear-gradient(135deg,#ffb454,#ff6b6b)'],
  ['🦋', 'linear-gradient(135deg,#b98cff,#ff4fd8)'], ['⚡', 'linear-gradient(135deg,#ffd75c,#ff9a5c)'],
  ['🌌', 'linear-gradient(135deg,#1c2b45,#7c5cff)'], ['💫', 'linear-gradient(135deg,#00e0ff,#ff4fd8)']
];
const AUTHORS = [
  { id: 'luxun', name: '鲁迅', wiki: '鲁迅', tips: '白描与讽刺并用，语言凝练犀利；善用细节刻画人物，冷峻中见悲悯。' },
  { id: 'laoshe', name: '老舍', wiki: '老舍', tips: '京味儿口语，幽默与悲悯并存；写市井小人物，对话鲜活接地气。' },
  { id: 'shencongwen', name: '沈从文', wiki: '沈从文', tips: '湘西风情，诗意田园；文字纯净淡远，以景物烘托人性之美。' },
  { id: 'zhangailing', name: '张爱玲', wiki: '张爱玲', tips: '比喻精妙奇崛，笔调苍凉华丽；长于心理刻画与都市人情。' },
  { id: 'wangzengqi', name: '汪曾祺', wiki: '汪曾祺', tips: '白描见长，散文化语言；写吃食与生活细节，平淡中见滋味。' },
  { id: 'yuhua', name: '余华', wiki: '余华', tips: '冷峻白描、短句推进；克制叙述与巨大苦难的反差，黑色幽默。' },
  { id: 'moyan', name: '莫言', wiki: '莫言', tips: '魔幻现实主义，乡土意象密集；感官描写轰炸，结构大开大合。' },
  { id: 'wangxiaobo', name: '王小波', wiki: '王小波', tips: '幽默反讽与思辨并重；黑色幽默消解宏大叙事，语言自由不羁。' },
  { id: 'jinyong', name: '金庸', wiki: '金庸', tips: '章回体结构，人物群像丰满；武功意境与家国历史融合，悬念勾连。' },
  { id: 'gulong', name: '古龙', wiki: '古龙', tips: '短句分行、留白与悬念；写意式武打与人物孤绝气质，金句频出。' },
  { id: 'liucixin', name: '刘慈欣', wiki: '刘慈欣', tips: '宏大尺度想象与硬科幻细节；冷静克制的叙述托举宇宙级浪漫。' },
  { id: 'wangjinkang', name: '王晋康', wiki: '王晋康', tips: '哲理科幻，思辨深刻；以科技伦理冲突驱动故事。' },
  { id: 'hexi', name: '何夕', wiki: '何夕', tips: '软科幻温情路线；情感细腻，科幻设定服务人性主题。' },
  { id: 'hansong', name: '韩松', wiki: '韩松', tips: '诡异冷峻的科幻意象，后现代叙事，反乌托邦气质。' },
  { id: 'jiangnan', name: '江南', wiki: '江南_(作家)', tips: '少年意气与悲剧美学；华丽意象、细腻心理，热血与怅惘交织。' },
  { id: 'maboyong', name: '马伯庸', wiki: '马伯庸', tips: '考据式脑洞，从历史缝隙生发故事；节奏快，幽默与紧张并重。' },
  { id: 'maoni', name: '猫腻', wiki: '猫腻_(作家)', tips: '文青气息，伏笔绵长；人物有理想主义弧光，群像鲜活。' },
  { id: 'priest', name: 'Priest', wiki: 'Priest_(作家)', tips: '强逻辑强情节，双强人设；金句与留白，节奏张弛有度。' },
  { id: 'tiancantudou', name: '天蚕土豆', wiki: '天蚕土豆', tips: '爽点密度高，升级体系清晰；热血与压迫感交替，节奏紧凑。' },
  { id: 'tangsanshao', name: '唐家三少', wiki: '唐家三少', tips: '正能量热血，感情线贯穿；稳定叙事节奏，通俗易懂。' },
  { id: 'tianxiabachang', name: '天下霸唱', wiki: '天下霸唱', tips: '民俗志怪与悬疑探险；第一人称代入感强，氛围阴森奇诡。' },
  { id: 'nanpaisanshu', name: '南派三叔', wiki: '南派三叔', tips: '笔记体叙事，悬念钩子密集；人物羁绊动人，层层设局。' },
  { id: 'jkrowling', name: 'J.K.罗琳', wiki: 'J.K.罗琳', tips: '伏笔布局绵密，成长主题清晰；儿童视角的天真与黑暗并置。' },
  { id: 'keigo', name: '东野圭吾', wiki: '东野圭吾', tips: '社会派推理，反转凌厉；以案件写人性，情感冲击强。' },
  { id: 'agatha', name: '阿加莎·克里斯蒂', wiki: '阿加莎·克里斯蒂', tips: '本格推理结构精巧，线索公平；封闭场景与多重嫌疑人。' },
  { id: 'hemingway', name: '海明威', wiki: '欧内斯特·海明威', tips: '冰山理论，对话简洁有力；删繁就简，动作描写硬朗。' },
  { id: 'tolkien', name: '托尔金', wiki: 'J·R·R·托尔金', tips: '世界观建构登峰造极；史诗感、语言美感与神话体系。' }
];
const PRESETS = [
  { name: 'Pollinations AI（免费·免密钥·开箱即用）', baseUrl: 'https://text.pollinations.ai', path: '/openai', model: 'openai', plan: 'free' },
  { name: '硅基流动 SiliconFlow（免费额度）', baseUrl: 'https://api.siliconflow.cn/v1', path: '/chat/completions', model: 'deepseek-ai/DeepSeek-V3', plan: 'free' },
  { name: 'Ollama（本地开源）', baseUrl: 'http://localhost:11434/v1', path: '/chat/completions', model: 'qwen2.5:14b', plan: 'free' },
  { name: 'LM Studio（本地开源）', baseUrl: 'http://localhost:1234/v1', path: '/chat/completions', model: 'local-model', plan: 'free' },
  { name: 'vLLM / llama.cpp（本地开源）', baseUrl: 'http://localhost:8000/v1', path: '/chat/completions', model: '', plan: 'free' },
  { name: 'DeepSeek 深度求索', baseUrl: 'https://api.deepseek.com/v1', path: '/chat/completions', model: 'deepseek-chat', plan: 'pro' },
  { name: 'Moonshot Kimi', baseUrl: 'https://api.moonshot.cn/v1', path: '/chat/completions', model: 'moonshot-v1-32k', plan: 'pro' },
  { name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', path: '/chat/completions', model: 'glm-4-air', plan: 'pro' },
  { name: '通义千问 DashScope', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', path: '/chat/completions', model: 'qwen-plus', plan: 'pro' },
  { name: '火山方舟 Doubao', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', path: '/chat/completions', model: 'doubao-pro-32k', plan: 'pro' },
  { name: '讯飞星火 Spark', baseUrl: 'https://spark-api-open.xf-yun.com/v1', path: '/chat/completions', model: 'generalv3.5', plan: 'pro' },
  { name: 'Google Gemini（OpenAI 兼容）', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', path: '/chat/completions', model: 'gemini-2.0-flash', plan: 'pro' },
  { name: 'Groq（极速推理）', baseUrl: 'https://api.groq.com/openai/v1', path: '/chat/completions', model: 'llama-3.3-70b-versatile', plan: 'pro' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', path: '/chat/completions', model: 'gpt-4o-mini', plan: 'flag' },
  { name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', path: '/chat/completions', model: 'mistral-small-latest', plan: 'flag' },
  { name: 'OpenRouter（全模型聚合）', baseUrl: 'https://openrouter.ai/api/v1', path: '/chat/completions', model: 'deepseek/deepseek-chat', plan: 'flag' },
  { name: '自定义', baseUrl: '', path: '/chat/completions', model: '', plan: 'free' }
];
const SYSTEM_PROMPT = [
  '你是「晓星 XIAOXING」的内置剧情引擎，一位精通全类型小说（玄幻、科幻、都市、悬疑、言情、历史、轻小说等）的资深作家与策划。职责：讨论剧情、续写正文、推演走向、润色文笔、提取记忆、规划大纲、诊断文风。',
  '规则：',
  '1. 默认使用中文交流（用户使用其他语言时跟随用户语言）。',
  '2. 用户消息中会携带【小说信息】【风格档案】【大纲】【角色卡】【世界观】【记忆库】【参考作家技法】【前文章节】等上下文，这是你对这部小说的全部记忆，请始终以此为依据，保持人物、设定、伏笔一致。',
  '3. 被要求「续写」时，只输出小说正文，不要任何解释、标题或前言。',
  '4. 被要求「提取记忆」时，只输出 JSON 数组，不要任何其他内容。',
  '5. 回答可用 Markdown 排版；剧情建议要具体、可执行。',
  '6. 永远尊重用户创意，可大胆提出构思，但不擅自删除设定。',
  '7. 文笔要求（非常重要）：像人类作家一样写作——句式长短交错，段落节奏有变化；避免连续段落用相同句式开头；少用「只见/顿时/不由得/心中一动」等套路词堆砌；对话口语化、符合人物身份与情绪；用具体细节与五感描写代替抽象概括；避免机械重复同一表达；情节推进自然，不硬凑。',
  '8. 若用户提供了参考作家：学习其写作技法（而非抄袭其句子或情节），结合本小说题材灵活运用，让文笔接地气、通人性。',
  '9. 若风格档案标注写作语言为英文，正文与润色请用地道自然的英文输出。'
].join('\n');

/* ---------------- 数据库 ---------------- */
const DB_NAME = 'nebula-novel-db', DB_VER = 1;
const STORE = { novels: 'novels', chapters: 'chapters', outline: 'outline', characters: 'characters', memories: 'memories', chats: 'chats' };
let db = null, dbMode = 'idb';

function idbOpen() {
  return new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('浏览器不支持 IndexedDB'));
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const s of Object.values(STORE)) {
        if (!d.objectStoreNames.contains(s)) {
          const st = d.createObjectStore(s, { keyPath: 'id' });
          st.createIndex('byNovel', 'novelId', { unique: false });
        }
      }
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
function lsKey(s) { return 'nebula-novel-' + s; }
const lsMem = {};
function lsLoad() { for (const s of Object.values(STORE)) { try { lsMem[s] = JSON.parse(localStorage.getItem(lsKey(s)) || '{}'); } catch (e) { lsMem[s] = {}; } } }
function lsSave(s) { try { localStorage.setItem(lsKey(s), JSON.stringify(lsMem[s])); } catch (e) { toast('本地存储空间不足！请立即导出备份。', 'err', 6000); } }

async function dbInit() {
  try { db = await idbOpen(); dbMode = 'idb'; }
  catch (e) { dbMode = 'ls'; lsLoad(); toast('已切换到 localStorage 存储模式（容量有限，建议定期备份）', 'warn', 5000); }
}
function dbPut(store, obj) {
  if (state.storageDenied) return Promise.resolve(obj);
  if (dbMode === 'idb') return new Promise((res, rej) => {
    const tr = db.transaction(store, 'readwrite');
    tr.objectStore(store).put(obj);
    tr.oncomplete = () => res(obj); tr.onerror = () => rej(tr.error);
  });
  lsMem[store][obj.id] = obj; lsSave(store); return Promise.resolve(obj);
}
function dbDel(store, id) {
  if (state.storageDenied) return Promise.resolve();
  if (dbMode === 'idb') return new Promise((res, rej) => {
    const tr = db.transaction(store, 'readwrite');
    tr.objectStore(store).delete(id);
    tr.oncomplete = () => res(); tr.onerror = () => rej(tr.error);
  });
  delete lsMem[store][id]; lsSave(store); return Promise.resolve();
}
function dbClear(store) {
  if (state.storageDenied) return Promise.resolve();
  if (dbMode === 'idb') return new Promise((res, rej) => {
    const tr = db.transaction(store, 'readwrite');
    tr.objectStore(store).clear();
    tr.oncomplete = () => res(); tr.onerror = () => rej(tr.error);
  });
  lsMem[store] = {}; lsSave(store); return Promise.resolve();
}
function dbGet(store, id) {
  if (dbMode === 'idb') return new Promise((res, rej) => {
    const tr = db.transaction(store);
    const rq = tr.objectStore(store).get(id);
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  });
  return Promise.resolve(lsMem[store][id] || null);
}
function dbAll(store) {
  if (dbMode === 'idb') return new Promise((res, rej) => {
    const tr = db.transaction(store);
    const rq = tr.objectStore(store).getAll();
    rq.onsuccess = () => res(rq.result || []); rq.onerror = () => rej(rq.error);
  });
  return Promise.resolve(Object.values(lsMem[store] || {}));
}

/* ---------------- 全局状态 ---------------- */
function defaultSettings() {
  return {
    providers: [], activeProviderId: null,
    fontSize: 18, accent: 'cyan', aiPanelOpen: true, lang: 'zh', layout: 'stack',
    bg: 'stars', petVisible: true, autoModel: true, plan: 'free', storageDenied: false,
    ctx: { outline: true, chars: true, world: true, mem: true, chatHistory: true, prevChapters: 2 },
    user: { nickname: '', avatarPreset: 0, avatarData: '' },
    customAuthors: []
  };
}
const APP_VERSION = '3.2.1';
const PLAN_LEVEL = { free: 0, pro: 1, flag: 2 };
const PLAN_PREV_MAX = { free: 2, pro: 5, flag: 10 };
const state = {
  novels: [], chapters: [], outline: [], characters: [], memories: [], chats: [],
  currentNovelId: null, currentChapterId: null,
  module: 'chapters', memFilter: '全部', authorFilter: '',
  settings: defaultSettings(),
  saveTimer: null, editorDirty: false, novelSaveTimer: null,
  chatForNovel: [],
  noteCtx: null, charEditingId: null, novelEditingId: null, provEditingId: null,
  styleDraft: null,
  confirmResolve: null,
  aiStreaming: false, aiAbort: null,
  wikiCache: {},
  learning: false,
  genState: { running: false, stageIdx: -1, abort: null }
};
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('nebula-settings'));
    if (s) state.settings = Object.assign(defaultSettings(), s, { user: Object.assign(defaultSettings().user, s.user || {}) });
  } catch (e) { }
}
function saveSettings() { localStorage.setItem('nebula-settings', JSON.stringify(state.settings)); }
function loadWikiCache() {
  try { state.wikiCache = JSON.parse(localStorage.getItem('nebula-wiki-cache') || '{}'); } catch (e) { state.wikiCache = {}; }
}
function saveWikiCache() { try { localStorage.setItem('nebula-wiki-cache', JSON.stringify(state.wikiCache)); } catch (e) { } }

const curNovel = () => state.novels.find(n => n.id === state.currentNovelId) || null;
const curChapter = () => state.chapters.find(c => c.id === state.currentChapterId) || null;
function chaptersOf(nid) { return state.chapters.filter(c => c.novelId === nid).sort((a, b) => a.order - b.order); }
const novelGenres = n => (Array.isArray(n.genres) && n.genres.length ? n.genres : (n.genre ? n.genre.split('、') : []));
const novelRefAuthors = n => (Array.isArray(n.refAuthors) ? n.refAuthors : []);
const allAuthors = () => AUTHORS.map(a => Object.assign({}, a, { custom: false })).concat((state.settings.customAuthors || []).map(a => Object.assign({}, a, { custom: true, wiki: a.wikiTitle || a.name })));
const findAuthor = id => allAuthors().find(a => a.id === id) || null;

/* ---------------- 数据加载 ---------------- */
async function loadAll() {
  const [novels, chapters, outline, characters, memories, chats] = await Promise.all([
    dbAll(STORE.novels), dbAll(STORE.chapters), dbAll(STORE.outline),
    dbAll(STORE.characters), dbAll(STORE.memories), dbAll(STORE.chats)
  ]);
  // 竞态保护：若加载尚未完成时用户已开始创作，则不用旧快照覆盖内存数据
  const fresh = state.novels.length === 0 && state.chapters.length === 0 &&
    state.outline.length === 0 && state.characters.length === 0 && state.memories.length === 0;
  if (!fresh) return;
  state.novels = novels.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  state.chapters = chapters; state.outline = outline;
  state.characters = characters; state.memories = memories; state.chats = chats;
  if (!state.novels.length) { state.currentNovelId = null; state.currentChapterId = null; state.chatForNovel = []; return; }
  if (!state.currentNovelId || !state.novels.find(n => n.id === state.currentNovelId)) state.currentNovelId = state.novels[0].id;
  const chs = chaptersOf(state.currentNovelId);
  if (!chs.find(c => c.id === state.currentChapterId)) state.currentChapterId = chs[0] ? chs[0].id : null;
  const rec = state.chats.find(c => c.id === state.currentNovelId);
  state.chatForNovel = rec ? (rec.messages || []) : [];
}
async function loadChatFor(nid) {
  if (!nid) { state.chatForNovel = []; return; }
  const rec = await dbGet(STORE.chats, nid);
  state.chatForNovel = rec ? (rec.messages || []) : [];
}
async function saveChat() {
  if (!state.currentNovelId) return;
  await dbPut(STORE.chats, { id: state.currentNovelId, novelId: state.currentNovelId, messages: state.chatForNovel.slice(-100) });
}

/* ---------------- 顶栏 ---------------- */
function renderTop() {
  const n = curNovel();
  $('#novel-pill-title').textContent = n ? (n.title || t('novel.pending')) : (state.settings.lang === 'zh' ? '未选择小说' : 'No novel selected');
  if (!n) { $('#stats').textContent = ''; renderProfileTop(); return; }
  const chs = chaptersOf(n.id);
  const total = chs.reduce((s, c) => s + (c.wordCount || 0), 0);
  $('#stats').textContent = chs.length + ' · ' + fmtNum(total) + ' ' + t('stat.wordsChip');
  renderProfileTop();
}
function renderModelTag() {
  const p = activeProvider();
  const el = $('#ai-model-tag');
  el.textContent = p ? (p.name + ' · ' + p.model) : t('ai.modelNone');
  el.classList.toggle('off', !p);
}
function renderProfileTop() {
  const u = state.settings.user || {};
  const av = $('#profile-avatar');
  av.innerHTML = u.avatarData ? '<img src="' + u.avatarData + '" alt="" />' : esc(AVATAR_PRESETS[u.avatarPreset || 0][0]);
  const name = $('#profile-name');
  name.textContent = u.nickname || t('profile.default');
}
function applyProfilePreview() {
  const u = state.settings.user || {};
  const pv = $('#profile-preview');
  pv.innerHTML = u.avatarData ? '<img src="' + u.avatarData + '" alt="" />' : esc(AVATAR_PRESETS[u.avatarPreset || 0][0]);
  renderAvatarGrid();
}
function renderAvatarGrid() {
  const grid = $('#avatar-grid');
  const u = state.settings.user || {};
  grid.innerHTML = AVATAR_PRESETS.map((p, i) =>
    `<button class="avatar-item ${!u.avatarData && (u.avatarPreset || 0) === i ? 'on' : ''}" data-idx="${i}" style="background:${p[1]}">${esc(p[0])}</button>`
  ).join('');
}

/* ---------------- 书库 ---------------- */
function renderLibrary() {
  const list = $('#library-list');
  list.innerHTML = state.novels.map(n => {
    const gs = novelGenres(n);
    const gtxt = gs.slice(0, 2).join(' / ') + (gs.length > 2 ? ' +' + (gs.length - 2) : '');
    return `
    <div class="lib-row ${n.id === state.currentNovelId ? 'active' : ''}" data-id="${n.id}">
      <div class="lib-cover" style="--cover:${n.color || '#00e0ff'}"></div>
      <div class="lib-info">
        <div class="lib-title">${esc(n.title || t('novel.pending'))}</div>
        <div class="lib-meta">${esc(n.audience || '')} ${esc(gtxt || t('novel.legacyGenre'))} · ${chaptersOf(n.id).length} · ${fmtDate(n.updatedAt)}</div>
      </div>
      <div class="row-actions" style="opacity:1">
        <button class="icon-btn" data-act="edit" data-id="${n.id}" title="编辑信息">✎</button>
        <button class="icon-btn danger" data-act="del" data-id="${n.id}" title="删除小说">✕</button>
      </div>
    </div>`;
  }).join('') || '<div class="empty-hint">' + t('empty.lib') + '</div>';
}
async function switchNovel(id) {
  if (id === state.currentNovelId) { closeModal('modal-library'); return; }
  await flushSave();
  state.currentNovelId = id;
  const chs = chaptersOf(id);
  if (!chs.find(c => c.id === state.currentChapterId)) state.currentChapterId = chs[0] ? chs[0].id : null;
  await loadChatFor(id);
  closeModal('modal-library');
  renderLibrary(); renderAll();
}

/* ---------------- 小说弹窗（含风格表格） ---------------- */
function openNovelModal(id) {
  state.novelEditingId = id || null;
  $('#novel-modal-title').textContent = id ? t('novel.edit') : t('novel.new');
  $('#novel-title').value = ''; $('#novel-desc').value = '';
  const n = id ? state.novels.find(x => x.id === id) : null;
  if (n) {
    $('#novel-title').value = n.title || '';
    $('#novel-desc').value = n.description || '';
    state.styleDraft = {
      audience: n.audience || '通用',
      genres: [...novelGenres(n)],
      length: n.length || '未定',
      pov: n.pov || '未定',
      tone: n.tone || '未定',
      narrative: n.narrative || 'dialogue',
      lang: n.lang || 'zh',
      authors: [...novelRefAuthors(n)]
    };
  } else {
    state.styleDraft = { audience: '通用', genres: [], length: '未定', pov: '未定', tone: '未定', narrative: 'dialogue', lang: 'zh', authors: [] };
  }
  renderStyleChips();
  $('#novel-learn-status').textContent = '';
  openModal('modal-novel');
  setTimeout(() => $('#novel-title').focus(), 60);
}
function renderStyleChips() {
  const d = state.styleDraft;
  if (!d) return;
  const gWrap = document.querySelector('#modal-novel [data-field="genres"]');
  if (gWrap) gWrap.innerHTML = GENRES.map(g => `<button class="chip ${d.genres.includes(g) ? 'on' : ''}" data-val="${g}">${esc(g)}</button>`).join('');
  const aWrap = document.querySelector('#modal-novel [data-field="authors"]');
  if (aWrap) aWrap.innerHTML = allAuthors().map(a => `<button class="chip ${d.authors.includes(a.id) ? 'on' : ''}" data-val="${a.id}">${esc(a.name)}${a.custom ? ' ✦' : ''}</button>`).join('');
  ['audience', 'length', 'pov', 'tone', 'narrative', 'lang'].forEach(f => {
    $$('#modal-novel [data-field="' + f + '"] .chip').forEach(b => b.classList.toggle('on', b.dataset.val === d[f]));
  });
}
function onStyleChipClick(e) {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  const wrap = btn.closest('[data-field]');
  if (!wrap || !state.styleDraft) return;
  const field = wrap.dataset.field;
  const val = btn.dataset.val;
  const d = state.styleDraft;
  if (field === 'genres' || field === 'authors') {
    const arr = d[field];
    const i = arr.indexOf(val);
    if (i >= 0) arr.splice(i, 1); else arr.push(val);
  } else {
    d[field] = val;
  }
  renderStyleChips();
}
async function saveNovelFromForm() {
  const title = $('#novel-title').value.trim();
  const id = state.novelEditingId;
  const desc = $('#novel-desc').value.trim();
  const d = state.styleDraft || { audience: '通用', genres: [], length: '未定', pov: '未定', tone: '未定', narrative: 'dialogue', lang: 'zh', authors: [] };
  const genreStr = d.genres.join('、') || t('novel.legacyGenre');
  if (id) {
    const n = state.novels.find(x => x.id === id);
    if (n) {
      n.title = title; n.description = desc;
      n.audience = d.audience; n.genres = [...d.genres]; n.genre = genreStr;
      n.length = d.length; n.pov = d.pov; n.tone = d.tone; n.narrative = d.narrative; n.lang = d.lang; n.refAuthors = [...d.authors];
      n.updatedAt = now();
      await dbPut(STORE.novels, n);
    }
  } else {
    const n = {
      id: uid(), title, description: desc,
      audience: d.audience, genres: [...d.genres], genre: genreStr,
      length: d.length, pov: d.pov, tone: d.tone, narrative: d.narrative, lang: d.lang, refAuthors: [...d.authors],
      styleMode: 'author', styleSample: '',
      color: PALETTE[state.novels.length % PALETTE.length],
      createdAt: now(), updatedAt: now(), synopsis: '', world: '', worldSections: []
    };
    state.novels.push(n);
    await dbPut(STORE.novels, n);
    state.currentNovelId = n.id; state.currentChapterId = null;
    await loadChatFor(n.id);
  }
  closeModal('modal-novel');
  renderLibrary(); renderAll();
  toast(t('toast.novelSaved'));
}
async function delNovel(id) {
  const n = state.novels.find(x => x.id === id);
  if (!n) return;
  if (!await confirmDialog(t('confirm.delNovel', { t: n.title }))) return;
  for (const c of state.chapters.filter(c => c.novelId === id)) await dbDel(STORE.chapters, c.id);
  for (const o of state.outline.filter(o => o.novelId === id)) await dbDel(STORE.outline, o.id);
  for (const c of state.characters.filter(c => c.novelId === id)) await dbDel(STORE.characters, c.id);
  for (const m of state.memories.filter(m => m.novelId === id)) await dbDel(STORE.memories, m.id);
  await dbDel(STORE.chats, id);
  state.chapters = state.chapters.filter(c => c.novelId !== id);
  state.outline = state.outline.filter(o => o.novelId !== id);
  state.characters = state.characters.filter(c => c.novelId !== id);
  state.memories = state.memories.filter(m => m.novelId !== id);
  state.novels = state.novels.filter(x => x.id !== id);
  if (state.currentNovelId === id) {
    state.currentNovelId = state.novels[0] ? state.novels[0].id : null;
    state.currentChapterId = null;
    await loadChatFor(state.currentNovelId);
  }
  renderLibrary(); renderAll();
  toast(t('toast.novelDel'));
}

/* ---------------- 作家文风 · 联网学习 ---------------- */
async function wikiLearn(authorId) {
  const a = AUTHORS.find(x => x.id === authorId);
  if (!a) return null;
  if (state.wikiCache[a.id] && state.wikiCache[a.id].text) return state.wikiCache[a.id].text;
  const url = 'https://zh.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&origin=*&redirects=1&titles=' + encodeURIComponent(a.wiki || a.name);
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  const pages = j && j.query && j.query.pages;
  const text = pages ? (Object.values(pages)[0].extract || '') : '';
  if (!text) throw new Error('empty extract');
  const out = text.slice(0, 1200);
  state.wikiCache[a.id] = { text: out, t: now() };
  saveWikiCache();
  return out;
}
async function learnAuthors(ids, statusEl) {
  if (state.learning) return toast(t('toast.learnBusy'), 'warn');
  if (!ids || !ids.length) return toast(t('learn.noSel'), 'warn');
  state.learning = true;
  let ok = 0, fail = 0;
  try {
    for (const id of ids) {
      try {
        await wikiLearn(id);
        ok++;
      } catch (e) {
        fail++;
      }
      if (statusEl) {
        statusEl.textContent = ok + '/' + ids.length;
        statusEl.className = 'learn-status';
      }
    }
    if (fail === 0) toast(t('w.learnOk', { ok, n: ids.length }), 'ok', 4000);
    else if (ok === 0) toast(t('w.learnFail'), 'err', 5000);
    else toast(t('w.learnPartial', { ok, fail }), 'warn', 5000);
  } finally {
    state.learning = false;
    if (state.module === 'world') renderPanel();
    if (statusEl && ok) { statusEl.textContent = t('w.learnOk', { ok, n: ids.length }); statusEl.className = 'learn-status'; }
  }
}

/* ---------------- 章节 ---------------- */
function selectChapter(id) {
  if (state.genState.running && state.genState.abort) state.genState.abort.abort();
  flushSave();
  state.currentChapterId = id;
  renderEditor(); renderPanel();
}
async function newChapter() {
  if (!curNovel()) return toast(t('toast.needNovel'), 'warn');
  await flushSave();
  const chs = chaptersOf(state.currentNovelId);
  const ch = {
    id: uid(), novelId: state.currentNovelId,
    title: `第 ${chs.length + 1} 章`, content: '', status: 'draft',
    order: chs.length ? Math.max(...chs.map(c => c.order)) + 1 : 0,
    wordCount: 0, createdAt: now(), updatedAt: now()
  };
  state.chapters.push(ch);
  await dbPut(STORE.chapters, ch);
  state.currentChapterId = ch.id;
  state.module = 'chapters';
  renderAll();
  const ti = $('#chapter-title'); ti.focus(); ti.select();
}
async function createChapterFromOutline(nodeId) {
  const node = state.outline.find(o => o.id === nodeId);
  if (!node) return;
  await flushSave();
  const chs = chaptersOf(state.currentNovelId);
  const ch = {
    id: uid(), novelId: state.currentNovelId,
    title: node.title || '新章节',
    content: '',
    outline: node.note || '',
    status: 'draft',
    order: chs.length ? Math.max(...chs.map(c => c.order)) + 1 : 0,
    wordCount: 0, createdAt: now(), updatedAt: now()
  };
  state.chapters.push(ch);
  await dbPut(STORE.chapters, ch);
  state.currentChapterId = ch.id;
  state.module = 'chapters';
  renderAll();
  toast(t('toast.chapterFromNode'), 'ok');
}
async function delChapter(id) {
  if (!await confirmDialog(t('confirm.delChapter'))) return;
  const i = state.chapters.findIndex(c => c.id === id);
  if (i < 0) return;
  await dbDel(STORE.chapters, id);
  state.chapters.splice(i, 1);
  if (state.currentChapterId === id) {
    const chs = chaptersOf(state.currentNovelId);
    state.currentChapterId = chs[0] ? chs[0].id : null;
    renderEditor();
  }
  renderTop(); renderPanel();
  toast(t('toast.chapterDel'));
}
async function moveInList(arr, id, dir, store) {
  const i = arr.findIndex(x => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return;
  const tmp = arr[i].order; arr[i].order = arr[j].order; arr[j].order = tmp;
  await dbPut(store, arr[i]); await dbPut(store, arr[j]);
  renderPanel();
}
function moveChapter(id, dir) { moveInList(chaptersOf(state.currentNovelId), id, dir, STORE.chapters); }
function moveOutline(id, dir) {
  const it = state.outline.find(o => o.id === id);
  if (!it) return;
  const arr = state.outline.filter(o => o.novelId === state.currentNovelId && o.parentId === it.parentId).sort((a, b) => a.order - b.order);
  moveInList(arr, id, dir, STORE.outline);
}

/* ---------------- 编辑器 ---------------- */
function renderEditorPlaceholder() {
  const ed = $('#editor');
  const n = curNovel();
  const key = n && n.lang === 'en' ? 'editor.placeholder.en' : 'editor.placeholder.zh';
  ed.placeholder = t(key);
}
function renderEditor() {
  const c = curChapter();
  const tEl = $('#chapter-title'), st = $('#chapter-status'), ed = $('#editor'), co = $('#chapter-outline');
  renderEditorPlaceholder();
  if (!c) {
    tEl.value = ''; tEl.disabled = true; st.disabled = true;
    ed.value = ''; ed.disabled = true;
    co.value = ''; co.disabled = true;
    ed.placeholder = t('editor.noChapter');
    updateCounts(); setSaveState(null);
    return;
  }
  tEl.disabled = false; st.disabled = false; ed.disabled = false; co.disabled = false;
  if (document.activeElement !== tEl) tEl.value = c.title || '';
  if (document.activeElement !== ed) ed.value = c.content || '';
  if (document.activeElement !== co) co.value = c.outline || '';
  st.value = c.status || 'draft';
  ed.style.fontSize = state.settings.fontSize + 'px';
  updateCounts();
  setSaveState(true);
}
function updatePos() {
  const ed = $('#editor');
  const pos = ed.selectionStart || 0;
  const upto = ed.value.slice(0, pos);
  const lines = upto.split('\n');
  $('#status-pos').textContent = t('stat.pos', { a: lines.length, b: lines[lines.length - 1].length + 1 });
}
function updateCounts() {
  const ed = $('#editor');
  const txt = ed.value;
  const words = countWords(txt);
  $('#word-count').textContent = fmtNum(words) + ' ' + t('stat.wordsChip');
  $('#status-words').textContent = t('stat.words', { a: fmtNum(countCJK(txt)), b: countLatin(txt) });
  $('#status-chars').textContent = t('stat.chars', { a: txt.length });
  updatePos();
}
function setSaveState(saved) {
  const el = $('#save-state');
  if (saved === null) { el.textContent = '—'; el.className = 'meta-chip save-chip'; return; }
  el.textContent = saved ? '● ' + fmtTime(now()) : '◌ …';
  el.className = 'meta-chip save-chip ' + (saved ? 'saved' : 'dirty');
}
function scheduleSave() {
  state.editorDirty = true;
  setSaveState(false);
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => saveChapter(false), 900);
}
async function flushSave() {
  clearTimeout(state.saveTimer);
  if (state.editorDirty) await saveChapter(false);
}
async function saveChapter(manual) {
  const c = curChapter();
  if (!c) { state.editorDirty = false; return; }
  c.title = $('#chapter-title').value.trim();
  c.content = $('#editor').value;
  c.outline = $('#chapter-outline').value;
  c.status = $('#chapter-status').value;
  c.wordCount = countWords(c.content);
  c.updatedAt = now();
  state.editorDirty = false;
  await dbPut(STORE.chapters, c);
  setSaveState(true);
  if (manual) toast(t('toast.savedOk'), 'ok');
  renderTop();
  if (state.module === 'chapters') renderPanel();
}
function toggleFocus(force) {
  const on = force !== undefined ? force : !document.body.classList.contains('focus-mode');
  document.body.classList.toggle('focus-mode', on);
  $('#btn-focus').textContent = t(on ? 'btn.focusExit' : 'btn.focus');
}

/* ---------------- 面板渲染 ---------------- */
function setNavActive() {
  $$('#main-nav .nav-item').forEach(b => b.classList.toggle('active', b.dataset.module === state.module));
}
function renderPanel() {
  const m = state.module;
  const body = $('#panel-body');
  const titles = { chapters: 'nav.chapters', outline: 'nav.outline', characters: 'nav.characters', style: 'nav.style', world: 'nav.world', memories: 'nav.memories' };
  $('#panel-title').textContent = t(titles[m]);
  const a = $('#panel-actions');
  a.innerHTML = '';
  if (!curNovel()) {
    body.innerHTML = '<div class="empty-hint">' + t('empty.panel') + '</div>';
    return;
  }
  const zh = state.settings.lang === 'zh';
  if (m === 'chapters') {
    body.innerHTML = renderChapterList();
    a.innerHTML = '<button class="btn small primary" id="act-new-chapter">＋ ' + (zh ? '新章节' : 'Chapter') + '</button>';
    $('#act-new-chapter').addEventListener('click', newChapter);
  } else if (m === 'outline') {
    body.innerHTML = renderOutline();
    a.innerHTML = '<button class="btn small primary" id="act-new-volume">＋ ' + (zh ? '新卷' : 'Volume') + '</button>';
    $('#act-new-volume').addEventListener('click', () => openNote('outline', null, null));
  } else if (m === 'characters') {
    body.innerHTML = renderCharacters();
    a.innerHTML = '<button class="btn small primary" id="act-new-char">＋ ' + (zh ? '新角色' : 'Character') + '</button>';
    $('#act-new-char').addEventListener('click', () => openChar(null));
  } else if (m === 'style') {
    body.innerHTML = renderStylePanel();
    const asBtn = $('#btn-author-search');
    if (asBtn) {
      asBtn.addEventListener('click', addCustomAuthorByName);
      $('#author-search-input').addEventListener('keydown', e => { if (e.key === 'Enter') addCustomAuthorByName(); });
      $('#author-filter-input').addEventListener('input', () => {
        state.authorFilter = ($('#author-filter-input').value || '').trim();
        renderAuthorChipsBox();
      });
    }
  } else if (m === 'world') {
    body.innerHTML = renderWorld();
  } else if (m === 'memories') {
    body.innerHTML = renderMemories();
    a.innerHTML = '<button class="btn small primary" id="act-add-mem">＋ ' + (zh ? '记忆' : 'Memory') + '</button>';
    $('#act-add-mem').addEventListener('click', () => openNote('mem', null));
  }
}
function renderChapterList() {
  const chs = chaptersOf(state.currentNovelId);
  if (!chs.length) return '<div class="empty-hint">' + t('empty.chapters') + '</div>';
  const stMap = { draft: [t('status.draft'), ''], revising: [t('status.revising'), 'warn'], done: [t('status.done'), 'ok'] };
  return chs.map(c => {
    const st = stMap[c.status] || stMap.draft;
    return `<div class="row-item ${c.id === state.currentChapterId ? 'active' : ''}" data-id="${c.id}" data-act="open">
      <div class="row-main">
        <div class="row-title">${esc(c.title || '未命名章节')}</div>
        <div class="row-meta"><span class="status-dot ${st[1]}"></span>${st[0]} · ${fmtNum(c.wordCount || 0)} ${t('stat.wordsChip')} · ${fmtTime(c.updatedAt)}</div>
      </div>
      <div class="row-actions">
        <button class="icon-btn" data-act="up" data-id="${c.id}" title="上移">↑</button>
        <button class="icon-btn" data-act="down" data-id="${c.id}" title="下移">↓</button>
        <button class="icon-btn danger" data-act="del" data-id="${c.id}" title="删除">✕</button>
      </div>
    </div>`;
  }).join('');
}
function renderOutline() {
  const items = state.outline.filter(o => o.novelId === state.currentNovelId).sort((a, b) => a.order - b.order);
  const vols = items.filter(i => !i.parentId);
  const kids = pid => items.filter(i => i.parentId === pid).sort((a, b) => a.order - b.order);
  if (!vols.length) return '<div class="empty-hint">' + t('empty.outline') + '</div>';
  const stMap = { todo: ['未开始', ''], doing: ['进行中', 'warn'], done: ['已完成', 'ok'] };
  const nodeHtml = (it, isVol) => {
    const st = stMap[it.status] || stMap.todo;
    const children = kids(it.id);
    if (isVol) {
      return `<details class="vol" data-id="${it.id}" open>
        <summary>
          <span class="status-dot ${st[1]}" data-act="cycle" data-id="${it.id}" title="点击切换状态"></span>
          <span class="vol-name">${esc(it.title)}</span>
          <span class="vol-badge">${children.length}</span>
          <span class="row-actions">
            <button class="icon-btn" data-act="edit" data-id="${it.id}" title="编辑">✎</button>
            <button class="icon-btn" data-act="up" data-id="${it.id}" title="上移">↑</button>
            <button class="icon-btn" data-act="down" data-id="${it.id}" title="下移">↓</button>
            <button class="icon-btn danger" data-act="del" data-id="${it.id}" title="删除">✕</button>
          </span>
        </summary>
        ${it.note ? `<div class="vol-note">${esc(it.note)}</div>` : ''}
        <div class="vol-kids">${children.map(c => nodeHtml(c, false)).join('') || '<div class="empty-hint small">' + t('empty.volKids') + '</div>'}</div>
        <div class="vol-add"><button class="btn mini" data-act="addchild" data-id="${it.id}">＋ 节点</button></div>
      </details>`;
    }
    return `<div class="outline-node" data-id="${it.id}">
      <span class="status-dot ${st[1]}" data-act="cycle" data-id="${it.id}" title="点击切换状态"></span>
      <div class="node-main">
        <div class="node-title">${esc(it.title)}</div>
        ${it.note ? `<div class="node-note">${esc(it.note)}</div>` : ''}
      </div>
      <div class="row-actions">
        <button class="icon-btn" data-act="mkchapter" data-id="${it.id}" title="据此创建章节">✒</button>
        <button class="icon-btn" data-act="edit" data-id="${it.id}" title="编辑">✎</button>
        <button class="icon-btn" data-act="up" data-id="${it.id}" title="上移">↑</button>
        <button class="icon-btn" data-act="down" data-id="${it.id}" title="下移">↓</button>
        <button class="icon-btn danger" data-act="del" data-id="${it.id}" title="删除">✕</button>
      </div>
    </div>`;
  };
  return vols.map(v => nodeHtml(v, true)).join('');
}
function renderCharacters() {
  const list = state.characters.filter(c => c.novelId === state.currentNovelId);
  if (!list.length) return '<div class="empty-hint">' + t('empty.chars') + '</div>';
  return list.map(c => `<div class="char-card" data-id="${c.id}" data-act="edit">
    <div class="char-head">
      <span class="char-avatar">${esc((c.name || '?').slice(0, 1))}</span>
      <div><div class="char-name">${esc(c.name || '未命名')}</div><div class="char-role">${esc(c.role || '')}</div></div>
    </div>
    <div class="char-summary">${esc((c.background || c.personality || '暂无介绍').slice(0, 120))}</div>
    <div class="row-actions">
      <button class="icon-btn" data-act="edit" data-id="${c.id}" title="编辑">✎</button>
      <button class="icon-btn danger" data-act="del" data-id="${c.id}" title="删除">✕</button>
    </div>
  </div>`).join('');
}
function renderWorld() {
  const n = curNovel();
  const secs = (n.worldSections || []).map(s => `
    <div class="world-sec" data-id="${s.id}">
      <div class="world-sec-head">
        <input class="input world-sec-title" data-field="secTitle" data-id="${s.id}" value="${esc(s.title || '')}" placeholder="条目名称（如：力量体系 / 势力 / 时间线）" autocomplete="off" />
        <button class="icon-btn danger" data-act="delsec" data-id="${s.id}" title="删除条目">✕</button>
      </div>
      <textarea class="input world-sec-body" data-field="secBody" data-id="${s.id}" rows="4" placeholder="展开设定…">${esc(s.content || '')}</textarea>
    </div>`).join('');
  const gs = novelGenres(n).join(' / ') || t('novel.legacyGenre');
  const refs = novelRefAuthors(n).map(id => { const a = findAuthor(id); return a ? a.name : id; }).join('、');
  return `
  <div class="world-block">
    <div class="block-label">${t('w.synopsis')}</div>
    <textarea class="input" data-field="synopsis" rows="5" placeholder="全书主线、起承转合、结局走向…">${esc(n.synopsis || '')}</textarea>
  </div>
  <div class="world-block">
    <div class="block-label">${t('w.world')}</div>
    <textarea class="input" data-field="world" rows="7" placeholder="时代背景、地理、规则、力量体系总览…">${esc(n.world || '')}</textarea>
  </div>
  <div class="world-block">
    <div class="block-label">风格档案 · STYLE <button class="btn mini" data-act="editstyle">${t('w.edit')}</button></div>
    <div class="style-profile">
      <table>
        <tr><td class="sp-label">${t('w.audience')}</td><td class="sp-val">${esc(n.audience || '通用')}</td></tr>
        <tr><td class="sp-label">${t('w.genre')}</td><td class="sp-val">${esc(gs)}</td></tr>
        <tr><td class="sp-label">${t('w.length')}</td><td class="sp-val">${esc(n.length || '未定')}</td></tr>
        <tr><td class="sp-label">${t('w.pov')}</td><td class="sp-val">${esc(n.pov || '未定')}</td></tr>
        <tr><td class="sp-label">${t('w.tone')}</td><td class="sp-val">${esc(n.tone || '未定')}</td></tr>
        <tr><td class="sp-label">${t('style.narrative')}</td><td class="sp-val">${esc({ dialogue: t('style.dialogue'), balanced: t('style.balanced'), narrative: t('style.narrativeMode') }[n.narrative] || t('style.dialogue'))}</td></tr>
        <tr><td class="sp-label">${t('w.lang')}</td><td class="sp-val">${n.lang === 'en' ? 'English' : '中文'}</td></tr>
        <tr><td class="sp-label">${t('w.authors')}</td><td class="sp-val">${esc(refs || '—')}</td></tr>
      </table>
    </div>
  </div>
  <div class="world-block">
    <div class="block-label">${t('w.custom')} <button class="btn mini" data-act="addsec">${t('w.addSec')}</button></div>
    ${secs || '<div class="empty-hint small">可添加力量体系、势力、时间线等自定义设定条目。</div>'}
  </div>`;
}
function renderAuthorChips(n) {
  const refs = novelRefAuthors(n);
  const f = (state.authorFilter || '').toLowerCase();
  const list = allAuthors().filter(a => !f || (a.name || '').toLowerCase().includes(f));
  if (!list.length) return '<span class="learn-status">' + t('vip.searchEmpty') + '</span>';
  return list.map(a => `<button class="chip mini ${refs.includes(a.id) ? 'on' : ''}" data-act="toggleauthor" data-id="${a.id}" title="${esc(a.name)}${a.custom ? '（' + t('au.custom') + '）' : ''}">${esc(a.name)}${a.custom ? ' ✦' : ''}</button>`).join('');
}
function renderAuthorChipsBox() {
  const box = $('#author-chips-box');
  const n = curNovel();
  if (!box || !n) return;
  box.innerHTML = renderAuthorChips(n);
}
function renderStylePanel() {
  const n = curNovel();
  const mine = (n.styleMode || 'author') === 'mine';
  const refs = novelRefAuthors(n);
  const authorSection = `
    <div class="author-search-row">
      <input class="input" id="author-search-input" data-i18n-ph="au.ph" placeholder="输入你喜欢的作家名字，联网搜索添加…" autocomplete="off" />
      <button class="btn mini primary" id="btn-author-search" data-i18n="au.search">🔍 搜索添加</button>
      <span class="learn-status" id="au-status"></span>
    </div>
    <div class="author-search-row">
      <input class="input" id="author-filter-input" data-i18n-ph="sp.filterPh" placeholder="筛选作家…" autocomplete="off" />
    </div>
    <div class="author-chips" id="author-chips-box">${renderAuthorChips(n)}</div>
    <div class="author-learn-row">
      <button class="btn mini primary" data-act="learnauthors">${t('w.learnSel', { n: refs.length })}</button>
      <span class="learn-status" id="world-learn-status"></span>
    </div>
    ${renderAuthorNotes(n)}`;
  const mineSection = `
    <textarea class="input sp-sample" data-field="styleSample" rows="9" data-i18n-ph="w.styleSamplePh" placeholder="粘贴一段你自己的文字（500 字以内）…">${esc(n.styleSample || '')}</textarea>`;
  return `
    <div class="sp-mode-row">
      <button class="chip set-chip ${!mine ? 'on' : ''}" data-act="stylemode" data-mode="author">${t('w.styleModeAuthor')}</button>
      <button class="chip set-chip ${mine ? 'on' : ''}" data-act="stylemode" data-mode="mine">${t('w.styleModeMine')}</button>
    </div>
    <div class="sp-hint">${mine ? t('sp.mineTip') : t('sp.pickTip')}</div>
    ${mine ? mineSection : authorSection}`;
}
function renderAuthorNotes(n) {
  const refs = novelRefAuthors(n);
  if (!refs.length) return '<div class="empty-hint small">' + t('w.noAuthors') + '</div>';
  return refs.map(id => {
    const a = findAuthor(id);
    if (!a) return '';
    const wk = a.custom ? null : state.wikiCache[id];
    const tipsTxt = a.custom ? (a.learned || a.tips || '') : a.tips;
    return `<div class="author-note-card">
      <div class="author-note-head">
        <span class="author-note-name">${esc(a.name)}</span>
        <span class="author-note-src">${a.custom ? t('au.custom') : t('w.builtin')}</span>
        ${wk ? `<span class="author-note-src">${t('w.wiki')}</span>` : ''}
        ${a.custom ? `<button class="icon-btn danger" data-act="delcustomauthor" data-id="${a.id}" title="${t('au.del')}" style="margin-left:auto">✕</button>` : ''}
      </div>
      ${tipsTxt ? `<div class="author-note-tips">${esc(a.custom ? (a.learned || '').slice(0, 400) + ((a.learned || '').length > 400 ? '…' : '') : tipsTxt)}</div>` : ''}
      ${(!a.custom && wk) ? `<div class="author-note-wiki">${esc(wk.text.slice(0, 400))}${wk.text.length > 400 ? '…' : ''}</div>` : ''}
    </div>`;
  }).join('');
}
function renderMemories() {
  const list = state.memories.filter(m => m.novelId === state.currentNovelId);
  const cats = ['全部', '情节', '人物', '伏笔', '世界', '其他'];
  const active = state.memFilter || '全部';
  const shown = active === '全部' ? list : list.filter(m => m.category === active);
  const chips = cats.map(c => `<button class="chip mini ${c === active ? 'on' : ''}" data-act="memfilter" data-cat="${c}">${esc(c)}</button>`).join('');
  const rows = shown.map(m => `<div class="mem-item" data-id="${m.id}">
    <span class="mem-cat" data-cat="${esc(m.category || '其他')}">${esc(m.category || '其他')}</span>
    <div class="mem-text">${esc(m.content)}</div>
    <div class="row-actions">
      <button class="icon-btn" data-act="edit" data-id="${m.id}" title="编辑">✎</button>
      <button class="icon-btn danger" data-act="del" data-id="${m.id}" title="删除">✕</button>
    </div>
  </div>`).join('') || '<div class="empty-hint small">' + t('empty.mem') + '</div>';
  return `<div class="mem-chips">${chips}</div><div class="mem-list">${rows}</div>`;
}

/* ---------------- 面板事件 ---------------- */
function onPanelClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  if (btn.closest('summary')) e.preventDefault();
  const act = btn.dataset.act, id = btn.dataset.id, cat = btn.dataset.cat;
  e.stopPropagation();
  const m = state.module;
  switch (act) {
    case 'open': if (id) selectChapter(id); break;
    case 'up': m === 'chapters' ? moveChapter(id, -1) : moveOutline(id, -1); break;
    case 'down': m === 'chapters' ? moveChapter(id, 1) : moveOutline(id, 1); break;
    case 'del':
      if (m === 'chapters') delChapter(id);
      else if (m === 'outline') delOutline(id);
      else if (m === 'characters') delChar(id);
      else if (m === 'memories') delMem(id);
      break;
    case 'cycle': cycleOutline(id); break;
    case 'edit':
      if (m === 'outline') openNote('outline', id);
      else if (m === 'characters') openChar(id);
      else if (m === 'memories') openNote('mem', id);
      break;
    case 'addchild': openNote('outline', null, id); break;
    case 'mkchapter': createChapterFromOutline(id); break;
    case 'memfilter': state.memFilter = cat; renderPanel(); break;
    case 'delsec': delWorldSection(id); break;
    case 'addsec': addWorldSection(); break;
    case 'editstyle': openNovelModal(state.currentNovelId); break;
    case 'toggleauthor': toggleAuthor(id); break;
    case 'learnauthors': learnAuthors(novelRefAuthors(curNovel()), $('#world-learn-status')); break;
    case 'delcustomauthor': delCustomAuthor(id); break;
    case 'stylemode': setStyleMode(btn.dataset.mode); break;
  }
}
function onPanelInput(e) {
  const tEl = e.target;
  if (!tEl.dataset || !tEl.dataset.field) return;
  const n = curNovel();
  if (!n) return;
  const f = tEl.dataset.field;
  if (f === 'synopsis') n.synopsis = tEl.value;
  else if (f === 'world') n.world = tEl.value;
  else if (f === 'styleSample') n.styleSample = tEl.value.slice(0, 500);
  else if (f === 'secTitle') { const s = (n.worldSections || []).find(x => x.id === tEl.dataset.id); if (s) s.title = tEl.value; }
  else if (f === 'secBody') { const s = (n.worldSections || []).find(x => x.id === tEl.dataset.id); if (s) s.content = tEl.value; }
  n.updatedAt = now();
  clearTimeout(state.novelSaveTimer);
  state.novelSaveTimer = setTimeout(() => dbPut(STORE.novels, n), 800);
}
async function addWorldSection() {
  const n = curNovel();
  if (!n) return;
  n.worldSections = n.worldSections || [];
  n.worldSections.push({ id: uid(), title: '', content: '' });
  await dbPut(STORE.novels, n);
  renderPanel();
  const last = $('#panel-body .world-sec:last-child .world-sec-title');
  if (last) last.focus();
}
async function delWorldSection(id) {
  const n = curNovel();
  if (!n) return;
  n.worldSections = (n.worldSections || []).filter(s => s.id !== id);
  await dbPut(STORE.novels, n);
  renderPanel();
}
async function toggleAuthor(id) {
  const n = curNovel();
  if (!n) return;
  const refs = novelRefAuthors(n);
  const i = refs.indexOf(id);
  if (i >= 0) refs.splice(i, 1); else refs.push(id);
  n.refAuthors = refs;
  renderPanel();
  await dbPut(STORE.novels, n);
}

/* ---------------- 大纲操作 ---------------- */
async function cycleOutline(id) {
  const it = state.outline.find(o => o.id === id);
  if (!it) return;
  const order = ['todo', 'doing', 'done'];
  it.status = order[(order.indexOf(it.status || 'todo') + 1) % 3];
  await dbPut(STORE.outline, it);
  renderPanel();
}
async function delOutline(id) {
  if (!await confirmDialog(t('confirm.delOutline'))) return;
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const o of state.outline) {
      if (o.parentId && ids.has(o.parentId) && !ids.has(o.id)) { ids.add(o.id); grew = true; }
    }
  }
  for (const i of ids) await dbDel(STORE.outline, i);
  state.outline = state.outline.filter(o => !ids.has(o.id));
  renderPanel();
  toast(t('toast.outlineDel'));
}

/* ---------------- 通用笔记弹窗 ---------------- */
function openNote(type, id, parentId) {
  state.noteCtx = { type, id, parentId };
  const isMem = type === 'mem';
  const zh = state.settings.lang === 'zh';
  $('#note-modal-title').textContent = isMem ? '◬ ' + t('nav.memories') : (id ? (zh ? '编辑节点' : 'Edit node') : (parentId ? (zh ? '添加节点' : 'Add node') : (zh ? '新建分卷' : 'New volume')));
  $('#note-title-wrap').style.display = isMem ? 'none' : '';
  $('#note-cat-wrap').style.display = isMem ? '' : 'none';
  $('#note-title').value = '';
  $('#note-content').value = '';
  $('#note-category').value = '情节';
  if (id) {
    const it = isMem ? state.memories.find(x => x.id === id) : state.outline.find(o => o.id === id);
    if (it) {
      $('#note-title').value = it.title || '';
      $('#note-content').value = isMem ? (it.content || '') : (it.note || '');
      if (isMem) $('#note-category').value = it.category || '情节';
    }
  }
  openModal('modal-note');
  setTimeout(() => (isMem ? $('#note-content') : $('#note-title')).focus(), 60);
}
async function saveNote() {
  const ctx = state.noteCtx;
  if (!ctx) return;
  if (ctx.type === 'mem') {
    const content = $('#note-content').value.trim();
    if (!content) return toast(t('toast.needContent'), 'warn');
    const cat = $('#note-category').value;
    if (ctx.id) {
      const m = state.memories.find(x => x.id === ctx.id);
      if (m) { m.content = content; m.category = cat; m.updatedAt = now(); await dbPut(STORE.memories, m); }
    } else {
      const m = { id: uid(), novelId: state.currentNovelId, category: cat, content, source: '手动', createdAt: now() };
      state.memories.push(m);
      await dbPut(STORE.memories, m);
    }
  } else {
    const title = $('#note-title').value.trim();
    if (!title) return toast(t('toast.needNodeTitle'), 'warn');
    const note = $('#note-content').value.trim();
    if (ctx.id) {
      const o = state.outline.find(x => x.id === ctx.id);
      if (o) { o.title = title; o.note = note; o.updatedAt = now(); await dbPut(STORE.outline, o); }
    } else {
      const arr = state.outline.filter(o => o.novelId === state.currentNovelId && o.parentId === ctx.parentId);
      const o = {
        id: uid(), novelId: state.currentNovelId, parentId: ctx.parentId || null,
        title, note, status: 'todo',
        order: arr.length ? Math.max(...arr.map(a => a.order)) + 1 : 0,
        createdAt: now()
      };
      state.outline.push(o);
      await dbPut(STORE.outline, o);
    }
  }
  closeModal('modal-note');
  renderPanel();
  toast(t('toast.memSaved'));
}

/* ---------------- 角色 ---------------- */
function openChar(id) {
  state.charEditingId = id || null;
  const fields = ['char-name', 'char-role', 'char-appearance', 'char-personality', 'char-background', 'char-relations', 'char-notes'];
  fields.forEach(k => { $('#' + k).value = ''; });
  if (id) {
    const c = state.characters.find(x => x.id === id);
    if (c) {
      $('#char-name').value = c.name || '';
      $('#char-role').value = c.role || '';
      $('#char-appearance').value = c.appearance || '';
      $('#char-personality').value = c.personality || '';
      $('#char-background').value = c.background || '';
      $('#char-relations').value = c.relations || '';
      $('#char-notes').value = c.notes || '';
    }
  }
  openModal('modal-char');
  setTimeout(() => $('#char-name').focus(), 60);
}
async function saveChar() {
  const name = $('#char-name').value.trim();
  if (!name) return toast(t('toast.needName'), 'warn');
  const data = {
    name,
    role: $('#char-role').value.trim(),
    appearance: $('#char-appearance').value.trim(),
    personality: $('#char-personality').value.trim(),
    background: $('#char-background').value.trim(),
    relations: $('#char-relations').value.trim(),
    notes: $('#char-notes').value.trim()
  };
  if (state.charEditingId) {
    const c = state.characters.find(x => x.id === state.charEditingId);
    if (c) { Object.assign(c, data); c.updatedAt = now(); await dbPut(STORE.characters, c); }
  } else {
    const c = { id: uid(), novelId: state.currentNovelId, ...data, createdAt: now() };
    state.characters.push(c);
    await dbPut(STORE.characters, c);
  }
  closeModal('modal-char');
  renderPanel();
  toast(t('toast.charSaved'));
}
async function delChar(id) {
  if (!await confirmDialog(t('confirm.delChar'))) return;
  const i = state.characters.findIndex(c => c.id === id);
  if (i < 0) return;
  await dbDel(STORE.characters, id);
  state.characters.splice(i, 1);
  renderPanel();
}
async function delMem(id) {
  if (!await confirmDialog(t('confirm.delMem'))) return;
  const i = state.memories.findIndex(m => m.id === id);
  if (i < 0) return;
  await dbDel(STORE.memories, id);
  state.memories.splice(i, 1);
  renderPanel();
  toast(t('toast.memDeleted'));
}

/* ---------------- 模态框与确认 ---------------- */
function openModal(id) { $('#' + id).hidden = false; }
function closeModal(id) { $('#' + id).hidden = true; }
function confirmDialog(text) {
  return new Promise(res => {
    state.confirmResolve = res;
    $('#confirm-text').textContent = text;
    openModal('modal-confirm');
  });
}

/* ---------------- 个人档案 ---------------- */
function openProfile() {
  const u = state.settings.user || {};
  $('#profile-nick').value = u.nickname || '';
  applyProfilePreview();
  openModal('modal-profile');
  setTimeout(() => $('#profile-nick').focus(), 60);
}
async function saveProfile() {
  const u = state.settings.user || (state.settings.user = {});
  u.nickname = $('#profile-nick').value.trim().slice(0, 16);
  saveSettings();
  closeModal('modal-profile');
  renderTop();
  toast(t('toast.profileSaved'));
}
async function handleAvatarFile(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) return toast(t('toast.avatarTooBig'), 'warn');
  try {
    const dataUrl = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => rej(new Error('read fail'));
      fr.readAsDataURL(file);
    });
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('bad image'));
      im.src = dataUrl;
    });
    const size = 128;
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const ctx = cv.getContext('2d');
    const min = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
    const out = cv.toDataURL('image/jpeg', 0.85);
    state.settings.user.avatarData = out;
    applyProfilePreview();
  } catch (e) {
    toast(t('toast.avatarBad'), 'err');
  }
}

/* ---------------- 英语词典 ---------------- */
function editorSelectionWord() {
  const ed = $('#editor');
  const sel = ed.value.substring(ed.selectionStart, ed.selectionEnd).trim();
  if (!sel) return '';
  const m = sel.match(/[A-Za-z][A-Za-z'-]{1,40}/);
  return m ? m[0] : '';
}
function openDict(autoWord) {
  const word = autoWord || editorSelectionWord();
  if (word) { $('#dict-input').value = word; dictSearch(word); }
  else { $('#dict-input').value = ''; $('#dict-result').innerHTML = ''; }
  openModal('modal-dict');
  setTimeout(() => $('#dict-input').focus(), 60);
}
async function dictSearch(word) {
  word = (word || '').trim().toLowerCase();
  if (!word) return toast(t('toast.dictNeedWord'), 'warn');
  $('#dict-input').value = word;
  const box = $('#dict-result');
  box.innerHTML = '<div class="dict-loading">' + t('dict.loading') + '</div>';
  // 主源：dictionaryapi.dev（完整释义/音标/例句）
  let data = null, apiOk = false;
  try {
    const res = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word), { signal: AbortSignal.timeout(10000) });
    if (res.status === 404) data = null;
    else if (!res.ok) throw new Error('HTTP ' + res.status);
    else {
      const j = await res.json();
      if (Array.isArray(j) && j.length) { data = j; apiOk = true; }
    }
  } catch (e) { apiOk = false; data = null; }
  // 近义词（Datamuse，CORS 友好）
  let syns = [], dmData = null;
  try {
    const r2 = await fetch('https://api.datamuse.com/words?rel_syn=' + encodeURIComponent(word) + '&max=12', { signal: AbortSignal.timeout(8000) });
    if (r2.ok) { const j2 = await r2.json(); syns = (j2 || []).map(x => x.word).filter(Boolean).slice(0, 12); }
    if (!apiOk) {
      const r3 = await fetch('https://api.datamuse.com/words?sp=' + encodeURIComponent(word) + '&md=dp&max=8', { signal: AbortSignal.timeout(8000) });
      if (r3.ok) dmData = await r3.json();
    }
  } catch (e) { }
  const synHtml = syns.length
    ? `<div class="dict-syn-label">${t('dict.syn')}</div><div class="dict-syns">${syns.map(s => `<button class="chip mini" data-syn="${esc(s)}">${esc(s)}</button>`).join('')}</div>`
    : '';
  // 回退源：Datamuse（释义 + 词性）
  if (!apiOk) {
    if (Array.isArray(dmData) && dmData.length) {
      const entries = dmData.map(it => {
        const tags = (it.tags || []).slice(0, 4).join(' / ');
        const defs = (it.defs || []).slice(0, 3).map(d => {
          const parts = d.split('\t');
          const pos = parts.length > 1 ? parts[0] : '';
          const txt = parts.length > 1 ? parts.slice(1).join(' ') : d;
          return `<div class="dict-def">${esc(txt)}</div>`;
        }).join('');
        return `<div class="dict-meaning"><span class="dict-pos">${esc(tags)}</span>${defs}</div>`;
      }).join('');
      box.innerHTML = `<div class="dict-word"><b>${esc(word)}</b></div><div class="dict-meanings">${entries}</div>${synHtml}<div class="dict-source">${t('dict.src')}</div>`;
    } else if (syns.length) {
      box.innerHTML = `<div class="dict-word"><b>${esc(word)}</b></div><div class="dict-empty">${t('dict.notfound')}</div>${synHtml}<div class="dict-source">${t('dict.src')}</div>`;
    } else {
      box.innerHTML = '<div class="dict-empty">' + t('dict.errNet') + '</div>';
    }
    box.scrollTop = 0;
    return;
  }
  const e0 = data[0];
  const phonetics = (e0.phonetics || []).map(p => {
    const audio = p.audio ? `<audio controls preload="none" src="${esc(p.audio)}"></audio>` : '';
    return (p.text ? `<span class="dict-phonetic">${esc(p.text)}</span>` : '') + audio;
  }).join(' ');
  const meanings = (e0.meanings || []).map(m => {
    const defs = (m.definitions || []).slice(0, 4).map(d =>
      `<div class="dict-def">${esc(d.definition)}${d.example ? `<em>例：${esc(d.example)}</em>` : ''}</div>`
    ).join('');
    return `<div class="dict-meaning"><span class="dict-pos">${esc(m.partOfSpeech || '')}</span>${defs}</div>`;
  }).join('');
  box.innerHTML = `
    <div class="dict-word"><b>${esc(e0.word || word)}</b>${phonetics}</div>
    <div class="dict-meanings">${meanings}</div>
    ${synHtml}
    <div class="dict-source">${t('dict.src')}</div>`;
  box.scrollTop = 0;
}

/* ---------------- 备份与导出 ---------------- */
async function exportTxt() {
  const n = curNovel();
  if (!n) return toast(t('toast.needNovelSel'), 'warn');
  const chs = chaptersOf(n.id);
  if (!chs.length) return toast(t('toast.noChapters'), 'warn');
  const sep = '\n\n' + '═'.repeat(30) + '\n\n';
  const body = chs.map(c => `${c.title || '未命名'}\n${'─'.repeat(20)}\n${c.content}`).join(sep);
  const author = (state.settings.user || {}).nickname;
  const head = n.title + '\n\n' + (author ? (state.settings.lang === 'zh' ? '作者：' : 'Author: ') + author + '\n' : '') + (n.description ? '简介：' + n.description + '\n' : '') + '\n';
  download(n.title + '.txt', head + body);
  toast(t('toast.txtOk'), 'ok');
}
async function exportJson() {
  const data = {
    exportedAt: new Date().toISOString(),
    novels: state.novels, chapters: state.chapters, outline: state.outline,
    characters: state.characters, memories: state.memories, chats: state.chats
  };
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  download(`xiaoxing-备份-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`, JSON.stringify(data, null, 2), 'application/json');
  toast(t('toast.backupOk'), 'ok');
}
async function doImport(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    for (const k of Object.values(STORE)) {
      if (data[k] !== undefined && !Array.isArray(data[k])) throw new Error('字段 ' + k + ' 格式错误');
    }
    if (!await confirmDialog(t('confirm.import'))) return;
    await flushSave();
    for (const k of Object.values(STORE)) {
      await dbClear(k);
      const arr = data[k] || [];
      for (const r of arr) await dbPut(k, r);
    }
    await loadAll();
    renderLibrary(); renderAll();
    toast(t('toast.importOk'), 'ok');
  } catch (e) {
    toast(t('toast.importFail') + e.message, 'err', 6000);
  } finally {
    $('#import-file').value = '';
  }
}
async function wipeAll() {
  if (!await confirmDialog(t('confirm.wipe'))) return;
  await flushSave();
  for (const k of Object.values(STORE)) await dbClear(k);
  state.novels = []; state.chapters = []; state.outline = [];
  state.characters = []; state.memories = []; state.chats = [];
  state.currentNovelId = null; state.currentChapterId = null; state.chatForNovel = [];
  renderLibrary(); renderAll();
  toast(t('toast.wiped'));
}

/* ---------------- AI 提供方配置 ---------------- */
const activeProvider = () => state.settings.providers.find(p => p.id === state.settings.activeProviderId) || null;
const baseUrl = p => String(p.baseUrl || '').trim().replace(/\/+$/, '');
const apiPath = p => (p.path !== undefined && p.path !== null && String(p.path).trim() !== '') ? String(p.path).trim() : '/chat/completions';

function renderProviderList() {
  const list = $('#provider-list');
  list.innerHTML = state.settings.providers.map(x => `
    <div class="prov-row ${x.id === state.settings.activeProviderId ? 'active' : ''}" data-id="${x.id}">
      <div class="prov-info">
        <div class="prov-name">${esc(x.name || '未命名')}</div>
        <div class="prov-meta">${esc(x.model || '')} · ${esc(baseUrl(x) || '')}</div>
      </div>
      ${x.id === state.settings.activeProviderId ? '<span class="badge">使用中</span>' : ''}
    </div>`).join('') || '<div class="empty-hint small">' + t('aiset.list') + '</div>';
}
function fillProvForm(p) {
  $('#prov-name').value = p ? (p.name || '') : '';
  $('#prov-base').value = p ? (p.baseUrl || '') : '';
  $('#prov-path').value = p ? (p.path !== undefined ? p.path : '/chat/completions') : '/chat/completions';
  $('#prov-key').value = p ? (p.apiKey || '') : '';
  $('#prov-model').value = p ? (p.model || '') : '';
  $('#prov-temp').value = p ? (p.temperature ?? 0.8) : 0.8;
  $('#prov-maxtok').value = p ? (p.maxTokens || 4096) : 4096;
  $('#preset-select').value = '';
}
function openAISettings() {
  fillPresetSelect();
  renderProviderList();
  state.provEditingId = null;
  fillProvForm(null);
  openModal('modal-ai');
}
async function saveProvider() {
  const name = $('#prov-name').value.trim() || '未命名模型';
  const base = $('#prov-base').value.trim();
  const model = $('#prov-model').value.trim();
  if (!base || !model) return toast(t('toast.providerFill'), 'warn');
  const data = {
    id: state.provEditingId || uid(), name, baseUrl: base,
    path: $('#prov-path').value.trim() || '/chat/completions',
    apiKey: $('#prov-key').value.trim(), model,
    temperature: clamp(parseFloat($('#prov-temp').value) || 0.8, 0, 2),
    maxTokens: clamp(parseInt($('#prov-maxtok').value) || 4096, 64, 128000)
  };
  const i = state.settings.providers.findIndex(p => p.id === data.id);
  if (i >= 0) state.settings.providers[i] = data; else state.settings.providers.push(data);
  state.settings.activeProviderId = data.id;
  saveSettings();
  renderProviderList(); renderModelTag();
  closeModal('modal-ai');
  toast(t('toast.providerSaved'));
}
async function delProvider() {
  if (!state.provEditingId) return toast(t('toast.providerPick'), 'warn');
  if (!await confirmDialog(t('confirm.delProvider'))) return;
  state.settings.providers = state.settings.providers.filter(p => p.id !== state.provEditingId);
  if (state.settings.activeProviderId === state.provEditingId) state.settings.activeProviderId = state.settings.providers[0] ? state.settings.providers[0].id : null;
  // 全部删光时自动恢复内置免费模型，保证 AI 始终可用
  if (!state.settings.providers.length) {
    state.settings.providers.push({
      id: uid(), name: 'Pollinations 免费模型', baseUrl: 'https://text.pollinations.ai', path: '/openai',
      apiKey: '', model: 'openai', temperature: 0.8, maxTokens: 4096
    });
    state.settings.activeProviderId = state.settings.providers[0].id;
  }
  state.provEditingId = null;
  saveSettings();
  renderProviderList(); renderModelTag();
  fillProvForm(null);
  toast(t('toast.providerDel'));
}
async function testProvider() {
  const base = $('#prov-base').value.trim();
  const model = $('#prov-model').value.trim();
  if (!base || !model) return toast(t('toast.providerFill'), 'warn');
  const p = { baseUrl: base, model, apiKey: $('#prov-key').value.trim(), temperature: 0.7 };
  const btn = $('#btn-prov-test');
  btn.disabled = true;
  try {
    const res = await fetch(baseUrl(p) + apiPath(p), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(p.apiKey ? { 'Authorization': 'Bearer ' + p.apiKey } : {}) },
      body: JSON.stringify({ model: p.model, messages: [{ role: 'user', content: '请只回复四个字：连接成功' }], max_tokens: 64, stream: false })
    });
    if (!res.ok) { const tt = await res.text(); throw new Error(`HTTP ${res.status}: ${tt.slice(0, 160)}`); }
    const j = await res.json();
    const rep = j.choices && j.choices[0] && j.choices[0].message ? (j.choices[0].message.content || '') : '';
    toast(t('dict.provOk') + (rep || '').slice(0, 60), 'ok', 4200);
  } catch (e) {
    toast(t('dict.provFail') + e.message, 'err', 6500);
  } finally {
    btn.disabled = false;
  }
}

/* ---------------- AI 请求（OpenAI 兼容 + 流式 + 自动切换备用模型） ---------------- */
async function aiRequestOnce(messages, opts, p) {
  const body = {
    model: p.model, messages,
    temperature: Number(p.temperature ?? 0.8),
    stream: !!(opts && opts.stream)
  };
  if (p.maxTokens) body.max_tokens = Number(p.maxTokens);
  if (opts && opts.maxTokens) body.max_tokens = opts.maxTokens;
  const res = await fetch(baseUrl(p) + apiPath(p), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(p.apiKey ? { 'Authorization': 'Bearer ' + p.apiKey } : {}) },
    body: JSON.stringify(body),
    signal: state.aiAbort ? state.aiAbort.signal : undefined
  });
  if (!res.ok) {
    let msg = '';
    try { msg = await res.text(); } catch (e) { }
    throw new Error(`HTTP ${res.status} ${msg.slice(0, 200)}`);
  }
  if (!body.stream) {
    const j = await res.json();
    const c = j.choices && j.choices[0] && j.choices[0].message;
    return c ? (c.content || '') : '';
  }
  return res;
}
async function aiRequest(messages, opts) {
  const p = activeProvider();
  if (!p) throw new Error('未配置 AI 模型');
  let lastErr = null;
  const candidates = [p].concat(state.settings.providers.filter(x => x.id !== p.id));
  const maxTries = state.settings.autoModel ? Math.min(candidates.length, 3) : 1;
  for (let i = 0; i < maxTries; i++) {
    const cand = candidates[i];
    if (!cand || !cand.baseUrl || !cand.model) continue;
    try {
      return await aiRequestOnce(messages, opts, cand);
    } catch (e) {
      lastErr = e;
      const m = String(e && e.message || '');
      if (!/402|429|5\d\d|Failed to fetch|NetworkError|load failed|Load failed/i.test(m)) throw e;
      // 自动切换下一个可用模型
    }
  }
  throw lastErr || new Error('无可用模型');
}
async function* aiStream(res) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const ln = line.trim();
      if (!ln.startsWith('data:')) continue;
      const d = ln.slice(5).trim();
      if (d === '[DONE]') return;
      try {
        const j = JSON.parse(d);
        const c = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
        if (c) yield c;
      } catch (e) { }
    }
  }
}
function humanizeAIError(err) {
  const m = String(err.message || err);
  if (/Failed to fetch|NetworkError|load failed|Load failed/i.test(m))
    return '网络请求失败：可能是跨域(CORS)限制或服务未启动。本地模型请确认已运行（Ollama 需设置 OLLAMA_ORIGINS=*，或运行 node proxy.mjs 代理）；云端模型若被浏览器拦截，也请用代理转发。原始信息：' + m;
  if (/402|FREE_LIMIT|Payment/i.test(m)) return '免费模型额度已达上限或限流：请稍等几分钟重试；如需稳定高速体验，可在「⚙ AI 模型」中接入自己的模型（如 DeepSeek，充值 10 元可用很久）。原始信息：' + m;
  if (/404/.test(m)) return '404：请检查 API 地址（Base URL 通常以 /v1 结尾）或模型名称是否正确。原始信息：' + m;
  if (/401|403/.test(m)) return '鉴权失败(401/403)：请检查 API Key 是否正确。原始信息：' + m;
  if (/429/.test(m)) return '限流(429)：请求过于频繁或额度不足，请稍后再试。原始信息：' + m;
  return 'AI 请求失败：' + m;
}

/* ---------------- AI 上下文构建（记忆系统核心） ---------------- */
function formatStyleForAI() {
  const n = curNovel();
  if (!n) return '（无）';
  const gs = novelGenres(n).join('、') || t('novel.legacyGenre');
  const nar = { dialogue: t('style.dialogue'), balanced: t('style.balanced'), narrative: t('style.narrativeMode') }[n.narrative] || t('style.dialogue');
  const lines = [];
  lines.push(`用户群体：${n.audience || '通用'}；类型：${gs}；篇幅：${n.length || '未定'}；视角：${n.pov || '未定'}；基调：${n.tone || '未定'}；写法：${nar}；写作语言：${n.lang === 'en' ? '英文' : '中文'}`);
  const styleMode = n.styleMode || 'author';
  if (styleMode === 'mine' && n.styleSample && n.styleSample.trim()) {
    lines.push('【用户文风样本】请学习该样本的句式节奏、用词习惯、对话风格与叙事口吻，模仿其文风进行创作（学习文风，不抄袭内容）：\n' + n.styleSample.trim().slice(0, 500));
  } else {
    const refs = novelRefAuthors(n);
    if (refs.length) {
      const parts = refs.map(id => {
        const a = findAuthor(id);
        if (!a) return null;
        const wk = a.custom ? null : state.wikiCache[id];
        const learned = wk ? wk.text.slice(0, 500) : (a.learned ? a.learned.slice(0, 500) : '');
        return `${a.name}：技法要点——${a.tips || '（联网学习资料见后）'}${learned ? '；联网学习资料——' + learned : ''}`;
      }).filter(Boolean);
      if (parts.length) lines.push('参考作家及技法：\n' + parts.join('\n'));
    }
  }
  return lines.join('\n');
}
function formatOutlineForAI() {
  const items = state.outline.filter(o => o.novelId === state.currentNovelId).sort((a, b) => a.order - b.order);
  const vols = items.filter(i => !i.parentId);
  const st = { todo: '未开始', doing: '进行中', done: '已完成' };
  if (!vols.length) return '（无）';
  return vols.map(v => {
    const kids = items.filter(i => i.parentId === v.id).sort((a, b) => a.order - b.order);
    const lines = ['■ ' + v.title + ' [' + (st[v.status] || '') + ']'];
    if (v.note) lines.push('  卷简介：' + v.note);
    kids.forEach(k => {
      lines.push('  · ' + k.title + ' [' + (st[k.status] || '') + ']' + (k.note ? ' — ' + k.note : ''));
    });
    return lines.join('\n');
  }).join('\n');
}
function formatCharactersForAI() {
  const list = state.characters.filter(c => c.novelId === state.currentNovelId);
  if (!list.length) return '（无）';
  return list.map(c =>
    `${c.name || '?'}（${c.role || '角色'}）：外貌：${c.appearance || '—'}；性格：${c.personality || '—'}；背景：${c.background || '—'}；关系：${c.relations || '—'}；备注/伏笔：${c.notes || '—'}`
  ).join('\n');
}
function formatWorldForAI() {
  const n = curNovel();
  if (!n) return '（无）';
  const secs = (n.worldSections || []).map(s => `【${s.title || '条目'}】${s.content || ''}`).join('\n');
  return [n.synopsis ? `全书梗概：${n.synopsis}` : '', n.world ? `世界观：${n.world}` : '', secs].filter(Boolean).join('\n') || '（无）';
}
function formatMemoriesForAI() {
  const list = state.memories.filter(m => m.novelId === state.currentNovelId);
  if (!list.length) return '（无）';
  return list.map(m => `[${m.category}] ${m.content}`).join('\n');
}
function formatRecentChapters(n) {
  const chs = chaptersOf(state.currentNovelId);
  const cur = curChapter();
  const idx = cur ? chs.findIndex(c => c.id === cur.id) : -1;
  const prev = idx > 0 ? chs.slice(Math.max(0, idx - n), idx) : (chs.length ? chs.slice(-n) : []);
  return prev.map(c => `《${c.title || '未命名'}》：${(c.content || '').slice(-3000)}`).join('\n\n') || '（无前文）';
}
function buildContext(includeCurrent) {
  const n = curNovel();
  if (!n) return '';
  const s = state.settings.ctx;
  const parts = [];
  parts.push(`【小说信息】\n标题：《${n.title}》\n简介：${n.description || '（无）'}\n【风格档案】\n${formatStyleForAI()}`);
  if (s.outline) parts.push(`【全书大纲】\n${formatOutlineForAI()}`);
  if (s.chars) parts.push(`【角色卡】\n${formatCharactersForAI()}`);
  if (s.world) parts.push(`【世界观与设定】\n${formatWorldForAI()}`);
  if (s.mem) parts.push(`【记忆库】\n${formatMemoriesForAI()}`);
  const prevN = Number(s.prevChapters) || 0;
  if (prevN > 0) {
    const t2 = formatRecentChapters(prevN);
    if (t2 && !t2.startsWith('（无')) parts.push(`【前文章节（各取结尾部分）】\n${t2}`);
  }
  const c = curChapter();
  if (includeCurrent && c) {
    const full = c.content || '';
    const seg = full.length > 12000 ? full.slice(-8000) : full;
    parts.push(`【当前章节】\n标题：《${c.title || '未命名'}》\n正文（${full.length > 12000 ? '结尾部分' : '全文'}）：\n${seg}`);
  }
  return parts.join('\n\n');
}

/* ---------------- 聊天 UI ---------------- */
function renderMd(src) {
  const lines = esc(src).split('\n');
  let out = '', inCode = false, inUl = false;
  for (const line of lines) {
    if (line.startsWith('```')) {
      inCode = !inCode;
      out += inCode ? '<pre><code>' : '</code></pre>';
      continue;
    }
    if (inCode) { out += line + '\n'; continue; }
    let l = line;
    if (/^###\s/.test(l)) l = '<h4>' + l.slice(4) + '</h4>';
    else if (/^##\s/.test(l)) l = '<h3>' + l.slice(3) + '</h3>';
    else if (/^#\s/.test(l)) l = '<h2>' + l.slice(2) + '</h2>';
    else if (/^[-*]\s/.test(l)) { if (!inUl) { out += '<ul>'; inUl = true; } l = '<li>' + l.slice(2) + '</li>'; }
    else {
      if (inUl) { out += '</ul>'; inUl = false; }
      if (l === '') { out += '<div class="md-gap"></div>'; continue; }
    }
    l = l.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
    out += l;
  }
  if (inUl) out += '</ul>';
  if (inCode) out += '</code></pre>';
  return out;
}
function msgHtml(m, i) {
  const userName = (state.settings.user || {}).nickname || t('ai.you');
  if (m.role === 'user') {
    return `<div class="msg user"><div class="msg-role">${esc(userName)}</div><div class="msg-body">${esc(m.content)}</div></div>`;
  }
  const entries = m.extra && m.extra.entries;
  let body;
  if (m.kind === 'extract' && Array.isArray(entries) && entries.length) {
    body = '<ul class="extract-list">' + entries.map((e, ei) =>
      `<li class="extract-item"><span class="mem-cat" data-cat="${esc(e.category || '其他')}">${esc(e.category || '其他')}</span><span class="extract-txt">${esc(e.content)}</span><button class="btn mini" data-act="savemem" data-idx="${i}" data-ei="${ei}">◬ 存入</button></li>`
    ).join('') + '</ul>';
  } else {
    body = renderMd(m.content || '');
    if (m.kind === 'extract') body += '<div class="extract-warn">（未能解析出记忆 JSON，可直接复制文本，或让 AI 重新提取）</div>';
  }
  const btns = [];
  if ((m.kind === 'continue' || m.kind === 'polish') && m.content) btns.push(`<button class="btn mini" data-act="insert" data-idx="${i}">↩ 插入章节</button>`);
  if (m.kind === 'extract' && Array.isArray(entries) && entries.length) btns.push(`<button class="btn mini" data-act="saveall" data-idx="${i}">◬ 全部存入记忆</button>`);
  if (m.content) btns.push(`<button class="btn mini ghost" data-act="copy" data-idx="${i}">⧉ 复制</button>`);
  return `<div class="msg assistant"><div class="msg-role">${t('ai.engine')}</div><div class="msg-body md">${body}</div><div class="msg-actions">${btns.join('')}</div>${m.error ? `<div class="msg-error">${esc(m.error)}</div>` : ''}</div>`;
}
function renderChat() {
  const el = $('#ai-messages');
  el.innerHTML = state.chatForNovel.length
    ? state.chatForNovel.map((m, i) => msgHtml(m, i)).join('')
    : '<div class="empty-hint">' + t('empty.chat') + '</div>';
  el.scrollTop = el.scrollHeight;
}
function trimChat() {
  if (state.chatForNovel.length > 40) state.chatForNovel = state.chatForNovel.slice(-40);
}

/* ---------------- AI 对话 ---------------- */
function parseEntries(text) {
  try {
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return null;
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return null;
    return arr.map(e => ({ category: String(e.category || '其他'), content: String(e.content || '').trim() })).filter(e => e.content);
  } catch (e) { return null; }
}
function afterAI(asst) {
  if (!asst || asst.error) return;
  if (asst.kind === 'extract') {
    asst.extra = { entries: parseEntries(asst.content) || [] };
  }
  if (asst.content) saveChat();
  renderChat();
}
async function sendAI(userText, opts) {
  opts = opts || {};
  const n = curNovel();
  if (!n) { toast(t('toast.needNovel'), 'warn'); return; }
  const p = activeProvider();
  if (!p) { toast(t('toast.noAI'), 'warn'); openAISettings(); return; }
  if (state.aiStreaming) { toast(t('toast.aiBusy'), 'warn'); return; }
  if (state.genState.running) { toast(t('co.running'), 'warn'); return; }
  await flushSave();
  const ctx = buildContext();
  const history = state.settings.ctx.chatHistory ? state.chatForNovel.slice(-12).filter(m => !m.error) : [];
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  if (ctx) messages.push({ role: 'user', content: `以下是这部小说当前的完整状态（即你的记忆）：\n\n${ctx}\n\n—— 请先内化以上信息，再回应接下来的问题。` });
  messages.push(...history, { role: 'user', content: userText });

  state.chatForNovel.push({ role: 'user', content: userText });
  const asst = { role: 'assistant', content: '', kind: opts.kind || null, extra: opts.extra || null, error: null };
  state.chatForNovel.push(asst);
  trimChat(); renderChat(); saveChat();

  state.aiStreaming = true;
  state.aiAbort = new AbortController();
  $('#btn-ai-send').disabled = true;
  $('#btn-ai-stop').style.display = '';
  const listEl = $('#ai-messages');
  const lastEl = listEl.lastElementChild;
  const bodyEl = lastEl ? lastEl.querySelector('.md') : null;
  let acc = '';
  const tick = () => { if (bodyEl) bodyEl.innerHTML = renderMd(acc); listEl.scrollTop = listEl.scrollHeight; };
  try {
    const res = await aiRequest(messages, { stream: true });
    for await (const chunk of aiStream(res)) {
      acc += chunk;
      requestAnimationFrame(tick);
    }
    asst.content = acc;
    tick();
  } catch (err) {
    if (err.name === 'AbortError') { asst.content = acc; }
    else {
      // 流式失败时自动改用非流式重试一次（免费模型偶发限流时更稳）
      let fallbackOk = false;
      try {
        const txt = await aiRequest(messages, { stream: false, maxTokens: 1500 });
        if (txt && txt.trim()) {
          acc = txt;
          asst.content = acc;
          fallbackOk = true;
          if (bodyEl) bodyEl.innerHTML = renderMd(acc);
          listEl.scrollTop = listEl.scrollHeight;
        }
      } catch (e2) { }
      if (!fallbackOk) {
        asst.error = asst.content ? null : humanizeAIError(err);
      }
    }
    renderChat(); saveChat();
  } finally {
    state.aiStreaming = false;
    state.aiAbort = null;
    $('#btn-ai-send').disabled = false;
    $('#btn-ai-stop').style.display = 'none';
  }
  if (!asst.content && !asst.error) asst.error = '模型返回了空内容：可能是免费额度限流或网络波动，请稍后重试，或在「⚙ AI 模型」中接入自己的模型。';
  afterAI(asst);
}
function quickPrompt(action) {
  const ed = $('#editor');
  const c = curChapter();
  const sel = ed.value.substring(ed.selectionStart, ed.selectionEnd);
  const n = curNovel();
  const langNote = n && n.lang === 'en' ? (state.settings.lang === 'zh' ? '（本小说写作语言为英文，请用英文输出）' : ' (This novel is written in English — output in English)') : '';
  switch (action) {
    case 'continue': {
      if (!c) { toast(t('toast.needChapter'), 'warn'); return; }
      const tail = ($('#editor').value || c.content || '').slice(-2500);
      sendAI(`请接着《${c.title || ''}》继续写下去。直接输出正文，不要任何解释。结尾落在剧情自然节点，为下一段留下悬念。${langNote}\n\n本章末尾原文（供衔接）：\n\n${tail}`, { kind: 'continue' });
      break;
    }
    case 'plot':
      sendAI('请基于当前剧情，推演接下来 3–5 条可能的情节走向：每条给出【走向】【看点】【风险/代价】【推荐理由】，最后给出综合建议。', { kind: null });
      break;
    case 'brainstorm':
      sendAI('请围绕当前故事与设定，输出 10 个脑洞创意：可以是反转、新角色、新设定、名场面、番外等，每个一句话点题 + 一句展开。', { kind: null });
      break;
    case 'polish': {
      const target = sel || ($('#editor').value || (c ? c.content : '') || '').slice(-1500);
      if (!target) { toast(t('toast.nothingPolish'), 'warn'); return; }
      sendAI(`请润色以下文字：保持原意、人称与风格，提升画面感、节奏与文笔，直接输出润色后的正文，不要解释。${langNote}\n\n${target}`, { kind: 'polish' });
      break;
    }
    case 'extract': {
      if (!c) { toast(t('toast.needChapterOpen'), 'warn'); return; }
      sendAI('请从当前章节（以及上下文）中提取新增的关键记忆，用于后续写作时保持一致性。只输出 JSON 数组，格式：[{"category":"情节|人物|伏笔|世界|其他","content":"一句话要点"}]。不要输出其他文字。\n要求：每条不超过 50 字；只提取本章新增、且值得长期记住的信息；3–10 条。', { kind: 'extract' });
      break;
    }
    case 'outline':
      sendAI('请根据小说简介、风格档案、设定与现有大纲，输出一份分卷分章的大纲草案：每卷给出卷名与一句话主题，每章给出章名与 1–2 句情节要点，并在结尾标注与现有大纲的衔接建议。', { kind: null });
      break;
    case 'style': {
      if (!c) { toast(t('toast.needChapterOpen'), 'warn'); return; }
      const refs = novelRefAuthors(n).map(id => { const a = findAuthor(id); return a ? a.name : id; }).filter(Boolean).join('、');
      const tail = (c.content || '').slice(-2500);
      sendAI(`请诊断以下小说片段的文笔：句式是否重复、对话是否自然、有无套路化表达、细节与五感描写是否充分${refs ? '，并对照参考作家（' + refs + '）的技法' : ''}，给出 3–5 条具体可执行的修改建议（可引用原文短句做例子），最后给一句整体评价。\n\n${tail}`, { kind: null });
      break;
    }
  }
}
async function insertAssistant(idx) {
  const m = state.chatForNovel[idx];
  if (!m || !m.content) return;
  const c = curChapter();
  if (!c) { toast(t('toast.needChapterOpen'), 'warn'); return; }
  const ed = $('#editor');
  const pos = ed.selectionStart != null ? ed.selectionStart : ed.value.length;
  const text = '\n\n' + m.content.trim() + '\n\n';
  ed.value = ed.value.slice(0, pos) + text + ed.value.slice(pos);
  ed.focus();
  const np = pos + text.length;
  ed.setSelectionRange(np, np);
  scheduleSave(); updateCounts();
  toast(t('toast.inserted'), 'ok');
}
async function saveMemFromMsg(idx, ei, all) {
  const m = state.chatForNovel[idx];
  const entries = m && m.extra ? m.extra.entries : null;
  if (!Array.isArray(entries) || !entries.length) return;
  const list = all ? entries : [entries[ei]];
  let saved = 0;
  for (const e of list) {
    if (!e.content) continue;
    const mem = { id: uid(), novelId: state.currentNovelId, category: e.category || '其他', content: e.content, source: 'AI 提取', createdAt: now() };
    state.memories.push(mem);
    await dbPut(STORE.memories, mem);
    saved++;
  }
  if (state.module === 'memories') renderPanel();
  toast(t('toast.memAdded', { n: saved }), 'ok');
}

/* ---------------- 章节联网生成（大纲 → 正文） ---------------- */
const GEN_STAGES = ['gp.search', 'gp.style', 'gp.draft', 'gp.write'];
function renderGenStages(note) {
  const gs = state.genState;
  const box = $('#gen-stages');
  box.innerHTML = GEN_STAGES.map((key, i) => {
    const cls = i < gs.stageIdx ? 'done' : (i === gs.stageIdx ? 'active' : '');
    const ico = i < gs.stageIdx ? '✓' : (i === gs.stageIdx ? '⟳' : '○');
    return `<div class="gp-stage ${cls}"><span class="gp-ico">${ico}</span><span>${t(key)}</span></div>`;
  }).join('');
  $('#gp-note').textContent = note || '';
}
async function genSetStage(idx, note) {
  state.genState.stageIdx = idx;
  renderGenStages(note);
  await new Promise(r => setTimeout(r, 400));
}
function hideGenProgress() {
  $('#gen-progress').hidden = true;
  $('#btn-gen-chapter').disabled = false;
  $('#btn-gen-again').disabled = false;
  $('#gen-hint').textContent = '';
}
function showGenProgress() {
  state.genState.stageIdx = -1;
  $('#gp-title').textContent = t('gp.title');
  $('#gen-progress').hidden = false;
  $('#btn-gen-chapter').disabled = true;
  $('#btn-gen-again').disabled = true;
  $('#gen-hint').textContent = t('co.running');
  renderGenStages('');
}
async function aiCallRetry(messages, opts, stageNote) {
  let lastErr = null;
  const maxTries = 3;
  for (let i = 0; i < maxTries; i++) {
    try {
      return await aiRequest(messages, opts);
    } catch (e) {
      lastErr = e;
      const m = String(e && e.message || '');
      const isQuota = /402|FREE_LIMIT/i.test(m);
      const isBusy = /400|502|503|504/i.test(m);
      if (i < maxTries - 1 && (isQuota || isBusy)) {
        const waitMs = isQuota ? 25000 : 5000;
        const waitTxt = state.settings.lang === 'zh'
          ? (isQuota ? '免费额度限流' : '服务繁忙') + '，' + Math.round(waitMs / 1000) + ' 秒后自动重试…'
          : (isQuota ? 'Quota limited' : 'Service busy') + ', retrying in ' + Math.round(waitMs / 1000) + 's…';
        renderGenStages((stageNote || '') + '（' + waitTxt + '）');
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}
function narrativeHint(n) {
  if (!n) return '';
  const m = n.narrative || 'dialogue';
  if (m === 'dialogue') return '写作手法要求：以人物对话为主要呈现方式，用对话推动剧情，旁白精简克制。';
  if (m === 'narrative') return '写作手法要求：以叙述旁白为主，注重场景描写与心理铺陈，对话为辅。';
  return '写作手法要求：对话与叙述均衡搭配。';
}
async function genDraft(outline, planCtx) {
  const n = curNovel();
  const nar = narrativeHint(n);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: planCtx + '\n\n【本章大纲】\n' + outline + (nar ? '\n\n' + nar : '') + '\n\n请为本章拟写细纲，只输出：\n【核心】一句话概括本章\n【情节节点】3-6 条\n【开头钩子】1-2 句。不要写正文。' }
  ];
  const res = await aiCallRetry(messages, { stream: true }, t('gp.draft'));
  let acc = '';
  for await (const chunk of aiStream(res)) acc += chunk;
  return (acc || '').trim();
}
async function genStreamIntoEditor(outline, plan, planCtx) {
  const n = curNovel();
  const nar = narrativeHint(n);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: planCtx + '\n\n【本章大纲】\n' + outline + (nar ? '\n\n' + nar : '') + '\n\n【细纲】\n' + plan + '\n\n请根据以上内容撰写本章正文。要求：像人类作家一样写作（句式长短交错、对话自然、细节具体），直接输出正文，不要标题、不要解释。' }
  ];
  const res = await aiCallRetry(messages, { stream: true }, t('gp.write'));
  const ed = $('#editor');
  let acc = '';
  for await (const chunk of aiStream(res)) {
    acc += chunk;
    ed.value = acc;
    ed.scrollTop = ed.scrollHeight;
    updateCounts();
  }
  if (!acc.trim()) throw new Error('empty');
  return acc;
}
async function generateChapter() {
  const c = curChapter();
  if (!c) return toast(t('co.needChapter'), 'warn');
  const outline = $('#chapter-outline').value.trim();
  if (!outline) { toast(t('co.needOutline'), 'warn'); $('#chapter-outline').focus(); return; }
  if (state.genState.running) return;
  if (state.aiStreaming) { toast(t('toast.aiBusy'), 'warn'); return; }
  const p = activeProvider();
  if (!p) { toast(t('toast.noAI'), 'warn'); openAISettings(); return; }
  const ed = $('#editor');
  if (ed.value.trim() && !await confirmDialog(t('co.confirmOverwrite'))) return;
  await flushSave();
  const n = curNovel();
  const planCtx = buildContext(false) || '（无上下文）';
  state.genState.running = true;
  state.genState.abort = new AbortController();
  state.aiAbort = state.genState.abort;
  showGenProgress();
  try {
    // 阶段1：搜索作家
    await genSetStage(0, '');
    const refs = novelRefAuthors(n);
    const pending = refs.filter(id => {
      const a = findAuthor(id);
      return a && !a.custom && !(state.wikiCache[id] && state.wikiCache[id].text);
    });
    for (let i = 0; i < pending.length; i++) {
      const a = findAuthor(pending[i]);
      renderGenStages(t('learn.fetching', { name: a ? a.name : '' }));
      try { await wikiLearn(pending[i]); } catch (e) { }
    }
    // 阶段2：学习作家文风
    const refNames = refs.map(id => { const a = findAuthor(id); return a ? a.name : ''; }).filter(Boolean).join('、');
    await genSetStage(1, refNames || '');
    // 阶段3：拟写正文
    await genSetStage(2, '');
    const plan = await genDraft(outline, planCtx);
    if (!plan) throw new Error('draft-empty');
    renderGenStages(plan.slice(0, 140));
    await new Promise(r => setTimeout(r, 500));
    // 阶段4：输出正文
    await genSetStage(3, '');
    await genStreamIntoEditor(outline, plan, planCtx);
    updateCounts(); scheduleSave();
    state.genState.running = false;
    state.aiAbort = null;
    renderGenStages('');
    $('#gp-title').textContent = '✓ ' + t('gp.title');
    toast(t('co.done'), 'ok', 4000);
    setTimeout(hideGenProgress, 2200);
  } catch (e) {
    const aborted = e && e.name === 'AbortError';
    state.genState.running = false;
    state.aiAbort = null;
    hideGenProgress();
    if (aborted) toast(t('co.cancelled'));
    else toast(humanizeAIError(e), 'err', 6000);
  }
}
function cancelGen() { if (state.genState.running && state.genState.abort) state.genState.abort.abort(); }

/* ---------------- 自定义作家（联网搜索添加） ---------------- */
function setAuStatus(txt, err) {
  const el = $('#au-status');
  if (!el) return;
  el.textContent = txt || '';
  el.className = 'learn-status' + (err ? ' err' : '');
}
async function addCustomAuthorByName() {
  const input = $('#author-search-input');
  if (!input) return;
  const name = (input.value || '').trim();
  if (!name) return toast(t('au.needName'), 'warn');
  const btn = $('#btn-author-search');
  if (btn) btn.disabled = true;
  setAuStatus(t('au.searching'));
  try {
    const r = await fetch('https://zh.wikipedia.org/w/api.php?action=opensearch&search=' + encodeURIComponent(name) + '&limit=5&format=json&origin=*', { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error('search fail');
    const j = await r.json();
    const titles = (j && j[1]) || [];
    if (!titles.length) { setAuStatus(t('au.notfound'), true); return; }
    const title = String(titles[0]);
    const r2 = await fetch('https://zh.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&origin=*&redirects=1&titles=' + encodeURIComponent(title), { signal: AbortSignal.timeout(12000) });
    if (!r2.ok) throw new Error('extract fail');
    const j2 = await r2.json();
    const pages = j2 && j2.query && j2.query.pages;
    const extract = pages ? (Object.values(pages)[0].extract || '') : '';
    if (!extract) { setAuStatus(t('au.notfound'), true); return; }
    state.settings.customAuthors = state.settings.customAuthors || [];
    const au = { id: 'c-' + uid(), name: title, wikiTitle: title, tips: '', learned: extract.slice(0, 1200), createdAt: now() };
    state.settings.customAuthors.unshift(au);
    if (state.settings.customAuthors.length > 50) state.settings.customAuthors.length = 50;
    saveSettings();
    const n = curNovel();
    if (n) {
      const refs = novelRefAuthors(n);
      if (!refs.includes(au.id)) { refs.push(au.id); await dbPut(STORE.novels, n); }
    }
    input.value = '';
    setAuStatus(t('au.added', { name: title }));
    renderPanel();
  } catch (e) {
    setAuStatus(t('au.fail'), true);
  } finally {
    if (btn) btn.disabled = false;
  }
}
async function delCustomAuthor(id) {
  if (!await confirmDialog(t('au.del'))) return;
  state.settings.customAuthors = (state.settings.customAuthors || []).filter(a => a.id !== id);
  saveSettings();
  renderPanel();
  for (const n of state.novels) {
    if (Array.isArray(n.refAuthors) && n.refAuthors.includes(id)) {
      n.refAuthors = n.refAuthors.filter(x => x !== id);
      await dbPut(STORE.novels, n);
    }
  }
}

/* ---------------- 反馈 ---------------- */
async function submitFeedback() {
  const msg = $('#feedback-text').value.trim();
  if (!msg) return toast(t('fb.needMsg'), 'warn');
  const btn = $('#btn-fb-send');
  btn.disabled = true;
  try {
    const res = await fetch('https://formsubmit.co/ajax/3254643926@qq.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        _subject: '【晓星反馈】',
        message: msg,
        nickname: (state.settings.user || {}).nickname || '',
        page: location.href,
        time: new Date().toISOString()
      })
    });
    const j = await res.json();
    if (j && (j.success === true || j.success === 'true')) {
      $('#feedback-text').value = '';
      closeModal('modal-feedback');
      toast(t('fb.thanks'), 'ok', 3500);
    } else {
      throw new Error('submit fail');
    }
  } catch (e) {
    toast(t('fb.fail'), 'err', 4500);
  } finally {
    btn.disabled = false;
  }
}

/* ---------------- UI 偏好 ---------------- */
function applyUIPrefs() {
  document.documentElement.style.setProperty('--accent', ACCENTS[state.settings.accent] || ACCENTS.cyan);
  document.body.classList.toggle('no-ai', !state.settings.aiPanelOpen);
  document.body.classList.toggle('split-layout', state.settings.layout === 'split');
  document.body.classList.toggle('hide-pet', !state.settings.petVisible);
  // 动态背景
  bgMode = state.settings.bg || 'stars';
  const bgChips = { stars: 'set-bg-stars', solar: 'set-bg-solar', galaxy: 'set-bg-galaxy', planet: 'set-bg-planet' };
  Object.keys(bgChips).forEach(k => { const el = $('#' + bgChips[k]); if (el) el.classList.toggle('on', k === bgMode); });
  // 存储状态
  $('#storage-warn').hidden = !state.settings.storageDenied;
  $('#set-storage-val').textContent = state.settings.storageDenied ? t('set.storageNo') : t('set.storageOk');
  // 小助手开关
  $('#set-pet-on').classList.toggle('on', !!state.settings.petVisible);
  $('#set-pet-off').classList.toggle('on', !state.settings.petVisible);
  $('#set-auto-model').checked = !!state.settings.autoModel;
  applyPetPos();
  $('#editor').style.fontSize = state.settings.fontSize + 'px';
  const s = state.settings.ctx;
  $('#ctx-outline').checked = !!s.outline;
  $('#ctx-chars').checked = !!s.chars;
  $('#ctx-world').checked = !!s.world;
  $('#ctx-mem').checked = !!s.mem;
  $('#ctx-chat-history').checked = !!s.chatHistory;
  $('#ctx-chapters').value = s.prevChapters;
  const prevMax = PLAN_PREV_MAX[state.settings.plan] || 2;
  $('#ctx-chapters').max = prevMax;
  if (Number(s.prevChapters) > prevMax) $('#ctx-chapters').value = prevMax;
  $$('.accent-dot').forEach(d => d.classList.toggle('on', d.dataset.accent === state.settings.accent));
  applyI18n();
  renderProfileTop();
}
function renderAll() {
  renderTop();
  setNavActive();
  renderPanel();
  renderEditor();
  renderModelTag();
  renderChat();
  applyUIPrefs();
}

/* ---------------- 动态背景（星空 / 太阳系 / 银河系 / 星球 · 拟真渲染 · 全部自绘无版权素材） ---------------- */
let bgCtx = null, bgW = 0, bgH = 0, bgMode = 'stars', bgEntities = [];
let bgNebula = [], bgBand = [], bgSunspots = [], bgGalaxy = [], bgAsteroids = [];
function bgResize() {
  const cv = $('#starfield');
  bgW = cv.width = innerWidth; bgH = cv.height = innerHeight;
  bgEntities = [];
  bgNebula = [];
  const nebulaColors = ['124,92,255', '0,224,255', '255,79,216', '90,140,220'];
  const nebulaAlphas = [0.12, 0.10, 0.07, 0.12];
  for (let i = 0; i < 4; i++) {
    bgNebula.push({
      x: Math.random() * bgW, y: Math.random() * bgH,
      r: (0.25 + Math.random() * 0.4) * Math.min(bgW, bgH),
      c: nebulaColors[i], a: nebulaAlphas[i],
      p: Math.random() * 6.28
    });
  }
  bgBand = Array.from({ length: 160 }, () => ({
    x: Math.random() * bgW, y: Math.random() * bgH,
    r: Math.random() * 0.8 + 0.2, d: Math.random() * 1.2, p: Math.random() * 6.28
  }));
  bgSunspots = Array.from({ length: 160 }, () => ({
    a: Math.random() * 6.28, d: Math.random(), r: Math.random() * 3 + 0.6,
    c: ['255,190,90', '255,140,60', '255,220,150'][Math.floor(Math.random() * 3)]
  }));
  bgGalaxy = Array.from({ length: 700 }, () => {
    const rad = 16 + Math.pow(Math.random(), 0.62) * Math.min(bgW, bgH) * 0.42;
    return {
      rad, arm: Math.random() < 0.5 ? 0 : Math.PI,
      off: (Math.random() - 0.5) * 0.55,
      size: Math.random() * 1.6 + 0.4,
      warm: Math.random() > 0.72,
      alpha: Math.random() * 0.85 + 0.1
    };
  });
  bgAsteroids = Array.from({ length: 90 }, () => ({ a: Math.random() * 6.28, d: 0.82 + Math.random() * 0.12, r: Math.random() * 1.6 + 0.5, s: 0.08 + Math.random() * 0.05 }));
}
function bgInit() {
  bgCtx = $('#starfield').getContext('2d');
  bgResize();
  addEventListener('resize', bgResize);
  const step = ts => {
    if (!bgCtx) return;
    const ctx = bgCtx, W = bgW, H = bgH;
    ctx.clearRect(0, 0, W, H);
    try {
      if (bgMode === 'solar') drawSolar(ctx, W, H, ts);
      else if (bgMode === 'galaxy') drawGalaxy(ctx, W, H, ts);
      else if (bgMode === 'planet') drawPlanet(ctx, W, H, ts);
      else drawStars(ctx, W, H, ts);
    } catch (e) {
      // 任何绘制异常都不允许整幅背景消失：回退到星空
      try { drawStars(ctx, W, H, ts); } catch (e2) { }
    }
    try { drawVignette(ctx, W, H); } catch (e3) { }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function setBgMode(m) {
  bgMode = m;
  state.settings.bg = m;
  saveSettings();
  const chips = { stars: 'set-bg-stars', solar: 'set-bg-solar', galaxy: 'set-bg-galaxy', planet: 'set-bg-planet' };
  Object.keys(chips).forEach(k => {
    const el = $('#' + chips[k]);
    if (el) el.classList.toggle('on', k === m);
  });
}
function drawVignette(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,12,.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
function drawNebula(ctx, W, H, ts) {
  for (const nb of bgNebula) {
    const pulse = 1 + Math.sin(ts / 2600 + nb.p) * 0.3;
    const a = Math.min(0.32, Math.max(0, nb.a * pulse));
    const r = nb.r * pulse;
    const g = ctx.createRadialGradient(nb.x, nb.y, 0, nb.x, nb.y, r);
    g.addColorStop(0, `rgba(${nb.c},${a})`);
    g.addColorStop(0.55, `rgba(${nb.c},${(a * 0.45).toFixed(3)})`);
    g.addColorStop(1, `rgba(${nb.c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(nb.x - r, nb.y - r, r * 2, r * 2);
  }
}
function drawStars(ctx, W, H, ts) {
  if (!bgEntities.length) {
    bgEntities = Array.from({ length: Math.min(230, Math.floor(W * H / 8000)) }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5 + 0.25,
      tw: Math.random() * Math.PI * 2,
      ts: 900 + Math.random() * 1800,
      c: Math.random() < 0.12 ? '255,225,180' : (Math.random() < 0.3 ? '190,215,255' : '165,205,255')
    }));
  }
  drawNebula(ctx, W, H, ts);
  for (const b of bgBand) {
    const bx = ((b.x + ts * 0.006 * b.d) % W + W) % W;
    const by = (b.y + Math.sin(ts / 4000 + b.p) * 6 + H) % H;
    ctx.fillStyle = `rgba(200,215,255,${0.12 + Math.abs(Math.sin(ts / 1600 + b.p)) * 0.1})`;
    ctx.fillRect(bx, by, b.r, b.r);
  }
  for (const st of bgEntities) {
    const a = 0.3 + 0.55 * Math.abs(Math.sin(ts / st.ts + st.tw));
    ctx.fillStyle = `rgba(${st.c},${a})`;
    ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 7); ctx.fill();
    if (st.r > 1.2) {
      ctx.strokeStyle = `rgba(${st.c},${a * 0.25})`;
      ctx.beginPath(); ctx.moveTo(st.x - st.r * 2.4, st.y); ctx.lineTo(st.x + st.r * 2.4, st.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(st.x, st.y - st.r * 2.4); ctx.lineTo(st.x, st.y + st.r * 2.4); ctx.stroke();
    }
    st.x -= 0.015;
    if (st.x < 0) st.x = W;
  }
  if (Math.random() < 0.006) {
    const sx = Math.random() * W, sy = Math.random() * H * 0.5;
    const g = ctx.createLinearGradient(sx, sy, sx - 180, sy - 90);
    g.addColorStop(0, 'rgba(210,235,255,.95)'); g.addColorStop(1, 'rgba(210,235,255,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 180, sy - 90); ctx.stroke();
    const hg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 8);
    hg.addColorStop(0, 'rgba(240,248,255,.9)'); hg.addColorStop(1, 'rgba(240,248,255,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(sx, sy, 8, 0, 7); ctx.fill();
  }
}
function drawSolar(ctx, W, H, ts) {
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) * 0.055;
  drawStars(ctx, W, H, ts);
  // 日冕与光晕
  const puls = 1 + Math.sin(ts / 2400) * 0.04;
  const corona = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 7 * puls);
  corona.addColorStop(0, 'rgba(255,190,90,.5)');
  corona.addColorStop(0.25, 'rgba(255,160,70,.18)');
  corona.addColorStop(0.6, 'rgba(255,120,60,.05)');
  corona.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = corona;
  ctx.fillRect(0, 0, W, H);
  // 太阳本体：米粒组织
  const sunG = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.25, R * 0.1, cx, cy, R * 1.05 * puls);
  sunG.addColorStop(0, '#fff7d8'); sunG.addColorStop(0.5, '#ffd27a'); sunG.addColorStop(0.85, '#ff9a3c'); sunG.addColorStop(1, '#e8762a');
  ctx.fillStyle = sunG;
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.05 * puls, 0, 7); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.05 * puls, 0, 7); ctx.clip();
  for (const sp of bgSunspots) {
    const px = cx + Math.cos(sp.a) * sp.d * R * 0.95;
    const py = cy + Math.sin(sp.a) * sp.d * R * 0.95;
    ctx.fillStyle = `rgba(${sp.c},${(0.35 + Math.random() * 0.2).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(px, py, sp.r, 0, 7); ctx.fill();
  }
  ctx.restore();
  // 行星（光照来自太阳：面向中心亮、背向暗）
  const planets = [
    { d: R * 3.4, r: R * 0.16, c: ['#d9b98a', '#6e5736'], sp: 0.5 },
    { d: R * 5, r: R * 0.24, c: ['#a8d8f0', '#2c5a7a'], sp: 0.38 },
    { d: R * 6.8, r: R * 0.3, c: ['#6fb4e8', '#163c5e'], sp: 0.3 },
    { d: R * 8.6, r: R * 0.2, c: ['#e8895f', '#5e2a18'], sp: 0.25 },
    { d: R * 11.5, r: R * 0.52, c: ['#e8c188', '#6e4f22'], sp: 0.18, ring: true },
    { d: R * 14.4, r: R * 0.44, c: ['#dccfb0', '#5e5438'], sp: 0.13 },
    { d: R * 16.8, r: R * 0.32, c: ['#8fd0e0', '#27536b'], sp: 0.1 },
    { d: R * 18.6, r: R * 0.3, c: ['#7d9ce8', '#232c66'], sp: 0.08 }
  ];
  planets.forEach(p => {
    ctx.strokeStyle = 'rgba(110,150,200,.14)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy, p.d, p.d * 0.36, 0, 0, 7); ctx.stroke();
    const a = ts / 1000 * p.sp;
    const px = cx + Math.cos(a) * p.d, py = cy + Math.sin(a) * p.d * 0.36;
    if (p.ring) {
      ctx.strokeStyle = 'rgba(226,204,160,.5)';
      ctx.lineWidth = p.r * 0.34;
      ctx.beginPath(); ctx.ellipse(px, py, p.r * 2.1, p.r * 0.62, -0.32, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(160,140,110,.35)';
      ctx.lineWidth = p.r * 0.16;
      ctx.beginPath(); ctx.ellipse(px, py, p.r * 1.72, p.r * 0.5, -0.32, 0, 7); ctx.stroke();
    }
    const lx = cx - px, ly = cy - py;
    const ld = Math.hypot(lx, ly) || 1;
    const g = ctx.createRadialGradient(px + lx / ld * p.r * 0.45, py + ly / ld * p.r * 0.45, p.r * 0.1, px, py, p.r);
    g.addColorStop(0, p.c[0]); g.addColorStop(0.72, p.c[0]); g.addColorStop(1, p.c[1]);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, p.r, 0, 7); ctx.fill();
    const sh = ctx.createRadialGradient(px - lx / ld * p.r * 0.8, py - ly / ld * p.r * 0.8, p.r * 0.4, px - lx / ld * p.r * 0.8, py - ly / ld * p.r * 0.8, p.r * 1.15);
    sh.addColorStop(0, 'rgba(0,0,10,.55)'); sh.addColorStop(1, 'rgba(0,0,10,0)');
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.arc(px, py, p.r, 0, 7); ctx.fill();
  });
  // 小行星带
  for (const ast of bgAsteroids) {
    const a = ts / 1000 * ast.s + ast.a;
    const x = cx + Math.cos(a) * R * 9.8, y = cy + Math.sin(a) * R * 9.8 * 0.36;
    ctx.fillStyle = 'rgba(200,190,170,.5)';
    ctx.fillRect(x, y, ast.r, ast.r);
  }
}
function drawGalaxy(ctx, W, H, ts) {
  const cx = W / 2, cy = H / 2;
  drawStars(ctx, W, H, ts);
  // 星系晕
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.42);
  halo.addColorStop(0, 'rgba(255,235,190,.34)');
  halo.addColorStop(0.18, 'rgba(200,170,255,.16)');
  halo.addColorStop(0.55, 'rgba(124,92,255,.06)');
  halo.addColorStop(1, 'rgba(124,92,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);
  const rot = ts / 24000;
  // 尘埃带（暗纹旋臂）
  ctx.save();
  ctx.translate(cx, cy);
  for (const armOff of [0, Math.PI]) {
    ctx.strokeStyle = 'rgba(10,8,24,.5)';
    ctx.lineWidth = Math.min(W, H) * 0.05;
    for (let r = 20; r < Math.min(W, H) * 0.4; r += 6) {
      const a = armOff + rot * (46 / r) + r * 0.012;
      ctx.beginPath(); ctx.arc(0, 0, r, a - 0.02, a + 0.02);
      ctx.stroke();
    }
  }
  ctx.restore();
  // 旋臂恒星（较差自转 + 对数旋臂）
  for (const st of bgGalaxy) {
    const a = st.arm + rot * (52 / st.rad) + st.rad * 0.011 + st.off;
    const x = cx + Math.cos(a) * st.rad, y = cy + Math.sin(a) * st.rad * 0.46;
    const alpha = st.alpha * Math.max(0.15, 1 - st.rad / (Math.min(W, H) * 0.45));
    ctx.fillStyle = st.warm ? `rgba(255,214,160,${alpha})` : `rgba(175,210,255,${alpha})`;
    ctx.fillRect(x, y, st.size, st.size);
  }
  // 核心
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.09);
  core.addColorStop(0, 'rgba(255,248,225,.95)');
  core.addColorStop(0.4, 'rgba(255,214,160,.55)');
  core.addColorStop(1, 'rgba(255,214,160,0)');
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(cx, cy, Math.min(W, H) * 0.09, 0, 7); ctx.fill();
}
function drawPlanet(ctx, W, H, ts) {
  drawStars(ctx, W, H, ts);
  const px = W * 0.24, py = H * 0.58, pr = Math.min(W, H) * 0.27;
  const ringTilt = -0.42;
  // 大气辉光
  const atm = ctx.createRadialGradient(px, py, pr * 0.85, px, py, pr * 1.22);
  atm.addColorStop(0, 'rgba(120,200,240,0)');
  atm.addColorStop(0.75, 'rgba(120,200,240,.25)');
  atm.addColorStop(1, 'rgba(120,200,240,0)');
  ctx.fillStyle = atm;
  ctx.beginPath(); ctx.arc(px, py, pr * 1.22, 0, 7); ctx.fill();
  // 环（后半段：在行星之后）
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ringTilt);
  for (const [rw, rh, c, lw] of [[1.75, 0.5, 'rgba(226,204,165,.55)', pr * 0.1], [1.55, 0.43, 'rgba(150,130,105,.4)', pr * 0.05], [1.9, 0.55, 'rgba(190,170,140,.3)', pr * 0.03]]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.ellipse(0, 0, pr * rw, pr * rh, 0, 0, 7); ctx.stroke();
  }
  ctx.restore();
  // 行星本体：气体巨行星条带 + 昼夜明暗
  const g = ctx.createRadialGradient(px - pr * 0.45, py - pr * 0.5, pr * 0.08, px, py, pr);
  g.addColorStop(0, '#cfe8f5'); g.addColorStop(0.45, '#5d9ec8'); g.addColorStop(0.8, '#23486e'); g.addColorStop(1, '#0c1a30');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(px, py, pr, 0, 7); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(px, py, pr, 0, 7); ctx.clip();
  const drift = Math.sin(ts / 9000) * pr * 0.04;
  for (let i = -3; i <= 3; i++) {
    const bandY = py + i * pr * 0.22 + drift;
    ctx.strokeStyle = i % 2 ? 'rgba(255,240,215,.14)' : 'rgba(15,35,60,.2)';
    ctx.lineWidth = pr * (0.1 + Math.abs(i) * 0.02);
    ctx.beginPath(); ctx.ellipse(px, bandY, pr * 1.05, pr * 0.12, 0, 0, 7); ctx.stroke();
  }
  const night = ctx.createLinearGradient(px - pr, py, px + pr * 1.6, py);
  night.addColorStop(0, 'rgba(0,0,0,0)');
  night.addColorStop(0.55, 'rgba(2,6,16,0)');
  night.addColorStop(1, 'rgba(2,6,16,.82)');
  ctx.fillStyle = night;
  ctx.fillRect(px - pr, py - pr, pr * 2.6, pr * 2);
  ctx.restore();
  // 环（前半段：越过行星前方）
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ringTilt);
  ctx.strokeStyle = 'rgba(235,215,180,.6)';
  ctx.lineWidth = pr * 0.1;
  ctx.beginPath(); ctx.ellipse(0, 0, pr * 1.75, pr * 0.5, 0, 0.06 * Math.PI, 0.94 * Math.PI); ctx.stroke();
  ctx.strokeStyle = 'rgba(160,145,115,.4)';
  ctx.lineWidth = pr * 0.05;
  ctx.beginPath(); ctx.ellipse(0, 0, pr * 1.55, pr * 0.43, 0, 0.05 * Math.PI, 0.95 * Math.PI); ctx.stroke();
  ctx.restore();
  // 环投在行星上的影子
  ctx.strokeStyle = 'rgba(5,10,20,.35)';
  ctx.lineWidth = pr * 0.09;
  ctx.beginPath(); ctx.ellipse(px, py, pr * 0.98, pr * 0.1, 0, 0.55 * Math.PI, 1.3 * Math.PI); ctx.stroke();
  // 卫星
  const moonA = ts / 1300;
  const mx = px + Math.cos(moonA) * pr * 2.4, my = py + Math.sin(moonA) * pr * 2.4 * 0.3;
  const mg = ctx.createRadialGradient(mx - pr * 0.06, my - pr * 0.06, pr * 0.02, mx, my, pr * 0.16);
  mg.addColorStop(0, '#e8e8ee'); mg.addColorStop(0.6, '#a8a8b8'); mg.addColorStop(1, '#3c3c50');
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.arc(mx, my, pr * 0.16, 0, 7); ctx.fill();
  // 远方恒星耀斑
  const flare = ctx.createRadialGradient(W * 0.86, H * 0.16, 0, W * 0.86, H * 0.16, 44 + Math.sin(ts / 1800) * 6);
  flare.addColorStop(0, 'rgba(255,250,235,.95)'); flare.addColorStop(1, 'rgba(255,250,235,0)');
  ctx.fillStyle = flare;
  ctx.beginPath(); ctx.arc(W * 0.86, H * 0.16, 44 + Math.sin(ts / 1800) * 6, 0, 7); ctx.fill();
  const cross = ctx.createLinearGradient(W * 0.86 - 90, H * 0.16, W * 0.86 + 90, H * 0.16);
  cross.addColorStop(0, 'rgba(255,250,235,0)'); cross.addColorStop(0.5, 'rgba(255,250,235,.5)'); cross.addColorStop(1, 'rgba(255,250,235,0)');
  ctx.strokeStyle = cross; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(W * 0.86 - 90, H * 0.16); ctx.lineTo(W * 0.86 + 90, H * 0.16); ctx.stroke();
}

/* ---------------- 用户须知 · 用户守则 ---------------- */
function termsAccepted() {
  try { return localStorage.getItem('nebula-terms-v1') === '1'; } catch (e) { return true; }
}
function openTerms() {
  $('#terms-agree-chk').checked = false;
  $('#btn-terms-agree').disabled = true;
  openModal('modal-terms');
}

async function setStyleMode(mode) {
  const n = curNovel();
  if (!n) return;
  n.styleMode = mode;
  renderPanel();
  await dbPut(STORE.novels, n);
  toast(t('toast.styleSaved'), 'ok');
}

/* ---------------- 智能起名（书名 / 章节名） ---------------- */
let titlesKind = 'novel';
async function genTitles(kind) {
  titlesKind = kind || 'novel';
  const p = activeProvider();
  if (!p) { toast(t('toast.noAI'), 'warn'); openAISettings(); return; }
  if (state.aiStreaming || state.genState.running) { toast(t('toast.aiBusy'), 'warn'); return; }
  let base = '';
  if (kind === 'novel') {
    base = $('#novel-desc').value.trim() || (curNovel() ? (curNovel().description || curNovel().synopsis || '') : '');
  } else {
    const c = curChapter();
    if (!c) { toast(t('toast.needChapterOpen'), 'warn'); return; }
    base = ($('#chapter-outline').value || c.outline || '') + '\n' + (($('#editor').value || c.content || '').slice(0, 300));
  }
  if (!base.trim()) { toast(t('toast.titleNeedInput'), 'warn'); return; }
  toast(t('toast.titlesGen'), 'info', 2000);
  $('#title-list').innerHTML = '<div class="dict-loading">' + t('toast.titlesGen') + '</div>';
  $('#titles-modal-title').textContent = '✨ ' + (kind === 'novel' ? t('novel.titleSuggest') : t('co.chapterTitle'));
  openModal('modal-titles');
  try {
    const target = kind === 'novel' ? '书名' : '章节标题';
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `请根据以下内容为这部${kind === 'novel' ? '小说' : '章节'}想出 8 个候选${target}：\n\n${base.slice(0, 1500)}\n\n要求：每个候选单独一行，格式「候选名（2-4字风格标签）」；风格多样、朗朗上口、有吸引力，不要重复，不要解释。` }
    ];
    const res = await aiCallRetry(messages, { stream: true }, t('toast.titlesGen'));
    let acc = '';
    for await (const chunk of aiStream(res)) acc += chunk;
    const lines = acc.split('\n').map(s => s.trim())
      .map(s => s.replace(/^[\d一二三四五六七八九十]+[.、)）]\s*/, '').replace(/^[-*·]\s*/, '').trim())
      .filter(s => s.length > 1 && s.length < 40);
    const list = lines.slice(0, 8);
    if (!list.length) {
      $('#title-list').innerHTML = '<div class="empty-hint">' + t('toast.titlesEmpty') + '</div>';
      return;
    }
    $('#title-list').innerHTML = list.map((s, i) =>
      `<div class="title-item" data-title="${esc(s)}"><span class="t-ico">${['🌟', '✨', '💫', '⭐', '🌠', '🔮', '🪐', '☄️'][i] || '⭐'}</span><span class="t-txt">${esc(s)}</span><span class="mem-cat" data-cat="其他">${t('common.save')}</span></div>`
    ).join('');
  } catch (e) {
    $('#title-list').innerHTML = '<div class="empty-hint">' + humanizeAIError(e) + '</div>';
  }
}
async function applyTitle(title) {
  if (!title) return;
  if (titlesKind === 'novel') {
    const editing = $('#modal-novel').hidden === false;
    if (editing) { $('#novel-title').value = title; }
    else {
      const n = curNovel();
      if (n) { n.title = title; n.updatedAt = now(); await dbPut(STORE.novels, n); renderTop(); renderLibrary(); }
    }
  } else {
    const c = curChapter();
    if (c) { $('#chapter-title').value = title; scheduleSave(); }
  }
  closeModal('modal-titles');
  toast(t('toast.titleApplied'), 'ok');
}

/* ---------------- 存储权限 ---------------- */
function storageAllowed() {
  try { return localStorage.getItem('nebula-storage-ok') === '1'; } catch (e) { return true; }
}
function openStorageAsk() {
  openModal('modal-storage');
}
function allowStorage() {
  try { localStorage.setItem('nebula-storage-ok', '1'); } catch (e) { }
  state.settings.storageDenied = false;
  saveSettings();
  closeModal('modal-storage');
  applyUIPrefs();
  toast(t('toast.storageOk'), 'ok', 3500);
}
function denyStorage() {
  state.settings.storageDenied = true;
  saveSettings();
  closeModal('modal-storage');
  applyUIPrefs();
  toast(t('toast.storageNo'), 'warn', 4000);
}

/* ---------------- 会员方案 ---------------- */
function planName(p) {
  return p === 'pro' ? t('vip.pro') : (p === 'flag' ? t('vip.flag') : t('vip.free'));
}
function renderVip() {
  $$('#modal-vip .vip-card').forEach(card => {
    const btn = card.querySelector('[data-plan]');
    if (!btn) return;
    const isCurrent = btn.dataset.plan === state.settings.plan;
    card.classList.toggle('current', isCurrent);
    btn.disabled = isCurrent;
    if (isCurrent) btn.textContent = t('vip.freeBtn');
    else if (btn.dataset.plan === 'pro') btn.textContent = t('vip.btn');
    else if (btn.dataset.plan === 'flag') btn.textContent = t('vip.btn');
  });
}
function setPlan(p) {
  if (state.settings.plan === p) return;
  state.settings.plan = p;
  saveSettings();
  renderVip();
  fillPresetSelect();
  applyUIPrefs();
  toast(t('toast.planChanged', { p: planName(p) }), 'ok', 3500);
}

/* ---------------- 全网 AI 模型搜索（OpenRouter 公开目录） ---------------- */
async function searchModels() {
  const input = $('#or-search-input');
  const q = (input.value || '').trim();
  if (!q) return;
  const box = $('#or-results');
  box.innerHTML = '<div class="dict-loading">' + t('vip.searching') + '</div>';
  try {
    const r = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const list = (j.data || []).filter(m => (m.id || '').toLowerCase().includes(q.toLowerCase())).slice(0, 10);
    if (!list.length) {
      box.innerHTML = '<div class="empty-hint small">' + t('vip.searchEmpty') + '</div>';
      return;
    }
    box.innerHTML = list.map(m => {
      const price = (m.pricing && m.pricing.prompt) ? (Number(m.pricing.prompt) > 0 ? ('$' + (Number(m.pricing.prompt) * 1e6).toFixed(1) + '/M') : t('vip.copy')) : '—';
      const isFree = m.pricing && m.pricing.prompt === '0';
      return `<div class="or-item"><span class="or-name">${esc(m.id)}</span><span class="or-price ${isFree ? 'or-free' : ''}">${isFree ? '🆓 ' + t('aiset.stFree') : esc(price)}</span><button class="btn mini" data-orcopy="${esc(m.id)}">⧉ ${t('vip.copy')}</button></div>`;
    }).join('');
  } catch (e) {
    box.innerHTML = '<div class="empty-hint small">' + t('vip.searchFail') + '</div>';
  }
}

/* ---------------- 创作小宠物（可拖拽 · 互动动效 · 双击彩蛋） ---------------- */
let petIdleTimer = null, petNudgeTimer = null, hurtTimer = null;
const PET_BUBBLES_ZH = ['你好呀！', '我在呢～', '需要帮忙吗？点我试试', '写作加油！', '要不要起个书名？'];
const PET_BUBBLES_EN = ['Hello!', 'I\'m here~', 'Need help? Click me', 'Keep writing!', 'Want a title idea?'];
function petEl() { return $('#pet'); }
function petSay(txt, ms) {
  const b = $('#pet-bubble');
  if (!b) return;
  b.textContent = txt;
  b.classList.add('show');
  clearTimeout(b._t);
  b._t = setTimeout(() => b.classList.remove('show'), ms || 2200);
}
function petRandomBubble() {
  const arr = state.settings.lang === 'zh' ? PET_BUBBLES_ZH : PET_BUBBLES_EN;
  petSay(arr[Math.floor(Math.random() * arr.length)]);
}
function petSparkles(n) {
  const pet = petEl();
  if (!pet) return;
  const emojis = ['✨', '⭐', '💫', '🛸', '🌟'];
  for (let i = 0; i < (n || 5); i++) {
    const s = document.createElement('span');
    s.className = 'pet-spark';
    s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    s.style.left = (25 + Math.random() * 50) + '%';
    s.style.setProperty('--dx', (Math.random() * 70 - 35) + 'px');
    s.style.setProperty('--dy', -(35 + Math.random() * 45) + 'px');
    s.style.animationDelay = (Math.random() * 0.25) + 's';
    pet.appendChild(s);
    setTimeout(() => s.remove(), 1400);
  }
}
function savePetPos(xf, yf) {
  state.settings.petPos = { xf: clamp(xf, 0, 1), yf: clamp(yf, 0, 1) };
  saveSettings();
}
function applyPetPos() {
  const pet = petEl();
  const p = state.settings.petPos;
  if (!pet || !p) return;
  const x = clamp(p.xf, 0, 1) * Math.max(0, innerWidth - 92);
  const y = clamp(p.yf, 0, 1) * Math.max(0, innerHeight - 78);
  pet.style.left = Math.max(0, x) + 'px';
  pet.style.top = Math.max(0, y) + 'px';
  pet.style.right = 'auto';
  pet.style.bottom = 'auto';
}
function petActive() {
  const pet = petEl();
  if (!pet) return;
  pet.classList.remove('pet-idle');
  clearTimeout(petIdleTimer);
  petIdleTimer = setTimeout(() => {
    pet.classList.add('pet-idle');
    clearInterval(petNudgeTimer);
    petNudgeTimer = setInterval(() => {
      pet.style.setProperty('--nx', (Math.random() * 26 - 13) + 'px');
      pet.style.setProperty('--ny', (Math.random() * 10 - 5) + 'px');
    }, 2600);
  }, 60000);
}
function bindPetDrag() {
  const pet = petEl();
  if (!pet) return;
  let dragging = false, moved = 0, sx = 0, sy = 0, ox = 0, oy = 0;
  const onMove = e => {
    if (!dragging) return;
    moved = Math.max(moved, Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy));
    if (moved > 4) {
      pet.style.left = clamp(e.clientX - ox, 0, Math.max(0, innerWidth - 80)) + 'px';
      pet.style.top = clamp(e.clientY - oy, 0, Math.max(0, innerHeight - 70)) + 'px';
      pet.style.right = 'auto'; pet.style.bottom = 'auto';
    }
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    pet.classList.remove('pet-dragging');
    window.removeEventListener('pointermove', onMove);
    if (moved > 6) {
      const r = pet.getBoundingClientRect();
      savePetPos((r.left + r.width / 2) / innerWidth, (r.top + r.height / 2) / innerHeight);
    }
  };
  pet.addEventListener('pointerdown', e => {
    dragging = true; moved = 0;
    sx = e.clientX; sy = e.clientY;
    const r = pet.getBoundingClientRect();
    ox = e.clientX - r.left; oy = e.clientY - r.top;
    pet.classList.remove('pet-idle');
    pet.classList.add('pet-dragging');
    if (pet.setPointerCapture) { try { pet.setPointerCapture(e.pointerId); } catch (err) { } }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  });
  pet.addEventListener('click', e => {
    if (e.detail > 1) return; // 双击交给 dblclick
    if (moved > 6) return;    // 拖拽不算点击
    pet.classList.remove('pet-idle');
    applyPetPos();
    petSparkles(6);
    pet.classList.remove('pet-bounce');
    void pet.offsetWidth;
    pet.classList.add('pet-bounce');
    setTimeout(() => pet.classList.remove('pet-bounce'), 520);
    petRandomBubble();
    openAssistant();
  });
  pet.addEventListener('dblclick', () => hurtPet());
}
function hurtPet() {
  const pet = petEl();
  if (!pet || pet.classList.contains('pet-hurt')) return;
  pet.classList.add('pet-hurt');
  petSparkles(4);
  petSay(state.settings.lang === 'zh' ? '好痛…呜呜😭' : 'Ouch… ouch!');
  clearTimeout(hurtTimer);
  hurtTimer = setTimeout(() => {
    pet.classList.remove('pet-hurt');
    petSparkles(8);
    petSay(state.settings.lang === 'zh' ? '满血复活！' : 'All better!');
  }, 6500);
}
function openAssistant() {
  const pet = petEl();
  if (pet) { pet.classList.remove('pet-idle'); }
  openModal('modal-assistant');
}

/* ---------------- 设置中心 ---------------- */
function adjustFont(d) {
  state.settings.fontSize = clamp(state.settings.fontSize + d, 14, 32);
  saveSettings();
  applyUIPrefs();
  const v = $('#set-font-val');
  if (v) v.textContent = state.settings.fontSize + 'px';
}
function toggleLang() {
  state.settings.lang = state.settings.lang === 'zh' ? 'en' : 'zh';
  saveSettings();
  renderAll();
  refreshSettingsChips();
  toast(t('toast.langHint'), 'ok', 1600);
}
function toggleLayout() {
  state.settings.layout = state.settings.layout === 'split' ? 'stack' : 'split';
  saveSettings();
  applyUIPrefs();
  refreshSettingsChips();
  toast(t('set.layout') + '：' + t(state.settings.layout === 'split' ? 'set.split' : 'set.stack'), 'ok', 2000);
}
function refreshSettingsChips() {
  const s = state.settings;
  $('#set-layout-stack').classList.toggle('on', s.layout !== 'split');
  $('#set-layout-split').classList.toggle('on', s.layout === 'split');
  $('#set-ai-on').classList.toggle('on', s.aiPanelOpen);
  $('#set-ai-off').classList.toggle('on', !s.aiPanelOpen);
  $('#set-lang-zh').classList.toggle('on', s.lang === 'zh');
  $('#set-lang-en').classList.toggle('on', s.lang === 'en');
}
function openSettings() {
  const s = state.settings;
  $('#set-font-val').textContent = s.fontSize + 'px';
  refreshSettingsChips();
  $$('#modal-settings .accent-dot').forEach(d => d.classList.toggle('on', d.dataset.accent === s.accent));
  const u = s.user || {};
  $('#set-profile-name').textContent = u.nickname || t('profile.default');
  $('#set-profile-avatar').innerHTML = u.avatarData ? '<img src="' + u.avatarData + '" alt="" />' : esc(AVATAR_PRESETS[u.avatarPreset || 0][0]);
  $('#set-version').textContent = APP_VERSION;
  openModal('modal-settings');
}
async function checkUpdate() {
  const btn = $('#btn-check-update');
  btn.disabled = true;
  try {
    let remote = null;
    try {
      const r = await fetch('https://raw.githubusercontent.com/akc071001-max/xiaoxing/main/version.txt', { signal: AbortSignal.timeout(10000) });
      if (r.ok) remote = (await r.text()).trim();
    } catch (e) { }
    if (!remote) {
      try {
        const r2 = await fetch('https://xiaoxing.surge.sh/version.txt', { signal: AbortSignal.timeout(10000) });
        if (r2.ok) remote = (await r2.text()).trim();
      } catch (e2) { }
    }
    if (!remote) { toast(t('set.updateFail'), 'warn'); return; }
    if (remote === APP_VERSION) toast(t('set.upToDate', { v: APP_VERSION }), 'ok');
    else toast(t('set.updateFound', { v: remote }), 'warn', 5000);
  } finally {
    btn.disabled = false;
  }
}

/* ---------------- 事件绑定 ---------------- */
function bindEvents() {
  // 顶部
  $('#btn-novel-switch').addEventListener('click', () => { renderLibrary(); openModal('modal-library'); });
  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-vip').addEventListener('click', () => openModal('modal-vip'));
  $('#btn-profile').addEventListener('click', openProfile);
  // 导航
  $('#main-nav').addEventListener('click', e => {
    const b = e.target.closest('.nav-item');
    if (!b) return;
    state.module = b.dataset.module;
    setNavActive(); renderPanel();
  });
  // 面板
  $('#panel-body').addEventListener('click', onPanelClick);
  $('#panel-body').addEventListener('input', onPanelInput);
  // 编辑器
  $('#editor').addEventListener('input', () => { scheduleSave(); updateCounts(); });
  $('#editor').addEventListener('keyup', updatePos);
  $('#editor').addEventListener('click', updatePos);
  $('#chapter-title').addEventListener('input', scheduleSave);
  $('#chapter-title').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#editor').focus(); } });
  $('#chapter-status').addEventListener('change', scheduleSave);
  $('#btn-title-suggest').addEventListener('click', () => genTitles('chapter'));
  $('#btn-focus').addEventListener('click', () => toggleFocus());
  $('#btn-dict').addEventListener('click', () => openDict());
  // 智能起名（弹窗列表点击）
  $('#title-list').addEventListener('click', e => {
    const it = e.target.closest('.title-item');
    if (it) applyTitle(it.dataset.title);
  });
  $('#btn-novel-title-suggest').addEventListener('click', () => genTitles('novel'));
  // 存储权限
  $('#btn-storage-allow').addEventListener('click', allowStorage);
  $('#btn-storage-deny').addEventListener('click', denyStorage);
  $('#set-storage-req').addEventListener('click', openStorageAsk);
  // 会员方案
  $('#btn-vip').addEventListener('click', () => { renderVip(); openModal('modal-vip'); });
  document.addEventListener('click', e => {
    const v = e.target.closest('[data-plan]');
    if (v && !v.disabled) setPlan(v.dataset.plan);
    const oc = e.target.closest('[data-orcopy]');
    if (oc) { copyText(oc.dataset.orcopy); }
  });
  // 全网模型搜索
  $('#btn-or-search').addEventListener('click', searchModels);
  $('#or-search-input').addEventListener('keydown', e => { if (e.key === 'Enter') searchModels(); });
  // 小宠物 / 助手（可拖拽 / 点击互动 / 双击彩蛋）
  bindPetDrag();
  addEventListener('resize', applyPetPos);
  $('#asst-hide').addEventListener('click', () => { state.settings.petVisible = false; saveSettings(); applyUIPrefs(); closeModal('modal-assistant'); toast(t('asst.hide'), 'ok', 2000); });
  $('#asst-new-novel').addEventListener('click', () => { closeModal('modal-assistant'); openNovelModal(null); });
  $('#asst-gen').addEventListener('click', () => { closeModal('modal-assistant'); generateChapter(); });
  $('#asst-titles').addEventListener('click', () => { closeModal('modal-assistant'); genTitles(curChapter() ? 'chapter' : 'novel'); });
  $('#asst-settings').addEventListener('click', () => { closeModal('modal-assistant'); openSettings(); });
  $('#asst-feedback').addEventListener('click', () => { closeModal('modal-assistant'); openModal('modal-feedback'); });
  ['pointerdown', 'keydown', 'wheel'].forEach(ev => document.addEventListener(ev, petActive, { passive: true }));
  // 点击反馈水波 + 弹跳手感
  document.addEventListener('click', e => {
    const b = e.target.closest('.btn,.tb-btn,.chip,.profile-btn,.icon-btn,.nav-item,.title-item');
    if (!b || b.disabled) return;
    const rect = b.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const rp = document.createElement('span');
    rp.className = 'ripple';
    rp.style.width = rp.style.height = size + 'px';
    rp.style.left = (e.clientX - rect.left - size / 2) + 'px';
    rp.style.top = (e.clientY - rect.top - size / 2) + 'px';
    b.appendChild(rp);
    const ring = document.createElement('span');
    ring.className = 'ring';
    ring.style.left = (e.clientX - rect.left - 5) + 'px';
    ring.style.top = (e.clientY - rect.top - 5) + 'px';
    b.appendChild(ring);
    b.classList.remove('btn-pop');
    void b.offsetWidth;
    b.classList.add('btn-pop');
    setTimeout(() => rp.remove(), 500);
    setTimeout(() => ring.remove(), 450);
    setTimeout(() => b.classList.remove('btn-pop'), 380);
  });
  // 设置：背景 / 小助手 / 词典 / 自动模型
  $('#set-bg-stars').addEventListener('click', () => setBgMode('stars'));
  $('#set-bg-solar').addEventListener('click', () => setBgMode('solar'));
  $('#set-bg-galaxy').addEventListener('click', () => setBgMode('galaxy'));
  $('#set-bg-planet').addEventListener('click', () => setBgMode('planet'));
  $('#set-pet-on').addEventListener('click', () => { state.settings.petVisible = true; saveSettings(); applyUIPrefs(); refreshSettingsChips(); });
  $('#set-pet-off').addEventListener('click', () => { state.settings.petVisible = false; saveSettings(); applyUIPrefs(); refreshSettingsChips(); });
  $('#set-dict').addEventListener('click', openDict);
  $('#set-auto-model').addEventListener('change', e => { state.settings.autoModel = e.target.checked; saveSettings(); });
  // 章节大纲 + 联网生成
  $('#chapter-outline').addEventListener('input', scheduleSave);
  $('#btn-gen-chapter').addEventListener('click', generateChapter);
  $('#btn-gen-again').addEventListener('click', generateChapter);
  $('#btn-gen-cancel').addEventListener('click', cancelGen);
  // 反馈 / 会员 / 布局
  $('#btn-fb-send').addEventListener('click', submitFeedback);
  $('#btn-layout-toggle').addEventListener('click', toggleLayout);
  // 设置中心
  $('#set-font-minus').addEventListener('click', () => adjustFont(-1));
  $('#set-font-plus').addEventListener('click', () => adjustFont(1));
  $('#set-layout-stack').addEventListener('click', () => { state.settings.layout = 'stack'; saveSettings(); applyUIPrefs(); refreshSettingsChips(); });
  $('#set-layout-split').addEventListener('click', () => { state.settings.layout = 'split'; saveSettings(); applyUIPrefs(); refreshSettingsChips(); });
  $('#set-ai-on').addEventListener('click', () => { state.settings.aiPanelOpen = true; saveSettings(); applyUIPrefs(); refreshSettingsChips(); });
  $('#set-ai-off').addEventListener('click', () => { state.settings.aiPanelOpen = false; saveSettings(); applyUIPrefs(); refreshSettingsChips(); });
  $('#set-lang-zh').addEventListener('click', () => { if (state.settings.lang !== 'zh') toggleLang(); });
  $('#set-lang-en').addEventListener('click', () => { if (state.settings.lang !== 'en') toggleLang(); });
  $('#set-profile-edit').addEventListener('click', openProfile);
  $('#set-backup').addEventListener('click', () => openModal('modal-backup'));
  $('#set-ai').addEventListener('click', openAISettings);
  $('#set-feedback').addEventListener('click', () => openModal('modal-feedback'));
  $('#set-terms').addEventListener('click', openTerms);
  $('#btn-check-update').addEventListener('click', checkUpdate);
  // AI 面板
  $('#btn-ai-toggle').addEventListener('click', () => { state.settings.aiPanelOpen = !state.settings.aiPanelOpen; saveSettings(); applyUIPrefs(); });
  $('#btn-ai-close').addEventListener('click', () => { state.settings.aiPanelOpen = false; saveSettings(); applyUIPrefs(); });
  $('#btn-ai-config').addEventListener('click', openAISettings);
  $('#btn-ai-clear').addEventListener('click', () => { state.chatForNovel = []; saveChat(); renderChat(); toast(t('toast.chatClear')); });
  $('#btn-ai-send').addEventListener('click', () => {
    const t2 = $('#ai-input').value.trim();
    if (!t2) return;
    $('#ai-input').value = '';
    sendAI(t2);
  });
  $('#ai-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('#btn-ai-send').click(); }
  });
  $('#btn-ai-stop').addEventListener('click', () => { if (state.aiAbort) state.aiAbort.abort(); });
  $('#ai-quick').addEventListener('click', e => {
    const b = e.target.closest('[data-action]');
    if (b) quickPrompt(b.dataset.action);
  });
  $('#ai-messages').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const idx = Number(b.dataset.idx);
    const act = b.dataset.act;
    if (act === 'insert') insertAssistant(idx);
    else if (act === 'copy') copyText(state.chatForNovel[idx] ? state.chatForNovel[idx].content : '');
    else if (act === 'savemem') saveMemFromMsg(idx, Number(b.dataset.ei), false);
    else if (act === 'saveall') saveMemFromMsg(idx, 0, true);
  });
  // 上下文开关
  const ctxKeys = [['ctx-outline', 'outline'], ['ctx-chars', 'chars'], ['ctx-world', 'world'], ['ctx-mem', 'mem'], ['ctx-chat-history', 'chatHistory']];
  ctxKeys.forEach(([sel, key]) => {
    $('#' + sel).addEventListener('change', e => { state.settings.ctx[key] = e.target.checked; saveSettings(); });
  });
  $('#ctx-chapters').addEventListener('change', e => { state.settings.ctx.prevChapters = clamp(parseInt(e.target.value) || 0, 0, 20); saveSettings(); });
  // 书库
  $('#library-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (btn) {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (btn.dataset.act === 'edit') openNovelModal(id);
      else if (btn.dataset.act === 'del') delNovel(id);
      return;
    }
    const row = e.target.closest('.lib-row');
    if (row) switchNovel(row.dataset.id);
  });
  $('#btn-new-novel').addEventListener('click', () => openNovelModal(null));
  $('#btn-save-novel').addEventListener('click', saveNovelFromForm);
  // 风格表格
  $('#modal-novel').addEventListener('click', onStyleChipClick);
  $('#btn-novel-learn').addEventListener('click', () => {
    learnAuthors(state.styleDraft ? state.styleDraft.authors : [], $('#novel-learn-status'));
  });
  // 备份
  $('#btn-export-txt').addEventListener('click', exportTxt);
  $('#btn-export-json').addEventListener('click', exportJson);
  $('#btn-import-json').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', e => { const f = e.target.files[0]; if (f) doImport(f); });
  $('#btn-wipe').addEventListener('click', wipeAll);
  // 个人档案
  $('#btn-profile-save').addEventListener('click', saveProfile);
  $('#btn-avatar-upload').addEventListener('click', () => $('#avatar-file').click());
  $('#avatar-file').addEventListener('change', e => { const f = e.target.files[0]; if (f) handleAvatarFile(f); });
  $('#btn-avatar-clear').addEventListener('click', () => {
    state.settings.user.avatarData = '';
    applyProfilePreview();
  });
  $('#avatar-grid').addEventListener('click', e => {
    const it = e.target.closest('.avatar-item');
    if (!it) return;
    state.settings.user.avatarPreset = Number(it.dataset.idx);
    state.settings.user.avatarData = '';
    applyProfilePreview();
  });
  // 用户须知
  $('#terms-agree-chk').addEventListener('change', e => { $('#btn-terms-agree').disabled = !e.target.checked; });
  $('#btn-terms-agree').addEventListener('click', () => {
    try { localStorage.setItem('nebula-terms-v1', '1'); } catch (e) { }
    closeModal('modal-terms');
    toast(t('toast.welcome'), 'info', 5000);
  });
  $('#btn-terms-decline').addEventListener('click', () => toast(t('terms.declined'), 'warn', 4000));
  $('#btn-show-terms').addEventListener('click', openTerms);
  // 词典
  $('#btn-dict-search').addEventListener('click', () => dictSearch($('#dict-input').value));
  $('#dict-input').addEventListener('keydown', e => { if (e.key === 'Enter') dictSearch($('#dict-input').value); });
  $('#dict-result').addEventListener('click', e => {
    const b = e.target.closest('[data-syn]');
    if (b) dictSearch(b.dataset.syn);
  });
  // AI 设置
  $('#btn-add-provider').addEventListener('click', () => { state.provEditingId = null; fillProvForm(null); $('#prov-name').focus(); });
  $('#provider-list').addEventListener('click', e => {
    const row = e.target.closest('.prov-row');
    if (!row) return;
    state.provEditingId = row.dataset.id;
    fillProvForm(state.settings.providers.find(p => p.id === row.dataset.id));
  });
  $('#preset-select').addEventListener('change', e => {
    const p = PRESETS[Number(e.target.value)];
    if (!p) return;
    $('#prov-base').value = p.baseUrl;
    $('#prov-path').value = p.path || '/chat/completions';
    $('#prov-model').value = p.model;
    if (!$('#prov-name').value) $('#prov-name').value = p.name;
  });
  $('#btn-prov-save').addEventListener('click', saveProvider);
  $('#btn-prov-test').addEventListener('click', testProvider);
  $('#btn-prov-del').addEventListener('click', delProvider);
  // 笔记 / 角色
  $('#btn-note-save').addEventListener('click', saveNote);
  $('#btn-char-save').addEventListener('click', saveChar);
  // 确认
  $('#btn-confirm-ok').addEventListener('click', () => { closeModal('modal-confirm'); if (state.confirmResolve) { state.confirmResolve(true); state.confirmResolve = null; } });
  $('#btn-confirm-cancel').addEventListener('click', () => { closeModal('modal-confirm'); if (state.confirmResolve) { state.confirmResolve(false); state.confirmResolve = null; } });
  // 主题色
  document.addEventListener('click', e => {
    const d = e.target.closest('.accent-dot');
    if (!d) return;
    state.settings.accent = d.dataset.accent;
    saveSettings(); applyUIPrefs();
  });
  // 模态关闭
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-close]');
    if (c) { closeModal(c.dataset.close); return; }
    if (e.target.classList && e.target.classList.contains('modal-overlay')) e.target.hidden = true;
  });
  // 快捷键
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      if (document.activeElement && document.activeElement.id === 'ai-input') { const t2 = $('#ai-input').value.trim(); if (t2) { $('#ai-input').value = ''; sendAI(t2); } }
      else saveChapter(true);
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
      const w = editorSelectionWord();
      if (w) { e.preventDefault(); openDict(w); }
    }
    if (e.key === 'Escape' && document.body.classList.contains('focus-mode')) toggleFocus(false);
  });
  // 离开页面前保存
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
  window.addEventListener('beforeunload', () => { flushSave(); saveSettings(); });
}

/* ---------------- 预设下拉（按会员方案过滤） ---------------- */
function fillPresetSelect() {
  const sel = $('#preset-select');
  sel.innerHTML = '<option value="">— ' + t('aiset.preset') + ' —</option>';
  const lvl = PLAN_LEVEL[state.settings.plan] || 0;
  PRESETS.forEach((p, i) => {
    if ((PLAN_LEVEL[p.plan] || 0) > lvl) return;
    const o = document.createElement('option');
    o.value = String(i); o.textContent = p.name;
    sel.appendChild(o);
  });
}

/* ---------------- 启动 ---------------- */
async function boot() {
  loadSettings();
  loadWikiCache();
  // 首次使用自动配置免费免密钥模型（Pollinations AI），开箱即用
  if (!state.settings.providers.length) {
    state.settings.providers.push({
      id: uid(), name: 'Pollinations 免费模型', baseUrl: 'https://text.pollinations.ai', path: '/openai',
      apiKey: '', model: 'openai', temperature: 0.8, maxTokens: 4096
    });
    state.settings.activeProviderId = state.settings.providers[0].id;
    saveSettings();
  }
  fillPresetSelect();
  applyUIPrefs();
  bgInit();
  bindEvents();
  await dbInit();
  await loadAll();
  renderLibrary();
  renderAll();
  if (!state.novels.length) {
    openModal('modal-library');
    toast(t('toast.welcome'), 'info', 7000);
  }
  if (!termsAccepted()) openTerms();
  // 首次使用：请求本地存储授权（用户同意后才持久化保存作品）
  if (!storageAllowed() && !state.settings.storageDenied) openStorageAsk();
  window.__nebulaReady = true;
}
boot();
