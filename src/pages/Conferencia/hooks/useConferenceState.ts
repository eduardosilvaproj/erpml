import { useState } from "react";
import type { ConferenceMode, ConferenceType, Step } from "../types";

export function useConferenceState() {
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<ConferenceMode | null>(null);
  const [conferenceName, setConferenceName] = useState("");
  const [conferenceType, setConferenceType] = useState<ConferenceType>("full");
  const [sectionName, setSectionName] = useState("");
  const [conferenceId, setConferenceId] = useState<string | null>(null);

  const resetState = () => {
    setStep(1);
    setMode(null);
    setConferenceName("");
    setConferenceType("full");
    setSectionName("");
    setConferenceId(null);
  };

  return {
    step,
    setStep,
    mode,
    setMode,
    conferenceName,
    setConferenceName,
    conferenceType,
    setConferenceType,
    sectionName,
    setSectionName,
    conferenceId,
    setConferenceId,
    resetState,
  };
}
