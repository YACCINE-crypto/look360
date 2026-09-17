"use client";

import { deleteProduit } from "./actions";

export function DeleteButton({ id }: { id: string }) {
  return (
    <form
      action={deleteProduit}
      onSubmit={(e) => {
        if (!confirm("Supprimer ce produit ? Cette action est définitive.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
        title="Supprimer"
      >
        Supprimer
      </button>
    </form>
  );
}
