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
    'refs.open': '文献笔记',
    'brand.sub': '全风格小说创作台', 'brand.name': '晓星',
    'btn.langTitle': '切换界面语言',
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
    'backup.txt': '导出当前作品 TXT', 'backup.txtSub': '导出小说章节或当前论文正文',
    'backup.json': '备份全部作品 JSON', 'backup.jsonSub': '含稿件、版本历史和对话；不含账号或模型密钥',
    'backup.import': '导入备份 JSON', 'backup.importSub': '恢复为独立副本，保留现有数据', 'backup.importBtn': '导入',
    'backup.wipe': '清除全部数据', 'backup.wipeSub': '不可恢复！', 'backup.wipeBtn': '清除',
    'backup.xdev': '跨设备完整备份（账号+数据，加密）', 'backup.xdevSub': '含账号、全部作品与设置；任何设备可恢复',
    'backup.xdevPassPh': '备份密码（≥6位，含字母+数字）', 'backup.xdevExport': '加密备份',
    'backup.xdevImport': '跨设备完整恢复', 'backup.xdevImportSub': '选择 .xxb 文件或粘贴备份码',
    'backup.xdevImportPassPh': '备份密码', 'backup.xdevFile': '选择文件', 'backup.xdevPaste': '粘贴备份码',
    'backup.xdevOk': '加密备份已生成（已复制到剪贴板并下载 .xxb 文件）',
    'backup.xdevRestored': '恢复成功：账号与作品已合并到本设备',
    'backup.xdevBad': '备份无效或密码错误', 'backup.xdevNeedLogin': '请先登录账户再加密备份',
    'backup.xdevPassRule': '备份密码至少 6 位，须含字母和数字',
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
    'w.edit': '✎ 编辑风格表格', 'w.styleProfile': '风格档案', 'w.synopsis': '全书梗概 · SYNOPSIS', 'w.world': '世界观 · WORLDVIEW', 'w.custom': '自定义条目', 'w.addSec': '＋ 添加条目',
    'w.authorLib': '作家文风库', 'w.authorTip': '点击作家切换参考；「联网学习」将抓取维基百科词条研究其写作特点，并随上下文注入 AI。',
    'w.learn': '⛁ 联网学习文风', 'w.learnSel': '⛁ 联网学习文风（已选 {n} 位）', 'w.builtin': '内置技法', 'w.wiki': '联网学习（维基百科）',
    'w.learnOk': '文风学习完成：{ok}/{n} 位成功', 'w.learnFail': '文风学习：全部失败（请检查网络）', 'w.learnPartial': '文风学习完成：{ok} 成功 / {fail} 失败',
    'stat.words': '中文 {a} · 英文词 {b}', 'stat.pos': '行 {a} · 列 {b}', 'stat.chars': '字符 {a}', 'stat.wordsChip': '字',
    'dict.loading': '查询中…', 'dict.notfound': '未找到该单词的定义。请检查拼写，或换个词试试。',
    'dict.errNet': '词典请求失败：可能是网络问题（该接口需联网）。', 'dict.syn': '近义词 / 同义词', 'dict.src': '数据来源：dictionaryapi.dev · Datamuse',
    'toast.welcome': '欢迎来到晓星 XIAOXING！先「新建小说」，再到右上「⚙ AI 模型」接入你的模型。',
    'toast.saved': '已保存', 'toast.savedOk': '已保存', 'toast.needNovel': '请先新建小说', 'toast.needNovelSel': '请先选择小说',
    'toast.noChapters': '暂无章节', 'toast.txtOk': '已导出 TXT', 'toast.backupOk': '备份完成',
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
    'ai.dataNote': '使用 AI 时，提示和相关上下文会发给选中的模型。手写和本地保存不发送稿件。',
    'empty.chat': '✦ 选择模型后即可尝试使用 AI。<br/>用上方快捷指令续写、推演，或直接提问。连接有问题时，可在模型设置中测试。',
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
    'toast.importOk': '已恢复为独立副本', 'backup.copySuffix': '备份副本', 'backup.invalid': '这不是支持的晓星备份格式。', 'backup.empty': '备份没有可恢复的小说或论文。', 'backup.idbOnly': '恢复需要可用的 IndexedDB；你仍可导出备份。', 'backup.exportFail': '备份导出失败，请检查浏览器存储。', 'backup.orphanChats': '已跳过 {n} 条未找到所属作品的旧对话。',
    'confirm.import': '恢复为独立副本：{details}。现有作品不会被覆盖。继续吗？',
    'dict.provOk': '✓ 连接成功：', 'dict.provFail': '连接失败：',
    'learn.fetching': '正在学习 {name} 的文风…', 'learn.noSel': '请先在上方选择参考作家',
    'w.noAuthors': '尚未选择参考作家。点击上方作家标签选择，再联网学习其写作技法。',
    'novel.legacyGenre': '未分类',
    'terms.title': '📜 用户须知 · 用户守则',
    'terms.noticeTitle': '一、用户须知',
    'terms.notice': '<ul><li><b>数据本地存储</b>：你的小说、大纲、角色、记忆全部保存在你自己浏览器的 IndexedDB 中，普通手写和保存不会向模型服务发送稿件。清除浏览器数据会导致作品丢失，请定期使用「⛁ 备份」导出。</li><li><b>AI 接入</b>：可选择内置、云端或本机模型。主动使用 AI 时，对应提示和所选上下文会发送到模型服务；启用备用模型时，请求也可能交给备用服务。密钥保存在本机，仅用于对应的服务请求。</li><li><b>联网功能</b>：「作家文风学习」「英语词典」会访问公开接口（维基百科、词典服务），会发送用于查询的词语或关键词。</li><li><b>内容责任</b>：本工具免费提供、不作任何担保；由 AI 生成的内容请自行审核其准确性、版权与合规性，创作者对最终发布的内容负全部责任。</li><li><b>未成年人</b>：请在监护人指导下使用。</li></ul>',
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
    'vip.title': '💎 会员中心', 'vip.notice': '目前唯一付费内容：DeepSeek 月度会员（¥40/月）· 其余功能试运营期间免费',
    'vip.free': '免费体验版', 'vip.freePrice': '¥0 · 试运营', 'vip.currentBtn': '当前方案',
    'vip.f1': '内置免费 AI 模型', 'vip.f2': '全部创作功能', 'vip.f3': '数据本地保存',
    'vip.pro': '专业创作版', 'vip.proPrice': '¥0 · 试运营',
    'vip.p1': '更优质的大模型', 'vip.p2': '更长上下文记忆', 'vip.p3': '更快生成速度',
    'vip.flag': '旗舰版', 'vip.flagPrice': '¥0 · 试运营',
    'vip.l1': '全部专业版权益', 'vip.l2': '优先接入新模型', 'vip.l3': '专属客服支持',
    'vip.btn': '暂未开放', 'vip.btnToast': '试运营期间不收费，敬请期待',
    'vip.foot': '目前唯一付费内容：DeepSeek 月度会员（¥40/月）；其余功能在试运营期间免费。',
    'vip.deepseek': 'DeepSeek 月度会员', 'vip.deepseekPrice': '¥40 / 月',
    'vip.d1': 'DeepSeek 等优质大模型稳定接入（不占用免费额度）',
    'vip.d2': '更快响应 · 更长记忆（前 5 章）',
    'vip.d3': '按月支付 · 不自动续费 · 到期自行决定是否续费',
    'vip.deepseekBtn': '签署协议并开通',
    'agr.title': '📄 DeepSeek 月度会员付费协议',
    'agr.agreeLabel': '我已阅读并同意以上全部条款',
    'agr.signLabel': '电子签名（输入用户名确认签署）',
    'agr.signPh': '输入您的用户名作为电子签名',
    'agr.signBtn': '签署协议并查看收款码',
    'agr.payNote': '请通过下方个人收款码支付 ¥40，并按步骤操作。',
    'agr.amount': '付款金额：¥40.00（一个月服务）',
    'agr.step1': '打开微信 / 支付宝扫描左侧收款码',
    'agr.step2': '付款时请在「添加备注 / 转账说明」中填写您的用户名',
    'agr.step3': '付款完成后点击下方「我已付款，提交核对」',
    'agr.waitNote': '提交后管理员将在 24 小时内核对入账并开通；核对完成前可随时申请退款。',
    'agr.paidBtn': '我已付款，提交核对',
    'agr.hintNeedAgree': '请先勾选「我已阅读并同意以上全部条款」',
    'agr.hintNeedLogin': '请先登录您的账户再签署协议',
    'agr.hintSignMismatch': '电子签名必须与当前登录用户名一致',
    'agr.signedOk': '协议已签署，请完成付款',
    'agr.submitted': '已提交核对！管理员将在 24 小时内核对入账并开通；核对完成前可随时申请退款。',
    'agr.submitFail': '提交失败，请稍后再试，或通过「反馈」联系管理员',
    'agr.pending': '核对中…',
    'agr.text': '<h3>第一条 服务内容与价格</h3><p>1.1 本协议是用户与「晓星 XIAOXING」网站（创作者：小柚子，下称「本站」）之间就 DeepSeek 月度会员服务订立的协议。</p><p>1.2 服务内容：开通期间内可使用本站接入的 DeepSeek 等优质大模型进行创作（以本站实际接入的模型为准），享有更快响应与更长上下文记忆（前 5 章）等权益。</p><p>1.3 价格：人民币 40 元 / 月（30 天）。</p><h3>第二条 支付方式</h3><p>2.1 本站采用创作者个人收款码收款。</p><p>2.2 用户应在付款备注中填写用户名，以便核对。</p><p>2.3 付款不代表立即开通：管理员在核对实际到账后开通服务；核对完成前用户可随时申请退款。</p><h3>第三条 服务周期与续费</h3><p>3.1 一个月服务期自实际付款发生之日起算（以登记时间为准），共 30 天。</p><p>3.2 本服务不设置自动续费、不自动扣款：到期后服务自动结束，是否续费完全由用户自行决定。</p><p>3.3 续费需再次签署本协议并重新付款。</p><h3>第四条 退款政策</h3><p>4.1 在管理员核对入账并开通服务前，用户可随时通过「💬 反馈」申请全额退款。</p><p>4.2 服务已开通后，因服务具有即时性，原则上不支持退款；但因本站原因导致服务连续 72 小时不可用的，用户可申请按剩余天数折算退款。</p><p>4.3 退款经管理员核实后原路退回，处理周期一般为 7 个工作日。</p><h3>第五条 使用规范</h3><p>5.1 会员权益仅限本人账号使用，不得转售、共享、出租或用于商业转售目的。</p><p>5.2 用户须遵守本站《用户须知与守则》及 AI 服务商的使用条款，不得利用服务生成违法或侵权内容。</p><p>5.3 违反本条的，本站有权停止服务且不予退款。</p><h3>第六条 服务声明与免责</h3><p>6.1 本站尽力保证服务质量，但 AI 生成结果不构成任何专业意见或承诺。</p><p>6.2 因第三方模型服务商、网络或不可抗力导致的暂时不可用，本站不承担赔偿责任，但会尽力协调恢复。</p><p>6.3 本站保留根据成本与运营情况调整价格或服务内容的权利，调整前将提前公告；已付款周期不受影响。</p><h3>第七条 个人信息</h3><p>7.1 本站仅收集开通与核对所必需的信息（用户名、付款登记信息），不收集与提供服务无关的敏感信息。</p><p>7.2 付款信息由支付平台处理，本站不接触用户的银行账户信息。</p><h3>第八条 争议解决</h3><p>8.1 本协议适用中华人民共和国法律。</p><p>8.2 双方发生争议应友好协商；协商不成的，可向本站运营者所在地有管辖权的人民法院提起诉讼。</p>',
    'btn.settings': '⚙ 设置', 'btn.settingsTitle': '设置中心',
    'co.layout': '布局', 'co.layoutToggleTitle': '切换布局：上下 / 左右分屏',
    'set.title': '⚙ 设置', 'set.ui': '界面设置', 'set.font': '正文字号', 'set.layout': '界面样式',
    'set.stack': '小框大纲 · 大框正文', 'set.split': '一半大纲 · 一半正文',
    'set.aipanel': 'AI 引擎面板', 'set.on': '开', 'set.off': '关', 'set.accent': '主题色',
    'set.account': '个人账户', 'set.editProfile': '编辑头像 / 昵称',
    'set.lang': '语言',
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
    'style.standard': '创作标准', 'style.stGeneric': '通用', 'style.stNet': '中国网文', 'style.stTrad': '中式传统', 'style.stJP': '日式轻小说', 'style.stWest': '欧美小说', 'style.stRu': '俄式文学',
    'style.personal': '个性化输出', 'style.perHuman': '更像人写的（自然化）', 'style.perStandard': '标准输出',
    'storage.title': '💾 存储权限请求',
    'storage.desc': '<p>晓星需要把您的<b>小说、大纲、角色、记忆</b>等作品数据保存在<b>您自己设备的浏览器存储</b>中（IndexedDB），用于自动保存与下次继续创作。此授权只允许本机保存；主动使用联网 AI 是另一个操作。</p><p>同意后作品会自动保存；拒绝则本次创作内容<b>不会保存</b>，关闭页面后可能丢失。</p>',
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
    'sp.filterPh': '筛选作家…',
    'board.novel': '📖 小说', 'board.paper': '📄 论文',
    'p.list': '我的论文', 'p.new': '新论文', 'p.empty': '还没有论文。<br/>点右上「＋ 新论文」，填写主题后点「📚 检索并生成论文」。',
    'p.topicLabel': '📄 论文主题 / 要求',
    "p.topicPh": "写下研究问题、材料范围与要求；联网检索仅使用简短关键词。",
    'p.editorPh': '在这里手写正文，或用 AI 起草。用 [1][2] 标注来源，提交前核对原文。',
    'p.gen': '📚 检索并生成论文', 'p.again': '🔄 重新生成',
    'p.needTopic': '请先填写论文主题', 'p.needOpen': '请先新建并打开一篇论文',
    'p.overwrite': '只有生成稿通过检查后才会替换当前正文。继续起草吗？',
    'p.done': '✓ 论文生成完成，不满意可点「🔄 重新生成」',
    "p.freeNote": "检索只提供候选来源。论文可手写或用 AI 起草；提交前请检查原文、引文与页码。",
    'p.upgrade': '💎 升级获得更佳正文',
    'gp.psearch': '正在检索文献资料', 'gp.refsFound': '已检索到 {n} 篇文献', 'gp.pdraft': '正在拟写论文提纲', 'gp.pwrite': '正在输出论文正文',
    'gp.check': '⚖ 质量自检', 'gp.rewrite': '发现问题，正在重写优化', 'gp.pass': '自检通过 · 内容达标',
    'gp.failCheck': 'AI 自检未通过：多次重写仍未达标，正文未输出。请调整大纲/主题后重试。',
    'gp.forceOutput': '自检未完全达标：已按要求重写两次，现直接输出正文，请审阅修改。',
    'gp.forceNote': '两次重写完成 · 直接输出正文',
    'sp.scrollHint': '滑动 / 按键查看全部作家简介',
    "p.guide": "写作向导",
    "p.guideTitle": "论文写作路线",
    "p.guideStart": "选择一个起步模板",
    "p.step1": "写清一个可回答的研究问题，再限定时间、地点、群体或材料范围。",
    "p.step2": "查找原文，记下用到的证据和页码。自动检索只提供候选来源，不代表已证明论点。",
    "p.step3": "可以直接手写正文，也可以先生成草稿。交稿前逐条核对 [n]、原文和引用格式。",
    "p.tplReview": "文献综述",
    "p.tplCompare": "比较分析",
    "p.tplEmpirical": "实证研究",
    "p.tplReviewBody": "研究问题：\n检索关键词：\n文献范围（年份、学科）：\n纳入与排除标准：\n需要比较的研究观点：",
    "p.tplCompareBody": "研究问题：\n检索关键词：\n比较对象与时间范围：\n共同的比较指标：\n计划使用的材料：",
    "p.tplEmpiricalBody": "研究问题：\n检索关键词：\n研究对象与样本：\n数据来源与方法：\n局限性和可能偏差：",
    "p.guideBlank": "模板只填入空白的主题框，不改写正文。",
    "p.guideFilled": "主题框已有内容，模板不会覆盖它。你可以按上面步骤继续。",
    "p.guideNeedPaper": "请先从论文列表新建或打开一篇论文。",
    "p.audit": "核对正文引用",
    "p.auditScope": "只检查 [n] 编号与参考文献链接的格式，不判断来源是否真实、相关或能支持论点。",
    "p.auditEmpty": "正文还没有内容。",
    "p.auditTally": "正文标注 {n} 个不同编号；文末有 {m} 条编号文献。",
    "p.auditNoRefs": "未发现编号引文或文末编号文献。",
    "p.auditMissing": "缺少对应文献：{n}",
    "p.auditUncited": "文末列出但正文未引用：{n}",
    "p.auditDuplicate": "文末编号重复：{n}",
    "p.auditNoLink": "未附有效网页链接：{n}",
    "p.auditMalformed": "有不支持的组合编号，请改写成 [1][2] 这种形式。",
    "p.auditPass": "编号与链接格式核对通过，仍需打开原文核实。",
    "p.topicRequired": "先填写模板中的研究问题；也可加上简短的检索关键词。",
    "p.refsInvalid": "生成稿存在无对应来源的引文或不受支持的链接，原稿已保留。",
    'p.langTitle': '论文输出语言',
    'set.credits': '开发者名单',
    'upd.title': '🎉 更新完成', 'upd.whatsNew': '本次更新内容', 'upd.done': '知道了',
    'top.noNovel': '未选择小说', 'top.novelSwitch': '切换 / 管理小说',
    'w.secTitlePh': '条目名称（如：力量体系 / 势力 / 时间线）', 'w.secBodyPh': '展开设定…',
    'w.synopsisPh': '全书主线、起承转合、结局走向…', 'w.worldPh': '时代背景、地理、规则、力量体系总览…',
    'w.customEmpty': '可添加力量体系、势力、时间线等自定义设定条目。',
    'char.unnamed': '未命名', 'char.noIntro': '暂无介绍',
    'p.extractOnly': '提取记忆仅适用于小说板块', 'p.styleOnly': '文风诊断仅适用于小说板块',
    'p.titlePh': '论文标题（可留空，AI 可代起）…', 'p.statusTitle': '论文状态',
    'lib.editTitle': '编辑信息', 'lib.delTitle': '删除小说',
    'ed.chapterTitlePh': '章节标题（可留空，AI 可代起）…', 'ed.chapterStatus': '章节状态',
    'ed.editorPh': '全新章节，从这里开始你的宇宙……（Ctrl+S 保存 · 右侧 ✦ 召唤 AI 引擎）',
    'btn.focusTitle': '专注写作模式（隐藏面板）', 'btn.aiToggleTitle': 'AI 剧情引擎',
    'co.againTitle': '对结果不满意？重新生成',
    'ai.configTitle': 'AI 设置', 'ai.closeTitle': '收起面板',
    'novel.descPh': '一句话梗概、核心冲突、风格基调…',
    'aColor.cyan': '青色', 'aColor.magenta': '品红', 'aColor.green': '翠绿', 'aColor.gold': '琥珀',
    'aiset.namePh': '例如：本地 Qwen', 'aiset.pathPh': '/chat/completions（Pollinations 填 /openai）', 'aiset.keyPh': '云端模型必填；本地模型留空',
    'note.titlePh': '节点 / 卷名', 'note.contentPh': '情节要点、伏笔、一句话记忆…',
    'char.namePh': '角色名', 'char.rolePh': '主角 / 反派 / 星舰舰长…', 'char.appearancePh': '外貌特征…',
    'char.personalityPh': '性格特点、说话方式…', 'char.backgroundPh': '身世、动机、成长线…',
    'char.relationsPh': '与其他角色的关系…', 'char.notesPh': '埋设的伏笔、后期计划…',
    'profile.nickPh': '你的笔名…',
    'editor.placeholder.ru': 'Новая глава начинается здесь… (Ctrl+S — сохранить · ✦ ИИ-движок справа)',
    'toast.paperSaved': '论文已保存', 'toast.paperDeleted': '论文已删除',
    'auth.title': '👤 登录 / 注册', 'auth.login': '登录', 'auth.register': '注册',
    'auth.user': '用户名', 'auth.userPh': '2-20 位：字母 / 数字 / 下划线 / 中文',
    'auth.pass': '密码', 'auth.passPh': '至少 6 位，必须包含英文字母 + 数字',
    'auth.pass2': '确认密码', 'auth.pass2Ph': '再输入一次密码',
    'auth.email': '邮箱（必填，用于确认用户信息）', 'auth.emailPh': 'name@example.com',
    'auth.errEmail': '请输入有效的邮箱地址', 'auth.emailTaken': '该邮箱已被注册',
    'msg.title': '📩 私信', 'msg.empty': '暂无私信', 'msg.readAll': '全部已读',
    'msg.fromAdmin': '来自：站长', 'msg.copy': '复制', 'msg.sent': '私信已送达',
    'msg.sendToCreator': '✉️ 给创始人发信息', 'msg.sendToCreatorPh': '给创作者（小柚子）留言、提问或反馈…',
    'msg.sendCreator': '发送', 'msg.sentCreator': '已发送给创始人，请留意私信回复', 'msg.fail': '发送失败，请稍后再试',
    'admin.creatorMsgs': '📬 用户来信（给创始人）', 'admin.reply': '回复',
    'im.openTitle': '沉浸式写作：在聊天界面里用角色对话写小说', 'im.open': '沉浸式写作',
    'im.finish': '完成本章', 'im.inputPh': '输入角色要说的话…', 'im.send': '发送',
    'im.narrator': '旁白', 'im.hint': '选择下方角色，像发消息一样写对话。点右上角「完成本章」，AI 会把对话融合成正文并加入旁白。',
    'im.needNovel': '请先创建小说', 'im.needChapter': '请先创建章节', 'im.untitled': '未命名小说',
    'im.empty': '还没有对话，先发几条消息吧', 'im.confirm': 'AI 将把这些对话融合成正文（加入旁白与描写）并接在章节末尾。确定完成本章吗？',
    'im.generating': 'AI 正在融合对话与旁白…', 'im.done': '已完成：对话已融入正文，剧情继续推进！',
    'im.fail': '生成失败：',
    'im.system': '你是小说作家。请把下面的对话草稿改写成小说正文片段：加入旁白、动作与心理描写，衔接前文，推动剧情发展；保持人物性格与小说风格一致。直接输出正文，不要任何解释或标记。\n【小说】{title}\n【题材】{genre}\n【风格】{style}\n{chars}\n【前文结尾】{tail}\n【对话草稿】\n{transcript}',
    'admin.pendingTitle': '⏳ 待核对付款', 'admin.pendingEmpty': '暂无待核对付款',
    'admin.resolve': '✓ 核对并开通', 'admin.paymentsTitle': '💰 收款流水（最近）',
    'admin.msg': '✉ 私信', 'admin.msgTarget': '私信发送给：',
    'admin.msgPh': '私信内容（可发送 API 密钥等）…', 'admin.msgSend': '发送',
    'admin.msgSent': '私信已送达该用户',
    'set.emailLabel': '邮箱（用于确认用户信息）', 'set.emailSave': '保存邮箱', 'set.emailSaved': '邮箱已保存',
    'auth.forgot': '忘记密码？', 'auth.forgotTitle': '找回密码',
    'auth.q0': '不设置密保', 'auth.q1': '你最喜欢的一本书？', 'auth.q2': '你小时候的昵称？',
    'auth.q3': '你第一位老师的姓氏？', 'auth.q4': '你最喜欢的城市？',
    'auth.answer': '密保答案', 'auth.answerPh': '2-64 字符（请牢记）',
    'auth.newPass': '新密码', 'auth.backLogin': '返回登录', 'auth.resetPassword': '重置密码',
    'auth.blockedMsg': '该账户已被拉黑，如有疑问请联系管理员。',
    'auth.adminBadge': '管理员',
    'online.label': '在线',
    'set.adminBg': '👑 管理员专属背景', 'set.adminBgOn': '红灯车灯', 'set.adminBgOff': '普通版背景',
    'admin.open': '👑 管理入口', 'admin.openTitle': '管理入口（站内直接管理用户、付款、私信）',
    'admin.title': '👑 站长操作台',
    'admin.total': '注册人数', 'admin.online': '在线人数', 'admin.payers': '充值人数', 'admin.net': '净收入（元）',
    'admin.searchPh': '搜索用户…', 'admin.refresh': '刷新', 'admin.fullConsole': '打开完整后台 ↗',
    'admin.blocked': '已拉黑', 'admin.block': '拉黑', 'admin.unblock': '解除拉黑',
    'admin.wl': '加入白名单', 'admin.unwl': '移出白名单',
    'admin.protected': '管理员账号受保护', 'admin.required': '需要创作者授权的管理员账号',
    'admin.loadFail': '操作台数据加载失败，请检查网络', 'admin.opFail': '操作失败，请重试',
    'admin.blockedOk': '该用户已被拉黑并强制下线', 'admin.unblocked': '已解除拉黑',
    'admin.needServer': '完整管理功能需管理版服务器（node server.mjs）。您可点击右上「打开完整后台」或联系部署者。',
    'admin.receiptTitle': '🧾 收退款登记（核对到账后填写）',
    'admin.receiptKind': '类型', 'admin.receiptPayment': '收款', 'admin.receiptRefund': '退款',
    'admin.receiptAmount': '金额（元）', 'admin.receiptRef': '交易编号', 'admin.receiptTime': '发生时间（可选，默认现在）',
    'admin.receiptNote': '备注（可选）', 'admin.receiptSubmit': '登记',
    'admin.receiptOk': '已登记；40 元收款自动开通 30 天 DeepSeek',
    'admin.funcNote': '管理模块全部功能：① 统计概览 ② 待核对付款一键开通 ③ 收款流水 ④ 收退款登记 ⑤ 用户名单（搜索/拉黑/白名单/私信/邮箱） ⑥ 私信 ⑦ 完整后台',
    'auth.noQuestion': '该账户未设置密保问题，无法自助找回。请联系管理员重置密码。',
    'auth.badAnswer': '密保答案不正确', 'auth.resetOk': '密码已重置，请使用新密码登录',
    'auth.submitLogin': '登录', 'auth.submitRegister': '注册并开启体验',
    'auth.errUser': '用户名需 2-20 位（字母 / 数字 / 下划线 / 中文）',
    'auth.errPass': '密码需 6-20 位，且必须同时包含英文字母和数字',
    'auth.errPass2': '两次输入的密码不一致',
    'auth.errLogin': '用户名或密码错误', 'auth.errExists': '该用户名已注册，请直接登录',
    'auth.anyDevice': '无服务器模式：同一用户名+密码可在任何设备登录；数据请用「跨设备完整备份」携带',
    'history.btnTitle': '查看本文章的全部保存历史并可恢复', 'history.hint': '已自动保存历史快照：点工具栏「🕘 历史记录」可随时查看与恢复之前的版本',
    'share.title': '📤 把晓星分享给朋友', 'share.slogan': '免费 AI 写小说、写论文，还能用角色对话沉浸式创作——推荐给你！',
    'share.api': '📲 一键分享（系统分享）', 'share.copyLink': '复制链接', 'share.copyText': '复制推荐语 + 链接',
    'share.qrNote': '扫码即可打开晓星', 'share.copied': '已复制，快去分享吧！',
    'auth.adoptToast': '已在本设备建立该账号档案（同用户名+密码=同一身份；数据可用「跨设备完整备份」携带）',
    'auth.okRegister': '注册成功！已自动登录，1 天最高规格免费体验已开启（含 DeepSeek 等高级权益）',
    'auth.welcome': '欢迎回来，{u}',
    'auth.trialBanner': '🎁 注册新账户即享 1 天最高规格免费体验（含 DeepSeek 等高级权益 · 不强制消费）',
    'auth.account': '登录账户', 'auth.logout': '退出登录',
    'auth.confirmLogout': '确定退出当前账户？作品数据仍保存在本机。', 'auth.loggedOut': '已退出登录',
    'set.trialBadge': ' · 🎁 最高规格体验中',
    'quick.title': '新手工作台',
    'quick.heading': '第一段，从这里写起。',
    'quick.intro': '不用写代码。可以自己写，也可以先选模型，再用 AI 协助。',
    'quick.novel': '开始写小说',
    'quick.novelHint': '建一本小说，直接打开第一章。可写正文，也可先列大纲。',
    'quick.paper': '开始写论文',
    'quick.paperHint': '新建一篇论文，填研究主题，再选择输出语言。',
    'quick.model': '选择 AI 模型',
    'quick.modelHint': '选择已保存的模型，或用预设接入你的服务。',
    'quick.backup': '备份与恢复',
    'quick.backupHint': '下载全文或作品备份，也可从备份恢复。',
    'quick.tip': '作品默认留在当前浏览器。换设备前，请先导出备份。',
    'quick.guest': '先本地写作',
    'quick.guestNote': '可以不注册。允许本地保存后，作品只留在当前浏览器。',
    'quick.localAccount': '本地写作（未登录）',
    'vip.trialOn': '🎁 新用户专享：最高规格免费体验中（含 DeepSeek 等高级权益），剩余 {t}（不强制消费）',
    'vip.trialEnd': '专业版体验已结束，感谢体验！会员中心可选方案（试运营免费）。',
    'set.creator': '创作者：小柚子', 'set.creatorNote': '本站由单人开发 · 不定期更新', 'set.tip': '☕ 请作者喝杯奶茶',
    'tip.title': '☕ 支持创作者', 'tip.note': '本站由小柚子单人开发，不定期更新。打赏全凭心意，不强制、纯自愿。',
    'tip.amount': '支持金额', 'tip.customPh': '自定义金额（元）…', 'tip.msg': '想对创作者说的话（可选）',
    'tip.msgPh': '鼓励的话、建议、想说的话…', 'tip.send': '💛 送出心意',
    'tip.thanks': '感谢您的支持！小柚子收到啦 💛', 'tip.fail': '发送失败，请稍后再试', 'tip.needAmount': '请选择或输入支持金额'
  },
  en: {
    'refs.open': 'Source notebook',
    'brand.sub': 'ALL-GENRE NOVEL STUDIO', 'brand.name': 'XIAOXING',
    'btn.langTitle': 'Switch language',
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
    'backup.txt': 'Export current work as TXT', 'backup.txtSub': 'Novel chapters or the current paper as plain text',
    'backup.json': 'Back up all projects as JSON', 'backup.jsonSub': 'Includes drafts, version history and chats; excludes accounts and model keys',
    'backup.import': 'Import JSON backup', 'backup.importSub': 'Restore as separate copies; keep your current work', 'backup.importBtn': 'Import',
    'backup.wipe': 'Wipe all data', 'backup.wipeSub': 'Cannot be undone!', 'backup.wipeBtn': 'Wipe',
    'backup.xdev': 'Full cross-device backup (account + data, encrypted)', 'backup.xdevSub': 'Includes accounts, all works and settings; restorable on any device',
    'backup.xdevPassPh': 'Backup password (6+ chars, letters + digits)', 'backup.xdevExport': 'Encrypted backup',
    'backup.xdevImport': 'Full cross-device restore', 'backup.xdevImportSub': 'Pick an .xxb file or paste the backup code',
    'backup.xdevImportPassPh': 'Backup password', 'backup.xdevFile': 'Pick file', 'backup.xdevPaste': 'Paste code',
    'backup.xdevOk': 'Encrypted backup created (copied to clipboard and downloaded as .xxb)',
    'backup.xdevRestored': 'Restored: accounts and works merged into this device',
    'backup.xdevBad': 'Invalid backup or wrong password', 'backup.xdevNeedLogin': 'Sign in before creating an encrypted backup',
    'backup.xdevPassRule': 'Backup password needs 6+ characters with letters and digits',
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
    'w.edit': '✎ Edit style table', 'w.styleProfile': 'Style Profile', 'w.synopsis': 'SYNOPSIS', 'w.world': 'WORLDVIEW', 'w.custom': 'Custom sections', 'w.addSec': '＋ Add section',
    'w.authorLib': 'AUTHOR STYLE LAB', 'w.authorTip': 'Click an author to toggle reference. “Learn styles online” fetches Wikipedia entries to study their craft; the notes are injected into the AI context.',
    'w.learn': '⛁ Learn styles online', 'w.learnSel': '⛁ Learn styles online ({n} selected)', 'w.builtin': 'Built-in craft notes', 'w.wiki': 'Online study (Wikipedia)',
    'w.learnOk': 'Style learning done: {ok}/{n} succeeded', 'w.learnFail': 'Style learning failed (check network)', 'w.learnPartial': 'Style learning: {ok} ok / {fail} failed',
    'stat.words': 'CJK {a} · EN words {b}', 'stat.pos': 'Ln {a} · Col {b}', 'stat.chars': 'Chars {a}', 'stat.wordsChip': 'words',
    'dict.loading': 'Looking up…', 'dict.notfound': 'No definition found. Check the spelling or try another word.',
    'dict.errNet': 'Dictionary request failed — network issue? (This API needs internet.)', 'dict.syn': 'Synonyms', 'dict.src': 'Source: dictionaryapi.dev · Datamuse',
    'toast.welcome': 'Welcome to XIAOXING! Create a novel first, then connect your model via “⚙ AI Models”.',
    'toast.saved': 'Saved', 'toast.savedOk': 'Saved', 'toast.needNovel': 'Create a novel first', 'toast.needNovelSel': 'Select a novel first',
    'toast.noChapters': 'No chapters yet', 'toast.txtOk': 'TXT exported', 'toast.backupOk': 'Backup done',
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
    'ai.dataNote': 'AI sends your prompt and relevant context to the selected model. Manual writing and local saves do not send drafts.',
    'empty.chat': '✦ Choose a model to try AI.<br/>Use the quick actions above or ask a question. Test the connection in model settings if needed.',
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
    'toast.importOk': 'Restored as separate copies', 'backup.copySuffix': 'Restored copy', 'backup.invalid': 'This is not a supported XIAOXING backup.', 'backup.empty': 'The backup has no novels or papers to restore.', 'backup.idbOnly': 'Restoring requires IndexedDB. You can still export a backup.', 'backup.exportFail': 'Backup export failed. Check your browser storage.', 'backup.orphanChats': 'Skipped {n} old chat records without a matching project.',
    'confirm.import': 'Restore separate copies: {details}. Your existing projects will not be overwritten. Continue?',
    'dict.provOk': '✓ Connected: ', 'dict.provFail': 'Connection failed: ',
    'learn.fetching': 'Studying {name}…', 'learn.noSel': 'Select reference authors above first',
    'w.noAuthors': 'No reference authors selected. Click the author chips above, then learn their craft online.',
    'novel.legacyGenre': 'Uncategorized',
    'terms.title': '📜 User Notice & Code of Conduct',
    'terms.noticeTitle': 'I. User Notice',
    'terms.notice': '<ul><li><b>Local storage</b>: your novels, outlines, characters and memories are stored only in your own browser (IndexedDB). Ordinary manual editing and saving do not send drafts to a model service. Clearing browser data erases your work — back up regularly via “⛁ Backup”.</li><li><b>AI access</b>: Choose a built-in, cloud or local model. When you use AI, the corresponding prompt and selected context are sent to the model provider. Enabled fallback providers may also receive a request. API keys are saved locally and used only for the corresponding provider.</li><li><b>Online features</b>: “Learn styles online” and the English dictionary query public APIs (Wikipedia, dictionary services) for lookups using the search terms you provide.</li><li><b>Responsibility</b>: this tool is free and provided without warranty. Review AI-generated content for accuracy, copyright and compliance; you are fully responsible for what you publish.</li><li><b>Minors</b>: use under guardian supervision.</li></ul>',
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
    'vip.title': '💎 Membership', 'vip.notice': 'Only paid item: DeepSeek Monthly (¥40/month) · everything else is free during beta',
    'vip.free': 'Free', 'vip.freePrice': '¥0 · beta', 'vip.currentBtn': 'Current plan',
    'vip.f1': 'Built-in free AI model', 'vip.f2': 'All creative features', 'vip.f3': 'Local data storage',
    'vip.pro': 'Pro', 'vip.proPrice': '¥0 · beta',
    'vip.p1': 'Better LLMs', 'vip.p2': 'Longer context memory', 'vip.p3': 'Faster generation',
    'vip.flag': 'Flagship', 'vip.flagPrice': '¥0 · beta',
    'vip.l1': 'All Pro benefits', 'vip.l2': 'Early access to new models', 'vip.l3': 'Dedicated support',
    'vip.btn': 'Coming soon', 'vip.btnToast': 'Free during beta — stay tuned',
    'vip.foot': 'The only paid item is DeepSeek Monthly (¥40/month); everything else is free during beta.',
    'vip.deepseek': 'DeepSeek Monthly', 'vip.deepseekPrice': '¥40 / month',
    'vip.d1': 'Stable access to DeepSeek and other quality models (separate from the free quota)',
    'vip.d2': 'Faster responses · longer memory (up to 5 chapters)',
    'vip.d3': 'Monthly payment · no auto-renewal · you decide each month',
    'vip.deepseekBtn': 'Sign the agreement & subscribe',
    'agr.title': '📄 DeepSeek Monthly Service Agreement',
    'agr.agreeLabel': 'I have read and agree to all the terms above',
    'agr.signLabel': 'Electronic signature (type your username)',
    'agr.signPh': 'Type your username as your electronic signature',
    'agr.signBtn': 'Sign & show the payment code',
    'agr.payNote': 'Pay ¥40 with the personal payment code below and follow the steps.',
    'agr.amount': 'Amount: ¥40.00 (one month of service)',
    'agr.step1': 'Scan the code with WeChat / Alipay',
    'agr.step2': 'Put your username in the payment note so we can verify',
    'agr.step3': 'After paying, click “I have paid — submit for verification” below',
    'agr.waitNote': 'The operator verifies the payment and activates the service within 24 hours; before verification you may request a full refund at any time.',
    'agr.paidBtn': 'I have paid — submit for verification',
    'agr.hintNeedAgree': 'Please tick “I have read and agree” first',
    'agr.hintNeedLogin': 'Please sign in before signing the agreement',
    'agr.hintSignMismatch': 'The signature must match your signed-in username',
    'agr.signedOk': 'Agreement signed — please complete the payment',
    'agr.submitted': 'Submitted! The operator verifies the payment within 24 hours; you may request a refund anytime before activation.',
    'agr.submitFail': 'Submission failed. Please retry later or contact the operator via Feedback.',
    'agr.pending': 'Verifying…',
    'agr.text': '<h3>Article 1. Service and price</h3><p>1.1 This agreement is between the user and the XIAOXING website (creator: 小柚子, “the site”) for the DeepSeek Monthly service.</p><p>1.2 The service provides access to DeepSeek and other quality models available on the site, faster responses and longer context memory (up to 5 chapters).</p><p>1.3 Price: CNY 40 per month (30 days).</p><h3>Article 2. Payment</h3><p>2.1 Payment is made via the creator’s personal payment code.</p><p>2.2 The user should put their username in the payment note for verification.</p><p>2.3 Payment does not activate the service immediately: the operator verifies the actual receipt first. Before verification the user may request a refund at any time.</p><h3>Article 3. Term and renewal</h3><p>3.1 One month runs for 30 days from the actual payment date (as recorded).</p><p>3.2 There is no auto-renewal and no automatic charging: when the term ends the service stops, and renewal is entirely the user’s choice.</p><p>3.3 Renewal requires signing this agreement again and paying again.</p><h3>Article 4. Refunds</h3><p>4.1 Before verification and activation, the user may request a full refund anytime via “💬 Feedback”.</p><p>4.2 After activation the service is generally non-refundable due to its immediate nature; if the service is unusable for 72 consecutive hours due to the site, a pro-rated refund for the remaining days may be requested.</p><p>4.3 Verified refunds are returned via the original channel, usually within 7 business days.</p><h3>Article 5. Usage rules</h3><p>5.1 Benefits are for the account owner only; reselling, sharing or renting is prohibited.</p><p>5.2 Users must follow the site’s Notice & Rules and the AI providers’ terms, and must not generate illegal or infringing content.</p><p>5.3 Violations may result in service termination without refund.</p><h3>Article 6. Disclaimer</h3><p>6.1 The site makes best efforts, but AI output is not professional advice or a promise.</p><p>6.2 Temporary unavailability caused by third-party providers, networks or force majeure is not compensated, but the site will work to restore service.</p><p>6.3 The site may adjust prices or content with advance notice; paid periods are unaffected.</p><h3>Article 7. Personal information</h3><p>7.1 The site collects only what is needed for activation and verification (username, payment records).</p><p>7.2 Payment details are processed by the payment platform; the site does not access bank account information.</p><h3>Article 8. Disputes</h3><p>8.1 This agreement is governed by the laws of the People’s Republic of China.</p><p>8.2 Disputes are resolved by friendly negotiation first; otherwise they may be brought to the competent court where the site operator is located.</p>',
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
    'style.standard': 'Creation standard', 'style.stGeneric': 'Universal', 'style.stNet': 'CN web fiction', 'style.stTrad': 'CN classic', 'style.stJP': 'JP light novel', 'style.stWest': 'Western', 'style.stRu': 'Russian',
    'style.personal': 'Personalization', 'style.perHuman': 'More human-like', 'style.perStandard': 'Standard output',
    'storage.title': '💾 Storage Permission',
    'storage.desc': '<p>XIAOXING needs to save your <b>novels, outlines, characters and memories</b> in <b>your own device\'s browser storage</b> (IndexedDB) for autosave and future sessions. This permission only covers local saving; using online AI is a separate action.</p><p>If you agree, your work autosaves. If you decline, <b>nothing will be saved</b> and it may be lost when you close the page.</p>',
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
    'sp.filterPh': 'Filter authors…',
    'board.novel': '📖 Novel', 'board.paper': '📄 Paper',
    'p.list': 'My Papers', 'p.new': 'New Paper', 'p.empty': 'No papers yet.<br/>Click “＋ New Paper”, fill the topic, then “📚 Search & Generate”.',
    'p.topicLabel': '📄 Topic / Requirements',
    "p.topicPh": "Add a research question, scope and requirements. Online search uses short keywords only.",
    'p.editorPh': 'Write here or generate a draft. Mark sources with [1][2] and check the original texts before submitting.',
    'p.gen': '📚 Search & Generate', 'p.again': '🔄 Regenerate',
    'p.needTopic': 'Fill in the topic first', 'p.needOpen': 'Create and open a paper first',
    'p.overwrite': 'This paper already has content. Overwrite?',
    'p.done': '✓ Paper generated — click “🔄 Regenerate” if not satisfied',
    "p.freeNote": "Search provides candidate sources. Write by hand or use an AI draft, then verify the original sources, citations and page numbers.",
    'p.upgrade': '💎 Upgrade for better text',
    'gp.psearch': 'Searching references', 'gp.refsFound': '{n} references found', 'gp.pdraft': 'Drafting the outline', 'gp.pwrite': 'Writing the paper',
    'gp.check': '⚖ Quality check', 'gp.rewrite': 'Issues found — rewriting', 'gp.pass': 'Check passed · quality confirmed',
    'gp.failCheck': 'AI self-check failed: after several rewrites the quality bar was not met, so nothing was output. Adjust the outline/topic and retry.',
    'gp.forceOutput': 'Self-check didn\'t fully pass: after the required two rewrites, the text is output directly for your review.',
    'gp.forceNote': 'Two rewrites done · outputting directly',
    'sp.scrollHint': 'Scroll or use buttons to view all author bios',
    "p.guide": "Writing guide",
    "p.guideTitle": "Plan your paper",
    "p.guideStart": "Choose a starter template",
    "p.step1": "Define one answerable question and set limits on your period, place, population or material.",
    "p.step2": "Read the original sources and record the evidence and page numbers. Search results are leads, not proof.",
    "p.step3": "Write by hand or generate a draft. Before submitting, check every [n], the original passage and the required citation style.",
    "p.tplReview": "Literature review",
    "p.tplCompare": "Comparative analysis",
    "p.tplEmpirical": "Empirical study",
    "p.tplReviewBody": "Research question:\nSearch keywords:\nDate range and disciplines:\nInclusion and exclusion criteria:\nPositions to compare:",
    "p.tplCompareBody": "Research question:\nSearch keywords:\nCases and period:\nCommon criteria for comparison:\nSources to consult:",
    "p.tplEmpiricalBody": "Research question:\nSearch keywords:\nPopulation and sample:\nData and method:\nLimitations and possible bias:",
    "p.guideBlank": "Templates only fill an empty topic field. Your draft stays as it is.",
    "p.guideFilled": "Your topic already has text. A template would overwrite it, so continue using the steps above.",
    "p.guideNeedPaper": "Create or open a paper first.",
    "p.audit": "Check draft citations",
    "p.auditScope": "Checks [n] numbering and link format only. It does not verify that sources are real, relevant or support any claim.",
    "p.auditEmpty": "The draft is empty.",
    "p.auditTally": "The body cites {n} distinct numbers; the reference list has {m} numbered entries.",
    "p.auditNoRefs": "No numbered citations or numbered references found.",
    "p.auditMissing": "Missing reference entries: {n}",
    "p.auditUncited": "Listed but not cited in the body: {n}",
    "p.auditDuplicate": "Duplicate reference numbers: {n}",
    "p.auditNoLink": "No valid web link: {n}",
    "p.auditMalformed": "Use separate numbers like [1][2], rather than grouped citations.",
    "p.auditPass": "Numbering and link format match. Still verify the original sources.",
    "p.topicRequired": "Fill in the research question first. You can add short search keywords.",
    "p.refsInvalid": "The generated draft has unmatched citations or unsupported links. Your original was kept.",
    'p.langTitle': 'Paper output language',
    'set.credits': 'Developer credits',
    'upd.title': '🎉 Update complete', 'upd.whatsNew': 'What\'s new', 'upd.done': 'Got it',
    'top.noNovel': 'No novel selected', 'top.novelSwitch': 'Switch / manage novels',
    'w.secTitlePh': 'Entry name (e.g. power system / factions / timeline)', 'w.secBodyPh': 'Expand the setting…',
    'w.synopsisPh': 'Main plotline, arcs, ending…', 'w.worldPh': 'Era, geography, rules, power systems…',
    'w.customEmpty': 'Add custom entries: power systems, factions, timelines…',
    'char.unnamed': 'Unnamed', 'char.noIntro': 'No intro yet',
    'p.extractOnly': 'Memory extraction works in the Novel board only', 'p.styleOnly': 'Style check works in the Novel board only',
    'p.titlePh': 'Paper title (optional, AI can suggest one)…', 'p.statusTitle': 'Paper status',
    'lib.editTitle': 'Edit info', 'lib.delTitle': 'Delete novel',
    'ed.chapterTitlePh': 'Chapter title (optional, AI can suggest one)…', 'ed.chapterStatus': 'Chapter status',
    'ed.editorPh': 'A new chapter starts here… (Ctrl+S to save · ✦ AI engine on the right)',
    'btn.focusTitle': 'Focus mode (hide panels)', 'btn.aiToggleTitle': 'AI story engine',
    'co.againTitle': 'Not satisfied? Regenerate',
    'ai.configTitle': 'AI settings', 'ai.closeTitle': 'Collapse panel',
    'novel.descPh': 'One-line premise, core conflict, tone…',
    'aColor.cyan': 'Cyan', 'aColor.magenta': 'Magenta', 'aColor.green': 'Green', 'aColor.gold': 'Amber',
    'aiset.namePh': 'e.g. Local Qwen', 'aiset.pathPh': '/chat/completions (use /openai for Pollinations)', 'aiset.keyPh': 'Required for cloud models; leave empty for local',
    'note.titlePh': 'Node / volume name', 'note.contentPh': 'Plot points, foreshadowing, one-line memory…',
    'char.namePh': 'Character name', 'char.rolePh': 'Hero / villain / starship captain…', 'char.appearancePh': 'Appearance…',
    'char.personalityPh': 'Personality, speech style…', 'char.backgroundPh': 'Backstory, motives, arc…',
    'char.relationsPh': 'Relations with other characters…', 'char.notesPh': 'Foreshadowing, future plans…',
    'profile.nickPh': 'Your pen name…',
    'editor.placeholder.ru': 'Новая глава начинается здесь… (Ctrl+S — сохранить · ✦ ИИ-движок справа)',
    'toast.paperSaved': 'Paper saved', 'toast.paperDeleted': 'Paper deleted',
    'auth.title': '👤 Sign in / Register', 'auth.login': 'Sign in', 'auth.register': 'Register',
    'auth.user': 'Username', 'auth.userPh': '2-20 chars: letters / numbers / _ / Chinese',
    'auth.pass': 'Password', 'auth.passPh': 'Min 6 chars, must contain letters AND digits',
    'auth.pass2': 'Confirm password', 'auth.pass2Ph': 'Type the password again',
    'auth.email': 'Email (required, used to verify your identity)', 'auth.emailPh': 'name@example.com',
    'auth.errEmail': 'Enter a valid email address', 'auth.emailTaken': 'This email is already registered',
    'msg.title': '📩 Messages', 'msg.empty': 'No messages yet', 'msg.readAll': 'Mark all read',
    'msg.fromAdmin': 'From: operator', 'msg.copy': 'Copy', 'msg.sent': 'Message delivered',
    'msg.sendToCreator': '✉️ Message the creator', 'msg.sendToCreatorPh': 'Leave a message, question or feedback for the creator (小柚子)…',
    'msg.sendCreator': 'Send', 'msg.sentCreator': 'Sent to the creator — watch your inbox for a reply', 'msg.fail': 'Failed to send. Please retry.',
    'admin.creatorMsgs': '📬 Messages to the creator', 'admin.reply': 'Reply',
    'im.openTitle': 'Immersive writing: write your novel as character chats', 'im.open': 'Immersive Writing',
    'im.finish': 'Finish chapter', 'im.inputPh': 'Type what the character says…', 'im.send': 'Send',
    'im.narrator': 'Narrator', 'im.hint': 'Pick a character below and write like chatting. Tap “Finish chapter” and the AI turns the dialogue into prose with narration.',
    'im.needNovel': 'Create a novel first', 'im.needChapter': 'Create a chapter first', 'im.untitled': 'Untitled novel',
    'im.empty': 'No dialogue yet — send a few messages first', 'im.confirm': 'The AI will turn this dialogue into prose (with narration) and append it to the chapter. Finish the chapter now?',
    'im.generating': 'AI is weaving dialogue and narration…', 'im.done': 'Done: the dialogue is now prose and the plot moves on!',
    'im.fail': 'Generation failed: ',
    'im.system': 'You are a novelist. Rewrite the dialogue draft below into novel prose: add narration, action and inner thoughts, connect with the previous text and push the plot forward; keep the characters and style consistent. Output only the prose, without explanations or markers.\n【Novel】{title}\n【Genre】{genre}\n【Style】{style}\n{chars}\n【End of previous text】{tail}\n【Dialogue draft】\n{transcript}',
    'admin.pendingTitle': '⏳ Pending payments', 'admin.pendingEmpty': 'No pending payments',
    'admin.resolve': '✓ Verify & activate', 'admin.paymentsTitle': '💰 Recent receipts',
    'admin.msg': '✉ Message', 'admin.msgTarget': 'Send message to:',
    'admin.msgPh': 'Message content (e.g. an API key)…', 'admin.msgSend': 'Send',
    'admin.msgSent': 'Message delivered to the user',
    'set.emailLabel': 'Email (used to verify your identity)', 'set.emailSave': 'Save email', 'set.emailSaved': 'Email saved',
    'auth.forgot': 'Forgot password?', 'auth.forgotTitle': 'Recover password',
    'auth.q0': 'No security question', 'auth.q1': 'What is your favorite book?', 'auth.q2': 'Your childhood nickname?',
    'auth.q3': 'Your first teacher\'s surname?', 'auth.q4': 'Your favorite city?',
    'auth.answer': 'Security answer', 'auth.answerPh': '2-64 characters (remember it!)',
    'auth.newPass': 'New password', 'auth.backLogin': 'Back to sign in', 'auth.resetPassword': 'Reset password',
    'auth.blockedMsg': 'This account has been blocked. Contact the site operator.',
    'auth.adminBadge': 'Admin',
    'online.label': 'online',
    'set.adminBg': '👑 Admin background', 'set.adminBgOn': 'Red lights', 'set.adminBgOff': 'Normal background',
    'admin.open': '👑 Admin Entry', 'admin.openTitle': 'Admin entry (manage users, payments and messages right here)',
    'admin.title': '👑 Admin Console',
    'admin.total': 'Sign-ups', 'admin.online': 'Online', 'admin.payers': 'Payers', 'admin.net': 'Net (CNY)',
    'admin.searchPh': 'Search users…', 'admin.refresh': 'Refresh', 'admin.fullConsole': 'Full console ↗',
    'admin.blocked': 'Blocked', 'admin.block': 'Block', 'admin.unblock': 'Unblock',
    'admin.wl': 'Allowlist', 'admin.unwl': 'Remove',
    'admin.protected': 'Admin accounts are protected', 'admin.required': 'A creator-authorized admin account is required',
    'admin.loadFail': 'Failed to load console data. Check your connection.', 'admin.opFail': 'Action failed. Please retry.',
    'admin.blockedOk': 'User blocked and signed out', 'admin.unblocked': 'User unblocked',
    'admin.needServer': 'Full admin features require the managed server (node server.mjs). Open the full console or contact the operator.',
    'admin.receiptTitle': '🧾 Record a receipt/refund (after verifying the transfer)',
    'admin.receiptKind': 'Type', 'admin.receiptPayment': 'Payment', 'admin.receiptRefund': 'Refund',
    'admin.receiptAmount': 'Amount (CNY)', 'admin.receiptRef': 'Reference', 'admin.receiptTime': 'Time (optional, defaults to now)',
    'admin.receiptNote': 'Note (optional)', 'admin.receiptSubmit': 'Record',
    'admin.receiptOk': 'Recorded; a ¥40 payment auto-activates 30 days of DeepSeek',
    'admin.funcNote': 'Admin module functions: ① stats ② pending payments one-click activation ③ receipt history ④ record receipts/refunds ⑤ user list (search / block / allowlist / message / email) ⑥ private messages ⑦ full console',
    'auth.noQuestion': 'This account has no security question set, so self-service recovery is unavailable. Contact the operator.',
    'auth.badAnswer': 'Incorrect security answer', 'auth.resetOk': 'Password reset — sign in with the new password',
    'auth.submitLogin': 'Sign in', 'auth.submitRegister': 'Register & start trial',
    'auth.errUser': 'Username must be 2-20 chars (letters / numbers / _ / Chinese)',
    'auth.errPass': 'Password must be 6-20 chars and contain both letters and digits',
    'auth.errPass2': 'The two passwords do not match',
    'auth.errLogin': 'Wrong username or password', 'auth.errExists': 'Username already registered — sign in instead',
    'auth.anyDevice': 'Serverless mode: the same username + password works on any device; carry your data with “Full cross-device backup”.',
    'history.btnTitle': 'View and restore all saved versions of this document', 'history.hint': 'Snapshots are saved automatically: tap “🕘 History” in the toolbar to view and restore earlier versions anytime',
    'share.title': '📤 Share Xiaoxing with friends', 'share.slogan': 'Free AI novel & paper writing, plus immersive character-chat creation — recommended!',
    'share.api': '📲 Share (system dialog)', 'share.copyLink': 'Copy link', 'share.copyText': 'Copy message + link',
    'share.qrNote': 'Scan to open Xiaoxing', 'share.copied': 'Copied — go share it!',
    'auth.adoptToast': 'Account profile created on this device (same username + password = same identity; carry data with “Full cross-device backup”).',
    'auth.okRegister': 'Registered! Signed in automatically — 1-day top-tier free trial (incl. DeepSeek) started',
    'auth.welcome': 'Welcome back, {u}',
    'auth.trialBanner': '🎁 New accounts get a 1-day top-tier free trial (incl. DeepSeek · no purchase required)',
    'auth.account': 'Account', 'auth.logout': 'Sign out',
    'auth.confirmLogout': 'Sign out of this account? Your works stay saved on this device.', 'auth.loggedOut': 'Signed out',
    'set.trialBadge': ' · 🎁 Top-tier trial',
    'quick.title': 'Quick Start',
    'quick.heading': 'Write your first paragraph.',
    'quick.intro': 'No code required. Write on your own or choose an AI model for help.',
    'quick.novel': 'Start a novel',
    'quick.novelHint': 'Create a novel and open chapter one. Start drafting or write an outline.',
    'quick.paper': 'Start a paper',
    'quick.paperHint': 'Open a blank paper, add a research topic, and pick the output language.',
    'quick.model': 'Choose an AI model',
    'quick.modelHint': 'Select a saved model or use a preset to connect your own provider.',
    'quick.backup': 'Back up and restore',
    'quick.backupHint': 'Download your text or a backup of your work, or restore from a backup.',
    'quick.tip': 'Work stays in this browser. Export a backup before switching browsers or devices.',
    'quick.guest': 'Write without an account',
    'quick.guestNote': 'Registration is optional. If you allow local storage, your work stays in this browser.',
    'quick.localAccount': 'Writing locally (signed out)',
    'vip.trialOn': '🎁 New-user perk: top-tier free trial (incl. DeepSeek) active, {t} left (no purchase required)',
    'vip.trialEnd': 'Your Pro trial has ended — thanks for trying! Pick a plan in the Membership center (free during beta).',
    'set.creator': 'Creator: 小柚子', 'set.creatorNote': 'Solo developer · irregular updates', 'set.tip': '☕ Tip the creator',
    'tip.title': '☕ Support the Creator', 'tip.note': 'Made by 小柚子, a solo developer, with irregular updates. Tips are completely voluntary — no obligation.',
    'tip.amount': 'Tip amount', 'tip.customPh': 'Custom amount (CNY)…', 'tip.msg': 'A message for the creator (optional)',
    'tip.msgPh': 'Encouragement, ideas, anything…', 'tip.send': '💛 Send support',
    'tip.thanks': 'Thank you for your support! 小柚子 got your message 💛', 'tip.fail': 'Failed to send, try again later', 'tip.needAmount': 'Choose or enter an amount'
  },
  ru: {
    'refs.open': 'Заметки об источниках',
    'brand.sub': 'СТУДИЯ РОМАНОВ ВСЕХ ЖАНРОВ', 'brand.name': 'СЯОСИН',
    'btn.langTitle': 'Переключить язык',
    'btn.backup': '⛁ Резерв', 'btn.backupTitle': 'Резерв и экспорт',
    'btn.ai': '⚙ ИИ-модели', 'btn.aiTitle': 'Настройки ИИ-моделей',
    'btn.profileTitle': 'Профиль (аватар / ник)',
    'profile.default': 'Нет ника',
    'nav.chapters': 'Главы', 'nav.outline': 'План', 'nav.characters': 'Персонажи', 'nav.style': 'Стиль', 'nav.world': 'Мир', 'nav.memories': 'Память',
    'btn.dict': '📖 Словарь', 'btn.dictTitle': 'Словарь (открывается с выделенным текстом)',
    'btn.focus': '⛶ Фокус', 'btn.focusExit': '⛶ Выйти',
    'btn.aiToggle': '✦ ИИ-движок',
    'status.draft': 'Черновик', 'status.revising': 'Правка', 'status.done': 'Готово',
    'ai.title': '✦ Движок сюжета', 'ai.clearTitle': 'Очистить чат',
    'ai.ctx': 'Контекст · Объём памяти',
    'ctx.outline': 'План', 'ctx.chars': 'Персонажи', 'ctx.world': 'Мир', 'ctx.mem': 'Память', 'ctx.chatHistory': 'История чата', 'ctx.prev': 'Пред. главы',
    'chip.continue': '▶ Продолжить', 'chip.plot': '⛨ Идеи сюжета', 'chip.brainstorm': '✦ Мозговой штурм', 'chip.polish': '✎ Отшлифовать',
    'chip.extract': '◬ Извлечь память', 'chip.outline': '◈ Черновик плана', 'chip.style': '✧ Проверка стиля',
    'ai.send': 'Отправить', 'ai.stop': '■ Стоп',
    'lib.title': '◈ Библиотека', 'lib.new': '＋ Новый роман',
    'novel.title': 'Название (можно позже)', 'novel.titlePh': 'Оставьте пустым…',
    'novel.descLabel': 'Описание (ИИ использует автоматически)',
    'novel.titleSuggest': '✨ Идеи названий', 'novel.titleSuggestHint': 'Название можно не указывать — напишите описание, и ИИ предложит варианты.',
    'novel.pending': 'Без названия',
    'novel.legacyGenre': 'Без жанра',
    'style.audience': 'Аудитория', 'style.genres': 'Жанры (несколько)', 'style.length': 'Объём', 'style.pov': 'Точка зрения', 'style.tone': 'Тон',
    'style.narrative': 'Повествование', 'style.dialogue': 'Диалоги в приоритете', 'style.balanced': 'Баланс', 'style.narrativeMode': 'Повествование в приоритете',
    'style.standard': 'Стандарт творчества', 'style.stGeneric': 'Универсальный', 'style.stNet': 'Китайский веб-роман', 'style.stTrad': 'Китайская классика', 'style.stJP': 'Японское ранобэ', 'style.stWest': 'Западный роман', 'style.stRu': 'Русская литература',
    'style.personal': 'Персонализация', 'style.perHuman': 'Более человечно', 'style.perStandard': 'Стандартный вывод',
    'style.lang': 'Язык', 'style.authors': 'Эталонные авторы (рекомендация)', 'style.learn': '⛁ Изучить стили онлайн',
    'aiset.title': '⚙ Доступ к ИИ-моделям', 'aiset.list': 'Подключённые модели', 'aiset.add': '＋ Добавить модель', 'aiset.accent': 'Цвет акцента',
    'aiset.config': 'Конфигурация', 'aiset.preset': 'Пресет (быстрое заполнение)', 'aiset.name': 'Отображаемое имя',
    'aiset.base': 'Base URL (обычно заканчивается на /v1)', 'aiset.path': 'Путь API (по умолч. /chat/completions)', 'aiset.key': 'API-ключ', 'aiset.model': 'Имя модели',
    'aiset.temp': 'Температура', 'aiset.maxtok': 'Макс. токенов', 'aiset.test': 'Проверить подключение', 'aiset.save': 'Сохранить и включить',
    'aiset.help': '<b>Как подключить?</b><p>Подходит любой OpenAI-совместимый API. Облачные модели требуют Base URL + ключ; локальные (Ollama / LM Studio / vLLM / llama.cpp) — только локальный адрес, ключ пустой.</p><p><b>Встроенная бесплатная модель</b>: Pollinations AI — без ключа и регистрации, работает сразу. Бесплатный лимит ограничен; для стабильности выберите DeepSeek / Kimi в пресетах и вставьте свой ключ.</p><p>Ollama требует CORS: задайте <code>OLLAMA_ORIGINS=*</code> и перезапустите; либо запустите <code>node proxy.mjs</code> и укажите Base URL <code>http://localhost:8787/v1</code>.</p>',
    'aiset.compare': 'Совместимость моделей (адаптированы популярные ИИ)',
    'aiset.stFree': 'Бесплатно · без ключа · адаптировано', 'aiset.stFreeTier': 'Бесплатный лимит · нужен ключ · адаптировано',
    'aiset.stPaid': 'Платно · нужен ключ · адаптировано (VIP поможет)',
    'aiset.auto': 'Автопереключение резервных моделей (при сбое — следующая доступная)',
    'backup.title': '⛁ Резерв и экспорт', 'backup.desc': 'Данные хранятся в браузере на вашем устройстве (IndexedDB). Очистка данных браузера удалит их — делайте резервные копии. Лимита на объём нет.',
    'backup.txt': 'Экспорт текущей работы в TXT', 'backup.txtSub': 'Главы романа или текст текущей статьи',
    'backup.json': 'Резервная копия всех работ (JSON)', 'backup.jsonSub': 'Включает черновики, версии и чаты; без аккаунтов и ключей моделей',
    'backup.import': 'Импорт резервной копии', 'backup.importSub': 'Восстановление копий без замены текущих работ', 'backup.importBtn': 'Импорт',
    'backup.wipe': 'Удалить все данные', 'backup.wipeSub': 'Необратимо!', 'backup.wipeBtn': 'Удалить',
    'backup.xdev': 'Полный бэкап между устройствами (аккаунт + данные, шифрование)', 'backup.xdevSub': 'Аккаунты, все работы и настройки; восстановление на любом устройстве',
    'backup.xdevPassPh': 'Пароль бэкапа (6+ символов, буквы + цифры)', 'backup.xdevExport': 'Шифрованный бэкап',
    'backup.xdevImport': 'Полное восстановление', 'backup.xdevImportSub': 'Выберите файл .xxb или вставьте код',
    'backup.xdevImportPassPh': 'Пароль бэкапа', 'backup.xdevFile': 'Выбрать файл', 'backup.xdevPaste': 'Вставить код',
    'backup.xdevOk': 'Шифрованный бэкап создан (скопирован и скачан .xxb)',
    'backup.xdevRestored': 'Восстановлено: аккаунты и работы объединены на этом устройстве',
    'backup.xdevBad': 'Неверный бэкап или пароль', 'backup.xdevNeedLogin': 'Войдите в аккаунт перед шифрованным бэкапом',
    'backup.xdevPassRule': 'Пароль бэкапа: минимум 6 символов, буквы и цифры',
    'backup.backupBtn': 'Копия',
    'note.title': 'Заголовок', 'note.content': 'Содержимое', 'note.cat': 'Категория',
    'cat.plot': 'Сюжет', 'cat.char': 'Персонаж', 'cat.foreshadow': 'Задел', 'cat.world': 'Мир', 'cat.other': 'Другое',
    'char.title': '♜ Карточка персонажа', 'char.name': 'Имя', 'char.role': 'Роль', 'char.appearance': 'Внешность', 'char.personality': 'Характер',
    'char.background': 'Предыстория', 'char.relations': 'Отношения', 'char.notes': 'Заметки / заделы',
    'profile.title': '👤 Профиль', 'profile.nick': 'Ник', 'profile.upload': '📷 Загрузить аватар', 'profile.clear': 'Сбросить', 'profile.pick': 'Выберите аватар',
    'dict.title': '📖 Словарь', 'dict.search': 'Искать',
    'dict.ph': 'Введите слово… (открывается с выделенным текстом)',
    'common.save': 'Сохранить', 'common.cancel': 'Отмена', 'common.close': 'Закрыть', 'common.confirm': 'OK', 'common.delete': 'Удалить', 'common.export': 'Экспорт',
    'w.title': 'Название', 'w.genre': 'Жанры', 'w.audience': 'Аудитория', 'w.length': 'Объём', 'w.pov': 'Точка зрения', 'w.tone': 'Тон', 'w.lang': 'Язык', 'w.authors': 'Авторы',
    'w.edit': '✎ Редактировать таблицу стиля', 'w.styleProfile': 'Профиль стиля', 'w.synopsis': 'СИНОПСИС', 'w.world': 'МИРОУСТРОЙСТВО', 'w.custom': 'Свои разделы', 'w.addSec': '＋ Добавить',
    'w.authorLib': 'БИБЛИОТЕКА СТИЛЕЙ', 'w.authorTip': 'Кликните автора, чтобы выбрать его эталоном; «Изучить стили онлайн» загрузит материалы из Википедии и добавит их в контекст ИИ.',
    'w.learn': '⛁ Изучить стили онлайн', 'w.learnSel': '⛁ Изучить стили онлайн ({n} выбрано)', 'w.builtin': 'Встроенные приёмы', 'w.wiki': 'Онлайн-изучение (Википедия)',
    'w.learnOk': 'Изучение завершено: {ok}/{n} успешно', 'w.learnFail': 'Не удалось изучить стили (проверьте сеть)', 'w.learnPartial': 'Изучение стилей: {ok} ок / {fail} не удалось',
    'w.myStyle': 'Мой стиль (необязательно)', 'w.styleModeAuthor': 'Стили авторов', 'w.styleModeMine': 'Мой стиль',
    'w.styleSample': 'Вставьте образец своего текста (до 500 знаков) — ИИ изучит ваш ритм, лексику и стиль диалогов.',
    'w.styleSamplePh': 'Вставьте свой текст (до 500 знаков)…',
    'w.noAuthors': 'Эталонные авторы не выбраны. Кликните автора выше или добавьте своего через поиск.',
    'stat.words': 'Иероглифы {a} · Слова {b}', 'stat.pos': 'Стр {a} · Кол {b}', 'stat.chars': 'Символов {a}', 'stat.wordsChip': 'слов',
    'dict.loading': 'Поиск…', 'dict.notfound': 'Слово не найдено. Проверьте написание.',
    'dict.errNet': 'Ошибка запроса к словарю — нужен интернет.', 'dict.syn': 'Синонимы', 'dict.src': 'Источник: dictionaryapi.dev · Datamuse · Wiktionary',
    'toast.welcome': 'Добро пожаловать в XIAOXING! Создайте роман, затем подключите модель в «⚙ ИИ-модели».',
    'toast.saved': 'Сохранено', 'toast.savedOk': 'Сохранено', 'toast.needNovel': 'Сначала создайте роман', 'toast.needNovelSel': 'Сначала выберите роман',
    'toast.noChapters': 'Глав пока нет', 'toast.txtOk': 'TXT экспортирован', 'toast.backupOk': 'Резервная копия готова',
    'toast.importFail': 'Ошибка импорта: ', 'toast.wiped': 'Все данные удалены', 'toast.chapterDel': 'Глава удалена',
    'toast.chapterFromNode': 'Глава создана из узла плана', 'toast.outlineDel': 'Узел плана удалён',
    'toast.charSaved': 'Персонаж сохранён', 'toast.memSaved': 'Сохранено', 'toast.novelSaved': 'Роман сохранён', 'toast.novelDel': 'Роман удалён',
    'toast.needTitle': 'Введите название', 'toast.needNodeTitle': 'Введите заголовок', 'toast.needContent': 'Введите содержимое', 'toast.needName': 'Введите имя',
    'toast.noAI': 'ИИ-модель не настроена', 'toast.aiBusy': 'ИИ уже генерирует…',
    'toast.needChapter': 'Сначала создайте и откройте главу', 'toast.needChapterOpen': 'Сначала откройте главу',
    'toast.nothingPolish': 'Нечего шлифовать', 'toast.inserted': 'Вставлено в главу', 'toast.memAdded': 'Сохранено записей: {n}',
    'toast.copied': 'Скопировано', 'toast.copyFail': 'Не удалось скопировать', 'toast.chatClear': 'Чат очищен',
    'toast.providerSaved': 'Модель сохранена и включена', 'toast.providerDel': 'Модель удалена', 'toast.providerFill': 'Укажите Base URL и имя модели',
    'toast.providerPick': 'Выберите модель слева или нажмите «Сохранить и включить»', 'toast.profileSaved': 'Профиль сохранён',
    'toast.avatarTooBig': 'Файл слишком большой (до 2 МБ)', 'toast.avatarBad': 'Не удалось прочитать изображение',
    'toast.dictNeedWord': 'Введите слово для поиска', 'toast.memDeleted': 'Запись памяти удалена',
    'toast.learnBusy': 'Идёт онлайн-изучение стилей, подождите…',
    'toast.langHint': 'Язык интерфейса изменён', 'toast.nickSave': 'Ник сохранён',
    'toast.titlesGen': 'Генерирую варианты названий…', 'toast.titlesEmpty': 'Не удалось сгенерировать — попробуйте ещё раз',
    'toast.titleApplied': 'Название применено', 'toast.titleNeedInput': 'Сначала заполните описание или план главы',
    'toast.planChanged': 'Бесплатно на время беты: {p}',
    'toast.storageOk': 'Хранилище разрешено — работы сохраняются на устройстве', 'toast.storageNo': 'Хранилище отклонено: данные живут только в этой сессии',
    'toast.styleSaved': 'Настройки стиля сохранены', 'toast.orCopied': 'Имя модели скопировано',
    'empty.panel': 'Нажмите название сверху,<br/>чтобы создать / выбрать роман.',
    'empty.chapters': 'Глав пока нет.<br/>Нажмите «＋ Глава»,<br/>или сначала составьте «План».',
    'empty.outline': 'Плана пока нет.<br/>Нажмите «＋ Том»,<br/>затем добавьте узлы глав.<br/><br/>ИИ использует план автоматически.',
    'empty.chars': 'Карточек персонажей нет.<br/>ИИ запомнит их автоматически<br/>и сохранит характеры.',
    'empty.mem': 'Записей памяти нет.<br/>Добавьте вручную или через «◬ Извлечь память».',
    'ai.dataNote': 'При работе с ИИ запрос и нужный контекст отправляются выбранной модели. При ручном вводе и сохранении черновики не отправляются.',
    'empty.chat': '✦ Выберите модель, чтобы попробовать ИИ.<br/>Используйте быстрые команды или задайте вопрос. Проверьте подключение в настройках модели при необходимости.',
    'empty.lib': 'В галактике тихо — романов пока нет. Нажмите «＋ Новый роман».',
    'empty.volKids': 'Узлов нет. Нажмите «＋ Узел» ниже.',
    'editor.placeholder.zh': 'Новая глава начинается здесь… (Ctrl+S — сохранить · ✦ ИИ-движок справа)',
    'editor.placeholder.en': 'A new chapter begins here… (Ctrl+S to save · ✦ AI engine on the right)',
    'editor.noChapter': 'Глава не открыта. Создайте её в панели «Главы» или выберите роман сверху.',
    'ai.inputPh': 'Обсудите сюжет, попросите запомнить детали или дайте команду… (Ctrl+Enter — отправить)',
    'ai.modelNone': 'Модель не настроена', 'ai.you': 'Вы', 'ai.engine': '✦ Движок',
    'novel.new': 'Новый роман', 'novel.edit': 'Редактировать роман',
    'confirm.delChapter': 'Удалить эту главу? Текст нельзя будет восстановить.',
    'confirm.delOutline': 'Удалить этот узел плана? Вложенные узлы тоже удалятся.',
    'confirm.delChar': 'Удалить карточку персонажа?', 'confirm.delMem': 'Удалить запись памяти?',
    'confirm.delNovel': 'Удалить «{t}» вместе с главами, планом, персонажами и памятью? Необратимо.',
    'confirm.delProvider': 'Удалить эту модель?',
    'confirm.wipe': 'Удалить ВСЕ данные? Все романы, главы, планы, персонажи и память будут стёрты навсегда!',
    'toast.importOk': 'Восстановлено в отдельных копиях', 'backup.copySuffix': 'Восстановленная копия', 'backup.invalid': 'Формат резервной копии не поддерживается.', 'backup.empty': 'В копии нет романов или статей для восстановления.', 'backup.idbOnly': 'Для восстановления нужна IndexedDB. Экспорт резервной копии доступен.', 'backup.exportFail': 'Не удалось экспортировать копию. Проверьте хранилище браузера.', 'backup.orphanChats': 'Пропущены старые чаты без связанной работы: {n}.',
    'confirm.import': 'Восстановить отдельные копии: {details}. Текущие работы сохранятся. Продолжить?',
    'dict.provOk': '✓ Подключено: ', 'dict.provFail': 'Ошибка подключения: ',
    'learn.fetching': 'Изучаю {name}…', 'learn.noSel': 'Сначала выберите авторов выше',
    'terms.title': '📜 Уведомление и правила', 'terms.noticeTitle': 'I. Уведомление',
    'terms.notice': '<ul><li><b>Локальное хранение</b>: романы, планы, персонажи и память хранятся только в браузере вашего устройства (IndexedDB). Ручное редактирование и сохранение не отправляют черновик поставщику модели. Очистка данных браузера удалит работы — делайте резервные копии.</li><li><b>ИИ</b>: доступны встроенные, облачные и локальные модели. При использовании ИИ запрос и выбранный контекст передаются поставщику модели. При включённом резервном режиме запрос может получить резервный поставщик. Ключ хранится локально и используется для соответствующего сервиса.</li><li><b>Онлайн-функции</b>: «Изучение стилей» и словарь обращаются к открытым API (Википедия, словари) только для поиска.</li><li><b>Ответственность</b>: инструмент бесплатен и предоставляется без гарантий; проверяйте сгенерированный текст.</li><li><b>Несовершеннолетним</b>: пользуйтесь под присмотром взрослых.</li></ul>',
    'terms.rulesTitle': 'II. Правила',
    'terms.rules': '<ul><li>Не создавать и не распространять противозаконный контент: порнографию, насилие, разжигание ненависти, нарушение приватности, мошенничество и т.п.</li><li>Уважать авторские права: эталонные авторы — для изучения <b>приёмов</b>, а не для плагиата.</li><li>Соблюдать условия ИИ-провайдеров и местные законы.</li><li>Не злоупотреблять онлайн-функциями и чужими API.</li><li>Не создавать клевету или дипфейки о реальных людях.</li><li>Нарушители несут полную ответственность; XIAOXING оставляет за собой право отказать в обслуживании.</li></ul>',
    'terms.version': 'Версия 2025-01 · XIAOXING',
    'terms.agreeLabel': 'Я прочитал(а) и согласен(на) со всем вышеперечисленным',
    'terms.agreeBtn': 'Согласен · Войти', 'terms.declineBtn': 'Отказаться',
    'terms.declined': 'Без согласия с правилами пользование невозможно.',
    'profile.terms': '📜 Уведомление',
    'btn.vip': '💎 VIP', 'btn.vipTitle': 'Членство (бета · бесплатно)',
    'btn.feedback': '💬 Отзыв', 'btn.feedbackTitle': 'Обратная связь',
    'co.label': '📋 План главы',
    'co.gen': '🚀 Начать писать', 'co.again': '🔄 Заново',
    'co.ph': 'Опишите план главы: что происходит, кто участвует, какие заделы заложить… затем нажмите «🚀 Начать писать»',
    'co.needChapter': 'Сначала создайте и откройте главу', 'co.needOutline': 'Сначала заполните «План главы»',
    'co.confirmOverwrite': 'В главе уже есть текст. Генерация перезапишет его. Продолжить?',
    'co.done': '✓ Готово — не понравилось? Нажмите «🔄 Заново»', 'co.cancelled': 'Генерация отменена',
    'co.running': 'Идёт генерация…',
    'co.chapterTitle': 'Название главы от ИИ (по плану главы)',
    'co.layout': 'Макет', 'co.layoutToggleTitle': 'Переключить макет: вертикально / пополам',
    'gp.title': '⚡ Онлайн-генерация',
    'gp.search': 'Поиск авторов', 'gp.style': 'Изучение стилей', 'gp.draft': 'Черновик главы', 'gp.write': 'Написание главы',
    'gp.cancelTitle': 'Отмена',
    'au.label': 'Свои авторы', 'au.ph': 'Введите имя автора — поиск и добавление онлайн…',
    'au.search': '🔍 Найти и добавить', 'au.needName': 'Введите имя автора', 'au.searching': 'Ищу в сети…',
    'au.notfound': 'Автор не найден — попробуйте другое имя', 'au.added': 'Добавлен как эталон: {name}', 'au.fail': 'Поиск не удался — проверьте сеть',
    'au.custom': 'Свой', 'au.del': 'Удалить этого автора?',
    'fb.title': '💬 Обратная связь', 'fb.label': 'Проблема или пожелание',
    'fb.ph': 'Опишите проблему или предложение…', 'fb.hint': 'Мы читаем каждый отзыв.',
    'fb.send': 'Отправить', 'fb.thanks': 'Спасибо за отзыв', 'fb.fail': 'Не удалось отправить, попробуйте позже', 'fb.needMsg': 'Сначала напишите текст',
    'vip.title': '💎 Членство', 'vip.notice': 'Единственное платное: DeepSeek ежемесячно (¥40/месяц) · остальное бесплатно во время беты',
    'vip.free': 'Бесплатный', 'vip.freePrice': '¥0 · бета', 'vip.freeBtn': 'Текущий план', 'vip.currentBtn': 'Текущий план',
    'vip.f1': 'Встроенная бесплатная ИИ-модель', 'vip.f2': 'Все функции творчества', 'vip.f3': 'Память 2 главы · локальное хранение',
    'vip.pro': 'Профессиональный', 'vip.proPrice': '¥0 · бета',
    'vip.p1': 'Лучшие модели (DeepSeek/Kimi/GLM/Qwen…)', 'vip.p2': 'Память до 5 глав', 'vip.p3': 'Быстрее генерация',
    'vip.flag': 'Флагманский', 'vip.flagPrice': '¥0 · бета',
    'vip.l1': 'Все плюсы Про + топ-модели', 'vip.l2': 'Поиск ИИ-моделей по всему миру', 'vip.l3': 'Память до 10 глав · поддержка',
    'vip.btn': 'Скоро', 'vip.btnToast': 'Во время беты бесплатно',
    'vip.foot': 'Единственное платное — DeepSeek ежемесячно (¥40/месяц); остальное бесплатно во время беты.',
    'vip.deepseek': 'DeepSeek ежемесячно', 'vip.deepseekPrice': '¥40 / месяц',
    'vip.d1': 'Стабильный доступ к DeepSeek и другим качественным моделям (отдельно от бесплатной квоты)',
    'vip.d2': 'Быстрее ответы · длиннее память (до 5 глав)',
    'vip.d3': 'Оплата помесячно · без автопродления · вы решаете каждый месяц',
    'vip.deepseekBtn': 'Подписать договор и оформить',
    'agr.title': '📄 Договор о ежемесячной подписке DeepSeek',
    'agr.agreeLabel': 'Я прочитал(а) и согласен(на) со всеми условиями выше',
    'agr.signLabel': 'Электронная подпись (введите имя пользователя)',
    'agr.signPh': 'Введите имя пользователя как электронную подпись',
    'agr.signBtn': 'Подписать и показать код оплаты',
    'agr.payNote': 'Оплатите ¥40 по личному коду ниже и следуйте шагам.',
    'agr.amount': 'Сумма: ¥40.00 (один месяц обслуживания)',
    'agr.step1': 'Отсканируйте код в WeChat / Alipay',
    'agr.step2': 'Укажите имя пользователя в примечании к платежу для сверки',
    'agr.step3': 'После оплаты нажмите «Я оплатил(а) — отправить на проверку» ниже',
    'agr.waitNote': 'Администратор проверит поступление и активирует услугу в течение 24 часов; до проверки можно в любой момент запросить полный возврат.',
    'agr.paidBtn': 'Я оплатил(а) — отправить на проверку',
    'agr.hintNeedAgree': 'Сначала отметьте «Я прочитал(а) и согласен(на)»',
    'agr.hintNeedLogin': 'Войдите в аккаунт перед подписанием',
    'agr.hintSignMismatch': 'Подпись должна совпадать с именем пользователя',
    'agr.signedOk': 'Договор подписан — завершите оплату',
    'agr.submitted': 'Отправлено! Администратор проверит оплату в течение 24 часов; до активации можно запросить возврат.',
    'agr.submitFail': 'Не удалось отправить. Повторите позже или свяжитесь с администратором через «Обратная связь».',
    'agr.pending': 'Проверяем…',
    'agr.text': '<h3>Статья 1. Услуга и цена</h3><p>1.1 Настоящий договор заключается между пользователем и сайтом XIAOXING (автор: 小柚子, «сайт») об услуге «DeepSeek ежемесячно».</p><p>1.2 Услуга даёт доступ к DeepSeek и другим качественным моделям сайта, более быстрые ответы и более длинную память (до 5 глав).</p><p>1.3 Цена: 40 юаней в месяц (30 дней).</p><h3>Статья 2. Оплата</h3><p>2.1 Оплата производится по личному коду автора.</p><p>2.2 В примечании к платежу укажите имя пользователя для сверки.</p><p>2.3 Оплата не активирует услугу мгновенно: администратор проверяет фактическое поступление. До проверки можно запросить возврат в любое время.</p><h3>Статья 3. Срок и продление</h3><p>3.1 Один месяц — 30 дней с даты фактической оплаты (по учёту).</p><p>3.2 Автопродления и автоматического списания нет: по истечении срока услуга останавливается, продление — только по вашему решению.</p><p>3.3 Продление требует повторного подписания договора и оплаты.</p><h3>Статья 4. Возвраты</h3><p>4.1 До проверки и активации можно в любой момент запросить полный возврат через «💬 Обратная связь».</p><p>4.2 После активации возврат, как правило, не производится ввиду немедленного характера услуги; при недоступности услуги 72 часа подряд по вине сайта возможен пропорциональный возврат за оставшиеся дни.</p><p>4.3 Подтверждённые возвраты отправляются по исходному каналу, обычно в течение 7 рабочих дней.</p><h3>Статья 5. Правила использования</h3><p>5.1 Льготы — только для владельца аккаунта; перепродажа, передача и аренда запрещены.</p><p>5.2 Соблюдайте «Уведомление и правила» сайта и условия ИИ-провайдеров; нельзя генерировать незаконный или нарушающий права контент.</p><p>5.3 За нарушения услуга может быть остановлена без возврата.</p><h3>Статья 6. Отказ от ответственности</h3><p>6.1 Сайт старается обеспечить качество, но результат ИИ не является профессиональной консультацией или обещанием.</p><p>6.2 Временная недоступность из-за сторонних провайдеров, сети или форс-мажора не компенсируется; сайт приложит усилия для восстановления.</p><p>6.3 Сайт может менять цены или состав услуг с предварительным уведомлением; оплаченные периоды не затрагиваются.</p><h3>Статья 7. Персональные данные</h3><p>7.1 Сайт собирает только необходимое для активации и сверки (имя пользователя, записи об оплате).</p><p>7.2 Данные платежа обрабатывает платёжная платформа; сайт не имеет доступа к банковским реквизитам.</p><h3>Статья 8. Споры</h3><p>8.1 Договор регулируется законодательством КНР.</p><p>8.2 Споры решаются переговорами; при недостижении согласия — в компетентном суде по месту оператора сайта.</p>',
    'vip.searchTitle': '🔍 Поиск ИИ-моделей по всему миру', 'vip.searchPh': 'Ключевое слово (deepseek / qwen / llama…)',
    'vip.searchBtn': 'Искать', 'vip.searching': 'Ищу модели…', 'vip.searchFail': 'Поиск не удался — попробуйте позже',
    'vip.searchEmpty': 'Модели не найдены', 'vip.copy': 'Копировать ID', 'vip.copied': 'ID скопирован',
    'vip.trialOn': '🎁 Подарок новичку: бесплатный пробный период высшего уровня (включая DeepSeek), осталось {t} (покупка не требуется)',
    'vip.trialEnd': 'Пробный период Про завершён — спасибо! Выберите план в центре членства (во время беты бесплатно).',
    'btn.settings': '⚙ Настройки', 'btn.settingsTitle': 'Настройки',
    'set.title': '⚙ Настройки', 'set.ui': 'Интерфейс', 'set.font': 'Размер шрифта', 'set.layout': 'Макет',
    'set.stack': 'Компактный план · весь текст', 'set.split': 'План пополам · текст пополам',
    'set.aipanel': 'Панель ИИ-движка', 'set.on': 'Вкл', 'set.off': 'Выкл', 'set.accent': 'Акцент',
    'set.account': 'Аккаунт', 'set.editProfile': 'Аватар и ник',
    'set.lang': 'Язык',
    'set.general': 'Общее', 'set.backup': '⛁ Резерв и экспорт', 'set.ai': '⚙ ИИ-модели',
    'set.feedback': '💬 Обратная связь', 'set.terms': '📜 Уведомление',
    'set.storage': '💾 Хранилище', 'set.storageState': 'Статус хранилища',
    'set.storageOk': 'Разрешено (автосохранение на устройстве)', 'set.storageNo': 'Запрещено (ничего не сохраняется)',
    'set.bg': 'Фон', 'set.pet': 'Питомец-помощник',
    'set.about': 'О версии', 'set.version': 'Текущая версия', 'set.check': 'Проверить обновления',
    'set.upToDate': 'У вас последняя версия ({v})', 'set.updateFound': 'Доступна версия {v} — нажмите Ctrl+F5',
    'set.updateFail': 'Проверка не удалась — проверьте сеть',
    'set.trialBadge': ' · 🎁 Пробный период',
    'set.creator': 'Автор: 小柚子 (Сяо Юцзы)', 'set.creatorNote': 'Сайт разработан одним человеком · обновления нерегулярны',
    'set.tip': '☕ Поддержать автора',
    'sp.pickTip': 'Кликните автора, чтобы выбрать его эталоном (повторный клик — отмена). «Изучить стили онлайн» загрузит материалы из Википедии. Не нашли любимого автора? Добавьте через поиск.',
    'sp.mineTip': 'Вставьте образец своего текста (до 500 знаков): ИИ изучит ваш ритм, лексику и стиль диалогов — результат будет похож на ваш.',
    'sp.filterPh': 'Фильтр авторов…',
    'board.novel': '📖 Роман', 'board.paper': '📄 Статья',
    'p.list': 'Мои статьи', 'p.new': 'Новая статья', 'p.empty': 'Статей пока нет.<br/>Нажмите «＋ Новая статья», заполните тему, затем «📚 Поиск и генерация».',
    'p.topicLabel': '📄 Тема / требования',
    "p.topicPh": "Укажите исследовательский вопрос, материалы и требования. Для поиска используются короткие ключевые слова.",
    'p.editorPh': 'Введите текст или создайте черновик. Ставьте ссылки [1][2] и сверяйтесь с оригиналами перед сдачей.',
    'p.gen': '📚 Поиск и генерация', 'p.again': '🔄 Заново',
    'p.needTopic': 'Сначала введите тему', 'p.needOpen': 'Сначала создайте и откройте статью',
    'p.overwrite': 'В статье уже есть текст. Перезаписать?',
    'p.done': '✓ Статья готова — не понравилось? «🔄 Заново»',
    "p.freeNote": "Поиск даёт возможные источники. Пишите сами или используйте черновик ИИ; затем проверьте оригиналы, ссылки и страницы.",
    'p.upgrade': '💎 Улучшить текст',
    'gp.psearch': 'Поиск источников', 'gp.refsFound': 'Найдено источников: {n}', 'gp.pdraft': 'Черновик структуры', 'gp.pwrite': 'Написание статьи',
    'gp.check': '⚖ Проверка качества', 'gp.rewrite': 'Найдены проблемы — переписываю', 'gp.pass': 'Проверка пройдена · качество подтверждено',
    'gp.failCheck': 'ИИ-самопроверка не пройдена: после нескольких переписываний качество не достигнуто, текст не выведен. Скорректируйте тему/план и повторите.',
    'gp.forceOutput': 'Самопроверка не полностью пройдена: после двух переписываний текст выводится напрямую — проверьте и отредактируйте.',
    'gp.forceNote': 'Два переписывания завершены · вывод текста',
    'sp.scrollHint': 'Прокрутите или нажмите кнопки, чтобы увидеть всех авторов',
    "p.guide": "План работы",
    "p.guideTitle": "План написания статьи",
    "p.guideStart": "Выберите шаблон",
    "p.step1": "Сформулируйте один исследовательский вопрос и определите период, территорию, группу или материалы.",
    "p.step2": "Прочитайте первоисточники, запишите доказательства и страницы. Результаты поиска сами по себе не подтверждают выводы.",
    "p.step3": "Напишите текст сами или создайте черновик. Перед сдачей проверьте каждую ссылку [n], оригинал и правила оформления.",
    "p.tplReview": "Обзор литературы",
    "p.tplCompare": "Сравнительный анализ",
    "p.tplEmpirical": "Эмпирическое исследование",
    "p.tplReviewBody": "Исследовательский вопрос:\nКлючевые слова:\nПериод и дисциплины:\nКритерии включения и исключения:\nПодходы для сравнения:",
    "p.tplCompareBody": "Исследовательский вопрос:\nКлючевые слова:\nОбъекты и период:\nОбщие критерии сравнения:\nПланируемые источники:",
    "p.tplEmpiricalBody": "Исследовательский вопрос:\nКлючевые слова:\nСовокупность и выборка:\nДанные и методы:\nОграничения и возможные смещения:",
    "p.guideBlank": "Шаблон заполняет только пустое поле темы. Черновик не меняется.",
    "p.guideFilled": "В поле темы уже есть текст. Продолжайте работу по шагам выше.",
    "p.guideNeedPaper": "Сначала создайте или откройте статью.",
    "p.audit": "Проверить ссылки в тексте",
    "p.auditScope": "Проверяются только номера [n] и формат URL. Проверка не подтверждает подлинность, релевантность или содержание источников.",
    "p.auditEmpty": "Черновик пуст.",
    "p.auditTally": "В тексте {n} различных номеров; в списке литературы {m} записей с номерами.",
    "p.auditNoRefs": "Нумерованные ссылки и записи не найдены.",
    "p.auditMissing": "Нет записей для ссылок: {n}",
    "p.auditUncited": "Нет ссылки в тексте на записи: {n}",
    "p.auditDuplicate": "Повторяющиеся номера: {n}",
    "p.auditNoLink": "Нет корректного URL: {n}",
    "p.auditMalformed": "Пишите номера раздельно, например [1][2].",
    "p.auditPass": "Номера и формат ссылок согласованы. Всё равно проверьте оригиналы.",
    "p.topicRequired": "Сначала заполните исследовательский вопрос. Можно добавить краткие ключевые слова.",
    "p.refsInvalid": "В черновике есть ссылки без источника или недопустимые URL. Исходный текст сохранён.",
    'p.langTitle': 'Язык статьи',
    'set.credits': 'Разработчик',
    'upd.title': '🎉 Обновление готово', 'upd.whatsNew': 'Что нового', 'upd.done': 'Понятно',
    'top.noNovel': 'Роман не выбран', 'top.novelSwitch': 'Переключение / управление романами',
    'w.secTitlePh': 'Название записи (система сил / фракции / хронология)', 'w.secBodyPh': 'Раскройте сеттинг…',
    'w.synopsisPh': 'Главная линия, повороты, финал…', 'w.worldPh': 'Эпоха, география, правила, системы сил…',
    'w.customEmpty': 'Добавьте записи: системы сил, фракции, хронологии…',
    'char.unnamed': 'Без имени', 'char.noIntro': 'Пока нет описания',
    'p.extractOnly': 'Извлечение памяти — только в разделе романов', 'p.styleOnly': 'Проверка стиля — только в разделе романов',
    'p.titlePh': 'Название статьи (можно позже, ИИ подскажет)…', 'p.statusTitle': 'Статус статьи',
    'lib.editTitle': 'Редактировать', 'lib.delTitle': 'Удалить роман',
    'ed.chapterTitlePh': 'Название главы (можно позже, ИИ подскажет)…', 'ed.chapterStatus': 'Статус главы',
    'ed.editorPh': 'Новая глава начинается здесь… (Ctrl+S — сохранить · ✦ ИИ-движок справа)',
    'btn.focusTitle': 'Режим фокуса (скрыть панели)', 'btn.aiToggleTitle': 'ИИ-движок сюжета',
    'co.againTitle': 'Не понравилось? Заново',
    'ai.configTitle': 'Настройки ИИ', 'ai.closeTitle': 'Свернуть панель',
    'novel.descPh': 'Завязка, главный конфликт, тон…',
    'aColor.cyan': 'Голубой', 'aColor.magenta': 'Пурпурный', 'aColor.green': 'Зелёный', 'aColor.gold': 'Янтарный',
    'aiset.namePh': 'Например: Локальный Qwen', 'aiset.pathPh': '/chat/completions (для Pollinations — /openai)', 'aiset.keyPh': 'Для облачных моделей обязательно; для локальных — пусто',
    'note.titlePh': 'Название узла / тома', 'note.contentPh': 'Сюжетные точки, заделы, память одной строкой…',
    'char.namePh': 'Имя персонажа', 'char.rolePh': 'Герой / злодей / капитан корабля…', 'char.appearancePh': 'Внешность…',
    'char.personalityPh': 'Характер, манера речи…', 'char.backgroundPh': 'Происхождение, мотивы, развитие…',
    'char.relationsPh': 'Отношения с другими персонажами…', 'char.notesPh': 'Заделы и планы на будущее…',
    'profile.nickPh': 'Ваш псевдоним…',
    'editor.placeholder.ru': 'Новая глава начинается здесь… (Ctrl+S — сохранить · ✦ ИИ-движок справа)',
    'toast.paperSaved': 'Статья сохранена', 'toast.paperDeleted': 'Статья удалена',
    'auth.title': '👤 Вход / Регистрация', 'auth.login': 'Вход', 'auth.register': 'Регистрация',
    'auth.user': 'Имя пользователя', 'auth.userPh': '2-20 знаков: буквы / цифры / _ / китайские',
    'auth.pass': 'Пароль', 'auth.passPh': 'Минимум 6 знаков, обязательно буквы И цифры',
    'auth.pass2': 'Подтвердите пароль', 'auth.pass2Ph': 'Введите пароль ещё раз',
    'auth.email': 'Эл. почта (обязательна для подтверждения личности)', 'auth.emailPh': 'name@example.com',
    'auth.errEmail': 'Введите корректный адрес эл. почты', 'auth.emailTaken': 'Эта почта уже зарегистрирована',
    'msg.title': '📩 Сообщения', 'msg.empty': 'Сообщений пока нет', 'msg.readAll': 'Прочитать всё',
    'msg.fromAdmin': 'От: администратор', 'msg.copy': 'Копировать', 'msg.sent': 'Сообщение доставлено',
    'msg.sendToCreator': '✉️ Написать автору', 'msg.sendToCreatorPh': 'Сообщение, вопрос или отзыв автору (小柚子)…',
    'msg.sendCreator': 'Отправить', 'msg.sentCreator': 'Отправлено автору — следите за входящими', 'msg.fail': 'Не удалось отправить. Повторите.',
    'admin.creatorMsgs': '📬 Сообщения автору', 'admin.reply': 'Ответить',
    'im.openTitle': 'Погружение: пишите роман как чат персонажей', 'im.open': 'Погружение',
    'im.finish': 'Завершить главу', 'im.inputPh': 'Введите реплику персонажа…', 'im.send': 'Отправить',
    'im.narrator': 'Рассказчик', 'im.hint': 'Выберите персонажа и пишите, как в чате. Нажмите «Завершить главу» — ИИ превратит диалог в текст с повествованием.',
    'im.needNovel': 'Сначала создайте роман', 'im.needChapter': 'Сначала создайте главу', 'im.untitled': 'Без названия',
    'im.empty': 'Диалогов пока нет — отправьте несколько сообщений', 'im.confirm': 'ИИ превратит этот диалог в прозу (с повествованием) и добавит в конец главы. Завершить главу?',
    'im.generating': 'ИИ соединяет диалог и повествование…', 'im.done': 'Готово: диалог стал прозой, сюжет движется дальше!',
    'im.fail': 'Ошибка генерации: ',
    'im.system': 'Ты — писатель. Перепиши черновик диалога ниже в прозу: добавь повествование, действия и мысли, свяжи с предыдущим текстом и продвинь сюжет; сохрани характеры и стиль. Выводи только прозу, без пояснений.\n【Роман】{title}\n【Жанр】{genre}\n【Стиль】{style}\n{chars}\n【Конец предыдущего текста】{tail}\n【Черновик диалога】\n{transcript}',
    'admin.pendingTitle': '⏳ Ожидают проверки', 'admin.pendingEmpty': 'Нет ожидающих платежей',
    'admin.resolve': '✓ Проверить и активировать', 'admin.paymentsTitle': '💰 Последние поступления',
    'admin.msg': '✉ Сообщение', 'admin.msgTarget': 'Сообщение для:',
    'admin.msgPh': 'Текст сообщения (например, API-ключ)…', 'admin.msgSend': 'Отправить',
    'admin.msgSent': 'Сообщение доставлено пользователю',
    'set.emailLabel': 'Эл. почта (для подтверждения личности)', 'set.emailSave': 'Сохранить', 'set.emailSaved': 'Почта сохранена',
    'auth.forgot': 'Забыли пароль?', 'auth.forgotTitle': 'Восстановление пароля',
    'auth.q0': 'Без контрольного вопроса', 'auth.q1': 'Ваша любимая книга?', 'auth.q2': 'Ваше детское прозвище?',
    'auth.q3': 'Фамилия первого учителя?', 'auth.q4': 'Ваш любимый город?',
    'auth.answer': 'Ответ на вопрос', 'auth.answerPh': '2-64 символа (запомните!)',
    'auth.newPass': 'Новый пароль', 'auth.backLogin': 'Вернуться ко входу', 'auth.resetPassword': 'Сбросить пароль',
    'auth.blockedMsg': 'Аккаунт заблокирован. Свяжитесь с администратором.',
    'auth.adminBadge': 'Админ',
    'online.label': 'онлайн',
    'set.adminBg': '👑 Фон администратора', 'set.adminBgOn': 'Красные фары', 'set.adminBgOff': 'Обычный фон',
    'admin.open': '👑 Вход администратора', 'admin.openTitle': 'Вход администратора (пользователи, платежи и сообщения прямо на сайте)',
    'admin.title': '👑 Панель администратора',
    'admin.total': 'Регистраций', 'admin.online': 'Онлайн', 'admin.payers': 'Плательщики', 'admin.net': 'Чистый (CNY)',
    'admin.searchPh': 'Поиск пользователей…', 'admin.refresh': 'Обновить', 'admin.fullConsole': 'Полная панель ↗',
    'admin.blocked': 'Заблокирован', 'admin.block': 'Заблокировать', 'admin.unblock': 'Разблокировать',
    'admin.wl': 'В белый список', 'admin.unwl': 'Убрать',
    'admin.protected': 'Аккаунты администраторов защищены', 'admin.required': 'Нужен авторизованный администратор',
    'admin.loadFail': 'Не удалось загрузить данные панели. Проверьте сеть.', 'admin.opFail': 'Не удалось выполнить действие. Повторите.',
    'admin.blockedOk': 'Пользователь заблокирован и вышел из системы', 'admin.unblocked': 'Пользователь разблокирован',
    'admin.needServer': 'Полные функции управления требуют сервер (node server.mjs). Откройте полную панель или обратитесь к оператору.',
    'admin.receiptTitle': '🧾 Регистрация поступления/возврата (после проверки перевода)',
    'admin.receiptKind': 'Тип', 'admin.receiptPayment': 'Поступление', 'admin.receiptRefund': 'Возврат',
    'admin.receiptAmount': 'Сумма (юани)', 'admin.receiptRef': 'Номер операции', 'admin.receiptTime': 'Время (необязательно, по умолчанию сейчас)',
    'admin.receiptNote': 'Заметка (необязательно)', 'admin.receiptSubmit': 'Записать',
    'admin.receiptOk': 'Записано; поступление 40 юаней автоматически открывает 30 дней DeepSeek',
    'admin.funcNote': 'Функции панели: ① статистика ② ожидающие платежи (активация в один клик) ③ история поступлений ④ регистрация поступлений/возвратов ⑤ список пользователей (поиск / блок / белый список / сообщение / почта) ⑥ сообщения ⑦ полная панель',
    'auth.noQuestion': 'Контрольный вопрос не задан — самостоятельное восстановление недоступно. Обратитесь к администратору.',
    'auth.badAnswer': 'Неверный ответ', 'auth.resetOk': 'Пароль сброшен — войдите с новым паролем',
    'auth.submitLogin': 'Войти', 'auth.submitRegister': 'Зарегистрироваться и начать',
    'auth.errUser': 'Имя: 2-20 знаков (буквы / цифры / _ / китайские)',
    'auth.errPass': 'Пароль: 6-20 знаков, обязательно буквы и цифры',
    'auth.errPass2': 'Пароли не совпадают',
    'auth.errLogin': 'Неверное имя или пароль', 'auth.errExists': 'Такое имя уже занято — войдите',
    'auth.anyDevice': 'Режим без сервера: одни и те же имя и пароль работают на любом устройстве; данные переносите через «Полный бэкап между устройствами».',
    'history.btnTitle': 'Просмотр и восстановление всех сохранённых версий', 'history.hint': 'Снимки сохраняются автоматически: нажмите «🕘 История» на панели, чтобы посмотреть и восстановить версии',
    'share.title': '📤 Поделиться Сяосин с друзьями', 'share.slogan': 'Бесплатные романы и работы с ИИ и погружением в чат персонажей — рекомендую!',
    'share.api': '📲 Поделиться (системно)', 'share.copyLink': 'Копировать ссылку', 'share.copyText': 'Копировать текст + ссылку',
    'share.qrNote': 'Отсканируйте, чтобы открыть', 'share.copied': 'Скопировано — делитесь!',
    'auth.adoptToast': 'Профиль создан на этом устройстве (те же имя и пароль = та же личность; данные — через «Полный бэкап»).',
    'auth.okRegister': 'Готово! Вы вошли — бесплатный пробный период высшего уровня (включая DeepSeek) активирован',
    'auth.welcome': 'С возвращением, {u}',
    'auth.trialBanner': '🎁 Новым аккаунтам — 1 день бесплатного пробного периода высшего уровня (включая DeepSeek · без обязательств)',
    'auth.account': 'Аккаунт', 'auth.logout': 'Выйти',
    'auth.confirmLogout': 'Выйти из аккаунта? Ваши работы останутся на этом устройстве.', 'auth.loggedOut': 'Вы вышли',
    'quick.title': 'Быстрый старт',
    'quick.heading': 'Напишите первый абзац.',
    'quick.intro': 'Программировать не нужно. Пишите сами или выберите модель ИИ для помощи.',
    'quick.novel': 'Начать роман',
    'quick.novelHint': 'Создайте роман и откройте первую главу. Напишите текст или составьте план.',
    'quick.paper': 'Начать статью',
    'quick.paperHint': 'Создайте статью, введите тему исследования и выберите язык текста.',
    'quick.model': 'Выбрать модель ИИ',
    'quick.modelHint': 'Выберите сохранённую модель или подключите своего поставщика по шаблону.',
    'quick.backup': 'Сохранить и восстановить',
    'quick.backupHint': 'Скачайте текст или резервную копию работ. Здесь же можно восстановить копию.',
    'quick.tip': 'Работы хранятся в этом браузере. Перед сменой браузера или устройства скачайте резервную копию.',
    'quick.guest': 'Писать без аккаунта',
    'quick.guestNote': 'Регистрация необязательна. Если разрешить сохранение, работы останутся в этом браузере.',
    'quick.localAccount': 'Локальная работа без входа',
    'asst.title': '🛸 Помощник', 'asst.petTitle': 'Кликните меня — открою помощника', 'asst.hide': '🙈 Скрыть питомца',
    'asst.a1': '＋ Новый роман', 'asst.a2': '🚀 Начать писать', 'asst.a3': '✨ Названия', 'asst.a4': '⚙ Настройки', 'asst.a5': '💬 Отзыв',
    'asst.guide': '<h3>🚀 Три шага до первой главы</h3><ul><li><b>Шаг 1 · Роман</b>: «＋ Новый роман» и таблица стиля. Название можно оставить пустым.</li><li><b>Шаг 2 · План</b>: откройте главу и опишите, что произойдёт, в «📋 План главы».</li><li><b>Шаг 3 · Пишем</b>: «🚀 Начать писать» — ИИ изучит стили онлайн, составит черновик и напишет текст. Не понравилось — «🔄 Заново».</li></ul><h3>💡 Частые вопросы</h3><ul><li><b>Где текст?</b> В большом поле под планом; сохраняется автоматически.</li><li><b>План и текст рядом?</b> Кнопка «⇋» на панели плана или «⚙ Настройки → Макет».</li><li><b>ИИ пишет не как вы?</b> Вкладка «🖊 Стиль»: авторы или свой текст 500 знаков.</li><li><b>Шрифт, фон, тема?</b> «⚙ Настройки» — есть Солнечная система, Галактика, Планета.</li><li><b>Боитесь потерять данные?</b> «⚙ Настройки → Резерв и экспорт».</li><li><b>Остались вопросы?</b> «⚙ Настройки → Обратная связь».</li></ul>',
    'storage.title': '💾 Разрешение на хранение',
    'storage.desc': '<p>XIAOXING сохраняет ваши <b>романы, планы, персонажей и память</b> в <b>хранилище браузера на вашем устройстве</b> (IndexedDB) для автосохранения. Это разрешение относится только к локальному сохранению; работа с ИИ через интернет запускается отдельно.</p><p>Согласитесь — работы сохраняются. Откажетесь — <b>ничего не сохранится</b> и может пропасть при закрытии страницы.</p>',
    'storage.allow': 'Разрешить и сохранять', 'storage.deny': 'Отказаться',
    'storage.warn': '⚠ Хранилище не разрешено: работы НЕ сохраняются. Разрешите в «⚙ Настройки → Хранилище».',
    'tip.title': '☕ Поддержать автора',
    'tip.note': 'Сайт создан одним человеком — 小柚子 (Сяо Юцзы) — и обновляется нерегулярно. Поддержка полностью добровольная, без обязательств.',
    'tip.amount': 'Сумма поддержки',
    'tip.customPh': 'Своя сумма (юани)…',
    'tip.msg': 'Слова для автора (необязательно)',
    'tip.msgPh': 'Пожелания, идеи, слова поддержки…',
    'tip.send': '💛 Отправить поддержку',
    'tip.thanks': 'Спасибо за поддержку! 小柚子 получил(а) ваше сообщение 💛',
    'tip.fail': 'Не удалось отправить, попробуйте позже', 'tip.needAmount': 'Выберите или введите сумму'
  }
};

/* Model setup copy */
Object.assign(I18N.zh, {
  "model.active": "当前模型",
  "model.useDefault": "使用内置模型",
  "model.testActive": "测试当前模型",
  "model.intro": "内置模型无需填密钥；也可接入自己账户里的模型，或连接本机已运行的模型。内置服务可能限流。",
  "model.addCloud": "接入其他模型",
  "model.addLocal": "连接本机模型",
  "model.keyPh": "仅在服务商要求时填写",
  "model.testPrivacy": "测试只给所填地址发送一句固定问候，不附带论文或小说。使用在线模型写作时，填写的密钥和所选写作上下文会发给该服务商。",
  "model.advanced": "高级设置（地址、模型名、生成参数）",
  "model.builtinName": "Pollinations 内置模型",
  "model.unnamed": "未命名模型",
  "model.none": "未选择模型",
  "model.noneHint": "可以先用内置模型，也可以添加自己的模型。",
  "model.badAddress": "请填写有效的 HTTP(S) 接口地址。将查询参数放在接口路径里；地址不要包含密码或片段。",
  "model.activeTag": "使用中",
  "model.use": "使用",
  "model.edit": "编辑",
  "model.editNamed": "编辑模型：{name}",
  "model.switched": "已选择：{name}",
  "model.editGuide": "修改后点「保存并启用」。只想检查连接，可以先点「测试连接」。",
  "model.localGuide": "先启动本机服务，在高级设置里填实际已安装的模型名。若本机服务没有启用认证，密钥留空。",
  "model.cloudGuide": "先从下拉框选择服务商，填它提供的 API Key。自定义地址或模型名在高级设置里填写。",
  "model.presetGuide": "已填入默认地址和模型名。服务商要求时填 API Key；模型名可在高级设置中修改。",
  "model.customGuide": "在高级设置中填入服务商给出的 API 地址和实际模型名。",
  "model.missing": "还需要填写 API 地址和模型名称。",
  "model.newHostKey": "地址已换到其他服务，已清空旧密钥。请在确认新地址后再填写对应密钥。",
  "model.testing": "正在测试 {host}…",
  "model.timeout": "测试超时。请确认模型服务已经启动，或检查网络后重试。",
  "model.connected": "{name} 返回了有效答复。现在可以保存并使用。",
  "model.auth": "认证失败（HTTP {status}）。检查密钥、账户权限和服务商是否一致。",
  "model.credit": "服务商拒绝了请求（HTTP {status}）。请检查余额或额度。",
  "model.notFound": "没有找到接口或模型（HTTP {status}）。请核对路径和模型名。",
  "model.rate": "服务商限流（HTTP {status}）。稍后重试，或检查账户额度。",
  "model.upstream": "模型服务暂时失败（HTTP {status}）。稍后重试或切换模型。",
  "model.request": "服务商拒绝了测试（HTTP {status}）。请检查 API 地址、模型名和接口兼容性。",
  "model.network": "无法连通。检查服务是否启动、网址是否正确，以及服务商是否允许此网页跨域访问。",
  "model.badResponse": "服务返回了数据，但没有提供 OpenAI 兼容的文字答复。请核对接口路径和模型类型。",
  "model.cancelled": "测试已取消。"
});
Object.assign(I18N.en, {
  "model.active": "Current model",
  "model.useDefault": "Use built-in model",
  "model.testActive": "Test current model",
  "model.intro": "The built-in model needs no key and may be rate-limited. You can also connect a model from your own provider account or one running on your device.",
  "model.addCloud": "Connect another model",
  "model.addLocal": "Connect a local model",
  "model.keyPh": "Only if your provider requires a key",
  "model.testPrivacy": "The test sends a fixed greeting to this endpoint, with no novel or paper content. When you write with an online model, the key and selected writing context go to that provider.",
  "model.advanced": "Advanced settings (endpoint, model name, generation options)",
  "model.builtinName": "Built-in Pollinations model",
  "model.unnamed": "Unnamed model",
  "model.none": "No model selected",
  "model.noneHint": "Use the built-in model or add your own.",
  "model.badAddress": "Enter a valid HTTP(S) API address. Put any query parameters in the endpoint path; do not include credentials or fragments.",
  "model.activeTag": "Active",
  "model.use": "Use",
  "model.edit": "Edit",
  "model.editNamed": "Edit model: {name}",
  "model.switched": "Selected: {name}",
  "model.editGuide": "Save & enable your changes when ready. You can test the connection first.",
  "model.localGuide": "Start your local model server first. Set the name of a model it has installed under Advanced. Leave the key empty if your local service does not require one.",
  "model.cloudGuide": "Choose a provider from the list and enter its API key. Open Advanced to enter a custom address or model name.",
  "model.presetGuide": "The default address and model are filled in. Enter an API key if required, or open Advanced to change the model.",
  "model.customGuide": "Open Advanced and enter your provider's API address and actual model name.",
  "model.missing": "An API address and model name are required.",
  "model.newHostKey": "You changed providers. The old key was cleared; confirm the new address before entering its key.",
  "model.testing": "Testing {host}…",
  "model.timeout": "The test timed out. Check whether the model server is running and try again.",
  "model.connected": "{name} returned a valid reply. You can save and use this model.",
  "model.auth": "Authentication failed (HTTP {status}). Check that the key, permissions and provider match.",
  "model.credit": "The provider rejected the request (HTTP {status}). Check your balance or quota.",
  "model.notFound": "Endpoint or model not found (HTTP {status}). Check the path and model name.",
  "model.rate": "The provider is rate-limiting requests (HTTP {status}). Try later or check your quota.",
  "model.upstream": "The model service is temporarily unavailable (HTTP {status}). Try again or switch models.",
  "model.request": "The provider rejected the test (HTTP {status}). Check the API address, model name and API compatibility.",
  "model.network": "Unable to connect. Check the server, address, and whether the service allows cross-origin requests from this site.",
  "model.badResponse": "The service responded, but did not return an OpenAI-compatible text reply. Check the API path and model type.",
  "model.cancelled": "Test cancelled."
});
Object.assign(I18N.ru, {
  "model.active": "Текущая модель",
  "model.useDefault": "Выбрать встроенную модель",
  "model.testActive": "Проверить текущую модель",
  "model.intro": "Для встроенной модели ключ не нужен; возможны ограничения частоты запросов. Можно подключить модель другого сервиса или модель на своём устройстве.",
  "model.addCloud": "Подключить другую модель",
  "model.addLocal": "Подключить локальную модель",
  "model.keyPh": "Только если сервис требует ключ",
  "model.testPrivacy": "При проверке на указанный адрес отправляется только короткое приветствие, без текста романа или статьи. При работе с облачной моделью выбранный контекст и ключ получает этот сервис.",
  "model.advanced": "Дополнительные настройки: адрес, модель и параметры генерации",
  "model.builtinName": "Встроенная модель Pollinations",
  "model.unnamed": "Модель без названия",
  "model.none": "Модель не выбрана",
  "model.noneHint": "Выберите встроенную модель или добавьте свою.",
  "model.badAddress": "Укажите корректный HTTP(S)-адрес API. Параметры запроса добавьте к пути; не включайте учётные данные или фрагмент.",
  "model.activeTag": "Активна",
  "model.use": "Выбрать",
  "model.edit": "Изменить",
  "model.editNamed": "Изменить модель: {name}",
  "model.switched": "Выбрано: {name}",
  "model.editGuide": "Сохраните и включите модель или сначала проверьте подключение.",
  "model.localGuide": "Сначала запустите локальный сервер. В дополнительных настройках укажите имя установленной модели. Если ключ не требуется, оставьте поле пустым.",
  "model.cloudGuide": "Выберите сервис из списка и введите его ключ API. Свой адрес и имя модели можно задать в дополнительных настройках.",
  "model.presetGuide": "Адрес и модель заполнены. Введите ключ, если он нужен; имя модели можно изменить в дополнительных настройках.",
  "model.customGuide": "В дополнительных настройках укажите адрес API и имя модели вашего сервиса.",
  "model.missing": "Укажите адрес API и имя модели.",
  "model.newHostKey": "Адрес сервиса изменился, старый ключ удалён из формы. Проверьте новый адрес и введите подходящий ключ.",
  "model.testing": "Проверка {host}…",
  "model.timeout": "Время проверки истекло. Проверьте, запущен ли сервер модели, и повторите попытку.",
  "model.connected": "Модель {name} вернула корректный ответ. Её можно сохранить и использовать.",
  "model.auth": "Ошибка авторизации (HTTP {status}). Проверьте ключ, права доступа и адрес сервиса.",
  "model.credit": "Сервис отклонил запрос (HTTP {status}). Проверьте баланс или лимит.",
  "model.notFound": "Интерфейс или модель не найдены (HTTP {status}). Проверьте путь API и имя модели.",
  "model.rate": "Слишком много запросов (HTTP {status}). Попробуйте позже или проверьте лимит.",
  "model.upstream": "Сервис модели временно недоступен (HTTP {status}). Попробуйте позже или переключите модель.",
  "model.request": "Сервис отклонил проверку (HTTP {status}). Проверьте адрес API, имя модели и совместимость интерфейса.",
  "model.network": "Нет подключения. Проверьте запуск сервера, адрес и разрешены ли запросы с этого сайта.",
  "model.badResponse": "Сервис ответил, но не вернул текст в формате OpenAI API. Проверьте путь и тип модели.",
  "model.cancelled": "Проверка отменена."
});

const OUTPUT_LANGS = Object.freeze({ zh: '中文', en: 'English', ru: 'Русский' });
function normalizeOutputLang(value, fallback = 'zh') {
  return Object.hasOwn(OUTPUT_LANGS, value) ? value : Object.hasOwn(OUTPUT_LANGS, fallback) ? fallback : 'zh';
}
function outputLanguageRule(lang) {
  return 'Output language: ' + OUTPUT_LANGS[normalizeOutputLang(lang)] +
    '. Use this language for generated prose and explanations. Preserve requested machine-readable keys, structure, proper names, quotations, and citation titles.';
}
function t(k, vars) {
  const dict = I18N[state.settings.lang] || I18N.zh;
  let s = dict[k] !== undefined ? dict[k] : (I18N.zh[k] !== undefined ? I18N.zh[k] : k);
  if (vars) for (const key of Object.keys(vars)) s = s.split('{' + key + '}').join(vars[key]);
  return s;
}
function applyI18n() {
  document.documentElement.lang = ({zh: 'zh-CN', en: 'en', ru: 'ru'})[normalizeOutputLang(state.settings.lang)];
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  $$('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  $('#ai-input').placeholder = t('ai.inputPh');
  $('#btn-mobile-assistant').setAttribute('aria-label', t('asst.title'));
  $('#btn-mobile-panel-close').setAttribute('aria-label', t('common.close'));
  $('#btn-quick-start').setAttribute('aria-label', t('quick.title'));
  renderAuthModeCopy();
  applyHistoryLabels();
  applyCoachLabels();
  applyManuscriptLabels();
  applyInstallLabels();
  applyDocxLabels();
  syncMobileWritingKeys();
  if (typeof DraftReview !== 'undefined') DraftReview.refresh();
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
  { id: 'tolkien', name: '托尔金', wiki: 'J·R·R·托尔金', tips: '世界观建构登峰造极；史诗感、语言美感与神话体系。' },
  { id: 'tolstoy', name: '列夫·托尔斯泰', wiki: '列夫·托尔斯泰', tips: '史诗格局与心灵史并重；群像宏伟、细节真实，道德追问与人物弧光深长。' },
  { id: 'dostoevsky', name: '陀思妥耶夫斯基', wiki: '费奥多尔·陀思妥耶夫斯基', tips: '心理剖析极深；对话充满思想交锋，罪与罚式的人性拷问，戏剧张力强。' },
  { id: 'chekhov', name: '契诃夫', wiki: '安东·契诃夫', tips: '克制含蓄，短篇结构精巧；细节见深意，悲喜交织，结尾留白悠长。' },
  { id: 'pushkin', name: '普希金', wiki: '亚历山大·普希金', tips: '语言简练优美，叙事诗气质；开创现代俄语文学先河。' },
  { id: 'marktwain', name: '马克·吐温', wiki: '马克·吐温', tips: '美式幽默与讽刺；口语化叙事生动，冒险故事节奏明快。' },
  { id: 'fitzgerald', name: '菲茨杰拉德', wiki: '弗朗西斯·斯科特·菲茨杰拉德', tips: '爵士时代浮华与幻灭；抒情笔调，意象华丽，悲剧氛围。' },
  { id: 'faulkner', name: '福克纳', wiki: '威廉·福克纳', tips: '意识流与多视角叙事；南方哥特氛围，句式绵长富有张力。' },
  { id: 'poe', name: '爱伦·坡', wiki: '爱伦·坡', tips: '哥特恐怖与侦探推理鼻祖；氛围渲染极致，节奏与音韵考究。' },
  { id: 'lovecraft', name: '洛夫克拉夫特', wiki: '霍华德·菲利普斯·洛夫克拉夫特', tips: '宇宙恐怖：不可名状的恐惧、克苏鲁神话体系、层层递进的绝望氛围。' },
  { id: 'bradbury', name: '雷·布拉德伯里', wiki: '雷·布拉德伯里', tips: '诗意的科幻；抒情与哲思并重，短篇凝练动人。' },
  { id: 'asimov', name: '阿西莫夫', wiki: '艾萨克·阿西莫夫', tips: '硬科幻设定严谨，机器人三定律等概念开创性；逻辑清晰，悬念精巧。' },
  { id: 'stephenking', name: '斯蒂芬·金', wiki: '斯蒂芬·金', tips: '日常细节制造恐怖；人物鲜活接地气，悬念钩子密集。' },
  { id: 'hugo', name: '雨果', wiki: '维克多·雨果', tips: '浪漫主义巨匠；宏大叙事与悲悯情怀，人物命运与社会图景交织。' },
  { id: 'dumas', name: '大仲马', wiki: '大仲马', tips: '通俗小说大师：情节跌宕、悬念连环，对话精彩，复仇与冒险主题。' },
  { id: 'dickens', name: '狄更斯', wiki: '查尔斯·狄更斯', tips: '维多利亚社会画卷；人物鲜明夸张，幽默与讽刺中见温情。' },
  { id: 'austen', name: '简·奥斯汀', wiki: '简·奥斯汀', tips: '细腻的婚恋观察与机智讽刺；对话精彩，人物心理入微。' },
  { id: 'kafka', name: '卡夫卡', wiki: '弗朗茨·卡夫卡', tips: '荒诞与异化；冷静白描包裹超现实设定，寓言气质。' },
  { id: 'camus', name: '加缪', wiki: '阿尔贝·加缪', tips: '存在主义底色；冷静克制的叙述，哲思与文学融合。' },
  { id: 'orwell', name: '乔治·奥威尔', wiki: '乔治·奥威尔', tips: '政治寓言与清晰有力的散文；反乌托邦叙事影响深远。' },
  { id: 'marquez', name: '加西亚·马尔克斯', wiki: '加夫列尔·加西亚·马尔克斯', tips: '魔幻现实主义巅峰；时间循环叙事，家族史诗与诗意意象。' },
  { id: 'borges', name: '博尔赫斯', wiki: '豪尔赫·路易斯·博尔赫斯', tips: '迷宫式短篇；哲学与幻想交织，叙事简洁玄妙。' }
];
/* 作家英/俄译名与技法简介（显示层翻译，不影响 AI 中文语境） */
const AUTHORS_I18N = {
  luxun: { en: { name: 'Lu Xun', tips: 'Satire and plain description; concise, incisive prose, cold compassion.' }, ru: { name: 'Лу Синь', tips: 'Сатира и лаконичное письмо; холодное сочувствие к человеку.' } },
  laoshe: { en: { name: 'Lao She', tips: 'Beijing-flavored colloquialism; humor and compassion for ordinary people.' }, ru: { name: 'Лао Шэ', tips: 'Пекинский разговорный колорит; юмор и сострадание к простым людям.' } },
  shencongwen: { en: { name: 'Shen Congwen', tips: 'Pastoral lyricism of western Hunan; pure, serene prose.' }, ru: { name: 'Шэнь Цунвэнь', tips: 'Пасторальная лирика западной Хунани; чистая, спокойная проза.' } },
  zhangailing: { en: { name: 'Eileen Chang', tips: 'Brilliant, startling metaphors; bleak-gorgeous tone and urban psychology.' }, ru: { name: 'Чжан Айлин', tips: 'Яркие неожиданные метафоры; меланхоличная роскошь, городская психология.' } },
  wangzengqi: { en: { name: 'Wang Zengqi', tips: 'Master of plain description; essayistic prose about food and everyday life.' }, ru: { name: 'Ван Цзэнци', tips: 'Мастер беглого описания; эссеистическая проза о еде и быте.' } },
  yuhua: { en: { name: 'Yu Hua', tips: 'Cold plain style, short sentences; restraint against great suffering, black humor.' }, ru: { name: 'Юй Хуа', tips: 'Холодная лаконичность; сдержанность перед страданием, чёрный юмор.' } },
  moyan: { en: { name: 'Mo Yan', tips: 'Magical realism with dense rural imagery; sensory power, grand structure.' }, ru: { name: 'Мо Янь', tips: 'Магический реализм с деревенскими образами; чувственная мощь, крупная форма.' } },
  wangxiaobo: { en: { name: 'Wang Xiaobo', tips: 'Humorous irony and speculation; black humor against grand narratives.' }, ru: { name: 'Ван Сяобо', tips: 'Юмор, ирония и мысль; чёрный юмор против пафоса.' } },
  jinyong: { en: { name: 'Jin Yong', tips: 'Chapter-form structure, vivid ensemble; martial arts merged with history.' }, ru: { name: 'Цзинь Юн', tips: 'Роман-цикл; боевые искусства и история, яркие персонажи.' } },
  gulong: { en: { name: 'Gu Long', tips: 'Short lines, ellipsis and suspense; freehand combat, lonely heroes.' }, ru: { name: 'Гу Лун', tips: 'Короткие строки, паузы, саспенс; одинокие герои.' } },
  liucixin: { en: { name: 'Liu Cixin', tips: 'Vast-scale imagination and hard-SF detail; cool narration, cosmic romance.' }, ru: { name: 'Лю Цысинь', tips: 'Грандиозное воображение и твёрдая НФ; космическая романтика.' } },
  wangjinkang: { en: { name: 'Wang Jinkang', tips: 'Philosophical SF; technology-ethics conflicts drive the story.' }, ru: { name: 'Ван Цзинькан', tips: 'Философская НФ; конфликты этики и технологий.' } },
  hexi: { en: { name: 'He Xi', tips: 'Soft SF with warmth; settings serve human themes.' }, ru: { name: 'Хэ Си', tips: 'Мягкая НФ; техника на службе человечности.' } },
  hansong: { en: { name: 'Han Song', tips: 'Eerie, cold SF imagery; postmodern, dystopian.' }, ru: { name: 'Хань Сун', tips: 'Жутковатые образы, постмодерн, антиутопия.' } },
  jiangnan: { en: { name: 'Jiang Nan', tips: 'Youthful passion and tragic aesthetics; gorgeous imagery, fine psychology.' }, ru: { name: 'Цзян Нань', tips: 'Юношеский пыл и трагическая эстетика; яркие образы, психологизм.' } },
  maboyong: { en: { name: 'Ma Boyong', tips: 'Research-based whimsy from historical gaps; fast pace, humor and tension.' }, ru: { name: 'Ма Боюн', tips: 'Остроумные истории из щелей истории; быстрый темп, юмор и напряжение.' } },
  maoni: { en: { name: 'Mao Ni', tips: 'Literary sensibility, long foreshadowing; idealistic character arcs.' }, ru: { name: 'Мао Ни', tips: 'Литературная утончённость; идеалистичные герои.' } },
  priest: { en: { name: 'Priest', tips: 'Strong logic and plot, dual protagonists; aphorisms and restraint.' }, ru: { name: 'Priest', tips: 'Крепкая логика сюжета; афоризмы и недосказанность.' } },
  tiancantudou: { en: { name: 'Tian Can Tu Dou', tips: 'Dense satisfaction beats, clear leveling system; tight pacing.' }, ru: { name: 'Тянь Цань Ту Доу', tips: 'Плотные динамичные сцены, чёткая система прогресса; плотный темп.' } },
  tangsanshao: { en: { name: 'Tang Jia San Shao', tips: 'Positive-energy passion with romance through-lines; steady narrative.' }, ru: { name: 'Тан Цзя Сань Шао', tips: 'Энергичный позитив, сквозная любовная линия; ровный ритм.' } },
  tianxiabachang: { en: { name: 'Tian Xia Ba Chang', tips: 'Folklore weird tales and suspense adventure; immersive first person.' }, ru: { name: 'Тянься Бачан', tips: 'Фольклорная мистика и приключения; эффект присутствия.' } },
  nanpaisanshu: { en: { name: 'Nan Pai San Shu', tips: 'Notebook-style narration, dense hooks; layered schemes.' }, ru: { name: 'Наньпай Саньшу', tips: 'Записки-повествование, крючки саспенса; многослойные загадки.' } },
  jkrowling: { en: { name: 'J.K. Rowling', tips: 'Careful foreshadowing, clear growth themes; innocence and darkness.' }, ru: { name: 'Дж. К. Роулинг', tips: 'Продуманные ружья, тема взросления; свет и тьма.' } },
  keigo: { en: { name: 'Keigo Higashino', tips: 'Social mystery, sharp reversals; crime reveals humanity.' }, ru: { name: 'Кэйго Хигасино', tips: 'Социальный детектив; преступление раскрывает человека.' } },
  agatha: { en: { name: 'Agatha Christie', tips: 'Fair-play puzzle structure; closed settings, multiple suspects.' }, ru: { name: 'Агата Кристи', tips: 'Честная детективная головоломка; закрытое пространство, подозреваемые.' } },
  hemingway: { en: { name: 'Ernest Hemingway', tips: 'Iceberg theory, terse dialogue; hard action prose.' }, ru: { name: 'Эрнест Хемингуэй', tips: 'Теория айсберга, скупые диалоги; жёсткая проза действия.' } },
  tolkien: { en: { name: 'J.R.R. Tolkien', tips: 'Pinnacle of world-building; epic scope, mythic language.' }, ru: { name: 'Дж. Р. Р. Толкин', tips: 'Вершина миростроительства; эпический размах и миф.' } },
  tolstoy: { en: { name: 'Leo Tolstoy', tips: 'Epic canvas and inner history; grand ensembles, moral inquiry.' }, ru: { name: 'Лев Толстой', tips: 'Эпический размах и история души; нравственный поиск.' } },
  dostoevsky: { en: { name: 'Fyodor Dostoevsky', tips: 'Deep psychology; dialogues of ideas, crime-and-punishment intensity.' }, ru: { name: 'Фёдор Достоевский', tips: 'Глубинная психология; диалоги идей, накал преступления и наказания.' } },
  chekhov: { en: { name: 'Anton Chekhov', tips: 'Restraint and precision; telling details, open endings.' }, ru: { name: 'Антон Чехов', tips: 'Сдержанность и точность; говорящие детали, открытые финалы.' } },
  pushkin: { en: { name: 'Alexander Pushkin', tips: 'Concise, beautiful language; narrative verse spirit.' }, ru: { name: 'Александр Пушкин', tips: 'Лаконичный, прекрасный язык; дух повествовательной поэзии.' } },
  marktwain: { en: { name: 'Mark Twain', tips: 'American humor and satire; lively colloquial narration.' }, ru: { name: 'Марк Твен', tips: 'Американский юмор и сатира; живое разговорное повествование.' } },
  fitzgerald: { en: { name: 'F. Scott Fitzgerald', tips: 'Jazz-age glamour and disillusion; lyrical, gorgeous imagery.' }, ru: { name: 'Ф. С. Фицджеральд', tips: 'Блеск и разочарование эпохи джаза; лиричные образы.' } },
  faulkner: { en: { name: 'William Faulkner', tips: 'Stream of consciousness, multi-perspective; Southern Gothic tension.' }, ru: { name: 'Уильям Фолкнер', tips: 'Поток сознания, многоголосие; южная готика.' } },
  poe: { en: { name: 'Edgar Allan Poe', tips: 'Father of Gothic horror and detective fiction; extreme atmosphere.' }, ru: { name: 'Эдгар Аллан По', tips: 'Отец готики и детектива; предельная атмосфера.' } },
  lovecraft: { en: { name: 'H.P. Lovecraft', tips: 'Cosmic horror: unnameable dread, Cthulhu mythos, creeping despair.' }, ru: { name: 'Г. Ф. Лавкрафт', tips: 'Космический ужас: невыразимый страх, мифы Ктулху, нарастающее отчаяние.' } },
  bradbury: { en: { name: 'Ray Bradbury', tips: 'Poetic science fiction; lyricism and reflection.' }, ru: { name: 'Рэй Брэдбери', tips: 'Поэтическая фантастика; лирика и размышление.' } },
  asimov: { en: { name: 'Isaac Asimov', tips: 'Rigorous hard SF, three laws of robotics; clear logic, neat suspense.' }, ru: { name: 'Айзек Азимов', tips: 'Строгая твёрдая НФ, три закона робототехники; чёткая логика.' } },
  stephenking: { en: { name: 'Stephen King', tips: 'Horror from everyday details; vivid characters, dense hooks.' }, ru: { name: 'Стивен Кинг', tips: 'Ужас из бытовых деталей; живые герои, плотные крючки.' } },
  hugo: { en: { name: 'Victor Hugo', tips: 'Romantic giant; grand narrative and compassion.' }, ru: { name: 'Виктор Гюго', tips: 'Гигант романтизма; великое повествование и сострадание.' } },
  dumas: { en: { name: 'Alexandre Dumas', tips: 'Master of popular fiction; twists, vivid dialogue, revenge and adventure.' }, ru: { name: 'Александр Дюма', tips: 'Мастер приключенческого романа; месть и авантюра.' } },
  dickens: { en: { name: 'Charles Dickens', tips: 'Victorian social panorama; vivid characters, humor and warmth.' }, ru: { name: 'Чарльз Диккенс', tips: 'Викторианская панорама; яркие характеры, юмор и тепло.' } },
  austen: { en: { name: 'Jane Austen', tips: 'Fine marriage comedy and wit; brilliant dialogue, subtle psychology.' }, ru: { name: 'Джейн Остин', tips: 'Тонкая комедия нравов; блестящие диалоги, психологизм.' } },
  kafka: { en: { name: 'Franz Kafka', tips: 'Absurdity and alienation; calm surface over surreal premises.' }, ru: { name: 'Франц Кафка', tips: 'Абсурд и отчуждение; спокойная форма над сюрреальным.' } },
  camus: { en: { name: 'Albert Camus', tips: 'Existential undertone; restrained narration fusing thought and literature.' }, ru: { name: 'Альбер Камю', tips: 'Экзистенциальный подтекст; сдержанность и мысль.' } },
  orwell: { en: { name: 'George Orwell', tips: 'Political allegory, clear forceful prose; dystopian legacy.' }, ru: { name: 'Джордж Оруэлл', tips: 'Политическая аллегория, ясная проза; антиутопия.' } },
  marquez: { en: { name: 'Gabriel García Márquez', tips: 'Pinnacle of magical realism; circular time, family epics.' }, ru: { name: 'Габриэль Гарсиа Маркес', tips: 'Вершина магического реализма; круговое время, семейная эпопея.' } },
  borges: { en: { name: 'Jorge Luis Borges', tips: 'Labyrinthine short fiction; philosophy and fantasy, terse narration.' }, ru: { name: 'Хорхе Луис Борхес', tips: 'Лабиринтная новелла; философия и фантастика.' } }
};
const GENRE_I18N = {
  '科幻': { en: 'Sci-Fi', ru: 'НФ' }, '玄幻': { en: 'Xuanhuan', ru: 'Сюаньхуань' }, '奇幻': { en: 'Fantasy', ru: 'Фэнтези' },
  '都市': { en: 'Urban', ru: 'Городское' }, '悬疑': { en: 'Mystery', ru: 'Мистика' }, '推理': { en: 'Detective', ru: 'Детектив' },
  '恐怖': { en: 'Horror', ru: 'Ужасы' }, '历史': { en: 'Historical', ru: 'Исторический' }, '军事': { en: 'Military', ru: 'Военный' },
  '武侠': { en: 'Wuxia', ru: 'Уся' }, '仙侠': { en: 'Xianxia', ru: 'Сянься' }, '修真': { en: 'Cultivation', ru: 'Культивация' },
  '游戏': { en: 'Gaming', ru: 'Игровой' }, '体育': { en: 'Sports', ru: 'Спорт' }, '轻小说': { en: 'Light Novel', ru: 'Ранобэ' },
  '同人': { en: 'Fanfic', ru: 'Фанфик' }, '言情': { en: 'Romance', ru: 'Романтика' }, '无限流': { en: 'Infinite Flow', ru: 'Бесконечный поток' },
  '克苏鲁': { en: 'Cthulhu', ru: 'Ктулху' }, '赛博朋克': { en: 'Cyberpunk', ru: 'Киберпанк' }, '废土': { en: 'Wasteland', ru: 'Пустошь' },
  '太空歌剧': { en: 'Space Opera', ru: 'Космоопера' }, '蒸汽朋克': { en: 'Steampunk', ru: 'Стимпанк' }, '群像': { en: 'Ensemble', ru: 'Ансамбль' },
  '单元剧': { en: 'Episodic', ru: 'Эпизодический' }
};
function genreName(g) {
  const m = GENRE_I18N[g];
  if (!m) return g;
  return state.settings.lang === 'en' ? m.en : (state.settings.lang === 'ru' ? m.ru : g);
}
function authorName(a) {
  const m = AUTHORS_I18N[a.id];
  if (!m) return a.name;
  return state.settings.lang === 'en' ? (m.en.name || a.name) : (state.settings.lang === 'ru' ? (m.ru.name || a.name) : a.name);
}
function authorTips(a) {
  const m = AUTHORS_I18N[a.id];
  if (!m) return a.tips;
  return state.settings.lang === 'en' ? (m.en.tips || a.tips) : (state.settings.lang === 'ru' ? (m.ru.tips || a.tips) : a.tips);
}
/* 通用风格值的显示层翻译 */
const STYLEVAL_I18N = {
  '通用': { en: 'Universal', ru: 'Универсальный' }, '未定': { en: 'TBD', ru: 'Не определено' },
  '大众向': { en: 'General audience', ru: 'Широкая аудитория' }, '青少年': { en: 'Young adult', ru: 'Подростки' }, '成人': { en: 'Adult', ru: 'Взрослые' },
  '短篇': { en: 'Short story', ru: 'Рассказ' }, '中篇': { en: 'Novella', ru: 'Повесть' }, '长篇': { en: 'Novel', ru: 'Роман' }, '连载': { en: 'Serial', ru: 'Сериал' },
  '第一人称': { en: 'First person', ru: 'От первого лица' }, '第三人称': { en: 'Third person', ru: 'От третьего лица' },
  '上帝视角': { en: 'Omniscient', ru: 'Всеведущий' }, '多视角': { en: 'Multi-POV', ru: 'Многоголосие' },
  '轻松': { en: 'Light', ru: 'Лёгкий' }, '热血': { en: 'Passionate', ru: 'Энергичный' }, '黑暗': { en: 'Dark', ru: 'Мрачный' },
  '幽默': { en: 'Humorous', ru: 'Юмористический' }, '悬疑': { en: 'Suspenseful', ru: 'Напряжённый' }, '感人': { en: 'Moving', ru: 'Трогательный' }
};
function styleValName(v) {
  if (!v) return '';
  const m = STYLEVAL_I18N[v];
  if (!m) return v;
  return state.settings.lang === 'en' ? m.en : (state.settings.lang === 'ru' ? m.ru : v);
}
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
  '1. 使用系统指定的作品输出语言。',
  '2. 用户消息中会携带【小说信息】【风格档案】【大纲】【角色卡】【世界观】【记忆库】【参考作家技法】【前文章节】等上下文，这是你对这部小说的全部记忆，请始终以此为依据，保持人物、设定、伏笔一致。',
  '3. 被要求「续写」时，只输出小说正文，不要任何解释、标题或前言。',
  '4. 被要求「提取记忆」时，只输出 JSON 数组，不要任何其他内容。',
  '5. 回答可用 Markdown 排版；剧情建议要具体、可执行。',
  '6. 永远尊重用户创意，可大胆提出构思，但不擅自删除设定。',
  '7. 文笔要求（非常重要）：像人类作家一样写作——句式长短交错，段落节奏有变化；避免连续段落用相同句式开头；少用「只见/顿时/不由得/心中一动」等套路词堆砌；对话口语化、符合人物身份与情绪；用具体细节与五感描写代替抽象概括；避免机械重复同一表达；情节推进自然，不硬凑。',
  '8. 若用户提供了参考作家：学习其写作技法（而非抄袭其句子或情节），结合本小说题材灵活运用，让文笔接地气、通人性。',
  '10. 所有输出遵循标准格式：使用规范文字与标点，不使用表情符号、特殊符号或装饰性字符；引用与参考文献按学术规范标注。'
].join('\n');

/* ---------------- 数据库 ---------------- */
const DB_NAME = 'nebula-novel-db', DB_VER = 2;
const STORE = { novels: 'novels', chapters: 'chapters', outline: 'outline', characters: 'characters', memories: 'memories', chats: 'chats', papers: 'papers' };
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
          if (s !== STORE.papers) st.createIndex('byNovel', 'novelId', { unique: false });
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
  if (state.settings.storageDenied) return Promise.resolve(obj);
  if (dbMode === 'idb') return new Promise((res, rej) => {
    const tr = db.transaction(store, 'readwrite');
    tr.objectStore(store).put(obj);
    tr.oncomplete = () => res(obj); tr.onerror = () => rej(tr.error);
  });
  lsMem[store][obj.id] = obj; lsSave(store); return Promise.resolve(obj);
}
/* Draft saves compare and write inside one transaction, across tabs. */
const draftWrites = new WeakMap();
const draftRedirect = new WeakMap();
const RECOVERY_KEY = 'nebula-draft-recovery-v1';
const pendingDrafts = new Map();
const recoveryId = (store, id) => store + ':' + id;
function syncPendingDrafts() {
  if (state.settings.storageDenied) return;
  try {
    if (!pendingDrafts.size) sessionStorage.removeItem(RECOVERY_KEY);
    else sessionStorage.setItem(RECOVERY_KEY, JSON.stringify([...pendingDrafts.values()]));
  } catch (_) { /* IndexedDB remains the primary save path. */ }
}
function rememberPendingDraft(store, record, delta, options) {
  const key = recoveryId(store, record.id);
  const { id, title, novelId, order, createdAt, updatedAt, revision } = record;
  const pending = { store, base: { id, title, novelId, order, createdAt, updatedAt, revision }, delta, options };
  pendingDrafts.set(key, pending);
  syncPendingDrafts();
  return pending;
}
function clearPendingDraft(pending) {
  const key = recoveryId(pending.store, pending.base.id);
  if (pendingDrafts.get(key) !== pending) return;
  pendingDrafts.delete(key);
  syncPendingDrafts();
}
async function replayPendingDrafts() {
  if (state.settings.storageDenied) return;
  let entries;
  try { entries = JSON.parse(sessionStorage.getItem(RECOVERY_KEY) || '[]'); }
  catch (_) { return; }
  if (!Array.isArray(entries)) return;
  for (const item of entries) {
    if (!item || ![STORE.chapters, STORE.papers].includes(item.store) ||
        typeof item.base?.id !== 'string' || typeof item.delta?.content !== 'string') continue;
    pendingDrafts.set(recoveryId(item.store, item.base.id), item);
  }
  let recovered = 0;
  for (const entry of [...pendingDrafts.values()]) {
    try {
      const latest = await dbGet(entry.store, entry.base.id);
      const delta = { ...draftVersionFields(entry.delta), wordCount: countWords(entry.delta.content) };
      if (latest && Object.keys(delta).every(key => latest[key] === delta[key])) {
        clearPendingDraft(entry);
        continue;
      }
      if (entry.store === STORE.chapters && !await dbGet(STORE.novels, entry.base.novelId)) continue;
      const result = await dbSaveDraft(entry.store, entry.base, delta, entry.options);
      clearPendingDraft(entry);
      recovered++;
      if (entry.store === STORE.chapters && state.currentChapterId === entry.base.id) state.currentChapterId = result.saved.id;
      if (entry.store === STORE.papers && state.currentPaperId === entry.base.id) state.currentPaperId = result.saved.id;
    } catch (_) { /* Keep the journal for the next retry. */ }
  }
  if (recovered) toast(draftNotice('replayed'), 'ok', 8000);
  if (pendingDrafts.size) toast(draftNotice('failed'), 'err', 9000);
}
function draftStamp(record) {
  return record ? JSON.stringify([record.revision || '', record.updatedAt || 0]) : null;
}
function draftNotice(key) {
  const labels = {
    copy: ['另一标签页已更新原稿。你的改动已另存为冲突副本。', 'The original changed in another tab. Your edits were saved as a conflict copy.', 'Оригинал изменён в другой вкладке. Ваши правки сохранены в отдельной копии.'],
    failed: ['保存失败：请先复制正文或导出备份。', 'Save failed. Copy your text or export a backup before leaving.', 'Не удалось сохранить. Скопируйте текст или экспортируйте резервную копию.'],
    memory: ['未启用本地存储；当前改动只保留在本页。', 'Local storage is disabled. Changes are kept only on this page.', 'Локальное хранилище отключено. Правки остаются только на этой странице.'],
    suffix: ['冲突副本', 'Conflict copy', 'Конфликтная копия'],
    replayed: ['已找回刷新前尚未写入的稿件。', 'Recovered edits pending before reload.', 'Восстановлены правки, ожидавшие сохранения до обновления страницы.']
  };
  return labels[key][({zh:0,en:1,ru:2})[state.settings.lang] ?? 0];
}
const HISTORY_LIMIT = 50;
const HISTORY_MAX_CHARS = 1250000;
const HISTORY_FIELDS = ['title', 'content', 'outline', 'topic', 'status', 'outLang'];
function draftVersionFields(record) {
  return Object.fromEntries(HISTORY_FIELDS.filter(key => typeof record[key] === 'string').map(key => [key, record[key]]));
}
function versionSize(record) {
  return HISTORY_FIELDS.reduce((n, key) => n + (typeof record[key] === 'string' ? record[key].length : 0), 0);
}
function collectDraftHistory(record, delta, checkpoint = false) {
  const history = (Array.isArray(record.history) ? record.history : []).filter(item =>
    item && typeof item.id === 'string' && Number.isFinite(item.at) && versionSize(item) <= HISTORY_MAX_CHARS);
  if (!HISTORY_FIELDS.some(key => key in delta && (record[key] || '') !== (delta[key] || ''))) return history;
  if (!record.content && !record.outline && !record.topic) return history;
  const old = { id: uid(), at: record.updatedAt || now(), ...draftVersionFields(record) };
  if (versionSize(old) > HISTORY_MAX_CHARS) return history;
  const rolling = history.at(-1);
  if (!checkpoint && rolling && !rolling.checkpoint && old.at - rolling.at < 15000) {
    history[history.length - 1] = old;
  } else {
    if (rolling) history[history.length - 1] = { ...rolling, checkpoint: true };
    if (checkpoint) old.checkpoint = true;
    history.push(old);
  }
  let size = history.reduce((n, entry) => n + versionSize(entry), 0);
  while (history.length > HISTORY_LIMIT || size > HISTORY_MAX_CHARS) size -= versionSize(history.shift());
  return history;
}
function draftOutcome(latest, base, delta, options = {}) {
  const conflict = !latest || draftStamp(latest) !== draftStamp(base);
  const source = latest && !conflict ? latest : base;
  const saved = { ...source, ...delta, revision: uid(), updatedAt: now() };
  saved.history = collectDraftHistory(conflict ? { ...source, history: [] } : source, delta, options.checkpoint);
  if (options.checkpoint && source.content && saved.content !== source.content && !saved.history.some(v => v.content === source.content)) {
    throw new Error('Cannot safely checkpoint the current draft before restoring');
  }
  if (conflict) {
    saved.id = uid();
    saved.conflictOf = base.id;
    saved.title = (delta.title || base.title || '—') + ' · ' + draftNotice('suffix');
    if (typeof saved.order === 'number') saved.order += 0.5;
  }
  return { saved, latest, conflict };
}
async function dbSaveDraft(store, base, delta, options = {}) {
  if (state.settings.storageDenied) return { ...draftOutcome(base, base, delta, options), memory: true };
  if (dbMode === 'idb') return new Promise((resolve, reject) => {
    const tr = db.transaction(store, 'readwrite');
    const os = tr.objectStore(store);
    const req = os.get(base.id);
    let result;
    let failure;
    req.onsuccess = () => {
      try { result = draftOutcome(req.result, base, delta, options); os.put(result.saved); }
      catch (error) { failure = error; tr.abort(); }
    };
    tr.oncomplete = () => resolve(result);
    tr.onabort = () => reject(failure || tr.error || new Error('Draft transaction aborted'));
  });
  if (!navigator.locks) throw new Error('Safe cross-tab draft locking unavailable');
  return navigator.locks.request(lsKey(store), () => {
    const records = JSON.parse(localStorage.getItem(lsKey(store)) || '{}');
    const result = draftOutcome(records[base.id], base, delta, options);
    records[result.saved.id] = result.saved;
    localStorage.setItem(lsKey(store), JSON.stringify(records));
    lsMem[store] = records;
    return result;
  });
}
async function persistDraft(store, record, delta, manual, options = {}) {
  const paper = store === STORE.papers;
  const idKey = paper ? 'currentPaperId' : 'currentChapterId';
  const dirtyKey = paper ? 'paperDirty' : 'editorDirty';
  const setStatus = paper ? setPaperSaveState : setSaveState;
  const titleBox = paper ? '#paper-title' : '#chapter-title';
  const coll = paper ? state.papers : state.chapters;
  const pending = rememberPendingDraft(store, record, delta, options);
  const previous = draftWrites.get(record) || Promise.resolve();
  const work = previous.catch(() => {}).then(async () => {
    const base = draftRedirect.get(record) || record;
    try {
      const result = await dbSaveDraft(store, base, delta, options);
      clearPendingDraft(pending);
      if (result.conflict) {
        if (result.latest) Object.assign(base, result.latest);
        else {
          const i = coll.indexOf(base);
          if (i >= 0) coll.splice(i, 1);
        }
        coll.push(result.saved);
        draftRedirect.set(record, result.saved);
        draftWrites.set(result.saved, draftWrites.get(record) || work);
        if (state[idKey] === base.id) {
          state[idKey] = result.saved.id;
          saveResumeIds();
          if ($(titleBox).value.trim() === delta.title) $(titleBox).value = result.saved.title;
        }
        toast(draftNotice('copy'), 'warn', 9000);
      } else {
        Object.assign(base, result.saved);
        if (result.memory && manual) toast(draftNotice('memory'), 'warn');
        else if (manual) toast(t(paper ? 'toast.paperSaved' : 'toast.savedOk'), 'ok');
      }
      if (state[idKey] === result.saved.id && !state[dirtyKey]) setStatus(!result.memory);
      renderTop();
      if (paper ? state.board === 'paper' : state.board === 'novel' && state.module === 'chapters') renderPanel();
      return result;
    } catch (e) {
      if (state[idKey] === base.id) { state[dirtyKey] = true; setStatus(false); }
      toast(draftNotice('failed'), 'err', 9000);
    }
  });
  draftWrites.set(record, work);
  return work;
}

function dbDel(store, id) {
  if (state.settings.storageDenied) return Promise.resolve();
  if (dbMode === 'idb') return new Promise((res, rej) => {
    const tr = db.transaction(store, 'readwrite');
    tr.objectStore(store).delete(id);
    tr.oncomplete = () => res(); tr.onerror = () => rej(tr.error);
  });
  delete lsMem[store][id]; lsSave(store); return Promise.resolve();
}
function dbClear(store) {
  if (state.settings.storageDenied) return Promise.resolve();
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
    bg: 'stars', petVisible: true, autoModel: false, plan: 'free', storageDenied: false, board: 'novel',
    adminBg: true,
    ctx: { outline: true, chars: true, world: true, mem: true, chatHistory: true, prevChapters: 2 },
    user: { nickname: '', avatarPreset: 0, avatarData: '' },
    customAuthors: []
  };
}
const APP_VERSION = '4.11.0';
const PLAN_LEVEL = { free: 0, pro: 1, deepseek: 2, flag: 3 };
const PLAN_PREV_MAX = { free: 2, pro: 5, deepseek: 5, flag: 10 };
const state = {
  novels: [], chapters: [], outline: [], characters: [], memories: [], chats: [], papers: [],
  currentNovelId: null, currentChapterId: null, currentPaperId: null,
  board: 'novel',
  module: 'chapters', memFilter: '全部', authorFilter: '',
  settings: defaultSettings(),
  saveTimer: null, editorDirty: false, novelSaveTimer: null,
  paperSaveTimer: null, paperDirty: false,
  chatForNovel: [],
  noteCtx: null, charEditingId: null, novelEditingId: null, provEditingId: null,
  styleDraft: null,
  confirmResolve: null,
  aiStreaming: false, aiAbort: null,
  wikiCache: {},
  learning: false,
  genState: { running: false, stageIdx: -1, abort: null, genKind: 'novel' },
  immersive: null, imRunning: false, imAbort: null,
  accounts: {}, currentUser: null, authMode: 'login', tipAmount: null,
  changelogChecked: false
};
let lastTrialState = null;
let lastChangelogVersion = null;
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('nebula-settings'));
    if (s) state.settings = Object.assign(defaultSettings(), s, { user: Object.assign(defaultSettings().user, s.user || {}) });
  } catch (e) { }
}
function saveSettings() { localStorage.setItem('nebula-settings', JSON.stringify(state.settings)); }
function loadImmersive() { try { state.immersive = JSON.parse(localStorage.getItem('nebula-immersive')) || null; } catch (_) { state.immersive = null; } }
function loadWikiCache() {
  try { state.wikiCache = JSON.parse(localStorage.getItem('nebula-wiki-cache') || '{}'); } catch (e) { state.wikiCache = {}; }
}
function saveWikiCache() { try { localStorage.setItem('nebula-wiki-cache', JSON.stringify(state.wikiCache)); } catch (e) { } }

const RESUME_KEY = 'nebula-current-work-v1';
function loadResumeIds() {
  if (state.settings.storageDenied) return;
  try {
    const ids = JSON.parse(sessionStorage.getItem(RESUME_KEY) || '{}');
    for (const key of ['currentNovelId', 'currentChapterId', 'currentPaperId']) {
      if (typeof ids[key] === 'string') state[key] = ids[key];
    }
  } catch (_) { /* Selection will fall back to the latest available draft. */ }
}
function saveResumeIds() {
  if (state.settings.storageDenied) return;
  try {
    const {currentNovelId, currentChapterId, currentPaperId} = state;
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({currentNovelId, currentChapterId, currentPaperId}));
  } catch (_) {}
}

const curNovel = () => state.novels.find(n => n.id === state.currentNovelId) || null;
const curChapter = () => state.chapters.find(c => c.id === state.currentChapterId) || null;
function chaptersOf(nid) { return state.chapters.filter(c => c.novelId === nid).sort((a, b) => a.order - b.order); }
const novelGenres = n => (Array.isArray(n.genres) && n.genres.length ? n.genres : (n.genre ? n.genre.split('、') : []));
const novelRefAuthors = n => (Array.isArray(n.refAuthors) ? n.refAuthors : []);
const allAuthors = () => AUTHORS.map(a => Object.assign({}, a, { custom: false })).concat((state.settings.customAuthors || []).map(a => Object.assign({}, a, { custom: true, wiki: a.wikiTitle || a.name })));
const findAuthor = id => allAuthors().find(a => a.id === id) || null;

/* ---------------- 数据加载 ---------------- */
async function loadAll() {
  const [novels, chapters, outline, characters, memories, chats, papers] = await Promise.all([
    dbAll(STORE.novels), dbAll(STORE.chapters), dbAll(STORE.outline),
    dbAll(STORE.characters), dbAll(STORE.memories), dbAll(STORE.chats), dbAll(STORE.papers)
  ]);
  // 竞态保护：若加载尚未完成时用户已开始创作，则不用旧快照覆盖内存数据
  const fresh = state.novels.length === 0 && state.chapters.length === 0 &&
    state.outline.length === 0 && state.characters.length === 0 && state.memories.length === 0 &&
    state.papers.length === 0;
  if (!fresh) return;
  state.novels = novels.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  state.chapters = chapters; state.outline = outline;
  state.characters = characters; state.memories = memories; state.chats = chats;
  state.papers = papers;
  if (!papers.some(p => p.id === state.currentPaperId)) {
    state.currentPaperId = [...papers].sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]?.id || null;
  }
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
  if (!chatKey()) return;
  await dbPut(STORE.chats, { id: chatKey(), novelId: chatKey(), messages: state.chatForNovel.slice(-100) });
}

/* ---------------- 顶栏 ---------------- */
function renderTop() {
  const n = curNovel();
  if (state.board === 'paper') {
    $('#novel-pill-title').textContent = t('board.paper');
    const ps = state.papers;
    const total = ps.reduce((s, p) => s + (p.wordCount || 0), 0);
    $('#stats').textContent = ps.length + ' · ' + fmtNum(total) + ' ' + t('stat.wordsChip');
    renderProfileTop();
    trialCheck();
    return;
  }
  $('#novel-pill-title').textContent = n ? (n.title || t('novel.pending')) : t('top.noNovel');
  if (!n) { $('#stats').textContent = ''; renderProfileTop(); return; }
  const chs = chaptersOf(n.id);
  const total = chs.reduce((s, c) => s + (c.wordCount || 0), 0);
  $('#stats').textContent = chs.length + ' · ' + fmtNum(total) + ' ' + t('stat.wordsChip');
  renderProfileTop();
  trialCheck();
}
function renderModelTag() {
  const p = activeProvider();
  const el = $('#ai-model-tag');
  el.textContent = p ? (modelDisplayName(p) + ' · ' + p.model) : t('ai.modelNone');
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
    const gtxt = gs.slice(0, 2).map(genreName).join(' / ') + (gs.length > 2 ? ' +' + (gs.length - 2) : '');
    return `
    <div class="lib-row ${n.id === state.currentNovelId ? 'active' : ''}" data-id="${n.id}">
      <div class="lib-cover" style="--cover:${n.color || '#00e0ff'}"></div>
      <div class="lib-info">
        <div class="lib-title">${esc(n.title || t('novel.pending'))}</div>
        <div class="lib-meta">${esc(styleValName(n.audience))} ${esc(gtxt || t('novel.legacyGenre'))} · ${chaptersOf(n.id).length} · ${fmtDate(n.updatedAt)}</div>
      </div>
      <div class="row-actions" style="opacity:1">
        <button class="icon-btn" data-act="edit" data-id="${n.id}" data-i18n-title="lib.editTitle" title="编辑信息">✎</button>
        <button class="icon-btn danger" data-act="del" data-id="${n.id}" data-i18n-title="lib.delTitle" title="删除小说">✕</button>
      </div>
    </div>`;
  }).join('') || '<div class="empty-hint">' + t('empty.lib') + '</div>';
}
async function switchNovel(id) {
  if (id === state.currentNovelId) { closeModal('modal-library'); return; }
  cancelGen();
  await flushSave();
  state.currentNovelId = id;
  const chs = chaptersOf(id);
  if (!chs.find(c => c.id === state.currentChapterId)) state.currentChapterId = chs[0] ? chs[0].id : null;
  await loadChatFor(id);
  closeModal('modal-library');
  renderLibrary(); renderAll();
}

/* ---------------- 小说弹窗（含风格表格） ---------------- */
let quickStartNovel = false;
function openNovelModal(id, { firstChapter = false } = {}) {
  quickStartNovel = firstChapter;
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
      standard: n.standard || '通用',
      personal: n.personal || 'human',
      lang: normalizeOutputLang(n.lang),
      authors: [...novelRefAuthors(n)]
    };
  } else {
    state.styleDraft = { audience: '通用', genres: [], length: '未定', pov: '未定', tone: '未定', narrative: 'dialogue', standard: '通用', personal: 'human', lang: 'zh', authors: [] };
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
  if (gWrap) gWrap.innerHTML = GENRES.map(g => `<button class="chip ${d.genres.includes(g) ? 'on' : ''}" data-val="${g}">${esc(genreName(g))}</button>`).join('');
  const aWrap = document.querySelector('#modal-novel [data-field="authors"]');
  if (aWrap) aWrap.innerHTML = allAuthors().map(a => `<button class="chip ${d.authors.includes(a.id) ? 'on' : ''}" data-val="${a.id}">${esc(authorName(a))}${a.custom ? ' ✦' : ''}</button>`).join('');
  ['audience', 'length', 'pov', 'tone', 'narrative', 'standard', 'personal', 'lang'].forEach(f => {
    $$('#modal-novel [data-field="' + f + '"] .chip').forEach(b => {
      b.classList.toggle('on', b.dataset.val === d[f]);
      if (!b.hasAttribute('data-i18n')) b.textContent = styleValName(b.dataset.val);
    });
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
  const createFirstChapter = quickStartNovel && !id;
  const desc = $('#novel-desc').value.trim();
  const d = state.styleDraft || { audience: '通用', genres: [], length: '未定', pov: '未定', tone: '未定', narrative: 'dialogue', standard: '通用', personal: 'human', lang: 'zh', authors: [] };
  const genreStr = d.genres.join('、') || t('novel.legacyGenre');
  if (id) {
    const n = state.novels.find(x => x.id === id);
    if (n) {
      n.title = title; n.description = desc;
      n.audience = d.audience; n.genres = [...d.genres]; n.genre = genreStr;
      n.length = d.length; n.pov = d.pov; n.tone = d.tone; n.narrative = d.narrative;
      n.standard = d.standard; n.personal = d.personal;
      n.lang = normalizeOutputLang(d.lang); n.refAuthors = [...d.authors];
      n.updatedAt = now();
      await dbPut(STORE.novels, n);
    }
  } else {
    const n = {
      id: uid(), title, description: desc,
      audience: d.audience, genres: [...d.genres], genre: genreStr,
      length: d.length, pov: d.pov, tone: d.tone, narrative: d.narrative,
      standard: d.standard, personal: d.personal,
      lang: d.lang, refAuthors: [...d.authors],
      styleMode: 'author', styleSample: '',
      color: PALETTE[state.novels.length % PALETTE.length],
      createdAt: now(), updatedAt: now(), synopsis: '', world: '', worldSections: []
    };
    state.novels.push(n);
    await dbPut(STORE.novels, n);
    cancelGen();
    await flushSave();
    state.currentNovelId = n.id; state.currentChapterId = null;
    await loadChatFor(n.id);
  }
  closeModal('modal-novel');
  renderLibrary(); renderAll();
  toast(t('toast.novelSaved'));
  if (createFirstChapter && state.board === 'novel') await newChapter();
}
async function delNovel(id) {
  const n = state.novels.find(x => x.id === id);
  if (!n) return;
  if (!await confirmDialog(t('confirm.delNovel', { t: n.title }))) return;
  if (state.currentNovelId === id) cancelGen();
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
async function wikiLearn(authorId, signal) {
  const a = AUTHORS.find(x => x.id === authorId);
  if (!a) return null;
  if (state.wikiCache[a.id] && state.wikiCache[a.id].text) return state.wikiCache[a.id].text;
  const url = 'https://zh.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&origin=*&redirects=1&titles=' + encodeURIComponent(a.wiki || a.name);
  const res = await fetch(url, { signal: generationTimeout(15000, signal) });
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
  if (id === state.currentChapterId) return;
  cancelGen();
  flushSave();
  state.currentChapterId = id;
  renderEditor(); renderPanel();
}
async function newChapter() {
  if (!curNovel()) return toast(t('toast.needNovel'), 'warn');
  cancelGen();
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
  cancelGen();
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
  if (state.currentChapterId === id) cancelGen();
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
  if (store === STORE.chapters && !state.settings.storageDenied) {
    const pairs = [arr[i], arr[j]].map(c => [c.id, c.order]);
    if (dbMode === 'idb') await new Promise((resolve, reject) => {
      const tr = db.transaction(store, 'readwrite'), os = tr.objectStore(store);
      for (const [id, order] of pairs) {
        const req = os.get(id);
        req.onsuccess = () => { if (req.result) os.put({ ...req.result, order }); };
      }
      tr.oncomplete = resolve;
      tr.onabort = () => reject(tr.error);
    });
    else if (navigator.locks) await navigator.locks.request(lsKey(store), () => {
      const records = JSON.parse(localStorage.getItem(lsKey(store)) || '{}');
      for (const [id, order] of pairs) if (records[id]) records[id].order = order;
      localStorage.setItem(lsKey(store), JSON.stringify(records));
      lsMem[store] = records;
    });
    else toast(draftNotice('failed'), 'err');
  } else { await dbPut(store, arr[i]); await dbPut(store, arr[j]); }
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
  const key = 'editor.placeholder.' + normalizeOutputLang(n?.lang, state.settings.lang);
  ed.placeholder = t(key);
}
function renderEditor() {
  saveResumeIds();
  if (state.board === 'paper') { renderPaperEditor(); syncMobileWritingKeys(); return; }
  syncMobileWritingKeys();
  const c = curChapter();
  const tEl = $('#chapter-title'), st = $('#chapter-status'), ed = $('#editor'), co = $('#chapter-outline');
  renderEditorPlaceholder();
  $('#btn-chapter-history').disabled = !c;
  $('#btn-manuscript-search').disabled = !curNovel();
  $('#btn-chapter-coach').disabled = !c;
  if (!c) {
    tEl.value = ''; tEl.disabled = true; st.disabled = true;
    ed.value = ''; ed.disabled = true;
    co.value = ''; co.disabled = true;
    ed.placeholder = t('editor.noChapter');
    updateCounts(); setSaveState(null);
    return;
  }
  const pending = pendingDrafts.get(recoveryId(STORE.chapters, c.id));
  const shown = pending ? { ...c, ...pending.delta } : c;
  tEl.disabled = false; st.disabled = false; ed.disabled = false; co.disabled = false;
  if (document.activeElement !== tEl) tEl.value = shown.title || '';
  if (document.activeElement !== ed) ed.value = shown.content || '';
  if (document.activeElement !== co) co.value = shown.outline || '';
  st.value = shown.status || 'draft';
  ed.style.fontSize = state.settings.fontSize + 'px';
  updateCounts();
  if (pending) state.editorDirty = true;
  setSaveState(!state.editorDirty);
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
  else await draftWrites.get(curChapter());
}
async function saveChapter(manual) {
  const c = curChapter();
  if (!c) { state.editorDirty = false; return; }
  clearTimeout(state.saveTimer);
  if (!state.editorDirty) return draftWrites.get(c);
  const content = $('#editor').value;
  const delta = { title: $('#chapter-title').value.trim(), content,
    outline: $('#chapter-outline').value, status: $('#chapter-status').value, wordCount: countWords(content) };
  state.editorDirty = false;
  const result = await persistDraft(STORE.chapters, c, delta, manual);
  if (result && manual) document.dispatchEvent(new Event('historyFirstSave'));
}
function toggleFocus(force) {
  const on = force !== undefined ? force : !document.body.classList.contains('focus-mode');
  document.body.classList.toggle('focus-mode', on);
  $('#btn-focus').textContent = t(on ? 'btn.focusExit' : 'btn.focus');
}

/* ---------------- 面板渲染 ---------------- */
function inMobileWorkspace() {
  return matchMedia('(max-width: 680px)').matches;
}
function syncMobileWorkspace() {
  const compact = inMobileWorkspace();
  const panelOpen = document.body.classList.contains('mobile-panel-open');
  const aiOpen = document.body.classList.contains('mobile-ai-open');
  for (const b of $$('#main-nav .nav-item')) {
    if (compact) {
      b.setAttribute('aria-controls', 'side-panel');
      b.setAttribute('aria-expanded', String(panelOpen && b.dataset.module === state.module));
    } else {
      b.removeAttribute('aria-controls');
      b.removeAttribute('aria-expanded');
    }
  }
  $('#btn-mobile-paper-list').setAttribute('aria-expanded', String(panelOpen));
  $('#btn-mobile-paper-ai').setAttribute('aria-expanded', String(aiOpen));
  const toggle = $('#btn-ai-toggle');
  if (compact) {
    toggle.setAttribute('aria-controls', 'ai-panel');
    toggle.setAttribute('aria-expanded', String(aiOpen));
  } else {
    toggle.removeAttribute('aria-controls');
    toggle.removeAttribute('aria-expanded');
  }
}
function setMobilePanel(open) {
  document.body.classList.toggle('mobile-panel-open', open);
  syncMobileWorkspace();
}
function setMobileBrief(kind, open) {
  const id = kind === 'paper' ? 'btn-mobile-topic' : 'btn-mobile-outline';
  document.body.classList.toggle('mobile-' + kind + '-brief-open', open);
  $('#' + id).setAttribute('aria-expanded', String(open));
}
function setMobileAI(open, move = true) {
  if (open && document.body.classList.contains('focus-mode')) toggleFocus(false);
  document.body.classList.toggle('mobile-ai-open', open);
  syncMobileWorkspace();
  if (open && move) $('#ai-panel').scrollIntoView({ block: 'start' });
}
/* Mobile editing keys complement the system keyboard without changing the draft format. */
const MOBILE_KEY_LABELS = {
  zh: {keys:'写作键', save:'保存', quotes:'插入引号', brackets:'插入括号', dash:'插入破折号', ellipsis:'插入省略号', paragraph:'另起一段', end:'跳到文末'},
  en: {keys:'Writing keys', save:'Save', quotes:'Insert quotation marks', brackets:'Insert parentheses', dash:'Insert a dash', ellipsis:'Insert an ellipsis', paragraph:'Start a new paragraph', end:'Go to the end'},
  ru: {keys:'Клавиши', save:'Сохранить', quotes:'Вставить кавычки', brackets:'Вставить скобки', dash:'Вставить тире', ellipsis:'Вставить многоточие', paragraph:'Начать новый абзац', end:'Перейти в конец'}
};
function mobileKeyMarks(action, lang) {
  if (action === 'quotes') return lang === 'ru' ? ['«', '»'] : ['“', '”'];
  if (action === 'brackets') return lang === 'zh' ? ['（', '）'] : ['(', ')'];
  if (action === 'dash') return [lang === 'zh' ? '——' : '—', ''];
  if (action === 'ellipsis') return [lang === 'zh' ? '……' : '…', ''];
  if (action === 'paragraph') return ['\n\n', ''];
  return null;
}
function mobileEditPlan(value, start, end, action, lang) {
  const marks = mobileKeyMarks(action, lang);
  if (!marks) return null;
  const [left, right] = marks;
  const from = right ? start : end;
  const replacement = left + (right ? value.slice(start, end) : '') + right;
  return {
    from, to: end,
    replacement,
    start: from + left.length,
    end: from + left.length + (right ? end - start : 0)
  };
}
function mobileDraftLanguage(board) {
  const selected = board === 'paper' ? ($('#paper-lang')?.value || currentPaper()?.outLang) : curNovel()?.lang;
  return normalizeOutputLang(selected, state.settings.lang);
}
function syncMobileWritingKeys() {
  const labels = MOBILE_KEY_LABELS[state.settings.lang] || MOBILE_KEY_LABELS.zh;
  for (const shelf of $$('.mobile-writing-tools')) {
    const board = shelf.dataset.writingBoard;
    shelf.hidden = board !== state.board || !(board === 'paper' ? currentPaper() : curChapter());
    const lang = mobileDraftLanguage(board);
    for (const label of shelf.querySelectorAll('[data-writing-label]')) label.textContent = labels[label.dataset.writingLabel];
    shelf.querySelector('[data-writing-area]').setAttribute('aria-label', labels.keys);
    for (const btn of shelf.querySelectorAll('[data-writing-key]')) {
      const action = btn.dataset.writingKey;
      btn.title = labels[action];
      if (action !== 'save') btn.setAttribute('aria-label', labels[action]);
      if (['quotes','brackets','dash','ellipsis'].includes(action)) {
        const [left, right] = mobileKeyMarks(action, lang);
        btn.textContent = right ? left + ' ' + right : left;
      }
    }
  }
}
async function applyMobileWritingKey(board, action) {
  if (!inMobileWorkspace() || state.board !== board) return;
  const paper = board === 'paper';
  if (!(paper ? currentPaper() : curChapter())) return;
  const ed = paper ? $('#paper-editor') : $('#editor');
  if (ed.disabled || ed.readOnly) return;
  if (action === 'save') {
    const dirty = () => paper ? state.paperDirty : state.editorDirty;
    const wasDirty = dirty();
    await (paper ? savePaper(true) : saveChapter(true));
    if (state.board === board && !wasDirty && !dirty()) {
      if (state.settings.storageDenied) toast(draftNotice('memory'), 'warn');
      else toast(t(paper ? 'toast.paperSaved' : 'toast.savedOk'), 'ok', 1600);
    }
    return;
  }
  if (action === 'end') {
    ed.focus({ preventScroll:true });
    ed.setSelectionRange(ed.value.length, ed.value.length);
    ed.scrollTop = ed.scrollHeight;
    if (paper) updatePaperCounts(); else updatePos();
    return;
  }
  const {value, selectionStart, selectionEnd} = ed;
  const plan = mobileEditPlan(value, selectionStart, selectionEnd, action, mobileDraftLanguage(board));
  if (!plan) return;
  ed.focus({ preventScroll:true });
  ed.setSelectionRange(plan.from, plan.to);
  let inputFired = false;
  const noteInput = () => { inputFired = true; };
  ed.addEventListener('input', noteInput, { once:true });
  try {
    // Native insertText retains undo where supported, including touch keyboards.
    if (plan.replacement) document.execCommand?.('insertText', false, plan.replacement);
  } catch (_) { /* Some browsers don't implement insertText in textarea. */ }
  ed.removeEventListener('input', noteInput);
  if (ed.value === value) ed.setRangeText(plan.replacement, plan.from, plan.to, 'end');
  ed.setSelectionRange(plan.start, plan.end);
  if (!inputFired) ed.dispatchEvent(new Event('input', { bubbles:true }));
  else if (paper) updatePaperCounts(); else updatePos();
}
function bindMobileWritingKeys() {
  for (const shelf of $$('.mobile-writing-tools')) {
    shelf.addEventListener('mousedown', event => {
      const key = event.target.closest('[data-writing-key]');
      const ed = shelf.dataset.writingBoard === 'paper' ? $('#paper-editor') : $('#editor');
      if (key && document.activeElement === ed) event.preventDefault();
    });
    shelf.addEventListener('click', event => {
      const key = event.target.closest('[data-writing-key]');
      if (key) applyMobileWritingKey(shelf.dataset.writingBoard, key.dataset.writingKey);
    });
  }
  $('#paper-lang').addEventListener('change', syncMobileWritingKeys);
}
function setNavActive() {
  $$('#main-nav .nav-item').forEach(b => b.classList.toggle('active', b.dataset.module === state.module));
  syncMobileWorkspace();
}
function renderPanel() {
  const m = state.module;
  const body = $('#panel-body');
  if (state.board === 'paper') {
    body.innerHTML = renderPaperPanel();
    return;
  }
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
      <div><div class="char-name">${esc(c.name || t('char.unnamed'))}</div><div class="char-role">${esc(c.role || '')}</div></div>
    </div>
    <div class="char-summary">${esc((c.background || c.personality || t('char.noIntro')).slice(0, 120))}</div>
    <div class="row-actions">
      <button class="icon-btn" data-act="edit" data-id="${c.id}" data-i18n-title="lib.editTitle" title="编辑">✎</button>
      <button class="icon-btn danger" data-act="del" data-id="${c.id}" data-i18n-title="common.delete" title="删除">✕</button>
    </div>
  </div>`).join('');
}
function renderWorld() {
  const n = curNovel();
  const secs = (n.worldSections || []).map(s => `
    <div class="world-sec" data-id="${s.id}">
      <div class="world-sec-head">
        <input class="input world-sec-title" data-field="secTitle" data-id="${s.id}" value="${esc(s.title || '')}" data-i18n-ph="w.secTitlePh" placeholder="条目名称（如：力量体系 / 势力 / 时间线）" autocomplete="off" />
        <button class="icon-btn danger" data-act="delsec" data-id="${s.id}" data-i18n-title="common.delete" title="删除条目">✕</button>
      </div>
      <textarea class="input world-sec-body" data-field="secBody" data-id="${s.id}" rows="4" data-i18n-ph="w.secBodyPh" placeholder="展开设定…">${esc(s.content || '')}</textarea>
    </div>`).join('');
  const gs = novelGenres(n).map(genreName).join(' / ') || t('novel.legacyGenre');
  const refs = novelRefAuthors(n).map(id => { const a = findAuthor(id); return a ? authorName(a) : id; }).join('、');
  return `
  <div class="world-block">
    <div class="block-label">${t('w.synopsis')}</div>
    <textarea class="input" data-field="synopsis" rows="5" data-i18n-ph="w.synopsisPh" placeholder="全书主线、起承转合、结局走向…">${esc(n.synopsis || '')}</textarea>
  </div>
  <div class="world-block">
    <div class="block-label">${t('w.world')}</div>
    <textarea class="input" data-field="world" rows="7" data-i18n-ph="w.worldPh" placeholder="时代背景、地理、规则、力量体系总览…">${esc(n.world || '')}</textarea>
  </div>
  <div class="world-block">
    <div class="block-label">${t('w.styleProfile')} <button class="btn mini" data-act="editstyle">${t('w.edit')}</button></div>
    <div class="style-profile">
      <table>
        <tr><td class="sp-label">${t('w.audience')}</td><td class="sp-val">${esc(styleValName(n.audience || '通用'))}</td></tr>
        <tr><td class="sp-label">${t('w.genre')}</td><td class="sp-val">${esc(gs)}</td></tr>
        <tr><td class="sp-label">${t('w.length')}</td><td class="sp-val">${esc(styleValName(n.length || '未定'))}</td></tr>
        <tr><td class="sp-label">${t('w.pov')}</td><td class="sp-val">${esc(styleValName(n.pov || '未定'))}</td></tr>
        <tr><td class="sp-label">${t('w.tone')}</td><td class="sp-val">${esc(styleValName(n.tone || '未定'))}</td></tr>
        <tr><td class="sp-label">${t('w.lang')}</td><td class="sp-val">${n.lang === 'en' ? 'English' : (n.lang === 'ru' ? 'Русский' : '中文')}</td></tr>
        <tr><td class="sp-label">${t('style.narrative')}</td><td class="sp-val">${esc({ dialogue: t('style.dialogue'), balanced: t('style.balanced'), narrative: t('style.narrativeMode') }[n.narrative] || t('style.dialogue'))}</td></tr>
        <tr><td class="sp-label">${t('style.standard')}</td><td class="sp-val">${esc({ '通用': t('style.stGeneric'), '中国网文': t('style.stNet'), '中式传统': t('style.stTrad'), '日式轻小说': t('style.stJP'), '欧美小说': t('style.stWest'), '俄式文学': t('style.stRu') }[n.standard || '通用'] || n.standard || '通用')}</td></tr>
        <tr><td class="sp-label">${t('style.personal')}</td><td class="sp-val">${esc((n.personal || 'human') === 'human' ? t('style.perHuman') : t('style.perStandard'))}</td></tr>
        <tr><td class="sp-label">${t('w.authors')}</td><td class="sp-val">${esc(refs || '—')}</td></tr>
      </table>
    </div>
  </div>
  <div class="world-block">
    <div class="block-label">${t('w.custom')} <button class="btn mini" data-act="addsec">${t('w.addSec')}</button></div>
    ${secs || '<div class="empty-hint small">' + t('w.customEmpty') + '</div>'}
  </div>`;
}
function renderAuthorChips(n) {
  const refs = novelRefAuthors(n);
  const f = (state.authorFilter || '').toLowerCase();
  const list = allAuthors().filter(a => !f || (authorName(a) || '').toLowerCase().includes(f) || (a.name || '').toLowerCase().includes(f));
  if (!list.length) return '<span class="learn-status">' + t('vip.searchEmpty') + '</span>';
  return list.map(a => `<button class="chip mini ${refs.includes(a.id) ? 'on' : ''}" data-act="toggleauthor" data-id="${a.id}" title="${esc(authorName(a))}${a.custom ? '（' + t('au.custom') + '）' : ''}">${esc(authorName(a))}${a.custom ? ' ✦' : ''}</button>`).join('');
}
function renderAuthorChipsBox() {
  const box = $('#author-chips-box');
  const n = curNovel();
  if (!box || !n) return;
  box.innerHTML = renderAuthorChips(n);
}
function renderStylePanel() {
  const n = curNovel();
  if (!n) return '<div class="empty-hint">' + t('empty.panel') + '</div>';
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
    <div class="sp-scroll-row">
      <button class="btn mini" data-act="scrolltop" title="向上滑动">▲</button>
      <button class="btn mini" data-act="scrollbottom" title="向下滑动">▼</button>
      <span class="learn-status" data-i18n="sp.scrollHint">滑动 / 按键查看全部作家简介</span>
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
    const tipsTxt = a.custom ? (a.learned || a.tips || '') : authorTips(a);
    return `<div class="author-note-card">
      <div class="author-note-head">
        <span class="author-note-name">${esc(authorName(a))}</span>
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
  const CAT_I18N = { '全部': { en: 'All', ru: 'Все' }, '情节': { en: 'Plot', ru: 'Сюжет' }, '人物': { en: 'Character', ru: 'Персонаж' }, '伏笔': { en: 'Foreshadow', ru: 'Задел' }, '世界': { en: 'World', ru: 'Мир' }, '其他': { en: 'Other', ru: 'Другое' } };
  const catName = c => { const m = CAT_I18N[c]; return m ? (state.settings.lang === 'en' ? m.en : state.settings.lang === 'ru' ? m.ru : c) : c; };
  const active = state.memFilter || '全部';
  const shown = active === '全部' ? list : list.filter(m => m.category === active);
  const chips = cats.map(c => `<button class="chip mini ${c === active ? 'on' : ''}" data-act="memfilter" data-cat="${c}">${esc(catName(c))}</button>`).join('');
  const rows = shown.map(m => `<div class="mem-item" data-id="${m.id}">
    <span class="mem-cat" data-cat="${esc(m.category || '其他')}">${esc(catName(m.category || '其他'))}</span>
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
    case 'openpaper': if (id) selectPaper(id); break;
    case 'delpaper': if (id) delPaper(id); break;
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
    case 'scrolltop': $('#panel-body').scrollBy({ top: -$('#panel-body').clientHeight * 0.85, behavior: 'smooth' }); break;
    case 'scrollbottom': $('#panel-body').scrollBy({ top: $('#panel-body').clientHeight * 0.85, behavior: 'smooth' }); break;
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
  pendingWorldBackupSaves.set(n.id, n);
  clearTimeout(state.novelSaveTimer);
  state.novelSaveTimer = setTimeout(() => flushWorldBackupSave().catch(() => toast(t('backup.exportFail'), 'err')), 800);
}
const pendingWorldBackupSaves = new Map();
async function flushWorldBackupSave() {
  clearTimeout(state.novelSaveTimer);
  const waiting = [...pendingWorldBackupSaves.values()];
  pendingWorldBackupSaves.clear();
  await Promise.all(waiting.filter(n => state.novels.includes(n)).map(n =>
    dbPut(STORE.novels, n).catch(error => { pendingWorldBackupSaves.set(n.id, n); throw error; })));
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
const FOCUS_MANAGED_MODALS = {
  'modal-chapter-coach': () => $('#btn-chapter-coach'),
  'modal-draft-history': () => $(state.board === 'paper' ? '#btn-paper-history' : '#btn-chapter-history'),
  'modal-install-app': () => $('#btn-settings')
};
const modalReturnFocus = new WeakMap();
function modalCanFocus(el) {
  return !!el && el !== document.body && !el.disabled && !el.closest('[hidden],[inert]') && el.getClientRects().length > 0;
}
function modalTabStops(overlay) {
  return [...overlay.querySelectorAll('button,a[href],input,textarea,select,summary,[tabindex]')]
    .filter(el => el.tabIndex >= 0 && modalCanFocus(el));
}
function openModal(id) {
  const overlay = $('#' + id);
  if (Object.hasOwn(FOCUS_MANAGED_MODALS, id) && overlay.hidden) {
    modalReturnFocus.set(overlay, document.activeElement);
    queueMicrotask(() => {
      if (!overlay.hidden && !overlay.contains(document.activeElement)) {
        modalTabStops(overlay)[0]?.focus({ preventScroll:true });
      }
    });
  }
  overlay.hidden = false;
}
function closeModal(id) {
  const overlay = $('#' + id);
  overlay.hidden = true;
  if (!Object.hasOwn(FOCUS_MANAGED_MODALS, id) || !modalReturnFocus.has(overlay)) return;
  const opener = modalReturnFocus.get(overlay);
  modalReturnFocus.delete(overlay);
  const target = modalCanFocus(opener) ? opener : FOCUS_MANAGED_MODALS[id]();
  if (modalCanFocus(target)) target.focus({ preventScroll:true });
}
function handleManagedModalKeys(event) {
  if (event.isComposing || event.defaultPrevented || !['Escape', 'Tab'].includes(event.key)) return false;
  // A native dialog such as Quick Start remains responsible for its own keyboard events.
  if ($('dialog[open]') || !$('#modal-confirm').hidden) return false;
  const visible = $$('.modal-overlay:not([hidden])');
  const overlay = visible.at(-1);
  if (!overlay || ['modal-terms', 'modal-storage'].includes(overlay.id)) return false;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeModal(overlay.id);
    return true;
  }
  if (!Object.hasOwn(FOCUS_MANAGED_MODALS, overlay.id)) return false;
  const stops = modalTabStops(overlay);
  const here = stops.indexOf(document.activeElement);
  if (here < 0 || (event.shiftKey ? here === 0 : here === stops.length - 1)) {
    event.preventDefault();
    (event.shiftKey ? stops.at(-1) : stops[0])?.focus({ preventScroll:true });
    return true;
  }
  return false;
}
function confirmDialog(text) {
  return new Promise(res => {
    state.confirmResolve = res;
    $('#confirm-text').textContent = text;
    openModal('modal-confirm');
  });
}

/* ---------------- 安装与离线工作区 ---------------- */
const INSTALL_COPY = {
  zh: {title:'安装到设备', help:'打开浏览器菜单，寻找「安装应用」或「添加到主屏幕」。如果当前浏览器没有这个选项，仍可在网页上写作。', installed:'晓星已在独立应用窗口运行。', offline:'第一次在线打开后，离线也能写作和管理本机稿件。AI、联网查文献和词典需要网络。'},
  en: {title:'Install on device', help:'Open your browser menu and look for “Install app” or “Add to Home Screen”. If unavailable, you can keep writing in the browser.', installed:'Xiaoxing is already running in an app window.', offline:'After a first online visit, write and manage local drafts offline. AI, source search and the online dictionary need a connection.'},
  ru: {title:'Установить на устройство', help:'Откройте меню браузера и найдите «Установить приложение» или «Добавить на главный экран». Если такого пункта нет, продолжайте писать в браузере.', installed:'Сяосин уже открыт в отдельном окне приложения.', offline:'После первого посещения с интернетом можно писать и работать с локальными черновиками офлайн. ИИ, поиск источников и словарь требуют подключения.'}
};
let installEvent = null;
const installCopy = () => INSTALL_COPY[state.settings.lang] || INSTALL_COPY.zh;
function applyInstallLabels() {
  $('#set-install-app').textContent = '↓ ' + installCopy().title;
}
async function openInstallApp() {
  closeModal('modal-settings');
  if (installEvent) {
    const prompt = installEvent;
    installEvent = null;
    try { await prompt.prompt(); return; }
    catch (_) { /* A browser may revoke the install prompt; show manual steps. */ }
  }
  const copy = installCopy();
  $('#install-app-title').textContent = copy.title;
  $('#install-app-help').textContent = (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) ? copy.installed : copy.help;
  $('#install-app-offline').textContent = copy.offline;
  openModal('modal-install-app');
}
function setupInstallApp() {
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installEvent = event; });
  window.addEventListener('appinstalled', () => { installEvent = null; });
  if (window.isSecureContext && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

/* ---------------- 当前小说：全文查找 ---------------- */
const MANUSCRIPT_SEARCH = {
  zh: {
    title:'全文查找', query:'查找文字', placeholder:'输入人物、地点或一句台词…', scope:'查找范围', all:'全部',
    fields:{title:'章节标题',content:'正文',outline:'章节大纲'}, close:'关闭',
    hint:'只搜索这本小说；查询和稿件都不发送到网络。', empty:'输入文字，立即查找匹配片段。',
    none:'没有找到匹配。试试较短的词，或切换到「全部」。',
    count:'找到 {n} 处匹配', limit:'仅显示前 {n} 处匹配，请缩小范围。',
    chapter:'第 {n} 章', keyhelp:'↓ 进入结果，Enter 跳转，Esc 关闭。'
  },
  en: {
    title:'Find in manuscript', query:'Search text', placeholder:'Enter a name, place, or line of dialogue…', scope:'Search in', all:'All fields',
    fields:{title:'Chapter title',content:'Manuscript',outline:'Chapter outline'}, close:'Close',
    hint:'Searches only this novel. Nothing is sent over the network.', empty:'Type some text to find matching passages.',
    none:'No matches. Try a shorter phrase or search all fields.',
    count:'{n} matches found', limit:'Showing the first {n} matches. Narrow your search for more.',
    chapter:'Chapter {n}', keyhelp:'↓ moves to results, Enter jumps, Esc closes.'
  },
  ru: {
    title:'Поиск по рукописи', query:'Поисковый запрос', placeholder:'Имя, место или фраза из диалога…', scope:'Область поиска', all:'Везде',
    fields:{title:'Название главы',content:'Рукопись',outline:'План главы'}, close:'Закрыть',
    hint:'Поиск только в этом романе. Данные не отправляются по сети.', empty:'Введите слово или фразу, чтобы найти нужный фрагмент.',
    none:'Совпадений нет. Попробуйте более короткую фразу или поиск везде.',
    count:'Результаты: {n}', limit:'Показаны первые {n} результатов. Уточните запрос.',
    chapter:'Глава {n}', keyhelp:'↓ к результатам, Enter для перехода, Esc для закрытия.'
  }
};
const manuscriptCopy = () => MANUSCRIPT_SEARCH[state.settings.lang] || MANUSCRIPT_SEARCH.zh;
const manuscriptFields = ['title', 'content', 'outline'];
const manuscriptSearchLimit = 80;
let manuscriptMatches = [];
let manuscriptNovelId = null;
let manuscriptTimer;
let manuscriptJumped = false;

function manuscriptPattern(query) {
  // Match literal text and retain offsets into the original textarea value.
  return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
}
function findManuscriptMatches(chapters, query, scope = 'all', limit = manuscriptSearchLimit) {
  const needle = String(query || '').trim().slice(0, 120);
  const hits = [];
  if (!needle) return { hits, limited: false };
  const pattern = manuscriptPattern(needle);
  const fields = manuscriptFields.includes(scope) ? [scope] : manuscriptFields;
  for (const [index, chapter] of chapters.entries()) {
    for (const field of fields) {
      const source = typeof chapter[field] === 'string' ? chapter[field] : '';
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(source))) {
        if (hits.length >= limit) return { hits, limited: true };
        const start = match.index, end = start + match[0].length;
        let left = Math.max(0, start - 44);
        let right = Math.min(source.length, end + 84);
        // Do not cut surrogate pairs at excerpt boundaries.
        if (left > 0 && /[\uDC00-\uDFFF]/.test(source[left])) left--;
        if (right < source.length && /[\uDC00-\uDFFF]/.test(source[right])) right++;
        hits.push({
          id: chapter.id, title: chapter.title, index, field, start, end, matched: match[0],
          before: (left > 0 ? '…' : '') + source.slice(left, start),
          after: source.slice(end, right) + (right < source.length ? '…' : '')
        });
      }
    }
  }
  return { hits, limited: false };
}
function searchableManuscript(id) {
  const active = curChapter();
  return chaptersOf(id).map(chapter => {
    const pending = pendingDrafts.get(recoveryId(STORE.chapters, chapter.id))?.delta;
    const row = pending ? { ...chapter, ...pending } : chapter;
    return active?.id === chapter.id ? { ...row, title: $('#chapter-title').value,
      content: $('#editor').value, outline: $('#chapter-outline').value } : row;
  });
}
function applyManuscriptLabels() {
  const c = manuscriptCopy();
  const labels = {
    'btn-manuscript-search':'title', 'manuscript-title':'title', 'manuscript-query-label':'query',
    'manuscript-scope-label':'scope', 'manuscript-local':'hint', 'manuscript-keys':'keyhelp'
  };
  for (const [id, key] of Object.entries(labels)) $('#' + id).textContent = c[key];
  $('#manuscript-query').placeholder = c.placeholder;
  $('#manuscript-close').setAttribute('aria-label', c.close);
  for (const option of $('#manuscript-scope').options) option.textContent = c.fields[option.value] || c.all;
}
function renderManuscriptResults() {
  const c = manuscriptCopy();
  const input = $('#manuscript-query'), list = $('#manuscript-results');
  const query = input.value.trim();
  const { hits, limited } = findManuscriptMatches(searchableManuscript(manuscriptNovelId), query, $('#manuscript-scope').value);
  manuscriptMatches = hits;
  $('#manuscript-status').textContent = !query ? c.empty : !hits.length ? c.none
    : (limited ? c.limit : c.count).replace('{n}', String(hits.length));
  const frag = document.createDocumentFragment();
  hits.forEach((hit, i) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    const heading = document.createElement('span');
    const field = document.createElement('span');
    const excerpt = document.createElement('span');
    const mark = document.createElement('mark');
    button.type = 'button';
    button.className = 'manuscript-hit';
    button.dataset.hit = String(i);
    heading.className = 'manuscript-hit-heading';
    field.className = 'manuscript-hit-field';
    excerpt.className = 'manuscript-hit-text';
    const chapterName = c.chapter.replace('{n}', String(hit.index + 1));
    heading.textContent = hit.title && hit.title !== chapterName ? chapterName + ' · ' + hit.title : chapterName;
    field.textContent = c.fields[hit.field];
    mark.textContent = hit.matched;
    excerpt.append(hit.before, mark, hit.after);
    button.append(heading, field, excerpt);
    li.append(button);
    frag.append(li);
  });
  list.replaceChildren(frag);
  list.scrollTop = 0;
}
function scheduleManuscriptSearch() {
  clearTimeout(manuscriptTimer);
  manuscriptTimer = setTimeout(renderManuscriptResults, 90);
}
function openManuscriptSearch() {
  if (state.board !== 'novel' || !curNovel()) return;
  const dialog = $('#modal-manuscript-search');
  const input = $('#manuscript-query');
  if (manuscriptNovelId !== state.currentNovelId) {
    manuscriptNovelId = state.currentNovelId;
    input.value = '';
    $('#manuscript-scope').value = 'all';
  }
  manuscriptJumped = false;
  applyManuscriptLabels();
  renderManuscriptResults();
  if (!dialog.open) dialog.showModal();
  input.focus();
  input.select();
}
function revealManuscriptSelection(field, start) {
  if (field.tagName !== 'TEXTAREA') return;
  const css = getComputedStyle(field);
  if (field.value.length > 350000 || !field.clientWidth) {
    field.scrollTop = field.scrollHeight * start / Math.max(1, field.value.length) - field.clientHeight / 3;
    return;
  }
  const mirror = document.createElement('div');
  const sentinel = document.createElement('span');
  mirror.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;';
  for (const key of ['font', 'lineHeight', 'letterSpacing', 'tabSize', 'textIndent', 'padding']) mirror.style[key] = css[key];
  mirror.style.width = field.clientWidth + 'px';
  mirror.append(field.value.slice(0, start), sentinel);
  sentinel.textContent = '\u200b';
  document.body.append(mirror);
  const top = sentinel.getBoundingClientRect().top - mirror.getBoundingClientRect().top;
  mirror.remove();
  field.scrollTop = Math.max(0, top - field.clientHeight / 3);
}
function jumpToManuscriptMatch(index) {
  const hit = manuscriptMatches[index];
  if (!hit || state.board !== 'novel' || state.currentNovelId !== manuscriptNovelId ||
      !chaptersOf(manuscriptNovelId).some(c => c.id === hit.id)) return;
  const dialog = $('#modal-manuscript-search');
  const query = $('#manuscript-query').value.trim().slice(0, 120);
  manuscriptJumped = true;
  dialog.close();
  document.activeElement?.blur?.();
  selectChapter(hit.id);
  if (inMobileWorkspace()) setMobilePanel(false);
  if (hit.field === 'outline') setMobileBrief('novel', true);
  const field = $(({title:'#chapter-title',content:'#editor',outline:'#chapter-outline'})[hit.field]);
  field.focus({ preventScroll:true });
  if (query) {
    const pattern = manuscriptPattern(query);
    pattern.lastIndex = hit.start;
    const match = pattern.exec(field.value) || manuscriptPattern(query).exec(field.value);
    if (match) {
      field.setSelectionRange(match.index, match.index + match[0].length);
      revealManuscriptSelection(field, match.index);
    }
  }
  field.scrollIntoView({ block: 'nearest' });
  if (hit.field === 'content') updatePos();
}
function bindManuscriptSearch() {
  const dialog = $('#modal-manuscript-search'), input = $('#manuscript-query'), results = $('#manuscript-results');
  $('#btn-manuscript-search').addEventListener('click', openManuscriptSearch);
  $('#manuscript-close').addEventListener('click', () => dialog.close());
  $('#manuscript-scope').addEventListener('change', renderManuscriptResults);
  input.addEventListener('input', e => { if (!e.isComposing) scheduleManuscriptSearch(); });
  input.addEventListener('compositionend', scheduleManuscriptSearch);
  dialog.addEventListener('close', () => {
    clearTimeout(manuscriptTimer);
    if (!manuscriptJumped) $('#btn-manuscript-search').focus();
  });
  results.addEventListener('click', e => {
    const button = e.target.closest('button[data-hit]');
    if (button) jumpToManuscriptMatch(Number(button.dataset.hit));
  });
  dialog.addEventListener('keydown', e => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.target === input && ['Enter', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      clearTimeout(manuscriptTimer);
      renderManuscriptResults();
      if (e.key === 'Enter') jumpToManuscriptMatch(0);
      else results.querySelector('button')?.focus();
      return;
    }
    const button = e.target.closest('button[data-hit]');
    if (!button || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const next = e.key === 'ArrowDown' ? button.parentElement.nextElementSibling : button.parentElement.previousElementSibling;
    if (next) next.querySelector('button')?.focus();
    else if (e.key === 'ArrowUp') input.focus();
  });
}

/* ---------------- 章节构思卡 ---------------- */
const CHAPTER_COACH = {
  zh: {
    open: '构思这一章', heading: '写出第一场戏', sub: '先写一两句就行。下面的卡片会把想法整理成本章大纲，你也可以直接手写。',
    example: '示例题材', exampleTip: '点题材切换提示词；示例不会填进正文。',
    fields: ['场景：谁，在哪里？', '目标：人物想得到什么？', '阻碍：为什么没那么容易？', '转折：这场戏结束时变了什么？'],
    mystery: ['旧车站即将关门，值夜员收到一封没署名的信。', '找出信是写给谁的。', '车站监控跳过了关键的十分钟。', '他认出信上的字是自己写的。'],
    adventure: ['两名旅人终于抵达地图上的冰河渡口。', '在天黑前把药品送到对岸。', '渡船不见了，冰面开始开裂。', '他们发现岸边有人提前埋了绳索。'],
    relationship: ['多年未见的两人在一家即将关门的书店相遇。', '主角想说清当年没有告别的原因。', '对方似乎把那段往事记成了另一个样子。', '书页里掉出一张当年的电影票。'],
    sci: ['潮汐观测员在凌晨收到一条来自明天的广播。', '确认声音来自哪里。', '设备记录显示广播是由她本人发送的。', '广播最后说，别打开窗。'],
    genres: ['悬疑', '冒险', '人物关系', '科幻'], ready: '{n}/4 项已填', use: '添加到本章大纲', add: '自己的想法会加在原大纲后，正文不会被改动。', done: '构思已加入本章大纲。你可以继续手写，也可以使用 AI。', close: '关闭'
  },
  en: {
    open: 'Plan this chapter', heading: 'Build your first scene', sub: 'Start with a sentence or two. This card turns your ideas into a chapter outline. You can also write it by hand.',
    example: 'Example genre', exampleTip: 'Change the genre to see different prompts. Examples are not added to your manuscript.',
    fields: ['Scene: who is where?', 'Goal: what do they want?', 'Obstacle: what makes it hard?', 'Turn: what changes by the end?'],
    mystery: ['A night attendant receives an unsigned letter at a closing train station.', 'Find out who the letter is meant for.', 'The station camera skips the key ten minutes.', 'The attendant recognizes their own handwriting.'],
    adventure: ['Two travelers arrive at the ice crossing marked on their map.', 'Get the medicine across before dark.', 'The ferry is missing and the ice has begun to crack.', 'Someone has left a rope hidden on the bank.'],
    relationship: ['Two people meet again after years in a bookstore about to close.', 'Explain why they left without saying goodbye.', 'The other person remembers that day differently.', 'An old movie ticket falls from a book.'],
    sci: ['A tide observer hears a broadcast sent from tomorrow.', 'Find out who sent it.', 'The records suggest she sent it herself.', 'The voice tells her not to open the window.'],
    genres: ['Mystery', 'Adventure', 'Relationships', 'Science fiction'], ready: '{n}/4 filled', use: 'Add to chapter outline', add: 'Your ideas are appended to the existing outline. The manuscript is unchanged.', done: 'Added to the outline. Keep writing by hand or use AI when ready.', close: 'Close'
  },
  ru: {
    open: 'План главы', heading: 'Начните с первой сцены', sub: 'Достаточно одной или двух фраз. Карточка соберёт идеи в план главы; план также можно написать вручную.',
    example: 'Пример жанра', exampleTip: 'Выберите жанр, чтобы сменить подсказки. Примеры не добавляются в рукопись.',
    fields: ['Сцена: кто и где?', 'Цель: чего хочет герой?', 'Препятствие: что ему мешает?', 'Поворот: что изменится к концу сцены?'],
    mystery: ['Дежурный получает письмо без подписи перед закрытием станции.', 'Выяснить, кому адресовано письмо.', 'На записи с камеры нет нужных десяти минут.', 'Дежурный узнаёт свой почерк.'],
    adventure: ['Два путника приходят к ледовой переправе.', 'Доставить лекарство на другой берег до темноты.', 'Парома нет, а лёд начинает трескаться.', 'На берегу кто-то заранее оставил верёвку.'],
    relationship: ['Двое встречаются спустя годы в книжном магазине перед закрытием.', 'Объяснить, почему в прошлый раз никто не попрощался.', 'Другой человек помнит тот день иначе.', 'Из книги выпадает старый билет в кино.'],
    sci: ['Наблюдательница приливов слышит радиосообщение из завтрашнего дня.', 'Выяснить, кто его отправил.', 'По данным станции его отправила она сама.', 'Голос просит её не открывать окно.'],
    genres: ['Детектив', 'Приключения', 'Отношения', 'Научная фантастика'], ready: 'Заполнено {n}/4', use: 'Добавить в план главы', add: 'Идеи добавятся к существующему плану. Текст рукописи не изменится.', done: 'Идеи добавлены в план. Продолжите сами или воспользуйтесь ИИ.', close: 'Закрыть'
  }
};
const coachCopy = () => CHAPTER_COACH[state.settings.lang] || CHAPTER_COACH.zh;
const coachGenres = ['mystery', 'adventure', 'relationship', 'sci'];
let coachChapter = null;
function coachValues() {
  return [0, 1, 2, 3].map(i => $('#chapter-coach-' + i).value.trim());
}
function chapterCoachPlan(values, lang) {
  const labels = (CHAPTER_COACH[lang] || CHAPTER_COACH.zh).fields;
  return values.map((value, i) => value ? labels[i] + ' ' + value : '').filter(Boolean).join('\n');
}
function syncCoachProgress() {
  const n = coachValues().filter(Boolean).length;
  $('#chapter-coach-progress').textContent = coachCopy().ready.replace('{n}', n);
  $('#chapter-coach-add').disabled = !n;
}
function updateCoachExample() {
  const c = coachCopy();
  const key = $('#chapter-coach-example').value;
  const values = c[coachGenres.includes(key) ? key : coachGenres[0]];
  values.forEach((value, i) => { $('#chapter-coach-' + i).placeholder = value; });
}
function applyCoachLabels() {
  const c = coachCopy();
  const map = { 'btn-chapter-coach':'open', 'chapter-coach-title':'heading', 'chapter-coach-sub':'sub', 'chapter-coach-example-label':'example', 'chapter-coach-example-tip':'exampleTip', 'chapter-coach-add':'use', 'chapter-coach-footnote':'add' };
  for (const [id, key] of Object.entries(map)) $('#' + id).textContent = c[key];
  $('#chapter-coach-close').setAttribute('aria-label', c.close);
  c.fields.forEach((value, i) => { $('#chapter-coach-label-' + i).textContent = value; });
  [...$('#chapter-coach-example').options].forEach((option, i) => { option.textContent = c.genres[i]; });
  updateCoachExample();
  syncCoachProgress();
}
function openChapterCoach() {
  if (state.genState.running) return toast(historyCopy().busy, 'warn');
  const chapter = curChapter();
  if (state.board !== 'novel' || !chapter) return toast(t('toast.needChapter'), 'warn');
  if (coachChapter !== chapter.id) {
    coachChapter = chapter.id;
    for (let i = 0; i < 4; i++) $('#chapter-coach-' + i).value = '';
  }
  applyCoachLabels();
  openModal('modal-chapter-coach');
  $('#chapter-coach-0').focus();
}
function applyChapterCoach() {
  if (state.board !== 'novel' || curChapter()?.id !== coachChapter || state.genState.running) return;
  const values = coachValues();
  const plan = chapterCoachPlan(values, state.settings.lang);
  if (!plan) return;
  const outline = $('#chapter-outline');
  outline.value = [outline.value.trimEnd(), plan].filter(Boolean).join('\n\n');
  scheduleSave();
  for (let i = 0; i < 4; i++) $('#chapter-coach-' + i).value = '';
  closeModal('modal-chapter-coach');
  setMobileBrief('novel', true);
  outline.focus();
  toast(coachCopy().done, 'ok', 4500);
}

/* ---------------- 版本历史 ---------------- */
const HISTORY_COPY = {
  zh: { button: '🕘 历史记录', empty: '还没有旧版本。继续编辑和保存后，旧稿会出现在这里。', help: '预览早前保存的稿件。恢复时会先保留当前稿。最多保留 50 个旧版本；连续编辑会合并，过大的旧稿可能不保留。', restore: '恢复选中版本', restored: '已恢复旧版本；恢复前的稿件仍在版本历史中。', pick: '请选择版本', preview: '旧稿预览', busy: '请先停止 AI 创作，再查看或恢复旧稿。' },
  en: { button: '🕘 History', empty: 'No earlier versions yet. Older drafts will appear after more edits are saved.', help: 'Preview a saved draft. Restoring preserves your current version first. Up to 50 earlier versions are kept; rapid edits are grouped and very large drafts may be omitted.', restore: 'Restore selected version', restored: 'Version restored. Your previous draft remains in history.', pick: 'Choose a version', preview: 'Version preview', busy: 'Stop AI generation before viewing or restoring an earlier draft.' },
  ru: { button: '🕘 История', empty: 'Предыдущих версий пока нет. Они появятся после сохранения следующих правок.', help: 'Просмотрите сохранённый черновик. Перед восстановлением сохраняется текущая версия. Хранятся до 50 версий; частые изменения объединяются, а очень большие черновики могут быть пропущены.', restore: 'Восстановить выбранную версию', restored: 'Версия восстановлена. Предыдущий черновик остался в истории.', pick: 'Выберите версию', preview: 'Просмотр версии', busy: 'Остановите генерацию, прежде чем просматривать или восстанавливать черновик.' }
};
const historyCopy = () => HISTORY_COPY[state.settings.lang] || HISTORY_COPY.zh;
let historySelection = null;
function applyHistoryLabels() {
  const c = historyCopy();
  for (const id of ['#btn-chapter-history', '#btn-paper-history', '#draft-history-title']) $(id).textContent = c.button;
  $('#draft-history-help').textContent = c.help;
  $('#draft-history-restore').textContent = c.restore;
  $('#draft-history-list').setAttribute('aria-label', c.pick);
  $('#draft-history-preview').setAttribute('aria-label', c.preview);
}
function previewDraftHistory() {
  const i = $('#draft-history-list').selectedIndex;
  const item = historySelection?.entries[i];
  $('#draft-history-preview').value = item ? [item.title, item.outline || item.topic, item.content].filter(Boolean).join('\n\n') : historyCopy().empty;
  $('#draft-history-restore').disabled = !item;
}
async function openDraftHistory(paper) {
  if (state.genState.running) return toast(historyCopy().busy, 'warn');
  await (paper ? flushPaperSave() : flushSave());
  const record = paper ? currentPaper() : curChapter();
  if (!record) return;
  const store = paper ? STORE.papers : STORE.chapters;
  let latest = record;
  if (!state.settings.storageDenied) {
    try { latest = (await dbGet(store, record.id)) || record; }
    catch (e) { return toast(draftNotice('failed'), 'err'); }
  }
  const entries = !Array.isArray(latest.history) ? [] : latest.history.filter(item =>
    item && typeof item.id === 'string' && Number.isFinite(item.at)).slice(-HISTORY_LIMIT).reverse();
  historySelection = { paper, id: record.id, entries };
  applyHistoryLabels();
  const list = $('#draft-history-list');
  list.replaceChildren();
  for (const item of entries) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = new Date(item.at).toLocaleString(({zh:'zh-CN', en:'en', ru:'ru'})[state.settings.lang]) +
      (item.title ? ' · ' + item.title.slice(0, 72) : '');
    list.append(option);
  }
  list.disabled = !entries.length;
  previewDraftHistory();
  openModal('modal-draft-history');
  (entries.length ? list : $('#draft-history-close')).focus();
}
async function restoreDraftHistory() {
  const context = historySelection;
  const item = context?.entries[$('#draft-history-list').selectedIndex];
  if (!item || state.genState.running) return;
  const current = () => context.paper ? currentPaper() : curChapter();
  const flush = context.paper ? flushPaperSave : flushSave;
  await flush();
  const record = current();
  if (!record || record.id !== context.id || (context.paper ? state.paperDirty : state.editorDirty)) return;
  const button = $('#draft-history-restore');
  button.disabled = true;
  const delta = { ...draftVersionFields(item), wordCount: countWords(item.content || '') };
  const result = await persistDraft(context.paper ? STORE.papers : STORE.chapters, record, delta, false, { checkpoint: true });
  if (!result) { previewDraftHistory(); return; }
  closeModal('modal-draft-history');
  if (current()?.id === result.saved.id) {
    // A button can lose focus on modal close; blur explicitly before loading restored fields.
    document.activeElement?.blur?.();
    renderEditor();
  }
  if (!result.conflict && !result.memory) toast(historyCopy().restored, 'ok');
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
  // 俄语词典（西里尔字母 → 维基词典 REST，含书面与口语词汇）
  if (/[\u0400-\u04FF]/.test(word)) {
    try {
      const r = await fetch('https://en.wiktionary.org/api/rest_v1/page/definition/' + encodeURIComponent(word), { signal: AbortSignal.timeout(12000) });
      if (r.ok) {
        const j = await r.json();
        const langEntries = (j && (j.ru || j.Russian)) || [];
        if (langEntries.length) {
          const meanings = langEntries.slice(0, 4).map(m => {
            const defs = (m.definitions || []).slice(0, 4).map(d => `<div class="dict-def">${esc(d.definition)}</div>`).join('');
            return `<div class="dict-meaning"><span class="dict-pos">${esc(m.partOfSpeech || '')}</span>${defs}</div>`;
          }).join('');
          box.innerHTML = `<div class="dict-word"><b>${esc(word)}</b></div><div class="dict-meanings">${meanings}</div><div class="dict-source">${t('dict.src')}</div>`;
        } else {
          box.innerHTML = '<div class="dict-empty">' + t('dict.notfound') + '</div>';
        }
      } else {
        box.innerHTML = '<div class="dict-empty">' + t('dict.notfound') + '</div>';
      }
    } catch (e) {
      box.innerHTML = '<div class="dict-empty">' + t('dict.errNet') + '</div>';
    }
    box.scrollTop = 0;
    return;
  }
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
  if (state.board === 'paper') {
    await flushPaperSave();
    const p = currentPaper();
    if (!p) return toast(t('p.needOpen'), 'warn');
    const title = state.paperDirty ? $('#paper-title').value.trim() : p.title;
    const text = state.paperDirty ? $('#paper-editor').value : (p.content || '');
    const display = title || t('novel.pending');
    download(display + '.txt', display + '\n\n' + text);
    return toast(t('toast.txtOk'), 'ok');
  }
  await flushSave();
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
/* ---------------- 可编辑 Word 文档 ---------------- */
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOCX_COPY = {
  zh: ['导出 Word 文档', '下载可继续编辑的小说或论文（.docx）', '下载 Word', 'Word 文档已导出', 'Word 导出失败，请重试。'],
  en: ['Export Word document', 'Download an editable novel or paper (.docx)', 'Download Word', 'Word document exported', 'Word export failed. Please retry.'],
  ru: ['Экспорт в Word', 'Скачайте редактируемый роман или статью (.docx)', 'Скачать Word', 'Документ Word экспортирован', 'Не удалось экспортировать в Word. Повторите попытку.']
};
const docxCopy = () => DOCX_COPY[state.settings.lang] || DOCX_COPY.zh;
function applyDocxLabels() {
  ['#docx-title', '#docx-desc', '#btn-export-docx'].forEach((id, i) => { $(id).textContent = docxCopy()[i]; });
}
function docxXml(text) {
  return String(text ?? '').replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '\uFFFD')
    .replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
}
const ZIP_CRC = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let i = 0; i < 8; i++) value = (value & 1) ? 0xEDB88320 ^ (value >>> 1) : value >>> 1;
  return value;
});
function zipStored(parts) {
  const enc = new TextEncoder(), files = [], directory = [];
  const footer = new Uint8Array(22), end = new DataView(footer.buffer);
  let offset = 0, dirSize = 0;
  for (const [path, text] of Object.entries(parts)) {
    const name = enc.encode(path), body = enc.encode(text);
    let crc = 0xFFFFFFFF;
    for (const byte of body) crc = ZIP_CRC[(crc ^ byte) & 255] ^ (crc >>> 8);
    crc = (crc ^ 0xFFFFFFFF) >>> 0;
    const local = new Uint8Array(30 + name.length), l = new DataView(local.buffer);
    l.setUint32(0, 0x04034B50, true); l.setUint16(4, 20, true);
    l.setUint16(12, 0x21, true);
    l.setUint32(14, crc, true); l.setUint32(18, body.length, true); l.setUint32(22, body.length, true);
    l.setUint16(26, name.length, true); local.set(name, 30);
    const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer);
    c.setUint32(0, 0x02014B50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
    c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, body.length, true); c.setUint32(24, body.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, offset, true); central.set(name, 46);
    files.push(local, body); directory.push(central);
    offset += local.length + body.length; dirSize += central.length;
  }
  end.setUint32(0, 0x06054B50, true);
  end.setUint16(8, directory.length, true); end.setUint16(10, directory.length, true);
  end.setUint32(12, dirSize, true); end.setUint32(16, offset, true);
  return [...files, ...directory, footer];
}
function makeWordPackage(title, chapters, lang) {
  const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const rel = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const office = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const tag = ({zh:'zh-CN',en:'en-US',ru:'ru-RU'})[normalizeOutputLang(lang)];
  const paragraph = (value, style) => {
    const bits = String(value ?? '').split('\t').map(x => '<w:t xml:space="preserve">' + docxXml(x) + '</w:t>');
    return '<w:p>' + (style ? '<w:pPr><w:pStyle w:val="' + style + '"/></w:pPr>' : '') +
      '<w:r>' + bits.join('<w:tab/>') + '</w:r></w:p>';
  };
  const contents = [paragraph(title,'Title')];
  for (const chapter of chapters) {
    if (chapter.title) contents.push(paragraph(chapter.title,'Heading1'));
    for (const line of String(chapter.content || '').split(/\r\n?|\n/)) contents.push(paragraph(line, ''));
  }
  return zipStored({
    '[Content_Types].xml': head + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    '_rels/.rels': head + '<Relationships xmlns="' + rel + '"><Relationship Id="rId1" Type="' + office + 'officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': head + '<w:document xmlns:w="' + w + '"><w:body>' + contents.join('') + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1400" w:bottom="1440" w:left="1400" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>',
    'word/_rels/document.xml.rels': head + '<Relationships xmlns="' + rel + '"><Relationship Id="rId1" Type="' + office + 'styles" Target="styles.xml"/></Relationships>',
    'word/styles.xml': head + '<w:styles xmlns:w="' + w + '"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Microsoft YaHei"/><w:sz w:val="24"/><w:lang w:val="' + tag + '" w:eastAsia="zh-CN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="340" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:keepNext/><w:spacing w:after="260"/></w:pPr><w:rPr><w:b/><w:sz w:val="42"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="100"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style></w:styles>'
  });
}
async function exportWord() {
  const paper = state.board === 'paper';
  try {
    await (paper ? flushPaperSave() : flushSave());
    const current = paper ? currentPaper() : curNovel();
    if (!current) return toast(t(paper ? 'p.needOpen' : 'toast.needNovelSel'), 'warn');
    const view = (store, item) => ({ ...item, ...pendingDrafts.get(recoveryId(store, item.id))?.delta });
    const doc = paper ? view(STORE.papers, current) : current;
    const sections = paper ? [{content:doc.content}] : chaptersOf(current.id).map(c => view(STORE.chapters,c));
    if (!sections.length) return toast(t('toast.noChapters'), 'warn');
    const title = doc.title || t('novel.pending');
    const safeName = title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0,100) || 'xiaoxing';
    const url = URL.createObjectURL(new Blob(makeWordPackage(title, sections, doc.outLang || doc.lang), { type:DOCX_TYPE }));
    const link = document.createElement('a');
    link.href = url; link.download = safeName + '.docx'; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast(docxCopy()[3], 'ok');
  } catch (_) { toast(docxCopy()[4], 'err'); }
}

function backupObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
const BACKUP_STORES = Object.values(STORE);
const BACKUP_FORMAT = 'xiaoxing-backup';
const BACKUP_SCHEMA = 1;
function backupStoreLabel(key) {
  const names = {
    novels: ['小说','novels','романов'], chapters: ['章节','chapters','глав'],
    papers: ['论文','papers','статей'], outline: ['大纲节点','outline nodes','пунктов плана'],
    characters: ['角色','characters','персонажей'], memories: ['记忆','memories','заметок'],
    chats: ['对话','chats','диалогов']
  };
  return names[key][({zh:0,en:1,ru:2})[state.settings.lang] ?? 0];
}
function backupText(r, keys, path, target = {}) {
  for (const key of keys) {
    if (r[key] == null) continue;
    if (typeof r[key] !== 'string') throw new Error(path + '.' + key);
    target[key] = r[key];
  }
  return target;
}
function backupNumbers(r, keys, path, target) {
  for (const key of keys) {
    if (r[key] == null) continue;
    if (!Number.isFinite(r[key])) throw new Error(path + '.' + key);
    target[key] = r[key];
  }
}
function buildBackupCopies(raw, makeId = uid) {
  if (!backupObject(raw) || (raw.format !== undefined && raw.format !== BACKUP_FORMAT) ||
      (raw.schemaVersion !== undefined && raw.schemaVersion !== BACKUP_SCHEMA) ||
      (!Array.isArray(raw.novels) && !Array.isArray(raw.papers))) throw new Error(t('backup.invalid'));
  const source = {};
  const mapped = {};
  const ids = {};
  for (const key of BACKUP_STORES) {
    source[key] = raw[key] === undefined ? [] : raw[key];
    if (!Array.isArray(source[key])) throw new Error(key);
    mapped[key] = [];
    ids[key] = new Map();
    source[key].forEach((r, i) => {
      if (!backupObject(r) || typeof r.id !== 'string' || !r.id.trim() ||
          r.id.length > 256 || ids[key].has(r.id)) throw new Error(key + '[' + i + '].id');
      ids[key].set(r.id, makeId());
    });
  }
  if (!source.novels.length && !source.papers.length) throw new Error(t('backup.empty'));
  const outlineById = new Map(source.outline.map(o => [o.id, o]));
  const fields = {
    novels: ['title','description','audience','genre','length','pov','tone','narrative','standard','personal',
      'styleMode','styleSample','synopsis','world'], chapters: ['title','content','outline'],
    papers: ['title','topic','content'], outline: ['title','note'],
    characters: ['name','role','appearance','personality','background','relations','notes','relation','note'],
    memories: ['category','content','source'], chats: []
  };
  let omittedChats = 0;
  for (const key of BACKUP_STORES) {
    for (const [i, r] of source[key].entries()) {
      const path = key + '[' + i + ']';
      const copy = backupText(r, fields[key], path, { id: ids[key].get(r.id) });
      backupNumbers(r, ['createdAt','updatedAt','order','wordCount'], path, copy);
      if (key === STORE.novels) {
        copy.title = (copy.title || t('novel.pending')) + ' · ' + t('backup.copySuffix');
        copy.lang = normalizeOutputLang(r.lang);
        copy.color = typeof r.color === 'string' && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : PALETTE[0];
        for (const field of ['genres','refAuthors']) {
          if (r[field] == null) continue;
          if (!Array.isArray(r[field]) || r[field].some(v => typeof v !== 'string')) throw new Error(path + '.' + field);
          copy[field] = [...r[field]];
        }
        if (r.worldSections != null) {
          if (!Array.isArray(r.worldSections)) throw new Error(path + '.worldSections');
          copy.worldSections = r.worldSections.map((v, j) => {
            if (!backupObject(v)) throw new Error(path + '.worldSections[' + j + ']');
            return backupText(v, ['title','content'], path + '.worldSections[' + j + ']', { id: makeId() });
          });
        }
      } else if (key === STORE.papers) {
        copy.title = (copy.title || t('novel.pending')) + ' · ' + t('backup.copySuffix');
        copy.outLang = normalizeOutputLang(r.outLang, state.settings.lang);
        if (r.sources != null) {
          if (!Array.isArray(r.sources) || r.sources.length > PAPER_SOURCE_LIMIT) throw new Error(path + '.sources');
          const sourceIds = new Set();
          const sourceUrls = new Set();
          copy.sources = r.sources.map((v, j) => {
            const itemPath = path + '.sources[' + j + ']';
            if (!backupObject(v) || typeof v.id !== 'string' || !v.id || v.id.length > 256 || sourceIds.has(v.id)) throw new Error(itemPath + '.id');
            const entry = normalizePaperSource(v, makeId());
            if (!entry || sourceUrls.has(entry.url)) throw new Error(itemPath + '.url');
            sourceIds.add(v.id);
            sourceUrls.add(entry.url);
            return entry;
          });
        }
      }
      if (key === STORE.chapters || key === STORE.papers) {
        copy.status = ['draft','revising','done'].includes(r.status) ? r.status : 'draft';
        if (r.history != null) {
          if (!Array.isArray(r.history) || r.history.some(v => !backupObject(v))) throw new Error(path + '.history');
          copy.history = r.history.map((entry,j) => {
            const itemPath = path + '.history[' + j + ']';
            if (!Number.isFinite(entry.at) || entry.at <= 0) throw new Error(itemPath + '.at');
            const item = backupText(entry, ['title','content','outline','topic'], itemPath, { id: makeId(), at: entry.at });
            if (typeof entry.checkpoint === 'boolean') item.checkpoint = entry.checkpoint;
            if (['draft','revising','done'].includes(entry.status)) item.status = entry.status;
            if (entry.outLang != null) item.outLang = normalizeOutputLang(entry.outLang);
            return item;
          });
        }
        if (typeof r.conflictOf === 'string' && ids[key].has(r.conflictOf)) {
          copy.conflictOf = ids[key].get(r.conflictOf);
        }
      }
      if ([STORE.chapters, STORE.outline, STORE.characters, STORE.memories].includes(key)) {
        copy.novelId = ids.novels.get(r.novelId);
        if (!copy.novelId) throw new Error(path + '.novelId');
      }
      if (key === STORE.outline) {
        copy.status = ['todo','doing','done'].includes(r.status) ? r.status : 'todo';
        const parent = r.parentId == null || r.parentId === '' ? null : outlineById.get(r.parentId);
        if (r.parentId && (!parent || parent.novelId !== r.novelId || parent.parentId)) throw new Error(path + '.parentId');
        copy.parentId = parent ? ids.outline.get(parent.id) : null;
      }
      if (key === STORE.chats) {
        const paper = r.id.startsWith('paper-') && ids.papers.get(r.id.slice(6));
        copy.id = ids.novels.get(r.id) || (paper ? 'paper-' + paper : null);
        if (!copy.id) { omittedChats++; continue; }
        copy.novelId = copy.id;
        if (!Array.isArray(r.messages)) throw new Error(path + '.messages');
        copy.messages = r.messages.map((v,j) => {
          if (!backupObject(v) || !['user','assistant'].includes(v.role)) throw new Error(path + '.messages[' + j + ']');
          const message = backupText(v, ['role','content','kind','error'], path + '.messages[' + j + ']');
          if (backupObject(v.extra) && Array.isArray(v.extra.entries)) {
            message.extra = { entries: v.extra.entries.map((e,k) => {
              if (!backupObject(e)) throw new Error(path + '.messages[' + j + '].entries[' + k + ']');
              return backupText(e, ['category','content'], path + '.messages[' + j + '].entries[' + k + ']');
            }) };
          }
          return message;
        });
      }
      mapped[key].push(copy);
    }
  }
  return { mapped, omittedChats };
}
function readBackupSnapshot() {
  if (state.settings.storageDenied) return Promise.resolve(Object.fromEntries(BACKUP_STORES.map(key => [key, state[key]])));
  if (dbMode !== 'idb') return Promise.resolve(Object.fromEntries(BACKUP_STORES.map(key => {
    const stored = JSON.parse(localStorage.getItem(lsKey(key)) || '{}');
    return [key, Object.values(stored)];
  })));
  return new Promise((resolve, reject) => {
    const trx = db.transaction(BACKUP_STORES, 'readonly');
    const snapshot = {};
    for (const key of BACKUP_STORES) {
      const req = trx.objectStore(key).getAll();
      req.onsuccess = () => { snapshot[key] = req.result; };
    }
    trx.onabort = () => reject(trx.error || new Error('Snapshot aborted'));
    trx.oncomplete = () => resolve(snapshot);
  });
}
function commitBackupCopies(source, target = db) {
  return new Promise((resolve, reject) => {
    const txn = target.transaction(BACKUP_STORES, 'readwrite');
    txn.onabort = () => reject(txn.error || new Error('Restore transaction aborted'));
    txn.oncomplete = () => resolve();
    try {
      for (const key of BACKUP_STORES) {
        const table = txn.objectStore(key);
        for (const record of source[key]) table.add(record);
      }
    } catch (error) {
      txn.abort();
      reject(error);
    }
  });
}
async function exportJson() {
  try {
    await Promise.all([flushSave(), flushPaperSave(), flushWorldBackupSave()]);
    const snapshot = await readBackupSnapshot();
    // If an active editor failed to save, keep its newest text in the downloadable copy.
    for (const [key, active, dirty, controls] of [
      [STORE.chapters, curChapter(), state.editorDirty, {title:'chapter-title', content:'editor', outline:'chapter-outline', status:'chapter-status'}],
      [STORE.papers, currentPaper(), state.paperDirty, {title:'paper-title', content:'paper-editor', topic:'paper-topic', status:'paper-status', outLang:'paper-lang'}]
    ]) if (active && dirty) {
      const record = { ...active };
      for (const [field, control] of Object.entries(controls)) record[field] = $('#' + control).value;
      record.wordCount = countWords(record.content);
      snapshot[key] = [...snapshot[key].filter(r => r.id !== record.id), record];
    }
    const data = { format: BACKUP_FORMAT, schemaVersion: BACKUP_SCHEMA, exportedAt: new Date().toISOString(), ...snapshot };
    const stamp = data.exportedAt.slice(0, 19).replace(/[:T]/g, '-');
    download('xiaoxing-backup-' + stamp + '.json', JSON.stringify(data, null, 2), 'application/json');
    toast(t('toast.backupOk'), 'ok');
  } catch (err) {
    toast(t('backup.exportFail'), 'err', 7000);
  }
}
let backupImportPending = false;
async function doImport(file) {
  if (backupImportPending) return;
  backupImportPending = true;
  const input = $('#import-file');
  const button = $('#btn-import-json');
  button.disabled = true;
  try {
    if (state.settings.storageDenied || dbMode !== 'idb') throw new Error(t('backup.idbOnly'));
    const text = (await file.text()).replace(/^\uFEFF/, '');
    const { mapped, omittedChats } = buildBackupCopies(JSON.parse(text));
    const details = BACKUP_STORES.filter(k => mapped[k].length).map(k => mapped[k].length + ' ' + backupStoreLabel(k)).join(' / ');
    const ignored = omittedChats ? ' ' + t('backup.orphanChats', { n: omittedChats }) : '';
    if (!await confirmDialog(t('confirm.import', { details }) + ignored)) return;
    await commitBackupCopies(mapped);
    // Do not reload the app: that would discard edits still open on this tab.
    for (const key of BACKUP_STORES) for (const record of mapped[key]) state[key].push(record);
    let selectionChanged = false;
    if (!curNovel() && mapped.novels.length) {
      selectionChanged ||= state.board === 'novel';
      state.currentNovelId = mapped.novels[0].id;
      state.currentChapterId = chaptersOf(state.currentNovelId)[0]?.id || null;
    }
    if (!currentPaper() && mapped.papers.length) {
      selectionChanged ||= state.board === 'paper';
      state.currentPaperId = mapped.papers[0].id;
    }
    closeModal('modal-backup');
    renderLibrary();
    if (selectionChanged) { await loadChatFor(chatKey()); renderAll(); }
    else { renderTop(); renderPanel(); }
    toast(t('toast.importOk'), 'ok', 5500);
  } catch (e) {
    toast(t('toast.importFail') + e.message, 'err', 7000);
  } finally {
    input.value = '';
    button.disabled = false;
    backupImportPending = false;
  }
}

async function wipeAll() {
  if (!await confirmDialog(t('confirm.wipe'))) return;
  await flushSave();
  await flushPaperSave();
  for (const k of Object.values(STORE)) await dbClear(k);
  state.novels = []; state.chapters = []; state.outline = [];
  state.characters = []; state.memories = []; state.chats = []; state.papers = [];
  state.currentNovelId = null; state.currentChapterId = null; state.chatForNovel = [];
  state.currentPaperId = null;
  renderLibrary(); renderAll();
  toast(t('toast.wiped'));
}

/* ---------------- AI 提供方配置 ---------------- */
const activeProvider = () => state.settings.providers.find(p => p.id === state.settings.activeProviderId) || null;
const baseUrl = p => String(p.baseUrl || '').trim().replace(/\/+$/, '');
const apiPath = p => (p.path != null && String(p.path).trim() !== '') ? String(p.path).trim() : '/chat/completions';
let modelTestController = null;

function modelEndpoint(p) {
  const base = new URL(baseUrl(p));
  const path = apiPath(p);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash ||
      !path.startsWith('/') || path.startsWith('//') || /[\\\s#]/.test(path)) throw new Error('endpoint');
  const endpoint = new URL(baseUrl(p) + path);
  if (endpoint.origin !== base.origin) throw new Error('endpoint');
  return endpoint;
}
function modelEndpointOrigin(p) {
  try { return modelEndpoint(p).origin; } catch { return ''; }
}
function isBuiltinModel(p) {
  return !!p && !p.apiKey && baseUrl(p) === PRESETS[0].baseUrl && apiPath(p) === PRESETS[0].path && p.model === PRESETS[0].model;
}
function modelDisplayName(p) {
  return isBuiltinModel(p) ? t('model.builtinName') : p.name || t('model.unnamed');
}
function renderProviderList() {
  const selected = activeProvider();
  $('#model-active-name').textContent = selected ? modelDisplayName(selected) : t('model.none');
  $('#model-active-meta').textContent = selected
    ? [selected.model, modelEndpointOrigin(selected) || t('model.badAddress')].filter(Boolean).join(' · ') : t('model.noneHint');
  $('#model-use-default').disabled = isBuiltinModel(selected);
  $('#model-test-active').disabled = !selected || !!modelTestController;
  $('#set-auto-model').checked = !!state.settings.autoModel;
  $('#provider-list').innerHTML = state.settings.providers.map(p => `
    <div class="prov-row ${p.id === state.settings.activeProviderId ? 'active' : ''}" data-id="${esc(p.id)}">
      <div class="prov-info">
        <div class="prov-name">${esc(modelDisplayName(p))}</div>
        <div class="prov-meta">${esc(p.model || '')} · ${esc(modelEndpointOrigin(p) || t('model.badAddress'))}</div>
      </div>
      <div class="prov-actions">
        <button type="button" class="btn mini" data-use-provider ${p.id === state.settings.activeProviderId ? 'disabled' : ''}>
          ${esc(t(p.id === state.settings.activeProviderId ? 'model.activeTag' : 'model.use'))}</button>
        <button type="button" class="btn mini ghost" data-edit-provider aria-label="${esc(t('model.editNamed', { name: modelDisplayName(p) }))}">${esc(t('model.edit'))}</button>
      </div>
    </div>`).join('') || '<div class="empty-hint small">' + esc(t('model.none')) + '</div>';
}
function setModelStatus(key, kind, vars) {
  const el = $('#model-test-status');
  el.hidden = !key;
  el.textContent = key ? t(key, vars) : '';
  el.dataset.kind = kind || '';
}
function cancelModelTest() {
  if (modelTestController) modelTestController.abort();
  modelTestController = null;
  $('#btn-prov-test').disabled = false;
  setModelStatus();
}
function fillProvForm(p) {
  $('#prov-name').value = p?.name || '';
  $('#prov-base').value = p?.baseUrl || '';
  $('#prov-path').value = p ? apiPath(p) : '/chat/completions';
  $('#prov-key').value = p?.apiKey || '';
  $('#prov-model').value = p?.model || '';
  $('#prov-temp').value = p?.temperature ?? 0.8;
  $('#prov-maxtok').value = p?.maxTokens ?? 4096;
  $('#preset-select').value = '';
}
function useProvider(provider) {
  cancelModelTest();
  state.settings.activeProviderId = provider.id;
  saveSettings();
  renderProviderList(); renderModelTag();
}
function makeBuiltinProvider() {
  const {name, baseUrl, path, model} = PRESETS[0];
  return { id: uid(), name, baseUrl, path, model, apiKey: '', temperature: 0.8, maxTokens: 4096 };
}
function useBuiltinProvider() {
  let provider = state.settings.providers.find(isBuiltinModel);
  if (!provider) {
    provider = makeBuiltinProvider();
    state.settings.providers.push(provider);
  }
  useProvider(provider);
  setModelStatus('model.switched', 'ok', {name: modelDisplayName(provider)});
}
function openModelForm(p = null, local = false) {
  cancelModelTest();
  state.provEditingId = p?.id || null;
  fillProvForm(p);
  $('#model-form').hidden = false;
  $('#btn-prov-del').hidden = !p;
  $('#model-advanced').open = local;
  $('#model-form-guide').textContent = t(p ? 'model.editGuide' : local ? 'model.localGuide' : 'model.cloudGuide');
  if (!p && local) {
    const i = PRESETS.findIndex(v => v.name.startsWith('Ollama'));
    if (i >= 0) applyModelPreset(i);
  }
  renderProviderList();
  $(p ? '#prov-name' : '#preset-select').focus();
}
function hideModelForm() {
  cancelModelTest();
  $('#model-form').hidden = true;
  state.provEditingId = null;
  fillProvForm(null);
  renderProviderList();
}
function openAISettings() {
  fillPresetSelect();
  hideModelForm();
  openModal('modal-ai');
}
function applyModelPreset(index) {
  const preset = PRESETS[index];
  if (!preset) return;
  cancelModelTest();
  // A preset starts a fresh configuration, so a key can never be carried over.
  state.provEditingId = null;
  fillProvForm(preset);
  $('#preset-select').value = String(index);
  $('#btn-prov-del').hidden = true;
  const local = /^http:\/\/(?:localhost|127\.0\.0\.1)(?:[:/]|$)/i.test(preset.baseUrl);
  $('#model-form-guide').textContent = t(local ? 'model.localGuide' : preset.baseUrl ? 'model.presetGuide' : 'model.customGuide');
  $('#model-advanced').open = local || !preset.baseUrl || !preset.model;
}
function providerFromForm() {
  const temp = Number.parseFloat($('#prov-temp').value);
  const limit = Number.parseInt($('#prov-maxtok').value, 10);
  return {
    id: state.provEditingId, name: $('#prov-name').value.trim() || t('model.unnamed'),
    baseUrl: $('#prov-base').value.trim(), path: $('#prov-path').value.trim() || '/chat/completions',
    apiKey: $('#prov-key').value.trim(), model: $('#prov-model').value.trim(),
    temperature: clamp(Number.isFinite(temp) ? temp : 0.8, 0, 2),
    maxTokens: clamp(Number.isFinite(limit) ? limit : 4096, 64, 128000)
  };
}
function validateModelForm(p, editing = false) {
  if (!p?.baseUrl || !p.model) return 'model.missing';
  if (!modelEndpointOrigin(p)) return 'model.badAddress';
  if (editing && p.id && p.apiKey) {
    const original = state.settings.providers.find(item => item.id === p.id);
    if (original?.apiKey === p.apiKey && modelEndpointOrigin(p) !== modelEndpointOrigin(original)) return 'model.newHostKey';
  }
  return '';
}
function showModelFormIssue(key) {
  if (key === 'model.newHostKey') $('#prov-key').value = '';
  $('#model-advanced').open = true;
  setModelStatus(key, 'err');
  $('#model-test-status').scrollIntoView({block:'nearest'});
}
async function saveProvider() {
  const data = providerFromForm();
  const issue = validateModelForm(data, true);
  if (issue) return showModelFormIssue(issue);
  if (!data.id) data.id = uid();
  const i = state.settings.providers.findIndex(p => p.id === data.id);
  if (i >= 0) state.settings.providers[i] = data; else state.settings.providers.push(data);
  useProvider(data);
  hideModelForm();
  setModelStatus('model.switched', 'ok', { name: modelDisplayName(data) });
}
async function delProvider() {
  const id = state.provEditingId;
  if (!id) return toast(t('toast.providerPick'), 'warn');
  if (!await confirmDialog(t('confirm.delProvider'))) return;
  state.settings.providers = state.settings.providers.filter(p => p.id !== id);
  if (!state.settings.providers.length) state.settings.providers.push(makeBuiltinProvider());
  if (state.settings.activeProviderId === id) state.settings.activeProviderId = state.settings.providers[0].id;
  saveSettings();
  hideModelForm(); renderModelTag();
  toast(t('toast.providerDel'));
}
function modelHttpStatus(status) {
  if (status === 401 || status === 403) return 'model.auth';
  if (status === 402) return 'model.credit';
  if (status === 404) return 'model.notFound';
  if (status === 429) return 'model.rate';
  if (status >= 500) return 'model.upstream';
  return status >= 400 ? 'model.request' : '';
}
async function probeModel(p, signal) {
  let response;
  try {
    response = await fetch(modelEndpoint(p).href, {
      method: 'POST', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal,
      headers: { 'Content-Type': 'application/json', ...(p.apiKey ? { 'Authorization': 'Bearer ' + p.apiKey } : {}) },
      body: JSON.stringify({ model: p.model, messages: [{ role: 'user', content: 'Reply with OK.' }], max_tokens: 32, stream: false })
    });
  } catch (error) {
    if (signal.aborted || error?.name === 'AbortError') return { key:'model.cancelled' };
    return { key:'model.network' };
  }
  if (!response.ok) return { key:modelHttpStatus(response.status), status:response.status };
  try {
    const body = await response.json();
    const message = body?.choices?.[0]?.message;
    return message && typeof message.content === 'string' && message.content.trim()
      ? { key:'model.connected' } : { key:'model.badResponse' };
  } catch {
    return signal.aborted ? { key:'model.cancelled' } : { key:'model.badResponse' };
  }
}
async function testProvider(useActive = false) {
  if (modelTestController) return;
  const p = useActive ? activeProvider() : providerFromForm();
  const issue = validateModelForm(p, !useActive);
  if (issue) {
    if (useActive) setModelStatus(issue, 'err');
    else showModelFormIssue(issue);
    return;
  }
  const controller = new AbortController();
  modelTestController = controller;
  $('#btn-prov-test').disabled = true;
  $('#model-test-active').disabled = true;
  const host = modelEndpointOrigin(p);
  setModelStatus('model.testing', 'wait', {host});
  $('#model-test-status').scrollIntoView({block:'nearest'});
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 12000);
  try {
    const result = await probeModel(p, controller.signal);
    if (modelTestController === controller) {
      setModelStatus(timedOut ? 'model.timeout' : result.key, result.key === 'model.connected' ? 'ok' : 'err',
        { host, status:result.status || '', name:modelDisplayName(p) });
    }
  } finally {
    clearTimeout(timer);
    if (modelTestController === controller) {
      modelTestController = null;
      $('#btn-prov-test').disabled = false;
      $('#model-test-active').disabled = !activeProvider();
    }
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
    signal: opts?.signal || state.aiAbort?.signal
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
  let lang = opts?.outputLang;
  if (!lang) lang = state.board === 'paper'
    ? ($('#paper-lang').value || currentPaper()?.outLang)
    : curNovel()?.lang;
  messages = [{ role: 'system', content: outputLanguageRule(normalizeOutputLang(lang, state.settings.lang)) }, ...messages];
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
  const L = state.settings.lang;
  const net = L === 'ru'
    ? 'Сетевая ошибка: возможно, ограничение CORS или сервис не запущен. Для локальной модели убедитесь, что она работает (Ollama: OLLAMA_ORIGINS=*, или запустите node proxy.mjs); для облачных используйте прокси. '
    : L === 'en'
      ? 'Network error: possible CORS restriction or service not running. For local models make sure it is running (Ollama needs OLLAMA_ORIGINS=*, or run node proxy.mjs); for cloud models use the proxy. '
      : '网络请求失败：可能是跨域(CORS)限制或服务未启动。本地模型请确认已运行（Ollama 需设置 OLLAMA_ORIGINS=*，或运行 node proxy.mjs 代理）；云端模型若被浏览器拦截，也请用代理转发。';
  const free = L === 'ru'
    ? 'Бесплатный лимит модели исчерпан или идёт ограничение: подождите пару минут и повторите; для стабильной работы подключите свою модель в «⚙ ИИ-модели». '
    : L === 'en'
      ? 'Free model quota reached or throttled: wait a few minutes and retry; for stable output connect your own model in “⚙ AI models”. '
      : '免费模型额度已达上限或限流：请稍等几分钟重试；如需稳定高速体验，可在「⚙ AI 模型」中接入自己的模型。';
  if (/Failed to fetch|NetworkError|load failed|Load failed/i.test(m)) return net + m;
  if (/402|FREE_LIMIT|Payment/i.test(m)) return free + m;
  if (/404/.test(m)) return L === 'ru' ? '404: проверьте адрес API (Base URL обычно заканчивается на /v1) и имя модели. ' + m : (L === 'en' ? '404: check the API URL (Base URL usually ends with /v1) and model name. ' + m : '404：请检查 API 地址（Base URL 通常以 /v1 结尾）或模型名称是否正确。' + m);
  if (/401|403/.test(m)) return L === 'ru' ? 'Ошибка авторизации (401/403): проверьте API-ключ. ' + m : (L === 'en' ? 'Auth failed (401/403): check your API key. ' + m : '鉴权失败(401/403)：请检查 API Key 是否正确。' + m);
  if (/429/.test(m)) return L === 'ru' ? 'Лимит запросов (429): слишком часто или исчерпан лимит, повторите позже. ' + m : (L === 'en' ? 'Rate limited (429): too many requests, retry later. ' + m : '限流(429)：请求过于频繁或额度不足，请稍后再试。' + m);
  return (L === 'ru' ? 'Ошибка ИИ-запроса: ' : L === 'en' ? 'AI request failed: ' : 'AI 请求失败：') + m;
}

/* ---------------- AI 上下文构建（记忆系统核心） ---------------- */
function formatStyleForAI() {
  const n = curNovel();
  if (!n) return '（无）';
  const gs = novelGenres(n).join('、') || t('novel.legacyGenre');
  const nar = { dialogue: t('style.dialogue'), balanced: t('style.balanced'), narrative: t('style.narrativeMode') }[n.narrative] || t('style.dialogue');
  const std = n.standard || '通用';
  const per = n.personal === 'standard' ? '标准输出' : '更像人写的（自然化）';
  const lines = [];
  lines.push(`用户群体：${n.audience || '通用'}；类型：${gs}；篇幅：${n.length || '未定'}；视角：${n.pov || '未定'}；基调：${n.tone || '未定'}；写法：${nar}；创作标准：${std}；个性化输出：${per}；写作语言：${OUTPUT_LANGS[normalizeOutputLang(n.lang)]}`);
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
  const paper = state.board === 'paper';
  const work = paper ? currentPaper() : curNovel();
  if (!work) { toast(t(paper ? 'p.needOpen' : 'toast.needNovel'), 'warn'); return; }
  const p = activeProvider();
  if (!p) { toast(t('toast.noAI'), 'warn'); openAISettings(); return; }
  if (state.aiStreaming) { toast(t('toast.aiBusy'), 'warn'); return; }
  if (state.genState.running) { toast(t('co.running'), 'warn'); return; }
  await (paper ? flushPaperSave() : flushSave());
  if ((paper ? state.board !== 'paper' || currentPaper() !== work : state.board !== 'novel' || curNovel() !== work) ||
      state.aiStreaming || state.genState.running) return;
  const ctx = paper ? buildPaperContext() : buildContext();
  const history = state.settings.ctx.chatHistory ? state.chatForNovel.slice(-12).filter(m => !m.error) : [];
  const messages = [{ role: 'system', content: paper ? '你是论文写作助手。区分论点和证据，不编造引用或来源。' : SYSTEM_PROMPT }];
  if (ctx) messages.push({ role: 'user', content: `以下是这份${paper ? '论文' : '小说'}当前的上下文：\n\n${ctx}\n\n—— 请先内化以上信息，再回应接下来的问题。` });
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
  if (state.board === 'paper') {
    const p = currentPaper();
    const ped = $('#paper-editor');
    const ptopic = ($('#paper-topic').value || (p ? p.topic : '') || '').trim();
    switch (action) {
      case 'continue': {
        if (!p) return toast(t('p.needOpen'), 'warn');
        const tail = (ped.value || p.content || '').slice(-2500);
        sendAI(`请接着这篇论文继续写下去：保持学术规范，引用处用 [n] 标注并在文末「参考文献」列出出处链接；直接输出正文，不要解释。\n\n当前正文末尾：\n\n${tail}`, { kind: 'continue' });
        break;
      }
      case 'plot':
        sendAI(`请围绕论文主题「${ptopic || '（未填写）'}」给出 3-5 个可行的论述角度或结构方案，每个说明【角度】【优势】【需要的资料】。`, { kind: null });
        break;
      case 'brainstorm':
        sendAI(`请围绕论文主题「${ptopic || '（未填写）'}」输出 10 个论文选题或论点脑洞，每个一句话点题 + 一句展开。`, { kind: null });
        break;
      case 'polish': {
        const target = (ped.value || (p ? p.content : '') || '').slice(-1500);
        if (!target) return toast(t('toast.nothingPolish'), 'warn');
        sendAI(`请润色以下论文片段：保持学术性与原意，提升严谨度与表达，直接输出润色后的文本。\n\n${target}`, { kind: 'polish' });
        break;
      }
      case 'extract':
        toast(t('p.extractOnly'), 'warn');
        break;
      case 'outline':
        sendAI(`请为论文「${ptopic || '（未填写）'}」设计一份详细大纲：章节结构、每节核心论点、需要的文献类型。`, { kind: null });
        break;
      case 'style':
        toast(t('p.styleOnly'), 'warn');
        break;
    }
    return;
  }
  const ed = $('#editor');
  const c = curChapter();
  const sel = ed.value.substring(ed.selectionStart, ed.selectionEnd);
  const n = curNovel();
  const langNote = n ? '\n' + outputLanguageRule(n.lang) : '';
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
  if (state.board === 'paper') {
    const p = currentPaper();
    if (!p) { toast(t('p.needOpen'), 'warn'); return; }
    const ed = $('#paper-editor');
    const pos = ed.selectionStart != null ? ed.selectionStart : ed.value.length;
    const text = '\n\n' + m.content.trim() + '\n\n';
    ed.value = ed.value.slice(0, pos) + text + ed.value.slice(pos);
    ed.focus();
    const np = pos + text.length;
    ed.setSelectionRange(np, np);
    schedulePaperSave(); updatePaperCounts();
    toast(t('toast.inserted'), 'ok');
    return;
  }
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
const GEN_STAGES = ['gp.search', 'gp.style', 'gp.draft', 'gp.write', 'gp.check'];
function beginGeneration(kind, item, ed, fields, outputLang) {
  const controller = new AbortController();
  const task = { kind, item, ed, before: ed.value, fields: fields.map(el => [el, el.value]), controller,
    opts: { stream: true, outputLang: normalizeOutputLang(outputLang, state.settings.lang), signal: controller.signal } };
  Object.assign(state.genState, { running: true, abort: controller, genKind: kind, task });
  state.aiAbort = controller;
  showGenProgress();
  return task;
}
function generationGuard(task) {
  if (task.controller.signal.aborted || state.genState.task !== task ||
      state.board !== task.kind || (task.kind === 'paper' ? currentPaper() : curChapter()) !== task.item) {
    throw new DOMException('Generation target is no longer active', 'AbortError');
  }
}
function finishGeneration(task) {
  if (state.genState.task !== task) return;
  Object.assign(state.genState, { running: false, abort: null, task: null });
  if (state.aiAbort === task.controller) state.aiAbort = null;
  hideGenProgress();
}
function generationDelay(ms, signal) {
  if (!signal) return new Promise(resolve => setTimeout(resolve, ms));
  if (signal.aborted) return Promise.reject(new DOMException('Generation cancelled', 'AbortError'));
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timeout);
      reject(new DOMException('Generation cancelled', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}
function generationTimeout(ms, signal) {
  const timeout = AbortSignal.timeout(ms);
  return signal && AbortSignal.any ? AbortSignal.any([signal, timeout]) : timeout;
}
async function collectGeneration(res, task, preview = false) {
  let text = '', refreshedAt = 0;
  for await (const chunk of aiStream(res)) {
    generationGuard(task);
    text += chunk;
    if (preview && Date.now() - refreshedAt >= 150) {
      $('#gp-note').textContent = text.slice(-200);
      refreshedAt = Date.now();
    }
  }
  generationGuard(task);
  if (!text.trim()) throw new Error('empty');
  return text;
}
function applyGeneratedDraft(task, candidate) {
  generationGuard(task);
  if (task.ed.value !== task.before || task.fields.some(([el, value]) => el.value !== value)) {
    const notices = {
      zh: '写作期间修改了原稿或生成条件，AI 未替换原稿。',
      en: 'Your text or instructions changed while generating. The original was kept.',
      ru: 'Текст или задание изменились во время генерации. Оригинал сохранён.'
    };
    toast(notices[state.settings.lang] || notices.zh, 'warn', 6000);
    return false;
  }
  task.ed.value = candidate;
  if (task.kind === 'paper') { updatePaperCounts(); schedulePaperSave(); }
  else { updateCounts(); scheduleSave(); }
  return true;
}
function renderGenStages(note) {
  const gs = state.genState;
  const box = $('#gen-stages');
  const stages = gs.genKind === 'paper' ? PAPER_STAGES : GEN_STAGES;
  box.innerHTML = stages.map((key, i) => {
    const cls = i < gs.stageIdx ? 'done' : (i === gs.stageIdx ? 'active' : '');
    const ico = i < gs.stageIdx ? '✓' : (i === gs.stageIdx ? '⟳' : '○');
    return `<div class="gp-stage ${cls}"><span class="gp-ico">${ico}</span><span>${t(key)}</span></div>`;
  }).join('');
  $('#gp-note').textContent = note || '';
}
async function genSetStage(task, idx, note) {
  generationGuard(task);
  state.genState.stageIdx = idx;
  renderGenStages(note);
  await generationDelay(400, task.opts.signal);
  generationGuard(task);
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
        await generationDelay(waitMs, opts?.signal);
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
  let hint = '';
  if (m === 'dialogue') hint = '写作手法要求：以人物对话为主要呈现方式，用对话推动剧情，旁白精简克制。';
  else if (m === 'narrative') hint = '写作手法要求：以叙述旁白为主，注重场景描写与心理铺陈，对话为辅。';
  else hint = '写作手法要求：对话与叙述均衡搭配。';
  const std = n.standard || '通用';
  if (std !== '通用') hint += `创作标准：遵循「${std}」的叙事习惯与文体规范。`;
  if ((n.personal || 'human') === 'human') hint += '个性化要求：输出要像真人作者——避免 AI 腔与套路句式，句式灵活多变、长短交错，情感自然不堆砌，允许恰当的口语化表达，让读者感觉是人写的。';
  else hint += '输出要求：规范、标准、结构清晰。';
  return hint;
}
async function genDraft(outline, planCtx, task) {
  const n = curNovel();
  const nar = narrativeHint(n);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: planCtx + '\n\n【本章大纲】\n' + outline + (nar ? '\n\n' + nar : '') + '\n\n请为本章拟写细纲，只输出：\n【核心】一句话概括本章\n【情节节点】3-6 条\n【开头钩子】1-2 句。不要写正文。' }
  ];
  const res = await aiCallRetry(messages, task.opts, t('gp.draft'));
  return (await collectGeneration(res, task)).trim();
}
async function generateChapterCandidate(outline, plan, planCtx, task) {
  const n = curNovel();
  const nar = narrativeHint(n);
  const tier = PLAN_LEVEL[effectivePlan()] || 0;
  const lenHint = tier >= 2 ? '3500-5000 字' : (tier === 1 ? '3000-4000 字' : '2000-3000 字');
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: planCtx + '\n\n【本章大纲】\n' + outline + (nar ? '\n\n' + nar : '') + '\n\n【细纲】\n' + plan + '\n\n请根据以上内容撰写本章正文。要求：像人类作家一样写作（句式长短交错、对话自然、细节具体），篇幅目标约 ' + lenHint + '（内容完整、起承转合自然，不注水凑字数），直接输出正文，不要标题、不要解释。' }
  ];
  const res = await aiCallRetry(messages, task.opts, t('gp.write'));
  return collectGeneration(res, task, true);
}

/* ---------------- 质量自检循环（写完先自查，有问题重写，不合格不输出） ---------------- */
const NOVEL_CHECK_CRITERIA = [
  '1. 文风与创作要求一致（参考作家技法 / 用户文风样本 / 对话旁白配比要求）',
  '2. 情节连贯、逻辑自洽，与上下文衔接自然，无明显漏洞',
  '3. 无 AI 腔：无套路句式、空洞排比、过度总结、机械复读',
  '4. 语言自然生动，符合真人写作习惯，句式长短交错',
  '5. 内容完整：起承转合相对完整，结尾自然（或自然断章）',
  '6. 无敏感违规内容；不使用表情符号、特殊符号或装饰性字符'
].join('\n');
const PAPER_CHECK_CRITERIA = [
  '1. 学术规范、语言严谨，结构完整（引言-论述-结论-参考文献）',
  '2. 如有引用，正文 [n] 标注应与程序附上的文末条目一一对应；没有证据时允许不引用并标明待核实，不虚构引文',
  '3. 不把候选书目信息当成已阅读全文，不虚构页码、引语、数据或文献',
  '4. 只使用规范文字与标点，无表情符号或特殊字符',
  '5. 论点清晰、论证充分，无逻辑漏洞，内容完整',
  '6. 字数达标，无注水或明显截断'
].join('\n');
async function runQualityCheck(kind, text, refCtx, task) {
  const criteria = kind === 'paper' ? PAPER_CHECK_CRITERIA : NOVEL_CHECK_CRITERIA;
  const what = kind === 'paper' ? '论文' : '小说章节';
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `你是严格的质量审核员。请逐条检查以下${what}是否达标。\n【审核标准】\n${criteria}\n${refCtx ? '【创作要求参考】\n' + refCtx.slice(0, 1500) + '\n' : ''}【待审文本】\n${text.slice(0, 6000)}\n\n只输出一行 JSON（不要其他任何内容）：{"ok":true,"issues":"通过"} 或 {"ok":false,"issues":"问题简述（简短）"}` }
  ];
  const res = await aiCallRetry(messages, task.opts, t('gp.check'));
  const out = (await collectGeneration(res, task)).trim();
  const m = out.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const j = JSON.parse(m[0]);
      return { ok: j.ok === true || j.ok === 'true', issues: String(j.issues || '') };
    } catch (e) { }
  }
  return { ok: false, issues: out.slice(0, 160) || '未达标' };
}
async function reviewedCandidate(task, write, refCtx) {
  const paper = task.kind === 'paper';
  const maxRewrites = 2; // 规则：不合格返回重写，执行两次重写后直接输出正文
  let last = null;
  for (let i = 0; i <= maxRewrites; i++) {
    await genSetStage(task, paper ? 2 : 3, '');
    const candidate = await write();
    last = candidate;
    await genSetStage(task, paper ? 3 : 4, '');
    const result = await runQualityCheck(task.kind, candidate, refCtx, task);
    if (result.ok) return candidate;
    if (i < maxRewrites) {
      renderGenStages(t('gp.rewrite') + ' (' + (i + 1) + '/' + maxRewrites + ')：' + (result.issues || '').slice(0, 60));
      await generationDelay(800, task.opts.signal);
    }
  }
  // 已执行两次重写：按规则直接输出正文，供用户审阅
  renderGenStages(t('gp.forceNote'));
  toast(t('gp.forceOutput'), 'warn', 5000);
  return last;
}
async function generateChapter() {
  const c = curChapter();
  if (!c || state.board !== 'novel') return toast(t('co.needChapter'), 'warn');
  const outlineEl = $('#chapter-outline'), ed = $('#editor');
  const outline = outlineEl.value.trim();
  if (!outline) {
    toast(t('co.needOutline'), 'warn');
    if (typeof setMobileBrief === 'function') setMobileBrief('novel', true);
    outlineEl.focus();
    return;
  }
  if (state.genState.running) return;
  if (state.aiStreaming) return toast(t('toast.aiBusy'), 'warn');
  if (!activeProvider()) { toast(t('toast.noAI'), 'warn'); openAISettings(); return; }
  const before = ed.value;
  if (before.trim() && !await confirmDialog(t('co.confirmOverwrite'))) return;
  if (state.genState.running || state.aiStreaming || state.board !== 'novel' || curChapter() !== c ||
      ed.value !== before || outlineEl.value.trim() !== outline) return;
  const n = curNovel();
  const task = beginGeneration('novel', c, ed, [outlineEl], n?.lang);
  try {
    await flushSave();
    await genSetStage(task, 0, '');
    const refs = novelRefAuthors(n);
    for (const id of refs) {
      generationGuard(task);
      const a = findAuthor(id);
      if (!a || a.custom || (state.wikiCache[id] && state.wikiCache[id].text)) continue;
      renderGenStages(t('learn.fetching', { name: a.name }));
      try { await wikiLearn(id, task.opts.signal); } catch (e) { generationGuard(task); }
    }
    await genSetStage(task, 1, refs.map(id => findAuthor(id)?.name).filter(Boolean).join('、'));
    const planCtx = buildContext(false) || '（无上下文）';
    await genSetStage(task, 2, '');
    const plan = await genDraft(outline, planCtx, task);
    renderGenStages(plan.slice(0, 140));
    await generationDelay(500, task.opts.signal);
    const candidate = await reviewedCandidate(task, () => generateChapterCandidate(outline, plan, planCtx, task), planCtx);
    if (candidate && applyGeneratedDraft(task, candidate)) toast(t('co.done'), 'ok', 4000);
  } catch (e) {
    if (e?.name === 'AbortError') toast(t('co.cancelled'));
    else toast(humanizeAIError(e), 'err', 6000);
  } finally {
    finishGeneration(task);
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
  document.body.classList.toggle('board-paper', state.board === 'paper');
  applyAdminMode();
  $('#board-novel').classList.toggle('on', state.board === 'novel');
  $('#board-paper').classList.toggle('on', state.board === 'paper');
  $$('#modal-auth [data-authlang]').forEach(b => b.classList.toggle('on', b.dataset.authlang === state.settings.lang));
  // 动态背景
  bgMode = state.settings.bg || 'stars';
  redrawStillBackground();
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
  const prevMax = PLAN_PREV_MAX[effectivePlan()] || 2;
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
  applyI18n();
}

/* ---------------- 动态背景（星空 / 太阳系 / 银河系 / 星球 · 拟真渲染 · 全部自绘无版权素材） ---------------- */
let bgCtx = null, bgW = 0, bgH = 0, bgMode = 'stars', bgEntities = [];
let redrawStillBackground = () => {};
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
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 680px)');
  let frame = 0, paintedAt = -Infinity;
  const paint = ts => {
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
  };
  const step = ts => {
    frame = 0;
    if (document.hidden || motion.matches) return;
    // The starfield is decorative. Draw at roughly 30 fps on phones.
    if (!narrow.matches || ts - paintedAt >= 32) { paint(ts); paintedAt = ts; }
    frame = requestAnimationFrame(step);
  };
  redrawStillBackground = () => {
    if (motion.matches && !document.hidden) paint(0);
  };
  const restart = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (document.hidden) return;
    if (motion.matches) paint(0);
    else { paintedAt = -Infinity; frame = requestAnimationFrame(step); }
  };
  addEventListener('resize', () => { bgResize(); redrawStillBackground(); });
  motion.addEventListener('change', restart);
  document.addEventListener('visibilitychange', restart);
  restart();
}
function setBgMode(m) {
  bgMode = m;
  redrawStillBackground();
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
    const res = await aiCallRetry(messages, { stream: true, outputLang: kind === 'novel' ? state.styleDraft?.lang : curNovel()?.lang }, t('toast.titlesGen'));
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
  advanceOnboarding();
}
function denyStorage() {
  state.settings.storageDenied = true;
  saveSettings();
  closeModal('modal-storage');
  applyUIPrefs();
  toast(t('toast.storageNo'), 'warn', 4000);
  advanceOnboarding();
}

/* ---------------- 会员方案 ---------------- */
function planName(p) {
  return p === 'pro' ? t('vip.pro') : (p === 'flag' ? t('vip.flag') : (p === 'deepseek' ? t('vip.deepseek') : t('vip.free')));
}
function deepseekPending() { try { return localStorage.getItem('nebula-deepseek-pending') === '1'; } catch (e) { return false; } }
function renderVip() {
  const banner = $('#vip-trial-banner');
  if (banner) {
    if (trialActive()) { banner.hidden = false; banner.textContent = t('vip.trialOn', { t: trialLeft() }); }
    else banner.hidden = true;
  }
  const eff = effectivePlan();
  $$('#modal-vip .vip-card').forEach(card => {
    const btn = card.querySelector('[data-plan]');
    if (!btn) return;
    const isCurrent = btn.dataset.plan === eff;
    card.classList.toggle('current', isCurrent);
    if (btn.dataset.plan === 'deepseek') {
      // DeepSeek 月度会员：按流程签署协议并付款，不由普通方案按钮直接开通
      btn.disabled = isCurrent;
      if (isCurrent) btn.textContent = t('vip.freeBtn');
      else if (deepseekPending()) btn.textContent = t('agr.pending');
      else btn.textContent = t('vip.deepseekBtn');
      return;
    }
    btn.disabled = isCurrent || authMode !== 'local';
    btn.textContent = isCurrent ? t('vip.freeBtn') : (authMode === 'local' ? t('vip.btn') : authModeCopy().managedPlan);
  });
}
function setPlan(p) {
  if (p === 'deepseek') { openAgreementModal(); return; }
  if (authMode !== 'local') return toast(authModeCopy().managedPlan, 'warn');
  if (state.settings.plan === p) return;
  state.settings.plan = p;
  saveSettings();
  renderVip();
  fillPresetSelect();
  applyUIPrefs();
  toast(t('toast.planChanged', { p: planName(p) }), 'ok', 3500);
}

/* ---------------- DeepSeek 月度会员：付费协议 + 收款码流程 ---------------- */
const AGREEMENT_VER = 'v1';
const AGREEMENT_ACCEPT_KEY = 'nebula-deepseek-agree';
function agreementAccepted() { try { return localStorage.getItem(AGREEMENT_ACCEPT_KEY) === AGREEMENT_VER; } catch (e) { return false; } }
function setAgrHint(txt) {
  const el = $('#agr-hint');
  el.textContent = txt || '';
  el.className = 'auth-hint' + (txt ? ' err' : '');
}
function refreshAgreementUI() {
  const signed = agreementAccepted();
  $('#agr-sign-section').hidden = signed;
  $('#agr-pay-section').hidden = !signed;
}
function openAgreementModal() {
  closeModal('modal-vip');
  $('#agr-text').innerHTML = t('agr.text');
  $('#agr-agree-chk').checked = false;
  $('#agr-sign-name').value = state.currentUser || '';
  $('#btn-agr-sign').disabled = true;
  setAgrHint('');
  refreshAgreementUI();
  openModal('modal-agreement');
}
function updateAgrSignBtn() {
  const ok = $('#agr-agree-chk').checked && $('#agr-sign-name').value.trim().length > 0;
  $('#btn-agr-sign').disabled = !ok;
}
async function signAgreement() {
  const name = $('#agr-sign-name').value.trim();
  if (!$('#agr-agree-chk').checked) return setAgrHint(t('agr.hintNeedAgree'));
  if (!state.currentUser) return setAgrHint(t('agr.hintNeedLogin'));
  if (name !== state.currentUser) return setAgrHint(t('agr.hintSignMismatch'));
  try {
    if (authMode === 'managed') await serverAuthRequest('agreement', { version: AGREEMENT_VER });
    localStorage.setItem(AGREEMENT_ACCEPT_KEY, AGREEMENT_VER);
    setAgrHint('');
    refreshAgreementUI();
    toast(t('agr.signedOk'), 'ok', 3500);
  } catch (e) {
    setAgrHint(authModeCopy().failed);
  }
}
async function submitDeepseekPaid() {
  const btn = $('#btn-agr-paid');
  if (!state.currentUser) return setAgrHint(t('agr.hintNeedLogin'));
  btn.disabled = true;
  try {
    const res = await fetch('https://formsubmit.co/ajax/3254643926@qq.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        _subject: '【晓星付费核对】DeepSeek 月度会员 40 元',
        message: `用户 ${state.currentUser} 已付款 ¥40，申请开通 DeepSeek 月度会员。\n已签署付费协议版本：${AGREEMENT_VER}\n付款时间：${new Date().toLocaleString()}\n请核对收款记录后开通（后台登记 40 元收款即自动开通 30 天）。`,
        user: state.currentUser,
        page: location.href,
        time: new Date().toISOString()
      })
    });
    const j = await res.json().catch(() => null);
    if (j && (j.success === true || j.success === 'true')) {
      localStorage.setItem('nebula-deepseek-pending', '1');
      // 管理版：同时写入站内「待核对付款」队列，管理员一键核对开通
      if (authMode === 'managed') {
        try { await serverAuthRequest('payment-submit', { amountCents: 4000, note: 'DeepSeek 月度会员' }); } catch (e) { }
      }
      closeModal('modal-agreement');
      toast(t('agr.submitted'), 'ok', 6000);
    } else {
      throw new Error('fail');
    }
  } catch (e) {
    setAgrHint(t('agr.submitFail'));
  } finally {
    btn.disabled = false;
  }
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
const PET_BUBBLES_RU = ['Привет!', 'Я здесь~', 'Нужна помощь? Нажми на меня', 'Так держать!', 'Придумать название?'];
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
  const arr = state.settings.lang === 'ru' ? PET_BUBBLES_RU : (state.settings.lang === 'en' ? PET_BUBBLES_EN : PET_BUBBLES_ZH);
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
  let clickTimer = null;
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
  // 单击：点开创作小助手
  const petSingle = () => {
    pet.classList.remove('pet-idle');
    applyPetPos();
    petSparkles(6);
    pet.classList.remove('pet-bounce');
    void pet.offsetWidth;
    pet.classList.add('pet-bounce');
    setTimeout(() => pet.classList.remove('pet-bounce'), 520);
    petRandomBubble();
    openAssistant();
  };
  // 双击：纯互动彩蛋（不打开助手）
  const petDouble = () => hurtPet();
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
    if (e.detail > 1) return;
    if (moved > 6) return; // 拖拽不算点击
    clearTimeout(clickTimer);
    // 延迟触发：若 280ms 内出现第二次点击（双击），则取消打开助手，只做互动
    clickTimer = setTimeout(() => { clickTimer = null; petSingle(); }, 280);
  });
  pet.addEventListener('dblclick', () => {
    clearTimeout(clickTimer);
    clickTimer = null;
    petDouble();
  });
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

/* ---------------- 账户系统（本机账户 · 密码必须字母+数字） ---------------- */
const AUTH_KEY = 'nebula-accounts';
function loadAccounts() {
  try { state.accounts = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}'); } catch (e) { state.accounts = {}; }
  try {
    const s = localStorage.getItem('nebula-session');
    if (s && Object.hasOwn(state.accounts, s)) state.currentUser = s;
  } catch (e) { }
  lastTrialState = trialActive();
}
function saveAccounts() { try { localStorage.setItem(AUTH_KEY, JSON.stringify(state.accounts)); } catch (e) { } }
const LOCAL_IDENTITY_SALT = 'xiaoxing-identity-v1';
async function hashPw(salt, pw) {
  const data = new TextEncoder().encode(salt + '::' + pw);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function validUser(u) { return /^[\w\u4e00-\u9fff]{2,20}$/.test(u); }
function validPass(p) { return p.length >= 6 && p.length <= 20 && /[A-Za-z]/.test(p) && /\d/.test(p); }
const AUTH_MODE_I18N = {
  zh: {
    server: '这是站点账户。登录后，管理员可以看到注册记录和最近在线状态。书稿仍保存在当前浏览器，不会随账户同步。',
    local: '当前是静态版，账户只保存在这个浏览器里，不计入全站人数。',
    offline: '暂时无法确认账户服务。你可以继续本地写作；恢复网络后再登录或注册。',
    pass: '6–128 位，至少含一个字母和一个数字', user: '2–20 位：字母、数字、下划线或汉字',
    badUser: '用户名需要 2–20 位，只能含字母、数字、下划线或汉字。',
    failed: '账户服务暂时不可用，请稍后重试。', limited: '操作太频繁，请稍后再试。',
    managedPlan: '会员资格由管理员确认', paid: '请联系站点运营者核实付款；此页面不能发起支付或确认到账。',
    whitelisted: '白名单', serverAccount: '站点账户', deviceAccount: '本地账户',
    signedOut: '登录已过期，请重新登录。你的稿件仍保存在本机。'
  },
  en: {
    server: 'This is a site account. Administrators can see registration and recent active status. Drafts stay in this browser and do not sync with your account.',
    local: 'This is the static edition. Accounts stay in this browser and do not count toward site-wide statistics.',
    offline: 'Unable to verify the account service. You can write locally and sign in or register once you reconnect.',
    pass: '6–128 characters, including a letter and a digit', user: '2–20 letters, numbers, underscores or Han characters',
    badUser: 'Use 2–20 letters, numbers, underscores or Han characters.',
    failed: 'The account service is unavailable. Please try again.', limited: 'Too many attempts. Please try again later.',
    managedPlan: 'Membership is confirmed by the operator', paid: 'Contact the site operator to verify a payment. This page cannot charge you or verify a receipt.',
    whitelisted: 'Allowlisted', serverAccount: 'Site account', deviceAccount: 'Local account',
    signedOut: 'Your sign-in expired. Please sign in again. Your drafts are still on this device.'
  },
  ru: {
    server: 'Это аккаунт сайта. Администраторы видят регистрацию и недавнюю активность. Черновики остаются в этом браузере и не синхронизируются с аккаунтом.',
    local: 'Это статическая версия. Аккаунты хранятся в этом браузере и не учитываются в общей статистике.',
    offline: 'Службу аккаунтов пока не удалось проверить. Продолжайте писать локально, а после подключения войдите или зарегистрируйтесь.',
    pass: '6–128 знаков, хотя бы одна буква и одна цифра', user: '2–20 букв, цифр, подчёркиваний или иероглифов',
    badUser: 'Введите 2–20 букв, цифр, подчёркиваний или иероглифов.',
    failed: 'Служба аккаунтов недоступна. Повторите попытку позже.', limited: 'Слишком много попыток. Повторите позже.',
    managedPlan: 'Уровень подтверждает администратор', paid: 'Для подтверждения платежа свяжитесь с оператором. Эта страница не принимает платежи и не подтверждает их.',
    whitelisted: 'В списке доступа', serverAccount: 'Аккаунт сайта', deviceAccount: 'Локальный аккаунт',
    signedOut: 'Сеанс истёк. Войдите снова. Черновики остаются на этом устройстве.'
  }
};
const authModeCopy = () => AUTH_MODE_I18N[state.settings.lang] || AUTH_MODE_I18N.zh;
const ACCOUNT_BRIDGE_I18N = {
  zh: {
    mirror: '使用同一个晓星账号。密码只在 {site} 输入，之后会回到这个网站。',
    login: '前往统一登录', register: '前往统一注册', forgot: '找回晓星账号密码',
    connecting: '正在打开统一登录站…', returning: '正在返回写作站…', unavailable: '本站无法连接统一登录。你可以继续本地写作，稍后重试。',
    failed: '登录连接失败。请回到发起登录的页面，在同一浏览器内重新登录。',
    storage: '当前浏览器无法保存本次登录状态。可在正常浏览窗口重试，或前往统一登录站写作。',
    central: '登录完成后将回到 {site}。', current: '使用账号「{name}」继续前往 {site}。',
    continue: '确认并返回写作站', switchUser: '换一个账号', cancel: '取消连接并留在本站',
    restored: '晓星账号已登录。', console: '管理后台请在统一账户站点打开。'
  },
  en: {
    mirror: 'Use your Xiaoxing account here. Enter your password at {site}, then return to this site.',
    login: 'Open central sign-in', register: 'Open central registration', forgot: 'Reset your Xiaoxing password',
    connecting: 'Opening the central sign-in site…', returning: 'Returning to the writing site…', unavailable: 'This site cannot reach central sign-in. You can keep writing locally and try again later.',
    failed: 'The sign-in connection failed. Return to the page where you started and try again in the same browser.',
    storage: 'Your browser could not store this sign-in request. Try in a regular window or write at the central site.',
    central: 'After signing in, you will return to {site}.', current: 'Continue to {site} with the account “{name}”.',
    continue: 'Confirm and return to writing', switchUser: 'Use another account', cancel: 'Cancel and stay here',
    restored: 'You are signed in to Xiaoxing.', console: 'Open the admin console on the central account site.'
  },
  ru: {
    mirror: 'Здесь можно использовать единый аккаунт «Сяосин». Введите пароль на {site} и вернитесь сюда.',
    login: 'Войти через главный сайт', register: 'Зарегистрироваться через главный сайт', forgot: 'Восстановить пароль аккаунта',
    connecting: 'Открываем главный сайт…', returning: 'Возвращаемся на сайт для работы…', unavailable: 'Сервис входа недоступен. Можно продолжить писать локально и повторить попытку позже.',
    failed: 'Не удалось войти. Вернитесь на исходную страницу и повторите попытку в том же браузере.',
    storage: 'Браузер не сохранил запрос на вход. Используйте обычное окно или пишите на главном сайте.',
    central: 'После входа вы вернётесь на {site}.', current: 'Продолжить на {site} с аккаунтом «{name}».',
    continue: 'Подтвердить и вернуться', switchUser: 'Войти в другой аккаунт', cancel: 'Отменить и остаться здесь',
    restored: 'Вы вошли в аккаунт «Сяосин».', console: 'Панель управления доступна на главном сайте.'
  }
};
function bridgeText(key, values = {}) {
  const messages = ACCOUNT_BRIDGE_I18N[state.settings.lang] || ACCOUNT_BRIDGE_I18N.zh;
  return messages[key].replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
}
/* 创作者授权的管理员账号（用户名名单，由创作者维护；静态版凭此自动获得旗舰版最高权限） */
const CREATOR_ADMIN_USERS = ['小柚子'];
const isCreatorAdmin = username => CREATOR_ADMIN_USERS.includes((username || '').trim().normalize('NFKC'));
const isAdminNow = () => authMode === 'managed' ? Boolean(serverUser?.isAdmin) : isCreatorAdmin(state.currentUser);

/* ---------------- 管理员模式（黑色沉稳背景 + 呼吸车灯之眼）与在线人数 ---------------- */
function applyAdminMode() {
  const admin = isAdminNow();
  document.body.classList.toggle('is-admin', admin);
  // 管理员可随时切回普通版背景
  document.body.classList.toggle('admin-mode', admin && state.settings.adminBg !== false);
  // 管理入口：管理员任何模式下都可见（静态模式提示需服务器）
  const btn = $('#btn-admin-console');
  if (btn) btn.style.display = admin && !mirrorConfigured() ? '' : 'none';
}
let onlineTimer = null;
async function pollOnline() {
  if (authMode !== 'managed') {
    const el = $('#online-indicator');
    if (el) el.hidden = true;
    stopOnlinePoll();
    return;
  }
  try {
    const status = await accountStatus(4000);
    if (typeof status?.online === 'number') {
      $('#online-count').textContent = status.online;
      $('#online-indicator').hidden = false;
    }
  } catch (e) { }
}
function startOnlinePoll() { stopOnlinePoll(); pollOnline(); onlineTimer = setInterval(pollOnline, 30000); }
function stopOnlinePoll() { if (onlineTimer) clearInterval(onlineTimer); onlineTimer = null; }

/* ---------------- 私信模块（管理员可把 API 密钥私信发送给指定用户） ---------------- */
let inboxTimer = null;
async function pollInbox() {
  if (authMode !== 'managed' || !serverUser) {
    const b = $('#btn-inbox');
    if (b) b.hidden = true;
    stopInboxPoll();
    return;
  }
  const revision = authRevision;
  try {
    const r = await serverAuthRequest('messages');
    if (revision !== authRevision || !serverUser) return;
    const badge = $('#inbox-badge');
    $('#btn-inbox').hidden = false;
    if (Number(r.unread) > 0) { badge.hidden = false; badge.textContent = r.unread > 99 ? '99+' : r.unread; }
    else badge.hidden = true;
  } catch (e) { }
}
function startInboxPoll() { stopInboxPoll(); pollInbox(); inboxTimer = setInterval(pollInbox, 60000); }
function stopInboxPoll() { if (inboxTimer) clearInterval(inboxTimer); inboxTimer = null; }
function renderInbox(messages) {
  const el = $('#msg-list');
  el.innerHTML = (messages || []).map(m => `
    <div class="msg-item ${m.read ? '' : 'unread'}">
      <div class="msg-head"><span class="msg-src">${t('msg.fromAdmin')}</span><span class="msg-time">${new Date(m.createdAt).toLocaleString()}</span></div>
      <div class="msg-body">${esc(m.content)}</div>
      <button class="btn mini" data-msgcopy="${esc(m.content)}">${t('msg.copy')}</button>
    </div>`).join('') || '<div class="empty-hint">' + t('msg.empty') + '</div>';
}
async function openInbox() {
  openModal('modal-messages');
  try {
    const r = await serverAuthRequest('messages');
    renderInbox(r.messages);
    if (Number(r.unread) > 0) serverAuthRequest('messages/read', {}).then(pollInbox).catch(() => {});
  } catch (e) {
    $('#msg-list').innerHTML = '<div class="empty-hint">' + authModeCopy().failed + '</div>';
  }
}
async function sendToCreator() {
  const content = $('#msg-compose-text').value.trim();
  if (!content) return;
  try {
    if (authMode === 'managed') {
      await serverAuthRequest('messages/send', { content });
    } else {
      const res = await fetch('https://formsubmit.co/ajax/3254643926@qq.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: '【用户私信】来自 ' + (state.currentUser || '游客'),
          message: content + '\n\n发送者：' + (state.currentUser || '未登录') + '\n时间：' + new Date().toLocaleString(),
          page: location.href, time: new Date().toISOString()
        })
      });
      const j = await res.json().catch(() => null);
      if (!j || !(j.success === true || j.success === 'true')) throw new Error('fail');
    }
    $('#msg-compose-text').value = '';
    toast(t('msg.sentCreator'), 'ok', 4000);
  } catch (e) {
    toast(t('msg.fail'), 'err');
  }
}
function bindInbox() {
  $('#btn-inbox').addEventListener('click', openInbox);
  $('#btn-msg-refresh').addEventListener('click', openInbox);
  $('#btn-msg-read').addEventListener('click', () => { serverAuthRequest('messages/read', {}).then(pollInbox).catch(() => {}); openInbox(); });
  $('#msg-list').addEventListener('click', e => {
    const b = e.target.closest('[data-msgcopy]');
    if (b) copyText(b.dataset.msgcopy);
  });
  $('#btn-msg-send').addEventListener('click', sendToCreator);
}

/* ---------------- 站长操作台（站内）· 重制版 ---------------- */
const adminState = { users: [], busy: false, notice: '' };
async function adminApi(path, method = 'GET', body) {
  if (mirrorConfigured()) throw new Error('Administrator access requires the account site');
  const r = await fetch(new URL(path, document.baseURI), {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error((data && data.error) || 'request failed'), { status: r.status, code: data && data.code });
  return data;
}
function setAdminStatus(txt, isErr) {
  const el = $('#admin-status');
  el.textContent = txt || '';
  el.className = 'auth-hint' + (isErr ? ' err' : '');
}
function renderAdminStats(d) {
  $('#admin-stat-total').textContent = d.totalUsers ?? '—';
  $('#admin-stat-online').textContent = d.onlineUsers ?? '—';
  $('#admin-stat-payers').textContent = d.totalPayers ?? '—';
  $('#admin-stat-net').textContent = ((d.periodNetCents || 0) / 100).toFixed(2);
}
function renderAdminList() {
  const q = ($('#admin-user-search').value || '').trim().toLowerCase();
  const users = adminState.users.filter(u => !q || String(u.username || '').toLowerCase().includes(q));
  $('#admin-user-list').innerHTML = users.map(u => {
    const badges = [];
    if (u.isAdmin) badges.push('<span class="au-badge admin">👑 ' + t('auth.adminBadge') + '</span>');
    else if (u.plan === 'flag') badges.push('<span class="au-badge flag">' + t('vip.flag') + '</span>');
    if (u.blocked) badges.push('<span class="au-badge blocked">' + t('admin.blocked') + '</span>');
    return `<div class="admin-user-row ${u.blocked ? 'blocked' : ''}" data-uid="${esc(u.id)}">
      <span class="au-name">${esc(u.username)}</span>
      <span class="au-meta">${esc(u.email || '')} · ${new Date(u.createdAt).toLocaleDateString()}${u.hasPaid ? ' · ' + t('admin.payers') : ''}</span>
      <span class="au-badges">${badges.join(' ')}</span>
      <span class="au-actions">
        <button class="btn mini" data-aa="block" ${u.isAdmin ? 'disabled title="' + esc(t('admin.protected')) + '"' : ''}>${u.blocked ? t('admin.unblock') : t('admin.block')}</button>
        <button class="btn mini" data-aa="wl">${u.whitelisted ? t('admin.unwl') : t('admin.wl')}</button>
        <button class="btn mini" data-aa="msg">${t('admin.msg')}</button>
      </span>
    </div>`;
  }).join('') || '<div class="empty-hint">' + t('vip.searchEmpty') + '</div>';
}
function renderAdminPending(pending) {
  const el = $('#admin-pending-list');
  el.innerHTML = (pending || []).map(p => `
    <div class="admin-user-row pending" data-pid="${esc(p.id)}">
      <span class="au-name">${esc(p.username)}</span>
      <span class="au-meta">¥${(p.amountCents / 100).toFixed(2)} · ${new Date(p.submittedAt).toLocaleString()}${p.note ? ' · ' + esc(p.note.slice(0, 40)) : ''}</span>
      <span class="au-actions"><button class="btn mini primary" data-presolve="${esc(p.id)}">${t('admin.resolve')}</button></span>
    </div>`).join('') || '<div class="empty-hint small">' + t('admin.pendingEmpty') + '</div>';
  el.querySelectorAll('[data-presolve]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (adminState.busy) return;
      adminState.busy = true;
      setAdminStatus('');
      try {
        await adminApi('./api/admin/pending-resolve', 'POST', { pendingId: btn.dataset.presolve });
        adminState.notice = t('admin.unblocked').replace('已解除拉黑', '已核对并开通');
        toast(t('admin.blockedOk').replace('已被拉黑并强制下线', '已核对并开通'), 'ok');
      } catch (e) {
        setAdminStatus(t('admin.opFail'), true);
      } finally {
        adminState.busy = false;
        await refreshAdminConsole();
      }
    });
  });
}
function renderAdminPayments(payments) {
  const el = $('#admin-payments-list');
  el.innerHTML = (payments || []).slice(0, 8).map(p => `
    <div class="admin-pay-row">
      <span class="au-name">${esc(p.username || '—')}</span>
      <span class="au-meta">${p.kind === 'payment' ? '收款' : '退款'} ¥${(p.amountCents / 100).toFixed(2)} · ${new Date(p.occurredAt).toLocaleString()}</span>
    </div>`).join('') || '<div class="empty-hint small">—</div>';
}
function openAdminComposer(uid) {
  const u = adminState.users.find(x => x.id === uid);
  if (!u) return;
  $('#admin-msg-target-name').textContent = u.username;
  $('#admin-msg-target-name').dataset.uid = uid;
  $('#admin-msg-text').value = '';
  $('#admin-msg-composer').hidden = false;
  $('#admin-msg-text').focus();
}
function renderAdminCreatorMsgs(msgs) {
  const el = $('#admin-creator-msgs');
  el.innerHTML = (msgs || []).map(m => `
    <div class="admin-user-row">
      <span class="au-name">${esc(m.username || '')}${m.email ? ' · ' + esc(m.email) : ''}</span>
      <span class="au-meta">${esc(m.content.slice(0, 60))}${m.content.length > 60 ? '…' : ''}</span>
      <span class="au-actions">
        <button class="btn mini" data-areply="${esc(m.userId)}">${t('admin.reply')}</button>
      </span>
    </div>`).join('') || '<div class="empty-hint small">—</div>';
  el.querySelectorAll('[data-areply]').forEach(btn => {
    btn.addEventListener('click', () => openAdminComposer(btn.dataset.areply));
  });
}
async function refreshAdminConsole() {
  if (adminState.busy) return;
  adminState.busy = true;
  setAdminStatus('');
  try {
    if (authMode !== 'managed') {
      setAdminStatus(t('admin.needServer'), true);
      return;
    }
    const d = await adminApi('./api/admin/dashboard?days=30');
    adminState.users = Array.isArray(d.users) ? d.users : [];
    renderAdminStats(d);
    renderAdminPending(d.pending || []);
    renderAdminCreatorMsgs(d.operatorMessages || []);
    renderAdminPayments(d.payments || []);
    fillReceiptUserSelect();
    renderAdminList();
    setAdminStatus(adminState.notice || (t('admin.total') + '：' + (d.totalUsers ?? '—')));
    adminState.notice = '';
  } catch (e) {
    setAdminStatus(e.code === 'admin_required' ? t('admin.required') : t('admin.loadFail'), true);
  } finally {
    adminState.busy = false;
  }
}
function fillReceiptUserSelect() {
  const sel = $('#ar-user');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">' + t('admin.searchPh') + '</option>' +
    adminState.users.map(u => `<option value="${esc(u.id)}">${esc(u.username)}</option>`).join('');
  if (prev) sel.value = prev;
}
async function submitReceipt() {
  if (adminState.busy) return;
  const userId = $('#ar-user').value;
  const amountYuan = Number($('#ar-amount').value);
  const reference = $('#ar-ref').value.trim();
  if (!userId || !Number.isFinite(amountYuan) || amountYuan <= 0 || !reference) {
    setAdminStatus(t('admin.opFail') + '：' + t('admin.searchPh') + '/金额/编号', true);
    return;
  }
  adminState.busy = true;
  setAdminStatus('');
  try {
    await adminApi('./api/admin/payments', 'POST', {
      userId, kind: $('#ar-kind').value, amountCents: Math.round(amountYuan * 100),
      reference, occurredAt: $('#ar-time').value ? new Date($('#ar-time').value).toISOString() : undefined,
      note: $('#ar-note').value.trim()
    });
    $('#ar-amount').value = ''; $('#ar-ref').value = ''; $('#ar-time').value = ''; $('#ar-note').value = '';
    toast(t('admin.receiptOk'), 'ok', 4000);
  } catch (e) {
    setAdminStatus(t('admin.opFail') + (e.code ? '（' + e.code + '）' : ''), true);
  } finally {
    adminState.busy = false;
    await refreshAdminConsole();
  }
}
async function adminRowAction(uid, kind) {
  const u = adminState.users.find(x => x.id === uid);
  if (!u || adminState.busy) return;
  if (kind === 'msg') { openAdminComposer(uid); return; }
  adminState.busy = true;
  setAdminStatus('');
  try {
    if (kind === 'block') {
      await adminApi('./api/admin/blacklist', 'PUT', { userId: uid, blocked: !u.blocked });
      adminState.notice = u.blocked ? t('admin.unblocked') : t('admin.blockedOk');
    } else {
      await adminApi('./api/admin/whitelist', 'PUT', { userId: uid, whitelisted: !u.whitelisted });
      adminState.notice = t('toast.planChanged', { p: u.whitelisted ? t('vip.free') : t('vip.flag') });
    }
  } catch (e) {
    adminState.notice = '';
    setAdminStatus(e.code === 'admin_protected' ? t('admin.protected') : t('admin.opFail'), true);
  } finally {
    adminState.busy = false;
    await refreshAdminConsole();
  }
}
async function sendAdminMessage() {
  const nameEl = $('#admin-msg-target-name');
  const uid = nameEl.dataset.uid;
  const content = $('#admin-msg-text').value.trim();
  if (!uid || !content) return;
  if (adminState.busy) return;
  adminState.busy = true;
  setAdminStatus('');
  try {
    await adminApi('./api/admin/messages', 'POST', { userId: uid, content });
    $('#admin-msg-composer').hidden = true;
    toast(t('admin.msgSent'), 'ok');
  } catch (e) {
    setAdminStatus(t('admin.opFail'), true);
  } finally {
    adminState.busy = false;
  }
}
function openAdminConsole() {
  if (mirrorConfigured()) return toast(bridgeText('console'), 'warn');
  openModal('modal-admin');
  refreshAdminConsole();
}
function bindAdminConsole() {
  $('#btn-admin-console').addEventListener('click', openAdminConsole);
  $('#btn-admin-refresh').addEventListener('click', () => { adminState.notice = ''; refreshAdminConsole(); });
  $('#admin-user-search').addEventListener('input', renderAdminList);
  $('#admin-user-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-aa]');
    if (!btn || btn.disabled) return;
    const row = btn.closest('[data-uid]');
    if (row) adminRowAction(row.dataset.uid, btn.dataset.aa);
  });
  $('#btn-admin-msg-send').addEventListener('click', sendAdminMessage);
  $('#btn-admin-msg-cancel').addEventListener('click', () => { $('#admin-msg-composer').hidden = true; });
  $('#btn-ar-submit').addEventListener('click', submitReceipt);
  // 邮箱补充（管理版老用户）
  $('#set-email-save').addEventListener('click', async () => {
    const email = $('#set-email-input').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast(t('auth.errEmail'), 'warn');
    try {
      const r = await serverAuthRequest('email', { email });
      updateServerUser(r.user);
      refreshAccountLabel();
      openSettings();
      toast(t('set.emailSaved'), 'ok');
    } catch (e) {
      toast(e.code === 'email_taken' ? t('auth.emailTaken') : authModeCopy().failed, 'err');
    }
  });
  // 私信收件箱
  bindInbox();
}
let authMode = 'unknown', serverUser = null, authModeCheck = null, authBusy = false, authRevision = 0;
let presenceTimer = null, presenceRequest = null, restoreSession = null;
const accountBridge = globalThis.XiaoxingAccount;
const mirrorConfigured = () => accountBridge?.hasMirrorConfig() ?? Boolean(
  globalThis.XIAOXING_ACCOUNT_CONFIG?.serverOrigin || globalThis.XIAOXING_ACCOUNT_CONFIG?.mirrorReturnUrl
);
let accountConnection = null, connectionFormShown = false, confirmConnectedUser = false;
let mirrorCallbackChecked = false, mirrorCallbackNotice = '';
const authNamespace = () => 'nebula-managed-auth:' + new URL('.', document.baseURI).pathname;
const authMethod = () => location.protocol === 'https:' || location.protocol === 'http:';
function readManagedMarker() {
  try { return localStorage.getItem(authNamespace()) === '1'; } catch (_) { return false; }
}
function writeManagedMarker() {
  try { localStorage.setItem(authNamespace(), '1'); } catch (_) {}
}
function authJson(response) { return /^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || ''); }
const accountTimeout = ms => typeof globalThis.AbortSignal?.timeout === 'function' ? AbortSignal.timeout(ms) : undefined;
async function accountStatus(timeout = 3000) {
  if (mirrorConfigured()) return accountBridge?.status();
  const response = await fetch(new URL('./api/status', document.baseURI), {
    credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: accountTimeout(timeout),
    headers: { Accept: 'application/json' }
  });
  if ([404, 405, 410].includes(response.status)) return false;
  return response.ok && authJson(response) ? response.json() : null;
}
async function serverAuthRequest(path, data) {
  if (mirrorConfigured()) {
    if (!accountBridge?.isMirror()) throw new Error('Invalid account site configuration');
    return accountBridge.request(path, data);
  }
  const endpoint = new URL('./api/auth/' + path, document.baseURI);
  // Central credentials may travel over plaintext only for local development.
  if (endpoint.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)) {
    throw new Error('HTTPS is required for site accounts');
  }
  const response = await fetch(endpoint, {
    method: data === undefined ? 'GET' : 'POST',
    credentials: 'same-origin', cache: 'no-store', redirect: 'error',
    headers: data === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: accountTimeout(path === 'me' ? 3500 : 10000)
  });
  let result = null;
  if (authJson(response)) try { result = await response.json(); } catch (_) {}
  if (!response.ok || !result) {
    throw Object.assign(new Error('Account request failed'), { status:response.status, code:result?.code });
  }
  return result;
}
function updateServerUser(user) {
  const u = user && typeof user.id === 'string' && typeof user.username === 'string' ? user : null;
  if (u && u.blocked) {
    // 账户已被管理员拉黑：立即下线并提示
    serverUser = null;
    state.currentUser = null;
    if (mirrorConfigured()) accountBridge?.clearSession();
    stopPresence();
    applyAdminMode();
    refreshAccountLabel();
    toast(t('auth.blockedMsg'), 'warn', 6000);
    if (!$('#modal-auth').hidden) { switchAuthTab('login'); }
    else { switchAuthTab('login'); openModal('modal-auth'); }
    return;
  }
  serverUser = u;
  state.currentUser = u?.username || null;
  if (!u) {
    stopInboxPoll();
    const inbox = $('#btn-inbox');
    if (inbox) inbox.hidden = true;
  }
  applyAdminMode();
}
function refreshAccountLabel() {
  const account = $('#set-account-name');
  if (!account) return;
  const c = authModeCopy();
  const accountType = authMode === 'managed' ? c.serverAccount : c.deviceAccount;
  const isAdmin = authMode === 'managed' ? Boolean(serverUser?.isAdmin) : isCreatorAdmin(state.currentUser);
  const suffix = (isAdmin ? ' · 👑 ' + t('auth.adminBadge') : '') +
    (authMode === 'managed' && serverUser?.whitelisted ? ' · ' + c.whitelisted : '') +
    (trialActive() && !isAdmin ? t('set.trialBadge') : '');
  // 全平台统一展示登录信息：用户名 + 账户类型 + 邮箱（管理版）
  const email = authMode === 'managed' && serverUser?.email ? ' · ' + serverUser.email : '';
  account.textContent = state.currentUser ? state.currentUser + ' · ' + accountType + email + suffix : t('quick.localAccount');
  $('#set-login').hidden = !!state.currentUser;
  $('#set-logout').hidden = !state.currentUser;
}
function renderAccountConnection() {
  const credentials = $('#auth-credentials');
  if (!credentials) return;
  const mirror = mirrorConfigured();
  const confirmUser = Boolean(accountConnection && confirmConnectedUser && serverUser);
  credentials.hidden = mirror || confirmUser;
  if (mirror) {
    for (const el of credentials.querySelectorAll('input, select, button')) el.disabled = true;
    $('#forgot-panel').hidden = true;
    for (const el of $('#forgot-panel').querySelectorAll('input, button')) el.disabled = true;
    $('#auth-trial-banner').hidden = true;
  }
  $('#auth-tabs').hidden = confirmUser;
  $('#auth-bridge-choice').hidden = !mirror && !accountConnection;
  const mirrorForgot = $('#btn-auth-bridge-forgot');
  const switchUser = $('#btn-auth-bridge-switch');
  mirrorForgot.hidden = !mirror || state.authMode !== 'login' || !accountBridge?.isMirror();
  mirrorForgot.textContent = bridgeText('forgot');
  switchUser.hidden = !confirmUser;
  switchUser.textContent = bridgeText('switchUser');
  const info = $('#auth-bridge-info');
  const submit = $('#btn-auth-submit');
  const guest = $('#btn-auth-guest');
  if (mirror) {
    info.textContent = accountBridge?.isMirror()
      ? bridgeText('mirror', { site: accountBridge.accountOrigin() }) : bridgeText('unavailable');
    submit.textContent = bridgeText(state.authMode === 'register' ? 'register' : 'login');
    submit.disabled = authBusy || !accountBridge?.isMirror();
    guest.disabled = authBusy;
  } else {
    if (accountConnection) {
      const destination = new URL(accountConnection.returnUrl);
      const site = destination.host + destination.pathname;
      info.textContent = bridgeText(confirmUser ? 'current' : 'central', { site, name: serverUser?.username });
    }
    submit.textContent = confirmUser ? bridgeText('continue') : t(state.authMode === 'register' ? 'auth.submitRegister' : 'auth.submitLogin');
  }
  guest.textContent = accountConnection ? bridgeText('cancel') : t('quick.guest');
}
function setAccountConnectionStatus(key = '') {
  const status = $('#auth-bridge-status');
  if (!status) return;
  status.hidden = !key;
  status.textContent = key ? bridgeText(key) : '';
  status.classList.toggle('err', ['failed', 'storage', 'unavailable'].includes(key));
}
function openAccountConnection() {
  if (!connectionFormShown) {
    connectionFormShown = true;
    confirmConnectedUser = Boolean(serverUser && accountConnection.action === 'login');
    switchAuthTab(accountConnection.action === 'register' ? 'register' : 'login');
    if (accountConnection.action === 'forgot') openForgot();
  }
  renderAccountConnection();
  openModal('modal-auth');
}
function switchAccountConnectionUser() {
  if (authBusy || !accountConnection) return;
  confirmConnectedUser = false;
  setAccountConnectionStatus();
  switchAuthTab('login');
  $('#auth-user').focus();
}
async function startMirrorSignIn(action) {
  if (authBusy || !mirrorConfigured()) return;
  if (!accountBridge?.isMirror()) return setAccountConnectionStatus('unavailable');
  authBusy = true;
  renderAccountConnection();
  setAccountConnectionStatus('connecting');
  try {
    await Promise.all([flushSave(), flushPaperSave()]);
    await accountBridge.start(action, state.settings.lang);
  } catch (error) {
    setAccountConnectionStatus(error.code === 'storage_unavailable' ? 'storage' : 'failed');
  } finally {
    authBusy = false;
    renderAccountConnection();
  }
}
async function finishAccountConnection() {
  const connection = accountConnection;
  const { redirectUrl } = await serverAuthRequest('connect', {
    returnUrl: connection.returnUrl, challenge: connection.challenge, state: connection.state
  });
  accountBridge.complete(connection, redirectUrl);
}
function renderAuthModeCopy() {
  const anchor = $('#auth-hint');
  if (!anchor) return;
  let note = $('#auth-mode-note');
  if (!note) {
    note = document.createElement('p');
    note.id = 'auth-mode-note';
    note.className = 'auth-local-note';
    anchor.after(note);
  }
  note.textContent = authModeCopy()[authMode === 'managed' ? 'server' : authMode === 'local' ? 'local' : 'offline'];
  renderAccountConnection();
  if (authMode === 'managed') {
    $('#auth-user').placeholder = authModeCopy().user;
    $('#auth-pass').placeholder = authModeCopy().pass;
  } else {
    $('#auth-user').placeholder = t('auth.userPh');
    $('#auth-pass').placeholder = t('auth.passPh');
  }
  const max = authMode === 'local' ? 20 : 128;
  $('#auth-pass').maxLength = max;
  $('#auth-pass2').maxLength = max;
  refreshAccountLabel();
  const legacyTip = $('#btn-tip-send')?.closest('.dev-tip');
  if (legacyTip) {
    let notice = $('#managed-payment-note');
    if (!notice) {
      notice = document.createElement('p');
      notice.id = 'managed-payment-note';
      notice.className = 'auth-local-note';
      legacyTip.after(notice);
    }
    legacyTip.style.display = authMode === 'local' ? '' : 'none';
    notice.hidden = authMode === 'local';
    notice.textContent = authModeCopy().paid;
  }
}
async function setUpAccountMode({ restore = false } = {}) {
  if (mirrorConfigured()) {
    // A configured mirror stays managed when its account service is unavailable.
    authMode = 'managed';
  } else if (!authMethod()) {
    authMode = 'local';
    loadAccounts();
    return;
  }
  if (authMode === 'local') return;
  if (readManagedMarker()) authMode = 'managed';
  if (authMode === 'unknown') {
    if (!authModeCheck) {
      authModeCheck = (async () => {
        try {
          const status = await accountStatus();
          if (status?.managed === true) {
            authMode = 'managed';
            writeManagedMarker();
          } else if (status === false) {
            // An explicit absence is normal on the static deployment. Never downgrade a known managed installation.
            authMode = 'local';
            loadAccounts();
          }
        } catch (_) { /* Unknown stays unknown; account creation is unavailable, but local writing works. */ }
      })().finally(() => { authModeCheck = null; });
    }
    await authModeCheck;
  }
  if (authMode !== 'local' && !serverUser) state.currentUser = null;
  if (restore) await restoreMirrorCallback();
  if (restore && authMode === 'managed' && !serverUser) await restoreManagedSession();
  if (authMode === 'managed' && (!mirrorConfigured() || accountBridge?.isMirror())) {
    startOnlinePoll();
    if (serverUser) startInboxPoll();
  } else {
    stopOnlinePoll();
    stopInboxPoll();
    const el = $('#online-indicator');
    if (el) el.hidden = true;
    const ib = $('#btn-inbox');
    if (ib) ib.hidden = true;
  }
  applyAdminMode();
}
async function restoreMirrorCallback() {
  if (mirrorCallbackChecked || !mirrorConfigured() || !accountBridge?.isMirror()) return;
  mirrorCallbackChecked = true;
  try {
    const response = await accountBridge.consumeCallback();
    if (response?.user) {
      authRevision++;
      updateServerUser(response.user);
      if (serverUser) mirrorCallbackNotice = 'restored';
    }
  } catch (error) {
    mirrorCallbackNotice = error.code === 'storage_unavailable' ? 'storage' : 'failed';
  }
}
async function restoreManagedSession() {
  if (restoreSession) return restoreSession;
  const version = authRevision;
  restoreSession = (async () => {
    try {
      const response = await serverAuthRequest('me');
      if (authRevision === version) updateServerUser(response.user);
    } catch (error) {
      if (mirrorConfigured() && error.status === 401 && authRevision === version) accountBridge?.clearSession();
    }
  })().finally(() => { restoreSession = null; });
  return restoreSession;
}
function stopPresence() {
  if (presenceTimer !== null) clearInterval(presenceTimer);
  presenceTimer = null;
}
function syncPresence() {
  stopPresence();
  if (authMode !== 'managed' || !serverUser || document.visibilityState !== 'visible') return;
  presenceTimer = setInterval(heartbeat, 60000);
  void heartbeat();
}
async function heartbeat() {
  if (authMode !== 'managed' || !serverUser || authBusy || presenceRequest || document.visibilityState !== 'visible') return;
  const version = authRevision, user = serverUser.id;
  presenceRequest = (async () => {
    try {
      const response = await serverAuthRequest('heartbeat', {});
      if (authRevision !== version || serverUser?.id !== user) return;
      if (response.user?.id && response.user?.username) {
        updateServerUser(response.user);
        refreshAccountLabel();
        renderVip();
        trialCheck();
      }
    } catch (error) {
      if (error.status === 401 && authRevision === version && serverUser?.id === user) {
        if (mirrorConfigured()) accountBridge?.clearSession();
        updateServerUser(null);
        stopPresence();
        refreshAccountLabel();
        renderVip();
        toast(authModeCopy().signedOut, 'warn', 5000);
      }
    }
  })().finally(() => { presenceRequest = null; });
  return presenceRequest;
}
function managedPassword(p) { return p.length >= 6 && p.length <= 128 && /\p{L}/u.test(p) && /[0-9]/.test(p); }
function managedUsername(u) { return /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Han}0-9_]{2,20}$/u.test(u); }
/* ---------------- 忘记密码（密保问题找回） ---------------- */
let forgotQuestionKey = '';
function hintForgot(txt) {
  const el = $('#forgot-hint');
  if (!el) return;
  el.textContent = txt || '';
  el.className = 'auth-hint' + (txt ? ' err' : '');
}
function resetForgotState() {
  forgotQuestionKey = '';
  hintForgot('');
  const qw = $('#forgot-question-wrap'), aw = $('#forgot-answer-wrap'), pw = $('#forgot-pass-wrap');
  if (qw) qw.hidden = true;
  if (aw) aw.hidden = true;
  if (pw) pw.hidden = true;
  const btn = $('#btn-forgot-reset');
  if (btn) btn.disabled = true;
  const fi = $('#forgot-answer'), fp = $('#forgot-pass');
  if (fi) fi.value = '';
  if (fp) fp.value = '';
}
function openForgot() {
  if (mirrorConfigured()) { void startMirrorSignIn('forgot'); return; }
  $('#forgot-panel').hidden = false;
  $('#btn-auth-forgot').style.display = 'none';
  resetForgotState();
  $('#forgot-user').value = $('#auth-user').value.trim();
  $('#forgot-user').focus();
}
function closeForgot() {
  $('#forgot-panel').hidden = true;
  $('#btn-auth-forgot').style.display = '';
  resetForgotState();
}
async function askForgotQuestion() {
  if (mirrorConfigured()) return;
  const user = $('#forgot-user').value.trim();
  if (!user) return hintForgot(t('auth.errUser'));
  hintForgot('');
  if (authMode === 'managed') {
    try {
      const r = await serverAuthRequest('forgot-question', { username: user });
      if (!r.question) return hintForgot(t('auth.noQuestion'));
      forgotQuestionKey = r.question;
      $('#forgot-question-text').textContent = t('auth.' + r.question);
      $('#forgot-question-wrap').hidden = false;
      $('#forgot-answer-wrap').hidden = false;
      $('#forgot-pass-wrap').hidden = false;
      $('#btn-forgot-reset').disabled = false;
    } catch (e) {
      hintForgot(e.code === 'rate_limited' ? authModeCopy().limited : authModeCopy().failed);
    }
  } else {
    const acc = Object.hasOwn(state.accounts, user) ? state.accounts[user] : null;
    if (!acc || !acc.question) return hintForgot(t('auth.noQuestion'));
    forgotQuestionKey = acc.question;
    $('#forgot-question-text').textContent = t('auth.' + acc.question);
    $('#forgot-question-wrap').hidden = false;
    $('#forgot-answer-wrap').hidden = false;
    $('#forgot-pass-wrap').hidden = false;
    $('#btn-forgot-reset').disabled = false;
  }
}
async function submitForgotReset() {
  if (mirrorConfigured()) return;
  const user = $('#forgot-user').value.trim();
  const answer = $('#forgot-answer').value.trim();
  const pass = $('#forgot-pass').value;
  const managed = authMode === 'managed';
  if (!forgotQuestionKey) return hintForgot(t('auth.noQuestion'));
  if (!answer || answer.length < 2) return hintForgot(t('auth.answerPh'));
  if (managed ? !managedPassword(pass) : !validPass(pass)) return hintForgot(managed ? authModeCopy().pass : t('auth.errPass'));
  try {
    if (managed) {
      await serverAuthRequest('forgot-reset', { username: user, answer, password: pass });
    } else {
      const acc = Object.hasOwn(state.accounts, user) ? state.accounts[user] : null;
      if (!acc) return hintForgot(t('auth.noQuestion'));
      const h = await hashPw(acc.salt + ':q', answer);
      if (h !== acc.answerHash) return hintForgot(t('auth.badAnswer'));
      acc.hash = await hashPw(acc.salt, pass);
      saveAccounts();
    }
    closeForgot();
    switchAuthTab('login');
    toast(t('auth.resetOk'), 'ok', 4000);
  } catch (e) {
    if (e.code === 'invalid_answer') hintForgot(t('auth.badAnswer'));
    else if (e.code === 'no_question') hintForgot(t('auth.noQuestion'));
    else if (e.code === 'rate_limited') hintForgot(authModeCopy().limited);
    else hintForgot(authModeCopy().failed);
  }
}
function managedAuthHint(error) {
  const c = authModeCopy();
  return ({
    invalid_username:c.badUser, invalid_password:c.pass, username_taken:t('auth.errExists'),
    invalid_credentials:t('auth.errLogin'), rate_limited:c.limited, blocked:t('auth.blockedMsg'),
    invalid_question:t('auth.q0') + ' · ' + t('auth.answerPh'),
    invalid_email:t('auth.errEmail'), email_taken:t('auth.emailTaken')
  })[error.code] || c.failed;
}
function trialUntil() {
  if (authMode === 'managed') return Number(serverUser?.trialEndsAt) || 0;
  const u = state.currentUser;
  return authMode === 'local' && u && Object.hasOwn(state.accounts,u) ? Number(state.accounts[u].trialUntil) || 0 : 0;
}
function trialActive() { return trialUntil() > Date.now(); }
function trialLeft() {
  const ms = trialUntil() - Date.now();
  if (ms <= 0) return '';
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return state.settings.lang === 'zh' ? `${h} 小时 ${m} 分` : `${h}h ${m}m`;
}
function effectivePlan() {
  if (authMode === 'managed') {
    if (!serverUser || !['free','pro','deepseek','flag'].includes(serverUser.plan)) return 'free';
    // 管理员账号与白名单账号自动拥有网站最高权限（旗舰版）
    if (serverUser.isAdmin || serverUser.whitelisted) return 'flag';
    // A server-reported trial must not outlive its deadline if the connection drops.
    return serverUser.plan === 'flag' && !trialActive() ? 'free' : serverUser.plan;
  }
  if (authMode !== 'local') return 'free';
  if (isCreatorAdmin(state.currentUser)) return 'flag';
  if (trialActive()) return 'flag';
  return state.settings.plan;
}
function trialCheck() {
  const active = trialActive();
  if (lastTrialState === true && !active && state.currentUser) toast(t('vip.trialEnd'), 'warn', 5000);
  lastTrialState = active;
}
function setAuthHint(txt, ok) {
  const el = $('#auth-hint');
  el.textContent = txt || '';
  el.className = 'auth-hint ' + (ok ? 'ok' : 'err');
}
function switchAuthTab(mode) {
  state.authMode = mode;
  $('#auth-tab-login').classList.toggle('on', mode === 'login');
  $('#auth-tab-register').classList.toggle('on', mode === 'register');
  $('#auth-pass2-wrap').style.display = mode === 'register' ? '' : 'none';
  $('#auth-email-wrap').style.display = mode === 'register' ? '' : 'none';
  $('#auth-question-wrap').style.display = mode === 'register' ? '' : 'none';
  $('#auth-answer-wrap').style.display = mode === 'register' && $('#auth-question').value ? '' : 'none';
  $('#btn-auth-forgot').style.display = mode === 'login' ? '' : 'none';
  $('#forgot-panel').hidden = true;
  resetForgotState();
  $('#auth-trial-banner').hidden = mode !== 'register';
  $('#btn-auth-submit').textContent = t(mode === 'register' ? 'auth.submitRegister' : 'auth.submitLogin');
  setAuthHint('');
  $('#auth-pass').value = ''; $('#auth-pass2').value = '';
  renderAuthModeCopy();
}
async function authSubmit() {
  if (authBusy) return;
  if (mirrorConfigured()) return startMirrorSignIn(state.authMode);
  const user = $('#auth-user').value.trim();
  const pass = $('#auth-pass').value;
  const isRegister = state.authMode === 'register';
  if (!confirmConnectedUser && isRegister && $('#auth-pass2').value !== pass) return setAuthHint(t('auth.errPass2'));
  const submit = $('#btn-auth-submit'), guest = $('#btn-auth-guest');
  authBusy = true;
  submit.disabled = true;
  if (guest) guest.disabled = true;
  let signedIn = false;
  try {
    setAccountConnectionStatus();
    if (accountConnection && confirmConnectedUser && serverUser) {
      setAccountConnectionStatus('returning');
      await finishAccountConnection();
      return;
    }
    if (authMode === 'unknown') await setUpAccountMode();
    renderAuthModeCopy();
    if (authMode === 'unknown') return setAuthHint(authModeCopy().failed);
    if (authMode === 'managed') {
      if (!managedUsername(user)) return setAuthHint(authModeCopy().badUser);
      if (!pass || (isRegister && !managedPassword(pass))) return setAuthHint(isRegister ? authModeCopy().pass : t('auth.errLogin'));
      const emailRaw = isRegister ? $('#auth-email').value.trim().toLowerCase() : '';
      if (isRegister && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) return setAuthHint(t('auth.errEmail'));
      const q = isRegister ? $('#auth-question').value : '';
      const a = isRegister ? $('#auth-answer').value.trim() : '';
      const response = await serverAuthRequest(isRegister ? 'register' : 'login',
        isRegister ? { username: user, password: pass, email: emailRaw, question: q || undefined, answer: a || undefined } : { username: user, password: pass });
      authRevision++;
      updateServerUser(response.user);
      if (!serverUser) throw new Error('Missing session user');
      if (accountConnection) {
        signedIn = true;
        confirmConnectedUser = true;
        $('#auth-pass').value = ''; $('#auth-pass2').value = '';
        renderAccountConnection();
        setAccountConnectionStatus('returning');
        await finishAccountConnection();
        return;
      }
    } else {
      if (!validUser(user)) return setAuthHint(t('auth.errUser'));
      if (!validPass(pass)) return setAuthHint(t('auth.errPass'));
      if (isRegister) {
        if (Object.hasOwn(state.accounts,user)) return setAuthHint(t('auth.errExists'));
        const emailRaw = $('#auth-email').value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) return setAuthHint(t('auth.errEmail'));
        // 无服务器模式：盐由用户名确定性派生 → 同一用户名+密码=同一身份，任何设备可登录
        const salt = await hashPw(LOCAL_IDENTITY_SALT, user);
        const hash = await hashPw(salt, pass);
        const q = $('#auth-question').value;
        const a = $('#auth-answer').value.trim();
        Object.defineProperty(state.accounts, user, {value:{salt, hash, email: emailRaw, question: q || '', answerHash: a ? await hashPw(salt + ':q', a) : '', createdAt:Date.now(), trialUntil:Date.now()+86400000}, enumerable:true, writable:true, configurable:true});
        saveAccounts();
      } else {
        let acc = Object.hasOwn(state.accounts,user) ? state.accounts[user] : null;
        if (!acc) {
          // 本设备无此账号：若已在其他设备用相同用户名+密码注册，直接按确定性口令建立本地档案（身份互通）
          const salt = await hashPw(LOCAL_IDENTITY_SALT, user);
          const hash = await hashPw(salt, pass);
          Object.defineProperty(state.accounts, user, {value:{salt, hash, email:'', question:'', answerHash:'', createdAt:Date.now(), trialUntil:0, adopted:true}, enumerable:true, writable:true, configurable:true});
          saveAccounts();
          acc = state.accounts[user];
        }
        if (await hashPw(acc.salt, pass) !== acc.hash) return setAuthHint(t('auth.errLogin') + ' · ' + t('auth.anyDevice'));
        if (acc.adopted) toast(t('auth.adoptToast'), 'ok', 5000);
      }
      state.currentUser = user;
      try { localStorage.setItem('nebula-session', user); } catch (_) {}
    }
    lastTrialState = trialActive();
    closeModal('modal-auth');
    $('#auth-pass').value = ''; $('#auth-pass2').value = '';
    setAuthHint('');
    toast(isRegister ? t('auth.okRegister') : t('auth.welcome', { u: state.currentUser }), 'ok', 3500);
    if (trialActive()) toast(t('vip.trialOn', { t: trialLeft() }), 'ok', 5000);
    signedIn = true;
    renderAll();
    advanceOnboarding();
  } catch (error) {
    if (accountConnection && confirmConnectedUser) {
      if (error.status === 401) {
        confirmConnectedUser = false;
        updateServerUser(null);
        switchAuthTab('login');
      }
      setAccountConnectionStatus('failed');
    } else setAuthHint(authMode === 'managed' ? managedAuthHint(error) : authModeCopy().failed);
  } finally {
    authBusy = false;
    submit.disabled = false;
    if (guest) guest.disabled = false;
    if (signedIn) { syncPresence(); startInboxPoll(); }
  }
}
async function logoutUser() {
  if (authBusy || !await confirmDialog(t('auth.confirmLogout')) || authBusy) return;
  authBusy = true;
  authRevision++;
  stopPresence();
  try {
    if (authMode === 'managed') {
      try { await serverAuthRequest('logout', {}); }
      catch (error) { if (error.status !== 401 && !mirrorConfigured()) throw error; }
      if (mirrorConfigured()) accountBridge?.clearSession();
      updateServerUser(null);
    } else {
      try { localStorage.removeItem('nebula-session'); } catch (_) {}
      state.currentUser = null;
    }
    lastTrialState = false;
    renderAll();
    toast(t('auth.loggedOut'), 'ok');
    closeModal('modal-settings');
    continueLocalWriting();
  } catch (_) {
    toast(authModeCopy().failed, 'warn');
  } finally {
    authBusy = false;
    if (serverUser) syncPresence();
  }
}

/* ---------------- 新手工作台 ---------------- */
let localWriting = false;
function guestStarted() {
  if (localWriting) return true;
  try { return storageAllowed() && localStorage.getItem('nebula-local-writing') === '1'; }
  catch (e) { return false; }
}
function continueLocalWriting() {
  if (accountConnection) {
    accountBridge.clearIncoming();
    accountConnection = null;
    connectionFormShown = false;
    confirmConnectedUser = false;
    setAccountConnectionStatus();
  }
  localWriting = true;
  if (storageAllowed()) {
    try { localStorage.setItem('nebula-local-writing', '1'); } catch (e) { }
  }
  switchAuthTab('login');
  closeModal('modal-auth');
  advanceOnboarding();
}
let quickStarted = false;
function guidedDone() {
  if (quickStarted) return true;
  try { return localStorage.getItem('nebula-guided') === '1'; } catch (e) { return false; }
}
function openQuickStart() {
  if (!termsAccepted() || (!storageAllowed() && !state.settings.storageDenied) || (!state.currentUser && !guestStarted())) {
    advanceOnboarding();
    return;
  }
  const dialog = $('#modal-quick-start');
  if (!dialog.open) dialog.showModal();
}
async function runQuickStart(action) {
  const dialog = $('#modal-quick-start');
  if (!dialog.open) return;
  dialog.close();
  if (action === 'novel') {
    await setBoard('novel');
    if (state.board === 'novel') openNovelModal(null, { firstChapter: true });
  } else if (action === 'paper') {
    await setBoard('paper');
    if (state.board === 'paper') await newPaper();
  } else if (action === 'model') {
    openAISettings();
  } else if (action === 'backup') {
    openModal('modal-backup');
  }
}
function finishQuickStart() {
  if (guidedDone()) return;
  quickStarted = true;
  try { localStorage.setItem('nebula-guided', '1'); } catch (e) { }
  advanceOnboarding();
}

/* ---------------- 首次使用：须知 → 存储 → 本地写作或登录 → 工作台 ---------------- */
function advanceOnboarding() {
  if (!termsAccepted()) { openTerms(); return; }
  if (accountConnection) { openAccountConnection(); return; }
  if (!storageAllowed() && !state.settings.storageDenied) { openStorageAsk(); return; }
  if (!state.currentUser && !guestStarted()) { switchAuthTab(state.authMode); openModal('modal-auth'); return; }
  if (!guidedDone()) { openQuickStart(); return; }
  if (!state.changelogChecked) {
    state.changelogChecked = true;
    setTimeout(checkChangelog, 900);
  }
}

/* ---------------- 支持创作者（打赏 · 内嵌开发者名单 · 无弹窗） ---------------- */
async function submitTip() {
  if (authMode !== 'local') return toast(authModeCopy().paid, 'warn', 6500);
  const amount = state.tipAmount;
  if (!amount) return toast(t('tip.needAmount'), 'warn');
  const msg = $('#tip-msg').value.trim();
  const btn = $('#btn-tip-send');
  btn.disabled = true;
  try {
    const res = await fetch('https://formsubmit.co/ajax/3254643926@qq.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        _subject: '【晓星打赏】' + amount + '元',
        message: (msg || '（无留言）') + '\n支持金额：' + amount + ' 元',
        nickname: (state.settings.user || {}).nickname || '',
        user: state.currentUser || '',
        page: location.href,
        time: new Date().toISOString()
      })
    });
    const j = await res.json();
    if (j && (j.success === true || j.success === 'true')) {
      closeModal('modal-tip');
      $('#tip-msg').value = '';
      toast(t('tip.thanks'), 'ok', 4000);
    } else {
      throw new Error('submit fail');
    }
  } catch (e) {
    toast(t('tip.fail'), 'err', 4500);
  } finally {
    btn.disabled = false;
  }
}

/* ---------------- 论文板块（检索文献 · 带出处生成） ---------------- */
const PAPER_STAGES = ['gp.psearch', 'gp.pdraft', 'gp.pwrite', 'gp.check'];
const currentPaper = () => state.papers.find(p => p.id === state.currentPaperId) || null;
async function setBoard(b) {
  if (state.board === b) return;
  cancelGen();
  flushSave();
  flushPaperSave();
  state.board = b;
  state.settings.board = b;
  saveSettings();
  loadChatFor(chatKey()).then(() => renderChat());
  renderAll();
}
function safeReferenceURL(value) {
  try {
    const parsed = new URL(value);
    return ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : '';
  } catch (e) { return ''; }
}
function isPaperRefsHeading(raw) {
  return /^(?:参考文献|引用文献|参考资料|references|bibliography|works cited|список литературы|библиография|литература|источники)\s*[:：]?$/iu.test(
    raw.trim().replace(/^(?:#{1,6}\s*|[0-9]+[.)、]\s*)+/, '').replace(/^(?:\*\*|__)(.*?)(?:\*\*|__)$/, '$1').trim()
  );
}
function splitPaperReferences(text) {
  const lines = text.split(/\r?\n/);
  const heading = lines.findIndex(isPaperRefsHeading);
  return heading < 0 ? { body: text, entries: [] } : { body: lines.slice(0, heading).join('\n'), entries: lines.slice(heading + 1) };
}
function paperCitationNumbers(body) {
  const groups = [...body.matchAll(/[\[［]\s*([0-9][0-9\s,，、;；–—-]*)[\]］]/gu)].map(m => m[1].trim());
  return { used: [...new Set(groups.filter(n => /^\d+$/.test(n)).map(Number))].sort((a,b) => a-b),
    malformed: groups.some(n => !/^\d+$/.test(n)) };
}
function auditPaperReferences(text) {
  const { body, entries } = splitPaperReferences(text);
  const { used, malformed } = paperCitationNumbers(body);
  const listed = new Map(), duplicates = new Set();
  for (const line of entries) {
    const match = line.match(/^\s*(?:[-*]\s+)?(?:\[(\d+)\]|(\d+)[.)、])\s*(.*)$/);
    if (!match) continue;
    const number = Number(match[1] || match[2]);
    if (listed.has(number)) duplicates.add(number);
    const links = (match[3].match(/https?:\/\/[^\s<>]+/ig) || []).map(x => safeReferenceURL(x.replace(/[.,;，；。)]+$/, '')));
    listed.set(number, links.some(Boolean));
  }
  return { used, listed, malformed, duplicate: [...duplicates],
    missing: used.filter(n => !listed.has(n)),
    uncited: [...listed.keys()].filter(n => !used.includes(n)),
    noLink: [...listed.entries()].filter(([,valid]) => !valid).map(([n]) => n) };
}
function showPaperReferenceAudit() {
  const report = $('#paper-guide-audit-result');
  const content = currentPaper() ? $('#paper-editor').value.trim() : '';
  if (!content) { report.textContent = t('p.auditEmpty'); return; }
  const a = auditPaperReferences(content);
  const parts = [t('p.auditTally', { n:a.used.length, m:a.listed.size })];
  for (const [field, key] of [['missing','Missing'], ['uncited','Uncited'], ['duplicate','Duplicate'], ['noLink','NoLink']]) {
    if (a[field].length) parts.push(t('p.audit' + key, { n: a[field].map(n => '[' + n + ']').join(' ') }));
  }
  if (a.malformed) parts.push(t('p.auditMalformed'));
  if (!a.used.length && !a.listed.size) parts.push(t('p.auditNoRefs'));
  else if (parts.length === 1) parts.push(t('p.auditPass'));
  report.textContent = parts.join('\n');
}
const PAPER_TEMPLATES = {review:'p.tplReviewBody', compare:'p.tplCompareBody', empirical:'p.tplEmpiricalBody'};
function openPaperGuide() {
  const paper = currentPaper();
  const occupied = !!$('#paper-topic').value.trim();
  $('#paper-guide-template-note').textContent = t(!paper ? 'p.guideNeedPaper' : occupied ? 'p.guideFilled' : 'p.guideBlank');
  $$('#modal-paper-guide [data-paper-template]').forEach(b => { b.disabled = !paper || occupied; });
  $('#btn-paper-audit').disabled = !paper;
  $('#paper-guide-audit-result').textContent = '';
  openModal('modal-paper-guide');
}
function insertPaperTemplate(id) {
  const topic = $('#paper-topic');
  if (!currentPaper() || topic.value.trim() || !Object.hasOwn(PAPER_TEMPLATES,id)) return;
  const keys = I18N[normalizeOutputLang($('#paper-lang').value, state.settings.lang)];
  topic.value = keys[PAPER_TEMPLATES[id]];
  schedulePaperSave();
  closeModal('modal-paper-guide');
  if (typeof setMobileBrief === 'function') setMobileBrief('paper', true);
  topic.focus();
}
function paperSearchQuery(topic) {
  const use = value => value.replace(/\s+/g, ' ').trim().slice(0, 180);
  const question = topic.match(/^\s*(?:研究问题|research question|исследовательский вопрос)\s*[:：]([^\r\n]*)/im);
  const keywords = topic.match(/^\s*(?:检索关键词|search keywords|ключевые слова)\s*[:：]([^\r\n]*)/im);
  if (question && !question[1].trim()) return '';
  return use(keywords?.[1] || question?.[1] || topic.trim().split(/\r?\n/,1)[0] || '');
}
/* ---------------- 本地文献笔记（仅在明确选择时加入 AI） ---------------- */
const PAPER_SOURCE_LIMIT = 100;
const PAPER_SOURCE_UI = {
  zh: {
    open: '文献笔记', purpose: '给这篇论文留一份资料清单。保存网址不代表已核实正文，读过原文后再勾选。',
    record: '添加文献', editRecord:'编辑文献', title:'文献标题', url:'网址或 DOI', authors:'作者', venue:'出处 / 期刊', year:'年份', notes:'我的阅读笔记（可写页码和证据）', read:'我已读过原文', ai:'允许这条书目信息参与 AI 起草（不发送笔记）',
    keep:'保存文献', reset:'清空表单', search:'检索公开书目信息', searchTip:'点击查找后，仅将这里的关键词发给数据库；查找结果不会自动加入笔记。', find:'查找候选', finding:'正在查找……', idle:'也可以直接粘贴网址和标题。', query:'检索关键词',
    add:'加入笔记', added:'已收录', cite:'插入引用', edit:'编辑', remove:'移除',
    local:'本篇文献', empty:'还没有资料。先添加一条，或用关键词检索。', found:'找到 {n} 条候选。请点开来源核对。',
    noResults:'没有找到候选。试试缩短关键词，或手动添加链接。', bad:'请填写标题以及有效的 HTTP(S) 网址或 DOI。',
    duplicate:'这个网址已在笔记里。可以编辑原来的条目。', max:'本篇最多保留 100 条文献。', saved:'已保存文献笔记。', fail:'没有写入文献笔记。请保留输入，稍后再试。',
    readBadge:'原文已读（自标）', pendingBadge:'仅书目信息', aiBadge:'准许用于起草', inserted:'已插入 {ref}，并保留正文与已有书目。', noCite:'当前正在生成，或原稿已切换。请回到本篇后重试。', close:'关闭文献笔记',
    removePrompt:'只移除笔记里的条目。已插入正文的引用和书目保持原样。是否移除？'
  },
  en: {
    open:'Source notebook', purpose:'Keep a reading list for this paper. A saved link does not verify the text. Mark it read only after checking the original.',
    record:'Add a source', editRecord:'Edit source', title:'Source title', url:'URL or DOI', authors:'Authors', venue:'Publication / journal', year:'Year', notes:'Private reading notes (evidence and page numbers)', read:'I have read the original', ai:'Allow AI drafting to use this bibliography entry (no private notes)',
    keep:'Save source', reset:'Clear form', search:'Search public bibliographic databases', searchTip:'Only these keywords are sent when you search. Candidates are not added automatically.', find:'Find candidates', finding:'Searching…', idle:'You can also paste a title and link.', query:'Search keywords',
    add:'Add to notebook', added:'In notebook', cite:'Insert citation', edit:'Edit', remove:'Remove',
    local:'Sources for this paper', empty:'No sources yet. Add a link or search by keyword.', found:'{n} candidates found. Open each source to check it.',
    noResults:'No candidates found. Try fewer words or add a link by hand.', bad:'Enter a title and a valid HTTP(S) address or DOI.',
    duplicate:'This URL is already in the notebook. Edit the existing entry instead.', max:'This paper can keep up to 100 sources.', saved:'Source notebook saved.', fail:'The notebook was not saved. Keep your input and try again.',
    readBadge:'Original read (self-marked)', pendingBadge:'Bibliographic metadata only', aiBadge:'Allowed in AI drafts', inserted:'Inserted {ref}. The original text and existing bibliography remain.', noCite:'Generation is running or the paper changed. Return to this paper and retry.', close:'Close source notebook',
    removePrompt:'Only remove the notebook entry? The citations and bibliography already in your draft will stay.'
  },
  ru: {
    open:'Заметки об источниках', purpose:'Ведите список литературы для этой статьи. Наличие ссылки не подтверждает содержание. Отмечайте источник после чтения оригинала.',
    record:'Добавить источник', editRecord:'Изменить источник', title:'Название источника', url:'Ссылка или DOI', authors:'Авторы', venue:'Издание / журнал', year:'Год', notes:'Личные заметки (доказательства, страницы)', read:'Оригинал прочитан', ai:'Разрешить ИИ использовать библиографию (личные заметки не отправляются)',
    keep:'Сохранить источник', reset:'Очистить форму', search:'Поиск в открытых библиографических базах', searchTip:'При поиске отправляются только ключевые слова. Результаты не добавляются автоматически.', find:'Найти источники', finding:'Идёт поиск…', idle:'Можно вставить ссылку и название вручную.', query:'Ключевые слова',
    add:'Добавить в заметки', added:'Уже в заметках', cite:'Вставить ссылку', edit:'Изменить', remove:'Убрать',
    local:'Источники статьи', empty:'Источников пока нет. Добавьте ссылку или выполните поиск.', found:'Найдено источников: {n}. Откройте и проверьте оригинал.',
    noResults:'Ничего не найдено. Упростите запрос или добавьте ссылку вручную.', bad:'Введите название и действительную ссылку HTTP(S) или DOI.',
    duplicate:'Ссылка уже добавлена. Можно изменить существующую запись.', max:'К статье можно сохранить до 100 источников.', saved:'Заметки сохранены.', fail:'Не удалось сохранить заметки. Сохраните введённое и повторите попытку.',
    readBadge:'Оригинал прочитан (вручную)', pendingBadge:'Только библиографические данные', aiBadge:'Разрешён для черновиков ИИ', inserted:'Вставлено {ref}. Исходный текст и существующий список сохранены.', noCite:'Идёт генерация или выбрана другая статья. Вернитесь и повторите.', close:'Закрыть заметки об источниках',
    removePrompt:'Удалить только запись из заметок? Ссылки и список литературы в самой статье сохранятся.'
  }
};
const paperSourceUI = () => PAPER_SOURCE_UI[state.settings.lang] || PAPER_SOURCE_UI.zh;
let notebookSession = null;
function paperSourceURL(input) {
  if (typeof input !== 'string') return '';
  const raw = input.trim().replace(/^doi\s*:\s*/i, '');
  if (!raw || raw.length > 600) return '';
  const url = safeReferenceURL(/^10\.\d{4,9}\/[^\s<>?#]+$/u.test(raw) ? 'https://doi.org/' + raw : raw);
  return url && url.length <= 850 ? url : '';
}
function normalizePaperSource(source, id = uid()) {
  if (!source || typeof source !== 'object') return null;
  const clean = (key, max, multi = false) => {
    const value = typeof source[key] === 'string' ? source[key].trim() : '';
    return (multi ? value : value.replace(/\s+/gu, ' ')).slice(0, max);
  };
  const title = clean('title', 180), url = paperSourceURL(source.url);
  if (!title || !url) return null;
  return { id, title, url, authors:clean('authors',160), venue:clean('venue',140), year:clean('year',12),
    notes:clean('notes',1600,true), read:source.read === true, ai:source.ai === true };
}
function paperSources(record) {
  return Array.isArray(record?.sources) ? record.sources : [];
}
function combinePaperSources(selected, candidates, count) {
  const seen = new Set(), refs = [];
  for (const source of [...selected, ...candidates]) {
    const url = paperSourceURL(source?.url);
    if (!url || !source.title || seen.has(url)) continue;
    seen.add(url);
    refs.push({ url, title: source.title, authors: source.authors, year: source.year, venue:source.venue });
    if (refs.length >= count) break;
  }
  return refs;
}
function citationLineNumber(line) {
  return Number(line.match(/^\s*(?:[-*]\s+)?(?:\[(\d+)\]|(\d+)[.)、])\s*/u)?.slice(1).find(Boolean) || 0);
}
function sourceURLs(line) {
  return (line.match(/https?:\/\/[^\s<>]+/giu) || []).map(x => paperSourceURL(x.replace(/[.,;，；。]+$/u, ''))).filter(Boolean);
}
function makePaperCitation(text, cursor, source, L) {
  const url = paperSourceURL(source.url);
  if (!url) return null;
  const lines = text.split('\n');
  const heading = lines.findIndex(isPaperRefsHeading);
  const refLines = heading < 0 ? [] : lines.slice(heading + 1);
  const used = new Set(paperCitationNumbers(heading < 0 ? text : lines.slice(0, heading).join('\n')).used);
  const counts = new Map();
  for (const line of refLines) {
    const number = citationLineNumber(line);
    if (number > 0) { counts.set(number, (counts.get(number) || 0) + 1); used.add(number); }
  }
  let n = refLines.map(line => [citationLineNumber(line), sourceURLs(line)])
    .find(([num, urls]) => num > 0 && counts.get(num) === 1 && urls.includes(url))?.[0];
  const add = !n;
  if (add) {
    n = 1;
    while (used.has(n)) n++;
  }
  const mark = '[' + n + ']';
  const bodyEnd = heading < 0 ? text.length : lines.slice(0, heading).join('\n').trimEnd().length;
  const offset = clamp(Number.isInteger(cursor) ? cursor : bodyEnd, 0, bodyEnd);
  const beforeHeadingAtStart = heading === 0 ? '\n\n' : '';
  let draft = text.slice(0, offset) + mark + beforeHeadingAtStart + text.slice(offset);
  if (add) {
    const entry = [
      mark + ' ' + [source.authors, source.title, source.venue, source.year].filter(Boolean).join('. ') + '.',
      L.linkLabel + ': ' + url
    ].join(' ');
    const tail = draft.endsWith('\n') ? '' : '\n';
    draft += heading < 0 ? tail + '\n' + L.refsTitle + '\n' + entry : tail + entry;
  }
  return { value:draft, mark, cursor:offset + mark.length, added:add };
}
async function mutatePaperSources(record, fn) {
  const apply = latest => {
    if (!latest) throw new Error('paper-not-found');
    return { ...latest, sources:fn(paperSources(latest)) };
  };
  if (state.settings.storageDenied) return apply(record).sources;
  if (dbMode === 'idb') return new Promise((resolve, reject) => {
    const tr = db.transaction(STORE.papers, 'readwrite');
    const store = tr.objectStore(STORE.papers);
    const read = store.get(record.id);
    let error, checked;
    read.onsuccess = () => {
      try { checked = apply(read.result); store.put(checked); }
      catch (e) { error = e; tr.abort(); }
    };
    tr.oncomplete = () => resolve(checked.sources);
    tr.onabort = () => reject(error || tr.error || new Error('source notebook aborted'));
  });
  if (!navigator.locks) throw new Error('No safe local storage lock');
  return navigator.locks.request(lsKey(STORE.papers), () => {
    const records = JSON.parse(localStorage.getItem(lsKey(STORE.papers)) || '{}');
    const checked = apply(records[record.id]);
    records[record.id] = checked;
    localStorage.setItem(lsKey(STORE.papers), JSON.stringify(records));
    lsMem[STORE.papers] = records;
    return checked.sources;
  });
}
function renderPaperSourcesButton(record) {
  const button = $('#btn-paper-sources');
  if (!button) return;
  const n = paperSources(record).length;
  button.textContent = t('refs.open') + (n ? ' · ' + n : '');
}
const SOURCE_LABELS = {
  'paper-source-heading':'open','paper-source-intro':'purpose','paper-source-form-title':'record',
  'paper-source-tab-library':'local','paper-source-tab-form':'record',
  'paper-source-title-label':'title','paper-source-url-label':'url','paper-source-authors-label':'authors','paper-source-venue-label':'venue',
  'paper-source-year-label':'year','paper-source-notes-label':'notes','paper-source-read-label':'read','paper-source-ai-label':'ai',
  'paper-source-submit':'keep','paper-source-reset':'reset','paper-source-search-title':'search',
  'paper-source-search-tip':'searchTip','paper-source-search-submit':'find','paper-source-list-title':'local'
};
function applyPaperSourceLabels() {
  const copy = paperSourceUI();
  Object.entries(SOURCE_LABELS).forEach(([id, key]) => { $('#' + id).textContent = copy[key]; });
  $('#paper-source-query').setAttribute('aria-label', copy.query);
  $('#paper-source-query').placeholder = copy.query;
  $('#paper-source-close').setAttribute('aria-label', copy.close);
}
function setPaperNotebookView(view) {
  const modal = $('#modal-paper-sources');
  modal.dataset.view = view === 'form' ? 'form' : 'library';
  $('#paper-source-tab-library').setAttribute('aria-pressed', String(modal.dataset.view === 'library'));
  $('#paper-source-tab-form').setAttribute('aria-pressed', String(modal.dataset.view === 'form'));
}
function resetPaperSourceForm() {
  if (notebookSession?.busy) return;
  $('#paper-source-form').reset();
  if (notebookSession) notebookSession.editId = null;
  $('#paper-source-form-title').textContent = paperSourceUI().record;
  $('#paper-source-form-status').textContent = '';
}
function sourceCards(record) {
  const copy = paperSourceUI();
  const entries = paperSources(record);
  const cards = (records, candidate) => records.map((row,i) => {
    const isSaved = candidate && entries.some(v => v.url === row.url);
    const action = (name, label, disabled = false) => '<button type="button" class="btn mini" data-source-action="' + name +
      '" data-index="' + i + '"' + (disabled ? ' disabled' : '') + '>' + esc(label) + '</button>';
    const metadata = [row.authors,row.venue,row.year].filter(Boolean).join(' · ');
    const url = paperSourceURL(row.url);
    return '<article class="source-note-card"><div class="source-note-card-main"><strong>' + esc(row.title) + '</strong>' +
      (metadata ? '<div class="source-note-meta">' + esc(metadata) + '</div>' : '') +
      (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(url) + '</a>' : '') +
      (row.notes ? '<p class="source-note-private">' + esc(row.notes) + '</p>' : '') + '</div>' +
      '<div class="source-note-badges"><span class="meta-chip">' + esc(row.read ? copy.readBadge : copy.pendingBadge) + '</span>' +
      (row.ai ? '<span class="meta-chip">' + esc(copy.aiBadge) + '</span>' : '') + '</div><div class="source-note-actions">' +
      (candidate ? action('add', isSaved ? copy.added : copy.add, isSaved) :
        action('cite',copy.cite) + action('edit',copy.edit) + action('remove',copy.remove)) + '</div></article>';
  }).join('');
  $('#paper-source-list').innerHTML = cards(entries,false) || '<p class="empty-hint">' + esc(copy.empty) + '</p>';
  $('#paper-source-results').innerHTML = cards(notebookSession?.candidates || [],true);
  renderPaperSourcesButton(record);
}
function openPaperNotebook() {
  const paper = currentPaper();
  if (!paper || state.board !== 'paper' || state.genState.running) return toast(paperSourceUI().noCite,'warn');
  if ($('#modal-paper-sources').open) return;
  const cursor = $('#paper-editor').selectionEnd;
  notebookSession = { id:paper.id, editId:null, cursor, busy:false, search:null, candidates:[] };
  applyPaperSourceLabels();
  resetPaperSourceForm();
  $('#paper-source-query').value = paperSearchQuery($('#paper-topic').value) || '';
  $('#paper-source-search-status').textContent = paperSourceUI().idle;
  sourceCards(paper);
  const hasSources = paperSources(paper).length > 0;
  setPaperNotebookView(hasSources ? 'library' : 'form');
  $('#modal-paper-sources').showModal();
  if (hasSources && window.matchMedia('(max-width:680px)').matches) $('#paper-source-tab-library').focus();
  else $('#paper-source-title').focus();
}
function endPaperNotebook() {
  if ($('#modal-paper-sources').open) return;
  notebookSession?.search?.abort();
  notebookSession = null;
}
function closePaperNotebook(event) {
  if (event?.type === 'cancel') event.preventDefault();
  if ($('#modal-paper-sources').open) $('#modal-paper-sources').close();
  endPaperNotebook();
}
function sourceEditorRow(source) {
  const F = ['title','url','authors','venue','year','notes'];
  for (const f of F) $('#paper-source-' + f).value = source[f] || '';
  for (const f of ['read','ai']) $('#paper-source-' + f).checked = source[f] === true;
  setPaperNotebookView('form');
  $('#paper-source-form-title').textContent = paperSourceUI().editRecord;
  $('#paper-source-form-status').textContent = '';
  $('#paper-source-title').focus();
}
async function commitSourceChange(session, record, action) {
  if (session.busy) return false;
  const status = $('#paper-source-form-status');
  const copy = paperSourceUI();
  session.busy = true;
  $('#paper-source-submit').disabled = true;
  try {
    record.sources = await mutatePaperSources(record, action);
    if (notebookSession === session && currentPaper()?.id === record.id) {
      sourceCards(record);
      status.textContent = copy.saved;
    }
    if (state.settings.storageDenied) toast(draftNotice('memory'),'warn');
    return true;
  } catch (err) {
    if (notebookSession === session) status.textContent = ({duplicate:copy.duplicate,max:copy.max})[err.message] || copy.fail;
    toast(({duplicate:copy.duplicate,max:copy.max})[err.message] || copy.fail,'warn');
    return false;
  } finally {
    session.busy = false;
    $('#paper-source-submit').disabled = !!notebookSession?.busy;
  }
}
function setNotebookSource(list, entry, editingId) {
  if (list.some(x => x.url === entry.url && x.id !== editingId)) throw new Error('duplicate');
  if (!editingId && list.length >= PAPER_SOURCE_LIMIT) throw new Error('max');
  if (editingId && !list.some(x => x.id === editingId)) throw new Error('missing');
  return editingId ? list.map(x => x.id === editingId ? entry : x) : [...list, entry];
}
async function savePaperSource(event) {
  event.preventDefault();
  const session = notebookSession, record = currentPaper();
  if (!session || !record || record.id !== session.id || session.busy) return;
  const raw = {};
  for (const f of ['title','url','authors','venue','year','notes']) raw[f] = $('#paper-source-' + f).value;
  for (const f of ['read','ai']) raw[f] = $('#paper-source-' + f).checked;
  const editingId = session.editId;
  const entry = normalizePaperSource(raw, editingId || uid());
  if (!entry) { $('#paper-source-form-status').textContent = paperSourceUI().bad; return; }
  if (await commitSourceChange(session,record,list => setNotebookSource(list,entry,editingId)) && notebookSession === session) {
    resetPaperSourceForm();
    $('#paper-source-form-status').textContent = paperSourceUI().saved;
  }
}
async function handlePaperSource(event) {
  const button = event.target.closest('[data-source-action]');
  const session = notebookSession, record = currentPaper();
  if (!button || !session || !record || record.id !== session.id || session.busy) return;
  const i = Number(button.dataset.index), action = button.dataset.sourceAction;
  const source = (action === 'add' ? session.candidates : paperSources(record))[i];
  if (!source) return;
  if (action === 'cite') {
    if (state.genState.running || state.board !== 'paper') return toast(paperSourceUI().noCite,'warn');
    const ed = $('#paper-editor');
    const change = makePaperCitation(ed.value,session.cursor,source,paperLang($('#paper-lang').value));
    if (!change) return;
    ed.value = change.value;
    closePaperNotebook();
    ed.focus();
    ed.setSelectionRange(change.cursor,change.cursor);
    schedulePaperSave(); updatePaperCounts();
    toast(paperSourceUI().inserted.replace('{ref}',change.mark),'ok');
  } else if (action === 'edit') {
    session.editId = source.id;
    sourceEditorRow(source);
  } else if (action === 'remove') {
    // The native dialog is already modal, so ask inline instead of stacking a competing overlay.
    if (button.dataset.armed !== 'yes') {
      button.dataset.armed = 'yes';
      $('#paper-source-form-status').textContent = paperSourceUI().removePrompt;
      button.textContent = '✓ ' + paperSourceUI().remove;
      return;
    }
    if (await commitSourceChange(session,record,list => list.filter(row => row.id !== source.id)) && notebookSession === session && session.editId === source.id) resetPaperSourceForm();
  } else if (action === 'add') {
    const entry = normalizePaperSource(source);
    if (entry) await commitSourceChange(session,record,list => setNotebookSource(list,entry,null));
  }
}
async function searchPaperSources(event) {
  event.preventDefault();
  const session = notebookSession, record = currentPaper();
  const query = $('#paper-source-query').value.trim().slice(0,180);
  if (!session || !record || record.id !== session.id || !query) return;
  session.search?.abort();
  const abort = new AbortController();
  const status = $('#paper-source-search-status');
  const copy = paperSourceUI();
  session.search = abort;
  status.textContent = copy.finding;
  try {
    const candidates = await fetchRefs(query,8,abort.signal);
    if (notebookSession !== session || session.search !== abort || abort.signal.aborted) return;
    session.candidates = candidates.map(r => normalizePaperSource(r)).filter(Boolean);
    status.textContent = session.candidates.length ? copy.found.replace('{n}',session.candidates.length) : copy.noResults;
    sourceCards(record);
  } catch (e) {
    if (notebookSession === session && session.search === abort && !abort.signal.aborted) status.textContent = copy.noResults;
  }
}

function renderPaperPanel() {
  const list = [...state.papers].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  $('#panel-title').textContent = t('p.list');
  $('#panel-actions').innerHTML = '<button class="btn small primary" id="act-new-paper">＋ ' + t('p.new') + '</button>';
  const nb = $('#act-new-paper');
  if (nb) nb.addEventListener('click', newPaper);
  return list.map(p => `<div class="row-item ${p.id === state.currentPaperId ? 'active' : ''}" data-id="${p.id}" data-act="openpaper">
    <div class="row-main">
      <div class="row-title">${esc(p.title || t('novel.pending'))}</div>
      <div class="row-meta">${fmtNum(p.wordCount || 0)} ${t('stat.wordsChip')} · ${fmtTime(p.updatedAt)}</div>
    </div>
    <div class="row-actions">
      <button class="icon-btn danger" data-act="delpaper" data-id="${p.id}" title="${t('common.delete')}">✕</button>
    </div>
  </div>`).join('') || '<div class="empty-hint">' + t('p.empty') + '</div>';
}
async function newPaper() {
  cancelGen();
  await flushPaperSave();
  if (state.board !== 'paper') return;
  const p = {
    id: uid(), title: '', topic: '', content: '', status: 'draft',
    outLang: ['zh', 'en', 'ru'].includes(state.settings.lang) ? state.settings.lang : 'zh',
    wordCount: 0, createdAt: now(), updatedAt: now()
  };
  try { await dbPut(STORE.papers, p); }
  catch (error) { toast(draftNotice('failed'), 'err'); return; }
  if (state.board !== 'paper') { state.papers.push(p); return; }
  state.papers.push(p);
  state.currentPaperId = p.id;
  loadChatFor('paper-' + p.id).then(() => renderChat());
  renderAll();
  if (typeof setMobileBrief === 'function') setMobileBrief('paper', true);
  $('#paper-topic').focus();
}
function selectPaper(id) {
  if (id === state.currentPaperId) return;
  cancelGen();
  flushPaperSave();
  state.currentPaperId = id;
  loadChatFor('paper-' + id);
  renderEditor(); renderPanel();
}
async function delPaper(id) {
  if (!await confirmDialog(t('confirm.delChapter'))) return;
  const i = state.papers.findIndex(p => p.id === id);
  if (i < 0) return;
  if (state.currentPaperId === id) cancelGen();
  await dbDel(STORE.papers, id);
  await dbDel(STORE.chats, 'paper-' + id);
  state.papers.splice(i, 1);
  if (state.currentPaperId === id) {
    state.currentPaperId = state.papers[0] ? state.papers[0].id : null;
    await loadChatFor(state.currentPaperId ? 'paper-' + state.currentPaperId : null);
    renderEditor();
  }
  renderTop(); renderPanel();
  toast(t('toast.paperDeleted'));
}
function renderPaperEditor() {
  const p = currentPaper();
  const tEl = $('#paper-title'), st = $('#paper-status'), tp = $('#paper-topic'), ed = $('#paper-editor');
  $('#btn-paper-history').disabled = !p;
  $('#btn-paper-sources').disabled = !p;
  renderPaperSourcesButton(p);
  if (!p) {
    tEl.value = ''; st.value = 'draft'; tp.value = ''; ed.value = '';
    updatePaperCounts(); setPaperSaveState(null);
    return;
  }
  const pending = pendingDrafts.get(recoveryId(STORE.papers, p.id));
  const shown = pending ? { ...p, ...pending.delta } : p;
  if (document.activeElement !== tEl) tEl.value = shown.title || '';
  if (document.activeElement !== tp) tp.value = shown.topic || '';
  if (document.activeElement !== ed) ed.value = shown.content || '';
  st.value = shown.status || 'draft';
  $('#paper-lang').value = normalizeOutputLang(shown.outLang, state.settings.lang);
  ed.style.fontSize = state.settings.fontSize + 'px';
  updatePaperCounts();
  if (pending) state.paperDirty = true;
  setPaperSaveState(!state.paperDirty);
}
function updatePaperCounts() {
  const txt = $('#paper-editor').value;
  const words = countWords(txt);
  $('#paper-word-count').textContent = fmtNum(words) + ' ' + t('stat.wordsChip');
  $('#paper-status-words').textContent = t('stat.words', { a: fmtNum(countCJK(txt)), b: countLatin(txt) });
  const pos = $('#paper-editor').selectionStart || 0;
  const lines = txt.slice(0, pos).split('\n');
  $('#paper-status-pos').textContent = t('stat.pos', { a: lines.length, b: lines[lines.length - 1].length + 1 });
}
function setPaperSaveState(saved) {
  const el = $('#paper-save-state');
  if (saved === null) { el.textContent = '—'; el.className = 'meta-chip save-chip'; return; }
  el.textContent = saved ? '● ' + fmtTime(now()) : '◌ …';
  el.className = 'meta-chip save-chip ' + (saved ? 'saved' : 'dirty');
}
function schedulePaperSave() {
  state.paperDirty = true;
  setPaperSaveState(false);
  clearTimeout(state.paperSaveTimer);
  state.paperSaveTimer = setTimeout(() => savePaper(false), 900);
}
async function flushPaperSave() {
  clearTimeout(state.paperSaveTimer);
  if (state.paperDirty) await savePaper(false);
  else await draftWrites.get(currentPaper());
}
async function savePaper(manual) {
  const p = currentPaper();
  if (!p) { state.paperDirty = false; return; }
  clearTimeout(state.paperSaveTimer);
  if (!state.paperDirty) return draftWrites.get(p);
  const content = $('#paper-editor').value;
  const delta = { title: $('#paper-title').value.trim(), topic: $('#paper-topic').value,
    content, status: $('#paper-status').value, outLang: normalizeOutputLang($('#paper-lang').value, p.outLang),
    wordCount: countWords(content) };
  state.paperDirty = false;
  await persistDraft(STORE.papers, p, delta, manual);
}
/* 联网检索文献（Crossref + Semantic Scholar + 维基百科 三源并行 · 结果缓存提速） */
const REF_CACHE_KEY = 'nebula-ref-cache';
let refCache = {};
function loadRefCache() { try { refCache = JSON.parse(localStorage.getItem(REF_CACHE_KEY) || '{}'); } catch (e) { refCache = {}; } }
function saveRefCache() { try { localStorage.setItem(REF_CACHE_KEY, JSON.stringify(refCache)); } catch (e) { } }
function refTopicKey(topic) { return (topic || '').trim().toLowerCase().slice(0, 60); }
async function fetchRefs(topic, count, signal) {
  const key = refTopicKey(topic);
  if (refCache[key] && (Date.now() - refCache[key].t < 86400000) && refCache[key].refs.length) {
    return refCache[key].refs.filter(ref => ref && ref.title && safeReferenceURL(ref.url)).slice(0, count + 2);
  }
  const refs = [];
  const seen = new Set();
  const push = r => {
    const url = safeReferenceURL(r.url);
    if (!url || !r.title || seen.has(url)) return;
    seen.add(url);
    refs.push({ ...r, url });
  };
  const jobs = [
    (async () => {
      try {
        const r = await fetch('https://api.crossref.org/works?query=' + encodeURIComponent(topic) + '&rows=' + (count + 4) + '&select=title,author,URL,DOI,issued,container-title', { signal: generationTimeout(9000, signal) });
        if (!r.ok) return;
        const j = await r.json();
        for (const it of (j.message.items || [])) {
          const title = (it.title && it.title[0]) || '';
          const authors = (it.author || []).slice(0, 3).map(a => (a.given || '') + ' ' + (a.family || '')).join(', ');
          const year = it.issued && it.issued['date-parts'] && it.issued['date-parts'][0] ? String(it.issued['date-parts'][0][0]) : '';
          const url = it.URL || (it.DOI ? 'https://doi.org/' + it.DOI : '');
          const venue = (it['container-title'] && it['container-title'][0]) || '';
          if (title && url) push({ title: title.slice(0, 120), authors, year, venue, url });
        }
      } catch (e) { }
    })(),
    (async () => {
      try {
        const r = await fetch('https://api.semanticscholar.org/graph/v1/paper/search?query=' + encodeURIComponent(topic) + '&fields=title,authors,year,url,venue&limit=' + (count + 4), { signal: generationTimeout(9000, signal) });
        if (!r.ok) return;
        const j = await r.json();
        for (const it of (j.data || [])) {
          const title = it.title || '';
          const authors = (it.authors || []).slice(0, 3).map(a => a.name).join(', ');
          const url = it.url || '';
          if (title && url) push({ title: title.slice(0, 120), authors, year: it.year ? String(it.year) : '', venue: it.venue || '', url });
        }
      } catch (e) { }
    })(),
    (async () => {
      try {
        const r = await fetch('https://zh.wikipedia.org/w/api.php?action=opensearch&search=' + encodeURIComponent(topic.slice(0, 30)) + '&limit=4&format=json&origin=*', { signal: generationTimeout(8000, signal) });
        if (!r.ok) return;
        const j = await r.json();
        const titles = j[1] || [], urls = j[3] || [];
        for (let i = 0; i < titles.length; i++) push({ title: titles[i], authors: '', year: '', venue: '维基百科', url: urls[i] || '' });
      } catch (e) { }
    })()
  ];
  await Promise.allSettled(jobs);
  refs.sort((a, b) => (b.year || '').localeCompare(a.year || ''));
  const out = refs.slice(0, count + 2);
  if (out.length) {
    refCache[key] = { refs: out, t: Date.now() };
    saveRefCache();
  }
  return out;
}
function paperLang(lang = currentPaper()?.outLang) {
  const L = normalizeOutputLang(lang, state.settings.lang);
  const MAP = {
    zh: { write: '请用中文撰写整篇论文', fallback: '在线检索受限，参考文献待补充', linkLabel: '链接', dateLabel: '检索于', noRefs: '在线检索受限，参考文献待补充', refsTitle: '参考文献' },
    en: { write: '请用英文撰写整篇论文', fallback: 'Online search was limited; the reference list is to be supplemented.', linkLabel: 'Link', dateLabel: 'retrieved on', noRefs: 'Online search was limited; references to be supplemented.', refsTitle: 'References' },
    ru: { write: 'Пишите всю статью на русском языке', fallback: 'Онлайн-поиск был ограничен; список литературы будет дополнен.', linkLabel: 'Ссылка', dateLabel: 'дата обращения', noRefs: 'Онлайн-поиск ограничен; список литературы будет дополнен.', refsTitle: 'Список литературы' },
  };
  return MAP[L] || MAP.zh;
}
function refsToText(refs, L, only = null) {
  const line = value => String(value || '').replace(/\s+/g, ' ').trim();
  return refs.map((ref, i) => ({ref, n:i + 1})).filter(({n}) => !only || only.includes(n)).map(({ref:r, n}) => {
    return `[${n}] ${[line(r.authors), line(r.title), line(r.venue), line(r.year)].filter(Boolean).join('. ')}. ${L.linkLabel}: ${safeReferenceURL(r.url)}`;
  }).join('\n');
}
function buildPaperWithSources(raw, refs, L) {
  const body = splitPaperReferences(raw).body.trim();
  if (!body) return null;
  const { used, malformed } = paperCitationNumbers(body);
  if (malformed || used.some(n => n < 1 || !refs[n - 1] || !safeReferenceURL(refs[n - 1].url))
      || /https?:\/\/|(?:\bdoi\s*:\s*)?\b10\.\d{4,9}\//i.test(body)) return null;
  return used.length ? body + '\n\n' + L.refsTitle + '\n' + refsToText(refs, L, used) : body;
}
function cleanPaperText(s) {
  return s
    .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{FFFD}]/gu, '')
    .replace(/[✦✧✩✪✫✬✭✮✯✰✱✲✳✴✵✶✷✸✹✺✻✼✽✾✿❀❁❂❃❄❅❆❇❈❉❊❋☀☁★☆♠♣♥♦]/g, '');
}
async function paperDraft(topic, refsText, lenHint, L, task) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `请为以下论文拟写提纲（${L.write}，只输出提纲，不写正文；不使用表情或特殊符号）：\n【论文主题/要求】\n${topic}\n【可引用文献】\n${refsText || '（无）'}\n\n输出：\n【标题建议】1 个\n【摘要要点】2-3 句\n【章节结构】引言 / 方法或论述 / 分析与讨论 / 结论，每节 1-2 句要点\n字数目标：${lenHint}` }
  ];
  const res = await aiCallRetry(messages, task.opts, t('gp.pdraft'));
  return (await collectGeneration(res, task)).trim();
}
async function generatePaperCandidate(topic, draft, refsText, lenHint, L, task, refs) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `请根据以下内容撰写论文正文草稿（${L.write}），篇幅约 ${lenHint}。只输出正文，不要生成参考文献章节或链接。引用只可使用下方清单现有编号 [n]；多条写成 [1][2]，没有合适来源就不要加编号，并明确指出需要证据。清单只有书目信息，不要把它当成已阅读原文，不可虚构引语、页码、实证结果或来源。不要输出 DOI 或链接，系统会按正文实际用到的编号附上书目。
\n【论文主题/要求】\n${topic}\n\n【提纲】\n${draft}\n\n【候选来源】\n${refsText || '（无；不得使用 [n]）'}` }
  ];
  const res = await aiCallRetry(messages, task.opts, t('gp.pwrite'));
  const candidate = cleanPaperText(await collectGeneration(res, task, true));
  if (!candidate.trim()) throw new Error('empty');
  const formatted = buildPaperWithSources(candidate, refs, L);
  if (!formatted) throw new Error(t('p.refsInvalid'));
  return formatted;
}
async function generatePaper() {
  const p = currentPaper();
  if (!p || state.board !== 'paper') return toast(t('p.needOpen'), 'warn');
  const topicEl = $('#paper-topic'), language = $('#paper-lang'), ed = $('#paper-editor');
  const topic = topicEl.value.trim();
  if (!topic) {
    toast(t('p.needTopic'), 'warn');
    if (typeof setMobileBrief === 'function') setMobileBrief('paper', true);
    topicEl.focus();
    return;
  }
  const query = paperSearchQuery(topic);
  if (!query) { toast(t('p.topicRequired'),'warn'); topicEl.focus(); return; }
  if (state.genState.running || state.aiStreaming) return toast(t('toast.aiBusy'), 'warn');
  if (!activeProvider()) { toast(t('toast.noAI'), 'warn'); openAISettings(); return; }
  const before = ed.value;
  if (before.trim() && !await confirmDialog(t('p.overwrite'))) return;
  if (state.genState.running || state.aiStreaming || state.board !== 'paper' || currentPaper() !== p ||
      ed.value !== before || topicEl.value.trim() !== topic) return;
  const task = beginGeneration('paper', p, ed, [topicEl, language], language.value || p.outLang);
  const premium = PLAN_LEVEL[effectivePlan()] || 0;
  const refCount = premium >= 2 ? 15 : (premium === 1 ? 12 : 8);
  const lenHint = premium >= 2 ? '4000-5000 字' : (premium === 1 ? '3000-3500 字' : '1500-2000 字');
  const L = paperLang(task.opts.outputLang);
  try {
    await flushPaperSave();
    await genSetStage(task, 0, '');
    const selectedSources = paperSources(p).filter(source => source.ai);
    const refs = combinePaperSources(selectedSources, await fetchRefs(query, refCount, task.opts.signal), refCount);
    generationGuard(task);
    const refsText = refsToText(refs, L);
    renderGenStages(t('gp.refsFound', { n: refs.length }));
    await generationDelay(400, task.opts.signal);
    await genSetStage(task, 1, '');
    const draft = await paperDraft(topic, refsText, lenHint, L, task);
    renderGenStages(draft.slice(0, 140));
    await generationDelay(400, task.opts.signal);
    const refCtx = '论文主题：' + topic + '\n可引用文献：\n' + refsText;
    const candidate = await reviewedCandidate(task, () => generatePaperCandidate(topic, draft, refsText, lenHint, L, task, refs), refCtx);
    if (candidate && applyGeneratedDraft(task, candidate)) toast(t('p.done'), 'ok', 4000);
  } catch (e) {
    if (e?.name === 'AbortError') toast(t('co.cancelled'));
    else toast(humanizeAIError(e), 'err', 6000);
  } finally {
    finishGeneration(task);
  }
}
function buildPaperContext() {
  const p = currentPaper();
  const parts = ['【论文板块】'];
  if (p) {
    parts.push(`论文标题：《${p.title || t('novel.pending')}》\n主题/要求：${p.topic || '（无）'}\n当前正文（结尾部分）：\n${(p.content || '').slice(-4000)}`);
  } else {
    parts.push('（尚未打开论文）');
  }
  return parts.join('\n\n');
}
function chatKey() {
  return state.board === 'paper' ? ('paper-' + state.currentPaperId) : state.currentNovelId;
}

/* ---------------- 更新完成弹窗（每次更新后上线自动提示） ---------------- */
async function checkChangelog() {
  try {
    let data = null;
    try { const r = await fetch('changelog.json?v=' + Date.now()); if (r.ok) data = await r.json(); } catch (e) { }
    if (!data) {
      try {
        const r2 = await fetch('https://akc071001-max.github.io/xiaoxing/changelog.json?v=' + Date.now(), { signal: AbortSignal.timeout(8000) });
        if (r2.ok) data = await r2.json();
      } catch (e2) { }
    }
    if (!data || !data.version) return;
    const seen = localStorage.getItem('nebula-seen-version');
    if (seen === data.version) return;
    if (!seen && APP_VERSION === data.version) {
      // 全新用户直接是最新版，无需弹窗
      try { localStorage.setItem('nebula-seen-version', data.version); } catch (e) { }
      return;
    }
    if ($('#modal-quick-start').open || $$('.modal-overlay:not([hidden])').length) return;
    $('#upd-version').textContent = data.version + (data.date ? ' · ' + data.date : '');
    lastChangelogVersion = data.version;
    const items = state.settings.lang === 'en' ? (data.itemsEn || data.items) : (state.settings.lang === 'ru' ? (data.itemsRu || data.items) : data.items);
    $('#upd-items').innerHTML = (items || []).map(it =>
      `<div class="upd-item"><div class="upd-item-title">✦ ${esc(it.title || '')}</div><div class="upd-item-desc">${esc(it.desc || '')}</div></div>`
    ).join('');
    openModal('modal-update');
  } catch (e) { }
}

/* ---------------- 设置中心 ---------------- */
function adjustFont(d) {
  state.settings.fontSize = clamp(state.settings.fontSize + d, 14, 32);
  saveSettings();
  applyUIPrefs();
  const v = $('#set-font-val');
  if (v) v.textContent = state.settings.fontSize + 'px';
}
function setLang(l) {
  l = normalizeOutputLang(l);
  if (state.settings.lang === l) return;
  state.settings.lang = l;
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
  $('#set-lang-ru').classList.toggle('on', s.lang === 'ru');
  $('#set-admin-bg-on').classList.toggle('on', s.adminBg !== false);
  $('#set-admin-bg-off').classList.toggle('on', s.adminBg === false);
  const bgRow = $('#admin-bg-row');
  if (bgRow) bgRow.style.display = isAdminNow() ? '' : 'none';
}
function openSettings() {
  const s = state.settings;
  $('#set-font-val').textContent = s.fontSize + 'px';
  refreshSettingsChips();
  $$('#modal-settings .accent-dot').forEach(d => d.classList.toggle('on', d.dataset.accent === s.accent));
  const u = s.user || {};
  $('#set-profile-name').textContent = u.nickname || t('profile.default');
  $('#set-profile-avatar').innerHTML = u.avatarData ? '<img src="' + u.avatarData + '" alt="" />' : esc(AVATAR_PRESETS[u.avatarPreset || 0][0]);
  refreshAccountLabel();
  $('#set-version').textContent = APP_VERSION;
  // 管理版老用户补充邮箱（注册已必填，用于确认用户信息）
  const emailRow = $('#set-email-row');
  if (emailRow) {
    const needEmail = authMode === 'managed' && serverUser && !serverUser.email;
    emailRow.style.display = needEmail ? '' : 'none';
    if (needEmail) $('#set-email-input').value = '';
  }
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
  $('#btn-vip').addEventListener('click', () => { renderVip(); openModal('modal-vip'); });
  $('#btn-profile').addEventListener('click', openProfile);
  // 站长操作台（管理员站内直接管理 · 重制版）
  bindAdminConsole();
  // 板块切换（小说 / 论文）
  $('#board-novel').addEventListener('click', () => setBoard('novel'));
  $('#board-paper').addEventListener('click', () => setBoard('paper'));
  // 论文板块
  $('#btn-paper-guide').addEventListener('click', openPaperGuide);
  $('#btn-paper-sources').addEventListener('click', openPaperNotebook);
  $('#paper-source-form').addEventListener('submit', savePaperSource);
  $('#paper-source-reset').addEventListener('click', () => { resetPaperSourceForm(); $('#paper-source-title').focus(); });
  $('#paper-source-list').addEventListener('click', handlePaperSource);
  $('#paper-source-results').addEventListener('click', handlePaperSource);
  $('#paper-source-search').addEventListener('submit', searchPaperSources);
  $('#modal-paper-sources').addEventListener('cancel', closePaperNotebook);
  $('#modal-paper-sources').addEventListener('close', endPaperNotebook);
  $('#paper-source-close').addEventListener('click', closePaperNotebook);
  $('#paper-source-tab-library').addEventListener('click', () => setPaperNotebookView('library'));
  $('#paper-source-tab-form').addEventListener('click', () => setPaperNotebookView('form'));
  $('#paper-source-open-notes').addEventListener('click', () => {
    closeModal('modal-paper-guide');
    openPaperNotebook();
  });
  $('#modal-paper-guide').addEventListener('click', e => {
    const option = e.target.closest('[data-paper-template]');
    if (option) insertPaperTemplate(option.dataset.paperTemplate);
  });
  $('#btn-paper-audit').addEventListener('click', showPaperReferenceAudit);
  $('#paper-title').addEventListener('input', schedulePaperSave);
  $('#paper-topic').addEventListener('input', schedulePaperSave);
  $('#paper-status').addEventListener('change', schedulePaperSave);
  $('#paper-lang').addEventListener('change', schedulePaperSave);
  $('#paper-editor').addEventListener('input', () => { schedulePaperSave(); updatePaperCounts(); });
  $('#paper-editor').addEventListener('keyup', updatePaperCounts);
  $('#paper-editor').addEventListener('click', updatePaperCounts);
  $('#btn-paper-gen').addEventListener('click', generatePaper);
  $('#btn-paper-again').addEventListener('click', generatePaper);
  $('#btn-paper-upgrade').addEventListener('click', () => { renderVip(); openModal('modal-vip'); });
  // 导航
  $('#main-nav').addEventListener('click', e => {
    const b = e.target.closest('.nav-item');
    if (!b) return;
    const sameModule = state.module === b.dataset.module;
    state.module = b.dataset.module;
    if (inMobileWorkspace()) setMobilePanel(!sameModule || !document.body.classList.contains('mobile-panel-open'));
    setNavActive(); renderPanel();
  });
  const mobileQuery = matchMedia('(max-width: 680px)');
  mobileQuery.addEventListener('change', syncMobileWorkspace);
  $('#btn-mobile-outline').addEventListener('click', e => setMobileBrief('novel', e.currentTarget.getAttribute('aria-expanded') !== 'true'));
  $('#btn-mobile-topic').addEventListener('click', e => setMobileBrief('paper', e.currentTarget.getAttribute('aria-expanded') !== 'true'));
  $('#btn-mobile-paper-list').addEventListener('click', e => setMobilePanel(e.currentTarget.getAttribute('aria-expanded') !== 'true'));
  $('#btn-mobile-paper-ai').addEventListener('click', e => setMobileAI(e.currentTarget.getAttribute('aria-expanded') !== 'true'));
  $('#btn-mobile-assistant').addEventListener('click', openAssistant);
  bindMobileWritingKeys();
  $('#btn-mobile-panel-close').addEventListener('click', () => {
    setMobilePanel(false);
    (state.board === 'paper' ? $('#btn-mobile-paper-list') : $('#main-nav .nav-item.active'))?.focus();
  });
  for (const id of ['board-novel', 'board-paper']) $('#' + id).addEventListener('click', () => {
    if (inMobileWorkspace()) { setMobilePanel(false); setMobileAI(false, false); }
  });
  $('#panel-body').addEventListener('click', e => {
    const action = e.target.closest('[data-act]')?.dataset.act;
    if (inMobileWorkspace() && (action === 'open' || action === 'openpaper')) setMobilePanel(false);
  });
  $('#panel-actions').addEventListener('click', e => {
    if (inMobileWorkspace() && e.target.closest('#act-new-paper,#act-new-chapter')) setMobilePanel(false);
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
  $('#btn-chapter-history').addEventListener('click', () => openDraftHistory(false));
  bindManuscriptSearch();
  $('#btn-chapter-coach').addEventListener('click', openChapterCoach);
  $('#set-install-app').addEventListener('click', openInstallApp);
  $('#chapter-coach-example').addEventListener('change', updateCoachExample);
  $('#modal-chapter-coach').addEventListener('input', syncCoachProgress);
  $('#chapter-coach-add').addEventListener('click', applyChapterCoach);
  $('#btn-paper-history').addEventListener('click', () => openDraftHistory(true));
  $('#draft-history-list').addEventListener('change', previewDraftHistory);
  $('#draft-history-restore').addEventListener('click', restoreDraftHistory);
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
  // 账户 / 登录注册（密码必须字母+数字；登录界面可切换语言）
  document.addEventListener('click', e => {
    const al = e.target.closest('[data-authlang]');
    if (al) setLang(al.dataset.authlang);
  });
  $('#auth-tab-login').addEventListener('click', () => switchAuthTab('login'));
  // 忘记密码（密保问题找回）
  $('#btn-auth-forgot').addEventListener('click', openForgot);
  $('#btn-auth-bridge-forgot')?.addEventListener('click', () => startMirrorSignIn('forgot'));
  $('#btn-auth-bridge-switch')?.addEventListener('click', switchAccountConnectionUser);
  $('#btn-forgot-back').addEventListener('click', closeForgot);
  $('#btn-forgot-reset').addEventListener('click', submitForgotReset);
  $('#forgot-user').addEventListener('keydown', e => { if (e.key === 'Enter') askForgotQuestion(); });
  $('#forgot-answer').addEventListener('keydown', e => { if (e.key === 'Enter') submitForgotReset(); });
  $('#forgot-pass').addEventListener('keydown', e => { if (e.key === 'Enter') submitForgotReset(); });
  $('#auth-question').addEventListener('change', () => {
    $('#auth-answer-wrap').style.display = $('#auth-question').value ? '' : 'none';
  });
  $('#auth-tab-register').addEventListener('click', () => switchAuthTab('register'));
  $('#btn-auth-submit').addEventListener('click', authSubmit);
  ['auth-user', 'auth-pass', 'auth-pass2'].forEach(id => {
    $('#' + id).addEventListener('keydown', e => { if (e.key === 'Enter') authSubmit(); });
  });
  $('#set-logout').addEventListener('click', logoutUser);
  $('#set-login').addEventListener('click', () => {
    closeModal('modal-settings');
    switchAuthTab('login');
    openModal('modal-auth');
    $(mirrorConfigured() || confirmConnectedUser ? '#btn-auth-submit' : '#auth-user').focus();
  });
  $('#btn-auth-guest').addEventListener('click', continueLocalWriting);
  document.addEventListener('visibilitychange', syncPresence);
  window.addEventListener('pagehide', stopPresence);
  window.addEventListener('pageshow', e => { if (e.persisted) syncPresence(); });
  window.addEventListener('online', async () => {
    if (authBusy) return;
    if (authMode === 'managed' && serverUser) { void heartbeat(); return; }
    if (authMode !== 'local') {
      await setUpAccountMode({restore:true});
      loadAccountConnection();
      renderAuthModeCopy();
      if (accountConnection) { advanceOnboarding(); return; }
      if (!serverUser) return;
      if (!$('#modal-auth').hidden) closeModal('modal-auth');
      renderVip();
      advanceOnboarding();
      syncPresence();
    }
  });
  $('#btn-quick-start').addEventListener('click', openQuickStart);
  $('#btn-quick-close').addEventListener('click', () => $('#modal-quick-start').close());
  $('#modal-quick-start').addEventListener('close', finishQuickStart);
  $('#modal-quick-start').addEventListener('click', e => {
    const card = e.target.closest('[data-quick-action]');
    if (card) runQuickStart(card.dataset.quickAction).catch(() => toast(draftNotice('failed'), 'err'));
  });
  // 更新弹窗
  $('#btn-upd-done').addEventListener('click', () => {
    closeModal('modal-update');
    try { localStorage.setItem('nebula-seen-version', lastChangelogVersion || APP_VERSION); } catch (e) { }
  });
  // 会员方案
  $('#btn-vip').addEventListener('click', () => { renderVip(); openModal('modal-vip'); });
  document.addEventListener('click', e => {
    const v = e.target.closest('[data-plan]');
    if (v && !v.disabled) setPlan(v.dataset.plan);
    const oc = e.target.closest('[data-orcopy]');
    if (oc) { copyText(oc.dataset.orcopy); }
  });
  // DeepSeek 月度会员：付费协议与收款流程
  $('#agr-agree-chk').addEventListener('change', updateAgrSignBtn);
  $('#agr-sign-name').addEventListener('input', updateAgrSignBtn);
  $('#btn-agr-sign').addEventListener('click', signAgreement);
  $('#btn-agr-paid').addEventListener('click', submitDeepseekPaid);
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
  // 管理员专属背景切换（管理员也可以使用普通版背景）
  $('#set-admin-bg-on').addEventListener('click', () => { state.settings.adminBg = true; saveSettings(); applyUIPrefs(); refreshSettingsChips(); toast(t('set.adminBgOn'), 'ok', 2500); });
  $('#set-admin-bg-off').addEventListener('click', () => { state.settings.adminBg = false; saveSettings(); applyUIPrefs(); refreshSettingsChips(); toast(t('set.adminBgOff'), 'ok', 2500); });
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
  $('#set-lang-zh').addEventListener('click', () => setLang('zh'));
  $('#set-lang-en').addEventListener('click', () => setLang('en'));
  $('#set-lang-ru').addEventListener('click', () => setLang('ru'));
  $('#set-profile-edit').addEventListener('click', openProfile);
  $('#set-backup').addEventListener('click', () => { closeModal('modal-settings'); openModal('modal-backup'); });
  $('#set-ai').addEventListener('click', () => { closeModal('modal-settings'); openAISettings(); });
  $('#set-feedback').addEventListener('click', () => openModal('modal-feedback'));
  $('#set-terms').addEventListener('click', openTerms);
  $('#btn-check-update').addEventListener('click', checkUpdate);
  // 支持创作者（打赏 · 内嵌开发者名单 · 无弹窗）
  $('#btn-tip-send').addEventListener('click', submitTip);
  $('#tip-custom').addEventListener('input', e => {
    state.tipAmount = e.target.value || null;
    if (state.tipAmount) $$('.dev-tip [data-tip]').forEach(b => b.classList.remove('on'));
  });
  document.addEventListener('click', e => {
    const t3 = e.target.closest('.dev-tip [data-tip]');
    if (t3) {
      state.tipAmount = t3.dataset.tip;
      $$('.dev-tip [data-tip]').forEach(b => b.classList.toggle('on', b === t3));
      $('#tip-custom').value = '';
    }
  });
  // AI 面板
  $('#btn-ai-toggle').addEventListener('click', () => {
    if (inMobileWorkspace()) { setMobileAI(!document.body.classList.contains('mobile-ai-open')); return; }
    state.settings.aiPanelOpen = !state.settings.aiPanelOpen; saveSettings(); applyUIPrefs();
  });
  $('#btn-ai-close').addEventListener('click', () => {
    if (inMobileWorkspace()) {
      setMobileAI(false, false);
      (state.board === 'paper' ? $('#btn-mobile-paper-ai') : $('#btn-ai-toggle'))?.focus();
      return;
    }
    state.settings.aiPanelOpen = false; saveSettings(); applyUIPrefs();
  });
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
  $('#btn-export-docx').addEventListener('click', exportWord);
  $('#btn-export-json').addEventListener('click', exportJson);
  $('#btn-import-json').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', e => { const f = e.target.files[0]; if (f) doImport(f); });
  $('#btn-wipe').addEventListener('click', wipeAll);

/* ---------------- 沉浸式写作：模拟聊天界面，用角色对话写小说 ---------------- */
let imSpeaker = '';
function openImmersive() {
  if (!curNovel()) return toast(t('im.needNovel'), 'warn');
  if (!curChapter()) return toast(t('im.needChapter'), 'warn');
  if (!state.immersive || state.immersive.chapterId !== curChapter().id) {
    state.immersive = { chapterId: curChapter().id, novelId: state.currentNovelId, messages: [] };
  }
  $('#im-novel-title').textContent = curNovel().title || t('im.untitled');
  imSpeaker = '';
  renderImSpeakers();
  renderImList();
  $('#im-status').textContent = '';
  $('#immersive').hidden = false;
  $('#im-input').focus();
}
function imChars() {
  return state.characters.filter(c => c.novelId === state.currentNovelId);
}
function renderImSpeakers() {
  const chars = imChars();
  const names = chars.map(c => c.name).filter(Boolean);
  if (!imSpeaker) imSpeaker = names[0] || '';
  $('#im-speakers').innerHTML =
    (imSpeaker ? '' : '<button class="chip mini" data-imspeaker="">' + t('im.narrator') + '</button>') +
    names.map(n => `<button class="chip mini ${n === imSpeaker ? 'on' : ''}" data-imspeaker="${esc(n)}">${esc(n)}</button>`).join('');
  $('#im-speakers').querySelectorAll('[data-imspeaker]').forEach(b => {
    b.addEventListener('click', () => { imSpeaker = b.dataset.imspeaker; renderImSpeakers(); $('#im-input').focus(); });
  });
}
function renderImList() {
  const msgs = state.immersive?.messages || [];
  $('#im-list').innerHTML = msgs.map((m, i) => `
    <div class="im-msg ${i % 2 === 0 ? '' : 'me'}">
      <div class="im-avatar">${esc((m.speaker || t('im.narrator')).slice(0, 1))}</div>
      <div class="im-bubble"><span class="im-speaker">${esc(m.speaker || t('im.narrator'))}</span>${esc(m.text)}</div>
    </div>`).join('') || '<div class="empty-hint">' + t('im.hint') + '</div>';
  const body = $('#im-list');
  body.scrollTop = body.scrollHeight;
}
function sendImMsg() {
  const text = $('#im-input').value.trim();
  if (!text || !state.immersive) return;
  state.immersive.messages.push({ speaker: imSpeaker, text, t: Date.now() });
  $('#im-input').value = '';
  persistImmersive();
  renderImList();
  $('#im-input').focus();
}
function persistImmersive() { try { localStorage.setItem('nebula-immersive', JSON.stringify(state.immersive)); } catch (_) { } }
function closeImmersive() {
  if (state.imRunning) { try { state.imAbort?.abort(); } catch (_) { } return; }
  $('#immersive').hidden = true;
}
async function finishImmersiveChapter() {
  if (!state.immersive || !state.immersive.messages.length) return toast(t('im.empty'), 'warn');
  const ok = await confirmDialog(t('im.confirm'));
  if (!ok) return;
  state.imRunning = true;
  state.imAbort = new AbortController();
  $('#im-finish').disabled = true;
  $('#im-status').textContent = t('im.generating');
  try {
    const novel = curNovel();
    const chapter = curChapter();
    const transcript = state.immersive.messages.map(m => (m.speaker || t('im.narrator')) + '：' + m.text).join('\n');
    const charsTxt = imChars().length ? '【角色卡】\n' + imChars().map(c => c.name + '：' + String(c.desc || '').slice(0, 160)).join('\n') : '';
    const tail = String(chapter.content || '').slice(-400);
    const system = t('im.system', {
      title: novel?.title || '', genre: novel?.genre || '', style: novel?.style || '',
      chars: charsTxt, tail: tail, transcript: transcript
    });
    const candidate = (await aiRequest([
      { role: 'system', content: system },
      { role: 'user', content: transcript }
    ], { signal: state.imAbort.signal, outputLang: novel?.lang })).trim();
    if (!candidate) throw new Error('empty');
    chapter.content = (chapter.content ? chapter.content.replace(/\s+$/, '') + '\n\n' : '') + candidate;
    $('#editor').value = chapter.content;
    updateCounts(); scheduleSave();
    $('#im-status').textContent = '';
    state.immersive = { chapterId: chapter.id, novelId: state.currentNovelId, messages: [] };
    persistImmersive();
    $('#immersive').hidden = true;
    toast(t('im.done'), 'ok', 5000);
  } catch (e) {
    $('#im-status').textContent = String(e && e.message || e).includes('abort') ? '' : (t('im.fail') + ' ' + String(e && e.message || '').slice(0, 80));
  } finally {
    state.imRunning = false;
    state.imAbort = null;
    $('#im-finish').disabled = false;
  }
}
function bindImmersive() {
  $('#btn-immersive').addEventListener('click', openImmersive);
  $('#im-close').addEventListener('click', closeImmersive);
  $('#im-send').addEventListener('click', sendImMsg);
  $('#im-finish').addEventListener('click', finishImmersiveChapter);
  $('#im-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) sendImMsg(); });
}

/* ---------------- 分享系统 ---------------- */
function shareText() {
  const copy = { zh: '晓星 XIAOXING——免费 AI 写小说、写论文，还能在聊天界面里用角色对话沉浸式创作！', en: 'Xiaoxing XIAOXING — free AI novel & paper writing, with immersive character-chat writing!', ru: 'Сяосин XIAOXING — бесплатное написание романов и работ с ИИ и погружением в чат персонажей!' };
  return (copy[state.settings.lang] || copy.zh) + '\n' + location.href;
}
function openShare() {
  $('#share-link').value = location.href;
  const qr = $('#share-qr');
  qr.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=' + encodeURIComponent(location.href);
  qr.onerror = () => { qr.style.display = 'none'; };
  const api = $('#btn-share-api');
  const canShare = typeof navigator.share === 'function';
  api.style.display = canShare ? '' : 'none';
  openModal('modal-share');
}
function bindShare() {
  $('#btn-share').addEventListener('click', openShare);
  $('#btn-share-api').addEventListener('click', async () => {
    try {
      await navigator.share({ title: '晓星 XIAOXING', text: shareText(), url: location.href });
    } catch (e) { }
  });
  $('#btn-share-copy-link').addEventListener('click', () => { copyText(location.href); toast(t('share.copied'), 'ok', 2500); });
  $('#btn-share-copy-text').addEventListener('click', () => { copyText(shareText()); toast(t('share.copied'), 'ok', 2500); });
}

/* ---------------- 跨设备完整备份（无服务器 · 账号+数据密码加密） ---------------- */
async function xdevKey(pass, saltStr, usage) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(saltStr), iterations: 30000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, [usage]);
}
function xdevPassValid(p) { return p.length >= 6 && p.length <= 64 && /[A-Za-z]/.test(p) && /\d/.test(p); }
function xdevB64(buf) {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return 'XXB1.' + btoa(s);
}
function xdevUnb64(text) {
  if (!text || typeof text !== 'string') return null;
  const body = text.trim().replace(/\s+/g, '').replace(/^XXB1\./, '');
  try {
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch (_) { return null; }
}
async function exportFullBackup() {
  window.__xdevRan = (window.__xdevRan || 0) + 1;
  const pass = $('#xdev-pass').value;
  if (!state.currentUser) return toast(t('backup.xdevNeedLogin'), 'warn');
  if (!xdevPassValid(pass)) return toast(t('backup.xdevPassRule'), 'warn');
  try {
    const payload = JSON.stringify({
      v: 1, exportedAt: Date.now(), fromUser: state.currentUser,
      accounts: state.accounts, novels: state.novels, chapters: state.chapters,
      outline: state.outline, characters: state.characters, memories: state.memories,
      papers: state.papers, settings: state.settings
    });
    const key = await xdevKey(pass, 'xiaoxing-xdev-v1', 'encrypt');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(payload));
    const merged = new Uint8Array(12 + ct.byteLength);
    merged.set(iv, 0);
    merged.set(new Uint8Array(ct), 12);
    const blobText = xdevB64(merged);
    window.__xdevStage = 'encrypted';
    window.__lastXdev = blobText;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([blobText], { type: 'application/octet-stream' }));
    a.download = '晓星-跨设备备份-' + state.currentUser + '-' + new Date().toISOString().slice(0, 10) + '.xxb';
    document.body.appendChild(a); a.click(); a.remove();
    try { await copyText(blobText); } catch (_) { }
    toast(t('backup.xdevOk'), 'ok', 5000);
  } catch (e) {
    window.__xdevErr = String(e?.message || e);
    toast(t('backup.xdevBad'), 'err');
  }
}
async function importFullBackup(text) {
  const pass = $('#xdev-import-pass').value;
  if (!xdevPassValid(pass)) return toast(t('backup.xdevPassRule'), 'warn');
  const merged = xdevUnb64(text);
  if (!merged || merged.length <= 12) return toast(t('backup.xdevBad'), 'err');
  const iv = merged.subarray(0, 12);
  const ct = merged.subarray(12);
  try {
    const key = await xdevKey(pass, 'xiaoxing-xdev-v1', 'decrypt');
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    const data = JSON.parse(new TextDecoder().decode(pt));
    if (data.v !== 1) throw new Error('bad version');
    // 合并：账号（保留本机已有，补充缺失）、作品按 id 合并并写入本地库、设置浅合并
    for (const u of Object.keys(data.accounts || {})) {
      if (!Object.hasOwn(state.accounts, u)) {
        Object.defineProperty(state.accounts, u, { value: data.accounts[u], enumerable: true, writable: true, configurable: true });
      }
    }
    const mergeStore = (targetArr, incoming, store) => {
      for (const item of Object.values(incoming || {})) {
        if (item && item.id && !targetArr.some(x => x.id === item.id)) {
          targetArr.push(item);
          dbPut(store, item).catch(() => { });
        }
      }
    };
    mergeStore(state.novels, data.novels, STORE.novels);
    mergeStore(state.chapters, data.chapters, STORE.chapters);
    mergeStore(state.outline, data.outline, STORE.outline);
    mergeStore(state.characters, data.characters, STORE.characters);
    mergeStore(state.memories, data.memories, STORE.memories);
    mergeStore(state.papers, data.papers, STORE.papers);
    if (data.settings) state.settings = Object.assign({}, data.settings, state.settings);
    saveAccounts();
    renderAll(); applyUIPrefs();
    window.__xdevImported = true;
    toast(t('backup.xdevRestored'), 'ok', 5000);
  } catch (e) {
    toast(t('backup.xdevBad'), 'err');
  }
}
  // 跨设备完整备份（账号+数据，密码加密）
  $('#btn-xdev-export')?.addEventListener('click', exportFullBackup);
  $('#btn-xdev-import-file')?.addEventListener('click', () => $('#xdev-file')?.click());
  $('#xdev-file')?.addEventListener('change', e => { const f = e.target.files[0]; if (f) f.text().then(txt => importFullBackup(txt)); });
  $('#btn-xdev-import-text')?.addEventListener('click', () => { const box = $('#xdev-text-wrap'); if (box) { box.hidden = !box.hidden; if (!box.hidden) $('#xdev-text').focus(); } });
  $('#btn-xdev-import-go')?.addEventListener('click', () => importFullBackup($('#xdev-text').value.trim()));
  // 沉浸式写作
  bindImmersive();
  // 分享系统
  bindShare();
  // 首次保存历史提示（只提示一次）
  if (window.__hintBound) return;
  window.__hintBound = true;
  const historyHint = () => {
    try {
      if (localStorage.getItem('nebula-history-hint')) return;
      localStorage.setItem('nebula-history-hint', '1');
      toast(t('history.hint'), 'ok', 6000);
    } catch (_) { }
  };
  document.addEventListener('historyFirstSave', historyHint, { once: true });
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
    advanceOnboarding();
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
  $('#btn-add-provider').addEventListener('click', () => openModelForm());
  $('#model-add-local').addEventListener('click', () => openModelForm(null, true));
  $('#model-use-default').addEventListener('click', useBuiltinProvider);
  $('#model-test-active').addEventListener('click', () => testProvider(true));
  $('#model-hide-form').addEventListener('click', () => { hideModelForm(); $('#btn-add-provider').focus(); });
  $('#provider-list').addEventListener('click', e => {
    const row = e.target.closest('.prov-row');
    if (!row) return;
    const provider = state.settings.providers.find(p => p.id === row.dataset.id);
    if (!provider) return;
    if (e.target.closest('[data-use-provider]')) {
      useProvider(provider);
      setModelStatus('model.switched', 'ok', {name: modelDisplayName(provider)});
      $('#model-test-active').focus();
    } else if (e.target.closest('[data-edit-provider]')) openModelForm(provider);
  });
  $('#preset-select').addEventListener('change', e => {
    if (e.target.value !== '') applyModelPreset(Number(e.target.value));
  });
  $('#btn-prov-save').addEventListener('click', saveProvider);
  $('#btn-prov-test').addEventListener('click', () => testProvider(false));
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
  // 模态关闭（登录/须知/存储授权/付费协议等关键弹窗不允许点背景关闭，防手机误触）
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-close]');
    if (c) { closeModal(c.dataset.close); return; }
    if (e.target.id === 'modal-confirm') { $('#btn-confirm-cancel').click(); return; }
    if (e.target.classList && e.target.classList.contains('modal-overlay')) {
      if (['modal-auth', 'modal-terms', 'modal-storage', 'modal-agreement'].includes(e.target.id)) return;
      closeModal(e.target.id);
    }
  });
  window.__bindingsComplete = true;
  // 快捷键
  document.addEventListener('keydown', e => {
    if (handleManagedModalKeys(e)) return;
    if (e.key === 'Escape' && !$('#modal-confirm').hidden) {
      e.preventDefault();
      $('#btn-confirm-cancel').click();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      if (document.activeElement && document.activeElement.id === 'ai-input') { const t2 = $('#ai-input').value.trim(); if (t2) { $('#ai-input').value = ''; sendAI(t2); } }
      else if (state.board === 'paper') savePaper(true);
      else saveChapter(true);
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
      const w = editorSelectionWord();
      if (w) { e.preventDefault(); openDict(w); }
    }
    if (e.key === 'Escape' && document.body.classList.contains('focus-mode')) toggleFocus(false);
  });
  // 离开页面前保存
  document.addEventListener('visibilitychange', () => { if (document.hidden) { flushSave(); flushPaperSave(); } });
  window.addEventListener('pagehide', () => { flushSave(); flushPaperSave(); syncPendingDrafts(); });
}

/* ---------------- 模型预设 ---------------- */
function fillPresetSelect() {
  const sel = $('#preset-select');
  sel.innerHTML = '<option value="">— ' + t('aiset.preset') + ' —</option>';
  PRESETS.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = String(i); o.textContent = p.name;
    sel.appendChild(o);
  });
}

/* ---------------- 启动 ---------------- */
function loadAccountConnection() {
  if (mirrorConfigured()) return;
  if (authMode === 'local') { accountBridge?.clearIncoming(); return; }
  if (authMode !== 'managed' || accountConnection) return;
  accountConnection = accountBridge?.incoming() || null;
  if (accountConnection) state.settings.lang = normalizeOutputLang(accountConnection.lang, state.settings.lang);
}
async function boot() {
  loadSettings();
  loadImmersive();
  state.board = state.settings.board === 'paper' ? 'paper' : 'novel';
  loadWikiCache();
  await setUpAccountMode({restore:true});
  loadAccountConnection();
  lastTrialState = trialActive();
  loadRefCache();
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
  setupInstallApp();
  if (typeof DraftReview !== 'undefined') DraftReview.install();
  await dbInit();
  loadResumeIds();
  await replayPendingDrafts();
  await loadAll();
  if (state.board === 'paper') await loadChatFor(chatKey());
  renderLibrary();
  renderAll();
  // 首次使用只显示当前步骤，避免书库与须知、登录、工作台重叠。
  advanceOnboarding();
  syncPresence();
  if (mirrorCallbackNotice) {
    const restored = mirrorCallbackNotice === 'restored';
    if (!restored) setAccountConnectionStatus(mirrorCallbackNotice);
    toast(bridgeText(mirrorCallbackNotice), restored ? 'ok' : 'warn', 5000);
  }
  window.__nebulaReady = true;
}
boot();
