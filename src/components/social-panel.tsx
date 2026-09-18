import { useEffect, useState } from "react";
import {
  heartbeat,
  inviteToLobby,
  listFriends,
  listInvites,
  listOnline,
  listOpenLobbies,
  listRequests,
  respondFriendRequest,
  sendFriendRequest,
} from "@/lib/social-cloud";
import type { LobbyInvite, OnlinePilot, OpenLobbyRow } from "@/schema";

type Props = {
  name: string;
  lobbyCode?: string;
  onJoin: (code: string) => void;
  onInvited?: (userId: string) => void;
};

export function SocialPanel({ name, lobbyCode, onJoin, onInvited }: Props) {
  const [q, setQ] = useState("");
  const [online, setOnline] = useState<OnlinePilot[]>([]);
  const [friends, setFriends] = useState<OnlinePilot[]>([]);
  const [requests, setRequests] = useState<OnlinePilot[]>([]);
  const [invites, setInvites] = useState<LobbyInvite[]>([]);
  const [open, setOpen] = useState<OpenLobbyRow[]>([]);
  const [note, setNote] = useState("");

  async function refresh() {
    try {
      await heartbeat({ data: { name } });
      const [o, f, r, i, l] = await Promise.all([
        listOnline({ data: { q } }),
        listFriends(),
        listRequests(),
        listInvites(),
        listOpenLobbies(),
      ]);
      setOnline(o);
      setFriends(f);
      setRequests(r);
      setInvites(i);
      setOpen(l);
    } catch {
      /* unsigned or DB not ready */
    }
  }

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 20000);
    return () => window.clearInterval(id);
  }, [name, q]);

  return (
    <div className="space-y-3 border-t border-line pt-3">
      <p className="font-mono text-[10px] tracking-[0.14em] text-muted">PILOTS</p>
      {note ? <p className="text-xs text-reticle">{note}</p> : null}
      {requests.length > 0 && (
        <div className="space-y-1">
          <p className="font-mono text-[10px] text-subtle">Requests</p>
          {requests.map((p) => (
            <div key={p.userId} className="flex gap-1">
              <p className="min-w-0 flex-1 truncate text-sm">{p.name}</p>
              <button
                type="button"
                className="rounded-md border border-line px-2 text-xs"
                onClick={() => void respondFriendRequest({ data: { fromId: p.userId, accept: true } }).then(refresh)}
              >
                Accept
              </button>
            </div>
          ))}
        </div>
      )}
      {invites.length > 0 && (
        <div className="space-y-1">
          <p className="font-mono text-[10px] text-subtle">Invites</p>
          {invites.map((inv) => (
            <button
              key={inv.id}
              type="button"
              className="min-h-9 w-full rounded-md border border-line px-2 text-left text-sm"
              onClick={() => onJoin(inv.code)}
            >
              {inv.fromName} · {inv.code}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          void refresh();
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search online"
          className="min-h-10 min-w-0 flex-1 rounded-md border border-line bg-bg px-2 text-sm"
        />
        <button type="submit" className="rounded-md border border-line px-3 text-sm">
          Find
        </button>
      </form>
      <ul className="max-h-36 space-y-1 overflow-y-auto">
        {online.map((p) => (
          <li key={p.userId} className="flex items-center gap-1">
            <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
            <button
              type="button"
              className="rounded-md border border-line px-2 text-[11px]"
              onClick={() =>
                void sendFriendRequest({ data: { userId: p.userId } }).then(() =>
                  setNote("Request sent"),
                )
              }
            >
              Add
            </button>
          </li>
        ))}
        {online.length === 0 && (
          <li className="text-xs text-subtle">No one else online, or the name does not match.</li>
        )}
      </ul>
      <p className="font-mono text-[10px] tracking-[0.14em] text-muted">FRIENDS</p>
      <ul className="max-h-28 space-y-1 overflow-y-auto">
        {friends.map((p) => (
          <li key={p.userId} className="flex items-center gap-1">
            <span className={"h-1.5 w-1.5 rounded-full " + (p.online ? "bg-reticle" : "bg-line")} />
            <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
            {lobbyCode && p.online ? (
              <button
                type="button"
                className="rounded-md border border-line px-2 text-[11px]"
                onClick={() => {
                  onInvited?.(p.userId);
                  void inviteToLobby({ data: { toId: p.userId, code: lobbyCode } }).then(() =>
                    setNote(`Invited ${p.name}`),
                  );
                }}
              >
                Invite
              </button>
            ) : null}
          </li>
        ))}
        {friends.length === 0 && <li className="text-xs text-subtle">No friends yet.</li>}
      </ul>
      {open.length > 0 && (
        <div className="space-y-1">
          <p className="font-mono text-[10px] text-subtle">Open lobbies</p>
          {open.map((row) => (
            <button
              key={row.code}
              type="button"
              className="min-h-9 w-full rounded-md border border-line px-2 text-left text-sm"
              onClick={() => onJoin(row.code)}
            >
              {row.hostName} · T{row.tier} · {row.format} · {row.code}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
