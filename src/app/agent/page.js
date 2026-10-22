// PAGE 2 of 3: the voice agent. The component does the work; this file only places it.
import VoiceAgent from "../../components/VoiceAgent.js";

export const metadata = { title: "Voice Agent · Voice CRM" };

export default function AgentPage() {
  return (
    <>
      <h1>Voice Agent</h1>
      <p className="sub">
        Press <b>Start call</b>, allow the microphone, and talk. Try: “Tell me about Ali Khan”, “What is the refund policy?”, “Which deals are in negotiation?”.
      </p>
      <VoiceAgent />
    </>
  );
}
