(() => {
const tr = (zh,en,vi) => uiLang === 'en' ? en : uiLang === 'vi' ? vi : zh;
const base = postHtml;
function canDelete(post) {
  return !!activeUser && !post.readinessId && !/readiness|就緒/i.test(post.source || '') &&
    (activeUser.unit === '管理者' || post.author === activeUser.name || post.author === activeUser.name + ' · ' + activeUser.unit);
}
postHtml = post => {
  const isMail = !!post.mailHash || /^Outlook\s*MSG$/i.test(String(post.source || '').trim()) || String(post.id).startsWith('MAIL-');
  let card = base(isMail ? {...post, body:''} : post);
  if (isMail) {
    const body = String(post.originalMail || post.body || '');
    const preview = mailIssueSummary(post.body || body);
    card = card.replace('<p></p>', () =>
      (preview ? '<div class="mailCardPreview">' + esc(preview) + '</div>' : '') +
      (Array.isArray(post.mailAttachments) && post.mailAttachments.length ?
        ('<section class="mailAttachmentList mailGalleryBar"><strong>'+tr('來源郵件附件','Email attachments','Tệp đính kèm')+' · '+post.mailAttachments.length+'</strong><button type="button" class="quick" data-mail-gallery="'+esc(post.id)+'">'+tr('查看附件','View attachments','Xem tệp')+'</button></section>') : '') +
      '<details class="mailCardDetails"><summary>' + tr('查看原始郵件','View source email','Xem thư gốc') +
      '</summary><div>' + esc(body) + '</div></details>');
  }
  if (canDelete(post)) card = card.replace('</div><div class="postBody">', () =>
    '<button type="button" class="postDelete" data-delete-post="' + esc(post.id) + '">' +
    tr('刪除貼文','Delete post','Xóa bài viết') + '</button></div><div class="postBody">');
  return card;
};
$('#posts').addEventListener('click', event => {
  const trigger = event.target.closest('[data-mail-gallery]');
  if (trigger) {
    const post = posts.find(item => item.id === trigger.dataset.mailGallery);
    if (!post) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'mailGalleryDialog';
    const watermarkName = String(activeUser && window.verifiedWatermarkAccount || '').trim();
    const watermark = () => {
      const layer = document.createElement('div');
      layer.className = 'mailGalleryWatermark';
      layer.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 72; i++) {
        const label = document.createElement('span');
        label.textContent = watermarkName;
        layer.append(label);
      }
      return layer;
    };
    const title = tr('來源郵件附件','Email attachments','Tệp đính kèm') + ' · ' + post.mailAttachments.length;
    dialog.setAttribute('aria-label',title);
    dialog.innerHTML = '<header><strong>'+esc(title)+'</strong><button type="button">'+tr('關閉','Close','Đóng')+'</button></header><div class="mailGalleryGrid">'+post.mailAttachments.map(file=>{
      const caption = '<span>'+esc(file.name)+'</span><small>'+esc(file.mime)+' · '+Math.round((Number(file.size)||0)/1024)+' KB</small>';
      if (!/^[a-zA-Z0-9_-]+$/.test(file.attachmentId||'') || !/^image\//.test(file.mime||'')) return '<div>'+caption+'</div>';
      const url = '../api/classic-attachments/'+encodeURIComponent(file.attachmentId);
      return '<a href="'+url+'" data-mail-photo><img loading="lazy" alt="" src="'+url+'">'+caption+'</a>';
    }).join('')+'</div>';
    if (watermarkName) dialog.append(watermark());
    document.body.append(dialog);
    dialog.querySelector('button').onclick=()=>dialog.close();
    dialog.querySelector('.mailGalleryGrid').addEventListener('click', event => {
      const link = event.target.closest('[data-mail-photo]');
      if (!link || !watermarkName) return;
      event.preventDefault();
      const preview = document.createElement('dialog');
      preview.className = 'mailGalleryDialog mailPhotoPreview';
      const header = document.createElement('header');
      const title = document.createElement('strong');
      title.textContent = link.querySelector('span')?.textContent || '';
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = tr('關閉','Close','Đóng');
      close.onclick = () => preview.close();
      header.append(title, close);
      const image = document.createElement('img');
      image.src = link.href;
      image.alt = title.textContent;
      preview.append(header, image, watermark());
      document.body.append(preview);
      preview.onclose = () => preview.remove();
      preview.showModal();
    });
    dialog.onclose=()=>{dialog.remove();trigger.focus({preventScroll:true})};
    dialog.showModal();
    return;
  }
  const button = event.target.closest('[data-delete-post]');
  if (!button) return;
  const index = posts.findIndex(post => post.id === button.dataset.deletePost);
  const post = posts[index];
  if (!post || !canDelete(post)) return;
  if (!confirm(tr('確定刪除這則貼文與留言？此動作無法復原。','Delete this post and its comments? This cannot be undone.','Xóa bài viết và bình luận? Không thể hoàn tác.'))) return;
  posts.splice(index, 1);
  try { save(); } catch {
    posts.splice(index, 0, post);
    toast(tr('無法儲存變更','Could not save the change','Không thể lưu thay đổi'));
    return;
  }
  render();
  toast(tr('貼文已刪除','Post deleted','Đã xóa bài viết'));
});
render();
})();
