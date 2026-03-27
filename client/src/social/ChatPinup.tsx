import { useState } from "react";
import { PanelPopout } from "../ui/PanelPopout.tsx";
import { Chat } from "./Chat.tsx";
import { ConnectedUsers } from "./ConnectedUsers.tsx";

export function ChatPinup() {
  const [open, setOpen] = useState(false);

  return (
    <PanelPopout
      label="COMMS"
      open={open}
      onToggle={() => setOpen(o => !o)}
      position="bottom-right"
    >
      <div className="popout-section">
        <ConnectedUsers />
      </div>
      <div className="popout-body">
        <Chat />
      </div>
    </PanelPopout>
  );
}
