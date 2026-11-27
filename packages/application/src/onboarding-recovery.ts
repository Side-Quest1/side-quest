export const onboardingKey = (user: string) => `sidequest:onboarding:${user}`;

/** The profile is the completion signal; never write it before prerequisites succeed. */
export async function finishOnboarding(steps: {
  checkpoint: () => Promise<void>;
  preferences: () => Promise<void>;
  verification: () => Promise<void>;
  profile: () => Promise<void>;
  clear: () => Promise<void>;
}) {
  await steps.checkpoint();
  await steps.preferences();
  await steps.verification();
  await steps.profile();
  await steps.clear();
}
