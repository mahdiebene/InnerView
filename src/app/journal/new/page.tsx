import { KeyGate } from "@/components/KeyGate";
import { EntryComposer } from "@/components/EntryComposer";

export default function NewEntryPage() {
  return (
    <KeyGate requirePollen>
      <EntryComposer />
    </KeyGate>
  );
}

