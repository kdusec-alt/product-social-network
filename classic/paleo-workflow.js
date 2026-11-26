(() => {
  const t = (zh,en,vi) => uiLang === 'en' ? en : uiLang === 'vi' ? vi : zh;
  const library = document.createElement('section');
  library.className = 'card';
  library.id = 'paleoKnowledge';
  $('.right').append(library);
  function drawLibrary() {
    const closed = posts.filter(p => p.status === 'closed');
    library.innerHTML = '<h3>' + t('已結案知識','Resolved knowledge','Kiến thức đã giải quyết') + '</h3>' +
      '<p>' + t('依型體、配色與問題搜尋已結案紀錄。','Search resolved issues by model, color, or issue.','Tìm vấn đề đã giải quyết theo mẫu, màu hoặc nội dung.') + '</p>' +
      '<button class="quick" id="openKnowledge">' + t('搜尋結案紀錄','Search resolved issues','Tìm vấn đề đã giải quyết') + ' · ' + closed.length + '</button>';
    $('#openKnowledge').onclick = () => {
      const rows = closed.map(p => '<article class="knowledgeRow"><b>' + esc(p.model) + ' / ' + esc(p.color) + ' · ' + esc(p.title) + '</b><p>' + esc(p.body) + '</p><small>' + esc(p.comments.at(-1)?.text || '') + '</small></article>').join('');
      modal(t('已結案知識','Resolved knowledge','Kiến thức đã giải quyết'),
        '<input id="knowledgeQuery" aria-label="搜尋結案紀錄" placeholder="' + t('搜尋型體、配色或問題','Search model, color, or issue','Tìm mẫu, màu hoặc vấn đề') + '">' +
        '<div id="knowledgeRows">' + (rows || '<p>' + t('尚無已結案問題','No resolved issues yet','Chưa có vấn đề đã giải quyết') + '</p>') + '</div>', 'knowledge');
      $('#knowledgeQuery').oninput = e => {
        const term = e.target.value.toLocaleLowerCase();
        $('#knowledgeRows').querySelectorAll('.knowledgeRow').forEach(row => row.hidden = !row.textContent.toLocaleLowerCase().includes(term));
      };
    };
  }
  const priorRender = render;
  render = () => { priorRender(); drawLibrary(); };
  drawLibrary();
})();
