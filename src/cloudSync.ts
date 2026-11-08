import {collection,deleteDoc,doc,getDoc,getDocs,setDoc,writeBatch} from 'firebase/firestore';
import {db} from './firebase';

export type SyncRecipe={id:string;image?:string;[key:string]:unknown};
export type CloudState={prefs?:unknown;plan?:unknown;groceries?:unknown;pantry?:unknown;onboarded?:boolean;budget?:number};

const stripUndefined=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
const cleanRecipe=(recipe:SyncRecipe)=>{
  const localPhoto=typeof recipe.image==='string'&&recipe.image.startsWith('data:');
  return stripUndefined({...recipe,image:localPhoto?'':recipe.image||'',photoSync:localPhoto?'local-only':'cloud-url',updatedAt:Date.now()});
};
export const recipeFingerprint=(r:SyncRecipe)=>JSON.stringify(cleanRecipe(r),Object.keys(cleanRecipe(r)).sort());

export async function loadCloud(uid:string){
  const stateSnap=await getDoc(doc(db,'users',uid,'state','main'));
  const recipeSnap=await getDocs(collection(db,'users',uid,'recipes'));
  return {state:stateSnap.exists()?stateSnap.data() as CloudState:null,recipes:recipeSnap.docs.map(d=>d.data())};
}

export async function saveCloudState(uid:string,state:CloudState){
  await setDoc(doc(db,'users',uid,'state','main'),stripUndefined({...state,updatedAt:Date.now()}),{merge:true});
}

export async function syncChangedRecipes(uid:string,recipes:SyncRecipe[],knownIds:Set<string>,knownHashes:Map<string,string>){
  const currentIds=new Set(recipes.map(r=>r.id));
  const deleted=[...knownIds].filter(id=>!currentIds.has(id));
  for(const id of deleted){await deleteDoc(doc(db,'users',uid,'recipes',id));knownIds.delete(id);knownHashes.delete(id)}
  const changed=recipes.filter(r=>knownHashes.get(r.id)!==recipeFingerprint(r));
  for(let start=0;start<changed.length;start+=400){const group=changed.slice(start,start+400),batch=writeBatch(db);group.forEach(r=>batch.set(doc(db,'users',uid,'recipes',r.id),cleanRecipe(r)));await batch.commit();group.forEach(r=>{knownIds.add(r.id);knownHashes.set(r.id,recipeFingerprint(r))})}
  return changed.length+deleted.length;
}

export async function importRecipesInBatches(uid:string|undefined,recipes:SyncRecipe[],progress:(phase:string,current:number,total:number,percent:number)=>void){
  const importId=crypto.randomUUID();
  if(uid)await setDoc(doc(db,'users',uid,'imports',importId),{status:'saving',totalRecipes:recipes.length,savedRecipes:0,photosLocalOnly:recipes.filter(r=>String(r.image||'').startsWith('data:')).length,startedAt:Date.now()});
  for(let start=0;start<recipes.length;start+=20){const group=recipes.slice(start,start+20);if(uid){const batch=writeBatch(db);group.forEach(r=>batch.set(doc(db,'users',uid,'recipes',r.id),cleanRecipe(r)));await batch.commit();await setDoc(doc(db,'users',uid,'imports',importId),{status:'saving',totalRecipes:recipes.length,savedRecipes:Math.min(start+group.length,recipes.length),updatedAt:Date.now()},{merge:true})}progress(uid?'Syncing recipe records':'Saving recipes',Math.min(start+group.length,recipes.length),recipes.length,30+Math.round((Math.min(start+group.length,recipes.length)/Math.max(1,recipes.length))*65));await new Promise(resolve=>setTimeout(resolve,0))}
  if(uid)await setDoc(doc(db,'users',uid,'imports',importId),{status:'done',savedRecipes:recipes.length,completedAt:Date.now()},{merge:true});
  return importId;
}
