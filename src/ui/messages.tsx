"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api, useData, datetime } from "./api";
import { Avatar, Heading, State, type Viewer } from "./shared";
import { MessageCircle } from "lucide-react";
import type { Conversation } from "./types";
export function Messages({
  id,
  user,
}: {
  id?: string;
  user: NonNullable<Viewer>;
}) {
  const list = useData<Conversation[]>("conversations", 5000);
  const chat = useData<Conversation>(id ? `conversations/${id}` : null, 2500);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [older, setOlder] = useState<Conversation["messages"]>([]);
  const [hasOlder, setHasOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const messages = [...older, ...(chat.data?.messages ?? [])]
    .filter((m, i, all) => all.findIndex((x) => x.id === m.id) === i)
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
  return (
    <>
      <Heading
        title="Mensajes"
        text="Conversa y mantén los detalles de cada trabajo a mano."
      />
      <div className={`messages-layout ${id ? "chat-selected" : ""}`}>
        <section className="conversation-list">
          <State {...list} empty={!list.data?.length} onRetry={list.refresh}>
            {list.data?.map((c) => {
              const person =
                user.role === "CLIENTE"
                  ? c.request.contractor
                  : c.request.client;
              return (
                <Link
                  key={c.id}
                  href={`/app/mensajes/${c.id}`}
                  aria-current={id === c.id ? "page" : undefined}
                >
                  <Avatar person={person} />
                  <div>
                    <strong>{person.name}</strong>
                    <span>{c.request.serviceTitle}</span>
                    <p>{c.messages[0]?.body ?? "Comienza la conversación"}</p>
                  </div>
                </Link>
              );
            })}
          </State>
        </section>
        <section className="chat-panel">
          {!id ? (
            <div className="empty">
              <MessageCircle size={38} />
              <h3>Las conversaciones empiezan aquí</h3>
              <p>Selecciona una solicitud para coordinar tu servicio.</p>
            </div>
          ) : (
            <State {...chat} onRetry={chat.refresh}>
              {chat.data && (
                <>
                  <div className="chat-header">
                    <Link className="mobile-chat-back" href="/app/mensajes">
                      Volver
                    </Link>
                    <Avatar
                      person={
                        user.role === "CLIENTE"
                          ? chat.data.request.contractor
                          : chat.data.request.client
                      }
                    />
                    <div>
                      <strong>
                        {user.role === "CLIENTE"
                          ? chat.data.request.contractor.name
                          : chat.data.request.client.name}
                      </strong>
                      <Link href={`/app/solicitudes/${chat.data.request.id}`}>
                        {chat.data.request.serviceTitle}
                      </Link>
                    </div>
                  </div>
                  <div
                    className="chat-history"
                    aria-label="Historial de mensajes"
                  >
                    {chat.data.hasMore && hasOlder && (
                      <Button
                        variant="ghost"
                        disabled={loadingOlder}
                        onClick={async () => {
                          setLoadingOlder(true);
                          try {
                            const old = await api<Conversation>(
                              `conversations/${id}?before=${messages[0]?.id}`,
                            );
                            setOlder((previous) => [
                              ...old.messages,
                              ...previous,
                            ]);
                            setHasOlder(!!old.hasMore);
                          } catch (e) {
                            setError(e instanceof Error ? e.message : "Error.");
                          } finally {
                            setLoadingOlder(false);
                          }
                        }}
                      >
                        Cargar mensajes anteriores
                      </Button>
                    )}
                    {!messages.length && (
                      <p className="empty">
                        Envía el primer mensaje para coordinar el servicio.
                      </p>
                    )}
                    {messages.map((m) => (
                      <article
                        key={m.id}
                        className={`chat-bubble ${m.senderId === user.id ? "mine" : ""}`}
                      >
                        <p>{m.body}</p>
                        <time dateTime={m.createdAt}>
                          {datetime(m.createdAt)}
                        </time>
                      </article>
                    ))}
                  </div>
                  {error && (
                    <p role="alert" className="error">
                      {error}
                    </p>
                  )}
                  <form
                    className="chat-compose"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!body.trim() || sending) return;
                      setSending(true);
                      setError("");
                      try {
                        await api(`conversations/${id}/messages`, "POST", {
                          body,
                        });
                        setBody("");
                        chat.refresh();
                        list.refresh();
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "No se pudo enviar.",
                        );
                      } finally {
                        setSending(false);
                      }
                    }}
                  >
                    <label htmlFor="message" className="sr-only">
                      Tu mensaje
                    </label>
                    <textarea
                      id="message"
                      rows={2}
                      maxLength={2000}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Escribe tu mensaje…"
                      disabled={["REJECTED", "CANCELLED"].includes(
                        chat.data.request.status,
                      )}
                    />
                    <Button type="submit" disabled={sending || !body.trim()}>
                      {sending ? "Enviando…" : "Enviar"}
                    </Button>
                  </form>
                </>
              )}
            </State>
          )}
        </section>
      </div>
    </>
  );
}
