// Categories remain non-interactive until real case pages are available.
export const projects=[{title:'Creative Web'},{title:'AI Visuals'},{title:'AI Experiences'}];
export function mountProjects(){
 const parent=document.querySelector('#project-list');
 projects.forEach((project,index)=>{
  const row=document.createElement('article');row.className='project-row';
  const number=document.createElement('span');number.className='item-no';number.textContent=String(index+1).padStart(2,'0');
  const title=document.createElement('h3');title.textContent=project.title;
  row.append(number,title);parent.append(row);
 });
}
