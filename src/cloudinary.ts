const CLOUD_NAME='zb8g2chy';
const UPLOAD_PRESET='piper_recipe_photos';
const ENDPOINT=`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
export async function uploadRecipePhoto(dataUrl:string,recipeId:string):Promise<string>{
 if(!dataUrl.startsWith('data:image/'))throw new Error('Photo is not an uploadable image.');
 const form=new FormData();form.append('file',dataUrl);form.append('upload_preset',UPLOAD_PRESET);form.append('folder','piper/recipe-photos');form.append('public_id',recipeId);form.append('context',`app=piper|recipe_id=${recipeId}`);
 const response=await fetch(ENDPOINT,{method:'POST',body:form});const result=await response.json();
 if(!response.ok)throw new Error(result?.error?.message||`Cloud photo upload failed (${response.status}).`);
 return result.secure_url;
}
