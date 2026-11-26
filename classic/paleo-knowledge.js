(() => {
  const area = document.querySelector('#knowledgeArea');
  if (!area) return;
  const lang = () => uiLang === 'en' ? 'en' : uiLang === 'vi' ? 'vi' : 'zh';
  const copy = {
    zh: {
      title:'產品問題知識庫', intro:'依型體與配色串聯 MRC 檢核、Trial 討論、動態牆貼文及關鍵回覆。',
      search:'搜尋型體、配色、檢核內容、貼文、回覆人或關鍵字…', all:'全部紀錄', mrc:'MRC 檢核', trial:'Trial／試作', launch:'上線相關', wall:'其他動態牆',
      products:'產品數', events:'串聯紀錄', mrcItems:'MRC 檢核項目', noResults:'沒有符合條件的產品或討論。', noEvents:'目前尚無已回報的 MRC 項目或動態牆紀錄。', unlinked:'待確認產品關聯', unlinkedDesc:'型體配色不足或與資料庫關聯不一致的貼文會先列在這裡，確認後才納入產品串聯。', assignment:'資料庫原關聯', openDbChecklist:'查看資料庫檢核', loadingData:'正在載入產品與 MRC 資料…',
      exact:'型體與配色相符', sameModel:'同型體其他配色（分開呈現）', mrcGroup:'MRC 檢核項目', mrcLabel:'MRC 檢核', trialLabel:'Trial／試作討論', launchLabel:'上線相關討論', wallLabel:'動態牆討論',
      status:'狀態', author:'回覆者', original:'開啟原始貼文', checklist:'開啟 MRC 檢核', replies:'動態牆回覆', mark:'標記為關鍵訊息', unmark:'取消我的標記', markedBy:'標記者', reason:'關鍵原因',
      prompt:'請簡述這則回覆為什麼重要，方便後續查找。', promptRequired:'請填寫標記原因。', signIn:'請先登入後再標記關鍵訊息。', marked:'已加入關鍵訊息', unmarked:'已取消你的標記', markFail:'標記儲存失敗', stageInfo:'階段依原始內容分類；無法判定的貼文會保留為一般動態牆紀錄。',
      pending:'待回覆', progress:'處理中', done:'已完成', issue:'有問題', na:'不適用',
    },
    en: {
      title:'Product Issue Knowledge Base', intro:'Connect MRC checks, Trial discussions, activity posts, and key replies by model and colorway.',
      search:'Search model, colorway, checklist, post, reply author, or keyword…', all:'All records', mrc:'MRC checks', trial:'Trial', launch:'Launch-related', wall:'Other activity',
      products:'Products', events:'Linked records', mrcItems:'MRC checklist items', noResults:'No matching products or discussions.', noEvents:'No reported MRC items or activity records yet.', unlinked:'Product link needs review', unlinkedDesc:'Posts with missing model/colorway data or conflicting database links are held here until verified.', assignment:'Database assignment', openDbChecklist:'View database checklist', loadingData:'Loading product and MRC records…',
      exact:'Model and colorway match', sameModel:'Same model, different colorway (kept separate)', mrcGroup:'MRC checklist items', mrcLabel:'MRC check', trialLabel:'Trial discussion', launchLabel:'Launch-related discussion', wallLabel:'Activity discussion',
      status:'Status', author:'Reply by', original:'Open original post', checklist:'Open MRC checklist', replies:'Activity replies', mark:'Mark as key message', unmark:'Remove my mark', markedBy:'Marked by', reason:'Why it matters',
      prompt:'Briefly explain why this reply matters so it can be found later.', promptRequired:'Please enter a reason.', signIn:'Sign in to mark a key message.', marked:'Added to key messages', unmarked:'Your mark was removed', markFail:'Could not save the mark', stageInfo:'Stages are classified from source text. Unclear posts remain general activity records.',
      pending:'Pending', progress:'In progress', done:'Completed', issue:'Issue', na:'Not applicable',
    },
    vi: {
      title:'Cơ sở tri thức vấn đề sản phẩm', intro:'Liên kết kiểm tra MRC, thảo luận Trial, bài đăng và phản hồi quan trọng theo mã giày và phối màu.',
      search:'Tìm mã giày, phối màu, nội dung kiểm tra, bài đăng, người phản hồi hoặc từ khóa…', all:'Tất cả hồ sơ', mrc:'Kiểm tra MRC', trial:'Trial／thử nghiệm', launch:'Liên quan lên chuyền', wall:'Hoạt động khác',
      products:'Sản phẩm', events:'Hồ sơ liên kết', mrcItems:'Mục kiểm tra MRC', noResults:'Không tìm thấy sản phẩm hoặc thảo luận phù hợp.', noEvents:'Chưa có mục MRC được báo cáo hoặc hoạt động liên quan.', unlinked:'Cần xác nhận liên kết sản phẩm', unlinkedDesc:'Bài viết thiếu mã giày/phối màu hoặc không khớp với liên kết trong cơ sở dữ liệu sẽ được giữ ở đây để xác minh.', assignment:'Liên kết trong cơ sở dữ liệu', openDbChecklist:'Xem danh sách kiểm tra', loadingData:'Đang tải dữ liệu sản phẩm và MRC…',
      exact:'Khớp mã giày và phối màu', sameModel:'Cùng mã giày, khác phối màu (hiển thị riêng)', mrcGroup:'Mục kiểm tra MRC', mrcLabel:'Kiểm tra MRC', trialLabel:'Thảo luận Trial／thử nghiệm', launchLabel:'Thảo luận liên quan lên chuyền', wallLabel:'Thảo luận trên bảng tin',
      status:'Trạng thái', author:'Người phản hồi', original:'Mở bài đăng gốc', checklist:'Mở mục kiểm tra MRC', replies:'Phản hồi trên bảng tin', mark:'Đánh dấu tin quan trọng', unmark:'Bỏ đánh dấu của tôi', markedBy:'Người đánh dấu', reason:'Lý do quan trọng',
      prompt:'Vui lòng nêu ngắn gọn lý do phản hồi này quan trọng để dễ tìm lại.', promptRequired:'Vui lòng nhập lý do.', signIn:'Vui lòng đăng nhập để đánh dấu tin quan trọng.', marked:'Đã thêm vào tin quan trọng', unmarked:'Đã bỏ đánh dấu của bạn', markFail:'Không thể lưu đánh dấu', stageInfo:'Giai đoạn được phân loại từ nội dung nguồn. Bài chưa rõ được giữ là hoạt động chung.',
      pending:'Chờ phản hồi', progress:'Đang xử lý', done:'Hoàn thành', issue:'Có vấn đề', na:'Không áp dụng',
    }
  };
  const t = key => copy[lang()][key] || key;
  const escHtml = value => esc(String(value ?? ''));
  const norm = value => String(value ?? '').normalize('NFKC').toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');
  const postModel = post => post.model || post.code || post.modelCode || '';
  const postColor = post => post.color || post.colorway || '';
  const projectModel = project => project.model || project.code || '';
  const projectColor = project => project.color || project.colorway || '';
  const productKey = (model,color) => `${norm(model)}|${norm(color)}`;
  const commentName = comment => comment.name || comment.author || comment.display_name || comment.unit || t('author');
  const commentTime = comment => comment.time || comment.created_at || comment.createdAt || '';
  const commentText = comment => comment.text || comment.body || '';
  let marks = [], selectedStage = 'all', searchText = '', loadingMarks = false, lastMarksFetch = 0;
  let knowledgeSnapshot = null, knowledgeLoading = false, lastKnowledgeFetch = 0, unlinkedPosts = [];

  function statusName(status) {
      const names = {pending:'pending',open:'pending',progress:'progress',done:'done',completed:'done',verify:'done',closed:'done',issue:'issue',block:'issue',blocked:'issue',na:'na'};
    return t(names[status] || 'status');
  }
  function phaseOf(post) {
    const text = [post.phase,post.stage,post.title,post.body,post.source].join(' ').toLowerCase();
    if (/trial|試作|试作|中試|中试|打樣|打样|試產|试产/.test(text)) return 'trial';
    if (/上線|上線|量產|量产|launch|production|bulk/.test(text)) return 'launch';
    return 'wall';
  }
  function phaseName(phase) { return t(phase==='trial'?'trialLabel':phase==='launch'?'launchLabel':phase==='mrc'?'mrcLabel':'wallLabel'); }
  function markMatches(postId, comment) {
    const signature = JSON.stringify([commentName(comment),commentTime(comment),commentText(comment)]);
    return marks.filter(mark => mark.postId === postId && JSON.stringify([mark.comment?.name,mark.comment?.time,mark.comment?.text]) === signature);
  }
  function makeEvent(kind, at, by, title, body, sourceId, unit, status, comment, post, sourceKind='project') {
    return {kind,at:String(at||''),by:String(by||''),title:String(title||''),body:String(body||''),sourceId,sourceKind,unit,status,comment,post,phase:kind==='mrc'?'mrc':phaseOf(post||{})};
  }
  function projectEvents(project) {
    const items = typeof projectItems === 'function' ? projectItems(project) : (project.items||[]);
    const events=[];
    for (const item of items) {
      const history=Array.isArray(item.history)?item.history:[];
      if (history.length) {
        for (const entry of history) events.push(makeEvent('mrc',entry.at||entry.time||item.updated,entry.by||entry.updatedBy||item.updatedBy,item.zh||item.title_zh||item.title||item.id,entry.note||entry.response||item.response||item.note||'',project.id,item.unit,entry.progress||entry.status||item.status,null,null));
      } else {
        events.push(makeEvent('mrc',item.updated||item.updatedAt||item.updated_at||project.createdAt||project.created_at,item.updatedBy||item.updated_by||'',item.zh||item.title_zh||item.title||item.id,item.response||item.note||'',project.id,item.unit,item.status,null,null));
      }
    }
    return {items,events};
  }
  function buildProducts() {
    const map = new Map(), unresolved=[];
    const ensure = (model,color) => {
      model=String(model||'').trim();color=String(color||'').trim();if(!model||!color)return null;
      const key=productKey(model,color);if(!map.has(key))map.set(key,{key,model,color,modelId:'',master:null,projects:[],posts:[],items:[],events:[]});
      return map.get(key);
    };
    const itemKey=item=>`${norm(item.unit)}|${norm(item.template_id||item.id||item.title_zh||item.zh||item.title)}`;
    const upsertItem=(product,item,origin,project)=>{
      const key=itemKey(item),existing=product.items.find(row=>itemKey(row)===key);
      const normalized={...item,projectId:project?.id||item.projectId||'',modelId:item.modelId||product.modelId||'',_origin:origin};
      if(!existing){product.items.push(normalized);return}
      const history=[...(existing.history||[]),...(normalized.history||[])];
      const timestamp=item=>Date.parse(item.updated_at||item.updatedAt||item.updated||'')||0;
      const hasProgress=item=>(item.status&&item.status!=='pending')||item.note||item.response;
      const incomingWins=timestamp(normalized)>timestamp(existing)||(timestamp(normalized)===timestamp(existing)&&hasProgress(normalized)&&!hasProgress(existing));
      if(incomingWins)Object.assign(existing,normalized,{history});
      else {existing.history=history;existing.projectId=existing.projectId||normalized.projectId;existing.modelId=existing.modelId||normalized.modelId}
    };
    const addPost=(product,post)=>{
      if(product.posts.some(row=>row.id===post.id))return;
      const signature=JSON.stringify([norm(post.title),norm(post.body),norm(post.author),String(post.created_at||post.time||post.createdAt||'').slice(0,10)]);
      const duplicate=product.posts.find(row=>JSON.stringify([norm(row.title),norm(row.body),norm(row.author),String(row.created_at||row.time||row.createdAt||'').slice(0,10)])===signature);
      if(duplicate){duplicate.comments=duplicate.comments||[];const seen=new Set(duplicate.comments.map(comment=>JSON.stringify([commentName(comment),commentTime(comment),commentText(comment)])));for(const comment of post.comments||[]){const key=JSON.stringify([commentName(comment),commentTime(comment),commentText(comment)]);if(!seen.has(key)){duplicate.comments.push(comment);seen.add(key)}}return}
      product.posts.push(post);
      product.events.push(makeEvent('post',post.time||post.createdAt||post.created_at,post.author,post.title,post.body,post.id,'',post.status,null,post));
    };
    for(const row of knowledgeSnapshot?.products||[]){
      const product=ensure(row.code,row.color);if(!product)continue;
      product.modelId=row.id;product.master=row;
      for(const item of row.items||[])upsertItem(product,{...item,zh:item.title_zh,title:item.title_zh,updated:item.updated_at,updatedBy:item.updated_by_name||'',response:item.note||''},'database',null);
    }
    for(const project of readinessProjects||[]){
      const product=ensure(projectModel(project),projectColor(project));if(!product)continue;
      if(!product.projects.some(row=>row.id===project.id))product.projects.push(project);
      product.modelId=product.modelId||project.modelId||'';
      for(const item of (typeof projectItems==='function'?projectItems(project):(project.items||[])))upsertItem(product,item,'project',project);
    }
    for(const post of posts||[])if(postModel(post)&&postColor(post))ensure(postModel(post),postColor(post));
    const productTokens=[...map.values()].map(product=>({product,model:norm(product.model),color:norm(product.color)}));
    const identifyFromText=post=>{
      const text=String([post.title,post.body,post.tags,post.source].join(' ')).normalize('NFKC').toUpperCase();
      const tokens=new Set((text.match(/[A-Z0-9]+(?:[-_][A-Z0-9]+)+/g)||[]).map(norm));
      return productTokens.filter(row=>tokens.has(row.model)&&tokens.has(row.color));
    };
    const textCodes=post=>String([post.title,post.body,post.tags,post.source].join(' ')).normalize('NFKC').toUpperCase().match(/[A-Z0-9]+(?:[-_][A-Z0-9]+)+/g)||[];
    const textTokens=post=>new Set(textCodes(post).map(norm));
    const attachVerifiedPost=(post,fallbackProduct=null)=>{
      const tokens=textTokens(post),matches=identifyFromText(post);
      const signaled=productTokens.filter(row=>tokens.has(row.model)||tokens.has(row.color));
      const codes=textCodes(post);
      const unknownModels=codes.filter(code=>/^[A-Z]{2,6}-\d{3,4}[A-Z0-9]{0,4}(?:-\d{1,2})?$/.test(code)&&!productTokens.some(row=>row.model===norm(code)));
      const unknownColors=codes.filter(code=>/^[A-Z]{1,4}\d{3,4}-\d{2,4}(?:-\d{2,4})?$/.test(code)&&!productTokens.some(row=>row.color===norm(code)));
      const foreignIdentity=!!fallbackProduct&&unknownModels.some(code=>norm(code)!==norm(fallbackProduct.model))&&unknownColors.some(code=>norm(code)!==norm(fallbackProduct.color));
      const conflicting=!!fallbackProduct&&(signaled.some(row=>row.product.key!==fallbackProduct.key)||foreignIdentity);
      if(matches.length===1&&(!fallbackProduct||matches[0].product.key===fallbackProduct.key)){addPost(matches[0].product,post);return}
      if(fallbackProduct&&!conflicting&&!matches.length){addPost(fallbackProduct,post);return}
      const candidates=matches.length?matches.map(row=>`${row.product.model} · ${row.product.color}`):signaled.map(row=>`${row.product.model} · ${row.product.color}`);
      if(foreignIdentity&&unknownModels.length&&unknownColors.length)candidates.push(`${unknownModels[0]} · ${unknownColors[0]}`);
      unresolved.push({post:{...post,linkedModel:fallbackProduct?.model||post.model||'',linkedColor:fallbackProduct?.color||post.color||''},candidates:[...new Set(candidates)]});
    };
    for(const row of knowledgeSnapshot?.products||[]){
      const product=map.get(productKey(row.code,row.color));
      if(product)for(const post of row.posts||[])attachVerifiedPost(post,product);
    }
    for(const post of posts||[]){
      const model=postModel(post),color=postColor(post),product=model&&color?ensure(model,color):null;
      attachVerifiedPost(post,product);
    }
    for(const post of knowledgeSnapshot?.unmatchedPosts||[]){
      attachVerifiedPost(post);
    }
    for(const product of map.values())for(const item of product.items){
      const history=Array.isArray(item.history)?item.history:[];
      if(history.length){for(const entry of history)product.events.push(makeEvent('mrc',entry.at||entry.time||item.updated||item.updated_at,entry.by||entry.updatedBy||item.updatedBy||item.updated_by_name,item.zh||item.title_zh||item.title||item.id,entry.note||entry.response||item.response||item.note||'',item.projectId||item.modelId||product.modelId,item.unit,entry.progress||entry.status||item.status,null,null,item.projectId?'project':'database'))}
      else product.events.push(makeEvent('mrc',item.updated||item.updated_at||item.updatedAt,item.updatedBy||item.updated_by_name||item.updated_by||'',item.zh||item.title_zh||item.title||item.id,item.response||item.note||'',item.projectId||item.modelId||product.modelId,item.unit,item.status,null,null,item.projectId?'project':'database'));
    }
    unlinkedPosts=unresolved;
    return [...map.values()].sort((a,b)=>a.model.localeCompare(b.model)||a.color.localeCompare(b.color));
  }
  function productSearchText(product) {
    const content=[product.model,product.color,...product.projects.flatMap(p=>[p.season,p.factory,p.phase]),...product.items.flatMap(i=>[i.zh,i.title_zh,i.title,i.vi,i.en,i.unit,i.response,i.note,i.status,...(i.history||[]).flatMap(h=>[h.by,h.progress,h.note])]),...product.posts.flatMap(p=>[p.title,p.body,p.author,p.owner,p.people,p.stage,p.source,...(p.comments||[]).flatMap(c=>[commentName(c),commentTime(c),commentText(c)])])].filter(Boolean).join(' ').toLocaleLowerCase();
    return content;
  }
  function eventMatchesQuery(event,q) {
    if(!q)return true;
    const text=[event.title,event.body,event.by,event.unit,event.status,event.post?.author,event.post?.source,...(event.post?.comments||[]).flatMap(c=>[commentName(c),commentTime(c),commentText(c)])].filter(Boolean).join(' ').toLocaleLowerCase();
    return text.includes(q);
  }
  function matchingProducts() {
    const q=searchText.trim().toLocaleLowerCase();
    return buildProducts().map(product=>{
      const identityHit=!!q&&(product.model.toLocaleLowerCase().includes(q)||product.color.toLocaleLowerCase().includes(q));
      const events=product.events.filter(e=>(selectedStage==='all'||e.phase===selectedStage)&&(!q||identityHit||eventMatchesQuery(e,q)));
      const productHit=!q||productSearchText(product).includes(q);
      return {...product,visibleEvents:events,hit:productHit&&(!q||events.length>0||identityHit)};
    }).filter(p=>p.hit);
  }
  function matchingKeyMarks(postId, comments) {
    return (comments||[]).map(comment=>({comment,rows:markMatches(postId,comment)})).filter(x=>x.rows.length);
  }
  function renderPostEvent(event,showTitle=true) {
    const post=event.post,comments=Array.isArray(post.comments)?post.comments:[],q=searchText.trim().toLocaleLowerCase();
    const displayed=comments.filter(comment=>!q||[commentName(comment),commentTime(comment),commentText(comment)].join(' ').toLocaleLowerCase().includes(q));
    const hasCommentHit=displayed.length>0;
    if(q&&!eventMatchesQuery(event,q)&&!hasCommentHit)return '';
    const titleHit=!q||[post.title,post.body,post.author,post.source].join(' ').toLocaleLowerCase().includes(q);
    return `<article class="kbEvent kbPostEvent"><div class="kbEventTop"><span class="kbPhase ${event.phase}">${escHtml(phaseName(event.phase))}</span><span class="kbEventDate">${escHtml(event.at)}</span></div>${showTitle?'<h3>'+escHtml(post.title||t('wallLabel'))+'</h3>':''}<div class="kbMeta">${escHtml(post.author||'')} · ${escHtml(post.source||'')}</div>${post.body&&(!q||titleHit)?`<p class="kbText">${escHtml(post.body)}</p>`:''}${post.stage||post.owner?`<div class="kbMeta">${escHtml(post.owner||'')} ${post.owner&&post.stage?'·':''} ${escHtml(post.stage||'')}</div>`:''}${displayed.length?`<div class="kbReplies"><div class="kbSectionLabel">${t('replies')} · ${comments.length}</div>${displayed.map(comment=>renderComment(post,comment)).join('')}</div>`:''}<button class="kbSourceButton" type="button" data-kb-open-post="${escHtml(post.id)}">${t('original')}</button></article>`;
  }
  function renderComment(post,comment) {
    const existing=markMatches(post.id,comment),mine=existing.find(row=>row.markedById===activeUser?.id),name=commentName(comment),time=commentTime(comment),text=commentText(comment);
    return `<div class="kbReply"><div class="kbReplyHead"><span>${escHtml(name)}</span><time>${escHtml(time)}</time></div><p>${escHtml(text)}</p>${existing.length?`<div class="kbKeyMarks">${existing.map(mark=>`<span class="kbKeyBadge">✦ ${escHtml(mark.markedByName||t('markedBy'))}${mark.reason?` · ${escHtml(mark.reason)}`:''}</span>`).join('')}</div>`:''}<button class="kbMarkButton" type="button" data-kb-mark="${escHtml(post.id)}" data-comment-name="${escHtml(name)}" data-comment-time="${escHtml(time)}" data-comment-text="${escHtml(text)}">${mine?t('unmark'):t('mark')}</button></div>`;
  }
  function renderMrcEvent(event) {
    const title=event.title||t('mrcLabel'),status=statusName(event.status),body=event.body||'';
    return `<article class="kbEvent kbMrcEvent"><div class="kbEventTop"><span class="kbPhase mrc">${t('mrcLabel')}</span><span class="kbEventDate">${escHtml(event.at)}</span></div><h3>${escHtml(title)}</h3><div class="kbMeta">${escHtml(event.unit||'')} · ${t('status')}: ${escHtml(status)}${event.by?` · ${t('author')}: ${escHtml(event.by)}`:''}</div>${body?`<p class="kbText">${escHtml(body)}</p>`:''}<button class="kbSourceButton" type="button" data-kb-open-checklist="${escHtml(event.sourceId)}" data-kb-source-kind="${escHtml(event.sourceKind||'project')}" data-kb-unit="${escHtml(event.unit||'')}">${event.sourceKind==='database'?t('openDbChecklist'):t('checklist')}</button></article>`;
  }
  function renderProduct(product) {
    const others=(posts||[]).filter(post=>norm(postModel(post))===norm(product.model)&&norm(postColor(post))!==norm(product.color)).slice(0,4);
    const exactBadge=product.color?`<span class="kbMatch">${t('exact')}</span>`:'';
    const events=product.visibleEvents.slice().sort((a,b)=>String(b.at).localeCompare(String(a.at)));
    const threads=new Map();
    for(const event of events.filter(event=>event.kind!=='mrc')){
      const key=String(event.post.title||event.post.id).normalize('NFKC').replace(/^(?:(?:re|fw|fwd|回覆|轉寄)\s*:\s*)+/i,'').trim().replace(/\s+/g,' ').toUpperCase();
      if(!threads.has(key))threads.set(key,[]);
      threads.get(key).push(event);
    }
    const postRows=Array.from(threads.values(),thread=>thread.map((event,i)=>renderPostEvent(event,i===0)).join('')).join('');
    const mrcRows=events.filter(event=>event.kind==='mrc').map(renderMrcEvent).filter(Boolean).join('');
    const mrcOpen=searchText.trim()?' open':'';
    const done=product.items.filter(item=>['done','na'].includes(item.status)).length;
    return `<section class="card kbProduct"><header class="kbProductHead"><div><h2>${escHtml(product.model)}${product.color?` · ${escHtml(product.color)}`:''}</h2><div class="kbMeta">${product.items.length?`${t('mrcItems')} ${done}/${product.items.length}　·　`:''}${t('events')} ${events.length}</div></div>${exactBadge}</header><div class="kbTimeline">${postRows||(!mrcRows?`<p class="kbEmpty">${t('noEvents')}</p>`:'')}</div>${mrcRows?`<details class="kbMrcGroup"${mrcOpen}><summary>${t('mrcGroup')} · ${product.items.length}</summary><div class="kbMrcItems">${mrcRows}</div></details>`:''}${others.length?`<details class="kbRelated"><summary>${t('sameModel')} · ${others.length}</summary>${others.map(post=>`<div class="kbRelatedRow"><span>${escHtml(postColor(post))} · ${escHtml(post.title)}</span><button type="button" data-kb-open-post="${escHtml(post.id)}">${t('original')}</button></div>`).join('')}</details>`:''}</section>`;
  }
  function openDatabaseChecklist(modelId,unit) {
    const product=(knowledgeSnapshot?.products||[]).find(row=>row.id===modelId);if(!product)return;
    const items=(product.items||[]).filter(item=>!unit||item.unit===unit);
    const html=`<div class="notice">${escHtml(product.code)} / ${escHtml(product.color)} · ${escHtml(unit||'MRC')}</div>${items.map(item=>`<article class="kbDbChecklistItem"><b>${escHtml(item.template_id||'')}</b><span>${escHtml(item.title_zh||'')}</span><small>${escHtml(item.unit||'')} · ${t('status')}: ${escHtml(statusName(item.status))}${item.updated_by_name?` · ${escHtml(item.updated_by_name)}`:''}${item.updated_at?` · ${escHtml(item.updated_at)}`:''}</small>${item.note?`<p>${escHtml(item.note)}</p>`:''}</article>`).join('')||`<p>${t('noEvents')}</p>`}`;
    modal(t('openDbChecklist'),html,'knowledge-checklist');
  }
  function draw() {
    if(view!=='knowledge')return;
    const expanded=[...area.querySelectorAll('details')].map(item=>item.open);
    const products=matchingProducts();
    const unlinked=unlinkedPosts.filter(row=>{const p=row.post,text=[p.model,p.color,p.title,p.body,p.author,p.source,...(p.comments||[]).flatMap(c=>[commentName(c),commentText(c)])].join(' ').toLocaleLowerCase();return (!searchText||text.includes(searchText.toLocaleLowerCase()))&&(selectedStage==='all'||phaseOf(p)===selectedStage)});
    area.innerHTML=`<div class="kbIntro"><div><h2>${t('title')}</h2><p>${t('intro')}</p></div><div class="kbCounts"><span>${t('products')} <b>${products.length}</b></span><span>${t('events')} <b>${products.reduce((n,p)=>n+p.visibleEvents.length,0)}</b></span></div></div><div class="kbToolbar"><input id="kbSearch" type="search" value="${escHtml(searchText)}" placeholder="${t('search')}" aria-label="${t('search')}"><div class="kbFilters">${[['all','all'],['mrc','mrc'],['trial','trial'],['launch','launch'],['wall','wall']].map(([key,label])=>`<button type="button" data-kb-stage="${key}" class="${selectedStage===key?'active':''}">${t(label)}</button>`).join('')}</div><p class="kbNote">${t('stageInfo')}</p></div>${knowledgeLoading?`<p class="kbLoading">${t('loadingData')}</p>`:''}${loadingMarks?`<p class="kbLoading">…</p>`:''}${products.length?products.map(renderProduct).join(''):`<div class="card kbEmpty">${t('noResults')}</div>`}${unlinked.length?`<section class="card kbUnlinked"><h2>${t('unlinked')} · ${unlinked.length}</h2><p>${t('unlinkedDesc')}</p>${unlinked.map(row=>`<article><div class="kbMeta">${escHtml(row.post.model||'')} ${escHtml(row.post.color||'')} · ${escHtml(row.post.source||'')}</div><b>${escHtml(row.post.title||t('wallLabel'))}</b><p>${escHtml(row.post.body||'')}</p>${row.candidates.length?`<small>${row.candidates.map(escHtml).join(' · ')}</small>`:''}<button class="kbSourceButton" type="button" data-kb-open-post="${escHtml(row.post.id)}">${t('original')}</button></article>`).join('')}</section>`:''}`;
    area.querySelectorAll('details').forEach((item,index)=>{if(expanded[index]!==undefined)item.open=expanded[index]});
  }
  async function refreshMarks() {
    if(!activeUser||loadingMarks||Date.now()-lastMarksFetch<15000)return;
    loadingMarks=true;draw();
    try {const response=await fetch('/api/knowledge-marks',{credentials:'same-origin'});if(response.ok){marks=await response.json();lastMarksFetch=Date.now()}}
    catch(error){console.warn('Knowledge marks:',error.message)}
    finally{loadingMarks=false;draw()}
  }
  async function refreshKnowledge() {
    if(!activeUser||knowledgeLoading||Date.now()-lastKnowledgeFetch<20000)return;
    knowledgeLoading=true;draw();
    try {const response=await fetch('/api/knowledge',{credentials:'same-origin'});if(response.ok)knowledgeSnapshot=await response.json()}
    catch(error){console.warn('Knowledge records:',error.message)}
    finally{knowledgeLoading=false;lastKnowledgeFetch=Date.now();draw()}
  }
  function openPost(postId) {
    const post=(posts||[]).find(item=>item.id===postId)||(knowledgeSnapshot?.products||[]).flatMap(row=>row.posts||[]).find(item=>item.id===postId)||(knowledgeSnapshot?.unmatchedPosts||[]).find(item=>item.id===postId);
    if(!post)return;
    view='feed';filter='all';query='';if(activeUser&&feedModes)feedModes.set(activeUser.account,'all');
    const search=document.querySelector('#search');if(search)search.value='';render();
    const button=document.querySelector(`#posts [data-action="detail"][data-id="${CSS.escape(postId)}"]`);
    if(button){button.closest('.post')?.scrollIntoView({block:'center'});button.click();return}
    modal(tx('issueDetail'),`<div class="notice">${escHtml(post.id)} · ${escHtml(post.model)} / ${escHtml(post.color)}</div><h3>${escHtml(post.title)}</h3><p>${escHtml(post.body)}</p>${(post.comments||[]).map(comment=>`<p><b>${escHtml(commentName(comment))} · ${escHtml(commentTime(comment))}</b><br>${escHtml(commentText(comment))}</p>`).join('')}`,'detail');
  }
  area.addEventListener('input',event=>{if(event.target.id==='kbSearch'){searchText=event.target.value;draw();const input=document.querySelector('#kbSearch');input?.focus();input?.setSelectionRange(searchText.length,searchText.length)}});
  area.addEventListener('click',async event=>{
    const stage=event.target.closest('[data-kb-stage]');if(stage){selectedStage=stage.dataset.kbStage;draw();return}
    const postButton=event.target.closest('[data-kb-open-post]');if(postButton){openPost(postButton.dataset.kbOpenPost);return}
    const checklistButton=event.target.closest('[data-kb-open-checklist]');if(checklistButton){if(checklistButton.dataset.kbSourceKind==='database')openDatabaseChecklist(checklistButton.dataset.kbOpenChecklist,checklistButton.dataset.kbUnit||'');else openReadyDetail(checklistButton.dataset.kbOpenChecklist,checklistButton.dataset.kbUnit||undefined);return}
    const markButton=event.target.closest('[data-kb-mark]');if(!markButton)return;
    if(!activeUser){toast(t('signIn'));return}
    const postId=markButton.dataset.kbMark,name=markButton.dataset.commentName,time=markButton.dataset.commentTime,text=markButton.dataset.commentText;
    const existing=markMatches(postId,{name,time,text}).find(row=>row.markedById===activeUser.id);
    try {
      if(existing){const response=await fetch('/api/knowledge-marks/'+encodeURIComponent(existing.id),{method:'DELETE',credentials:'same-origin'});if(!response.ok)throw Error('unmark');marks=marks.filter(mark=>mark.id!==existing.id);toast(t('unmarked'))}
      else {const reason=prompt(t('prompt'));if(!reason?.trim()){toast(t('promptRequired'));return}const response=await fetch('/api/knowledge-marks',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({postId,commentName:name,commentTime:time,commentText:text,reason:reason.trim()})});if(!response.ok)throw Error('mark');const mark=await response.json();marks=marks.filter(row=>row.id!==mark.id);marks.push(mark);toast(t('marked'))}
      draw();
    } catch(error){toast(t('markFail'))}
  });
  const priorRender=render;
  render=()=>{priorRender();const showing=view==='knowledge',checklistAdmin=view==='checklist-admin',readiness=view==='readiness';area.classList.toggle('show',showing);document.querySelector('#feedArea').style.display=showing||checklistAdmin||readiness?'none':'';document.querySelector('#summary').style.display=showing||checklistAdmin||readiness?'none':'';document.querySelector('#newPost').style.display=showing||checklistAdmin||readiness?'none':'';document.querySelector('#legacyArea').classList.toggle('show',view==='legacy');for(const id of ['readinessArea','modelsArea','meetingArea','checklistAdminArea','membersArea']){const panel=document.getElementById(id);if(panel){if(showing)panel.classList.remove('show');panel.style.display=showing?'none':''}}if(showing){document.querySelector('#pageTitle').textContent=t('title');document.querySelector('#pageSub').hidden=true;document.querySelector('#nav').querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view==='knowledge'));draw();refreshMarks();refreshKnowledge()}};
  document.querySelector('#lang')?.addEventListener('change',()=>setTimeout(()=>{if(view==='knowledge')render()},0));
  window.addEventListener('classicPostsChanged',()=>{if(view==='knowledge')draw()});
  window.addEventListener('classicProjectsChanged',()=>{if(view==='knowledge')draw()});
  window.addEventListener('storage',event=>{if(['mrcDemoPosts','mrcReadinessProjects'].includes(event.key)&&view==='knowledge')draw()});
})();
