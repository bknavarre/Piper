import JSZip from 'jszip';

export type CopyMeThatRecipe = {
  id: string;
  title: string;
  image: string;
  servings: number;
  favorite: boolean;
  ingredients: string[];
  instructions: string[];
  allergens: string[];
  tags: string[];
  time: number;
  sourceName?: string;
  sourceUrl?: string;
  notes?: string;
  description?: string;
};
export type CopyMeThatResult = { recipes: CopyMeThatRecipe[]; total: number; photosMatched: number; warnings: string[] };
const text=(r:Element,s:string)=>r.querySelector(s)?.textContent?.trim()||'';
const texts=(r:Element,s:string)=>Array.from(r.querySelectorAll(s)).map(x=>x.textContent?.trim()||'').filter(Boolean);
const key=(s:string)=>s.replace(/^\.\//,'').replace(/\\/g,'/').toLowerCase();
function imageData(blob:Blob):Promise<string>{return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{const ratio=Math.min(1,720/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*ratio));canvas.height=Math.max(1,Math.round(img.height*ratio));canvas.getContext('2d')!.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);resolve(canvas.toDataURL('image/jpeg',.72))};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Image could not be read'))};img.src=url})}
export async function parseCopyMeThatZip(file:File,includePhotos=true):Promise<CopyMeThatResult>{
 const zip=await JSZip.loadAsync(file),entries=Object.values(zip.files),page=entries.find(e=>!e.dir&&/(^|\/)recipes\.html$/i.test(e.name));
 if(!page)throw new Error('This ZIP does not contain recipes.html. Select the original Copy Me That export ZIP.');
 const doc=new DOMParser().parseFromString(await page.async('text'),'text/html'),nodes=Array.from(doc.querySelectorAll('.recipe'));
 if(!nodes.length)throw new Error('No Copy Me That recipes were found.');
 const images=new Map(entries.filter(e=>!e.dir&&/\.(jpe?g|png|webp|gif)$/i.test(e.name)).map(e=>[key(e.name),e]));let photosMatched=0;const warnings:string[]=[];const recipes:CopyMeThatRecipe[]=[];
 for(let i=0;i<nodes.length;i++){const n=nodes[i],title=text(n,'#name')||`Imported Recipe ${i+1}`,refs=Array.from(n.querySelectorAll<HTMLImageElement>('.recipeImage')).map(x=>key(x.getAttribute('src')||''));let image='';const entry=refs.map(r=>images.get(r)||images.get(r.replace(/^.*?images\//,'images/'))).find(Boolean);if(includePhotos&&entry){try{image=await imageData(await entry.async('blob'));photosMatched++}catch{warnings.push(`${title}: photo could not be read`)}}else if(includePhotos&&refs.length)warnings.push(`${title}: photo file was missing`);const source=n.querySelector<HTMLAnchorElement>('a[href^="http"]')?.href;recipes.push({id:crypto.randomUUID(),title,image,servings:parseInt(text(n,'#recipeYield').replace(/[^0-9]/g,''))||4,favorite:!!n.querySelector('#starred'),ingredients:texts(n,'.recipeIngredient'),instructions:texts(n,'.instruction'),allergens:[],tags:[...texts(n,'.recipeCategory'),'Copy Me That'],time:30,sourceName:'Copy Me That import',sourceUrl:source||undefined,notes:texts(n,'.recipeNote').join('\n')||undefined,description:text(n,'#description')||undefined})}
 return{recipes,total:recipes.length,photosMatched,warnings};
}
