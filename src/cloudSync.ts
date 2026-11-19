import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

import { db } from './firebase';

export type SyncRecipe = {
  id: string;
  image?: string;
  [key: string]: unknown;
};

export type CloudState = {
  prefs?: unknown;
  plan?: unknown;
  groceries?: unknown;
  pantry?: unknown;
  onboarded?: boolean;
  budget?: number;
};

export type CommunityGroceryObservation = {
  itemName: string;
  store: string;
  zip: string;
  category: string;
  aisle: string;
  price: number;
};

const stripUndefined = <T,>(value: T): T =>
  JSON.parse(JSON.stringify(value));

const cleanRecipe = (recipe: SyncRecipe) => {
  const localPhoto =
    typeof recipe.image === 'string' && recipe.image.startsWith('data:');

  return stripUndefined({
    ...recipe,
    image: localPhoto ? '' : recipe.image || '',
    photoSync: localPhoto ? 'local-only' : 'cloud-url',
    familyPrivate: recipe.familyPrivate === true,
    updatedAt: Date.now(),
  });
};

export const recipeFingerprint = (recipe: SyncRecipe) => {
  const cleaned = cleanRecipe(recipe) as Record<string, unknown>;
  delete cleaned.updatedAt;
  return JSON.stringify(cleaned, Object.keys(cleaned).sort());
};

export async function loadCloud(uid: string) {
  const stateSnap = await getDoc(doc(db, 'users', uid, 'state', 'main'));
  const recipeSnap = await getDocs(collection(db, 'users', uid, 'recipes'));

  return {
    state: stateSnap.exists() ? (stateSnap.data() as CloudState) : null,
    recipes: recipeSnap.docs.map(snapshot => snapshot.data()),
  };
}

export async function saveCloudState(uid: string, state: CloudState) {
  await setDoc(
    doc(db, 'users', uid, 'state', 'main'),
    stripUndefined({ ...state, updatedAt: Date.now() }),
    { merge: true }
  );
}

export async function saveCommunityGroceryObservation(
  value: CommunityGroceryObservation
) {
  await addDoc(
    collection(db, 'communityGroceryObservations'),
    stripUndefined({
      ...value,
      itemName: value.itemName.slice(0, 120),
      store: value.store.slice(0, 80),
      zip: value.zip.slice(0, 5),
      category: value.category.slice(0, 80),
      aisle: value.aisle.slice(0, 80),
      price:
        Math.round(Math.max(0, Math.min(value.price, 9999)) * 100) / 100,
      observedAt: Date.now(),
      schemaVersion: 1,
    })
  );
}

export type BetaFeedback = {
  uid: string;
  email: string;
  category: string;
  area: string;
  message: string;
  diagnostics: Record<string, unknown> | null;
};

export type BetaFeedbackStatus = 'new' | 'reviewing' | 'fixed';

export type BetaFeedbackReport = BetaFeedback & {
  id: string;
  status: BetaFeedbackStatus;
  createdAt: number;
  schemaVersion: number;
};

export async function saveBetaFeedback(feedback: BetaFeedback) {
  await addDoc(collection(db, 'betaFeedback'), {
    uid: feedback.uid,
    email: String(feedback.email || '').slice(0, 200),
    category: String(feedback.category || 'other').slice(0, 20),
    area: String(feedback.area || '').slice(0, 40),
    message: String(feedback.message || '').slice(0, 4000),
    diagnostics: feedback.diagnostics
      ? stripUndefined(feedback.diagnostics)
      : null,
    status: 'new',
    createdAt: Date.now(),
    schemaVersion: 1,
  });
}

export async function loadBetaFeedback(): Promise<BetaFeedbackReport[]> {
  const snap = await getDocs(collection(db, 'betaFeedback'));

  const rows = snap.docs.map(
    snapshot =>
      ({
        id: snapshot.id,
        ...snapshot.data(),
      }) as BetaFeedbackReport
  );

  return rows.sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
}

export async function setBetaFeedbackStatus(
  id: string,
  status: BetaFeedbackStatus
): Promise<void> {
  await setDoc(
    doc(db, 'betaFeedback', id),
    { status, updatedAt: Date.now() },
    { merge: true }
  );
}

export async function syncChangedRecipes(
  uid: string,
  recipes: SyncRecipe[],
  knownIds: Set<string>,
  knownHashes: Map<string, string>
) {
  const currentIds = new Set(recipes.map(recipe => recipe.id));
  const deleted = [...knownIds].filter(id => !currentIds.has(id));

  for (const id of deleted) {
    await deleteDoc(doc(db, 'users', uid, 'recipes', id));
    knownIds.delete(id);
    knownHashes.delete(id);
  }

  const changed = recipes.filter(
    recipe => knownHashes.get(recipe.id) !== recipeFingerprint(recipe)
  );

  for (let start = 0; start < changed.length; start += 400) {
    const group = changed.slice(start, start + 400);
    const batch = writeBatch(db);

    group.forEach(recipe =>
      batch.set(doc(db, 'users', uid, 'recipes', recipe.id), cleanRecipe(recipe))
    );

    await batch.commit();

    group.forEach(recipe => {
      knownIds.add(recipe.id);
      knownHashes.set(recipe.id, recipeFingerprint(recipe));
    });
  }

  return changed.length + deleted.length;
}

export async function importRecipesInBatches(
  uid: string | undefined,
  recipes: SyncRecipe[],
  progress: (
    phase: string,
    current: number,
    total: number,
    percent: number
  ) => void
) {
  const importId = crypto.randomUUID();

  if (uid) {
    await setDoc(doc(db, 'users', uid, 'imports', importId), {
      status: 'saving',
      totalRecipes: recipes.length,
      savedRecipes: 0,
      photosLocalOnly: recipes.filter(recipe =>
        String(recipe.image || '').startsWith('data:')
      ).length,
      startedAt: Date.now(),
    });
  }

  for (let start = 0; start < recipes.length; start += 20) {
    const group = recipes.slice(start, start + 20);

    if (uid) {
      const batch = writeBatch(db);

      group.forEach(recipe =>
        batch.set(
          doc(db, 'users', uid, 'recipes', recipe.id),
          cleanRecipe(recipe)
        )
      );

      await batch.commit();

      await setDoc(
        doc(db, 'users', uid, 'imports', importId),
        {
          status: 'saving',
          totalRecipes: recipes.length,
          savedRecipes: Math.min(start + group.length, recipes.length),
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }

    const current = Math.min(start + group.length, recipes.length);

    progress(
      uid ? 'Syncing recipe records' : 'Saving recipes',
      current,
      recipes.length,
      30 + Math.round((current / Math.max(1, recipes.length)) * 65)
    );

    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  if (uid) {
    await setDoc(
      doc(db, 'users', uid, 'imports', importId),
      {
        status: 'done',
        savedRecipes: recipes.length,
        completedAt: Date.now(),
      },
      { merge: true }
    );
  }

  return importId;
}
