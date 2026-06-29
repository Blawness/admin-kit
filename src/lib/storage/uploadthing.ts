import type { StorageProvider } from "./types";

// Stub sementara — implementasi UTApi yang sesungguhnya menyusul di Task 4.
export const uploadThingProvider: StorageProvider = {
  name: "uploadthing",
  async put() {
    throw new Error("admin-kit: UploadThing provider belum diimplementasikan");
  },
  async deleteByUrl() {
    return false;
  },
};
