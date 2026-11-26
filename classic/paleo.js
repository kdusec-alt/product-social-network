const paleoLabel = (zh, en, vi) => uiLang === 'en' ? en : uiLang === 'vi' ? vi : zh;
const paleoLogo = '<span class="brandMark" role="img" aria-label="VP"></span>';
const themeToggle = document.createElement('button');
themeToggle.type = 'button';
themeToggle.className = 'themeToggle';
themeToggle.setAttribute('aria-label', '切換深色或淺色背景');
const themeRoot = document.body;
function applyTheme(theme) {
  const dark = theme === 'dark';
  themeRoot.dataset.theme = dark ? 'dark' : 'light';
  themeToggle.textContent = dark ? '☀ ' + paleoLabel('淺色', 'Light', 'Sáng') : '◐ ' + paleoLabel('深色', 'Dark', 'Tối');
  themeToggle.setAttribute('aria-pressed', String(dark));
  try { localStorage.setItem('vpTheme', dark ? 'dark' : 'light'); } catch (_) {}
}
let savedTheme = 'light';
try { savedTheme = localStorage.getItem('vpTheme') || 'light'; } catch (_) {}
applyTheme(savedTheme);
themeToggle.addEventListener('click', () => applyTheme(themeRoot.dataset.theme === 'dark' ? 'light' : 'dark'));
document.querySelector('.topRight').insertBefore(themeToggle, document.querySelector('#lang'));
document.querySelector('#lang')?.addEventListener('change', () => setTimeout(() => applyTheme(themeRoot.dataset.theme), 0));
document.querySelector('#loginLang')?.addEventListener('change', () => setTimeout(() => applyTheme(themeRoot.dataset.theme), 0));
applyVpBrand = () => {
  document.title = 'Product Social Network';
  $('.logo').innerHTML = paleoLogo + '<span>Product Social Network</span>';
  $('.loginBrand').innerHTML = paleoLogo + '<span>Product Social Network</span>';
  $('.loginCard h1').textContent = paleoLabel('登入 Product Social Network', 'Sign in to Product Social Network', 'Đăng nhập Product Social Network');
};

$('.right').insertAdjacentHTML('beforeend', '<section class="card" id="paleoTracking"></section>');
const vpLayout = document.querySelector('.layout'), vpSide = document.querySelector('.side');
const vpHandle = document.createElement('div');
vpHandle.className = 'vpResizeHandle'; vpHandle.tabIndex = 0; vpHandle.setAttribute('role', 'separator'); vpHandle.setAttribute('aria-label', '調整左側欄寬度'); vpHandle.setAttribute('aria-orientation', 'vertical');
vpSide.appendChild(vpHandle);
function vpSetWidth(width) { const value = Math.max(150, Math.min(360, width)); vpLayout.style.setProperty('--vp-side-width', value + 'px'); vpHandle.setAttribute('aria-valuenow', value); try { localStorage.setItem('vpSideWidth', value); } catch (_) {} }
try { const saved = Number(localStorage.getItem('vpSideWidth')); if (saved) vpSetWidth(saved); } catch (_) {}
vpHandle.addEventListener('pointerdown', e => { e.preventDefault(); const start = e.clientX, width = vpSide.getBoundingClientRect().width; vpHandle.setPointerCapture(e.pointerId); const move = ev => vpSetWidth(Math.round(width + ev.clientX - start)); const end = () => { vpHandle.removeEventListener('pointermove', move); vpHandle.removeEventListener('pointerup', end); vpHandle.removeEventListener('pointercancel', end); }; vpHandle.addEventListener('pointermove', move); vpHandle.addEventListener('pointerup', end); vpHandle.addEventListener('pointercancel', end); });
vpHandle.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); vpSetWidth(Math.round(vpSide.getBoundingClientRect().width + (e.key === 'ArrowLeft' ? -10 : 10))); } });
$('.layout').insertAdjacentHTML('beforebegin', '<nav id="paleoMobile"><button id="paleoReady"></button><button id="paleoMail"></button><button id="paleoFollow"></button></nav>');
$('#paleoMobile').style.display = 'none';
$('#paleoReady').onclick = () => $('#openReadiness').click();
$('#paleoMail').onclick = () => $('#mailReview').click();
$('#paleoFollow').onclick = () => $('#paleoTracking').scrollIntoView({block:'start'});

for (const [account, profile] of Object.entries(demoAccounts)) {
  if (!entities.some(entity => entity.name === account)) entities.push({kind:'同仁', name:account, owner:account});
}
const paleoIsMine = isMine;
isMine = name => !!activeUser && (name === activeUser.account || paleoIsMine(name));
const paleoEnqueueMentions = enqueueMentions;
enqueueMentions = (post, items, actor) => paleoEnqueueMentions(post, items, activeUser?.name || actor);
window.addEventListener('storage', event => {
  if (event.key !== notifyKey) return;
  notifications = JSON.parse(event.newValue || '[]');
  renderNotify();
});
function paleoTracking() {
  const panel = $('#paleoTracking');
  panel.hidden = !activeUser;
  const mobile = $('#paleoMobile');
  mobile.style.display = activeUser ? '' : 'none';
  if (!activeUser) return;
  const existing = new Set(posts.map(post => post.id));
  const entries = [...new Map(notifications.filter(n => existing.has(n.postId) && isMine(n.recipient)).map(n => [n.postId, n])).values()];
  const title = paleoLabel('我的追蹤', 'Following', 'Đang theo dõi');
  $('#paleoReady').textContent = paleoLabel('型體就緒', 'Readiness', 'Sẵn sàng mẫu');
  $('#paleoMail').textContent = $('#mailReview').textContent = paleoLabel('匯入 Outlook 郵件', 'Import Outlook mail', 'Nhập thư Outlook');
  $('#paleoMail').setAttribute('aria-label', $('#paleoMail').textContent); $('#paleoMail').title = $('#paleoMail').textContent;
  $('#paleoFollow').textContent = title;
  panel.innerHTML = '<h3>' + title + '</h3>' + (entries.length ? entries.map(n =>
    '<button class="quick" data-track="' + esc(n.postId) + '"><span class="mention">@' + esc(n.recipient) + '</span> · ' + esc(n.title) + '</button>'
  ).join('') : '<p>' + paleoLabel('收到 @ 標註後，相關貼文會顯示在這裡。', 'Posts appear here when you are mentioned.', 'Bài viết sẽ xuất hiện khi bạn được nhắc đến.') + '</p>');
}
$('#paleoTracking').onclick = e => {
  const button = e.target.closest('[data-track]');
  if (!button) return;
  const post = posts.find(p => p.id === button.dataset.track);
  if (!post) return;
  view = 'feed';
  if (activeUser) feedModes.set(activeUser.account, 'all');
  filter = 'all';
  query = '';
  $('#search').value = '';
  render();
  const detail = $('#posts').querySelector('[data-action="detail"][data-id="' + CSS.escape(post.id) + '"]');
  detail?.closest('.post')?.scrollIntoView({block:'center'});
  detail?.click();
};
const paleoNotify = renderNotify;
renderNotify = () => { paleoNotify(); paleoTracking(); };
const paleoRender = render;
const feedModes = new Map();
$('.compose').insertAdjacentHTML('afterend', '<nav id="paleoFeedMode" aria-label="Feed"></nav>');
$('.side').insertAdjacentHTML('afterbegin', '<div id="paleoProfile"></div>');
function feedRelevance(post, tagged) {
  if (tagged.has(post.id)) return 4;
  if ((post.assignments || []).some(item => isMine(item.assignee))) return 3;
  if (isMine(post.owner) || String(post.people || '').split(/[・、,，/／|]+/).some(name => isMine(name.trim()))) return 2;
  return 0;
}
render = () => {
  const bar = $('#paleoFeedMode'), profile = $('#paleoProfile');
  bar.hidden = view !== 'feed' || !activeUser;
  profile.innerHTML = activeUser
    ? '<span class="avatar">' + esc(activeUser.initials) + '</span><div><b>' +
      esc(activeUser.name) + '</b><div>' + esc(activeUser.unit) + '</div></div>' : '';
  const mode = feedModes.get(activeUser?.account) || 'all';
  const options = [
    ['all', paleoLabel('全部動態', 'All activity', 'Tất cả hoạt động')],
    ['related', paleoLabel('與我相關', 'Relevant to me', 'Liên quan đến tôi')],
    ['personal', paleoLabel('為你推薦', 'For you', 'Dành cho bạn')]
  ];
  bar.innerHTML = options.map(([key, label]) =>
    '<button type="button" data-feed-mode="' + key + '" aria-pressed="' + (mode === key) + '">' + label + '</button>'
  ).join('');
  const original = posts;
  if (!bar.hidden && mode !== 'all' && !query.trim()) {
    const tagged = new Set(notifications.filter(n => isMine(n.recipient)).map(n => n.postId));
    const ranked = posts.map(post => ({post, score:feedRelevance(post, tagged)}));
    posts = ranked.filter(item => mode !== 'related' || item.score > 0)
      .sort((a,b) => (mode === 'personal' ? Number(Date.now()-Number(String(b.post.id).replace(/^MRC-/,'')) < 86400000)-Number(Date.now()-Number(String(a.post.id).replace(/^MRC-/,'')) < 86400000) : 0) || b.score - a.score).map(item => item.post);
  }
  try { paleoRender(); } finally { posts = original; }
  paleoTracking();
  if (!bar.hidden) {
    $('.compose .avatar').textContent = activeUser.initials;
    if (mode === 'related' && !$('#posts .post') && !query.trim() && filter === 'all') {
      $('#posts').textContent = paleoLabel('目前沒有指派給你或標註你與所屬部門的動態。', 'No activity mentions or assigns work to you or your department yet.', 'Chưa có hoạt động nhắc đến hoặc giao việc cho bạn hay bộ phận của bạn.');
    }
  }
};
$('#paleoFeedMode').onclick = event => {
  const button = event.target.closest('[data-feed-mode]');
  if (!button || !activeUser) return;
  feedModes.set(activeUser.account, button.dataset.feedMode);
  query = '';
  $('#search').value = '';
  filter = 'all';
  render();
};

window.addEventListener('click', e => {
  const button = e.target.closest('[data-action="replySend"]');
  if (!button || !activeUser) return;
  const post = posts.find(p => p.id === button.dataset.id);
  const input = document.getElementById('reply-' + button.dataset.id);
  if (!post || !input?.value.trim()) return;
  const tags = [...input.value.matchAll(/@([\p{L}\p{N}_.-]+)/gu)].map(m => m[1].replace(/[.]+$/, ''));
  enqueueMentions(post, entities.filter(entity => tags.includes(entity.name)), activeUser.name);
}, {capture:true});

render();
