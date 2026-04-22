const data=JSON.parse(document.getElementById("review-data").textContent||"{}");
const state={tab:(data.files?.length?"branch":data.commits?.length?"commits":"files"),selected:{branch:data.files?.[0]?.id||null,commits:data.commits?.[0]?.sha||null,files:data.files?.[0]?.id||null},details:{},comments:{},overall:"",seq:0};
const itemsEl=document.getElementById("items");const detailEl=document.getElementById("detail");const metaEl=document.getElementById("meta");const itemLabelEl=document.getElementById("item-label");const itemCommentEl=document.getElementById("item-comment");const overallEl=document.getElementById("overall-comment");
const tabs={branch:document.querySelector('[data-tab="branch"]'),commits:document.querySelector('[data-tab="commits"]'),files:document.querySelector('[data-tab="files"]')};
function key(tab,id){return `${tab}\u0000${id}`}
function parseKey(value){const index=value.indexOf("\u0000");return [value.slice(0,index),value.slice(index+1)]}
function activeId(){return state.selected[state.tab]}
function activeList(){return state.tab==="commits"?(data.commits||[]):(data.files||[])}
function activeItem(){return activeList().find((item)=>(state.tab==="commits"?item.sha:item.id)===activeId())||null}
function label(tab,item){return tab==="commits"?`${item.shortSha} ${item.subject}`.trim():item.path}
function requestDetail(){const item=activeItem();if(!item)return;const id=state.tab==="commits"?item.sha:item.id;const cache=state.details[key(state.tab,id)];if(cache)return renderDetail();state.details[key(state.tab,id)]={loading:true};window.glimpse?.send?.({type:"detail",requestId:`req:${Date.now()}:${++state.seq}`,tab:state.tab,id});renderDetail()}
function renderList(){Object.entries(tabs).forEach(([name,button])=>button.classList.toggle("active",name===state.tab));itemsEl.innerHTML="";(activeList()).forEach((item)=>{const id=state.tab==="commits"?item.sha:item.id;const button=document.createElement("button");button.className=activeId()===id?"active":"";button.textContent=label(state.tab,item);button.onclick=()=>{state.selected[state.tab]=id;render()};itemsEl.appendChild(button)});if(!activeItem())detailEl.textContent="No reviewable items in this tab."}
function renderDetail(){const item=activeItem();if(!item)return;const id=state.tab==="commits"?item.sha:item.id;const detail=state.details[key(state.tab,id)];itemLabelEl.textContent=label(state.tab,item);itemCommentEl.value=state.comments[key(state.tab,id)]||"";if(!detail||detail.loading){detailEl.textContent="Loading…";requestDetail();return}detailEl.textContent=`${detail.title}\n\n${detail.content}`}
function renderMeta(){metaEl.textContent=`${data.repoRoot||""}${data.baseRef?` • base ${data.baseRef}`:""}`}
function render(){renderMeta();renderList();renderDetail()}
itemCommentEl.addEventListener("input",()=>{const item=activeItem();if(!item)return;const id=state.tab==="commits"?item.sha:item.id;state.comments[key(state.tab,id)]=itemCommentEl.value});
overallEl.addEventListener("input",()=>{state.overall=overallEl.value});
document.getElementById("cancel").onclick=()=>{window.glimpse?.send?.({type:"cancel"});window.glimpse?.close?.()};
document.getElementById("submit").onclick=()=>{const comments=Object.entries(state.comments).filter(([,body])=>String(body).trim()).map(([composite,body])=>{const [tab,id]=parseKey(composite);const list=tab==="commits"?data.commits:data.files;const item=list.find((entry)=>(tab==="commits"?entry.sha:entry.id)===id);return {tab,id,label:label(tab,item),body:String(body)}});window.glimpse?.send?.({type:"submit",overallComment:state.overall,comments});window.glimpse?.close?.()};
Object.entries(tabs).forEach(([tab,button])=>button.onclick=()=>{state.tab=tab;if(!activeItem())state.selected[tab]=activeList()[0]?(tab==="commits"?activeList()[0].sha:activeList()[0].id):null;render()});
window.__diffReviewReceive=(message)=>{if(!message||typeof message!=="object")return;const detailKey=key(message.tab,message.id);if(!state.details[detailKey]?.loading)return;state.details[detailKey]=message.type==="detail-data"?{title:message.title,content:message.content}:{title:"Error",content:message.message};render()};
render();
