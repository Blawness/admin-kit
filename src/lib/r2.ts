// Shim back-compat: API penyimpanan kini hidup di ./storage/index. Modul ini
// dipertahankan agar impor lama `../lib/r2` pada aplikasi konsumen tetap jalan.
export {
  uploadFile,
  uploadImage,
  deleteObjectByUrl,
  R2_BUCKET,
  R2_PUBLIC_URL,
  r2,
} from "./storage/index";
