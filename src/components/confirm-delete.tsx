"use client";

import { useState, useTransition, type ReactElement, type ReactNode } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

export function ConfirmDelete({
  action,
  id,
  title = "Hapus item ini?",
  description = "Tindakan ini tidak dapat dibatalkan.",
  confirmLabel = "Hapus",
  successMessage = "Berhasil dihapus.",
  trigger,
}: {
  /** Server action that receives FormData with an `id` field. */
  action: (formData: FormData) => Promise<void>;
  id: number;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  /** Toast yang muncul setelah penghapusan berhasil. */
  successMessage?: string;
  /** Custom trigger element. Defaults to an outline icon button. */
  trigger?: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function handleConfirm() {
    start(async () => {
      const fd = new FormData();
      fd.set("id", String(id));
      let succeeded = false;
      try {
        await action(fd);
        // Hanya tercapai bila action selesai tanpa melempar (mis. redirect
        // pada konflik akan throw, sehingga toast sukses tidak muncul).
        succeeded = true;
      } finally {
        // Tutup dialog baik saat sukses maupun saat action me-redirect
        // (mis. media yang masih dipakai → halaman menampilkan pesan error).
        setOpen(false);
      }
      if (succeeded) toast.success(successMessage);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm" variant="outline" aria-label="Hapus">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )
        }
      />
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Batal
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
