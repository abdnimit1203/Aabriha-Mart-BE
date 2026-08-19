import ImageKit from "imagekit";
import { env } from "./env";

export const imagekit = new ImageKit({
  publicKey: env.imagekit.publicKey,
  privateKey: env.imagekit.privateKey,
  urlEndpoint: env.imagekit.urlEndpoint,
});
