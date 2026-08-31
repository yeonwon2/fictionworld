import {addSceneChain,touchWorkshop} from './aiMindMap.js';
import {connectFromCard} from './mapConnections.js';
export function setCardPosition(game,card,point) {
 if(!Number.isFinite(point.x)||!Number.isFinite(point.y))throw new Error('Vị trí không hợp lệ.');
 const next=structuredClone(game),node=next.nodes[card.sceneId];
 const entity=card.kind==='choice'?node?.choices?.[card.choiceIndex]:node;
 if(!entity||!['scene','intro','ending','choice'].includes(card.kind))throw new Error('Ô không còn tồn tại.');
 entity.workshopPosition={x:Math.max(0,point.x),y:Math.max(0,point.y)};
 return next;
}
export function createCanvasScene(game,point,{count=4,role='main',title='',source=null}={}) {
 let result;
 if(source) result=connectFromCard(game,{...source,create:true,choiceCount:count,ending:role==='ending',role});
 else {const added=addSceneChain(game,'',1,count,role==='ending');result={game:added.game,targetId:added.firstId};}
 const node=result.game.nodes[result.targetId];
 node.workshopRole=role;node.workshopTitle=title.trim();if(role==='ending'&&title.trim())node.endingLabel=title.trim();
 result.game=setCardPosition(result.game,{sceneId:result.targetId,kind:'scene'},point);
 node.choices.forEach((_,i)=>{result.game.nodes[result.targetId].choices[i].workshopPosition={x:point.x+410,y:point.y+i*310};});
 return result;
}
export function resetCardPositions(game) {
 const next=structuredClone(game);
 Object.values(next.nodes).forEach(n=>{delete n.workshopPosition;(n.choices||[]).forEach(c=>delete c.workshopPosition);});
 return touchWorkshop(next);
}
