export const REPORT_REASONS = [
  "spam",
  "harassment",
  "hate",
  "sexual",
  "violence",
  "self_harm",
  "impersonation",
  "other",
] as const;

export const REPORT_REASON_LABELS: Record<(typeof REPORT_REASONS)[number], string> = {
  spam: "Spam or scam",
  harassment: "Bullying or harassment",
  hate: "Hate speech",
  sexual: "Nudity or sexual content",
  violence: "Violence or threats",
  self_harm: "Self-harm",
  impersonation: "Pretending to be someone else",
  other: "Something else",
};
