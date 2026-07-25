import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDocs, query, where, addDoc, updateDoc, deleteDoc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function apiFetch(url: string, options: RequestInit = {}) {
  const currentUser = auth.currentUser;
  let headers = new Headers(options.headers || {});
  if (currentUser) {
    const idToken = await currentUser.getIdToken();
    headers.set('Authorization', `Bearer ${idToken}`);
  }
  return fetch(url, { ...options, headers });
}

export async function parseJsonResponse<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  
  if (!res.ok) {
    let errorMessage = `Erro na requisição (${res.status})`;
    if (contentType.includes('application/json')) {
      try {
        const json = await res.json();
        if (json.error) errorMessage = json.error;
      } catch (_) {}
    } else {
      const text = await res.text();
      const cleanText = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
      if (cleanText.includes('Cookie check')) {
        errorMessage = 'Restrição de iFrame: Por favor, abra o app em uma nova guia para fazer o upload.';
      } else {
        errorMessage = cleanText ? `Erro ${res.status}: ${cleanText.substring(0, 120)}` : `Erro ${res.status}`;
      }
    }
    throw new Error(errorMessage);
  }

  if (!contentType.includes('application/json')) {
    const text = await res.text();
    const cleanText = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    if (cleanText.includes('Cookie check')) {
      throw new Error(`O upload falhou devido a restrições do navegador. Por favor, abra o aplicativo em uma nova guia (botão no canto superior direito) para fazer envios de arquivos.`);
    }
    throw new Error(`Resposta do servidor inválida (${cleanText.substring(0, 100)})`);
  }

  return res.json();
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
