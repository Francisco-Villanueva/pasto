"use client";

import { Button } from "@design/react";

export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      Imprimir
    </Button>
  );
}
