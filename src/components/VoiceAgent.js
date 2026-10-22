"use client"; // needs the microphone and speakers, so it runs in the browser

// The voice "call". It is a loop:
//   listen (browser speech-to-text, free)  ->  POST /api/agent  ->  speak (browser text-to-speech, free)  ->  listen again ...
//
// Phones are stricter than computers:
//   - the page must be https (or localhost) or the microphone is blocked
//   - some phone browsers only start listening when YOU tap a button
// So there is a "Tap to talk" button, a warning for non-https pages, and a small log that shows
// what the microphone is doing, so problems can be seen instead of guessed.
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/client.js";

const LABELS = { idle: "Not in a call", listening: "Listening…", thinking: "Thinking…", speaking: "Speaking…" };
const MAX_SILENT_TURNS = 3; // after this many empty listens in a row, stop and wait for a tap

export default function VoiceAgent() {
  const [calling, setCalling] = useState(false); // is the call on?
  const [phase, setPhase] = useState("idle"); // idle | listening | thinking | speaking
  const [messages, setMessages] = useState([]); // the conversation shown on screen
  const [interim, setInterim] = useState(""); // words heard so far, before you stop talking
  const [meta, setMeta] = useState(null); // sources + speed of the last answer
  const [error, setError] = useState("");
  const [text, setText] = useState(""); // typed question (backup when there is no microphone)
  const [supported, setSupported] = useState(true);
  const [secure, setSecure] = useState(true); // false when the page is plain http (not localhost)
  const [log, setLog] = useState([]); // troubleshooting lines

  // Refs hold values that the async callbacks below must always see fresh.
  const callingRef = useRef(false);
  const busyRef = useRef(false); // true while a question is being answered
  const recRef = useRef(null); // the speech recognizer
  const silentRef = useRef(0); // empty listens in a row
  const messagesRef = useRef([]);
  const logRef = useRef([]);
  const chatEnd = useRef(null);

  // Add one line to the troubleshooting log (keeps the last 15).
  function dbg(line) {
    const t = new Date().toLocaleTimeString([], { hour12: false });
    logRef.current = [...logRef.current.slice(-14), `${t}  ${line}`];
    setLog(logRef.current);
  }

  useEffect(() => {
    const hasSR = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    setSupported(hasSR);
    setSecure(window.isSecureContext !== false);
    dbg(`page ready | https/localhost: ${window.isSecureContext !== false} | speech input: ${hasSR} | speech output: ${"speechSynthesis" in window}`);
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
    let watchdog;
    const finish = () => {
      if (finished) return; // end, error and the watchdog can all fire; run once
      finished = true;
      clearTimeout(watchdog);
      onDone?.();
    };
    u.onend = () => {
      dbg("speech: finished");
      finish();
    };
    u.onerror = (e) => {
      dbg(`speech error: ${e.error || "unknown"}`);
      finish();
    };
    // Some phones never send the "finished" event. Do not get stuck: continue after a generous time.
    watchdog = setTimeout(() => {
      dbg("speech: no end signal from the phone, continuing");
      finish();
    }, 4000 + sentence.length * 130);

    setPhase("speaking");
    dbg(`speech: "${sentence.slice(0, 40)}${sentence.length > 40 ? "…" : ""}"`);
    window.speechSynthesis.speak(u);
  }

  // After the agent finishes talking, wait a moment so the phone can hand the microphone back.
  const listenSoon = () => setTimeout(listen, 400);

  // ----- the agent listens -----
  function listen() {
    if (!callingRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true; // show words while you talk
    rec.continuous = false; // stop automatically when you pause
    rec.maxAlternatives = 1;

    let heard = "";
    let fatal = false;

    rec.onstart = () => {
      setPhase("listening");
      dbg("mic: started");
    };
    rec.onaudiostart = () => dbg("mic: audio is being captured");
    rec.onsoundstart = () => dbg("mic: sound detected");
    rec.onspeechstart = () => dbg("mic: speech detected");
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      heard = t;
      setInterim(t);
    };
    rec.onerror = (e) => {
      dbg(`mic error: ${e.error}`);
      if (e.error === "no-speech" || e.error === "aborted") return; // normal: you were silent
      fatal = true;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError(
          "Microphone is blocked or not available for this page. Allow it in the browser's site settings and open the https link (not an http address), then press Start call again."
        );
      } else if (e.error === "audio-capture") {
        setError("No microphone was found, or another app is using it. Close other apps that use the microphone and try again.");
      } else if (e.error === "network") {
        setError("Speech recognition needs an internet connection (it runs on the browser's cloud service).");
      } else {
        setError(`Speech recognition error: ${e.error}`);
      }
    };
    rec.onend = () => {
      setInterim("");
      dbg(heard.trim() ? `mic: ended, heard "${heard.trim()}"` : "mic: ended, heard nothing");
      if (!callingRef.current || busyRef.current) return;
      if (fatal) return hangUp();

      if (heard.trim()) {
        silentRef.current = 0;
        ask(heard.trim());
        return;
      }
      // heard nothing
      silentRef.current += 1;
      if (silentRef.current >= MAX_SILENT_TURNS) {
        setPhase("idle");
        setError("I cannot hear you. Check that the microphone is allowed for this site, then tap “Tap to talk” and speak.");
        dbg("paused: waiting for you to tap “Tap to talk”");
      } else {
        setTimeout(listen, 300); // keep listening
      }
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch (e) {
      dbg(`mic: could not start (${e.message})`);
    }
  }

  // The "Tap to talk" button: starting from a real tap is the most reliable way on phones.
  function tapToTalk() {
    setError("");
    silentRef.current = 0;
    try {
      window.speechSynthesis?.cancel();
    } catch {}
    dbg("tap: listening now");
    listen();
  }

  // ----- one turn: question -> answer -----
  async function ask(question) {
    busyRef.current = true;
    setError("");
    const history = messagesRef.current.slice(-6); // the last few messages give the agent memory
    push({ role: "user", content: question });
    setPhase("thinking");
    dbg("asking the server…");

    // When the turn is over: go back to listening if the call is still on.
    const done = () => {
      busyRef.current = false;
      if (callingRef.current) listenSoon();
      else setPhase("idle");
    };

    try {
      const data = await api("/api/agent", { method: "POST", body: { question, history } });
      push({ role: "assistant", content: data.answer });
      setMeta({ sources: data.sources, cached: data.cached, ms: data.ms });
      dbg(`answer received in ${data.ms} ms${data.cached ? " (cached)" : ""}`);
      if (callingRef.current) speak(data.answer, done);
      else done();
    } catch (e) {
      dbg(`server error: ${e.message}`);
      setError(e.message);
      if (callingRef.current) speak("Sorry, something went wrong.", done);
      else done();
    }
  }

  function startCall() {
    setError("");
    silentRef.current = 0;
    callingRef.current = true;
    setCalling(true);
    dbg("call started");
    // The greeting is spoken straight from the tap, which also "unlocks" speech on phones.
    speak("Hello! I am your CRM assistant. How can I help?", listenSoon);
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

  const canTap = calling && phase !== "thinking" && phase !== "speaking" && phase !== "listening";

  return (
    <div className="grid g2">
      <div className="card">
        <div className="callbar">
          {!calling ? (
            <button onClick={startCall} disabled={!supported}>📞 Start call</button>
          ) : (
            <button className="danger" onClick={hangUp}>⏹ End call</button>
          )}
          {calling && <button onClick={tapToTalk} disabled={!canTap}>🎤 Tap to talk</button>}
          <span className={"dot " + (phase === "listening" ? "on" : phase === "thinking" ? "think" : "")} />
          <span className="muted small">{LABELS[phase]}</span>
        </div>

        {!secure && (
          <p className="err">
            This page is opened over plain http, so phones block the microphone. Open the https link (your Vercel site) instead of an address like 192.168.x.x.
          </p>
        )}
        {!supported && <p className="err">Voice input needs Chrome or Edge (on Android, use Chrome). You can still type your question below.</p>}
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

        <details style={{ marginTop: 12 }}>
          <summary className="muted small">Troubleshooting log (open this if the microphone does nothing)</summary>
          <pre className="log">{log.join("\n")}</pre>
        </details>
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