function latestMailReply(body) {
  const text = String(body || '').replace(/\r\n?/g, '\n').trim();
  const boundary = /(?:^|\n|[ \t])(?:-{2,}\s*(?:Original Message|原始郵件)\s*-*|(?:寄件者|發件人|发件人|From|Từ)\s*[:：]|本電子郵件及其附件|本电子邮件及其附件|This e-mail, including|This email, including|Best\s*(?:&|and)?\s*Regards\b|Kind Regards\b|Trân trọng\b)|\n\s*>/i;
  const match = boundary.exec(text);
  return (match ? text.slice(0, match.index) : text).replace(/\n{3,}/g, '\n\n').trim();
}

// Keep the source for review, but publish a short, editable issue summary.
function mailIssueSummary(body) {
  let text = latestMailReply(body).replace(/\r/g, '').replace(/\[mailto:[^\]]+\]/gi, '');
  text = text.split(/(?:本電子郵件及其附件|本电子邮件及其附件|This e-?mail, including|寄件者\s*[:：]|發件人\s*[:：]|From\s*:|收件者\s*[:：]|副本\s*[:：])/i)[0];
  text = text.replace(/(?:Best\s*(?:&|and)?\s*Regards|Kind Regards|Trân trọng)[\s\S]*$/i, '');
  text = text.replace(/(?:電話|Mobile|Ext|E-mail)\s*[:：][^\n]*/gi, '').replace(/\s+/g, ' ').trim();
  // Long meeting threads often contain numbered issues. Keep the first issue as
  // a candidate and let the reviewer edit it before publishing.
  const issue = text.match(/(?:問題點|問題|Issue|描述)\s*[:：]\s*([^。；;]{8,300})/i);
  if (issue) text = issue[1].trim();
  return text.length > 320 ? text.slice(0, 320).replace(/[,，、；;\s]+$/, '') + '…' : text;
}

(() => {
const mailLabel = (zh, en, vi) => typeof uiLang === 'undefined' || uiLang === 'zh' ? zh : uiLang === 'en' ? en : uiLang === 'vi' ? vi : zh;
function paleoClassify(mail) {
  const text = latestMailReply(mail.body) || mail.subject;
  const normalized = text.toUpperCase();
  const available = [...entities, ...posts];
  const hasCode = code => code && normalized.split(/[^A-Z0-9-]+/).includes(code.toUpperCase());
  const detectedColors = text.match(/\b[A-Z]{1,3}\d{4}-\d{3}\b/gi) || [];
  const colors = [...new Set([...available.map(x => x.color).filter(hasCode), ...detectedColors.map(x => x.toUpperCase())])];
  const detectedModels = text.match(/\b(?:SOB|SWB|JDB|BBB|KDB|PN)[-–]?\d{3,4}(?:[-–]\d|MS|GS)?\b/gi) || [];
  const models = [...new Set([...available.filter(x => hasCode(x.model) || colors.length === 1 && x.color === colors[0]).map(x => x.model).filter(Boolean), ...detectedModels.map(x => x.toUpperCase().replace('–','-'))])];
  const owners = [...new Set(entities.filter(x => x.kind === '單位' && (hasCode(x.name) || text.includes('@' + x.name))).map(x => x.name))];
  return { model: models.length === 1 ? models[0] : '', color: colors.length === 1 ? colors[0] : '',
    owner: owners.length === 1 ? owners[0] : '' };
}
function paleoAttachmentList(attachments) {
  if (!attachments?.length) return '<p class="mailAttachmentEmpty">郵件沒有辨識到附件。</p>';
  const formatSize = bytes => {
    const size = Number(bytes) || 0;
    if (size >= 1024 * 1024) return (size / (1024 * 1024)).toFixed(1) + ' MB';
    if (size >= 1024) return Math.round(size / 1024) + ' KB';
    return size + ' B';
  };
  return '<section class="mailAttachmentList"><strong>郵件附件 · ' + attachments.length + ' 個</strong>' +
    attachments.map((item,index) => '<div class="mailAttachmentItem"><span>📎 ' + esc(item.name) + '</span><small>' +
      esc(item.mime || (item.name.includes('.') ? item.name.split('.').pop().toUpperCase() : '檔案')) + ' · ' + formatSize(item.size) +
      '</small>' + (item.data && item.mime?.startsWith('image/') ? '<button type="button" class="mailImageOpen" data-mail-image="' + index + '">預覽圖片</button>' : '') + '</div>' +
      (item.data && item.mime?.startsWith('image/') ? '<img class="mailImageThumb" data-mail-thumb="' + index + '" alt="' + esc(item.name) + '">' : '')).join('') + '</section>';
}
function paleoImageBlob(item) { return new Blob([item.data], {type:item.mime || 'application/octet-stream'}); }
function paleoOpenImage(item) {
  const url = URL.createObjectURL(paleoImageBlob(item));
  const layer = document.createElement('div'); layer.className = 'mailImageLightbox'; layer.setAttribute('role','dialog'); layer.setAttribute('aria-label',item.name);
  layer.innerHTML = '<button type="button" aria-label="關閉圖片預覽">×</button><img alt="' + esc(item.name) + '"><span>' + esc(item.name) + '</span>';
  layer.querySelector('img').src = url;
  layer.onclick = event => { if (event.target === layer || event.target.tagName === 'BUTTON') { URL.revokeObjectURL(url); layer.remove(); } };
  document.body.append(layer);
}
function openMailImport() {
  if (!activeUser) return;
  modal('Outlook MSG', '<form id="paleoMailForm"><label>' + mailLabel('選取、拖放或貼上 Outlook .msg 檔案（選取後自動解析）', 'Select, drop or paste Outlook .msg files (parses automatically)', 'Chọn, thả hoặc dán tệp Outlook .msg (tự động phân tích)') + ' <input type="file" accept=".msg" multiple required></label><button type="submit">' + mailLabel('重新解析郵件', 'Re-parse messages', 'Phân tích lại thư') + '</button><span class="mailDropHint">' + mailLabel('也可以將 .msg 檔案拖放到此區，或在此視窗按 Ctrl+V 貼上檔案。','You can also drop .msg files here or paste them with Ctrl+V.','Bạn cũng có thể thả tệp .msg vào đây hoặc nhấn Ctrl+V để dán tệp.') + '</span></form><div id="paleoMailResults" aria-live="polite"></div>', 'paleo-mail');
  const submit = $('#submitModal');
  submit.hidden = true;
  const form=$('#paleoMailForm'),fileInput=form.querySelector('input[type=file]');
  let lastFileSet='';
  const autoParse=()=>form.requestSubmit();
  fileInput.addEventListener('change',autoParse);
  form.addEventListener('dragover',event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();form.classList.add('mailDropActive')}});
  form.addEventListener('dragleave',()=>form.classList.remove('mailDropActive'));
  form.addEventListener('drop',event=>{const files=[...event.dataTransfer.files].filter(file=>/\.msg$/i.test(file.name));if(!files.length)return;event.preventDefault();form.classList.remove('mailDropActive');const transfer=new DataTransfer();files.forEach(file=>transfer.items.add(file));fileInput.files=transfer.files;autoParse()});
  if(window._paleoMailPasteHandler)document.removeEventListener('paste',window._paleoMailPasteHandler,true);
  window._paleoMailPasteHandler=event=>{if(!$('#modalBack.show')||!event.clipboardData?.files?.length)return;const files=[...event.clipboardData.files].filter(file=>/\.msg$/i.test(file.name));if(!files.length)return;event.preventDefault();const transfer=new DataTransfer();files.forEach(file=>transfer.items.add(file));fileInput.files=transfer.files;autoParse()};
  document.addEventListener('paste',window._paleoMailPasteHandler,true);
  form.onsubmit = async e => {
    e.preventDefault();
    const results = $('#paleoMailResults');
    const files = [...fileInput.files];
    const fileSet=files.map(file=>file.name+':'+file.size+':'+file.lastModified).join('|');
    if(fileSet&&fileSet===lastFileSet)return;
    lastFileSet=fileSet;
    form.querySelector('button').disabled = true;
    results.replaceChildren();
    for (const file of files) {
      const row = document.createElement('section');
      row.className = 'paleoMailRow';
      results.append(row);
      try {
        if (file.size > 25 * 1024 * 1024) throw new Error('檔案超過 25 MB');
        const buffer = await file.arrayBuffer();
        const mail = readPaleoMsg(buffer);
        if (!mail.subject && !mail.body) throw new Error('郵件沒有可讀取的主旨或純文字內文');
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(x => x.toString(16).padStart(2,'0')).join('');
        const matchedPost = posts.find(p => p.mailHash === hash || mail.messageId && p.mailMessageId === mail.messageId);
        const exists = () => !!matchedPost;
        const values = paleoClassify(mail);
        row.innerHTML = '<strong>' + esc(file.name) + '</strong>' +
          [['subject','主旨',mail.subject],['model','型體',values.model],['color','配色',values.color],['owner','責任單位',values.owner]].map(([key,label,value]) =>
            '<label>' + label + ' <input data-field="' + key + '" value="' + esc(value) + '"></label>').join('') +
          '<label>' + mailLabel('問題摘要（發布前請確認）','Issue summary (review before posting)','Tóm tắt vấn đề (xem lại trước khi đăng)') + '<textarea aria-label="問題摘要" required>' + esc(mailIssueSummary(mail.body)) + '</textarea></label>' +
          paleoAttachmentList(mail.attachments) +
          '<details class="mailCardDetails"><summary>' + mailLabel('查看原始郵件','View source email','Xem thư gốc') + '</summary><div>' + esc(mail.body) + '</div></details>' +
          '<button type="button" data-confirm-mail>' + (exists() ? '補入圖片至既有貼文' : mailLabel('確認並建立貼文', 'Confirm and create post', 'Xác nhận và đăng bài')) + '</button><output></output>';
        row.querySelectorAll('[data-mail-thumb]').forEach(image => { const item = mail.attachments[Number(image.dataset.mailThumb)], url=URL.createObjectURL(paleoImageBlob(item)); image.onload=()=>URL.revokeObjectURL(url); image.src=url; });
        row.querySelectorAll('[data-mail-image]').forEach(button => button.onclick = () => paleoOpenImage(mail.attachments[Number(button.dataset.mailImage)]));
        row.querySelector('[data-confirm-mail]').onclick = async () => {
          const field = name => row.querySelector('[data-field="' + name + '"]').value.trim();
          const title = field('subject'), model = field('model'), color = field('color'), owner = field('owner');
          if (!activeUser) return;
          if (!exists() && (!title || !model || !color || !owner)) { row.querySelector('output').textContent = '請確認主旨、型體、配色與責任單位'; return; }
          if (!exists() && posts.some(p => p.mailHash === hash || mail.messageId && p.mailMessageId === mail.messageId)) { row.querySelector('output').textContent = '這封郵件已匯入'; return; }
          const summary = row.querySelector('textarea').value.trim();
          if (!exists() && !summary) { row.querySelector('output').textContent = '請填寫問題摘要'; return; }
          const post = matchedPost || {id:'MAIL-' + crypto.randomUUID(), model, color, owner, title, body:summary, originalMail:mail.body,
            status:'progress', td:'待確認', factory:'待確認', season:'待確認', people:'待指定', stage:'待確認',
            launch:'待維護', due:'待確認', author:activeUser.name, time:new Date().toLocaleString(),
            photo:'尚未附照片', source:'Outlook MSG', comments:[], mailHash:hash, mailMessageId:mail.messageId,
            mailAttachments:mail.attachments.map(({name,size,mime}) => ({name,size,mime}))};
          if (!exists()) {
            posts.unshift(post);
            try { save(); } catch {
              posts.shift();
              row.querySelector('output').textContent = '無法儲存貼文，請確認瀏覽器儲存空間後重試。';
              return;
            }
          }
          const confirmButton = row.querySelector('[data-confirm-mail]'); confirmButton.disabled = true;
          const output = row.querySelector('output');
          confirmButton.textContent='正在補入圖片…';
          try {
            if (!window.persistClassicPost || !window.uploadClassicMailImage) throw new Error('後端圖片儲存尚未就緒，貼文已建立，請重新整理後重試附件上傳。');
            output.textContent = exists() ? '正在補上圖片到既有貼文…' : mailLabel('正在儲存郵件圖片…','Saving email images…','Đang lưu ảnh trong email…');
            await window.persistClassicPost(post);
            if (!Array.isArray(post.mailAttachments)) post.mailAttachments=[];
            const imageFiles = mail.attachments.map((item,index)=>({item,index})).filter(x=>x.item.data&&x.item.mime?.startsWith('image/'));
            for (const {item,index} of imageFiles) {
              const previous=post.mailAttachments.findIndex(file=>file.name===item.name&&file.attachmentId);
              if(previous>=0)continue;
              const stored = await window.uploadClassicMailImage(post.id,item);
              const match=post.mailAttachments.findIndex(file=>file.name===item.name);
              const metadata={name:item.name,size:item.size,mime:item.mime,attachmentId:stored.id};
              if(match>=0)post.mailAttachments[match]=metadata;else post.mailAttachments.push(metadata);
            }
            await window.persistClassicPost(post);
            const savedImages=post.mailAttachments.filter(item=>item.attachmentId&&/^image\//i.test(item.mime||''));
            const missingImages=imageFiles.filter(({item})=>!post.mailAttachments.some(file=>file.name===item.name&&file.attachmentId));
            if(missingImages.length)throw Error('尚有 '+missingImages.length+' 張圖片未寫入貼文，請按「重試未完成圖片」。');
            save();
            const gallery=document.createElement('section');gallery.className='mailImportedGallery';gallery.dataset.mailImportedGallery='1';
            gallery.innerHTML='<strong>已附加圖片 · '+savedImages.length+' 張</strong><div>'+savedImages.map(item=>'<a href="../api/classic-attachments/'+encodeURIComponent(item.attachmentId)+'" target="_blank" rel="noopener"><img loading="lazy" src="../api/classic-attachments/'+encodeURIComponent(item.attachmentId)+'" alt="'+esc(item.name)+'"><span>'+esc(item.name)+'</span></a>').join('')+'</div>';
            row.querySelector('[data-mail-imported-gallery]')?.remove();output.insertAdjacentElement('afterend',gallery);
            gallery.querySelectorAll('img').forEach(image=>image.onerror=()=>{image.alt='圖片讀取失敗：'+image.alt;image.classList.add('mailImageLoadFailed')});
            confirmButton.textContent='圖片已補入（'+savedImages.length+' 張）';
            output.textContent = exists() ? '貼文資料已確認寫入；上方縮圖可直接檢查，點圖可放大。' : mailLabel('貼文與圖片已建立','Post and images created','Đã tạo bài viết và hình ảnh');
          } catch(error) {
            try {if(post.mailAttachments?.some(item=>item.attachmentId)){await window.persistClassicPost(post);save()}}catch{}
            output.textContent = (exists()?'圖片補入未完成：':'貼文已建立，圖片補入未完成：') + error.message;
            confirmButton.textContent='重試未完成圖片';
            confirmButton.disabled = false;
          }
          render();
        };
        if(matchedPost&&mail.attachments.some(item=>item.data&&item.mime?.startsWith('image/'))){
          row.querySelector('output').textContent='已找到原有貼文，正在自動補入郵件圖片…';
          row.querySelector('[data-confirm-mail]').click();
        }
      } catch (error) {
        row.textContent = file.name + ' · ' + error.message;
      }
    }
    form.querySelector('button[type="submit"]').disabled = false;
  };
}
const paleoModal = modal;
modal = (...args) => {
  $('#submitModal').hidden = false;
  paleoModal(...args);
};
const mailButton = document.createElement('button');
mailButton.type = 'button';
mailButton.id = 'paleoLocalMail';
mailButton.textContent = mailLabel('匯入郵件', 'Import mail', 'Nhập thư');
mailButton.onclick = openMailImport;
$('.topRight').prepend(mailButton);
const sideMailButton = $('#mailReview');
sideMailButton.onclick = openMailImport;
sideMailButton.textContent = mailButton.textContent;
const sideHelp = sideMailButton.parentElement.querySelectorAll('.help');
if (sideHelp[0]) sideHelp[0].textContent = '選取電腦中的 Outlook .msg 檔案，解析後可預覽並建立貼文。';
if (sideHelp[1]) sideHelp[1].textContent = '每封上限 25 MB，可一次選取多封。';

})();
