(()=>{
  const edit=document.createElement('button');
  edit.type='button';edit.textContent='編輯個人資訊';
  $('#logoutButton').before(edit);
  let profile=null,owner='';
  function paint(){
    if(!profile||owner!==activeUser?.verifiedAccount)return;
    for(const element of [$('#accountButton'),$('#paleoProfile .avatar')]){
      if(!element)continue;
      if(profile.avatar){
        const img=new Image();img.src=profile.avatar;img.alt='';
        img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:50%';
        element.replaceChildren(img);
      }
    }
    for(const card of document.querySelectorAll('#posts .post')){
      const postId=card.querySelector('[data-action][data-id]')?.dataset.id;
      const matched=window.classicAuthorProfiles?.get(postId);
      const post=posts.find(item=>item.id===postId);
      const own=post && (post.author===activeUser.name||post.author===activeUser.name+' · '+activeUser.unit);
      const authorProfile=window.classicAuthorProfiles?.has(postId)?matched:(own?profile:null);
      const avatar=card.querySelector('.postHead .avatar');
      if(avatar&&authorProfile?.avatar){const img=new Image();img.src=authorProfile.avatar;img.alt='';img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:50%';avatar.replaceChildren(img)}
      if(authorProfile?.nickname){const author=card.querySelector('.postHead .person');if(author)author.textContent=authorProfile.nickname}
    }
    if(profile.nickname){
      $('#accountName').textContent=profile.nickname;
      const name=$('#paleoProfile b');if(name)name.textContent=profile.nickname;
    }
  }
  async function request(options){
    const response=await fetch('../api/profile',options);
    if(!response.ok)throw Error('個人資訊讀寫失敗，請重試');
    return response.json();
  }
  async function load(){
    const account=activeUser?.verifiedAccount;
    if(!account)return;
    const data=await request();
    if(account===activeUser?.verifiedAccount){owner=account;profile=data;paint();}
  }
  window.addEventListener('profileIdentity',()=>load().catch(()=>{}));
  const previous=render;render=()=>{
    const openMail=new Map();
    document.querySelectorAll('#posts .post').forEach(card=>{
      const id=card.querySelector('[data-action][data-id]')?.dataset.id;
      const details=card.querySelector('.mailCardDetails');
      if(id&&details?.open)openMail.set(id,details.querySelector('div')?.scrollTop||0);
    });
    previous();paint();
    document.querySelectorAll('#posts .post').forEach(card=>{
      const id=card.querySelector('[data-action][data-id]')?.dataset.id;
      const details=card.querySelector('.mailCardDetails');
      if(details&&openMail.has(id)){details.open=true;const body=details.querySelector('div');if(body)body.scrollTop=openMail.get(id)}
    });
  };
  edit.onclick=async()=>{
    try{
      await load();
      if(!profile||owner!==activeUser?.verifiedAccount)throw Error('請先登入');
      const dialog=document.createElement('dialog');
      dialog.className='mailGalleryDialog';dialog.style.maxWidth='380px';
      dialog.innerHTML='<form style="display:grid;gap:14px;padding:20px"><strong>編輯個人資訊</strong><label>顯示名稱 <input required maxlength="64" placeholder="PED_Example"></label><small>建議格式：單位_姓名，例如 PED_Example</small><label>個人照片 <input type="file" accept="image/png,image/jpeg,image/webp"></label><output></output><button>儲存</button><button type="button">取消</button></form>';
      const [name,file]=dialog.querySelectorAll('input');
      name.value=profile.nickname||activeUser.unit+'_'+activeUser.name;
      dialog.querySelector('[type=button]').onclick=()=>dialog.close();
      dialog.onclose=()=>dialog.remove();
      dialog.querySelector('form').onsubmit=async event=>{
        event.preventDefault();const button=event.submitter;button.disabled=true;
        try{
          let avatar=profile.avatar;
          if(file.files[0]){
            const bitmap=await createImageBitmap(file.files[0]);
            const canvas=document.createElement('canvas');canvas.width=canvas.height=192;
            const side=Math.min(bitmap.width,bitmap.height);
            canvas.getContext('2d').drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,192,192);
            bitmap.close();avatar=canvas.toDataURL('image/jpeg',0.85);
          }
          profile=await request({method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({nickname:name.value,avatar})});
          paint();window.dispatchEvent(new Event('profileUpdated'));dialog.close();toast('個人資訊已儲存');
        }catch(error){dialog.querySelector('output').textContent=error.message}finally{button.disabled=false}
      };
      document.body.append(dialog);dialog.showModal();
    }catch(error){toast(error.message)}
  };
  load().catch(()=>{});
})();
