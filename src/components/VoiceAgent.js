"use client"; // needs the microphone and speakers, so it runs in the browser

// The voice "call". It is a loop:
//   listen (browser speech-to-text, free)  ->  POST /api/agent  ->  speak (browser text-to-speech, free)  ->  listen again ...
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/client.js";

const LABELS = { idle: "Not in a call", listening: "Listening…", thinking: "Thinking…", speaking: "Speaking…" };

export default function VoiceAgent() {
  const [calling, setCalling] = useState(false); // is the call on?
  const [phase, setPhase] = useState("idle"); // idle | listening | thinking | speaking
  const [messages, setMessages] = useState([]); // the conversation shown on screen
  const [interim, setInterim] = useState(""); // words heard so far, before you stop talking
  const [meta, setMeta] = useState(null); // sources + speed of the last answer
  const [error, setError] = useState("");
  const [text, setText] = useState(""); // typed question (backup when there is no microphone)
  const [supported, setSupported] = useState(true);

  // Refs hold values that the async callbacks below must always see fresh.
  const callingRef = useRef(false);
  const busyRef = useRef(false); // true while a question is being answered
  const recRef = useRef(null); // the speech recognizer
  const messagesRef = useRef([]);
  const chatEnd = useRef(null);

  useEffect(() => {
    setSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => hangUp(); // leaving the page ends the call
  }, []);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, interim]);

  function push(msg) {
    messagesRef.current = [...messagesRef.current, msg];
    setMessages(messagesRef.current);
  }

  // ----- the agent talks -----
  function speak(sentence, onDone) {
    if (!("speechSynthesis" in window)) return onDone?.();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(sentence);
    u.lang = "en-US";
    let finished = false;
    const finish = () => {
      if (finished) return; // end and error can both fire; run once
      finished = true;
      onDone?.();
    };
    u.onend = finish;
    u.onerror = finish;
    setPhase("speaking");
    window.speechSynthesis.speak(u);
  }

  // ----- the agent listens -----
  function listen() {
    if (!callingRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true; // show words while you talk
    rec.continuous = false; // stop automatically when you pause

    let heard = "";
    let fatal = false;

    rec.onstart = () => setPhase("listening");
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      heard = t;
      setInterim(t);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return; // normal: you were silent
      fatal = true;
      setError(
        e.error === "not-allowed"
          ? "Microphone is blocked. Allow it in the address bar, then press Start call again."
          : `Speech recognition error: ${e.error}`
      );
    };
    rec.onend = () => {
      setInterim("");
      if (!callingRef.current || busyRef.current) return;
      if (fatal) return hangUp();
      if (heard.trim()) ask(heard.trim());
      else listen(); // heard nothing -> keep listening
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      /* already started */
    }
  }

  // ----- one turn: question -> answer -----
  async function ask(question) {
    busyRef.current = true;
    setError("");
    const history = messagesRef.current.slice(-6); // the last few messages give the agent memory
    push({ role: "user", content: question });
    setPhase("thinking");

    // When the turn is over: go back to listening if the call is still on.
    const done = () => {
      busyRef.current = false;
      if (callingRef.current) listen();
      else setPhase("idle");
    };

    try {
      const data = await api("/api/agent", { method: "POST", body: { question, history } });
      push({ role: "assistant", content: data.answer });
      setMeta({ sources: data.sources, cached: data.cached, ms: data.ms });
      if (callingRef.current) speak(data.answer, done);
      else done();
    } catch (e) {
      setError(e.message);
      if (callingRef.current) speak("Sorry, something went wrong.", done);
      else done();
    }
  }

  function startCall() {
    setError("");
    callingRef.current = true;
    setCalling(true);
    speak("Hello! I am your CRM assistant. How can I help?", listen);
  }

  function hangUp() {
    callingRef.current = false;
    try {
      recRef.current?.abort();
    } catch {}
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setCalling(false);
    setInterim("");
    if (!busyRef.current) setPhase("idle");
  }

  function sendText(e) {
    e.preventDefault();
    const q = text.trim();
    if (!q || busyRef.current) return;
    setText("");
    try {
      recRef.current?.abort(); // stop listening while we answer the typed question
    } catch {}
    ask(q);
  }

  return (
    <div className="grid g2">
      <div className="card">
        <div className="callbar">
          {!calling ? (
            <button onClick={startCall} disabled={!supported}>📞 Start call</button>
          ) : (
            <button className="danger" onClick={hangUp}>⏹ End call</button>
          )}
          <span className={"dot " + (phase === "listening" ? "on" : phase === "thinking" ? "think" : "")} />
          <span className="muted small">{LABELS[phase]}</span>
        </div>

        {!supported && <p className="err">Voice input needs Chrome or Edge. You can still type your question below.</p>}
        {error && <p className="err">⚠ {error}</p>}

        <div className="chat">
          {!messages.length && !interim && <p className="muted">The conversation will appear here.</p>}
          {messages.map((m, i) => (
            <div key={i} className={"msg " + m.role}>{m.content}</div>
          ))}
          {interim && <div className="msg user" style={{ opacity: 0.6 }}>{interim}</div>}
          <div ref={chatEnd} />
        </div>

        <form onSubmit={sendText} style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input placeholder="…or type a question" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
          <button disabled={!text.trim() || phase === "thinking"}>Send</button>
        </form>
      </div>

      <div className="card src">
        <h2>Where the answer came from</h2>
        {!meta ? (
          <p className="muted">Ask something to see which knowledge was used.</p>
        ) : (
          <>
            <p className="muted small">
              {meta.cached ? "⚡ Instant (answer cache)" : "Answered by the AI"} · {meta.ms} ms
            </p>
            <div className="tag">CAG · always-loaded knowledge</div>
            {meta.sources.cag.length ? <ul>{meta.sources.cag.map((t) => <li key={t}>{t}</li>)}</ul> : <p className="muted small">none (pin a document on the Knowledge page)</p>}
            <div className="tag">KAG · connected CRM facts</div>
            {meta.sources.kag.length ? <ul>{meta.sources.kag.map((t) => <li key={t} className="small">{t}</li>)}</ul> : <p className="muted small">no matching names in the question</p>}
            <div className="tag">RAG · best matching notes</div>
            {meta.sources.rag.length ? (
              <ul>{meta.sources.rag.map((r, i) => <li key={i} className="small"><b>{r.title}</b> <span className="muted">(score {r.score})</span><br />{r.text}</li>)}</ul>
            ) : <p className="muted small">no matching notes</p>}
          </>
        )}
      </div>
    </div>
  );
}
