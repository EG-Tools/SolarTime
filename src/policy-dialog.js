(function(root){
  'use strict';
  const embedded=new URLSearchParams(root.location.search).get('embed')==='1';
  if(embedded)root.document.documentElement.classList.add('embedded');
  const dialog=root.document.getElementById('site-policy-dialog');
  if(!dialog)return;
  const UI=root.SolarModules?.UI,frame=root.document.getElementById('site-policy-frame'),close=root.document.getElementById('site-policy-close'),tabs=[...root.document.querySelectorAll('.site-policy-tab[data-policy-page]')];
  const links=[...root.document.querySelectorAll('.site-policy-links a[href$=".html"],#cookie-consent a[href="privacy.html"]')];
  let trigger=null;
  const closeDialog=({restoreFocus=true}={})=>{
    const previous=trigger;trigger=null;
    const finish=()=>{dialog.close();frame.removeAttribute('src');if(restoreFocus)previous?.focus({preventScroll:true});};
    if(UI)UI.hide(dialog,finish);else finish();
  };
  const selectDocument=href=>{
    const url=new URL(href,root.document.baseURI),page=url.pathname.split('/').pop();url.searchParams.set('embed','1');
    for(const tab of tabs){const selected=tab.dataset.policyPage===page;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;}
    const active=tabs.find(tab=>tab.dataset.policyPage===page);frame.title=((active?.textContent||'Site information').trim())+' · Solar Time';frame.src=url.href;
  };
  const showDocument=link=>{
    trigger=link;selectDocument(link.getAttribute('href'));
    if(UI)UI.show(dialog,()=>dialog.showModal());else dialog.showModal();
  };
  const openDialog=(link,event)=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();showDocument(link);
  };
  for(const link of links)link.addEventListener('click',event=>openDialog(link,event));
  for(const tab of tabs){
    tab.addEventListener('click',()=>selectDocument(tab.dataset.policyPage));
    tab.addEventListener('keydown',event=>{
      const current=tabs.indexOf(tab);let next=-1;
      if(event.key==='ArrowRight')next=(current+1)%tabs.length;
      else if(event.key==='ArrowLeft')next=(current-1+tabs.length)%tabs.length;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=tabs.length-1;
      if(next<0)return;
      event.preventDefault();tabs[next].focus({preventScroll:true});selectDocument(tabs[next].dataset.policyPage);
    });
  }
  frame.addEventListener('load',()=>{
    try{frame.contentDocument?.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeDialog();}});}
    catch(_){/* A future cross-origin policy page keeps its native boundary. */}
  });
  close?.addEventListener('click',closeDialog);UI?.bindDialog(dialog,closeDialog);
  root.SolarPolicyDialog=Object.freeze({open:href=>{const link=links.find(item=>item.getAttribute('href')===href);if(link)showDocument(link);},close:closeDialog});
})(window);
