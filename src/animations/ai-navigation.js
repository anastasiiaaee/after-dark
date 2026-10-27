// Scoped to the new section. Transforms and opacity never change document layout.
export function initAiNavigation(reduced){
  const section=document.querySelector('#ai-navigation');
  if(!section||reduced)return;
  section.classList.add('ai-motion');
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){
      entry.target.classList.add('ai-visible');observer.unobserve(entry.target);
    }
  },{threshold:.12,rootMargin:'0px 0px -24px 0px'});
  section.querySelectorAll('[data-ai-reveal]').forEach((element,index)=>{
    element.style.setProperty('--ai-delay',`${Math.min(index,6)*.05}s`);observer.observe(element);
  });
}
