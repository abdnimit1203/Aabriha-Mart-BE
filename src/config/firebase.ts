import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { env } from "./env";

let app: App;

if (!getApps().length && env.firebase.projectId) {
  app = initializeApp({
    credential: cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: env.firebase.privateKey,
    }),
  });
} else {
  app = getApps()[0];
}

export const firebaseApp = app;
