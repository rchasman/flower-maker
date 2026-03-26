import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Chat } from "./Chat.tsx";
import { ConnectedUsers } from "./ConnectedUsers.tsx";

export function ChatPinup() {
  const [open, setOpen] = useState(false);

  return (
    <div className="chat-pinup">
      <AnimatePresence>
        {open && (
          <motion.div
            className="chat-pinup-panel"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.15 }}
          >
            <div className="chat-pinup-header">
              <span style={{ color: "var(--tui-green)", fontWeight: 600 }}>
                COMMS
              </span>
              <button
                onClick={() => setOpen(false)}
                className="tui-btn"
                style={{
                  padding: "0 0.5ch",
                  fontSize: "var(--tui-font-size-xs)",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            <div className="chat-pinup-users">
              <ConnectedUsers />
            </div>
            <div className="chat-pinup-messages">
              <Chat />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen(o => !o)}
        className={`chat-pinup-toggle ${open ? "chat-pinup-toggle-active" : ""}`}
        title="Toggle chat"
      >
        <span style={{ fontSize: "var(--tui-font-size-xs)" }}>
          {open ? "COMMS ×" : "COMMS"}
        </span>
      </button>
    </div>
  );
}
