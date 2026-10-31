"use client";

import { Printer } from "lucide-react";
import { Button } from "@design/react";
import { Icon } from "@/components/ui";

export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <Icon icon={Printer} /> Imprimir
    </Button>
  );
}
