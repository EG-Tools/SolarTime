async () => {
  const $=id=>document.getElementById(id),click=id=>$(id).click();
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const delay=matchMedia('(prefers-reduced-motion: reduce)').matches?30:1100;
  const ui=SolarModules.UI,results=[];
  const check=(value,label)=>{if(!value)throw Error(label);results.push(label);};
  const panels=['help-dialog','settings-panel','body-panel','language-menu','preset-dialog','reset-defaults-dialog','kakao-pay-dialog','layout-diagnostics'];
  if(SolarTime.getState().zen){click('zen-toggle');await wait(delay);}
  ui.dismissAll();await wait(delay);
  const openers={
    help:()=>click('help-button'),settings:()=>click('settings-button'),
    body:()=>document.querySelector('[data-body="earth"]').click(),language:()=>click('language-toggle'),
    preset:()=>click('camera-preset-1'),reset:()=>{click('settings-button');click('reset-defaults');},
    kakao:()=>{click('help-button');click('kakao-pay-link');},
    diagnostics:()=>{click('help-button');SolarPageRuntime.showDiagnostics();}
  };
  for(const method of ['button','H'])for(const [name,open] of Object.entries(openers)){
    open();await wait(40);
    check(panels.some(id=>$(id)&&ui.visible($(id))),method+' '+name+' opened');
    if(method==='button')click('zen-toggle');
    else window.dispatchEvent(new KeyboardEvent('keydown',{key:'h',code:'KeyH',bubbles:true}));
    check(SolarTime.getState().zen,method+' '+name+' entered viewing mode');
    check(panels.every(id=>!$(id)||!ui.visible($(id))),method+' '+name+' closing immediately');
    await wait(delay);
    check(panels.every(id=>!$(id)||!ui.shown($(id))),method+' '+name+' fully closed');
    check(['help-button','settings-button','language-toggle'].every(id=>$(id).getAttribute('aria-expanded')==='false'),method+' '+name+' ARIA reset');
    check(SolarTime.renderer.selected===null,method+' '+name+' selection reset');
    click('zen-toggle');await wait(30);
    check(panels.every(id=>!$(id)||!ui.shown($(id))),method+' '+name+' stays closed after exit');
  }
  click('zen-toggle');click('camera-preset-1');await wait(40);
  check($('preset-dialog').open&&getComputedStyle($('preset-cancel')).visibility==='visible','camera popup remains usable in viewing mode');
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));await wait(delay);
  check(!$('preset-dialog').open&&SolarTime.getState().zen,'Escape closes the popup before leaving viewing mode');
  click('zen-toggle');await wait(30);
  click('help-button');await wait(40);check(ui.visible($('help-dialog')),'help can reopen');
  $('help-dialog').querySelector('.close-button').click();await wait(delay);check(!$('help-dialog').open,'help X closes normally');
  check($('fatal-error').hidden,'no fatal overlay');
  return {passed:results.length,results};
}
